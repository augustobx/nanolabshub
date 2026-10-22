import { requireMutatingSession } from "@/lib/action-security";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try { await requireMutatingSession(req); }
  catch { return Response.json({ success: false, error: "Acceso no autorizado" }, { status: 403 }); }
  return Response.json({
    success: false,
    error: "Operación bloqueada: requiere conector SaaS de escritura autenticado, auditado y con rollback verificado."
  }, { status: 501, headers: { "Cache-Control": "private, no-store" } });
}
