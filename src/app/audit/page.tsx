"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {Header} from "@/components/Header";
import {ScrollText,Search,RefreshCw,ShieldAlert,ArrowUpRight} from "lucide-react";
type Audit={id:number;timestamp:string;actor:string;action:string;target:string;details:string;source:string};
function displayTime(input:string){return new Date(input).toLocaleString("es-AR");}
export default function AuditPage(){
 const [items,setItems]=useState<Audit[]>([]),[query,setQuery]=useState(""),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
   setLoading(true);
   try{
     const r=await fetch("/api/audit",{cache:"no-store"}),j=await r.json();
     if(!r.ok||!j.success)throw Error(j.error||"Auditoría no disponible");
     setItems(j.data);
     setError(null);
   }catch(e){setError(e instanceof Error?e.message:"No se pudo consultar auditoría");}
   finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const filtered=useMemo(()=>items.filter(x=>(x.action+" "+x.actor+" "+x.target+" "+x.details).toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))),[items,query]);
 return <div className="min-w-0 flex-1 pb-14"><Header onRefresh={()=>void load()} isRefreshing={loading}/>
   <div className="hub-content space-y-6">
     <section className="hub-hero flex flex-wrap items-end justify-between gap-4">
       <div className="max-w-2xl space-y-3"><p className="hub-eyebrow">Gobierno / Auditoría</p>
       <h1 className="hub-hero-title">Un historial que se puede revisar.</h1>
       <p className="hub-description">Cambios y operaciones auditadas por NanoLabs Hub, con responsable y fecha. Los eventos internos de cada SaaS se integrarán cuando sus APIs autenticadas lo permitan.</p></div>
       <Link href="/superadmin" className="hub-secondary-action">Superadmin <ArrowUpRight className="h-4 w-4"/></Link>
     </section>
     {error&&<div role="alert" className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4 text-xs text-amber-200">{error}. No se muestran eventos supuestos.</div>}
     <div className="hub-card overflow-hidden">
       <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] p-5">
         <div><h2 className="hub-section-heading">Eventos locales del Hub</h2><p className="mt-1 text-xs text-slate-400">Hasta 200 registros recientes · fuente: auditoría persistente SQLite</p></div>
         <div className="flex flex-wrap items-center gap-2">
           <label className="relative"><span className="sr-only">Buscar evento</span>
             <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
             <input className="hub-field pl-9" type="search" placeholder="Buscar evento" value={query} onChange={e=>setQuery(e.target.value)}/></label>
           <button className="hub-secondary-action" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw className="h-4 w-4"/> Recargar</button>
         </div>
       </div>
       <div className="divide-y divide-white/[0.08]">{filtered.map(item=><div key={item.id} className="grid min-w-0 gap-2 p-4 md:grid-cols-[minmax(0,1fr)_160px] md:items-start md:p-5">
         <div className="min-w-0 space-y-1.5">
           <div className="flex flex-wrap items-center gap-2"><ScrollText className="h-4 w-4 text-[#bbd2fc]"/><span className="break-all text-xs font-semibold text-white">{item.action}</span><span className="hub-state hub-state-neutral">{item.target}</span></div>
           <p className="break-words text-xs leading-5 text-slate-400">{item.details||"Sin detalles adicionales"}</p>
           <p className="text-[11px] text-slate-500">Operador: {item.actor} · Hub local</p>
         </div>
         <p className="text-xs text-slate-400 md:text-right">{displayTime(item.timestamp)}</p>
       </div>)}
       {!error&&!loading&&!filtered.length&&<p className="p-8 text-center text-xs text-slate-400">No hay eventos que coincidan con la búsqueda.</p>}
       {loading&&!items.length&&<p className="p-8 text-center text-xs text-slate-400">Consultando auditoría…</p>}
       </div>
     </div>
     <div className="flex items-start gap-3 rounded-xl border border-white/10 p-5">
       <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"/>
       <p className="text-xs leading-6 text-slate-400">Esta vista no es un registro global de las SaaS. Los eventos todavía no conectados quedan fuera del historial, y una auditoría local no sustituye almacenamiento inmutable externo.</p>
     </div>
   </div>
 </div>;
}
