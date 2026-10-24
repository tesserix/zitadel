import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServiceForHost } from "../service";
import { getConsumerEmailPolicy } from "./consumer-email-policy";
vi.mock("../service", () => ({ createServiceForHost: vi.fn() }));
const listOrganizationMetadata = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServiceForHost).mockResolvedValue({ listOrganizationMetadata } as never);
});
describe("consumer email authorization lookup", () => {
  it("never looks up staff organization metadata", async () => {
    expect(await getConsumerEmailPolicy({ baseUrl: "https://auth.example" }, "staff")).toBe(false);
    expect(createServiceForHost).not.toHaveBeenCalled();
  });
  it("propagates unavailable authorization instead of accepting stale policy", async () => {
    listOrganizationMetadata.mockRejectedValue(new Error("unavailable"));
    await expect(getConsumerEmailPolicy({ baseUrl: "https://auth.example" }, "consumer-mediconnect")).rejects.toThrow(
      "unavailable",
    );
  });
  it("checks revocation on each request", async () => {
    const value = (value: string) => new TextEncoder().encode(value);
    listOrganizationMetadata
      .mockResolvedValueOnce({
        metadata: [
          { key: "consumer_binding", value: value("identity-operator/mediconnect") },
          { key: "consumer_email_otp", value: value('{"version":1,"enabled":true,"smsEnabled":false}') },
        ],
      })
      .mockResolvedValueOnce({ metadata: [] });
    expect(await getConsumerEmailPolicy({ baseUrl: "https://auth.example" }, "consumer-mediconnect")).toBe(true);
    expect(await getConsumerEmailPolicy({ baseUrl: "https://auth.example" }, "consumer-mediconnect")).toBe(false);
    expect(listOrganizationMetadata).toHaveBeenCalledTimes(2);
    expect(listOrganizationMetadata).toHaveBeenCalledWith({ organizationId: "consumer-mediconnect" });
  });
});
