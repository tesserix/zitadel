import { auroraIntensity, brandColor } from "@/lib/aurora";
import { AuroraBackground as TesserixAurora } from "@tesserix/web";
import { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";

type Props = {
  branding?: BrandingSettings;
  intensity?: number;
};

/** Decorative gradient field derived from the tenant's own primary colour. */
export function AuroraBackground({ branding, intensity }: Props) {
  return (
    <TesserixAurora
      data-aurora-root
      brandColor={brandColor(branding)}
      mode="auto"
      intensity={auroraIntensity(intensity)}
    />
  );
}
