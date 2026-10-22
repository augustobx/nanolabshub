import { evaluateSystemAlerts } from "@/lib/alerts";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const alerts = await evaluateSystemAlerts();
    const auditLogs = getDatabase().getAuditLogs(10);

    return Response.json({
      success: true,
      data: {
        alerts,
        auditLogs,
      },
    });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
