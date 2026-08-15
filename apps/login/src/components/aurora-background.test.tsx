import { render } from "@testing-library/react";
import { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";
import { describe, expect, it } from "vitest";
import { AuroraBackground } from "./aurora-background";

const branding = {
  lightTheme: { primaryColor: "#5b5fd6" },
  darkTheme: { primaryColor: "#8e91f4" },
} as BrandingSettings;

function washes(container: HTMLElement, theme: "light" | "dark") {
  return Array.from(container.querySelectorAll<HTMLElement>(`[data-aurora="${theme}"] [data-aurora-wash]`));
}

describe("AuroraBackground", () => {
  it("renders three washes for each theme so the switch needs no re-render", () => {
    const { container } = render(<AuroraBackground branding={branding} />);

    expect(washes(container, "light")).toHaveLength(3);
    expect(washes(container, "dark")).toHaveLength(3);
  });

  it("paints the light washes from the tenant's light primary colour", () => {
    const { container } = render(<AuroraBackground branding={branding} />);

    // #5b5fd6 -> rgb(91, 95, 214)
    expect(washes(container, "light")[0].style.background).toContain("rgba(91,95,214");
  });

  it("paints the dark washes from the tenant's dark primary colour", () => {
    const { container } = render(<AuroraBackground branding={branding} />);

    // #8e91f4 -> rgb(142, 145, 244)
    expect(washes(container, "dark")[0].style.background).toContain("rgba(142,145,244");
  });

  it("still renders with no branding at all", () => {
    const { container } = render(<AuroraBackground />);

    expect(washes(container, "light")).toHaveLength(3);
    expect(washes(container, "light")[0].style.background).not.toContain("NaN");
  });

  it("drops the washes entirely when the tenant turns the aurora off", () => {
    const { container } = render(<AuroraBackground branding={branding} intensity={0} />);

    expect(washes(container, "light")).toHaveLength(0);
  });

  it("is decorative, so it stays out of the accessibility tree", () => {
    const { container } = render(<AuroraBackground branding={branding} />);

    expect(container.querySelector("[data-aurora-root]")).toHaveAttribute("aria-hidden", "true");
  });
});
