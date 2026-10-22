import { getAppsStatus } from "@/lib/server-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const apps = await getAppsStatus();
    return Response.json({
      success: true,
      data: apps,
    });
  } catch (error: any) {
    console.error("Apps fetch error:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Failed to fetch apps status",
      },
      { status: 500 }
    );
  }
}
