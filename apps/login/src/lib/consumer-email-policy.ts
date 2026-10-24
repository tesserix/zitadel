import type { MetadataEntry } from "./tenant-branding";

export function consumerEmailAllowed(organization: string | undefined, entries: MetadataEntry[]): boolean {
  if (!organization || !/^consumer-[a-z][a-z0-9-]{1,62}$/.test(organization)) return false;
  const bindings = entries.filter((entry) => entry.key === "consumer_binding");
  const policies = entries.filter((entry) => entry.key === "consumer_email_otp");
  if (bindings.length !== 1 || policies.length !== 1 || bindings[0].value.length > 200 || policies[0].value.length > 256) {
    return false;
  }
  const binding = new TextDecoder().decode(bindings[0].value);
  if (
    !/^[a-z][a-z0-9-]{1,62}\/[a-z][a-z0-9-]{1,62}$/.test(binding) ||
    `consumer-${binding.split("/")[1]}` !== organization
  ) {
    return false;
  }
  try {
    const policy: unknown = JSON.parse(new TextDecoder().decode(policies[0].value));
    return (
      typeof policy === "object" &&
      policy !== null &&
      "version" in policy &&
      policy.version === 1 &&
      "enabled" in policy &&
      policy.enabled === true &&
      "smsEnabled" in policy &&
      policy.smsEnabled === false
    );
  } catch {
    return false;
  }
}
