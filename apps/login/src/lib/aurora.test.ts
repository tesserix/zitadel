import { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";
import { describe, expect, it } from "vitest";
import { auroraIntensity, brandColor } from "./aurora";

const PRIMARY_FALLBACK = "#5469d4";

const branding = {
  lightTheme: { primaryColor: "#5b5fd6" },
  darkTheme: { primaryColor: "#8e91f4" },
} as BrandingSettings;

describe("brandColor", () => {
  it("takes the light primary colour in light mode", () => {
    expect(brandColor(branding, "light")).toBe("#5b5fd6");
  });

  it("takes the dark primary colour in dark mode", () => {
    expect(brandColor(branding, "dark")).toBe("#8e91f4");
  });

  it("falls back to the Zitadel primary when the tenant set no branding", () => {
    expect(brandColor(undefined, "light")).toBe(PRIMARY_FALLBACK);
  });

  // deriveAuroraPalette throws on anything it cannot parse, and a tenant can
  // save an empty or malformed colour through the console.
  it("falls back when the tenant colour is unparseable", () => {
    const broken = { lightTheme: { primaryColor: "cornflowerblue" } } as BrandingSettings;

    expect(brandColor(broken, "light")).toBe(PRIMARY_FALLBACK);
  });

  it("falls back when the tenant colour is empty", () => {
    const empty = { lightTheme: { primaryColor: "" } } as BrandingSettings;

    expect(brandColor(empty, "light")).toBe(PRIMARY_FALLBACK);
  });
});

describe("auroraIntensity", () => {
  it("maps the default to the full wash", () => {
    expect(auroraIntensity(1)).toBe("full");
  });

  it("maps zero to no wash at all", () => {
    expect(auroraIntensity(0)).toBe("flat");
  });

  it("maps anything in between to the subtle wash", () => {
    expect(auroraIntensity(0.5)).toBe("subtle");
  });

  it("treats a missing intensity as full", () => {
    expect(auroraIntensity(undefined)).toBe("full");
  });
});
