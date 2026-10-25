import { getPrincipal } from "@/lib/auth";
import { requireMutatingPrincipal } from "@/lib/action-security";
import { authorizeResource } from "@/lib/authorization-policy";
import { backupRunner, recoveryRunner, importRunner } from "@/lib/job-service";
import { KNOWN_APPS } from "@/lib/apps-registry";
import { limitedText } from "@/lib/request-body";
import { releaseService } from "@/lib/release-service";
import { maintenanceService } from "@/lib/maintenance-service";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){const p=await getPrincipal();if(!p?.mfaReady)return Response.json({success:false,error:"Sesión requerida"},{status:401,headers});return Response.json({success:true,data:backupRunner.store.list().filter(j=>p.role==="owner"||p.scopes.includes(j.resource))},{headers});}
export async function POST(req:Request){
  try{
    const p=await requireMutatingPrincipal(req),body=JSON.parse(await limitedText(req,4096)),job=backupRunner.store.get(body.id);
    if(!job||!["backup","restore","backup-import","release","maintenance"].includes(job.kind))throw Error("Trabajo no registrado");authorizeResource(p,job.resource);
    if(["release","maintenance"].includes(job.kind)&&p.role!=="owner")throw Error("Solo el propietario puede gestionar despliegues y mantenimiento");
    if(body.operation==="retry"&&["release","maintenance"].includes(job.kind))throw Error("Revisá la selección y registrá una nueva solicitud desde Software o Hardware");
    if(body.operation==="retry")backupRunner.store.retry(job.id,p.username);
    else if(body.operation==="cancel")backupRunner.store.cancel(job.id,p.username);
    else if(body.operation==="reconcile"&&job.kind==="release")await releaseService.reconcile(backupRunner.store,job.id);
    else if(body.operation==="reconcile"&&job.kind==="maintenance")await maintenanceService.reconcile(job);
    else if(body.operation==="reconcile")await (job.kind==="restore"?recoveryRunner:job.kind==="backup-import"?importRunner:backupRunner).reconcile(KNOWN_APPS,job.id);
    else throw Error("Operación desconocida");
    return Response.json({success:true,data:{id:job.id,state:backupRunner.store.get(job.id)?.state}},{headers});
  }catch(error){return Response.json({success:false,error:error instanceof Error?error.message:"No se pudo actualizar el trabajo"},{status:403,headers});}
}
