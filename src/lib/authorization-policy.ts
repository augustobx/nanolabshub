import type { Principal } from "./auth";
import { KNOWN_APPS } from "./apps-registry";
import { assertProductMutable } from "./operational-policy";

const mutableApps = new Set(["nanolabshub", "onlyfood", "onlygym", "onlyturn"]);
export function authorizeRequest(principal: Principal, pathname: string, method: string): boolean {
  if (pathname === "/account" || pathname === "/api/auth/account" || pathname === "/api/auth/logout") return true;
  if (!principal.mfaReady) return false;
  if (pathname === "/api/auth/users") return principal.role === "owner";
  if (method === "GET" || method === "HEAD") {
    if (pathname.startsWith("/api/apps/logs") || pathname === "/api/backups/download") return principal.role !== "viewer";
    return true;
  }
  if (principal.role === "viewer") return false;
  const operatorRoutes = ["/api/apps/restart", "/api/apps/lifecycle", "/api/backups", "/api/backups/schedule", "/api/backups/restore-check", "/api/backups/import", "/api/jobs"];
  return principal.role === "owner" || operatorRoutes.includes(pathname) || /^\/api\/saas-management\/(onlyfood|onlygym|onlyturn)$/.test(pathname);
}
export function authorizeResource(principal: Principal, slug: string, mutate = true): void {
  if (mutate) {
    assertProductMutable(slug);
    if (!mutableApps.has(slug)) throw Error("Aplicación fuera del alcance habilitado");
    if (principal.role === "viewer") throw Error("El rol de consulta no permite cambios");
  }
  if (principal.role !== "owner" && !principal.scopes.includes(slug)) throw Error("No tenés permiso sobre esta aplicación");
}
export function appForContainer(name: unknown): string {
  if (typeof name !== "string") throw Error("Contenedor inválido");
  const app = KNOWN_APPS.find(a => a.containerNames.includes(name));
  if (!app) throw Error("Contenedor no registrado");
  return app.slug;
}
