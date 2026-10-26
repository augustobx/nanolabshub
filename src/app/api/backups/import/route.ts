import { getPrincipal } from "@/lib/auth";
import { requireMutatingPrincipal } from "@/lib/action-security";
import { assertBackupSecurity } from "@/lib/backup-service";
import { backupImporter, importRunner } from "@/lib/job-service";
import { KNOWN_APPS } from "@/lib/apps-registry";
import { limitedText } from "@/lib/request-body";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
 const p=await getPrincipal();
 if(!p?.mfaReady||p.role==="viewer")return Response.json({success:false,error:"Permisos de administración requeridos"},{status:403,headers});
 try{
  assertBackupSecurity();
  const slugs=p.role==="owner"?["nanolabshub","onlyfood","onlygym","onlyturn","onlycars","onlyerp"]:p.scopes;
  return Response.json({success:true,data:backupImporter.candidates(KNOWN_APPS,slugs)},{headers});
 }catch{return Response.json({success:false,error:"No se pudo leer el inventario de importación"},{status:503,headers});}
}
export async function POST(req:Request){
 let p;
 try{p=await requireMutatingPrincipal(req);}catch{return Response.json({success:false,error:"Sesión, origen o alcance no autorizado"},{status:403,headers});}
 try{
  assertBackupSecurity();
  if(!req.headers.get("content-type")?.startsWith("application/json"))throw Error("Se requiere JSON");
  const body=JSON.parse(await limitedText(req,4096));
  const job=importRunner.enqueue(KNOWN_APPS,body.slug,body.filename,body.requestId,p.username);
  return Response.json({success:true,data:{jobId:job.id,state:job.state}},{status:202,headers});
 }catch(error){return Response.json({success:false,error:error instanceof Error?error.message:"No se pudo solicitar la importación"},{status:422,headers});}
}
