import { describe, expect, test } from "vitest";
import { TAGLINE_MAX, tenantLoginFromMetadata, TITLE_MAX } from "./tenant-branding";

const entry = (key: string, value: string) => ({ key, value: new TextEncoder().encode(value) });

describe("tenantLoginFromMetadata", () => {
  test("falls back to a full-strength aurora and no copy when the tenant sets nothing", () => {
    expect(tenantLoginFromMetadata([])).toEqual({ auroraIntensity: 1 });
    expect(tenantLoginFromMetadata(undefined)).toEqual({ auroraIntensity: 1 });
  });

  test("decodes the tenant's title and tagline", () => {
    const result = tenantLoginFromMetadata([entry("login:title", "Welcome to Acme"), entry("login:tagline", "Ship faster")]);

    expect(result.title).toBe("Welcome to Acme");
    expect(result.tagline).toBe("Ship faster");
  });

  test("decodes multi-byte characters", () => {
    expect(tenantLoginFromMetadata([entry("login:title", "स्वागत — Ünïcode ✨")]).title).toBe("स्वागत — Ünïcode ✨");
  });

  test("ignores metadata the login page does not own", () => {
    const result = tenantLoginFromMetadata([entry("billing:plan", "enterprise"), entry("login:title", "Acme")]);

    expect(result.title).toBe("Acme");
    expect(result).not.toHaveProperty("billing:plan");
  });

  test("reads the aurora intensity", () => {
    expect(tenantLoginFromMetadata([entry("login:aurora", "0.4")]).auroraIntensity).toBe(0.4);
    expect(tenantLoginFromMetadata([entry("login:aurora", "0")]).auroraIntensity).toBe(0);
  });

  test("clamps an out-of-range aurora intensity", () => {
    expect(tenantLoginFromMetadata([entry("login:aurora", "7")]).auroraIntensity).toBe(1);
    expect(tenantLoginFromMetadata([entry("login:aurora", "-3")]).auroraIntensity).toBe(0);
  });

  test("ignores an unparseable aurora intensity rather than rendering nothing", () => {
    expect(tenantLoginFromMetadata([entry("login:aurora", "bright")]).auroraIntensity).toBe(1);
    expect(tenantLoginFromMetadata([entry("login:aurora", "")]).auroraIntensity).toBe(1);
    expect(tenantLoginFromMetadata([entry("login:aurora", "NaN")]).auroraIntensity).toBe(1);
  });

  test("trims surrounding whitespace and drops copy that is blank", () => {
    const result = tenantLoginFromMetadata([entry("login:title", "  Acme  "), entry("login:tagline", "   ")]);

    expect(result.title).toBe("Acme");
    expect(result.tagline).toBeUndefined();
  });

  test("truncates copy that would break the layout", () => {
    const result = tenantLoginFromMetadata([
      entry("login:title", "T".repeat(TITLE_MAX + 50)),
      entry("login:tagline", "G".repeat(TAGLINE_MAX + 50)),
    ]);

    expect(result.title).toHaveLength(TITLE_MAX);
    expect(result.tagline).toHaveLength(TAGLINE_MAX);
  });

  test("takes the last value when a key is duplicated", () => {
    expect(tenantLoginFromMetadata([entry("login:title", "Old"), entry("login:title", "New")]).title).toBe("New");
  });
});
