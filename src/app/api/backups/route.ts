import { getSessionUser } from "@/lib/auth";
import { requireMutatingSession } from "@/lib/action-security";
import { backupEngine } from "@/lib/backup-service";
import { KNOWN_APPS } from "@/lib/apps-registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  if (!await getSessionUser()) return Response.json({success:false,error:"Sesión requerida"},{status:401,headers});
  try {
    return Response.json({ success:true, data:backupEngine.list(KNOWN_APPS),
      schedules:backupEngine.schedules(KNOWN_APPS) },{headers});
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
    const body=await req.json();
    if(typeof body.slug!=="string"||!KNOWN_APPS.some(a=>a.slug===body.slug)) {
      return Response.json({success:false,error:"App no registrada"},{status:400,headers});
    }
    const result=await backupEngine.createBackup(KNOWN_APPS,body.slug,"manual",actor);
    return Response.json({success:true,data:result},{headers});
  } catch (error) {
    const msg=error instanceof Error?error.message:"Falló el respaldo";
    console.error("[backup] Falló una operación de respaldo",msg);
    return Response.json({success:false,error:msg},{status:422,headers});
  }
}
