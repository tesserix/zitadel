import { auroraLayers } from "@/lib/aurora";
import { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";

type Props = {
  branding?: BrandingSettings;
  intensity?: number;
};

const BLOB_POSITIONS = [
  "-top-1/3 -left-1/4 h-[110%] w-[85%]",
  "top-1/4 -right-1/4 h-[100%] w-[80%]",
  "-bottom-1/3 left-1/5 h-[95%] w-[90%]",
];

/** Decorative gradient field derived from the tenant's own primary colour. */
export function AuroraBackground({ branding, intensity }: Props) {
  const light = auroraLayers(branding?.lightTheme?.primaryColor ?? "", false, intensity);
  const dark = auroraLayers(branding?.darkTheme?.primaryColor ?? "", true, intensity);

  return (
    <div data-aurora-root aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <Field theme="light" layers={light} className="opacity-100 dark:opacity-0" />
      <Field theme="dark" layers={dark} className="opacity-0 dark:opacity-100" />
    </div>
  );
}

// Both themes are always in the DOM so switching is a CSS opacity change, never a repaint.
function Field({
  theme,
  layers,
  className,
}: {
  theme: "light" | "dark";
  layers: ReturnType<typeof auroraLayers>;
  className: string;
}) {
  return (
    <div data-aurora={theme} className={`absolute inset-0 transition-opacity duration-300 ${className}`}>
      {[layers.primary, layers.secondary, layers.tertiary].map((layer, index) => (
        <div
          key={index}
          data-aurora-blob
          className={`absolute blur-3xl ${BLOB_POSITIONS[index]}`}
          style={{ backgroundImage: layer }}
        />
      ))}
    </div>
  );
}
