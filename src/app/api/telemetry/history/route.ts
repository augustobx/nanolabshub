import { getSessionUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!await getSessionUser()) return Response.json({ success: false, error: "Sesión requerida" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "60");
    if (!Number.isInteger(limit) || limit < 1 || limit > 300) return Response.json({ success: false, error: "Límite entre 1 y 300 requerido" }, { status: 400 });
    const history = getDatabase().getMetricsHistory(limit);

    return Response.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
