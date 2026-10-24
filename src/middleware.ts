import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./lib/auth";
import { authorizeRequest } from "./lib/authorization-policy";
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/auth/login" || pathname === "/api/auth/mfa" || pathname === "/api/health" ||
      pathname.startsWith("/_next/") || pathname === "/favicon.ico" ||
      // The exact machine endpoint checks its own timing-safe Bearer credential.
      (pathname === "/api/backups/schedule/run" && request.method === "POST")) return NextResponse.next();
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (session.valid && session.principal) {
      if (authorizeRequest(session.principal, pathname, request.method)) return NextResponse.next();
      if (!pathname.startsWith("/api/") && session.principal.enrollmentRequired) return NextResponse.redirect(new URL("/account", request.url));
      return NextResponse.json({ success: false, error: "No tenés permiso o debés completar el segundo factor" }, { status: 403, headers });
    }
  } catch { return NextResponse.json({ success:false,error:"No se pudo comprobar la sesión" }, { status:503,headers }); }
  if (pathname.startsWith("/api/")) return NextResponse.json({ success: false, error: "Sesión válida requerida" }, { status: 401, headers });
  const target = new URL("/login", request.url); target.searchParams.set("from", pathname);
  const response = NextResponse.redirect(target); response.headers.set("Cache-Control", headers["Cache-Control"]); return response;
}
export const config = { runtime: "nodejs", matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
