import { productForClient } from "@/lib/product-login";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProductLoginProvider } from "./product-login-provider";
import { UsernameForm } from "./username-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/server/loginname", () => ({
  sendLoginname: vi.fn(),
}));

describe("UsernameForm", () => {
  afterEach(cleanup);

  test("should autofocus the loginName input on mount", () => {
    const { getByTestId } = render(
      <UsernameForm loginName="" requestId={undefined} loginSettings={undefined} submit={false} allowRegister={false} />,
    );
    expect(getByTestId("username-text-input")).toHaveFocus();
  });

  test("keeps the existing passkey flow available from the product form", () => {
    const { getByLabelText, getByRole, queryByLabelText } = render(
      <ProductLoginProvider product={productForClient("392328865646707494")}>
        <UsernameForm loginName="" requestId="oidc_request" loginSettings={undefined} submit={false} allowRegister={false} />
      </ProductLoginProvider>,
    );
    expect(getByLabelText("Password")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Use a passkey or another method" }));
    expect(queryByLabelText("Password")).toBeNull();
    expect(getByRole("textbox")).toHaveFocus();
  });
});
