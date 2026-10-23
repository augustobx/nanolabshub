import { requireMutatingSession } from "@/lib/action-security";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try { await requireMutatingSession(req); } catch { return Response.json({ success: false, error: "Sesión u origen no autorizado" }, { status: 403 }); }
  return Response.json({ success: false, error: "La limpieza global requiere revisión de recursos y versiones de reversión. Esta acción está deshabilitada en el Hub." }, { status: 410 });
}
