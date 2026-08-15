export type TenantLogin = {
  title?: string;
  tagline?: string;
  auroraIntensity: number;
};

export type MetadataEntry = { key: string; value: Uint8Array };

export const TITLE_KEY = "login:title";
export const TAGLINE_KEY = "login:tagline";
export const AURORA_KEY = "login:aurora";

export const TITLE_MAX = 60;
export const TAGLINE_MAX = 140;

const DEFAULT_AURORA_INTENSITY = 1;

export function tenantLoginFromMetadata(entries?: MetadataEntry[]): TenantLogin {
  const values = new Map<string, string>();
  for (const { key, value } of entries ?? []) {
    values.set(key, new TextDecoder().decode(value));
  }

  const title = copy(values.get(TITLE_KEY), TITLE_MAX);
  const tagline = copy(values.get(TAGLINE_KEY), TAGLINE_MAX);

  return {
    ...(title ? { title } : {}),
    ...(tagline ? { tagline } : {}),
    auroraIntensity: intensity(values.get(AURORA_KEY)),
  };
}

// Tenant admins write this copy; an unbounded string would push the form off the card.
function copy(raw: string | undefined, max: number): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function intensity(raw: string | undefined): number {
  const parsed = Number(raw);
  if (raw === undefined || raw.trim() === "" || Number.isNaN(parsed)) {
    return DEFAULT_AURORA_INTENSITY;
  }
  return Math.min(1, Math.max(0, parsed));
}
