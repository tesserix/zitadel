import { afterEach, describe, expect, test } from "vitest";

import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { SignInWithApple } from "./sign-in-with-apple";
import { SignInWithAzureAd } from "./sign-in-with-azure-ad";
import { SignInWithGeneric } from "./sign-in-with-generic";
import { SignInWithGithub } from "./sign-in-with-github";
import { SignInWithGitlab } from "./sign-in-with-gitlab";
import { SignInWithGoogle } from "./sign-in-with-google";

afterEach(cleanup);

const buttons = [
  ["Apple", SignInWithApple, "apple"],
  ["Azure AD", SignInWithAzureAd, "microsoft"],
  ["GitHub", SignInWithGithub, "github"],
  ["GitLab", SignInWithGitlab, "gitlab"],
  ["Google", SignInWithGoogle, "google"],
  ["Generic", SignInWithGeneric, "sso"],
] as const;

describe("identity provider marks", () => {
  test.each(buttons)("%s renders a sized brand mark", (_label, Button, mark) => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{ idp: {} }}>
        <Button />
      </NextIntlClientProvider>,
    );

    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("data-provider-mark", mark);
    expect(svg).toHaveAttribute("width");
    expect(svg).toHaveAttribute("height");
  });
});
