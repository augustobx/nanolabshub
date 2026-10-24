"use client";
import { Header } from "@/components/Header";
import type { getInfrastructureInventory } from "@/lib/infrastructure-inventory";
import { Activity,AlertTriangle,ArrowUpRight,Boxes,Cpu,Database,HardDrive,Network,RefreshCw,Server,Workflow } from "lucide-react";
import Link from "next/link";
import { useEffect,useState } from "react";
type Inventory = Awaited<ReturnType<typeof getInfrastructureInventory>>;
type Kind = keyof Inventory["groups"];
const kinds: Array<{id:Kind;name:string;desc:string;icon:typeof Server}> = [
  {id:"core",name:"Plataforma central",desc:"Proxy, administración y Hub",icon:Server},
  {id:"database",name:"Motores de datos",desc:"Bases de datos y cachés",icon:Database},
  {id:"service",name:"Servicios web",desc:"Aplicaciones y APIs",icon:Boxes},
  {id:"worker",name:"Procesos de fondo",desc:"Colas, colectores y automatizaciones",icon:Workflow},
  {id:"unassigned",name:"Sin clasificación",desc:"No aparecen en el registro de aplicaciones",icon:AlertTriangle},
];
const number = (value:number) => Number.isFinite(value) ? value.toFixed(1)+"%" : "—";
function statusTone(state:string,health:string,expectedStopped:boolean) {
  if(expectedStopped)return "hub-state hub-state-neutral";
  if(state==="running"&&health!=="unhealthy")return "hub-state hub-state-good";
  return "hub-state hub-state-warn";
}
export default function InfrastructurePage() {
  const [inventory,setInventory]=useState<Inventory|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<Kind>("core");
  const load=async(signal?:AbortSignal)=>{
    setLoading(true);
    try{
      const r=await fetch("/api/infrastructure",{cache:"no-store",signal});
      const result=await r.json();
      if(!r.ok||!result.success)throw Error(result.error||"Sin respuesta");
      if(signal?.aborted)return;
      setInventory(result.data);
      setError(null);
    }catch(e){if(!signal?.aborted){setInventory(null);setError(e instanceof Error?e.message:"Error al consultar la plataforma");}}
    finally{if(!signal?.aborted)setLoading(false);}
  };
  useEffect(()=>{
    const controller=new AbortController();
    void load(controller.signal);
    const id=window.setInterval(()=>{if(!document.hidden)void load(controller.signal);},90000);
    return ()=>{controller.abort();window.clearInterval(id);};
  },[]);
  const selectedGroup=inventory?.groups[selected]||[];
  const host=inventory?.host;
  return <div className="min-w-0 flex-1 pb-12"><Header onRefresh={()=>void load()} isRefreshing={loading}/>
    <div className="hub-content space-y-6">
      <section className="hub-hero flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl space-y-3">
          <p className="hub-eyebrow">Plataforma / Infraestructura</p>
          <h1 className="hub-hero-title">Cada servicio en su lugar.</h1>
          <p className="hub-description">Servidor, componentes centrales, motores de datos, servicios web y procesos de fondo. Datos provenientes del inventario Docker y telemetría, sin mezclar tenants con contenedores.</p>
        </div>
        <Link href="/hardware" className="hub-primary-action"><Activity className="h-4 w-4"/> Telemetría avanzada <ArrowUpRight className="h-4 w-4"/></Link>
      </section>
      {error&&<div role="alert" className="flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-xs text-amber-200"><AlertTriangle className="h-4 w-4"/><p>Inventario temporalmente no disponible: {error}. No se muestran estados estimados.</p><button onClick={()=>void load()} className="ml-auto flex items-center gap-1.5 underline"><RefreshCw className="h-4 w-4"/> Reintentar</button></div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="hub-card p-5"><div className="flex items-center gap-2 text-[13px] font-medium text-slate-400"><Cpu className="h-4 w-4"/> CPU</div><p className="mt-2 text-3xl font-semibold text-white">{host?number(host.cpu.usagePercent):"—"}</p><p className="mt-2 text-xs text-slate-400">{host?host.cpu.cores+" núcleos":"Sin lectura"}</p></div>
        <div className="hub-card p-5"><div className="flex items-center gap-2 text-[13px] font-medium text-slate-400"><Server className="h-4 w-4"/> Memoria</div><p className="mt-2 text-3xl font-semibold text-white">{host?number(host.memory.usedPercent):"—"}</p><p className="mt-2 text-xs text-slate-400">Uso actual de RAM</p></div>
        <div className="hub-card p-5"><div className="flex items-center gap-2 text-[13px] font-medium text-slate-400"><Boxes className="h-4 w-4"/> Contenedores</div><p className="mt-2 text-3xl font-semibold text-white">{inventory?inventory.totals.running:"—"}</p><p className="mt-2 text-xs text-slate-400">En ejecución</p></div>
        <div className="hub-card p-5"><div className="flex items-center gap-2 text-[13px] font-medium text-slate-400"><AlertTriangle className="h-4 w-4"/> Requieren revisión</div><p className="mt-2 text-3xl font-semibold text-white">{inventory?inventory.totals.unhealthy:"—"}</p><p className="mt-2 text-xs text-slate-400">Excluye paradas intencionales</p></div>
      </div>
      <section className="hub-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] p-5">
          <div><h2 className="hub-section-heading">Inventario técnico clasificado</h2><p className="mt-1 text-xs text-slate-400">Los componentes se agrupan por función y aplicación propietaria.</p></div>
          {inventory&&<span className="hub-state hub-state-neutral">{inventory.containers.length} contenedores detectados</span>}
        </div>
        <div className="grid lg:grid-cols-[250px_minmax(0,1fr)]">
          <nav className="flex gap-2 overflow-x-auto border-b border-white/[0.08] p-3 lg:flex-col lg:border-b-0 lg:border-r" aria-label="Tipos de componentes">
            {kinds.map(kind=>{
              const Icon=kind.icon, count=inventory?.groups[kind.id].length;
              return <button key={kind.id} type="button" aria-pressed={selected===kind.id}
                onClick={()=>setSelected(kind.id)}
                className={"flex min-w-[164px] items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors lg:w-full lg:min-w-0 "+
                  (selected===kind.id?"bg-[#314a6b] text-white":"text-slate-400 hover:bg-white/[0.055] hover:text-white")}>
                <Icon className="h-5 w-5 shrink-0 text-[#bbd0fb]"/>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">{kind.name}</span><span className="hidden text-[11px] text-slate-400 lg:block">{kind.desc}</span></span>
                <span className="text-xs">{count??"—"}</span>
              </button>;
            })}
          </nav>
          <div className="min-w-0 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-white">{kinds.find(k=>k.id===selected)?.name}</h3><p className="mt-1 text-xs text-slate-400">Estados del contenedor, no del tenant.</p></div><Link href="/operations" className="hub-text-link">Operación avanzada <ArrowUpRight className="h-4 w-4"/></Link></div>
            <div className="space-y-2">
              {selectedGroup.map(container=><div key={container.name} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="min-w-0 flex-1"><span className="block break-all font-mono text-[12px] font-semibold text-white">{container.name}</span><span className="mt-1 block truncate text-[11px] text-slate-400">Responsable: {container.appName||"Sin asignar"}</span></span>
                <span className={statusTone(container.state,container.health,container.expectedStopped)}>{container.expectedStopped?"Detenido a propósito":container.state==="running"?"En ejecución":"Detenido"}{container.health==="unhealthy"&&!container.expectedStopped?" · unhealthy":""}</span>
              </div>)}
              {inventory&&selectedGroup.length===0&&<div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-400">No hay componentes en esta categoría.</div>}
              {!inventory&&<div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-400">Cargando inventario seguro…</div>}
            </div>
          </div>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="hub-card p-5"><div className="flex items-center justify-between gap-2"><h2 className="hub-section-heading">Almacenamiento</h2><HardDrive className="h-5 w-5 text-[#abc2fa]"/></div><p className="mt-1 text-xs text-slate-400">Discos detectados por la telemetría del host.</p>
          <div className="mt-4 space-y-3">{host?.disks.map(d=><div key={d.mount+"-"+d.filesystem} className="rounded-xl border border-white/[0.08] p-3"><div className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-white">{d.mount}</span><span className="text-slate-300">{number(d.usedPercent)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#9bbafa]" style={{width:Math.max(0,Math.min(100,d.usedPercent))+"%"}}/></div></div>)}{!host&&<p className="text-xs text-slate-400">Sin datos de discos</p>}</div>
        </div>
        <div className="hub-card flex flex-col gap-4 p-5"><div className="flex items-center justify-between gap-2"><h2 className="hub-section-heading">Conectividad</h2><Network className="h-5 w-5 text-[#abc2fa]"/></div>
          <p className="text-xs leading-6 text-slate-400">La lista de dominios corresponde al registro de aplicaciones. El chequeo HTTP muestra disponibilidad pública; no certifica por sí solo la configuración de Nginx Proxy Manager ni DNS.</p>
          <p className="text-3xl font-semibold text-white">{inventory?inventory.totals.domains:"—"} <span className="text-[13px] font-medium text-slate-400">dominios declarados</span></p>
          <Link href="/networking" className="hub-primary-action mt-auto">Ver dominios <ArrowUpRight className="h-4 w-4"/></Link>
        </div>
      </section>
      <p className="text-[11px] text-slate-500">Última lectura: {inventory?new Date(inventory.timestamp).toLocaleString("es-AR"):"—"}. Consulta de solo lectura; ningún contenedor se reinicia desde esta vista.</p>
    </div>
  </div>;
}
