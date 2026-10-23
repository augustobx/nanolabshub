import { backupEngine, assertBackupSecurity } from "@/lib/backup-service";
import { KNOWN_APPS } from "@/lib/apps-registry";
import { timingSafeEqual } from "node:crypto";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function POST(req: Request) {
  const key=process.env.HUB_BACKUP_SCHEDULER_KEY||"";
  const candidate=(req.headers.get("authorization")||"").replace(/^Bearer /,"");
  const keyBytes=Buffer.from(key);
  const candidateBytes=Buffer.from(candidate);
  if(keyBytes.length<32 || candidateBytes.length!==keyBytes.length ||
    !timingSafeEqual(keyBytes,candidateBytes)) {
    return Response.json({success:false,error:"No autorizado"},{status:403});
  }
  try {
    assertBackupSecurity();
    return Response.json({success:true,data:await backupEngine.tick(KNOWN_APPS)});
  } catch(error) {
    console.error("[scheduler]",error);
    return Response.json({success:false,error:"Error ejecutando tareas programadas"},{status:503});
  }
}
