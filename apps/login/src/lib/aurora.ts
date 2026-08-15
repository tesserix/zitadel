import { PRIMARY } from "@/helpers/colors";
import tinycolor from "tinycolor2";

export type AuroraLayers = {
  primary: string;
  secondary: string;
  tertiary: string;
};

type LayerSpec = {
  hueShift: number;
  lighten: { light: number; dark: number };
  alpha: { light: number; dark: number };
  extent: number;
};

// A tenant configures one primary colour; the other two blobs are derived from it
// so no tenant is ever asked to pick a gradient that works.
const LAYER_SPECS: Record<keyof AuroraLayers, LayerSpec> = {
  primary: { hueShift: 0, lighten: { light: 0, dark: 0 }, alpha: { light: 0.2, dark: 0.4 }, extent: 62 },
  secondary: { hueShift: 38, lighten: { light: 6, dark: -4 }, alpha: { light: 0.16, dark: 0.26 }, extent: 64 },
  tertiary: { hueShift: -42, lighten: { light: 10, dark: -26 }, alpha: { light: 0.28, dark: 0.52 }, extent: 66 },
};

const AA_CONTRAST = 4.5;

export function auroraLayers(primaryColor: string, dark: boolean, intensity: number = 1): AuroraLayers {
  const base = tinycolor(primaryColor);
  const seed = base.isValid() ? base : tinycolor(PRIMARY);
  const scale = Math.min(1, Math.max(0, intensity));

  const layer = (spec: LayerSpec): string => {
    const shift = dark ? spec.lighten.dark : spec.lighten.light;
    const color = seed.clone().spin(spec.hueShift);
    const shifted = shift >= 0 ? color.lighten(shift) : color.darken(-shift);
    const stop = shifted.setAlpha((dark ? spec.alpha.dark : spec.alpha.light) * scale).toRgbString();

    return `radial-gradient(circle, ${stop} 0%, transparent ${spec.extent}%)`;
  };

  return {
    primary: layer(LAYER_SPECS.primary),
    secondary: layer(LAYER_SPECS.secondary),
    tertiary: layer(LAYER_SPECS.tertiary),
  };
}

/** Shifts a tenant colour along its own hue until it clears AA against the surface behind it. */
export function readableOn(color: string, background: string): string {
  const parsed = tinycolor(color);
  let guarded = parsed.isValid() ? parsed : tinycolor(PRIMARY);
  const darkenTowardsContrast = tinycolor(background).isLight();

  for (let step = 0; step < 50 && tinycolor.readability(guarded, background) < AA_CONTRAST; step++) {
    guarded = darkenTowardsContrast ? guarded.clone().darken(2) : guarded.clone().lighten(2);
  }

  return guarded.toHexString();
}
