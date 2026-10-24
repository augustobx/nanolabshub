import { identity, sessionCookie } from "@/lib/auth";
import { limitedText } from "@/lib/request-body";
import { authFailure, limitAuthentication } from "@/lib/login-security";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    limitAuthentication(req);
    const text = await limitedText(req,4096);
    const body = req.headers.get("content-type")?.includes("application/x-www-form-urlencoded") ? Object.fromEntries(new URLSearchParams(text)) : JSON.parse(text);
    if(typeof body.username!=="string"||typeof body.password!=="string"||!body.username||body.username.length>120||body.password.length>1024) return Response.json({success:false,error:"Usuario y contraseña requeridos"},{status:400});
    const result = identity.login(body.username,body.password);
    if(!result)return Response.json({success:false,error:"Credenciales de acceso incorrectas"},{status:401,headers:{"Cache-Control":"no-store"}});
    return Response.json({success:true,data:{mfaRequired:!!result.mfaRequired,enrollmentRequired:!!result.enrollmentRequired,...(result.challenge?{challenge:result.challenge}:{})}},{headers:{"Cache-Control":"no-store",...(result.token?{"Set-Cookie":sessionCookie(result.token)}:{})}});
  } catch(error) { return authFailure(error); }
}
