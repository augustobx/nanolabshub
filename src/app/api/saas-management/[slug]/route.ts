import { getSessionUser } from "@/lib/auth";
import { requireMutatingSession } from "@/lib/action-security";
import { callSaaSManagement, SaaSManagementError } from "@/lib/saas-management";
import type { ManagementCommand } from "@/lib/saas-management-types";
import { limitedText } from "@/lib/request-body";
import { clearLiveCache } from "@/lib/live-cache";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function fail(error: unknown) {
  if (error instanceof SaaSManagementError) return Response.json({ success: false, code: error.code, error: error.message }, { status: error.status, headers });
  return Response.json({ success: false, error: "La solicitud de gestión no pudo procesarse." }, { status: 400, headers });
}
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) return Response.json({ success: false, error: "Sesión requerida" }, { status: 401, headers });
  try {
    const query = new URL(req.url).searchParams;
    if (Array.from(query.keys()).some(key => !["resource", "tenantId", "offset"].includes(key))) throw new SaaSManagementError(400, "QUERY", "Consulta inválida.");
    return Response.json({ success: true, data: await callSaaSManagement(slug, user, query) }, { headers });
  } catch (error) { return fail(error); }
}
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let user: string;
  try { user = await requireMutatingSession(req); }
  catch { return Response.json({ success: false, error: "Acceso no autorizado" }, { status: 403, headers }); }
  try {
    if (!req.headers.get("content-type")?.startsWith("application/json")) throw new SaaSManagementError(415, "FORMAT", "Se requiere JSON.");
    const body = await limitedText(req);
    if (Buffer.byteLength(body) > 32768) throw new SaaSManagementError(413, "BODY_LIMIT", "La solicitud supera el límite permitido.");
    const command = JSON.parse(body) as ManagementCommand;
    if (!command || typeof command !== "object" || !command.input || typeof command.input !== "object" || Array.isArray(command.input)) throw new SaaSManagementError(400, "COMMAND", "Solicitud inválida.");
    const data = await callSaaSManagement(slug, user, new URLSearchParams(), command);
    clearLiveCache();
    return Response.json({ success: true, data }, { headers });
  } catch (error) { return fail(error); }
}

