import { validateCredentials, createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { limitedText } from "@/lib/request-body";
import { createHash } from "node:crypto";
import { isIP } from "node:net";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let username = "";
    let password = "";

    const contentType = req.headers.get("content-type") || "";
    const text = await limitedText(req, 4096);

    if (contentType.includes("application/json")) {
      const body = JSON.parse(text);
      username = body?.username || "";
      password = body?.password || "";
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = new URLSearchParams(text);
      username = (formData.get("username") as string) || "";
      password = (formData.get("password") as string) || "";
    } else {
      try {
        const parsed = JSON.parse(text);
        username = parsed.username || "";
        password = parsed.password || "";
      } catch {
        // Fallback
      }
    }

    if (typeof username !== "string" || typeof password !== "string" || !username || !password || username.length > 120 || password.length > 1024) {
      return Response.json({ success: false, error: "Usuario y contraseña requeridos" }, { status: 400 });
    }

    const rawIp = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const ip = isIP(rawIp) ? rawIp : "unknown";
    const bucket = createHash("sha256").update(ip).digest("hex");
    const db = getDatabase();
    if (!db.allowLoginAttempt(bucket)) return Response.json({ success: false, error: "Demasiados intentos. Esperá 15 minutos." }, { status: 429, headers: { "Retry-After": "900", "Cache-Control": "no-store" } });
    if (!validateCredentials(username, password)) {
      return Response.json({ success: false, error: "Credenciales de acceso incorrectas" }, { status: 401 });
    }

    db.resetLoginAttempts(bucket);
    const token = createSessionToken(username.trim());

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
    const status = error instanceof SyntaxError ? 400 : error?.message === "Solicitud demasiado grande" ? 413 : 503;
    return Response.json({ success: false, error: status===400?"Formato inválido":status===413?"Solicitud demasiado grande":"No se pudo procesar el ingreso" }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
