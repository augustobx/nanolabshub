import { getPrincipal } from "@/lib/auth";
import { requireMutatingPrincipal } from "@/lib/action-security";
import { authorizeResource } from "@/lib/authorization-policy";
import { backupRunner } from "@/lib/job-service";
import { KNOWN_APPS } from "@/lib/apps-registry";
import { limitedText } from "@/lib/request-body";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){const p=await getPrincipal();if(!p?.mfaReady)return Response.json({success:false,error:"Sesión requerida"},{status:401,headers});return Response.json({success:true,data:backupRunner.store.list().filter(j=>p.role==="owner"||p.scopes.includes(j.resource))},{headers});}
export async function POST(req:Request){
  try{
    const p=await requireMutatingPrincipal(req),body=JSON.parse(await limitedText(req,4096)),job=backupRunner.store.get(body.id);
    if(!job||job.kind!=="backup")throw Error("Trabajo no registrado");authorizeResource(p,job.resource);
    if(body.operation==="retry")backupRunner.store.retry(job.id,p.username);
    else if(body.operation==="cancel")backupRunner.store.cancel(job.id,p.username);
    else if(body.operation==="reconcile")await backupRunner.reconcile(KNOWN_APPS,job.id);
    else throw Error("Operación desconocida");
    return Response.json({success:true,data:{id:job.id,state:backupRunner.store.get(job.id)?.state}},{headers});
  }catch(error){return Response.json({success:false,error:error instanceof Error?error.message:"No se pudo actualizar el trabajo"},{status:403,headers});}
}
