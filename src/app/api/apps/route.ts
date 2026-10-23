import { getSessionUser } from "@/lib/auth";
import { getOperationalApps } from "@/lib/operations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  if (!await getSessionUser()) return Response.json({ success: false, error: "Sesión requerida" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  try {
    const apps = await getOperationalApps();
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
