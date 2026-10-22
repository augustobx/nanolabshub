import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("nanolabs_hub_session")?.value;

  // Basic check for presence and structure
  if (!sessionCookie || !sessionCookie.includes(".")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Autenticación requerida para acceder al Governance" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token expiration quick check
  try {
    const [encoded] = sessionCookie.split(".");
    const decoded = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const [, expiresStr] = decoded.split(":");
    const expiresAt = parseInt(expiresStr, 10);
    if (Date.now() > expiresAt) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ success: false, error: "Sesión expirada" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
