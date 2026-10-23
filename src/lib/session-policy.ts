// Shared by Node routes and Edge middleware; no Node-only imports.
export const SESSION_COOKIE_NAME = "nanolabs_hub_session";
export function authConfiguration() {
  const secret = process.env.HUB_MASTER_KEY || "", password = process.env.ADMIN_PASS || "";
  const username = process.env.ADMIN_USER || "augusto";
  return { secret, password, username, secure: secret.length >= 32 && password.length >= 16 &&
    secret !== "nanolabs_governance_supreme_2026" && password !== "Qap.1029Qap.1029" };
}
export function parseSession(token: string | undefined) {
  if (!token || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1])) return null;
  try {
    const decoded = atob(parts[0].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(decoded, c => c.charCodeAt(0)));
    const separator = payload.lastIndexOf(":"), username = payload.slice(0, separator), expiry = payload.slice(separator + 1);
    if (separator < 1 || !/^\d{13}$/.test(expiry)) return null;
    const expiresAt = Number(expiry), now = Date.now();
    if (expiresAt <= now || expiresAt > now + 7 * 86400000 + 60000 || username !== authConfiguration().username) return null;
    return { payload, username, signature: parts[1] };
  } catch { return null; }
}
export async function verifyEdgeSession(token: string | undefined): Promise<boolean> {
  const cfg = authConfiguration(), parsed = parseSession(token);
  if (!cfg.secure || !parsed) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(cfg.secret + "\n" + cfg.password), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, Uint8Array.from(parsed.signature.match(/../g)!, n => parseInt(n, 16)), new TextEncoder().encode(parsed.payload));
}
