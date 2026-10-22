import { updateTenantStatusInDB } from "@/lib/saas-bridge";
import { getDatabase } from "@/lib/db";
import { SaaSSlug } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { saas, tenantId, status, tenantName } = body;

    if (!saas || !tenantId || !status) {
      return Response.json(
        { success: false, error: "saas, tenantId and status are required" },
        { status: 400 }
      );
    }

    const result = await updateTenantStatusInDB(
      saas as SaaSSlug,
      tenantId,
      status as "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED"
    );

    // Record audit log
    try {
      getDatabase().logAudit(
        "augusto",
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
}
