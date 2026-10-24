"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImportCandidate } from "@/lib/job-service";
import { KNOWN_APPS } from "@/lib/apps-registry";
export function BackupImportPanel(){
 const [sources,setSources]=useState<ImportCandidate[]>([]),[slug,setSlug]=useState(""),[filename,setFilename]=useState("");
 const [allowed,setAllowed]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [error,setError]=useState(""),[feedback,setFeedback]=useState("");
 const generation=useRef(0),requests=useRef(new Map<string,string>());
 const load=useCallback(async()=>{
  const current=++generation.current;setLoading(true);
  try{const r=await fetch("/api/backups/import",{cache:"no-store"}),j=await r.json();if(!r.ok||!j.success)throw Error(j.error||"Inventario no disponible");if(current===generation.current){setSources(j.data);setError("");}}
  catch(e){if(current===generation.current){setSources([]);setError(e instanceof Error?e.message:"No se pudo leer el inventario");}}
  finally{if(current===generation.current)setLoading(false);}
 },[]);
 useEffect(()=>{
  let active=true;
  fetch("/api/auth/account",{cache:"no-store"}).then(r=>r.json()).then(j=>{if(active){setAllowed(j.success&&j.data?.mfaReady&&j.data.role!=="viewer");setReady(true);}}).catch(()=>{if(active)setReady(true);});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{if(allowed)void load();},[allowed,load]);
 const source=sources.find(s=>s.slug===slug),selected=source?.files.find(f=>f.filename===filename&&f.supported);
 async function submit(){
  if(!selected||busy)return;
  setBusy(true);setError("");setFeedback("");
  const key="hub.import.request:"+slug+":"+filename;
  try{
   let saved:string|null=null;try{saved=sessionStorage.getItem(key);}catch{/* Memory preserves retries when storage is unavailable. */}
   const requestId=requests.current.get(key)||(saved&&/^[a-f0-9-]{36}$/.test(saved)?saved:crypto.randomUUID());
   requests.current.set(key,requestId);try{sessionStorage.setItem(key,requestId);}catch{/* Request remains in memory. */}
   const r=await fetch("/api/backups/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,filename,requestId})}),j=await r.json();
   if(!r.ok||!j.success)throw Error(j.error||"No se pudo solicitar la importación");
   requests.current.delete(key);try{sessionStorage.removeItem(key);}catch{/* A duplicate request remains idempotent. */}
   setFeedback("Solicitud guardada: "+j.data.jobId+". La copia aparecerá en el historial después de aprobar su restauración. El archivo original se conserva.");
  }catch(e){setError(e instanceof Error?e.message:"Error de importación");}
  finally{setBusy(false);}
 }
 if(!ready||!allowed)return null;
 return <section className="hub-card space-y-4 p-5" aria-label="Importar copias existentes">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="hub-section-heading">Importar copias existentes</h2><p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">Elegí un archivo del directorio de backups de su aplicación. Se conserva el original y se valida una copia aislada antes de incorporarla. Los archivos idénticos no duplican el respaldo registrado.</p></div><button className="hub-secondary-action" onClick={()=>void load()} disabled={loading}>Actualizar archivos</button></div>
  {error&&<p role="alert" className="text-xs text-amber-200">{error}</p>}
  {feedback&&<p role="status" className="text-xs text-slate-200">{feedback}</p>}
  <div className="flex flex-wrap items-end gap-3">
   <label className="min-w-48 flex-1 text-xs text-slate-400">Aplicación<select value={slug} onChange={e=>{setSlug(e.target.value);setFilename("");setFeedback("");}} className="mt-2 block w-full rounded-lg border border-white/15 bg-slate-950 p-3 text-white"><option value="">Elegir aplicación</option>{sources.map(s=><option key={s.slug} value={s.slug}>{KNOWN_APPS.find(a=>a.slug===s.slug)?.name||s.slug}</option>)}</select></label>
   <label className="min-w-56 flex-[2] text-xs text-slate-400">Archivo<select value={filename} onChange={e=>setFilename(e.target.value)} disabled={!source||source.status!=="available"} className="mt-2 block w-full rounded-lg border border-white/15 bg-slate-950 p-3 text-white"><option value="">Elegir archivo</option>{source?.files.map(f=><option key={f.filename} value={f.filename} disabled={!f.supported}>{f.filename}{!f.supported?" · No compatible":""}</option>)}</select></label>
   <button className="hub-primary-action" disabled={!selected||busy} onClick={()=>void submit()}>{busy?"Guardando solicitud…":"Importar y validar copia"}</button>
  </div>
  {source&&source.status!=="available"&&<p className="text-xs text-amber-200">No se pudo leer el directorio de esta aplicación.</p>}
  {source?.status==="available"&&!source.files.length&&<p className="text-xs text-slate-400">No hay archivos externos al registro en este directorio.</p>}
  <p className="text-[11px] text-slate-500">Formatos admitidos: SQLite, SQL gzip y dump binario PostgreSQL, hasta 512 MiB. Los dumps de una sola base validan esquema y datos; no contienen todos los roles globales del servidor.</p>
 </section>;
}
