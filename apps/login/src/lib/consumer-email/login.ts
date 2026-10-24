import type { Client } from "@zitadel/client";
import { makeReqCtx } from "@zitadel/client/v2";
import { TextQueryMethod } from "@zitadel/proto/zitadel/object/v2/object_pb";
import { OIDCService } from "@zitadel/proto/zitadel/oidc/v2/oidc_service_pb";
import { OrganizationService } from "@zitadel/proto/zitadel/org/v2/org_service_pb";
import { SessionService } from "@zitadel/proto/zitadel/session/v2/session_service_pb";
import { SettingsService } from "@zitadel/proto/zitadel/settings/v2/settings_service_pb";
import { UserState, type User } from "@zitadel/proto/zitadel/user/v2/user_pb";
import { AuthenticationMethodType, UserService } from "@zitadel/proto/zitadel/user/v2/user_service_pb";
import "server-only";
import { isSafeRedirectUri } from "../client-utils";
import { consumerEmailAllowed } from "../consumer-email-policy";
import { ConsumerEmailStore, type EmailFlow } from "./store";

export type ConsumerEmailAPI = {
  settings: Client<typeof SettingsService>;
  oidc: Client<typeof OIDCService>;
  organizations: Client<typeof OrganizationService>;
  users: Client<typeof UserService>;
  sessions: Client<typeof SessionService>;
};
export type StartEmailLogin = { requestId: string; email: string; givenName: string; familyName: string };

const unavailable = () => new Error("Email sign-in unavailable. Restart sign-in or use an existing sign-in method.");

export class ConsumerEmailLogin {
  constructor(
    private readonly instance: string,
    private readonly store: ConsumerEmailStore,
    private readonly api: ConsumerEmailAPI,
  ) {}

  private async authorize(requestId: string, expectedOrganization?: string) {
    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(requestId)) throw unavailable();
    const { authRequest } = await this.api.oidc.getAuthRequest({ authRequestId: requestId }, { timeoutMs: 5000 });
    const scopes = authRequest?.scope.filter((scope) => scope.startsWith("urn:zitadel:iam:org:id:")) ?? [];
    if (scopes.length !== 1 || !authRequest?.clientId) throw unavailable();
    const organization = scopes[0].slice("urn:zitadel:iam:org:id:".length);
    if (!organization.startsWith("consumer-") || (expectedOrganization && expectedOrganization !== organization))
      throw unavailable();
    const { metadata } = await this.api.organizations.listOrganizationMetadata(
      { organizationId: organization },
      { timeoutMs: 5000 },
    );
    if (!consumerEmailAllowed(organization, metadata)) throw unavailable();
    const { settings } = await this.api.settings.getLoginSettings({ ctx: makeReqCtx(organization) }, { timeoutMs: 5000 });
    if (!settings || settings.forceMfa || settings.forceMfaLocalOnly) throw unavailable();
    return organization;
  }

  private checkUser(
    user: User | undefined,
    organization: string,
    email?: string,
    allowInitial = false,
  ): asserts user is User {
    if (
      !user ||
      (user.state !== UserState.ACTIVE && !(allowInitial && user.state === UserState.INITIAL)) ||
      user.details?.resourceOwner !== organization ||
      user.type.case !== "human" ||
      (email && user.type.value.email?.email.toLowerCase() !== email)
    )
      throw unavailable();
  }

  private async challenge(organization: string, requestId: string, user: User) {
    if (user.type.case !== "human" || !user.type.value.email?.isVerified) throw unavailable();
    const { authMethodTypes } = await this.api.users.listAuthenticationMethodTypes(
      { userId: user.userId },
      { timeoutMs: 5000 },
    );
    if (authMethodTypes.some((method) => method !== AuthenticationMethodType.OTP_EMAIL)) throw unavailable();
    if (!authMethodTypes.includes(AuthenticationMethodType.OTP_EMAIL))
      await this.api.users.addOTPEmail({ userId: user.userId }, { timeoutMs: 5000 });
    const session = await this.api.sessions.createSession(
      {
        checks: { user: { search: { case: "userId", value: user.userId } } },
        challenges: { otpEmail: { deliveryType: { case: "sendCode", value: {} } } },
        lifetime: { seconds: BigInt(300) },
      },
      { timeoutMs: 5000 },
    );
    if (!session.sessionId || !session.sessionToken) throw unavailable();
    const flow: EmailFlow = {
      organization,
      requestId,
      userId: user.userId,
      email: user.type.value.email.email.toLowerCase(),
      phase: "otp",
      sessionId: session.sessionId,
      sessionToken: session.sessionToken,
    };
    return { handle: await this.store.save(this.instance, flow), phase: flow.phase };
  }

  async start(input: StartEmailLogin) {
    const email = input.email.trim().toLowerCase();
    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw unavailable();
    const organization = await this.authorize(input.requestId);
    if (!(await this.store.reserve(this.instance, organization, email))) throw unavailable();
    const { result } = await this.api.users.listUsers(
      {
        query: { limit: 2 },
        queries: [
          { query: { case: "emailQuery", value: { emailAddress: email, method: TextQueryMethod.EQUALS_IGNORE_CASE } } },
          { query: { case: "organizationIdQuery", value: { organizationId: organization } } },
        ],
      },
      { timeoutMs: 5000 },
    );
    if (result.length === 0) {
      if (
        !input.givenName.trim() ||
        !input.familyName.trim() ||
        input.givenName.length > 100 ||
        input.familyName.length > 100
      )
        throw unavailable();
      const created = await this.api.users.addHumanUser(
        {
          username: email,
          organization: { org: { case: "orgId", value: organization } },
          profile: { givenName: input.givenName.trim(), familyName: input.familyName.trim() },
          email: { email, verification: { case: "sendCode", value: {} } },
        },
        { timeoutMs: 5000 },
      );
      if (!created.userId) throw unavailable();
      const flow: EmailFlow = {
        organization,
        requestId: input.requestId,
        userId: created.userId,
        email,
        phase: "verify-email",
      };
      return { handle: await this.store.save(this.instance, flow), phase: flow.phase };
    }
    if (result.length !== 1) throw unavailable();
    const user = result[0];
    this.checkUser(user, organization, email, true);
    if (user.type.case === "human" && !user.type.value.email?.isVerified) {
      await this.api.users.sendEmailCode(
        { userId: user.userId, verification: { case: "sendCode", value: {} } },
        { timeoutMs: 5000 },
      );
      const flow: EmailFlow = {
        organization,
        requestId: input.requestId,
        userId: user.userId,
        email,
        phase: "verify-email",
      };
      return { handle: await this.store.save(this.instance, flow), phase: flow.phase };
    }
    this.checkUser(user, organization, email);
    return this.challenge(organization, input.requestId, user);
  }

  async verify(handle: string, code: string): Promise<{ redirect: string } | { handle: string; phase: EmailFlow["phase"] }> {
    if (!/^[a-zA-Z0-9]{6,8}$/.test(code)) throw unavailable();
    const flow = await this.store.take(this.instance, handle);
    if (!flow || (flow.phase === "otp" && !/^[0-9]{6,8}$/.test(code))) throw unavailable();
    await this.authorize(flow.requestId, flow.organization);
    const { user } = await this.api.users.getUserByID({ userId: flow.userId }, { timeoutMs: 5000 });
    this.checkUser(user, flow.organization, flow.email, flow.phase === "verify-email");
    if (flow.phase === "verify-email") {
      await this.api.users.verifyEmail({ userId: flow.userId, verificationCode: code }, { timeoutMs: 5000 });
      const verified = await this.api.users.getUserByID({ userId: flow.userId }, { timeoutMs: 5000 });
      this.checkUser(verified.user, flow.organization, flow.email);
      return this.challenge(flow.organization, flow.requestId, verified.user);
    }
    const { authMethodTypes } = await this.api.users.listAuthenticationMethodTypes(
      { userId: flow.userId },
      { timeoutMs: 5000 },
    );
    if (authMethodTypes.some((method) => method !== AuthenticationMethodType.OTP_EMAIL)) throw unavailable();
    if (
      flow.phase !== "otp" ||
      !flow.sessionId ||
      !flow.sessionToken ||
      user.type.case !== "human" ||
      !user.type.value.email?.isVerified
    )
      throw unavailable();
    const checked = await this.api.sessions.setSession(
      {
        sessionId: flow.sessionId,
        sessionToken: flow.sessionToken,
        checks: { otpEmail: { code } },
        lifetime: { seconds: BigInt(300) },
      },
      { timeoutMs: 5000 },
    );
    if (!checked.sessionToken) throw unavailable();
    const { session } = await this.api.sessions.getSession(
      {
        sessionId: flow.sessionId,
        sessionToken: checked.sessionToken,
      },
      { timeoutMs: 5000 },
    );
    if (
      !session?.factors?.otpEmail?.verifiedAt ||
      session.factors.user?.id !== flow.userId ||
      session.factors.user.organizationId !== flow.organization ||
      !session.expirationDate ||
      Number(session.expirationDate.seconds) * 1000 <= Date.now()
    )
      throw unavailable();
    // Reauthorize after the code check: an operator revocation must also stop in-flight callbacks.
    await this.authorize(flow.requestId, flow.organization);
    const callback = await this.api.oidc.createCallback(
      {
        authRequestId: flow.requestId,
        callbackKind: { case: "session", value: { sessionId: flow.sessionId, sessionToken: checked.sessionToken } },
      },
      { timeoutMs: 5000 },
    );
    if (!callback.callbackUrl || !isSafeRedirectUri(callback.callbackUrl)) throw unavailable();
    return { redirect: callback.callbackUrl };
  }
}
