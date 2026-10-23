"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { SAAS_PRODUCTS } from "@/lib/product-taxonomy";
import type { GovernanceOverview, BackupRecord } from "@/lib/types";
import type { OperationsSnapshot } from "@/lib/operations";
import { ArrowLeft, ArrowUpRight, DatabaseBackup, ExternalLink, ServerCog, ShieldCheck, Users, Settings2, Activity, LayoutGrid, AlertCircle } from "lucide-react";

const TABS = [
  { id:"overview",label:"Resumen" }, { id:"tenants",label:"Tenants" },
  { id:"operation",label:"Operación" }, { id:"data",label:"Datos" },
  { id:"settings",label:"Configuración" }, { id:"audit",label:"Auditoría" }
] as const;
type Tab = typeof TABS[number]["id"];
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString("es-AR") : "—";
const connected = (state: string) => state === "connected" ? "Conector disponible" : state === "legacy_review" ? "Heredado · pendiente de auditoría" : "Pendiente de integración";
const qualityClass = (state: string) => state === "connected" ? "hub-state hub-state-good" : "hub-state hub-state-neutral";

function DataCell({ label, value }: {label: string;value: React.ReactNode}) {
  return <div className="rounded-xl border border-white/[0.09] bg-white/[0.03] p-4"><p className="text-xs text-slate-400">{label}</p><div className="mt-2 break-words text-sm font-semibold text-white">{value}</div></div>;
}
function NotConnected({ title, explanation }: {title:string; explanation:string}) {
  return <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-white/20 bg-white/[0.015] p-6">
    <span className="hub-state hub-state-neutral"><AlertCircle className="h-3.5 w-3.5"/> Pendiente de integración</span>
    <h3 className="text-base font-semibold text-white">{title}</h3>
    <p className="max-w-2xl text-sm leading-6 text-slate-400">{explanation}</p>
  </div>;
}
export default function SaaSWorkspacePage() {
  const params=useParams();
  const slug=typeof params.slug==="string" ? params.slug : "";
  const product=SAAS_PRODUCTS.find(p=>p.slug===slug);
  const [tab,setTab]=useState<Tab>("overview");
  const [ops,setOps]=useState<OperationsSnapshot|null>(null);
  const [gov,setGov]=useState<GovernanceOverview|null>(null);
  const [backups,setBackups]=useState<BackupRecord[]|null>(null);
  const [pending,setPending]=useState(false);
  const [errors,setErrors]=useState<string[]>([]);
  const load=async()=>{
    setPending(true);
    const urls=["/api/operations","/api/governance","/api/backups"];
    const response=await Promise.allSettled(urls.map(async u=>{
      const r=await fetch(u,{cache:"no-store"});const j=await r.json();
      if(!r.ok||!j.success)throw Error("No disponible");
      return j.data;
    }));
    if(response[0].status==="fulfilled")setOps(response[0].value);
    if(response[1].status==="fulfilled")setGov(response[1].value);
    if(response[2].status==="fulfilled")setBackups(response[2].value);
    setErrors(response.flatMap((r,i)=>r.status==="rejected"?[urls[i]]:[]));
    setPending(false);
  };
  useEffect(()=>{void load();},[slug]);
  if(!product)return <div className="min-w-0 flex-1"><Header/><div className="hub-content"><NotConnected title="Producto no registrado" explanation="El identificador solicitado no forma parte de las seis SaaS del portafolio."/><Link className="hub-text-link mt-4 inline-flex" href="/saas">Volver a SaaS</Link></div></div>;
  const app=ops?.apps.find(a=>a.slug===slug);
  const tenants=gov?.tenants.filter(t=>t.saas===slug)||[];
  const source=gov?.sources?.find(item=>item.saas===slug);
  const sourceAvailable=source?.status==="available";
  const management=gov?.managementProducts?.includes(product.slug) ?? false;
  const copies=(backups||[]).filter(b=>b.appSlug===slug);
  const last=copies.find(b=>b.status==="verified");
  const containers=app?.containers||[];
  const live=(app?.lifecycle?.state||"active")==="active";
  return <div className="min-w-0 flex-1 pb-14">
    <Header onRefresh={()=>void load()} isRefreshing={pending}/>
    <div className="hub-content space-y-5">
      <Link href="/saas" className="hub-text-link"><ArrowLeft className="h-4 w-4"/> Volver a productos SaaS</Link>
      <section className="hub-hero flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <p className="hub-eyebrow">SaaS / Espacio de producto</p>
          <h1 className="hub-hero-title">{product.name}</h1>
          <p className="hub-description">{product.focus}. Un mismo espacio de información y gestión para todas las plataformas NanoLabs.</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={app?.status==="operational"&&live?"hub-state hub-state-good":"hub-state hub-state-neutral"}>{!app?"Estado no disponible":!live?"Servicio suspendido o archivado":app.status==="operational"?"Operativa":"Revisar operación"}</span>
            <span className="hub-state hub-state-neutral">SaaS multiempresa</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(slug==="onlygym"||slug==="onlyturn"||slug==="onlyfood")&&<Link className="hub-primary-action" href={"/saas/"+slug+"/manage"}>Administrar plataforma <Settings2 className="h-4 w-4"/></Link>}
          <Link className="hub-secondary-action" href={"/governance?saas="+slug}><Users className="h-4 w-4"/> Ver tenants</Link>
          <Link className="hub-primary-action" href="/software"><ServerCog className="h-4 w-4"/> Acciones técnicas <ArrowUpRight className="h-4 w-4"/></Link>
        </div>
      </section>
      {!sourceAvailable && gov && <p role="status" className="rounded-xl border border-amber-300/20 p-3 text-xs text-amber-200">Lectura de tenants de {product.name} no conectada o no disponible. No significa cero clientes.</p>}
      {errors.length>0&&<p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-4 py-3 text-xs text-amber-100">Datos parciales. No respondieron {errors.join(", ")}; no se sustituyen por cifras estimadas.</p>}
      <nav aria-label={"Secciones de "+product.name} className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.1] bg-[#1a2a3d] p-1.5">
        {TABS.map(t=><button key={t.id} type="button" onClick={()=>setTab(t.id)} aria-current={tab===t.id?"page":undefined} className={"min-h-10 shrink-0 rounded-lg px-4 text-[13px] font-semibold transition-colors "+(tab===t.id?"bg-[#3b5374] text-white shadow-sm":"text-slate-400 hover:bg-white/[0.06] hover:text-white")}>{t.label}</button>)}
      </nav>
      {tab==="overview"&&<div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DataCell label="Tenants reportados" value={sourceAvailable?tenants.length:"—"}/>
          <DataCell label="Tenants activos" value={sourceAvailable?tenants.filter(t=>t.status==="ACTIVE").length:"—"}/>
          <DataCell label="Contenedores en ejecución" value={app?containers.filter(c=>c.state==="running").length+" de "+containers.length:"—"}/>
          <DataCell label="Último backup íntegro" value={backups?last?formatDate(last.createdAt):"Sin registro":"—"}/>
        </div>
        <div className="hub-card space-y-4 p-5 sm:p-6"><h2 className="hub-section-heading">Accesos principales</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {[{title:"Clientes y tenants",note:"Gestionar empresas y estados",href:"/governance?saas="+slug,icon:Users},
              {title:"Operación del producto",note:"Git, contenedores y ciclo de vida",href:"/software",icon:Activity},
              {title:"Respaldo de datos",note:"Historial, integridad y descarga",href:"/backups",icon:DatabaseBackup}].map(x=>{const Icon=x.icon;return <Link key={x.title} href={x.href} className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 hover:border-[#9cbcf4]/40"><Icon className="mt-1 h-5 w-5 shrink-0 text-[#a7bff0]"/><div><p className="text-sm font-semibold text-white">{x.title}</p><p className="mt-1 text-xs text-slate-400">{x.note}</p></div><ArrowUpRight className="ml-auto h-4 w-4 text-slate-500 group-hover:text-white"/></Link>})}
          </div>
        </div>
      </div>}
      {tab==="tenants"&&<section className="hub-card min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5"><div><h2 className="hub-section-heading">Tenants de {product.name}</h2><p className="mt-1 text-xs text-slate-400">Información proporcionada por el conector existente; no asegura sincronización perfecta.</p></div><Link className="hub-primary-action" href={"/governance?saas="+slug}>Gestionar tenants <ArrowUpRight className="h-4 w-4"/></Link></div>
        <div className="overflow-x-auto"><table className="min-w-[620px] w-full text-left text-[13px]"><thead><tr><th className="px-5">Empresa</th><th>Estado</th><th>Plan reportado</th><th>Registros</th><th>Dominio</th></tr></thead><tbody>{tenants.map(t=><tr className="border-t border-white/[0.06]" key={t.id}><td className="px-5 font-semibold text-white">{t.name}</td><td><span className="hub-state hub-state-neutral">{t.status}</span></td><td>{t.plan}</td><td>{t.metrics.totalRecords}</td><td className="max-w-48 truncate">{t.domain}</td></tr>)}{sourceAvailable&&tenants.length===0&&<tr><td colSpan={5} className="p-6 text-center text-slate-400">El conector no reportó tenants para este producto.</td></tr>}{!sourceAvailable&&<tr><td colSpan={5} className="p-6 text-center text-slate-400">Sin respuesta de la integración de clientes.</td></tr>}</tbody></table></div>
      </section>}
      {tab==="operation"&&<section className="hub-card space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="hub-section-heading">Operación técnica</h2><Link href="/software" className="hub-text-link">Abrir operaciones <ArrowUpRight className="h-4 w-4"/></Link></div>
        <div className="grid gap-3 sm:grid-cols-3"><DataCell label="Git local" value={app?.git.isRepo?app.git.branch||"Sin rama":"No disponible"}/><DataCell label="Commit local" value={app?.git.commitHash?app.git.commitHash.slice(0,10):"—"}/><DataCell label="Estado remoto" value={app?.git.remoteStatus||"—"}/></div>
        <h3 className="text-sm font-semibold text-white">Contenedores registrados</h3><div className="space-y-2">{containers.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><span className="font-mono text-xs text-white">{c.name}</span><span className="hub-state hub-state-neutral">{c.state} · {c.health}</span></div>)}{containers.length===0&&<p className="text-xs text-slate-400">No se detectaron contenedores para este producto.</p>}</div>
      </section>}
      {tab==="data"&&<section className="hub-card space-y-5 p-5 sm:p-6"><h2 className="hub-section-heading">Datos y copias</h2><div className="grid gap-3 sm:grid-cols-3">
        <DataCell label="Motor" value={app?.database?.type?.toUpperCase()||"—"}/>
        <DataCell label="Copias registradas" value={backups?copies.length:"—"}/>
        <DataCell label="Última integridad OK" value={backups?(last?formatDate(last.createdAt):"Ninguna"):"—"}/></div>
        <p className="text-xs leading-6 text-slate-400">El checksum de un archivo no demuestra una restauración completa. No se restauran bases productivas desde esta pantalla.</p>
        <Link href="/backups" className="hub-primary-action">Centro de backups <ArrowUpRight className="h-4 w-4"/></Link></section>}
      {tab==="settings"&&<section className="hub-card space-y-5 p-5 sm:p-6"><h2 className="hub-section-heading">Configuración e integraciones</h2>
        <div className="grid gap-3 sm:grid-cols-2">{[
          {name:"Lectura de tenants",state:product.capabilities.tenantRead},
          {name:"Estados y suscripciones",state:management?"connected":product.capabilities.statusWrite},
          {name:"Módulos y planes",state:management?"connected":product.capabilities.moduleWrite},
          {name:"Credenciales y sesiones",state:management?"connected":product.capabilities.impersonation},
          {name:"Datos del tenant",state:management?"connected":product.capabilities.settings},
          {name:"Actividad del tenant",state:management?"connected":product.capabilities.activity}
        ].map(x=><div key={x.name} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-4"><span className="text-[13px] text-slate-200">{x.name}</span><span className={qualityClass(x.state)}>{connected(x.state)}</span></div>)}</div>
        {management?<Link href={"/saas/"+slug+"/manage"} className="hub-primary-action">Gestionar empresas, planes, suscripciones, módulos y accesos</Link>:<NotConnected title="Configuración central en preparación" explanation="Las opciones de gestión requieren endpoints autenticados y auditables en cada SaaS antes de habilitarse."/>}
      </section>}
      {tab==="audit"&&<section className="hub-card space-y-4 p-5 sm:p-6"><h2 className="hub-section-heading">Auditoría del producto</h2>
        {management?<Link className="hub-primary-action" href={"/saas/"+slug+"/manage?section=audit"}>Consultar auditoría del producto</Link>:<NotConnected title="Eventos unificados pendientes" explanation="Todavía no hay un contrato por producto que devuelva sus eventos y acciones administrativas."/>}
        <Link className="hub-text-link" href="/superadmin">Ver estado del Superadmin <ArrowUpRight className="h-4 w-4"/></Link>
      </section>}
    </div>
  </div>;
}

