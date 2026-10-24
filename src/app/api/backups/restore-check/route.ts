import { getSessionUser } from "@/lib/auth";
import { requireMutatingSession } from "@/lib/action-security";
import { assertBackupSecurity } from "@/lib/backup-service";
import { recoveryEngine } from "@/lib/recovery-service";
import { KNOWN_APPS } from "@/lib/apps-registry";
import { recoveryRunner } from "@/lib/job-service";
import { limitedText } from "@/lib/request-body";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noCache={"Cache-Control":"private, no-store"};
export async function GET() {
  if(!await getSessionUser())return Response.json({success:false,error:"Sesión requerida"},{status:401,headers:noCache});
  try{
    assertBackupSecurity();
    return Response.json({success:true,data:recoveryEngine.listChecks()}, {headers:noCache});
  }catch(e){return Response.json({success:false,error:e instanceof Error?e.message:"No se pudo leer el historial"},{status:503,headers:noCache});}
}
export async function POST(req:Request){
  let actor:string;
  try{actor=await requireMutatingSession(req);}
  catch{return Response.json({success:false,error:"Origen o sesión no autorizado"},{status:403,headers:noCache});}
  try{
    assertBackupSecurity();
    if(!req.headers.get("content-type")?.startsWith("application/json"))throw Error("Se requiere JSON");
    const body=JSON.parse(await limitedText(req,4096));
    if(typeof body?.backupId!=="string")throw Error("Falta ID de respaldo");
    const result=recoveryRunner.enqueue(KNOWN_APPS,body.backupId,body.requestId,actor);
    return Response.json({success:true,data:{jobId:result.id,state:result.state}},{status:202,headers:noCache});
  }catch(e){
    const msg=e instanceof Error?e.message:"Error de comprobación";
    console.error("[restore-check] Error de validación aislada:",msg.slice(0,180));
    return Response.json({success:false,error:msg},{status:422,headers:noCache});
  }
}
