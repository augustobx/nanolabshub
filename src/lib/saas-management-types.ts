export type ManagedSaaS = "onlygym" | "onlyturn";
export type ManagementOperation = "tenant.create" | "tenant.update" | "tenant.status" | "subscription.update" | "subscription.renew" | "module.set" | "admin.update" | "admin.revoke" | "plan.create" | "plan.update" | "payment.record";
export interface ManagementCatalog { operations: ManagementOperation[]; modules: string[]; limits: string[]; optionalLimits: string[]; currency: string; destructiveDelete: boolean; }
export interface ManagedPlan { id: string; code: string; name: string; description: string; priceCents: number; currency: string; active: boolean; modules: Record<string, boolean>; limits: Record<string, number>; version: string; }
export interface ManagedTenant {
  id: string; name: string; slug: string; status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED"; version: string;
  plan: ManagedPlan | null;
  subscription: { id: string; planId: string; status: string; start: string; end: string } | null;
  modules: Record<string, { enabled: boolean | number; override: boolean | number | null }>;
  admins: Array<{ id: string; name: string; email: string; role: string; active: boolean }>;
  usage: Record<string, number>;
  payments: Array<{ id: string; amountCents: number | null; method: string; reference: string | null; status: string; createdAt: string }>;
}
export interface ManagementAudit { id: string; tenantId: string | null; actor: string | null; action: string; entity: string | null; entityId: string | null; result: string; createdAt: string; }
export interface ManagementCommand { requestId: string; operation: ManagementOperation; input: Record<string, unknown>; }

