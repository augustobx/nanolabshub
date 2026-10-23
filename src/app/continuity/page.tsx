"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { KNOWN_APPS } from "@/lib/apps-registry";
import { ArrowUpRight, CheckCircle2, CircleAlert, DatabaseBackup, Download, ShieldCheck, RefreshCw, FlaskConical, HardDrive, CloudOff } from "lucide-react";
type Backup = {id:string;appSlug:string;filename:string;status:string;createdAt:string;sizeFormatted:string;checksum?:string;error?:string;dbType:string};
type Check = {id:string;backupId:string;slug:string;status:"passed"|"failed";checkedAt:string;details:string};
function time(date?:string){return date?new Date(date).toLocaleString("es-AR"):"Sin registro";}
export default function ContinuityPage(){
 const [backups,setBackups]=useState<Backup[]>([]),[checks,setChecks]=useState<Check[]>([]);
 const [known,setKnown]=useState(false),[errors,setErrors]=useState<string[]>([]);
 const [loading,setLoading]=useState(true),[running,setRunning]=useState<string|null>(null);
 const [feedback,setFeedback]=useState<string|null>(null);
 const load=useCallback(async()=>{
   setLoading(true);
   const sources=["/api/backups","/api/backups/restore-check"];
   const results=await Promise.allSettled(sources.map(async u=>{
     const r=await fetch(u,{cache:"no-store"}),j=await r.json();
     if(!r.ok||j.success!==true)throw Error(j.error||"Servicio no disponible");
     return j.data;
   }));
   if(results[0].status==="fulfilled"){setBackups(results[0].value);setKnown(true);}
   if(results[1].status==="fulfilled")setChecks(results[1].value);
   setErrors(results.flatMap((r,i)=>r.status==="rejected"?[sources[i]+": "+String(r.reason?.message||"sin respuesta")]:[]));
   setLoading(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 const dbApps=KNOWN_APPS.filter(a=>a.dbType!=="none");
 const summary=dbApps.map(app=>{
   const copies=backups.filter(b=>b.appSlug===app.slug&&b.status==="verified")
     .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
   const latest=copies[0];
   const validated=latest?checks.find(c=>c.backupId===latest.id&&c.status==="passed"):undefined;
   return {app,latest,validated};
 });
 const missing=known?summary.filter(x=>!x.latest).length:0;
 const isolated=known?summary.filter(x=>!!x.validated).length:0;
 async function runCheck(id:string){
   if(running)return;
   if(!window.confirm("Se abrirá una copia SQLite aislada para comprobar integridad y claves foráneas. No se modificará la base original. ¿Continuar?"))return;
   setRunning(id);setFeedback(null);
   try{
     const r=await fetch("/api/backups/restore-check",{method:"POST",
       headers:{"Content-Type":"application/json"},body:JSON.stringify({backupId:id})});
     const j=await r.json();
     if(!r.ok||!j.success)throw Error(j.error||"Falló la prueba");
     setFeedback("Comprobación SQLite aprobada en copia aislada. No equivale al arranque completo de la SaaS.");
     await load();
   }catch(e){setFeedback("No se pudo validar: "+(e instanceof Error?e.message:"Error"));}
   finally{setRunning(null);}
 }
 return <div className="min-w-0 flex-1 pb-14">
   <Header onRefresh={()=>void load()} isRefreshing={loading}/>
   <div className="hub-content space-y-6">
     <section className="hub-hero flex flex-wrap items-end justify-between gap-4">
       <div className="max-w-2xl space-y-3">
         <p className="hub-eyebrow">Continuidad operativa / Recuperación</p>
         <h1 className="hub-hero-title">Saber qué se puede recuperar.</h1>
         <p className="hub-description">Cobertura de backups, integridad y pruebas aisladas. Diferenciamos un archivo íntegro de una restauración validada y de una copia fuera del servidor.</p>
       </div>
       <Link className="hub-primary-action" href="/backups"><DatabaseBackup className="h-4 w-4"/> Centro de backups <ArrowUpRight className="h-4 w-4"/></Link>
     </section>
     {errors.length>0&&<div role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-xs text-amber-200">
       Algunas verificaciones no respondieron: {errors.join(" · ")}. No se asume que falten backups cuando no hay información.
     </div>}
     {feedback&&<div role="status" className="rounded-xl border border-white/15 bg-white/[0.04] p-4 text-xs text-slate-200">{feedback}</div>}
     <section aria-label="Resumen de continuidad" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
       {[
         {label:"Bases registradas",value:String(dbApps.length),note:"Según inventario del Hub",icon:DatabaseBackup},
         {label:"Sin copia íntegra",value:known?String(missing):"—",note:"Archivos no verificados excluidos",icon:CircleAlert},
         {label:"SQLite aisladas aprobadas",value:known?String(isolated):"—",note:"Prueba de copia; no de aplicación",icon:FlaskConical},
         {label:"Copia externa verificada",value:"—",note:"No hay proveedor configurado",icon:CloudOff},
       ].map(x=>{const Icon=x.icon;return <div key={x.label} className="hub-card p-5">
         <div className="flex items-center justify-between gap-2 text-xs text-slate-400"><span>{x.label}</span><Icon className="h-4 w-4 text-[#b6ccfa]"/></div>
         <p className="mt-2 text-3xl font-semibold text-white">{x.value}</p>
         <p className="mt-1 text-xs text-slate-400">{x.note}</p></div>})}
     </section>
     <section className="hub-card overflow-hidden">
       <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] p-5">
         <div><h2 className="hub-section-heading">Preparación de recuperación por aplicación</h2>
         <p className="mt-1 text-xs text-slate-400">Nunca restauramos una base productiva desde esta pantalla.</p></div>
         <button type="button" onClick={()=>void load()} disabled={loading} className="hub-secondary-action"><RefreshCw className="h-4 w-4"/> Actualizar</button>
       </div>
       <div className="grid gap-3 p-4 sm:p-5">
         {summary.map(({app,latest,validated})=><div key={app.slug} className="flex flex-col gap-4 rounded-xl border border-white/[0.09] bg-white/[0.025] p-4 lg:flex-row lg:items-center">
           <div className="min-w-0 flex-1">
             <div className="flex flex-wrap items-center gap-2">
               <h3 className="text-sm font-semibold text-white">{app.name}</h3>
               <span className="hub-state hub-state-neutral">{app.dbType.toUpperCase()}</span>
             </div>
             <p className="mt-1 text-[11px] text-slate-400">Último backup con integridad OK: {known?time(latest?.createdAt):"Sin lectura"}</p>
             {validated&&<p className="mt-1 text-[11px] text-emerald-300">Validación SQLite aislada: {time(validated.checkedAt)}</p>}
           </div>
           <div className="flex flex-wrap items-center gap-2">
             {!known?<span className="hub-state hub-state-neutral">Sin telemetría</span>:
              !latest?<span className="hub-state hub-state-warn"><CircleAlert className="h-3 w-3"/> Falta copia íntegra</span>:
              validated?<span className="hub-state hub-state-good"><CheckCircle2 className="h-3.5 w-3.5"/> Copia SQLite validada</span>:
              <span className="hub-state hub-state-neutral">Integridad OK · recuperación sin prueba</span>}
             {latest&&<a href={"/api/backups/download?id="+encodeURIComponent(latest.id)}
               className="hub-secondary-action"><Download className="h-4 w-4"/> Descargar</a>}
             {latest&&app.dbType==="sqlite"&&<button type="button" disabled={!!running}
               onClick={()=>void runCheck(latest.id)} className="hub-primary-action">
               <FlaskConical className="h-4 w-4"/> {running===latest.id?"Comprobando…":"Comprobar copia SQLite"}</button>}
             {!latest&&<Link href="/backups" className="hub-text-link">Abrir backups <ArrowUpRight className="h-4 w-4"/></Link>}
           </div>
         </div>)}
       </div>
     </section>
     <section className="grid gap-4 lg:grid-cols-3">
       <div className="hub-card p-5"><ShieldCheck className="h-5 w-5 text-[#abc2fa]"/><h2 className="mt-3 text-sm font-semibold text-white">Integridad</h2>
         <p className="mt-2 text-xs leading-6 text-slate-400">Gzip y SHA-256 comprueban el archivo. No validan procesos de negocio.</p></div>
       <div className="hub-card p-5"><FlaskConical className="h-5 w-5 text-[#abc2fa]"/><h2 className="mt-3 text-sm font-semibold text-white">Copia aislada SQLite</h2>
         <p className="mt-2 text-xs leading-6 text-slate-400">Extrae a un directorio temporal y verifica SQLite y claves foráneas. No arranca la aplicación.</p></div>
       <div className="hub-card p-5"><HardDrive className="h-5 w-5 text-[#abc2fa]"/><h2 className="mt-3 text-sm font-semibold text-white">Almacenamiento externo</h2>
         <p className="mt-2 text-xs leading-6 text-slate-400">Aún no configurado. Una copia en el mismo disco no protege ante su pérdida.</p></div>
     </section>
   </div>
 </div>;
}
