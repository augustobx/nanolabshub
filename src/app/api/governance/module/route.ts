import { toggleTenantModuleInDB } from "@/lib/saas-bridge";
import { getDatabase } from "@/lib/db";
import { SaaSSlug } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { saas, tenantId, moduleKey, enabled, tenantName } = body;

    if (!saas || !tenantId || !moduleKey || typeof enabled !== "boolean") {
      return Response.json(
        { success: false, error: "saas, tenantId, moduleKey and enabled boolean are required" },
        { status: 400 }
      );
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
        "augusto",
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
