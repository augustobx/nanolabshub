import { SAAS_PRODUCTS } from "./product-taxonomy";
import { isSaaSIntegrationEnabled } from "./integration-settings";
import { isManagementEnabled, callSaaSManagement } from "./saas-management";
import { liveValue } from "./live-cache";
import type { GovernanceOverview, SaaSSlug, UniversalTenant } from "./types";

type WireTenant = {
  id: string; slug: string; name: string; status: string; rawStatus: string;
  createdAt: string; plan: string | null;
  planExpiresAt?: string | null;
  modules?: Record<string, boolean>;
  metrics?: { totalRecords: number; recordLabel: string; available: boolean };
};
type WireResponse = {
  success: boolean; contract: string; product: SaaSSlug; capturedAt: string;
  tenants: WireTenant[]; nextOffset: number | null;
  capabilities: { tenantsRead: boolean; tenantWrite: boolean; moduleWrite: boolean };
};
function normalizeStatus(raw: string): UniversalTenant["status"] {
  if (raw === "ACTIVE" || raw === "TRIAL" || raw === "SUSPENDED" || raw === "CANCELED") return raw;
  throw new Error("Estado de tenant desconocido en la integración");
}
function adaptTenant(saas: SaaSSlug, name: string, value: WireTenant): UniversalTenant {
  if (!value.id || !value.slug || !value.name || typeof value.status !== "string") {
    throw new Error("Respuesta incompleta del adaptador");
  }
  return {
    id: String(value.id), slug: String(value.slug), name: String(value.name),
    saas, saasName: name, status: normalizeStatus(value.status),
    rawStatus: value.rawStatus, plan: value.plan || "No informado",
    createdAt: value.createdAt, domain: "", planExpiresAt: value.planExpiresAt ?? null,
    metrics: value.metrics?.available === true && Number.isSafeInteger(value.metrics.totalRecords) && value.metrics.totalRecords >= 0 && typeof value.metrics.recordLabel === "string"
      ? { totalRecords: value.metrics.totalRecords, recordLabel: value.metrics.recordLabel.slice(0, 80), available: true }
      : { totalRecords: 0, recordLabel: "Métricas no disponibles", available: false },
    modules: value.modules && typeof value.modules === "object" && !Array.isArray(value.modules) ? Object.fromEntries(Object.entries(value.modules).filter(([, enabled]) => typeof enabled === "boolean")) : {},
  };
}
async function readProduct(saas: SaaSSlug, name: string, domain: string): Promise<UniversalTenant[]> {
  if (!isSaaSIntegrationEnabled(saas)) {
    throw new Error("Integración segura todavía no habilitada");
  }
  const token = process.env["HUB_INTEGRATION_" + saas.toUpperCase() + "_TOKEN"] || "";
  if (Buffer.byteLength(token) < 32) throw new Error("Token de servicio no configurado");
  const all: UniversalTenant[] = [];
  const ids = new Set<string>();
  let offset = 0;
  // Bound pagination and network work. We will not claim complete data past this limit.
  for (let i = 0; i < 20; i++) {
    const url = "https://" + domain + "/api/integrations/nanolabs/tenants?offset=" + offset;
    const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json", "User-Agent": "NanoLabsHub/2" },
      redirect: "error", cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error("Endpoint de integración no disponible");
    const wire = await response.json() as WireResponse;
    if (!wire.success || wire.contract !== "nanolabs.saas.tenants.v1" || wire.product !== saas ||
        !Array.isArray(wire.tenants) || wire.tenants.length > 100 ||
        wire.capabilities?.tenantsRead !== true ||
        wire.capabilities?.tenantWrite !== false ||
        wire.capabilities?.moduleWrite !== false) throw new Error("Contrato de integración no válido");
    for (const raw of wire.tenants) {
      const tenant = adaptTenant(saas, name, raw);
      if (ids.has(tenant.id)) throw new Error("La fuente repitió un tenant");
      ids.add(tenant.id); all.push(tenant);
    }
    if (wire.nextOffset === null) return all;
    if (!Number.isInteger(wire.nextOffset) || wire.nextOffset <= offset ||
        wire.nextOffset > 100000 || wire.tenants.length === 0) throw new Error("Paginación inválida");
    offset = wire.nextOffset;
  }
  throw new Error("La fuente superó el límite seguro de paginación; datos no contabilizados");
}
export async function getUniversalGovernanceOverview(): Promise<GovernanceOverview> {
  return liveValue("governance", readGovernanceOverview);
}
async function readGovernanceOverview(): Promise<GovernanceOverview> {
  const results = await Promise.allSettled(SAAS_PRODUCTS.map(p => readProduct(p.slug, p.name, p.domain)));
  const managementSources = await Promise.all(SAAS_PRODUCTS.map(async p => {
    if (!isManagementEnabled(p.slug)) return { saas:p.slug, status:"disabled" as const, operations:[] as string[] };
    try {
      const catalog = await callSaaSManagement(p.slug,"hub-capability-probe",new URLSearchParams({resource:"catalog"}),undefined,7000) as {operations?:unknown};
      if (!Array.isArray(catalog.operations) || catalog.operations.some(x=>typeof x!=="string")) throw Error("Catálogo inválido");
      return { saas:p.slug, status:"available" as const, operations:catalog.operations as string[] };
    } catch { return { saas:p.slug, status:"unavailable" as const, operations:[] as string[] }; }
  }));
  const tenants = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
  return {
    totalTenants: tenants.length,
    managementProducts: managementSources.filter(p=>p.status==="available").map(p=>p.saas),
    managementSources,
    activeTenants: tenants.filter(t => t.status === "ACTIVE").length,
    trialTenants: tenants.filter(t => t.status === "TRIAL").length,
    suspendedTenants: tenants.filter(t => t.status === "SUSPENDED" || t.status === "CANCELED").length,
    totalRecordsManaged: tenants.reduce((total, t) => total + (t.metrics.available ? t.metrics.totalRecords : 0), 0), saasCount: results.filter(r=>r.status==="fulfilled").length, tenants,
    sources: SAAS_PRODUCTS.map((p, i) => ({
      saas: p.slug, status: !isSaaSIntegrationEnabled(p.slug) ? "disabled" :
        results[i].status === "fulfilled" ? "available" : "unavailable",
      count: results[i].status === "fulfilled" ? results[i].value.length : null,
      checkedAt: new Date().toISOString(),
      message: !isSaaSIntegrationEnabled(p.slug) ? "Conector pendiente de habilitación" :
        results[i].status === "rejected" ? "Conector inaccesible o con contrato inválido" : null,
    })),
    legacyPanels: SAAS_PRODUCTS.map(p => ({
      saas: p.name, legacyAdminUrl: "https://" + p.domain + "/superadmin",
      sunsetStatus: "active_deprecated",
      replacementUrl: "https://hub.nanoapps.ar/saas/" + p.slug,
      notes: isManagementEnabled(p.slug) ? "Gestión central autenticada y auditada disponible en el Hub." : "El Hub solo ofrece lectura segura. El superadmin original mantiene las funciones de edición.",
    })),
  };
}
// Direct database writes were permanently removed from the Hub. A future
// authenticated, role-scoped SaaS API must implement every change independently.
export async function updateTenantStatusInDB(): Promise<never> {
  throw new Error("Edición bloqueada: no existe contrato de escritura seguro");
}
export async function toggleTenantModuleInDB(): Promise<never> {
  throw new Error("Edición bloqueada: no existe contrato de escritura seguro");
}

