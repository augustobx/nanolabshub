import { getSessionUser } from "@/lib/auth";
import { getServerTelemetry, getContainers } from "@/lib/server-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  if (!await getSessionUser()) return Response.json({ success: false, error: "Sesión requerida" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  try {
    const [telemetry, containers] = await Promise.all([
      getServerTelemetry(),
      getContainers(),
    ]);

    return Response.json({
      success: true,
      data: {
        telemetry,
        containers,
      },
    });
  } catch (error: any) {
    console.error("Telemetry error:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Failed to fetch server telemetry",
      },
      { status: 500 }
    );
  }
}
