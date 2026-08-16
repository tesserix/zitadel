import { cleanup, render } from "@testing-library/react";
import { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DynamicTheme } from "./dynamic-theme";

const branding = {
  lightTheme: { primaryColor: "#5b5fd6" },
  darkTheme: { primaryColor: "#8e91f4" },
} as BrandingSettings;

describe("DynamicTheme aurora branding", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_THEME_LAYOUT: "side-by-side" };
    // jsdom has no matchMedia; useResponsiveLayout needs it to pick a layout.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    process.env = originalEnv;
    // Vitest runs without globals, so testing-library's auto-cleanup never fires.
    cleanup();
  });

  it("renders the aurora behind the brand panel", () => {
    const { container } = render(
      <DynamicTheme branding={branding}>
        <h1>Welcome back</h1>
        <form />
      </DynamicTheme>,
    );

    expect(container.querySelector("[data-aurora-root]")).toBeTruthy();
    expect(container.querySelectorAll("[data-aurora-wash]")).toHaveLength(3);
  });

  it("shows the tenant's tagline on the brand panel", () => {
    const { getByText } = render(
      <DynamicTheme branding={branding} tenant={{ tagline: "Identity for every team", auroraIntensity: 1 }}>
        <h1>Welcome back</h1>
        <form />
      </DynamicTheme>,
    );

    expect(getByText("Identity for every team")).toBeTruthy();
  });

  it("omits the tagline element entirely when the tenant sets none", () => {
    const { container } = render(
      <DynamicTheme branding={branding} tenant={{ auroraIntensity: 1 }}>
        <h1>Welcome back</h1>
        <form />
      </DynamicTheme>,
    );

    expect(container.querySelector("[data-tenant-tagline]")).toBeNull();
  });

  it("applies the tenant's aurora intensity", () => {
    const { container } = render(
      <DynamicTheme branding={branding} tenant={{ auroraIntensity: 0 }}>
        <h1>Welcome back</h1>
        <form />
      </DynamicTheme>,
    );

    expect(container.querySelectorAll("[data-aurora-root] [data-aurora-wash]")).toHaveLength(0);
  });

  it("renders the design system panel in the top-to-bottom layout", () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_THEME_LAYOUT: "top-to-bottom" };

    const { container, getByTestId } = render(
      <DynamicTheme branding={branding}>
        <h1>Welcome back</h1>
        <form data-testid="signin" />
      </DynamicTheme>,
    );

    const panel = container.querySelector<HTMLElement>("[data-login-card]");
    expect(panel!.querySelector("style")!.textContent).toContain("--aurora-accent");
    expect(panel!.querySelectorAll("[data-aurora-wash]")).toHaveLength(3);
    expect(getByTestId("signin")).toBeTruthy();
  });

  it("hands the dark surface to the theme class instead of resolving it in JS", () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_THEME_LAYOUT: "top-to-bottom" };

    const { container } = render(
      <DynamicTheme branding={branding}>
        <h1>Welcome back</h1>
        <form />
      </DynamicTheme>,
    );

    const css = container.querySelector("[data-login-card] style")!.textContent ?? "";
    expect(css).toContain("--aurora-canvas:#F6F6FC");
    expect(css).toContain("--aurora-canvas:#0F0E2A");
  });

  it("lets the panel fill the viewport rather than sit in a card", () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_THEME_LAYOUT: "top-to-bottom" };

    const { container } = render(
      <DynamicTheme branding={branding}>
        <h1>Welcome back</h1>
        <form />
      </DynamicTheme>,
    );

    const panel = container.querySelector<HTMLElement>("[data-login-card]")!;
    expect(panel.className).toContain("min-h-dvh");
    expect(panel.className).not.toContain("rounded");
  });

  it("leaves the page's own heading as the only one in the panel", () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_THEME_LAYOUT: "top-to-bottom" };

    const { container } = render(
      <DynamicTheme branding={branding}>
        <h1>Welcome back</h1>
        <form />
      </DynamicTheme>,
    );

    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("drops the panel washes when the tenant turns the aurora off", () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_THEME_LAYOUT: "top-to-bottom" };

    const { container } = render(
      <DynamicTheme branding={branding} tenant={{ auroraIntensity: 0 }}>
        <h1>Welcome back</h1>
        <form />
      </DynamicTheme>,
    );

    expect(container.querySelectorAll("[data-aurora-wash]")).toHaveLength(0);
  });

  // The page supplies its own heading and description, so the brand-panel
  // tagline would push a second subtitle above the title.
  it("keeps the page's own copy directly above the form", () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_THEME_LAYOUT: "top-to-bottom" };

    const { container } = render(
      <DynamicTheme branding={branding} tenant={{ tagline: "Identity for every team", auroraIntensity: 1 }}>
        <div>
          <h1>Welcome back</h1>
          <p>Enter your login data.</p>
        </div>
        <form data-testid="signin" />
      </DynamicTheme>,
    );

    expect(container.querySelector("[data-tenant-tagline]")).toBeNull();
    const order = Array.from(container.querySelectorAll("h1, p, form")).map((el) => el.tagName);
    expect(order).toEqual(["H1", "P", "FORM"]);
  });

  // The layout is picked after hydration, so the server always renders the
  // side-by-side branch — it has to survive a phone viewport on its own.
  it("stacks the brand panel above the form until the md breakpoint", () => {
    const { container } = render(
      <DynamicTheme branding={branding}>
        <h1>Welcome back</h1>
        <form />
      </DynamicTheme>,
    );

    const row = container.querySelector("[data-login-card] > div");
    expect(row!.className).toContain("flex-col");
    expect(row!.className).toContain("md:flex-row");

    for (const panel of Array.from(row!.children)) {
      expect(panel.className).toContain("w-full");
      expect(panel.className).toContain("md:w-1/2");
    }
  });

  it("still renders the form when no tenant metadata is supplied at all", () => {
    const { getByTestId } = render(
      <DynamicTheme branding={branding}>
        <h1>Welcome back</h1>
        <form data-testid="signin" />
      </DynamicTheme>,
    );

    expect(getByTestId("signin")).toBeTruthy();
  });
});
