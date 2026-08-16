import { render } from "@testing-library/react";
import { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";
import { describe, expect, it } from "vitest";
import { AuroraBackground } from "./aurora-background";

const branding = {
  lightTheme: { primaryColor: "#5b5fd6" },
  darkTheme: { primaryColor: "#8e91f4" },
} as BrandingSettings;

function washes(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-aurora-root] [data-aurora-wash]"));
}

function surfaceCss(container: HTMLElement) {
  return container.querySelector("[data-aurora-root] style")?.textContent ?? "";
}

describe("AuroraBackground", () => {
  it("renders one set of washes driven by custom properties", () => {
    const { container } = render(<AuroraBackground branding={branding} />);

    expect(washes(container)).toHaveLength(3);
    expect(washes(container)[0].style.background).toContain("var(--aurora-wash-0)");
  });

  it("publishes both surfaces so the theme class picks one without a re-render", () => {
    const { container } = render(<AuroraBackground branding={branding} />);

    // #5b5fd6 -> rgb(91, 95, 214), lifted per surface.
    expect(surfaceCss(container)).toContain("rgba(91,95,214");
    expect(surfaceCss(container)).toMatch(/\.dark \[data-aurora-scope=/);
  });

  it("still renders with no branding at all", () => {
    const { container } = render(<AuroraBackground />);

    expect(washes(container)).toHaveLength(3);
    expect(surfaceCss(container)).not.toContain("NaN");
  });

  it("drops the washes entirely when the tenant turns the aurora off", () => {
    const { container } = render(<AuroraBackground branding={branding} intensity={0} />);

    expect(washes(container)).toHaveLength(0);
  });

  it("is decorative, so it stays out of the accessibility tree", () => {
    const { container } = render(<AuroraBackground branding={branding} />);

    expect(container.querySelector("[data-aurora-root]")).toHaveAttribute("aria-hidden", "true");
  });
});
