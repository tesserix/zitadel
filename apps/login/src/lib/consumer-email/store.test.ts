// @vitest-environment node
import { UserState } from "@zitadel/proto/zitadel/user/v2/user_pb";
import { AuthenticationMethodType } from "@zitadel/proto/zitadel/user/v2/user_service_pb";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConsumerEmailLogin } from "./login";
import { ConsumerEmailStore } from "./store";
let server: ChildProcess;
let first: ConsumerEmailStore;
let second: ConsumerEmailStore;
beforeAll(async () => {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const address = socket.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  await new Promise<void>((resolve, reject) => socket.close((err) => (err ? reject(err) : resolve())));
  server = spawn("valkey-server", [
    "--bind",
    "127.0.0.1",
    "--port",
    String(address.port),
    "--save",
    "",
    "--appendonly",
    "no",
  ]);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("exit", () => reject(new Error("Valkey exited before ready")));
    server.stdout?.on("data", (data) => {
      if (data.toString().includes("Ready to accept connections")) resolve();
    });
  });
  first = new ConsumerEmailStore(`redis://127.0.0.1:${address.port}`);
  second = new ConsumerEmailStore(`redis://127.0.0.1:${address.port}`);
}, 30000);
afterAll(async () => {
  first?.close();
  second?.close();
  server?.kill();
});
describe("shared consumer email state", () => {
  it("enforces cooldown atomically across replicas", async () => {
    const decisions = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        (i % 2 ? first : second).reserve("instance", "consumer-one", "user@example.test"),
      ),
    );
    expect(decisions.filter(Boolean)).toHaveLength(1);
    expect(await second.reserve("instance", "consumer-two", "user@example.test")).toBe(true);
  });
  it("consumes a flow only once and binds it to its instance", async () => {
    const handle = await first.save("instance", {
      organization: "consumer-one",
      requestId: "oidc_request",
      userId: "user",
      email: "user@example.test",
      phase: "otp",
      sessionId: "session",
      sessionToken: "fixture",
    });
    expect(await second.take("other", handle)).toBeNull();
    const results = await Promise.all([first.take("instance", handle), second.take("instance", handle)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.find(Boolean)?.userId).toBe("user");
    expect(await first.take("instance", handle)).toBeNull();
  });
  it("fails closed when Valkey is unavailable", async () => {
    const unavailable = new ConsumerEmailStore("redis://127.0.0.1:1");
    try {
      await expect(unavailable.reserve("instance", "consumer-one", "user@example.test")).rejects.toThrow();
    } finally {
      unavailable.close();
    }
  });
});

function backend() {
  const metadata = (key: string, value: string) => ({ key, value: new TextEncoder().encode(value) });
  const user = {
    userId: "patient-login",
    state: UserState.ACTIVE,
    details: { resourceOwner: "consumer-mediconnect" },
    type: { case: "human", value: { email: { email: "test@example.test", isVerified: true } } },
  };
  return {
    settings: { getLoginSettings: vi.fn().mockResolvedValue({ settings: { forceMfa: false, forceMfaLocalOnly: false } }) },
    oidc: {
      getAuthRequest: vi.fn().mockResolvedValue({
        authRequest: {
          id: "request",
          clientId: "mediconnect-web",
          scope: ["openid", "urn:zitadel:iam:org:id:consumer-mediconnect"],
        },
      }),
      createCallback: vi.fn().mockResolvedValue({ callbackUrl: "https://product.example/callback?code=fixture" }),
    },
    organizations: {
      listOrganizationMetadata: vi.fn().mockResolvedValue({
        metadata: [
          metadata("consumer_binding", "identity-operator/mediconnect"),
          metadata("consumer_email_otp", '{"version":1,"enabled":true,"smsEnabled":false}'),
        ],
      }),
    },
    users: {
      listUsers: vi.fn().mockResolvedValue({ result: [user] }),
      getUserByID: vi.fn().mockResolvedValue({ user }),
      listAuthenticationMethodTypes: vi.fn().mockResolvedValue({ authMethodTypes: [AuthenticationMethodType.OTP_EMAIL] }),
      addOTPEmail: vi.fn(),
      addHumanUser: vi.fn(),
      sendEmailCode: vi.fn(),
      verifyEmail: vi.fn(),
    },
    sessions: {
      createSession: vi.fn().mockResolvedValue({ sessionId: "session", sessionToken: "fixture-token" }),
      setSession: vi.fn().mockResolvedValue({ sessionToken: "checked-token" }),
      getSession: vi.fn().mockResolvedValue({
        session: {
          id: "session",
          expirationDate: { seconds: BigInt(9999999999) },
          factors: {
            user: { id: "patient-login", organizationId: "consumer-mediconnect" },
            otpEmail: { verifiedAt: { seconds: BigInt(1) } },
          },
        },
      }),
    },
  };
}
describe("native Zitadel consumer email login", () => {
  it("sends through Zitadel and completes OIDC only after native code verification", async () => {
    const api = backend();
    const login = new ConsumerEmailLogin("happy", first, api as never);
    const result = await login.start({
      requestId: "request",
      email: "test@example.test",
      givenName: "Test",
      familyName: "User",
    });
    expect(result.phase).toBe("otp");
    expect(api.sessions.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ challenges: { otpEmail: { deliveryType: { case: "sendCode", value: {} } } } }),
      { timeoutMs: 5000 },
    );
    const completed = await login.verify(result.handle, "123456");
    expect(completed).toEqual({ redirect: "https://product.example/callback?code=fixture" });
    expect(api.sessions.setSession).toHaveBeenCalledWith(
      expect.objectContaining({ checks: { otpEmail: { code: "123456" } } }),
      { timeoutMs: 5000 },
    );
    expect(api.oidc.createCallback).toHaveBeenCalledTimes(1);
    await expect(login.verify(result.handle, "123456")).rejects.toThrow();
    expect(api.oidc.createCallback).toHaveBeenCalledTimes(1);
  });
  it("rejects a mailbox changed after the challenge was issued", async () => {
    const api = backend();
    const login = new ConsumerEmailLogin("changed-mailbox", first, api as never);
    const flow = await login.start({
      requestId: "request",
      email: "test@example.test",
      givenName: "Test",
      familyName: "User",
    });
    const { user } = await api.users.getUserByID();
    api.users.getUserByID.mockResolvedValue({
      user: {
        ...user,
        type: { case: "human", value: { email: { email: "changed@example.test", isVerified: true } } },
      },
    });
    await expect(login.verify(flow.handle, "123456")).rejects.toThrow();
    expect(api.sessions.setSession).not.toHaveBeenCalled();
    expect(api.oidc.createCallback).not.toHaveBeenCalled();
  });
  it("bounds native authentication RPCs with a deadline", async () => {
    const api = backend();
    const login = new ConsumerEmailLogin("rpc-deadline", first, api as never);
    const flow = await login.start({
      requestId: "request",
      email: "test@example.test",
      givenName: "Test",
      familyName: "User",
    });
    await login.verify(flow.handle, "123456");
    for (const service of Object.values(api)) {
      for (const method of Object.values(service)) {
        for (const call of method.mock.calls) expect((call as unknown[])[1]).toEqual({ timeoutMs: 5000 });
      }
    }
  });
  it.each(["expired", "foreign-user", "foreign-organization", "missing-factor"])(
    "rejects a %s native session",
    async (failure) => {
      const api = backend();
      const login = new ConsumerEmailLogin(`invalid-session-${failure}`, first, api as never);
      const flow = await login.start({
        requestId: "request",
        email: "test@example.test",
        givenName: "Test",
        familyName: "User",
      });
      const { session } = await api.sessions.getSession();
      if (failure === "expired") session.expirationDate.seconds = BigInt(1);
      if (failure === "foreign-user") session.factors.user.id = "other-user";
      if (failure === "foreign-organization") session.factors.user.organizationId = "consumer-other";
      if (failure === "missing-factor") Object.assign(session.factors, { otpEmail: undefined });
      api.sessions.getSession.mockResolvedValue({ session });
      await expect(login.verify(flow.handle, "123456")).rejects.toThrow();
      expect(api.oidc.createCallback).not.toHaveBeenCalled();
    },
  );
  it("does not downgrade an account with existing TOTP", async () => {
    const api = backend();
    api.users.listAuthenticationMethodTypes.mockResolvedValue({ authMethodTypes: [AuthenticationMethodType.TOTP] });
    const login = new ConsumerEmailLogin("mfa", first, api as never);
    await expect(
      login.start({ requestId: "request", email: "test@example.test", givenName: "Test", familyName: "User" }),
    ).rejects.toThrow();
    expect(api.sessions.createSession).not.toHaveBeenCalled();
    expect(api.users.addOTPEmail).not.toHaveBeenCalled();
  });
  it("rejects revocation between challenge and verification", async () => {
    const api = backend();
    const login = new ConsumerEmailLogin("revocation", first, api as never);
    const result = await login.start({
      requestId: "request",
      email: "test@example.test",
      givenName: "Test",
      familyName: "User",
    });
    api.organizations.listOrganizationMetadata.mockResolvedValue({ metadata: [] });
    await expect(login.verify(result.handle, "123456")).rejects.toThrow();
    expect(api.sessions.setSession).not.toHaveBeenCalled();
    expect(api.oidc.createCallback).not.toHaveBeenCalled();
  });
  it("rejects a foreign user even if the backend returns it from a scoped query", async () => {
    const api = backend();
    api.users.listUsers.mockResolvedValue({
      result: [
        {
          userId: "foreign",
          state: UserState.ACTIVE,
          details: { resourceOwner: "staff" },
          type: { case: "human", value: { email: { email: "test@example.test", isVerified: true } } },
        },
      ],
    });
    const login = new ConsumerEmailLogin("foreign", first, api as never);
    await expect(
      login.start({ requestId: "request", email: "test@example.test", givenName: "Test", familyName: "User" }),
    ).rejects.toThrow();
    expect(api.sessions.createSession).not.toHaveBeenCalled();
  });
});

describe("consumer email onboarding and policy failures", () => {
  it("verifies a new mailbox before enrolling and issuing a sign-in challenge", async () => {
    const api = backend();
    api.users.listUsers.mockResolvedValue({ result: [] });
    api.users.addHumanUser.mockResolvedValue({ userId: "patient-login" });
    const login = new ConsumerEmailLogin("registration", first, api as never);
    const registration = await login.start({
      requestId: "request",
      email: "test@example.test",
      givenName: "Test",
      familyName: "User",
    });
    expect(registration.phase).toBe("verify-email");
    expect(api.users.addHumanUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: { email: "test@example.test", verification: { case: "sendCode", value: {} } },
        organization: { org: { case: "orgId", value: "consumer-mediconnect" } },
      }),
      { timeoutMs: 5000 },
    );
    expect(api.sessions.createSession).not.toHaveBeenCalled();
    const challenge = await login.verify(registration.handle, "Ab3dE9");
    expect(api.users.verifyEmail).toHaveBeenCalledWith(
      { userId: "patient-login", verificationCode: "Ab3dE9" },
      { timeoutMs: 5000 },
    );
    expect(challenge).toEqual(expect.objectContaining({ phase: "otp" }));
    expect(api.oidc.createCallback).not.toHaveBeenCalled();
  });
  it("respects forced MFA even when email policy remains opted in", async () => {
    const api = backend();
    api.settings.getLoginSettings.mockResolvedValue({ settings: { forceMfa: true, forceMfaLocalOnly: false } });
    const login = new ConsumerEmailLogin("forced-mfa", first, api as never);
    await expect(
      login.start({ requestId: "request", email: "test@example.test", givenName: "Test", familyName: "User" }),
    ).rejects.toThrow();
    expect(api.users.listUsers).not.toHaveBeenCalled();
  });
  it.each([
    [],
    ["openid"],
    ["urn:zitadel:iam:org:id:staff"],
    ["urn:zitadel:iam:org:id:consumer-mediconnect", "urn:zitadel:iam:org:id:consumer-other"],
  ])("rejects absent, foreign and ambiguous OIDC scope", async (...scope) => {
    const api = backend();
    api.oidc.getAuthRequest.mockResolvedValue({ authRequest: { id: "request", clientId: "client", scope } });
    const login = new ConsumerEmailLogin("bad-scope", first, api as never);
    await expect(
      login.start({ requestId: "request", email: "test@example.test", givenName: "Test", familyName: "User" }),
    ).rejects.toThrow();
    expect(api.users.listUsers).not.toHaveBeenCalled();
  });
  it("never creates a callback when Zitadel rejects a code", async () => {
    const api = backend();
    const login = new ConsumerEmailLogin("wrong-code", first, api as never);
    const flow = await login.start({
      requestId: "request",
      email: "test@example.test",
      givenName: "Test",
      familyName: "User",
    });
    api.sessions.setSession.mockRejectedValue(new Error("invalid code"));
    await expect(login.verify(flow.handle, "111111")).rejects.toThrow();
    expect(api.oidc.createCallback).not.toHaveBeenCalled();
  });
});
