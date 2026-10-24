import { ConsumerEmailForm } from "@/components/consumer-email-form";
import { DynamicTheme } from "@/components/dynamic-theme";
import { getConsumerEmailPolicy } from "@/lib/server/consumer-email-policy";
import { getServiceConfig } from "@/lib/service-url";
import { getAuthRequest, getBrandingSettings, getTenantLogin } from "@/lib/zitadel";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<{ requestId?: string }> }) {
  const { requestId } = await searchParams;
  if (!requestId || !/^[a-zA-Z0-9_-]{1,200}$/.test(requestId)) notFound();
  const { serviceConfig } = getServiceConfig(await headers());
  const { authRequest } = await getAuthRequest({ serviceConfig, authRequestId: requestId });
  const orgScopes = authRequest?.scope.filter((scope) => scope.startsWith("urn:zitadel:iam:org:id:")) ?? [];
  if (orgScopes.length !== 1) notFound();
  const organization = orgScopes[0].slice("urn:zitadel:iam:org:id:".length);
  if (!(await getConsumerEmailPolicy(serviceConfig, organization))) notFound();
  const [branding, tenant] = await Promise.all([
    getBrandingSettings({ serviceConfig, organization }),
    getTenantLogin({ serviceConfig, organization }),
  ]);
  return (
    <DynamicTheme branding={branding} tenant={tenant}>
      <h1>Sign in with email</h1>
      <p className="ztdl-p mb-6">Use a code sent to your email. New accounts verify their email before signing in.</p>
      <ConsumerEmailForm requestId={requestId} />
    </DynamicTheme>
  );
}
