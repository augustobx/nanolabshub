import { getSessionUser } from "@/lib/auth";
import { evaluateSystemAlerts } from "@/lib/alerts";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!await getSessionUser()) {
    return Response.json({ success: false, error: "Sesión requerida" }, {
      status: 401, headers: { "Cache-Control": "private, no-store" },
    });
  }
  try {
    const alerts = await evaluateSystemAlerts();
    const auditLogs = getDatabase().getAuditLogs(10);

    return Response.json({
      success: true,
      data: {
        alerts,
        auditLogs,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return Response.json({ success: false, error: "Alertas no disponibles" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
