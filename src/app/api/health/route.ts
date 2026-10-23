import { getDatabase } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  let ready = false;
  try { ready = getDatabase().persistentReady() === true; } catch {}
  return Response.json({
    status: ready ? "healthy" : "degraded",
    service: "nanolabshub",
    version: "1.0.0",
    role: "supreme-governance",
    timestamp: new Date().toISOString(),
    persistence: ready ? "available" : "unavailable",
  }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
