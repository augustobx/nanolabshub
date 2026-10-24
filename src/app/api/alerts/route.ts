import { evaluateSystemAlerts } from "@/lib/alerts";
import { getSessionUser } from "@/lib/auth";
import { backupRunner } from "@/lib/job-service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!await getSessionUser()) {
    return Response.json({ success: false, error: "Sesión requerida" }, {
      status: 401, headers: { "Cache-Control": "private, no-store" },
    });
  }
  try {
    const alerts = await evaluateSystemAlerts();
    try {
      for(const job of backupRunner.store.list().filter(j=>j.state==="failed"||j.state==="uncertain"||(j.state==="running"&&j.updatedAt+120000<Date.now())).slice(0,10)){
        alerts.push({id:"job-"+job.id,level:job.state==="failed"?"warning":"critical",title:job.state==="failed"?"Trabajo fallido":"Trabajo con resultado incierto",message:`${job.resource}: ${job.kind}. Revisá Trabajos persistentes antes de repetir la operación.`,source:"Jobs",timestamp:new Date(job.updatedAt).toISOString()});
      }
    } catch { alerts.push({id:"jobs-unavailable",level:"warning",title:"Cola no disponible",message:"No se pudo comprobar el estado de los trabajos persistentes.",source:"Jobs",timestamp:new Date().toISOString()}); }

    return Response.json({
      success: true,
      data: {
        alerts,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return Response.json({ success: false, error: "Alertas no disponibles" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
