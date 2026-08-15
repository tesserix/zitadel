import { render } from "@testing-library/react";
import { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";
import { describe, expect, it } from "vitest";
import { AuroraBackground } from "./aurora-background";

const branding = {
  lightTheme: { primaryColor: "#5b5fd6" },
  darkTheme: { primaryColor: "#8e91f4" },
} as BrandingSettings;

function blobs(container: HTMLElement, theme: "light" | "dark") {
  return Array.from(container.querySelectorAll<HTMLElement>(`[data-aurora="${theme}"] [data-aurora-blob]`));
}

describe("AuroraBackground", () => {
  it("renders three blobs for each theme so the switch needs no re-render", () => {
    const { container } = render(<AuroraBackground branding={branding} />);

    expect(blobs(container, "light")).toHaveLength(3);
    expect(blobs(container, "dark")).toHaveLength(3);
  });

  it("paints the light blobs from the tenant's light primary colour", () => {
    const { container } = render(<AuroraBackground branding={branding} />);

    // #5b5fd6 -> rgb(91, 95, 214)
    expect(blobs(container, "light")[0].style.backgroundImage).toContain("rgba(91, 95, 214");
  });

  it("paints the dark blobs from the tenant's dark primary colour", () => {
    const { container } = render(<AuroraBackground branding={branding} />);

    // #8e91f4 -> rgb(142, 145, 244)
    expect(blobs(container, "dark")[0].style.backgroundImage).toContain("rgba(142, 145, 244");
  });

  it("still renders with no branding at all", () => {
    const { container } = render(<AuroraBackground />);

    expect(blobs(container, "light")).toHaveLength(3);
    expect(blobs(container, "light")[0].style.backgroundImage).not.toContain("NaN");
  });

  it("applies the tenant's aurora intensity", () => {
    const { container } = render(<AuroraBackground branding={branding} intensity={0} />);

    expect(blobs(container, "light")[0].style.backgroundImage).toContain("rgba(91, 95, 214, 0)");
  });

  it("is decorative, so it stays out of the accessibility tree", () => {
    const { container } = render(<AuroraBackground branding={branding} />);

    expect(container.querySelector("[data-aurora-root]")).toHaveAttribute("aria-hidden", "true");
  });
});
