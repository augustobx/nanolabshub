import { getPrincipal, getSessionToken, identity } from "@/lib/auth";
import { requireMutatingPrincipal } from "@/lib/action-security";
import { limitedText } from "@/lib/request-body";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store"};
export async function GET() {
  const p=await getPrincipal();
  if(!p?.mfaReady||p.role!=="owner")return Response.json({success:false,error:"Permiso de propietario requerido"},{status:403,headers});
  return Response.json({success:true,data:identity.listUsers(await getSessionToken())},{headers});
}
export async function POST(req: Request) {
  try{
    const p=await requireMutatingPrincipal(req);
    if(!p.mfaReady||p.role!=="owner")throw Error("Permiso de propietario requerido");
    return Response.json({success:true,data:identity.saveUser(await getSessionToken(),JSON.parse(await limitedText(req,8192)))},{headers});
  }catch(error){return Response.json({success:false,error:error instanceof Error?error.message:"No se pudo guardar el usuario"},{status:403,headers});}
}
