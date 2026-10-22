import { backupEngine, assertBackupSecurity } from "@/lib/backup-service";
import { KNOWN_APPS } from "@/lib/apps-registry";
import { requireMutatingSession } from "@/lib/action-security";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function POST(req: Request) {
  let actor;
  try { actor=await requireMutatingSession(req); }
  catch { return Response.json({success:false,error:"No autorizado"},{status:403}); }
  try {
    assertBackupSecurity();
    const body=await req.json();
    backupEngine.schedule(KNOWN_APPS,body.slug,body.config,actor);
    return Response.json({success:true,data:backupEngine.schedules(KNOWN_APPS)});
  } catch(error) {
    return Response.json({success:false,error:error instanceof Error?error.message:"Error"},{status:422});
  }
}
