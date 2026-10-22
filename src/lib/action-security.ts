import { getSessionUser } from "@/lib/auth";

export async function requireMutatingSession(req: Request) {
  const user = await getSessionUser();
  if (!user) throw new Error("Sesión requerida");
  const origin = req.headers.get("origin");
  const allowed = [process.env.HUB_PUBLIC_ORIGIN || "https://hub.nanoapps.ar"];
  if (process.env.NODE_ENV !== "production") {
    allowed.push("http://127.0.0.1:3005", "http://localhost:3005");
  }
  if (!origin || !allowed.includes(origin)) throw new Error("Origen de solicitud no permitido");
  return user;
}
