import { PRIMARY } from "@/helpers/colors";
import { deriveAuroraPalette, type AuroraIntensity } from "@tesserix/web";
import { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";

/** One hue feeds both surfaces, guarded so the palette never throws on tenant input. */
export function brandColor(branding: BrandingSettings | undefined): string {
  const configured = branding?.lightTheme?.primaryColor || branding?.darkTheme?.primaryColor;
  if (!configured) {
    return PRIMARY;
  }

  try {
    deriveAuroraPalette(configured);
    return configured;
  } catch {
    return PRIMARY;
  }
}

/** Tenant metadata carries a 0..1 dial; the design system takes three named steps. */
export function auroraIntensity(value: number | undefined): AuroraIntensity {
  if (value === undefined || value >= 1) {
    return "full";
  }
  return value <= 0 ? "flat" : "subtle";
}
