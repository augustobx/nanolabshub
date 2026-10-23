"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Header} from "@/components/Header";
import {SAAS_PRODUCTS} from "@/lib/product-taxonomy";
import type {GovernanceOverview} from "@/lib/types";
import {ArrowUpRight,ClipboardList,Layers3,TriangleAlert,CheckCircle2,ShieldAlert} from "lucide-react";
export default function LegacyPage(){
 const [gov,setGov]=useState<GovernanceOverview|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{const r=await fetch("/api/governance",{cache:"no-store"}),j=await r.json();if(!r.ok||!j.success)throw Error(j.error||"Conectores no disponibles");setGov(j.data);setError(null);}catch(e){setError(e instanceof Error?e.message:"Error de consulta");}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 return <div className="min-w-0 flex-1 pb-14"><Header onRefresh={()=>void load()} isRefreshing={loading}/>
  <div className="hub-content space-y-6">
   <section className="hub-hero space-y-3"><p className="hub-eyebrow">Portafolio / Migración de paneles</p><h1 className="hub-hero-title">Unificar sin apagar funciones.</h1>
    <p className="hub-description">Seguimiento de la incorporación de cada Superadmin al Hub. Una vista nueva no significa que las acciones y permisos del panel anterior estén migrados.</p></section>
   {error&&<div role="alert" className="rounded-xl border border-amber-400/25 p-4 text-xs text-amber-200">{error}</div>}
   <div className="grid gap-4 sm:grid-cols-3">
    <div className="hub-card p-5"><p className="text-xs text-slate-400">SaaS en el portafolio</p><p className="mt-2 text-3xl font-semibold text-white">{SAAS_PRODUCTS.length}</p><p className="mt-1 text-xs text-slate-400">Misma ficha y navegación</p></div>
    <div className="hub-card p-5"><p className="text-xs text-slate-400">Lectura conectada ahora</p><p className="mt-2 text-3xl font-semibold text-white">{gov?.sources?.filter(x=>x.status==="available").length??"—"}</p><p className="mt-1 text-xs text-slate-400">Por fuentes autenticadas que respondieron</p></div>
    <div className="hub-card p-5"><p className="text-xs text-slate-400">Edición central certificada</p><p className="mt-2 text-3xl font-semibold text-white">0</p><p className="mt-1 text-xs text-slate-400">Pendiente RBAC y auditoría por SaaS</p></div>
   </div>
   <section className="hub-card overflow-hidden">
     <div className="border-b border-white/10 p-5"><h2 className="hub-section-heading">Planes de migración por producto</h2><p className="mt-1 text-xs text-slate-400">Estado conocido, sin simular fechas ni despliegues.</p></div>
     <div className="grid gap-3 p-4 md:grid-cols-2 sm:p-5">{SAAS_PRODUCTS.map(p=>{
       const source=gov?.sources?.find(x=>x.saas===p.slug);
       return <div key={p.slug} className="rounded-xl border border-white/[0.09] bg-white/[0.025] p-4">
         <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{p.name}</h3><p className="mt-1 text-xs text-slate-400">{p.focus}</p></div><span className="hub-state hub-state-neutral">Migración incompleta</span></div>
         <div className="mt-4 space-y-2 text-xs">
           <div className="flex items-center justify-between gap-2"><span className="text-slate-300">Ficha de producto</span><span className="text-emerald-300">Disponible</span></div>
           <div className="flex items-center justify-between gap-2"><span className="text-slate-300">Lectura de tenants</span><span className={source?.status==="available"?"text-emerald-300":"text-slate-400"}>{source?.status==="available"?"Conectada":"Pendiente / sin respuesta"}</span></div>
           <div className="flex items-center justify-between gap-2"><span className="text-slate-300">Cambio de estado y módulos</span><span className="text-slate-400">No habilitado</span></div>
           <div className="flex items-center justify-between gap-2"><span className="text-slate-300">Acceso delegado + auditoría</span><span className="text-slate-400">No integrado</span></div>
         </div>
         <Link href={"/saas/"+p.slug} className="hub-text-link mt-4">Abrir ficha <ArrowUpRight className="h-4 w-4"/></Link>
       </div>;
     })}</div>
   </section>
   <div className="hub-card space-y-4 p-5"><h2 className="hub-section-heading">Criterio para retirar un panel anterior</h2>
    <p className="text-xs leading-6 text-slate-400">No se debe apagar ni redirigir un Superadmin existente hasta comprobar, en ese producto, autenticación por rol, lectura y escritura de tenants, módulos y planes, trazabilidad, reversión y pruebas en una instancia aislada. Sin esa evidencia el estado sigue siendo <strong className="text-white">migración incompleta</strong>.</p>
    <div className="flex flex-wrap gap-3"><Link href="/superadmin" className="hub-primary-action">Estado de Superadmin <ArrowUpRight className="h-4 w-4"/></Link><Link href="/audit" className="hub-secondary-action">Auditoría del Hub</Link></div>
   </div>
  </div>
 </div>;
}
