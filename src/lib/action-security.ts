import { getPrincipal, getSessionToken, identity, type Principal } from "@/lib/auth";
import { authorizeRequest, authorizeResource, appForContainer } from "./authorization-policy";
import { limitedText } from "./request-body";
import { getDatabase } from "./db";
export function assertSameOrigin(req: Request): void {
  const allowed = [process.env.HUB_PUBLIC_ORIGIN || "https://hub.nanoapps.ar"];
  if (process.env.NODE_ENV !== "production") allowed.push("http://127.0.0.1:3005", "http://localhost:3005");
  if (!req.headers.get("origin") || !allowed.includes(req.headers.get("origin")!)) throw new Error("Origen de solicitud no permitido");
}
export async function requireMutatingPrincipal(req: Request): Promise<Principal> {
  assertSameOrigin(req);
  const p = await getPrincipal(), pathname = new URL(req.url).pathname;
  if (!p || !authorizeRequest(p, pathname, req.method)) throw new Error("Sesión o permisos requeridos");
  if (!pathname.startsWith("/api/auth/") && p.authenticatedAt + 10 * 60000 <= Date.now()) throw new Error("Volvé a verificar tu identidad desde Mi cuenta");
  if (/^\/api\/saas-management\//.test(pathname)) authorizeResource(p, pathname.split("/").at(-1)!);
  else if (["/api/apps/restart", "/api/apps/lifecycle", "/api/apps/deploy", "/api/apps/deploy/stream", "/api/backups", "/api/backups/schedule", "/api/backups/restore-check"].includes(pathname)) {
    const body = JSON.parse(await limitedText(req.clone()));
    const slug = pathname === "/api/apps/restart" ? appForContainer(body.containerName) : pathname === "/api/backups/restore-check" ? getDatabase().getBackupSlug(body.backupId) : body.slug;
    if (typeof slug !== "string") throw Error("Aplicación o respaldo no registrado");
    authorizeResource(p, slug);
  }
  if(!identity.touch(await getSessionToken()))throw Error("Sesión revocada o vencida");
  return p;
}
export async function requireMutatingSession(req: Request): Promise<string> {
  return (await requireMutatingPrincipal(req)).username;
}
export async function requireResourceRead(req: Request): Promise<Principal> {
  const p = await getPrincipal(), url = new URL(req.url);
  if (!p || !authorizeRequest(p,url.pathname,"GET")) throw Error("Sesión o permisos requeridos");
  const slug = url.pathname === "/api/backups/download" ? getDatabase().getBackupSlug(url.searchParams.get("id") || "") : appForContainer(url.searchParams.get("container"));
  if (!slug) throw Error("Recurso no registrado");
  authorizeResource(p,slug,false);
  return p;
}
