import { PRIMARY } from "@/helpers/colors";
import { deriveAuroraPalette, type AuroraIntensity, type AuroraMode } from "@tesserix/web";
import { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";

/** Tenant primary colour for the active theme, guarded so the palette never throws. */
export function brandColor(branding: BrandingSettings | undefined, mode: AuroraMode): string {
  const configured = (mode === "dark" ? branding?.darkTheme : branding?.lightTheme)?.primaryColor;
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
