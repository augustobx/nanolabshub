import { restartContainer } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { containerName } = body;

    if (!containerName) {
      return Response.json({ success: false, error: "containerName is required" }, { status: 400 });
    }

    const output = await restartContainer(containerName);

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
