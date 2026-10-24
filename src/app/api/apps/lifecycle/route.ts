import { getSessionUser } from "@/lib/auth";
import { requireMutatingSession } from "@/lib/action-security";
import { changeLifecycle, getLifecycleHistory, type LifecycleAction } from "@/lib/app-lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedActions = new Set<LifecycleAction>(["suspend", "resume", "pending_retirement", "archive"]);
const noCache = { "Cache-Control": "private, no-store" };

function requireEnvironment() {
  if (process.env.HUB_LIFECYCLE_ENABLED !== "true") {
    throw new Error("Acciones de ciclo de vida deshabilitadas. Configurá HUB_LIFECYCLE_ENABLED=true en el contenedor Hub.");
  }
  if (!process.env.ADMIN_PASS || process.env.ADMIN_PASS === "Qap.1029Qap.1029" ||
      process.env.ADMIN_PASS.length < 16 ||
      !process.env.HUB_MASTER_KEY ||
      process.env.HUB_MASTER_KEY === "nanolabs_governance_supreme_2026" ||
      process.env.HUB_MASTER_KEY.length < 32) {
    throw new Error("Acciones bloqueadas: configurá ADMIN_PASS y HUB_MASTER_KEY seguros, diferentes de los valores predeterminados.");
  }
}
function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const configured = process.env.HUB_PUBLIC_ORIGIN || "https://hub.nanoapps.ar";
  if (!origin) return false;
  const allowed = [configured];
  if (process.env.NODE_ENV !== "production") allowed.push("http://127.0.0.1:3005", "http://localhost:3005");
  return allowed.includes(origin);
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ success: false, error: "Sesión requerida" }, { status: 401, headers: noCache });
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return Response.json({ success: false, error: "Falta slug" }, { status: 400, headers: noCache });
  try {
    return Response.json({ success: true, data: getLifecycleHistory(slug) }, { headers: noCache });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : "No se pudo obtener el historial" },
      { status: 500, headers: noCache });
  }
}

export async function POST(req: Request) {
  let user: string;
  try { user = await requireMutatingSession(req); } catch { return Response.json({success:false,error:"Sesión, permisos o verificación reciente requeridos"},{status:403,headers:noCache}); }
  if (!sameOrigin(req) || !req.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ success: false, error: "Origen o formato de solicitud no permitido" }, { status: 403, headers: noCache });
  }
  try {
    requireEnvironment();
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Operación no habilitada" },
      { status: 503, headers: noCache });
  }
  let body: { slug?: unknown; action?: unknown; confirmation?: unknown; acknowledgeBackup?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "JSON inválido" }, { status: 400, headers: noCache });
  }
  if (typeof body.slug !== "string" || typeof body.action !== "string" ||
      !allowedActions.has(body.action as LifecycleAction) ||
      typeof body.confirmation !== "string" ||
      (body.note !== undefined && typeof body.note !== "string")) {
    return Response.json({ success: false, error: "Parámetros de ciclo de vida inválidos" },
      { status: 400, headers: noCache });
  }
  try {
    const result = await changeLifecycle({
      slug: body.slug, action: body.action as LifecycleAction,
      actor: user, confirmation: body.confirmation,
      acknowledgeBackup: body.acknowledgeBackup === true,
      note: typeof body.note === "string" ? body.note : "",
    });
    return Response.json({ success: true, data: result }, { headers: noCache });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operación fallida";
    console.error("[app lifecycle]", body.slug, body.action, message);
    return Response.json({ success: false, error: message }, {
      status: /ya existe una operación en curso|ya está |ya se encuentra/.test(message) ? 409 : 422,
      headers: noCache,
    });
  }
}
