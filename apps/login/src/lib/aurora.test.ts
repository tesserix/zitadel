import tinycolor from "tinycolor2";
import { describe, expect, test } from "vitest";
import { auroraLayers, readableOn } from "./aurora";

const TESSERIX = "#5b5fd6";

function alphaOf(layer: string): number {
  const match = layer.match(/rgba\([^)]*,\s*([\d.]+)\)/);
  if (!match) throw new Error(`no rgba stop in: ${layer}`);
  return parseFloat(match[1]);
}

describe("auroraLayers", () => {
  test("returns three distinct radial gradients", () => {
    const { primary, secondary, tertiary } = auroraLayers(TESSERIX, false);

    for (const layer of [primary, secondary, tertiary]) {
      expect(layer).toMatch(/^radial-gradient\(circle,\s*rgba\(/);
    }
    expect(new Set([primary, secondary, tertiary]).size).toBe(3);
  });

  test("derives the layers from the tenant primary colour", () => {
    const tesserix = auroraLayers(TESSERIX, false);
    const acme = auroraLayers("#c2410c", false);

    expect(acme.primary).not.toBe(tesserix.primary);
    expect(acme.secondary).not.toBe(tesserix.secondary);
  });

  test("hue-shifts the secondary and tertiary away from the primary", () => {
    const { primary, secondary, tertiary } = auroraLayers(TESSERIX, false);
    const hue = (layer: string) => {
      const [r, g, b] = layer
        .match(/rgba\((\d+),\s*(\d+),\s*(\d+)/)!
        .slice(1)
        .map(Number);
      return tinycolor({ r, g, b }).toHsl().h;
    };

    expect(Math.abs(hue(secondary) - hue(primary))).toBeGreaterThan(20);
    expect(Math.abs(hue(tertiary) - hue(primary))).toBeGreaterThan(20);
    expect(hue(secondary)).not.toBeCloseTo(hue(tertiary), 0);
  });

  test("renders more opaque in dark mode, where the aurora carries the page", () => {
    expect(alphaOf(auroraLayers(TESSERIX, true).primary)).toBeGreaterThan(alphaOf(auroraLayers(TESSERIX, false).primary));
  });

  test("scales every layer by intensity", () => {
    const full = auroraLayers(TESSERIX, false, 1);
    const half = auroraLayers(TESSERIX, false, 0.5);

    expect(alphaOf(half.primary)).toBeCloseTo(alphaOf(full.primary) / 2, 2);
    expect(alphaOf(half.tertiary)).toBeCloseTo(alphaOf(full.tertiary) / 2, 2);
  });

  test("intensity 0 lets a tenant switch the aurora off entirely", () => {
    const off = auroraLayers(TESSERIX, false, 0);

    expect(alphaOf(off.primary)).toBe(0);
    expect(alphaOf(off.secondary)).toBe(0);
    expect(alphaOf(off.tertiary)).toBe(0);
  });

  test("clamps intensity supplied out of range", () => {
    expect(alphaOf(auroraLayers(TESSERIX, false, 99).primary)).toBeCloseTo(
      alphaOf(auroraLayers(TESSERIX, false, 1).primary),
      4,
    );
    expect(alphaOf(auroraLayers(TESSERIX, false, -5).primary)).toBe(0);
  });

  test("falls back to the default primary when a tenant supplies no usable colour", () => {
    const fallback = auroraLayers("", false);

    expect(fallback.primary).toBe(auroraLayers("#5469d4", false).primary);
    expect(fallback.primary).not.toContain("NaN");
  });

  test("never emits NaN for a malformed colour", () => {
    for (const layer of Object.values(auroraLayers("not-a-colour", true))) {
      expect(layer).not.toContain("NaN");
    }
  });
});

describe("readableOn", () => {
  test("leaves a colour that already meets AA untouched", () => {
    expect(readableOn("#1f2937", "#ffffff")).toBe("#1f2937");
  });

  test("darkens a washed-out tenant colour until it meets AA on a light card", () => {
    const guarded = readableOn("#ffe600", "#ffffff");

    expect(tinycolor.readability(guarded, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(tinycolor(guarded).getBrightness()).toBeLessThan(tinycolor("#ffe600").getBrightness());
  });

  test("lightens a dark tenant colour until it meets AA on a dark card", () => {
    const guarded = readableOn("#1a1a2e", "#0f0e2a");

    expect(tinycolor.readability(guarded, "#0f0e2a")).toBeGreaterThanOrEqual(4.5);
    expect(tinycolor(guarded).getBrightness()).toBeGreaterThan(tinycolor("#1a1a2e").getBrightness());
  });

  test("preserves the tenant's hue while correcting contrast", () => {
    const guarded = readableOn("#ffe600", "#ffffff");

    expect(tinycolor(guarded).toHsl().h).toBeCloseTo(tinycolor("#ffe600").toHsl().h, 0);
  });

  test("returns a usable colour even when no shade can reach AA", () => {
    const guarded = readableOn("#808080", "#808080");

    expect(tinycolor(guarded).isValid()).toBe(true);
  });
});
