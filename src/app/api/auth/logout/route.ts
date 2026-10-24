import { identity, getSessionToken, sessionCookie } from "@/lib/auth";
import { requireMutatingSession } from "@/lib/action-security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try { await requireMutatingSession(req); } catch { return Response.json({ success: false, error: "Origen o sesión no autorizado" }, { status: 403 }); }
  identity.revoke(await getSessionToken());
  const response = Response.json({ success: true });
  response.headers.set(
    "Set-Cookie",
    sessionCookie("", 0)
  );
  return response;
}
