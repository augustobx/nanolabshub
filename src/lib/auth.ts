import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SECRET = process.env.HUB_MASTER_KEY || "";
const ADMIN_USER = process.env.ADMIN_USER || "augusto";
const ADMIN_PASS = process.env.ADMIN_PASS || "";
export const SESSION_COOKIE_NAME = "nanolabs_hub_session";
const secureConfig = () => SECRET.length >= 32 && ADMIN_PASS.length >= 16 &&
  SECRET !== "nanolabs_governance_supreme_2026" && ADMIN_PASS !== "Qap.1029Qap.1029";

/**
 * Creates a signed token for user session
 */
export function createSessionToken(username: string): string {
  if (!secureConfig()) throw new Error("Seguridad de acceso Hub no configurada");
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
  const payload = `${username}:${expiresAt}`;
  const signature = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

/**
 * Verifies a session token
 */
export function verifySessionToken(token: string | undefined): { valid: boolean; user?: string } {
  if (!secureConfig()) return { valid: false };
  if (!token) return { valid: false };

  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false };

  const [encodedPayload, signature] = parts;
  try {
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf-8");
    const [username, expiresStr] = payload.split(":");
    const expiresAt = parseInt(expiresStr, 10);

    if (Date.now() > expiresAt) return { valid: false };

    const expectedSig = createHmac("sha256", SECRET).update(payload).digest("hex");
    const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    if (valid) {
      return { valid: true, user: username };
    }
  } catch {
    return { valid: false };
  }

  return { valid: false };
}

/**
 * Validates master login credentials
 */
export function validateCredentials(user: string, pass: string): boolean {
  return secureConfig() && user.trim() === ADMIN_USER && pass.trim() === ADMIN_PASS;
}

/**
 * Gets current authenticated user from cookies (for Server Components/APIs)
 */
export async function getSessionUser(): Promise<string | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const result = verifySessionToken(token);
  return result.valid && result.user ? result.user : null;
}
