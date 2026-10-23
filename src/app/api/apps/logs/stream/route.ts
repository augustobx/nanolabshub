import { spawn } from "node:child_process";
import { getSessionUser } from "@/lib/auth";
import { validateContainer } from "@/lib/operational-policy";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!await getSessionUser()) return new Response("Sesión requerida",{status:401});
  const query=new URL(req.url).searchParams;
  let input;
  try { input=validateContainer(query.get("container"),query.get("lines")||"100"); }
  catch { return new Response("Contenedor o límite inválido",{status:400}); }
  let stop=()=>{};
  const stream=new ReadableStream<Uint8Array>({
    start(controller) {
      let closed=false,bytes=0;
      const encoder=new TextEncoder(),child=spawn("docker",["logs","--tail",String(input.lines),"-f",input.name]);
      const close=()=>{if(!closed){closed=true;try{controller.close();}catch{}}};
      stop=()=>{close();child.kill();};
      const timer=setTimeout(stop,5*60000);timer.unref();
      const output=(chunk:Buffer)=>{
        if(closed)return;bytes+=chunk.byteLength;
        if(bytes>2*1024*1024){try{controller.enqueue(encoder.encode("\nLímite de lectura alcanzado. Volvé a abrir los logs.\n"));}catch{}stop();return;}
        try{controller.enqueue(new Uint8Array(chunk));}catch{stop();}
      };
      child.stdout.on("data",output);child.stderr.on("data",output);
      child.on("close",()=>{clearTimeout(timer);close();});
      child.on("error",()=>{clearTimeout(timer);if(!closed){try{controller.enqueue(encoder.encode("No se pudo abrir el flujo de logs"));}catch{}close();}});
      req.signal.addEventListener("abort",stop,{once:true});
      if(req.signal.aborted)stop();
    },
    cancel(){stop();}
  });
  return new Response(stream,{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"private, no-store, no-transform","X-Content-Type-Options":"nosniff"}});
}
