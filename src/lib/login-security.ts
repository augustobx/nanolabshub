import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { getDatabase } from "./db";
export function loginBucket(req: Request): string {
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  return createHash("sha256").update(isIP(ip) ? ip : "unknown").digest("hex");
}
export function limitAuthentication(req: Request, namespace = "login"): string {
  const bucket = namespace + ":" + loginBucket(req);
  if (!getDatabase().allowLoginAttempt(bucket)) throw new Error("RATE_LIMIT");
  return bucket;
}
export function authFailure(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  const status = message === "RATE_LIMIT" ? 429 : error instanceof SyntaxError ? 400 : message === "Solicitud demasiado grande" ? 413 : 503;
  return Response.json({success:false,error:status===429?"Demasiados intentos. Esperá 15 minutos.":status===400?"Formato inválido":status===413?message:"No se pudo procesar el ingreso"},{status,headers:{"Cache-Control":"no-store",...(status===429?{"Retry-After":"900"}:{})}});
}
