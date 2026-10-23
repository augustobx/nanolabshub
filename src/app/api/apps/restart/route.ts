import { restartContainer } from "@/lib/server-api";
import { requireMutatingSession } from "@/lib/action-security";
import { assertContainerAppActive } from "@/lib/app-lifecycle";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const actor = await requireMutatingSession(req);
    const body = await req.json();
    const { containerName } = body;

    if (!containerName) {
      return Response.json({ success: false, error: "containerName is required" }, { status: 400 });
    }

    assertContainerAppActive(containerName);
    const db = getDatabase();
    db.logAudit(actor,"CONTAINER_RESTART_STARTED",containerName,"Reinicio solicitado");
    const output = await restartContainer(containerName);

    try {
      db.logAudit(actor, "CONTAINER_RESTART", containerName, `Reinicio exitoso de contenedor ${containerName}`);
    } catch {}

    return Response.json({
      success: true,
      data: {
        containerName,
        output,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Restart error:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Failed to restart container",
      },
      { status: 500 }
    );
  }
}
