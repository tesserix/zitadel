import { productForClient } from "@/lib/product-login";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import ja from "../../locales/ja.json";
import { ProductLoginProvider } from "./product-login-provider";
import { ProductRegistrationDescription } from "./product-registration-description";

afterEach(cleanup);

describe("product account registration copy", () => {
  it.each([
    ["399002497852638210", "Planning Poker"],
    ["392328865646707494", "Roamie"],
  ])("names the verified product %s", (clientId, name) => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ProductLoginProvider product={productForClient(clientId)}>
          <ProductRegistrationDescription />
        </ProductLoginProvider>
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(`Create your ${name} account.`)).toBeVisible();
  });

  it("uses the selected locale for product registration", () => {
    render(
      <NextIntlClientProvider locale="ja" messages={ja}>
        <ProductLoginProvider product={productForClient("399002497852638210")}>
          <ProductRegistrationDescription />
        </ProductLoginProvider>
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Planning Pokerアカウントを作成します。")).toBeVisible();
  });

  it("preserves the default registration copy for an unknown client", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ProductLoginProvider product={undefined}>
          <ProductRegistrationDescription />
        </ProductLoginProvider>
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Create your Zitadel account.")).toBeVisible();
  });
});
