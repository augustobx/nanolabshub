import { getOperationsSnapshot } from "@/lib/operations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await getOperationsSnapshot();
    return Response.json({ success: true, data }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Operations snapshot failed:", error);
    return Response.json({
      success: false, error: error instanceof Error ? error.message : "No se pudo consultar el servidor",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
