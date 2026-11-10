export type ProductLogin = {
  name: string;
  title: string;
  tagline: string;
  logo: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  combinedCredentials: boolean;
};

const roamie: ProductLogin = {
  name: "Roamie",
  title: "Welcome to Roamie",
  tagline: "Your travel mate. Talk freely, wherever you land.",
  logo: "/products/roamie-mark.png",
  primaryColor: "#0A5FA8",
  backgroundColor: "#D8E8F6",
  textColor: "#0B2545",
  combinedCredentials: true,
};

const planningPoker: ProductLogin = {
  name: "Planning Poker",
  title: "Make room for your team.",
  tagline: "Less guessing. More conversation. Plan your next sprint together.",
  logo: "/products/planning-poker-mark.svg",
  primaryColor: "#4F46E5",
  backgroundColor: "#F3F4FF",
  textColor: "#111827",
  combinedCredentials: true,
};

const products: ReadonlyMap<string, ProductLogin> = new Map([
  ["399002497852638210", planningPoker],
  ["392328865646707494", roamie],
  ["392328864774226726", roamie],
]);

export function productForClient(clientId: string): ProductLogin | undefined {
  return products.get(clientId);
}

export const PRODUCT_REQUEST_HEADER = "x-zitadel-product-request";

export function headersForProductRequest(headers: Headers, url: URL): Headers {
  const forwarded = new Headers(headers);
  forwarded.delete(PRODUCT_REQUEST_HEADER);
  const authRequest = url.searchParams.get("authRequest");
  const requestId = url.searchParams.get("requestId") ?? (authRequest ? `oidc_${authRequest}` : undefined);
  if (requestId && requestId.length <= 512 && /^oidc_[\w.-]+$/.test(requestId)) {
    forwarded.set(PRODUCT_REQUEST_HEADER, requestId);
  }
  return forwarded;
}
