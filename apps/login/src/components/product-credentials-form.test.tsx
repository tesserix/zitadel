import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductCredentialsForm } from "./product-credentials-form";

const { sendPassword, resetPassword, push } = vi.hoisted(() => ({
  sendPassword: vi.fn(),
  resetPassword: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/lib/server/password", () => ({ sendPassword, resetPassword }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  vi.clearAllMocks();
  sendPassword.mockResolvedValue({ redirect: "/mfa?requestId=oidc_request" });
});
afterEach(cleanup);

describe("product credentials", () => {
  it("lets travellers see the page before opening the keyboard or autofill sheet", () => {
    render(<ProductCredentialsForm requestId="oidc_request" allowRegister />);
    expect(screen.getByLabelText("Email or username")).not.toHaveFocus();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  it("submits both credentials to the existing password flow and follows its factor challenge", async () => {
    render(
      <ProductCredentialsForm requestId="oidc_request" organization="org" defaultOrganization="default" allowRegister />,
    );
    fireEvent.change(screen.getByLabelText("Email or username"), { target: { value: " traveller@example.test " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/mfa?requestId=oidc_request"));
    expect(sendPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        loginName: "traveller@example.test",
        checks: expect.objectContaining({ password: expect.objectContaining({ password: "test-password" }) }),
        requestId: "oidc_request",
        organization: "org",
        defaultOrganization: "default",
      }),
    );
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("clears a rejected password and keeps the traveller on the sign-in page", async () => {
    sendPassword.mockResolvedValue({ error: "Could not verify your sign-in." });
    render(<ProductCredentialsForm requestId="oidc_request" allowRegister={false} />);
    fireEvent.change(screen.getByLabelText("Email or username"), { target: { value: "traveller@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not verify your sign-in.");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Create .*account/ })).toBeNull();
  });

  it("preserves the authorization request during password recovery", async () => {
    resetPassword.mockResolvedValue({});
    render(<ProductCredentialsForm requestId="oidc_request" organization="org" allowRegister={false} />);
    fireEvent.change(screen.getByLabelText("Email or username"), { target: { value: "traveller@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/password/set?requestId=oidc_request&organization=org&loginName=traveller%40example.test",
      ),
    );
    expect(resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({ loginName: "traveller@example.test", requestId: "oidc_request", organization: "org" }),
    );
  });
});
