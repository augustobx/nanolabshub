import { getServerTelemetry, getContainers } from "@/lib/server-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
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
