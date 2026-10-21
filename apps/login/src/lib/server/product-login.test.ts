import type { ServiceConfig } from "@/lib/zitadel";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveProductLogin } from "./product-login";

const { getAuthRequest, createService } = vi.hoisted(() => ({ getAuthRequest: vi.fn(), createService: vi.fn() }));
vi.mock("@/lib/service", () => ({ createServiceForHost: createService }));
const config: ServiceConfig = {
  baseUrl: "https://auth.tesserix.app",
  instanceHost: "auth.tesserix.app",
  publicHost: "auth.tesserix.app",
};

beforeEach(() => {
  vi.clearAllMocks();
  createService.mockResolvedValue({ getAuthRequest });
});

describe("verified product context", () => {
  it("selects branding from the client returned by ZITADEL, with a bounded lookup", async () => {
    getAuthRequest.mockResolvedValue({ authRequest: { clientId: "392328865646707494" } });
    expect(await resolveProductLogin(config, "oidc_V2_pending")).toMatchObject({ name: "Roamie" });
    expect(getAuthRequest).toHaveBeenCalledWith({ authRequestId: "V2_pending" }, { timeoutMs: 2000 });
  });

  it("does not brand an unregistered client", async () => {
    getAuthRequest.mockResolvedValue({ authRequest: { clientId: "other-product" } });
    expect(await resolveProductLogin(config, "oidc_other")).toBeUndefined();
  });

  it("leaves the normal login available if the branding lookup fails", async () => {
    getAuthRequest.mockRejectedValue(new Error("unavailable"));
    expect(await resolveProductLogin(config, "oidc_expired")).toBeUndefined();
  });

  it.each([undefined, "", "saml_123", `oidc_${"a".repeat(513)}`])(
    "does not fetch arbitrary request context: %s",
    async (id) => {
      expect(await resolveProductLogin(config, id)).toBeUndefined();
      expect(createService).not.toHaveBeenCalled();
    },
  );
});
