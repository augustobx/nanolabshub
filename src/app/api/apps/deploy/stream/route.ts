import { requireMutatingSession } from "@/lib/action-security";
import { assertDeploymentAllowed } from "@/lib/operational-policy";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try { await requireMutatingSession(req); } catch { return Response.json({ success:false,error:"Sesión u origen no autorizado" },{status:403}); }
  try { assertDeploymentAllowed(); } catch(e) { return Response.json({success:false,error:(e as Error).message},{status:503,headers:{"Cache-Control":"no-store"}}); }
}
