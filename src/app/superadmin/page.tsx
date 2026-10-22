"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { SAAS_PRODUCTS } from "@/lib/product-taxonomy";
import type { GovernanceOverview } from "@/lib/types";
import { ShieldCheck, Users, ArrowUpRight, Layers3, KeyRound, ClipboardList, Settings2, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";

const CAPABILITIES = [
  {key:"tenantRead",label:"Lectura de tenants"},
  {key:"statusWrite",label:"Cambiar estado"},
  {key:"moduleWrite",label:"Gestionar módulos"},
  {key:"impersonation",label:"Acceso delegado"},
  {key:"settings",label:"Configuración"},
  {key:"activity",label:"Auditoría externa"},
] as const;
const LABELS = {connected:"Disponible",legacy_review:"Legado · revisar",pending:"Pendiente"};
export default function SuperadminPage() {
  const [overview,setOverview] = useState<GovernanceOverview|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const load = async () => {
    setLoading(true);
    try{
      const response=await fetch("/api/governance",{cache:"no-store"});
      const json=await response.json();
      if(!response.ok||!json.success)throw Error(json.error||"Sin respuesta del conector");
      setOverview(json.data);
      setError(null);
    }catch(e){setError(e instanceof Error?e.message:"Sin datos");}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  const healthySources=new Set(overview?.sources?.filter(x=>x.status==="available").map(x=>x.saas)||[]);
  return <div className="min-w-0 flex-1 pb-14"><Header onRefresh={()=>void load()} isRefreshing={loading}/>
    <div className="hub-content space-y-6">
      <section className="hub-hero space-y-3">
        <p className="hub-eyebrow">Gobierno / Superadmin</p>
        <h1 className="hub-hero-title">Administración central, sin puntos ciegos.</h1>
        <p className="hub-description">Un mismo mapa de capacidades para todas las SaaS. Desde aquí podés ver qué controles funcionan actualmente y qué operaciones requieren integrar los paneles de origen de manera segura.</p>
      </section>
      {error&&<div role="alert" className="rounded-xl border border-amber-300/25 p-4 text-xs text-amber-200">El conector de tenants no respondió: {error}. Las cifras pueden estar incompletas.</div>}
      <section aria-label="Cobertura de gobierno" className="grid gap-4 sm:grid-cols-3">
        <div className="hub-card p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><Layers3 className="h-4 w-4 text-[#abc2fa]"/> SaaS registradas</div><p className="mt-2 text-3xl font-semibold text-white">{SAAS_PRODUCTS.length}</p><p className="mt-1 text-xs text-slate-400">Todas con ficha estándar</p></div>
        <div className="hub-card p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><Users className="h-4 w-4 text-[#abc2fa]"/> Tenants reportados</div><p className="mt-2 text-3xl font-semibold text-white">{overview?.sources?.some(x=>x.status==="available")?overview.totalTenants:"—"}</p><p className="mt-1 text-xs text-slate-400">Según conectores actuales</p></div>
        <div className="hub-card p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4 text-[#abc2fa]"/> Superadmin integrado por completo</div><p className="mt-2 text-3xl font-semibold text-white">0 / {SAAS_PRODUCTS.length}</p><p className="mt-1 text-xs text-slate-400">Falta completar contratos autenticados por SaaS</p></div>
      </section>
      <section className="hub-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] p-5 sm:p-6">
          <div><h2 className="hub-section-heading">Mapa de integración por producto</h2><p className="mt-1 text-xs text-slate-400">Conectores auditados a nivel de código. No equivale a certificación del entorno productivo.</p></div>
          <Link href="/saas" className="hub-text-link">Explorar SaaS <ArrowUpRight className="h-4 w-4"/></Link>
        </div>
        <div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-[13px]">
          <thead><tr><th className="px-5">Plataforma</th>{CAPABILITIES.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>{SAAS_PRODUCTS.map(product=><tr key={product.slug} className="border-t border-white/[0.07]">
            <td className="px-5"><Link className="font-semibold text-[#c6d8ff] hover:underline" href={"/saas/"+product.slug}>{product.name}</Link></td>
            {CAPABILITIES.map(cap=><td key={cap.key}><span className={(product.capabilities[cap.key]==="connected"&&(cap.key!=="tenantRead"||healthySources.has(product.slug)))?"hub-state hub-state-good":"hub-state hub-state-neutral"}>{cap.key==="tenantRead"&&!healthySources.has(product.slug)?"Sin conectar":LABELS[product.capabilities[cap.key]]}</span></td>)}
          </tr>)}</tbody>
        </table></div>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          {title:"Gestión de clientes",desc:"Estados, planes, módulos y portal por tenant donde exista integración.",href:"/governance",icon:Users},
          {title:"Control de versiones",desc:"Repositorios, despliegues, contenedores y ciclo de vida con confirmación.",href:"/software",icon:Settings2},
          {title:"Continuidad y auditoría",desc:"Respaldos íntegros, historial de acciones y dependencias de recuperación.",href:"/backups",icon:ClipboardList},
        ].map(x=>{const Icon=x.icon;return <Link key={x.title} href={x.href} className="hub-card group flex flex-col gap-3 p-5"><Icon className="h-5 w-5 text-[#abc2fa]"/><h3 className="text-sm font-semibold text-white">{x.title}</h3><p className="text-xs leading-6 text-slate-400">{x.desc}</p><span className="hub-text-link mt-auto">Abrir módulo <ArrowUpRight className="h-4 w-4"/></span></Link>})}
      </div>
      <div className="hub-card flex flex-wrap items-start gap-3 border-amber-300/20 bg-amber-300/[0.035] p-5">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-300"/>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-white">Migración real de Superadmin</h2><p className="mt-1 text-xs leading-6 text-slate-300">La capa visual ya es uniforme, pero faltan endpoints de escritura autenticados, permisos por rol y auditoría coherente en las SaaS. No se debe tratar un módulo simulado ni un enlace antiguo como una integración completa. La administración por producto se habilitará por capacidades verificadas, no por promesas del panel.</p></div>
      </div>
    </div>
  </div>;
}
