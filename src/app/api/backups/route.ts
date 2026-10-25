import { getSessionUser } from "@/lib/auth";
import { requireMutatingSession } from "@/lib/action-security";
import { backupEngine, assertBackupSecurity } from "@/lib/backup-service";
import { KNOWN_APPS } from "@/lib/apps-registry";
import { backupRunner } from "@/lib/job-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  if (!await getSessionUser()) return Response.json({success:false,error:"Sesión requerida"},{status:401,headers});
  try {
    const retention=await require("../../../../scripts/history-retention.cjs").createRetentionReport()(KNOWN_APPS).catch(()=>null);
    return Response.json({ success:true, data:backupEngine.list(KNOWN_APPS),
      retention,schedules:backupEngine.schedules(KNOWN_APPS), externalCopies:backupEngine.externalInventory(KNOWN_APPS), scope:"hub-registry", externalNote:"Solo metadatos de archivos externos al registro del Hub; no se verificó su contenido ni restauración." },{headers});
  } catch (error) {
    return Response.json({success:false,error:error instanceof Error?error.message:"No se pudo consultar el historial"},{status:500,headers});
  }
}
export async function POST(req: Request) {
  let actor: string;
  try {actor=await requireMutatingSession(req);}
  catch {return Response.json({success:false,error:"Sesión u origen no autorizado"},{status:403,headers});}
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({success:false,error:"Se requiere JSON"},{status:415,headers});
  }
  try {
    assertBackupSecurity();
    const body=await req.json();
    if(typeof body.slug!=="string"||!KNOWN_APPS.some(a=>a.slug===body.slug)) {
      return Response.json({success:false,error:"App no registrada"},{status:400,headers});
    }
    const result=backupRunner.enqueue(KNOWN_APPS,body.slug,body.requestId,actor);
    return Response.json({success:true,data:{jobId:result.id,state:result.state}},{status:202,headers});
  } catch (error) {
    const msg=error instanceof Error?error.message:"Falló el respaldo";
    console.error("[backup] Falló una operación de respaldo",msg);
    return Response.json({success:false,error:msg},{status:422,headers});
  }
}
