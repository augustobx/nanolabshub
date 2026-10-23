"use client";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import type { getInfrastructureInventory } from "@/lib/infrastructure-inventory";
import { Globe2, ShieldAlert, ExternalLink, RefreshCw, Network, CheckCircle2 } from "lucide-react";
type Inventory=Awaited<ReturnType<typeof getInfrastructureInventory>>;
function label(status:string,lifecycle:string) {
  if(lifecycle!=="active")return {name:"Monitoreo pausado",cls:"hub-state hub-state-neutral"};
  if(status==="online")return {name:"HTTP responde",cls:"hub-state hub-state-good"};
  if(status==="restricted")return {name:"Acceso restringido",cls:"hub-state hub-state-neutral"};
  if(status==="http_error")return {name:"Error HTTP",cls:"hub-state hub-state-warn"};
  if(status==="offline")return {name:"Sin conexión",cls:"hub-state hub-state-warn"};
  return {name:"No comprobado",cls:"hub-state hub-state-neutral"};
}
export default function NetworkingPage(){
 const [data,setData]=useState<Inventory|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{const r=await fetch("/api/infrastructure",{cache:"no-store"});const json=await r.json();if(!r.ok||!json.success)throw Error(json.error||"Inventario no disponible");setData(json.data);setError(null);}catch(e){setData(null);setError(e instanceof Error?e.message:"Error de consulta");}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const domains=data?.domains||[];
 return <div className="min-w-0 flex-1 pb-14"><Header onRefresh={()=>void load()} isRefreshing={loading}/>
  <div className="hub-content space-y-6">
   <section className="hub-hero space-y-3"><p className="hub-eyebrow">Plataforma / Conectividad</p><h1 className="hub-hero-title">Dominios y estado de acceso.</h1>
    <p className="hub-description">URLs registradas y su respuesta HTTP reciente, sin confundir disponibilidad pública con configuración real de DNS, certificados o proxy.</p>
   </section>
   <div className="grid gap-4 sm:grid-cols-3">
    <div className="hub-card p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><Globe2 className="h-4 w-4"/> URLs registradas</div><p className="mt-2 text-3xl font-semibold text-white">{data?domains.length:"—"}</p><p className="mt-1 text-xs text-slate-400">Fuente: catálogo de aplicaciones</p></div>
    <div className="hub-card p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 className="h-4 w-4"/> Responden HTTP</div><p className="mt-2 text-3xl font-semibold text-white">{data?domains.filter(d=>d.status==="online"&&d.lifecycle==="active").length:"—"}</p><p className="mt-1 text-xs text-slate-400">No prueba configuración NPM</p></div>
    <div className="hub-card p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><ShieldAlert className="h-4 w-4"/> Requieren revisión</div><p className="mt-2 text-3xl font-semibold text-white">{data?domains.filter(d=>d.lifecycle==="active"&&["offline","http_error"].includes(d.status)).length:"—"}</p><p className="mt-1 text-xs text-slate-400">Solo servicios con ciclo activo</p></div>
   </div>
   {error&&<div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/20 p-4 text-xs text-amber-200">{error}<button className="ml-auto inline-flex items-center gap-1 underline" onClick={()=>void load()}><RefreshCw className="h-4 w-4"/> Reintentar</button></div>}
   <section className="hub-card overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] p-5"><div><h2 className="hub-section-heading">Inventario de URLs</h2><p className="mt-1 text-xs text-slate-400">Cada URL pertenece a una aplicación, no a una base de datos.</p></div>
     <a href="https://proxy.nanoapps.site" target="_blank" rel="noopener noreferrer" className="hub-text-link">Abrir Nginx Proxy Manager <ExternalLink className="h-4 w-4"/></a>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr><th className="px-5">Aplicación</th><th>Dominio registrado</th><th>Chequeo web</th><th>HTTP</th><th>Última consulta</th></tr></thead>
    <tbody>{domains.map(d=>{const badge=label(d.status,d.lifecycle);return <tr key={d.slug} className="border-t border-white/[0.07]">
     <td className="px-5 text-[13px] font-semibold text-white">{d.appName}</td>
     <td><a href={d.url} target="_blank" rel="noopener noreferrer" className="hub-text-link">{new URL(d.url).hostname}<ExternalLink className="h-3 w-3"/></a></td>
     <td><span className={badge.cls}>{badge.name}</span></td>
     <td className="font-mono text-slate-300">{d.httpStatus??"—"}</td>
     <td className="text-xs text-slate-400">{d.checkedAt?new Date(d.checkedAt).toLocaleString("es-AR"):"—"}</td>
    </tr>;})}{data&&domains.length===0&&<tr><td colSpan={5} className="p-6 text-center text-slate-400">No hay dominios HTTPS registrados.</td></tr>}</tbody></table></div>
   </section>
   <div className="flex items-start gap-3 rounded-xl border border-white/10 p-5"><Network className="mt-0.5 h-5 w-5 text-[#acc4f9]"/><div><h2 className="text-sm font-semibold text-white">Diferencia entre inventario y proxy</h2><p className="mt-1 text-xs leading-6 text-slate-400">El dominio registrado es solo una referencia; el Hub no afirma que exista un Proxy Host configurado ni un certificado válido. Para confirmar enrutamiento y expiraciones debemos integrar una lectura restringida de Nginx Proxy Manager. Ninguna operación de esta página modifica DNS, certificados ni NPM.</p></div></div>
  </div>
 </div>;
}
