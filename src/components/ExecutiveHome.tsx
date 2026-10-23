"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "./Header";
import type { OperationsSnapshot } from "@/lib/operations";
import type { GovernanceOverview, BackupRecord, AppInfo } from "@/lib/types";
import { SAAS_PRODUCTS, portfolioSegment } from "@/lib/product-taxonomy";
import {
  ArrowUpRight, ShieldCheck, DatabaseBackup, LayoutGrid, Building2,
  Activity, AlertTriangle, ServerCog, ChevronRight, RefreshCw, GitBranch
} from "lucide-react";

function OperationalState({ app }: { app?: AppInfo }) {
  if (!app) return <span className="hub-state hub-state-neutral">Sin datos</span>;
  const state = app.lifecycle?.state || "active";
  if (state !== "active") return <span className="hub-state hub-state-neutral">{state === "archived" ? "Archivada" : state === "suspended" ? "Suspendida" : "Baja pendiente"}</span>;
  if (app.status === "operational") return <span className="hub-state hub-state-good">Operativa</span>;
  if (app.status === "not_deployed") return <span className="hub-state hub-state-neutral">No desplegada</span>;
  return <span className="hub-state hub-state-warn">Revisar estado</span>;
}
function Tile({ title, value, note, href, icon: Icon }: {
  title: string; value: string; note: string; href: string; icon: typeof Activity;
}) {
  return <Link href={href} className="hub-card group flex flex-col gap-3 p-5 transition-colors hover:border-[#8caee6]/50">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-semibold text-[#c3d0df]">{title}</span>
      <Icon className="h-5 w-5 text-[#a0bbf3]" />
    </div>
    <div className="text-[32px] font-semibold tracking-[-0.04em] text-white">{value}</div>
    <div className="mt-auto flex items-center justify-between gap-2 text-[12px] leading-5 text-[#95a9c1]">
      <span>{note}</span><ArrowUpRight className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </div>
  </Link>;
}
export function ExecutiveHome() {
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [governance, setGovernance] = useState<GovernanceOverview | null>(null);
  const [backups, setBackups] = useState<BackupRecord[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const paths = ["/api/operations", "/api/governance", "/api/backups"];
    const results = await Promise.allSettled(paths.map(async (url) => {
      const response = await fetch(url, { cache: "no-store", signal });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Servicio no disponible");
      return json;
    }));
    if (signal?.aborted) return;
    const [ops, gov, backup] = results;
    if (ops.status === "fulfilled") setSnapshot(ops.value.data);
    if (gov.status === "fulfilled") setGovernance(gov.value.data);
    if (backup.status === "fulfilled") setBackups(backup.value.data);
    setErrors(results.flatMap((result, index) =>
      result.status === "rejected" ? [paths[index] + ": " + String(result.reason?.message || "sin respuesta")] : []));
    setLoading(false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const interval = window.setInterval(() => {
      if (!document.hidden) void load(controller.signal);
    }, 90000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [load]);

  const apps = snapshot?.apps || [];
  const current = apps.filter(a => (a.lifecycle?.state || "active") === "active");
  const saas = SAAS_PRODUCTS.map(p => ({ product: p, app: apps.find(a => a.slug === p.slug) }));
  const issues = useMemo(() => current.flatMap(app => {
    const notes: { slug: string; label: string; detail: string; href: string }[] = [];
    if (app.status === "down" || app.status === "degraded") notes.push({
      slug: app.slug, label: app.name, detail: "Contenedores o servicio requieren revisión", href: "/operations"
    });
    if (app.git.dirtyFilesCount > 0) notes.push({
      slug: app.slug + "-git", label: app.name, detail: String(app.git.dirtyFilesCount) + " cambios locales sin confirmar", href: "/software"
    });
    if (app.git.remoteStatus === "different") notes.push({
      slug: app.slug + "-diff", label: app.name, detail: "Commit local y remoto diferentes", href: "/software"
    });
    if (app.web?.status === "offline" || app.web?.status === "http_error") notes.push({
      slug: app.slug + "-web", label: app.name, detail: "Revisar acceso web", href: "/networking"
    });
    return notes;
  }), [current]);
  const missingBackups = backups ? saas.filter(x => !backups.some(b => b.appSlug === x.product.slug && b.status === "verified")).length : null;
  const healthy = saas.filter(x => x.app?.status === "operational" && (x.app.lifecycle?.state || "active") === "active").length;
  const running = snapshot?.containers.filter(c => c.state === "running").length;
  const activeTenants = governance?.sources?.some(s=>s.status==="available") ? governance.activeTenants : null;
  const countInternal = current.filter(a => portfolioSegment(a) === "internal").length;

  return <div className="min-w-0 flex-1 pb-12">
    <Header onRefresh={() => void load()} isRefreshing={loading} />
    <div className="hub-content space-y-7">
      <section className="hub-hero flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <p className="hub-eyebrow">Vista general · NanoLabs</p>
          <h1 className="hub-hero-title">Toda tu operación, en orden.</h1>
          <p className="hub-description">Un resumen para decidir qué necesita atención. La gestión de clientes, SaaS y servidor tiene su propio espacio, sin mezclar funciones.</p>
        </div>
        <Link href="/superadmin" className="hub-primary-action shrink-0">Ir a Superadmin <ArrowUpRight className="h-4 w-4" /></Link>
      </section>

      {errors.length > 0 && <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-4 py-3 text-[12px] text-amber-100">
        <AlertTriangle className="h-4 w-4" />
        Algunos datos no pudieron actualizarse ({errors.length}). Se mantienen identificados como no disponibles.
        <button onClick={() => void load()} className="ml-auto inline-flex items-center gap-1.5 font-semibold underline"><RefreshCw className="h-3.5 w-3.5" /> Reintentar</button>
      </div>}

      <section aria-label="Indicadores generales" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile title="Productos SaaS" value={snapshot ? healthy + " / " + SAAS_PRODUCTS.length : "—"}
          note="Operativos en el inventario Docker" href="/saas" icon={LayoutGrid}/>
        <Tile title="Tenants activos" value={activeTenants == null ? "—" : String(activeTenants)}
          note={governance?.sources?.every(x=>x.status==="available") ? "Según conectores de las SaaS" : "Cobertura parcial o pendiente"} href="/governance" icon={Building2}/>
        <Tile title="Contenedores activos" value={running == null ? "—" : String(running)}
          note={snapshot ? String(snapshot.containers.length) + " detectados" : "Sin telemetría"} href="/operations" icon={ServerCog}/>
        <Tile title="SaaS sin backup íntegro" value={missingBackups == null ? "—" : String(missingBackups)}
          note="No equivale a restauración comprobada" href="/backups" icon={DatabaseBackup}/>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <section className="hub-card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-5 sm:px-6">
            <div>
              <h2 className="hub-section-heading">Productos SaaS</h2>
              <p className="mt-1 text-[12px] text-slate-400">Un acceso consistente para cada plataforma.</p>
            </div>
            <Link href="/saas" className="hub-text-link">Ver portafolio <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {saas.map(({ product, app }) => <Link key={product.slug} href={"/saas/" + product.slug}
              className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.025] p-3.5 hover:border-[#a0bbf3]/40 hover:bg-white/[0.06]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#253b57] text-[16px] font-black text-[#d5e2f9]">{product.name.slice(4, 5) || "N"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-white">{product.name}</span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-400">{product.focus}</span>
                <span className="mt-2 block"><OperationalState app={app}/></span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-[#c1d4fb]"/>
            </Link>)}
          </div>
        </section>

        <section className="hub-card min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-5 sm:px-6">
            <div>
              <h2 className="hub-section-heading">Requiere atención</h2>
              <p className="mt-1 text-[12px] text-slate-400">Incidencias reales del inventario.</p>
            </div>
            <span className="hub-state hub-state-neutral">{snapshot ? issues.length : "—"}</span>
          </div>
          <div className="space-y-2 p-4 sm:p-5">
            {!snapshot ? <p className="py-8 text-center text-[13px] text-slate-400">No hay datos operativos disponibles.</p> :
              issues.length === 0 ? <div className="flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-4 py-5 text-[13px] text-emerald-200"><ShieldCheck className="h-5 w-5"/> No se detectaron incidencias en las comprobaciones actuales.</div> :
              issues.slice(0, 6).map(issue => <Link key={issue.slug} href={issue.href} className="group flex items-start gap-3 rounded-xl border border-white/[0.07] p-3.5 hover:bg-white/[0.045]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"/>
                <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold text-white">{issue.label}</span>
                <span className="mt-1 block text-[11px] leading-5 text-slate-400">{issue.detail}</span></span>
                <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-white"/>
              </Link>)}
            {snapshot && issues.length > 6 && <Link href="/operations" className="hub-text-link px-2 py-2">Ver todas las incidencias ({issues.length})</Link>}
          </div>
        </section>
      </div>

      <section aria-label="Áreas del Hub" className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Superadmin y tenants", note: "Estado de clientes, planes y módulos de cada SaaS", href: "/superadmin", icon: ShieldCheck },
          { title: "Herramientas internas", note: String(countInternal) + " aplicaciones internas activas registradas", href: "/software?segment=internal", icon: LayoutGrid },
          { title: "Continuidad operativa", note: "Backups, recuperación y ciclo de vida", href: "/backups", icon: DatabaseBackup },
        ].map(item => {
          const Icon = item.icon;
          return <Link key={item.title} href={item.href} className="hub-card group flex items-center gap-3 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#273b54]"><Icon className="h-5 w-5 text-[#bfd2fa]"/></span>
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-white">{item.title}</span>
              <span className="mt-1 block text-[12px] leading-5 text-slate-400">{item.note}</span></span>
            <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-white"/>
          </Link>;
        })}
      </section>
    </div>
  </div>;
}
