import { describe, expect, it } from "vitest";
import { headersForProductRequest, PRODUCT_REQUEST_HEADER, productForClient } from "./product-login";

describe("product login branding", () => {
  it.each(["392328865646707494", "392328864774226726"])(
    "uses Roamie branding for its registered native client %s",
    (clientId) => {
      expect(productForClient(clientId)).toMatchObject({
        name: "Roamie",
        primaryColor: "#0A5FA8",
        combinedCredentials: true,
      });
    },
  );

  it.each(["", "unknown", "392328865646707494.attacker"])(
    "keeps unknown clients on the existing branding: %s",
    (clientId) => {
      expect(productForClient(clientId)).toBeUndefined();
    },
  );
});

describe("product request context", () => {
  it.each([
    ["/login?authRequest=V2_123", "oidc_V2_123"],
    ["/loginname?requestId=oidc_V2_456", "oidc_V2_456"],
  ])("derives the pending OIDC request from %s", (path, expected) => {
    const forwarded = headersForProductRequest(
      new Headers({ [PRODUCT_REQUEST_HEADER]: "forged" }),
      new URL(path, "https://auth.tesserix.app"),
    );
    expect(forwarded.get(PRODUCT_REQUEST_HEADER)).toBe(expected);
  });

  it.each([
    "/login?client_id=392328865646707494",
    "/loginname",
    "/login?requestId=saml_request",
    `/login?requestId=oidc_${"a".repeat(513)}`,
  ])("strips forged product context on %s", (path) => {
    const incoming = new Headers({
      [PRODUCT_REQUEST_HEADER]: "oidc_forged",
      "x-zitadel-instance-host": "auth.tesserix.app",
    });
    const forwarded = headersForProductRequest(incoming, new URL(path, "https://auth.tesserix.app"));
    expect(forwarded.has(PRODUCT_REQUEST_HEADER)).toBe(false);
    expect(forwarded.get("x-zitadel-instance-host")).toBe("auth.tesserix.app");
    expect(incoming.get(PRODUCT_REQUEST_HEADER)).toBe("oidc_forged");
  });
});
