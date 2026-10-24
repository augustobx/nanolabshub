import { getSessionUser } from "@/lib/auth";
import { getContainerLogs } from "@/lib/server-api";
import { validateContainer } from "@/lib/operational-policy";
import { requireResourceRead } from "@/lib/action-security";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!await getSessionUser()) return Response.json({ success: false, error: "Sesión requerida" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  try {
    const { searchParams } = new URL(req.url);
    const container = searchParams.get("container");
    const lines = Number(searchParams.get("lines") || "100");

    if (!container) {
      return Response.json({ success: false, error: "container is required" }, { status: 400 });
    }

    try { validateContainer(container, lines); } catch { return Response.json({ success:false,error:"Contenedor o límite inválido" },{status:400}); }
    try { await requireResourceRead(req); } catch { return Response.json({success:false,error:"No tenés permiso sobre este contenedor"},{status:403}); }
    const logs = await getContainerLogs(container, lines);

    return Response.json({
      success: true,
      data: {
        container,
        lines,
        logs,
      },
    });
  } catch (error: any) {
    console.error("Logs error:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Failed to fetch logs",
      },
      { status: 500 }
    );
  }
}
