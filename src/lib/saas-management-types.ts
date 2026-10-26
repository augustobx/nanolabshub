export type ManagedSaaS = "onlygym" | "onlyturn" | "onlyfood" | "onlycars" | "onlyerp";
export type ManagementOperation = "tenant.create" | "tenant.update" | "tenant.status" | "subscription.update" | "subscription.renew" | "module.set" | "admin.update" | "admin.revoke" | "plan.create" | "plan.update" | "payment.record" | "payment.status" | "domain.add";
export interface ManagementCatalog { operations: ManagementOperation[]; modules: string[]; limits: string[]; optionalLimits: string[]; currency: string; destructiveDelete: boolean; statuses?: string[]; trialDates?: boolean; paymentLifecycle?: boolean; paymentPeriods?: boolean; paymentCalendar?: boolean; adminIdentity?: "username"; ownerIdentity?: "username"; immutableSlug?: boolean; tenantFields?: string[]; domainManagement?: boolean; }
export interface ManagedPlan { id: string; code: string; name: string; description: string; priceCents: number; currency: string; active: boolean; modules: Record<string, boolean>; limits: Record<string, number>; version: string; preservedFeatures?: string[]; }
export interface ManagedTenant {
  id: string; name: string; slug: string; status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED" | "PAST_DUE"; version: string;
  access?: { enabled: boolean; reason: string | null };
  contact?: Record<string, string | null>;
  domains?: Array<{hostname: string; primary: boolean; custom: boolean; verified: boolean}>;
  integrations?: Array<{type: string; configured: boolean; active: boolean}>;
  plan: ManagedPlan | null;
  subscription: { id: string; planId: string; status: string; start: string; end: string; trialEndsAt?: string | null; provider?: string | null } | null;
  modules: Record<string, { enabled: boolean | number; override: boolean | number | null }>;
  admins: Array<{ id: string; name: string; email: string; username?: string; role: string; active: boolean }>;
  usage: Record<string, number>;
  payments: Array<{ id: string; amountCents: number | null; method: string; reference: string | null; status: string; createdAt: string; currency?: string; month?: number; year?: number; start?: string; end?: string; dueAt?: string | null; paidAt?: string | null; notes?: string | null }>;
}
export interface ManagementAudit { id: string; tenantId: string | null; actor: string | null; action: string; entity: string | null; entityId: string | null; result: string; createdAt: string; }
export interface ManagementCommand { requestId: string; operation: ManagementOperation; input: Record<string, unknown>; }

