import { getSessionUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
function redact(input:unknown){
 const text=typeof input==="string"?input:JSON.stringify(input??"");
 return text.slice(0,1500)
  .replace(/(authorization\s*[:=]\s*bearer\s+)\S+/ig,"$1[REDACTED]")
  .replace(/((?:password|secret|token|api[_-]?key|DATABASE_URL|HUB_MASTER_KEY|ADMIN_PASS)\s*[:=]\s*)[^\s,;}]+/ig,"$1[REDACTED]")
  .replace(/:\/\/([^\s:@]+):([^\s@]+)@/g,"://[REDACTED]@")
  .replace(/\b[a-f0-9]{48,}\b/ig,"[REDACTED]");
}
export async function GET(){
 if(!await getSessionUser())return Response.json({success:false,error:"Sesión requerida"},{status:401,headers});
 try{
  const db=getDatabase();
  if(db.type!=="sqlite")throw Error("Auditoría SQLite persistente no disponible");
  const rows=(db.getAuditLogs(200) as Array<Record<string,unknown>>).map(row=>({
    id:row.id,timestamp:row.timestamp,actor:redact(row.user).slice(0,100),
    action:redact(row.action).slice(0,100),target:redact(row.target).slice(0,120),
    details:redact(row.details),source:"hub-local"
  }));
  return Response.json({success:true,data:rows,scope:"hub-local",
    note:"No incluye los registros de auditoría internos de las SaaS."},{headers});
 }catch{
  return Response.json({success:false,error:"Auditoría no disponible"},{status:503,headers});
 }
}
