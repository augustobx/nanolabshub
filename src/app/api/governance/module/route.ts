import { toggleTenantModuleInDB } from "@/lib/saas-bridge";
import { getDatabase } from "@/lib/db";
import { requireMutatingSession } from "@/lib/action-security";
import { SAAS_PRODUCTS } from "@/lib/product-taxonomy";
import { SaaSSlug } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let actor: string;
  try { actor = await requireMutatingSession(req); }
  catch { return Response.json({ success: false, error: "Sesión o origen no autorizado" }, { status: 403 }); }
  try {
    const body = await req.json();
    const { saas, tenantId, moduleKey, enabled, tenantName } = body;

    if (saas !== "onlygym") {
      return Response.json({ success: false, error: "La edición de módulos todavía no está integrada para esta SaaS" }, { status: 501 });
    }
    if (typeof tenantId !== "string" || !/^[0-9]{1,12}$/.test(tenantId) ||
        typeof moduleKey !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(moduleKey) ||
        typeof enabled !== "boolean") {
      return Response.json({ success: false, error: "Parámetros de módulos inválidos" }, { status: 400 });
    }

    const result = await toggleTenantModuleInDB(
      saas as SaaSSlug,
      tenantId,
      moduleKey,
      enabled
    );

    // Record audit log
    try {
      getDatabase().logAudit(
        actor,
        "TENANT_MODULE_TOGGLE",
        `${saas.toUpperCase()}:${tenantName || tenantId}`,
        `Módulo '${moduleKey}' ${enabled ? "ACTIVADO" : "DESACTIVADO"}`
      );
    } catch {}

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Governance module toggle error:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to toggle module" },
      { status: 500 }
    );
  }
}
