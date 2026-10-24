"use client";
import { useCallback,useEffect,useState } from "react";
import type { ReleasePlan } from "@/lib/release-service";
export function ReleasePanel(){
 const [owner,setOwner]=useState(false),[plan,setPlan]=useState<ReleasePlan|null>(null),[error,setError]=useState(""),[selected,setSelected]=useState(""),[busy,setBusy]=useState(false),[job,setJob]=useState(""),[requestId,setRequestId]=useState("");
 const load=useCallback(async()=>{try{const r=await fetch("/api/apps/deploy",{cache:"no-store"}),j=await r.json();if(!r.ok||!j.success)throw Error(j.error||"No se pudo consultar el despliegue");setPlan(j.data);setError("");}catch(e){setPlan(null);setError(e instanceof Error?e.message:"Error de consulta");}},[]);
 useEffect(()=>{let active=true;fetch("/api/auth/account",{cache:"no-store"}).then(r=>r.json()).then(j=>{if(active&&j.success&&j.data?.role==="owner"&&j.data?.mfaReady){setOwner(true);void load();}}).catch(()=>{});return()=>{active=false;};},[load]);
 const release=plan?.releases.find(r=>r.id===selected);
 const deploy=async()=>{
  if(!release||!confirm(`¿Actualizar NanoHub a ${release.revision.slice(0,8)}? Se verificará un backup antes del cambio. El Hub puede interrumpirse brevemente mientras reinicia.`))return;
  const id=requestId||crypto.randomUUID();setRequestId(id);setBusy(true);setError("");try{const r=await fetch("/api/apps/deploy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug:"nanolabshub",releaseId:release.id,requestId:id})}),j=await r.json();if(!r.ok||!j.success)throw Error(j.error||"Despliegue rechazado");setJob(j.data.id);}catch(e){setError(e instanceof Error?e.message:"Error al solicitar el despliegue");}finally{setBusy(false);}
 };
 if(!owner)return null;
 return <section className="hub-card space-y-4 p-5" aria-label="Despliegue seguro de NanoHub"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="hub-section-heading">Actualizar NanoHub</h2><button className="hub-secondary-action" onClick={()=>void load()} disabled={busy}>Comprobar versiones</button></div>
  <p className="text-sm text-slate-400">La actualización se ejecuta en un worker independiente. Antes del cambio comprueba la copia de seguridad mediante una restauración aislada.</p>
  {error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}
  {plan&&<><p className="text-xs text-slate-400">Versión actual: {plan.currentRevision?.slice(0,8)||plan.currentImageId.slice(7,19)} · Worker: {plan.workerHealthy?"disponible":"sin heartbeat"} · Configuración: {plan.configurationMatches?"verificada":"cambió; requiere revisión"}</p>
   <label className="block text-sm text-slate-300">Versión aprobada<select aria-label="Versión aprobada de NanoHub" className="mt-2 block w-full rounded-lg bg-surface-100 p-3" value={selected} onChange={e=>{setSelected(e.target.value);setRequestId("");setJob("");}} disabled={busy}><option value="">Seleccioná una versión</option>{plan.releases.map(r=><option key={r.id} value={r.id} disabled={!r.available}>{r.id} · {r.revision.slice(0,8)}{r.available?"":" · imagen no disponible"}</option>)}</select></label>
   {release&&<p className="text-xs text-slate-400">CI aprobado #{release.ci.runId}. Si falla la salud, el worker intenta volver a la imagen anterior. La base conserva los cambios y su historial.</p>}
   <button className="hub-primary-action" disabled={busy||!plan.ready||!release?.available||!!job} onClick={()=>void deploy()}>{busy?"Registrando…":"Programar actualización del Hub"}</button></>}
  {job&&<p role="status" className="break-all text-sm text-emerald-200">Solicitud registrada: {job}. Consultá el resultado en Trabajos persistentes, en Backups. Podés cerrar esta pantalla.</p>}
 </section>;
}
