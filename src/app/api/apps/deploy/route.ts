import { getPrincipal } from "@/lib/auth";
import { requireMutatingPrincipal } from "@/lib/action-security";
import { limitedText } from "@/lib/request-body";
import { releaseService } from "@/lib/release-service";
import { backupRunner } from "@/lib/job-service";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
 const p=await getPrincipal();if(!p?.mfaReady||p.role!=="owner")return Response.json({success:false,error:"Propietario con MFA requerido"},{status:403,headers});
 try{return Response.json({success:true,data:await releaseService.plan()},{headers});}
 catch(error){return Response.json({success:false,error:error instanceof Error?error.message:"Despliegue no disponible"},{status:503,headers});}
}
export async function POST(req:Request){
 try{
  const p=await requireMutatingPrincipal(req);if(p.role!=="owner")throw Error("Solo el propietario puede desplegar el Hub");
  const body=JSON.parse(await limitedText(req,4096));if(body.slug!=="nanolabshub")throw Error("Solo está habilitado el despliegue del Hub");
  const plan=await releaseService.plan();if(!plan.ready||!plan.releases.some(r=>r.id===body.releaseId&&r.available))throw Error("La versión, el worker o la configuración no están listos");
  const job=releaseService.enqueue(backupRunner.store,body.releaseId,body.requestId,p.username);
  return Response.json({success:true,data:{id:job.id,state:job.state}},{status:202,headers});
 }catch(error){return Response.json({success:false,error:error instanceof Error?error.message:"Despliegue rechazado"},{status:403,headers});}
}
