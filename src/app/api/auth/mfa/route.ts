import { identity, sessionCookie } from "@/lib/auth";
import { limitedText } from "@/lib/request-body";
import { authFailure, limitAuthentication } from "@/lib/login-security";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    limitAuthentication(req,"mfa");
    const body = JSON.parse(await limitedText(req,4096));
    const result = identity.completeLogin(body.challenge,body.code);
    if(!result?.token)return Response.json({success:false,error:"Código incorrecto o solicitud vencida"},{status:401,headers:{"Cache-Control":"no-store"}});
    return Response.json({success:true},{headers:{"Cache-Control":"no-store","Set-Cookie":sessionCookie(result.token)}});
  }catch(error){return authFailure(error);}
}
