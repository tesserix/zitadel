import { render } from "@testing-library/react";
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
  });

  it("renders the aurora behind the brand panel", () => {
    const { container } = render(
      <DynamicTheme branding={branding}>
        <h1>Welcome back</h1>
        <form />
      </DynamicTheme>,
    );

    expect(container.querySelector("[data-aurora-root]")).toBeTruthy();
    expect(container.querySelectorAll("[data-aurora-blob]")).toHaveLength(6);
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

    const blob = container.querySelector<HTMLElement>('[data-aurora="light"] [data-aurora-blob]');
    expect(blob!.style.backgroundImage).toContain("rgba(91, 95, 214, 0)");
  });

  it("keeps the aurora in the top-to-bottom layout", () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_THEME_LAYOUT: "top-to-bottom" };

    const { container } = render(
      <DynamicTheme branding={branding}>
        <h1>Welcome back</h1>
        <form />
      </DynamicTheme>,
    );

    expect(container.querySelector("[data-aurora-root]")).toBeTruthy();
  });

  // The card is opaque, so an aurora rendered as its sibling is invisible on
  // the layout phones actually get.
  it("keeps the aurora inside the card in the top-to-bottom layout", () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_THEME_LAYOUT: "top-to-bottom" };

    const { container } = render(
      <DynamicTheme branding={branding}>
        <h1>Welcome back</h1>
        <form />
      </DynamicTheme>,
    );

    expect(container.querySelector("[data-login-card] [data-aurora-root]")).toBeTruthy();
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
