import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifyEdgeSession } from "./lib/session-policy";
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/auth/login" || pathname === "/api/health" ||
      pathname.startsWith("/_next/") || pathname === "/favicon.ico" ||
      // The exact machine endpoint checks its own timing-safe Bearer credential.
      (pathname === "/api/backups/schedule/run" && request.method === "POST")) return NextResponse.next();
  if (await verifyEdgeSession(request.cookies.get(SESSION_COOKIE_NAME)?.value)) return NextResponse.next();
  const headers = { "Cache-Control": "private, no-store" };
  if (pathname.startsWith("/api/")) return NextResponse.json({ success: false, error: "Sesión válida requerida" }, { status: 401, headers });
  const target = new URL("/login", request.url); target.searchParams.set("from", pathname);
  const response = NextResponse.redirect(target); response.headers.set("Cache-Control", headers["Cache-Control"]); return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
