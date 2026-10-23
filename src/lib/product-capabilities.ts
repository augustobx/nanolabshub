import type { GovernanceOverview } from "./types";
export function productCapabilities(overview: GovernanceOverview | null, slug: string) {
  const source = overview?.managementSources?.find(p=>p.saas===slug);
  const configured = overview?.managementProducts?.some(p=>p===slug) === true;
  // Compatibility with stored/older overview fixtures; current responses include an actual catalog probe.
  const available = source ? source.status==="available" : configured;
  const allows = (operation:string) => available && (!source || source.operations.includes(operation));
  return { available, tenantRead: overview?.sources?.some(p=>p.saas===slug&&p.status==="available")===true,
    statusWrite:allows("tenant.status"), moduleWrite:allows("module.set"),
    impersonation:allows("admin.update")&&allows("admin.revoke"),settings:allows("tenant.update"),activity:available };
}
