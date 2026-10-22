import { updateTenantStatusInDB } from "@/lib/saas-bridge";
import { getDatabase } from "@/lib/db";
import { requireMutatingSession } from "@/lib/action-security";
import { SAAS_PRODUCTS } from "@/lib/product-taxonomy";
import { SaaSSlug } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let actor: string;
  try { actor = await requireMutatingSession(req); }
  catch { return Response.json({ success: false, error: "Sesión o origen no autorizado" }, { status: 403 }); }
  return Response.json({
    success: false,
    error: "Edición de datos productivos bloqueada. Primero deben auditarse y habilitarse los contratos seguros de cada SaaS."
  }, { status: 501, headers: { "Cache-Control": "no-store" } });
  /* Escritura heredada desactivada preventivamente.
  try {
    const body = await req.json();
    const { saas, tenantId, status, tenantName } = body;

    if (typeof saas !== "string" || !SAAS_PRODUCTS.some(p => p.slug === saas) ||
        typeof tenantId !== "string" || !/^[a-zA-Z0-9_-]{1,90}$/.test(tenantId) ||
        !["ACTIVE", "TRIAL", "SUSPENDED", "CANCELED"].includes(status)) {
      return Response.json({ success: false, error: "Parámetros o estado de tenant inválidos" }, { status: 400 });
    }

    const result = await updateTenantStatusInDB(
      saas as SaaSSlug,
      tenantId,
      status as "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED"
    );

    // Record audit log
    try {
      getDatabase().logAudit(
        actor,
        "TENANT_STATUS_UPDATE",
        `${saas.toUpperCase()}:${tenantName || tenantId}`,
        `Estado actualizado a ${status} en base de datos productiva`
      );
    } catch {}

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Governance status update error:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to update tenant status" },
      { status: 500 }
    );
  }
  */
}
