import { getContainerLogs } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const container = searchParams.get("container");
    const lines = parseInt(searchParams.get("lines") || "100", 10);

    if (!container) {
      return Response.json({ success: false, error: "container is required" }, { status: 400 });
    }

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
