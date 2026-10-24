import { OrganizationService } from "@zitadel/proto/zitadel/org/v2/org_service_pb";
import "server-only";
import { consumerEmailAllowed } from "../consumer-email-policy";
import { createServiceForHost } from "../service";
import type { ServiceConfig } from "../zitadel";

export async function getConsumerEmailPolicy(serviceConfig: ServiceConfig, organization: string): Promise<boolean> {
  if (!organization.startsWith("consumer-")) return false;
  const service = await createServiceForHost(OrganizationService, serviceConfig);
  // Authorization policy is never served from the branding cache: revocation must take effect immediately.
  const response = await service.listOrganizationMetadata({ organizationId: organization });
  return consumerEmailAllowed(organization, response.metadata);
}
