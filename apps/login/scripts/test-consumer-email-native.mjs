import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const binary = process.env.CONSUMER_EMAIL_ZITADEL_BINARY;
if (!binary) throw new Error("Set CONSUMER_EMAIL_ZITADEL_BINARY to the locally built Zitadel binary");
process.umask(0o077);
const root = mkdtempSync(join(tmpdir(), "consumer-email-native-"));
const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = [];
let postgresStarted = false;
let passed = false;
function run(command, args) {
  const log = openSync(join(root, "setup.log"), "a");
  try {
    const result = spawnSync(command, args, { stdio: ["ignore", log, log], timeout: 120000 });
    if (result.status !== 0) throw new Error(`${command} failed; inspect the protected fixture directory`);
  } finally {
    closeSync(log);
  }
}
function background(command, args, name) {
  const log = openSync(join(root, `${name}.log`), "a");
  const child = spawn(command, args, {
    stdio: ["ignore", log, log],
    cwd: root,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("ZITADEL_"))),
  });
  closeSync(log);
  child.on("error", () => {});
  children.push(child);
  return child;
}
async function port() {
  const server = createServer();
  await new Promise((accept, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", accept);
  });
  const address = server.address();
  await new Promise((accept) => server.close(accept));
  if (!address || typeof address === "string") throw new Error("Could not allocate fixture port");
  return address.port;
}
async function waitReady(url, child, headers = {}) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      if ((await fetch(url, { headers, signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {
      /* Startup connection refusal is expected. */
    }
    await setTimeout(200);
  }
  throw new Error("Native Zitadel did not become ready");
}
try {
  const ports = { postgres: await port(), smtp: await port(), api: await port(), login: await port() };
  writeFileSync(join(root, "ports.json"), JSON.stringify(ports));
  const password = randomBytes(24).toString("base64url");
  writeFileSync(join(root, "pg-password"), password);
  run("initdb", [
    "-D",
    join(root, "pg"),
    "-U",
    "otp_fixture",
    "--auth=scram-sha-256",
    `--pwfile=${join(root, "pg-password")}`,
  ]);
  run("pg_ctl", [
    "-D",
    join(root, "pg"),
    "-l",
    join(root, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${ports.postgres} -k ${root}`,
    "-w",
    "start",
  ]);
  postgresStarted = true;
  run("uv", ["venv", join(root, "venv")]);
  run("uv", ["pip", "install", "--python", join(root, "venv/bin/python"), "aiosmtpd==1.4.6"]);
  mkdirSync(join(root, "mail"));
  writeFileSync(
    join(root, "smtp.py"),
    `import asyncio,pathlib,json,uuid,os
from aiosmtpd.controller import Controller
p=pathlib.Path(__file__).parent
class Sink:
 async def handle_DATA(self,server,session,envelope):
  target=p/'mail'/(uuid.uuid4().hex+'.eml')
  target.write_bytes(envelope.original_content)
  os.chmod(target,0o600)
  return '250 OK'
c=Controller(Sink(),hostname='127.0.0.1',port=json.loads((p/'ports.json').read_text())['smtp'])
c.start()
asyncio.run(asyncio.Event().wait())
`,
  );
  background(join(root, "venv/bin/python"), [join(root, "smtp.py")], "smtp");
  const expiry = new Date(Date.now() + 86400000).toISOString();
  const config = {
    Port: ports.api,
    ExternalPort: ports.api,
    ExternalDomain: "localhost",
    ExternalSecure: false,
    TLS: { Enabled: false },
    Log: { Level: "warn" },
    Telemetry: { Enabled: false },
    Database: {
      postgres: {
        Host: "127.0.0.1",
        Port: ports.postgres,
        Database: "email_native",
        User: { Username: "email_native", Password: randomBytes(24).toString("base64url"), SSL: { Mode: "disable" } },
        Admin: { Username: "otp_fixture", Password: password, ExistingDatabase: "postgres", SSL: { Mode: "disable" } },
      },
    },
    FirstInstance: {
      PatPath: join(root, "admin.pat"),
      LoginClientPatPath: join(root, "login.pat"),
      InstanceName: "Email OTP isolated test",
      Org: {
        Human: {
          Password: randomBytes(24).toString("base64url") + "Aa1!",
          Email: { Address: "admin@example.test", Verified: true },
        },
        Machine: { Machine: { Username: "fixture-admin", Name: "Isolated admin" }, Pat: { ExpirationDate: expiry } },
        LoginClient: { Machine: { Username: "fixture-login", Name: "Isolated login" }, Pat: { ExpirationDate: expiry } },
      },
    },
    DefaultInstance: {
      DomainPolicy: { SMTPSenderAddressMatchesInstanceDomain: false },
      SMTPConfiguration: {
        SMTP: { Host: `127.0.0.1:${ports.smtp}` },
        TLS: false,
        From: "auth@example.test",
        FromName: "Isolated OTP test",
      },
      Features: { LoginV2: { Required: true, BaseURI: `http://localhost:${ports.login}/ui/v2/login` } },
    },
  };
  writeFileSync(join(root, "config.json"), JSON.stringify(config));
  writeFileSync(join(root, "masterkey"), randomBytes(16).toString("hex"));
  const broker = background(
    resolve(binary),
    [
      "start-from-init",
      "--config",
      join(root, "config.json"),
      "--steps",
      join(root, "config.json"),
      "--masterkeyFile",
      join(root, "masterkey"),
    ],
    "broker",
  );
  const baseUrl = `http://localhost:${ports.api}`;
  await waitReady(`${baseUrl}/debug/ready`, broker);
  const organization = "consumer-nativefixture";
  const admin = readFileSync(join(root, "admin.pat"), "utf8").trim();
  await waitReady(`${baseUrl}/auth/v1/users/me`, broker, { Authorization: `Bearer ${admin}` });
  async function request(path, body, scoped = true) {
    const headers = { Authorization: `Bearer ${admin}`, "Content-Type": "application/json" };
    if (scoped) headers["x-zitadel-orgid"] = organization;
    const response = await fetch(baseUrl + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Fixture setup failed at ${path}: HTTP ${response.status}`);
    return response.json();
  }
  await request("/v2/organizations", { organizationId: organization, name: "Native Email Fixture" }, false);
  for (const [key, value] of [
    ["consumer_binding", "identity-operator/nativefixture"],
    ["consumer_email_otp", JSON.stringify({ version: 1, enabled: true, smsEnabled: false })],
  ]) {
    await request(`/management/v1/metadata/${key}`, { value: Buffer.from(value).toString("base64") });
  }
  await request("/management/v1/policies/login", {
    allowUsernamePassword: false,
    allowRegister: false,
    allowExternalIdp: true,
    forceMfa: false,
    forceMfaLocalOnly: false,
    passwordlessType: "PASSWORDLESS_TYPE_NOT_ALLOWED",
    secondFactors: [],
    multiFactors: [],
  });
  const project = await request("/management/v1/projects", { name: "Native Email Fixture" });
  const redirectUri = "http://localhost:19999/callback";
  const client = await request(`/management/v1/projects/${project.id}/apps/oidc`, {
    name: "Native Fixture Web",
    redirectUris: [redirectUri],
    responseTypes: ["OIDC_RESPONSE_TYPE_CODE"],
    grantTypes: ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE"],
    appType: "OIDC_APP_TYPE_USER_AGENT",
    authMethodType: "OIDC_AUTH_METHOD_TYPE_NONE",
    version: "OIDC_VERSION_1_0",
    devMode: true,
    loginVersion: { loginV2: { baseUri: `http://localhost:${ports.login}/ui/v2/login` } },
  });
  writeFileSync(
    join(root, "client.json"),
    JSON.stringify({ clientId: client.clientId, organization, baseUrl, redirectUri }),
  );
  const result = spawnSync("pnpm", ["exec", "vitest", "--run", "--config", "vitest.config.consumer-email.ts"], {
    cwd: app,
    env: { ...process.env, CONSUMER_EMAIL_NATIVE_DIR: root },
    stdio: "inherit",
    timeout: 180000,
  });
  if (result.status !== 0) throw new Error("Native consumer email integration tests failed");
  passed = true;
} finally {
  for (const child of children.reverse()) {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([new Promise((accept) => child.once("exit", accept)), setTimeout(5000)]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }
  if (postgresStarted) run("pg_ctl", ["-D", join(root, "pg"), "-m", "fast", "-w", "stop"]);
  if (passed) rmSync(root, { recursive: true });
  else console.error(`Protected native fixture retained for diagnosis: ${root}`);
}
