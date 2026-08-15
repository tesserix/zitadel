import { auroraIntensity, brandColor } from "@/lib/aurora";
import { AuroraBackground as TesserixAurora } from "@tesserix/web";
import { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";

type Props = {
  branding?: BrandingSettings;
  intensity?: number;
};

/** Decorative gradient field derived from the tenant's own primary colour. */
export function AuroraBackground({ branding, intensity }: Props) {
  const step = auroraIntensity(intensity);

  return (
    <div data-aurora-root aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Both themes stay in the DOM so switching is a CSS opacity change, never a repaint. */}
      <div data-aurora="light" className="absolute inset-0 opacity-100 transition-opacity duration-300 dark:opacity-0">
        <TesserixAurora brandColor={brandColor(branding, "light")} mode="light" intensity={step} />
      </div>
      <div data-aurora="dark" className="absolute inset-0 opacity-0 transition-opacity duration-300 dark:opacity-100">
        <TesserixAurora brandColor={brandColor(branding, "dark")} mode="dark" intensity={step} />
      </div>
    </div>
  );
}
