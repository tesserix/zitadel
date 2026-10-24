"use client";

import { consumerEmailAction } from "@/lib/server/consumer-email";
import { useActionState } from "react";
import { Button } from "./button";

export function ConsumerEmailForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(consumerEmailAction, { codeRequested: false, message: "" });
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="operation" value={state.codeRequested ? "verify" : "start"} />
      {state.codeRequested ? (
        <label className="flex flex-col gap-2">
          Email code
          <input
            name="code"
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            pattern="[a-zA-Z0-9]{6,8}"
            minLength={6}
            maxLength={8}
            required
            className="rounded border p-3"
          />
        </label>
      ) : (
        <>
          <label className="flex flex-col gap-2">
            Email
            <input name="email" type="email" autoComplete="email" maxLength={200} required className="rounded border p-3" />
          </label>
          <label className="flex flex-col gap-2">
            Given name
            <input name="givenName" autoComplete="given-name" maxLength={100} required className="rounded border p-3" />
          </label>
          <label className="flex flex-col gap-2">
            Family name
            <input name="familyName" autoComplete="family-name" maxLength={100} required className="rounded border p-3" />
          </label>
        </>
      )}
      {state.message && (
        <p role="status" aria-live="polite">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Please wait…" : state.codeRequested ? "Verify code" : "Send email code"}
      </Button>
      {state.codeRequested && (
        <p className="text-sm">
          If the code expires or is incorrect, restart sign-in. You can request another code after one minute.{" "}
          <a className="underline" href={`?requestId=${encodeURIComponent(requestId)}`}>
            Restart sign-in
          </a>
        </p>
      )}
    </form>
  );
}
