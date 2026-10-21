"use client";

import { handleServerActionResponse } from "@/lib/client-utils";
import { resetPassword, sendPassword } from "@/lib/server/password";
import { create } from "@zitadel/client";
import { ChecksSchema } from "@zitadel/proto/zitadel/session/v2/session_service_pb";
import { LoginSettings } from "@zitadel/proto/zitadel/settings/v2/login_settings_pb";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AutoSubmitForm } from "./auto-submit-form";
import { Button } from "./button";
import { TextInput } from "./input";
import { useProductLogin } from "./product-login-provider";

export type ProductCredentialsProps = {
  loginName?: string;
  requestId?: string;
  organization?: string;
  defaultOrganization?: string;
  loginSettings?: LoginSettings;
  allowRegister: boolean;
};

export function ProductCredentialsForm({
  loginName: initialName,
  requestId,
  organization,
  defaultOrganization,
  loginSettings,
  allowRegister,
}: ProductCredentialsProps) {
  const router = useRouter();
  const product = useProductLogin();
  const [loginName, setLoginName] = useState(initialName ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [samlData, setSamlData] = useState<{ url: string; fields: Record<string, string> }>();

  function query() {
    const params = new URLSearchParams();
    if (requestId) params.set("requestId", requestId);
    if (organization) params.set("organization", organization);
    return params;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !loginName.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      const response = await sendPassword({
        loginName: loginName.trim(),
        checks: create(ChecksSchema, { password: { password } }),
        requestId,
        organization,
        defaultOrganization,
      });
      if (!handleServerActionResponse(response, router, setSamlData, setError))
        setError("Sign-in could not finish. Please try again.");
    } catch {
      setError("Sign-in could not finish. Please try again.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  async function recover() {
    if (busy || !loginName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await resetPassword({ loginName: loginName.trim(), requestId, organization, defaultOrganization });
      if (response && "error" in response) {
        setError(String(response.error));
      } else {
        const params = query();
        params.set("loginName", loginName.trim());
        router.push(`/password/set?${params}`);
      }
    } catch {
      setError("Password recovery could not start. Please try again.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <>
      {samlData && <AutoSubmitForm url={samlData.url} fields={samlData.fields} />}
      <form onSubmit={submit} className="w-full space-y-4" aria-busy={busy}>
        <TextInput
          label="Email or username"
          aria-label="Email or username"
          name="loginName"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={254}
          required
          disabled={busy}
          value={loginName}
          onChange={(event) => setLoginName(event.target.value)}
        />
        <TextInput
          label="Password"
          aria-label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={1024}
          required
          disabled={busy}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {!loginSettings?.hidePasswordReset && (
          <button
            type="button"
            className="min-h-11 text-sm underline"
            disabled={busy || !loginName.trim()}
            onClick={recover}
          >
            Forgot password?
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !loginName.trim() || !password} className="min-h-12 w-full justify-center">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        {allowRegister && (
          <button
            type="button"
            className="min-h-11 w-full text-sm underline"
            disabled={busy}
            onClick={() => router.push(`/register?${query()}`)}
          >
            Create {product ? `a ${product.name}` : "an"} account
          </button>
        )}
        <p className="text-center text-xs text-gray-600 dark:text-gray-300">Secure sign-in by Tesserix</p>
      </form>
    </>
  );
}
