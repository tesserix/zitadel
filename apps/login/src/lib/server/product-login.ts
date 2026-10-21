import { productForClient, ProductLogin } from "@/lib/product-login";
import { createServiceForHost } from "@/lib/service";
import { ServiceConfig } from "@/lib/zitadel";
import { OIDCService } from "@zitadel/proto/zitadel/oidc/v2/oidc_service_pb";

export async function resolveProductLogin(
  serviceConfig: ServiceConfig,
  requestId?: string | null,
): Promise<ProductLogin | undefined> {
  if (!requestId?.startsWith("oidc_") || requestId.length > 512) return undefined;
  try {
    const client = await createServiceForHost(OIDCService, serviceConfig);
    const response = await client.getAuthRequest({ authRequestId: requestId.substring(5) }, { timeoutMs: 2000 });
    return response.authRequest ? productForClient(response.authRequest.clientId) : undefined;
  } catch {
    return undefined;
  }
}
