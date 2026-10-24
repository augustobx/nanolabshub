import { getPrincipal, getSessionToken, identity, sessionCookie } from "@/lib/auth";
import { requireMutatingPrincipal } from "@/lib/action-security";
import { limitAuthentication } from "@/lib/login-security";
import { limitedText } from "@/lib/request-body";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store"};
export async function GET() {
  const p = await getPrincipal();
  if(!p)return Response.json({success:false,error:"Sesión requerida"},{status:401,headers});
  return Response.json({success:true,data:{...p,sessions:identity.listSessions(await getSessionToken())}},{headers});
}
export async function POST(req: Request) {
  try {
    await requireMutatingPrincipal(req);
    const token = await getSessionToken(), body = JSON.parse(await limitedText(req,8192));
    if(body.operation!=="session.touch")limitAuthentication(req,"account");
    let data: unknown, cookie: string | undefined;
    switch(body.operation){
      case "session.touch": data={active:true};break;
      case "mfa.begin": data=identity.beginEnrollment(token,body.password,body.code); break;
      case "mfa.confirm": {
        const result=identity.confirmEnrollment(token,body.code); cookie=sessionCookie(result.token!); data={recoveryCodes:result.recoveryCodes}; break;
      }
      case "session.revoke": identity.revoke(token,body.sessionId,body.all===true); data={revoked:true}; break;
      case "session.verify": {
        const result=identity.reauthenticate(token,body.password,body.code);
        if(!result?.token)throw Error("Contraseña o segundo factor incorrecto");
        cookie=sessionCookie(result.token); data={verified:true};break;
      }
      case "password.change": identity.changePassword(token,body.currentPassword,body.newPassword); cookie=sessionCookie("",0);data={signInRequired:true};break;
      default: throw Error("Operación desconocida");
    }
    return Response.json({success:true,data},{headers:{...headers,...(cookie?{"Set-Cookie":cookie}:{})}});
  }catch(error){
    const message=error instanceof Error?error.message:"Error de cuenta";
    return Response.json({success:false,error:message==="RATE_LIMIT"?"Demasiados intentos. Esperá 15 minutos.":message},{status:message==="RATE_LIMIT"?429:403,headers});
  }
}
