import { validateCredentials, createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return Response.json({ success: false, error: "Usuario y contraseña requeridos" }, { status: 400 });
    }

    if (!validateCredentials(username, password)) {
      return Response.json({ success: false, error: "Credenciales de acceso incorrectas" }, { status: 401 });
    }

    const token = createSessionToken(username);

    // Audit log
    try {
      getDatabase().logAudit(username, "LOGIN_SUCCESS", "AUTH", "Inicio de sesión maestro exitoso");
    } catch {}

    const response = Response.json({
      success: true,
      data: { username },
    });

    response.headers.set(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; ${
        process.env.NODE_ENV === "production" ? "Secure;" : ""
      }`
    );

    return response;
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
