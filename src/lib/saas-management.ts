import { createHmac } from "node:crypto";
import { SAAS_PRODUCTS } from "./product-taxonomy";
import type { ManagedSaaS, ManagementCommand } from "./saas-management-types";

const products = new Set(["onlygym", "onlyturn", "onlyfood"]);
const operations = new Set(["tenant.create", "tenant.update", "tenant.status", "subscription.update", "subscription.renew", "module.set", "admin.update", "admin.revoke", "plan.create", "plan.update", "payment.record", "payment.status"]);
export class SaaSManagementError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function isManagementEnabled(product: string): product is ManagedSaaS {
  return products.has(product) && (process.env.HUB_SAAS_MANAGEMENT_PRODUCTS || "").split(",").map(s => s.trim()).includes(product) &&
    Buffer.byteLength(process.env["HUB_MANAGEMENT_" + product.toUpperCase() + "_TOKEN"] || "") >= 32;
}
export async function callSaaSManagement(product: string, actor: string, query: URLSearchParams, command?: ManagementCommand): Promise<unknown> {
  if (!products.has(product)) throw new SaaSManagementError(403, "PROTECTED_PRODUCT", "La gestión central está limitada a los productos autorizados.");
  if (command?.operation === "payment.status" && product !== "onlyfood") throw new SaaSManagementError(400, "COMMAND", "Operación no disponible para este producto.");
  if (!isManagementEnabled(product)) throw new SaaSManagementError(503, "DISABLED", "Gestión central no configurada para este producto.");
  if (!/^[a-zA-Z0-9@._:+-]{1,120}$/.test(actor)) throw new SaaSManagementError(403, "ACTOR", "Identidad administrativa inválida.");
  if (command && (!operations.has(command.operation) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(command.requestId))) throw new SaaSManagementError(400, "COMMAND", "Solicitud de gestión inválida.");
  const selected = SAAS_PRODUCTS.find(p => p.slug === product)!;
  // Destinations are fixed in the registry, never supplied by a browser or tenant.
  const suffix = query.toString(), path = "/api/integrations/nanolabs/management" + (suffix ? "?" + suffix : "");
  const key = process.env["HUB_MANAGEMENT_" + product.toUpperCase() + "_TOKEN"]!;
  const timestamp = String(Date.now()), method = command ? "POST" : "GET";
  const body = command ? JSON.stringify({ requestId: command.requestId, actor, operation: command.operation, input: command.input }) : "";
  if (Buffer.byteLength(body) > 32768) throw new SaaSManagementError(413, "BODY_LIMIT", "La solicitud supera el límite permitido.");
  const signature = createHmac("sha256", key).update([timestamp, method, path, actor, body].join("\n")).digest("hex");
  let response: Response;
  try {
    response = await fetch("https://" + selected.domain + path, { method, headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", Accept: "application/json", "User-Agent": "NanoLabsHub/2", "X-NanoLabs-Timestamp": timestamp, "X-NanoLabs-Actor": actor, "X-NanoLabs-Signature": signature }, ...(command ? { body } : {}), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(25000) });
  } catch { throw new SaaSManagementError(502, "CONNECTION", "No se confirmó la respuesta de la plataforma. Podés reintentar la misma solicitud."); }
  let wire: { success?: boolean; contract?: string; product?: string; data?: unknown; error?: unknown; code?: unknown; requestId?: string };
  try { wire = await response.json(); } catch { throw new SaaSManagementError(502, "CONTRACT", "La plataforma devolvió una respuesta inválida."); }
  if (!response.ok || wire.success !== true) {
    const allowed = new Set(["STALE_VERSION", "IDEMPOTENCY_CONFLICT", "PAYMENT_DUPLICATE", "INVALID_PERIOD", "SUBSCRIPTION", "PLAN", "MODULE", "SHARED_ACCOUNT", "CONFLICT", "NOT_FOUND", "INVALID_INPUT", "RESERVED_SLUG", "PLAN_FEATURES", "ADMIN"]);
    const code = typeof wire.code === "string" ? wire.code : "UNAVAILABLE";
    const message = allowed.has(code) && typeof wire.error === "string" ? wire.error.slice(0, 250) : "La operación no pudo completarse en la plataforma.";
    throw new SaaSManagementError([400, 403, 404, 409, 413, 415, 422].includes(response.status) ? response.status : 502, code, message);
  }
  if (wire.contract !== "nanolabs.saas.management.v1" || wire.product !== product || !wire.data || typeof wire.data !== "object" || (command && wire.requestId !== command.requestId)) throw new SaaSManagementError(502, "CONTRACT", "El contrato de gestión no coincide con el producto.");
  return wire.data;
}

