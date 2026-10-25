import { getPrincipal } from "@/lib/auth";
import { requireMutatingPrincipal } from "@/lib/action-security";
import { limitedText } from "@/lib/request-body";
import { maintenanceService } from "@/lib/maintenance-service";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){const p=await getPrincipal();if(!p?.mfaReady||p.role!=="owner")return Response.json({success:false,error:"Propietario con MFA requerido"},{status:403,headers});try{return Response.json({success:true,data:await maintenanceService.preview()},{headers});}catch(error){return Response.json({success:false,error:error instanceof Error?error.message:"Mantenimiento no disponible"},{status:503,headers});}}
export async function POST(req:Request){try{const p=await requireMutatingPrincipal(req);if(p.role!=="owner")throw Error("Solo el propietario puede retirar imágenes del Hub");const body=JSON.parse(await limitedText(req,8192)),job=await maintenanceService.enqueue(body.imageIds,body.requestId,body.confirmation,p.username);return Response.json({success:true,data:{id:job.id,state:job.state}},{status:202,headers});}catch(error){return Response.json({success:false,error:error instanceof Error?error.message:"Mantenimiento rechazado"},{status:403,headers});}}
