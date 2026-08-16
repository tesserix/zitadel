import { afterEach, describe, expect, test, vi } from "vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

vi.mock("@/lib/server/idp", () => ({ redirectToIdp: vi.fn() }));

import { SignInWithIdp } from "./sign-in-with-idp";

afterEach(cleanup);

const messages = { idp: { orSignInWith: "or sign in with" } };

function renderIdps(identityProviders: Parameters<typeof SignInWithIdp>[0]["identityProviders"]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SignInWithIdp identityProviders={identityProviders} />
    </NextIntlClientProvider>,
  );
}

describe("<SignInWithIdp />", () => {
  test("hides the label when the organization has no identity provider enabled", () => {
    renderIdps([]);

    expect(screen.queryByText(/or sign in with/i)).not.toBeInTheDocument();
  });
});
