import { afterEach, describe, expect, test } from "vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { SignInWithGeneric } from "./sign-in-with-generic";

afterEach(cleanup);

describe("<SignInWithGeneric />", () => {
  test("shows the brand logo for a generic provider the tenant named after one", () => {
    const { container } = render(<SignInWithGeneric name="Google" />);

    expect(container.querySelector("[data-provider-mark]")).toHaveAttribute("data-provider-mark", "google");
    expect(screen.getByText("Google")).toBeInTheDocument();
  });

  test("falls back to a generic mark rather than a bare label", () => {
    const { container } = render(<SignInWithGeneric name="Northwind Staff Directory" />);

    expect(container.querySelector("[data-provider-mark]")).toHaveAttribute("data-provider-mark", "sso");
  });
});
