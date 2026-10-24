"use server";

import { OIDCService } from "@zitadel/proto/zitadel/oidc/v2/oidc_service_pb";
import { OrganizationService } from "@zitadel/proto/zitadel/org/v2/org_service_pb";
import { SessionService } from "@zitadel/proto/zitadel/session/v2/session_service_pb";
import { SettingsService } from "@zitadel/proto/zitadel/settings/v2/settings_service_pb";
import { UserService } from "@zitadel/proto/zitadel/user/v2/user_service_pb";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ConsumerEmailLogin } from "../consumer-email/login";
import { ConsumerEmailStore } from "../consumer-email/store";
import { createServiceForHost } from "../service";
import { getServiceConfig } from "../service-url";

const cookieName = "consumer_email_flow";
let store: ConsumerEmailStore | undefined;
export type ConsumerEmailResult = { codeRequested: boolean; message: string };
const failure: ConsumerEmailResult = {
  codeRequested: false,
  message: "Unable to complete email sign-in. Wait a minute and restart, or use your existing sign-in method.",
};

async function login() {
  if (!process.env.CONSUMER_EMAIL_VALKEY_URL) throw new Error("Email sign-in is not configured");
  store ??= new ConsumerEmailStore(process.env.CONSUMER_EMAIL_VALKEY_URL);
  const { serviceConfig } = getServiceConfig(await headers());
  const [oidc, organizations, sessions, settings, users] = await Promise.all([
    createServiceForHost(OIDCService, serviceConfig),
    createServiceForHost(OrganizationService, serviceConfig),
    createServiceForHost(SessionService, serviceConfig),
    createServiceForHost(SettingsService, serviceConfig),
    createServiceForHost(UserService, serviceConfig),
  ]);
  return new ConsumerEmailLogin(serviceConfig.instanceHost ?? serviceConfig.baseUrl, store, {
    oidc,
    organizations,
    sessions,
    settings,
    users,
  });
}

async function saveHandle(handle: string) {
  (await cookies()).set(cookieName, handle, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: process.env.NEXT_PUBLIC_BASE_PATH || "/",
    maxAge: 300,
  });
}

export async function consumerEmailAction(_previous: ConsumerEmailResult, form: FormData): Promise<ConsumerEmailResult> {
  let target: string | undefined;
  try {
    const engine = await login();
    const field = (name: string, max: number) => {
      const value = form.get(name);
      if (typeof value !== "string" || value.length > max) throw new Error("Invalid input");
      return value;
    };
    if (form.get("operation") === "start") {
      const result = await engine.start({
        requestId: field("requestId", 200),
        email: field("email", 200),
        givenName: field("givenName", 100),
        familyName: field("familyName", 100),
      });
      await saveHandle(result.handle);
      return {
        codeRequested: true,
        message:
          "Check your email. Enter its code, or follow the verification link and restart sign-in. This attempt expires in five minutes.",
      };
    }
    if (form.get("operation") !== "verify") return failure;
    const cookie = (await cookies()).get(cookieName);
    if (!cookie) return failure;
    const result = await engine.verify(cookie.value, field("code", 8));
    if ("redirect" in result) {
      (await cookies()).set(cookieName, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: process.env.NEXT_PUBLIC_BASE_PATH || "/",
        maxAge: 0,
      });
      target = result.redirect;
    } else {
      await saveHandle(result.handle);
      return { codeRequested: true, message: "Your email is verified. Enter the new sign-in code we sent you." };
    }
  } catch {
    return failure;
  }
  if (target) redirect(target);
  return failure;
}
