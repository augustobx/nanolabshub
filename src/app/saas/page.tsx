"use client";
import { Header } from "@/components/Header";
import type { OperationsSnapshot } from "@/lib/operations";
import { SAAS_PRODUCTS } from "@/lib/product-taxonomy";
import type { GovernanceOverview } from "@/lib/types";
import { AlertTriangle,ArrowRight,ChevronRight,Search,Users } from "lucide-react";
import Link from "next/link";
import { useEffect,useState } from "react";

export default function SaaSCatalogPage() {
  const [operations, setOperations] = useState<OperationsSnapshot | null>(null);
  const [governance, setGovernance] = useState<GovernanceOverview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const resources = await Promise.allSettled([
      fetch("/api/operations", {cache:"no-store"}).then(async r => {const j=await r.json();if(!r.ok||!j.success)throw Error();return j.data as OperationsSnapshot;}),
      fetch("/api/governance", {cache:"no-store"}).then(async r => {const j=await r.json();if(!r.ok||!j.success)throw Error();return j.data as GovernanceOverview;}),
    ]);
    setErrors(resources.flatMap((r,i) => r.status === "rejected" ? [i === 0 ? "Operación" : "Tenants"] : []));
    if(resources[0].status === "fulfilled") setOperations(resources[0].value); else setOperations(null);
    if(resources[1].status === "fulfilled") setGovernance(resources[1].value); else setGovernance(null);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const products = SAAS_PRODUCTS.filter(p => (p.name + " " + p.focus).toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  return <div className="flex-1 pb-12">
    <Header onRefresh={() => void load()} isRefreshing={loading}/>
    <div className="hub-content space-y-6">
      <section className="hub-hero flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl space-y-3">
          <p className="hub-eyebrow">Negocio / Productos SaaS</p>
          <h1 className="hub-hero-title">Un ecosistema. Un mismo estándar.</h1>
          <p className="hub-description">Cada SaaS tiene una ficha con las mismas secciones: clientes, operación, datos, configuración y auditoría. Las funciones aún no conectadas se identifican, sin simular resultados.</p>
        </div>
        <Link className="hub-primary-action" href="/governance">Gestionar tenants <ArrowRight className="h-4 w-4"/></Link>
      </section>
      {errors.length > 0 && <p role="status" className="rounded-xl border border-amber-400/20 p-3 text-xs text-amber-200">Algunos conectores no respondieron: {errors.join(", ")}. No se muestran datos inventados.</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="hub-card p-5"><span className="text-xs font-medium text-slate-400">Productos definidos</span><p className="mt-2 text-[28px] font-semibold text-white">{SAAS_PRODUCTS.length}</p><span className="text-xs text-slate-400">Contrato visual compartido</span></div>
        <div className="hub-card p-5"><span className="text-xs font-medium text-slate-400">Tenants reportados</span><p className="mt-2 text-[28px] font-semibold text-white">{governance && governance.sources?.some(x=>x.status === "available") ? governance.totalTenants : "—"}</p><span className="text-xs text-slate-400">Por conectores disponibles</span></div>
        <div className="hub-card p-5"><span className="text-xs font-medium text-slate-400">SaaS operativas</span><p className="mt-2 text-[28px] font-semibold text-white">{operations ? SAAS_PRODUCTS.filter(p => operations.apps.some(a => a.slug === p.slug && a.status === "operational" && (a.lifecycle?.state || "active") === "active")).length : "—"}</p><span className="text-xs text-slate-400">Según contenedores registrados</span></div>
      </div>
      <div className="hub-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] p-5">
          <div><h2 className="hub-section-heading">Plataformas</h2><p className="mt-1 text-xs text-slate-400">Elegí un producto para entrar al mismo panel de gestión.</p></div>
          <label className="relative block w-full sm:w-60"><span className="sr-only">Buscar SaaS</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input type="search" placeholder="Buscar SaaS" value={query} onChange={e => setQuery(e.target.value)} className="hub-field w-full pl-10"/></label>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 sm:p-5">
          {products.map((p) => {
            const app = operations?.apps.find(a => a.slug === p.slug);
            const source = governance?.sources?.find(item => item.saas === p.slug);
            const count = source?.status === "available" ? source.count : null;
            const inactive = app?.lifecycle?.state && app.lifecycle.state !== "active";
            const healthy = app?.status === "operational" && !inactive;
            return <Link key={p.slug} href={"/saas/" + p.slug} aria-label={"Abrir " + p.name}
              className="group flex min-w-0 flex-col gap-5 rounded-2xl border border-white/[0.1] bg-[#1c2e43]/80 p-5 transition hover:border-[#9cbcf4]/50 hover:bg-[#253951]">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#324b6c] text-xl font-black text-[#dce8ff]">{p.name.slice(4,5)}</span>
                <span className={healthy ? "hub-state hub-state-good" : !app ? "hub-state hub-state-neutral" : "hub-state hub-state-warn"}>
                  {!app ? "Por consultar" : inactive ? "Inactiva" : healthy ? "Operativa" : "Revisar"}
                </span>
              </div>
              <div><h3 className="text-lg font-semibold tracking-tight text-white">{p.name}</h3><p className="mt-1 text-[13px] text-slate-400">{p.focus}</p></div>
              <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4">
                <span className="flex items-center gap-2 text-xs text-[#b9c9df]"><Users className="h-4 w-4"/> {count == null ? "Conector pendiente" : count + " tenants reportados"}</span>
                <ChevronRight className="h-4 w-4 text-[#a5bbd9] transition group-hover:translate-x-0.5"/>
              </div>
            </Link>;
          })}
          {products.length === 0 && <p className="col-span-full p-8 text-center text-[13px] text-slate-400">No se encontraron productos con ese nombre.</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.1] bg-white/[0.025] px-5 py-4">
        <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300"/><p className="text-xs leading-5 text-slate-400">Cada plataforma informa sus capacidades disponibles mediante su conector autenticado. Las acciones pendientes se señalan dentro de cada ficha.</p></div>
        <Link href="/superadmin" className="hub-text-link">Ver integraciones <ArrowRight className="h-4 w-4"/></Link>
      </div>
    </div>
  </div>;
}
