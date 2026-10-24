import { createConnectTransport } from "@connectrpc/connect-node";
import { createClientFor } from "@zitadel/client";
import { OIDCService } from "@zitadel/proto/zitadel/oidc/v2/oidc_service_pb";
import { OrganizationService } from "@zitadel/proto/zitadel/org/v2/org_service_pb";
import { SessionService } from "@zitadel/proto/zitadel/session/v2/session_service_pb";
import { SettingsService } from "@zitadel/proto/zitadel/settings/v2/settings_service_pb";
import { UserService } from "@zitadel/proto/zitadel/user/v2/user_service_pb";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { ConsumerEmailLogin } from "../src/lib/consumer-email/login";
import { ConsumerEmailStore } from "../src/lib/consumer-email/store";

const directory = process.env.CONSUMER_EMAIL_NATIVE_DIR;
if (!directory) throw new Error("Set CONSUMER_EMAIL_NATIVE_DIR to an isolated native fixture directory");
const root = directory;
const config = JSON.parse(readFileSync(join(root, "client.json"), "utf8"));
if (new URL(config.baseUrl).hostname !== "localhost") throw new Error("Native test requires a localhost fixture");
let valkey: ChildProcess;
let store: ConsumerEmailStore;
let login: ConsumerEmailLogin;
beforeAll(async () => {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const address = socket.address();
  if (!address || typeof address === "string") throw new Error("No fixture port");
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  valkey = spawn("valkey-server", ["--bind", "127.0.0.1", "--port", String(address.port), "--save", "", "--appendonly", "no"]);
  await new Promise<void>((resolve, reject) => {
    valkey.once("error", reject);
    valkey.once("exit", () => reject(new Error("Valkey fixture exited")));
    valkey.stdout?.on("data", (value) => { if (value.toString().includes("Ready to accept connections")) resolve(); });
  });
  store = new ConsumerEmailStore(`redis://127.0.0.1:${address.port}`);
  const token = readFileSync(join(root, "login.pat"), "utf8").trim();
  const transport = createConnectTransport({
    baseUrl: config.baseUrl, httpVersion: "1.1", defaultTimeoutMs: 5000,
    interceptors: [(next) => async (request) => { request.header.set("Authorization", `Bearer ${token}`); return next(request); }],
  });
  login = new ConsumerEmailLogin(config.baseUrl, store, {
    oidc: createClientFor(OIDCService)(transport), organizations: createClientFor(OrganizationService)(transport),
    sessions: createClientFor(SessionService)(transport), settings: createClientFor(SettingsService)(transport),
    users: createClientFor(UserService)(transport),
  });
});
afterAll(() => { store?.close(); valkey?.kill(); });

async function authorize() {
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(24).toString("hex");
  const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code",
    scope: `openid profile email urn:zitadel:iam:org:id:${config.organization} urn:zitadel:iam:user:resourceowner`,
    state, nonce: randomBytes(24).toString("hex"), code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
  const response = await fetch(`${config.baseUrl}/oauth/v2/authorize?${query}`, { redirect: "manual", signal: AbortSignal.timeout(5000) });
  const location = response.headers.get("location");
  if (!location) throw new Error("Native authorization did not redirect");
  const requestId = new URL(location, config.baseUrl).searchParams.get("authRequest");
  if (!requestId) throw new Error("Native authorization did not create an auth request");
  return { requestId, verifier, state };
}
async function codeAfter(before: Set<string>, email: string) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const file = readdirSync(join(root, "mail")).find((name) => !before.has(name) && readFileSync(join(root, "mail", name), "utf8").includes(email));
    if (file) {
      const code = execFileSync(join(root, "venv/bin/python"), ["-c", `import email,email.policy,re,sys,html,urllib.parse
m=email.message_from_binary_file(open(sys.argv[1],'rb'),policy=email.policy.default)
s=m.get_body(preferencelist=('plain','html')).get_content()
links=re.findall(r'href="([^"]+)"',s)
codes=[v for url in links for v in urllib.parse.parse_qs(urllib.parse.urlparse(html.unescape(url)).query).get('code',[])]
s=re.sub(r'<style.*?</style>','',s,flags=re.S)
s=html.unescape(re.sub(r'<[^>]*>',' ',s))
c=codes or re.findall(r'(?<![0-9])[0-9]{6,8}(?![0-9])',s)
if len(set(c))!=1: raise SystemExit('Expected exactly one native email code')
print(c[0])`, join(root, "mail", file)], { encoding: "utf8" }).trim();
      return code;
    }
    await setTimeout(100);
  }
  throw new Error("Native SMTP delivery timed out");
}
it("signs up through native SMTP verification and exchanges a verified OTP callback", async () => {
  const auth = await authorize();
  const email = `native-${randomBytes(6).toString("hex")}@example.test`;
  let delivered = new Set(readdirSync(join(root, "mail")));
  const registration = await login.start({ requestId: auth.requestId, email, givenName: "Native", familyName: "Fixture" });
  expect(registration.phase).toBe("verify-email");
  const verification = await codeAfter(delivered, email);
  delivered = new Set(readdirSync(join(root, "mail")));
  const challenge = await login.verify(registration.handle, verification);
  if (!("handle" in challenge)) throw new Error("Mailbox verification incorrectly completed login");
  expect(challenge.phase).toBe("otp");
  const otp = await codeAfter(delivered, email);
  const result = await login.verify(challenge.handle, otp);
  if (!("redirect" in result)) throw new Error("Native OTP did not complete OIDC");
  const callback = new URL(result.redirect);
  expect(callback.origin + callback.pathname).toBe(config.redirectUri);
  expect(callback.searchParams.get("state") === auth.state).toBe(true);
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("Native callback missing authorization code");
  const tokens = await fetch(`${config.baseUrl}/oauth/v2/token`, { method: "POST", signal: AbortSignal.timeout(5000),
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: config.clientId, redirect_uri: config.redirectUri, code, code_verifier: auth.verifier }) });
  expect(tokens.status).toBe(200);
  const token = await tokens.json();
  const response = await fetch(`${config.baseUrl}/oidc/v1/userinfo`, { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(5000) });
  expect(response.status).toBe(200);
  const identity = await response.json();
  expect(identity.email === email).toBe(true);
  expect(identity.email_verified).toBe(true);
  await expect(login.verify(challenge.handle, otp)).rejects.toThrow();
});

async function nativeAdmin(path: string, body: object) {
  const token = readFileSync(join(root, "admin.pat"), "utf8").trim();
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST", signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "x-zitadel-orgid": config.organization },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Native fixture configuration failed: HTTP ${response.status}`);
  return response.json();
}

it("rejects a wrong native code and consumes the pending returning-user attempt", async () => {
  const email = `returning-${randomBytes(6).toString("hex")}@example.test`;
  await nativeAdmin("/v2/users/human", {
    username: email, organization: { orgId: config.organization },
    profile: { givenName: "Returning", familyName: "Fixture" }, email: { email, isVerified: true },
  });
  const auth = await authorize();
  const delivered = new Set(readdirSync(join(root, "mail")));
  const challenge = await login.start({ requestId: auth.requestId, email, givenName: "Returning", familyName: "Fixture" });
  expect(challenge.phase).toBe("otp");
  const code = await codeAfter(delivered, email);
  const wrongCode = (code[0] === "0" ? "1" : "0") + code.slice(1);
  await expect(login.verify(challenge.handle, wrongCode)).rejects.toThrow();
  await expect(login.verify(challenge.handle, code)).rejects.toThrow();
});

it("honors explicit organization opt-out and allows re-enablement", async () => {
  const policy = (enabled: boolean) => nativeAdmin("/management/v1/metadata/consumer_email_otp", {
    value: Buffer.from(JSON.stringify({ version: 1, enabled, smsEnabled: false })).toString("base64"),
  });
  const auth = await authorize();
  const email = `optional-${randomBytes(6).toString("hex")}@example.test`;
  const input = { requestId: auth.requestId, email, givenName: "Optional", familyName: "Fixture" };
  try {
    await policy(false);
    await expect(login.start(input)).rejects.toThrow();
    await policy(true);
    const delivered = new Set(readdirSync(join(root, "mail")));
    const registration = await login.start(input);
    expect(registration.phase).toBe("verify-email");
    const code = await codeAfter(delivered, email);
    await policy(false);
    await expect(login.verify(registration.handle, code)).rejects.toThrow();
  } finally {
    await policy(true);
  }
});
