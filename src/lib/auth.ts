import path from "node:path";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "nanolabs_hub_session";
export interface Principal {
  userId: string; username: string; role: "owner" | "operator" | "viewer";
  scopes: string[]; sessionId: string; authenticatedAt: number; mfaReady: boolean;
  enrollmentRequired: boolean; expiresAt: number;
}
interface LoginResult { token?: string; enrollmentRequired?: boolean; challenge?: string; mfaRequired?: boolean }
export const identity = require("../../scripts/hub-identity.cjs").createIdentityStore({
  dataDir: process.env.DATA_DIR || path.join(process.cwd(), "data"),
  masterKey: process.env.HUB_MASTER_KEY || "",
  bootstrapUser: process.env.ADMIN_USER || "augusto",
  bootstrapPassword: process.env.ADMIN_PASS || "",
}) as {
  login(user: string, password: string): LoginResult | null;
  completeLogin(challenge: string, code: string): LoginResult | null;
  principal(token?: string): Principal | null;
  touch(token: string): Principal | null;
  beginEnrollment(token: string, password?: string, code?: string): { secret: string; uri: string };
  confirmEnrollment(token: string, code: string): LoginResult & { recoveryCodes: string[] };
  listSessions(token: string): Array<{ id:string; createdAt:number; lastSeen:number; expiresAt:number; revokedAt:number|null; current:boolean }>;
  revoke(token: string, id?: string, all?: boolean): void;
  reauthenticate(token: string, password: string, code: string): LoginResult | null;
  listUsers(token: string): Array<{id:string;username:string;role:string;scopes:string[];active:boolean;mfaReady:boolean}>;
  saveUser(token: string, input: unknown): { id: string };
  changePassword(token: string, currentPassword: string, newPassword: string): void;
  securitySummary(): { activeUsers: number; activeOwners: number; mfaUsers: number };
};
export function verifySessionToken(token?: string): { valid: boolean; user?: string; principal?: Principal } {
  const p = identity.principal(token);
  return p ? { valid: true, user: p.username, principal: p } : { valid: false };
}
export async function getSessionToken(): Promise<string> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value || "";
}
export async function getPrincipal(): Promise<Principal | null> {
  return identity.principal(await getSessionToken());
}
export async function getSessionUser(): Promise<string | null> {
  const p = await getPrincipal();
  return p?.mfaReady ? p.username : null;
}
export function sessionCookie(token: string, maxAge = 12 * 3600): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; ${process.env.NODE_ENV === "production" ? "Secure;" : ""}`;
}
