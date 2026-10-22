import { getSessionUser } from "@/lib/auth";
import { backupEngine, assertBackupSecurity } from "@/lib/backup-service";
import { KNOWN_APPS } from "@/lib/apps-registry";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(req: Request) {
  if (!await getSessionUser()) return Response.json({success:false,error:"Sesión requerida"},{status:401});
  const id=new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({success:false,error:"Falta ID"},{status:400});
  try {
    assertBackupSecurity();
    const file=await backupEngine.download(KNOWN_APPS,id);
    return new Response(Readable.toWeb(createReadStream(file.file)) as ReadableStream,{
      headers:{"Content-Type":"application/gzip","Content-Length":String(file.size),
        "Content-Disposition":'attachment; filename="'+file.name+'"',
        "X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store"}
    });
  } catch(error) {
    return Response.json({success:false,error:error instanceof Error?error.message:"Archivo inaccesible"},
      {status:404,headers:{"Cache-Control":"no-store"}});
  }
}