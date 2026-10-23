import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { requireMutatingSession } from "@/lib/action-security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try { await requireMutatingSession(req); } catch { return Response.json({ success: false, error: "Origen o sesión no autorizado" }, { status: 403 }); }
  const response = Response.json({ success: true });
  response.headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; ${
      process.env.NODE_ENV === "production" ? "Secure;" : ""
    }`
  );
  return response;
}
