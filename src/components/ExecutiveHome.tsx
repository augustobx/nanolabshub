"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Clock,
  DatabaseBackup,
  LayoutDashboard,
  LayoutGrid,
  RefreshCw,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import type { OperationsSnapshot } from "@/lib/operations";
import { INDEPENDENT_BILLED_APPS, INSTITUTIONAL_APPS, SAAS_PRODUCTS } from "@/lib/product-taxonomy";
import type { AppInfo, BackupRecord, GovernanceOverview, IndependentContract, UniversalTenant } from "@/lib/types";
import {
  Cargando,
  Encabezado,
  Indicador,
  NanoLabsAlert,
  NanoLabsButton,
  NanoLabsChip,
} from "./nanolabs";

function daysUntil(isoDate?: string | null): number | null {
  if (!isoDate) return null;
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) return null;
  return Math.ceil((ts - Date.now()) / 86400000);
}

function appBadge(app?: AppInfo) {
  if (!app) return <NanoLabsChip severity="neutral">Sin datos</NanoLabsChip>;
  const state = app.lifecycle?.state || "active";
  if (state !== "active") {
    return (
      <NanoLabsChip severity="neutral">
        {state === "archived" ? "Archivada" : state === "suspended" ? "Suspendida" : "Baja pendiente"}
      </NanoLabsChip>
    );
  }
  if (app.status === "operational") return <NanoLabsChip severity="success">Operativa</NanoLabsChip>;
  if (app.status === "not_deployed") return <NanoLabsChip severity="neutral">No desplegada</NanoLabsChip>;
  return <NanoLabsChip severity="warning">Revisar</NanoLabsChip>;
}

export function ExecutiveHome() {
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [governance, setGovernance] = useState<GovernanceOverview | null>(null);
  const [backups, setBackups] = useState<BackupRecord[] | null>(null);
  const [independent, setIndependent] = useState<IndependentContract[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const paths = ["/api/operations", "/api/governance", "/api/backups", "/api/independent-billing"];
    const results = await Promise.allSettled(
      paths.map(async (url) => {
        const response = await fetch(url, { cache: "no-store", signal });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || "Servicio no disponible");
        return json;
      })
    );
    if (signal?.aborted) return;
    const [ops, gov, backup, ind] = results;
    setSnapshot(ops.status === "fulfilled" ? ops.value.data : null);
    setGovernance(gov.status === "fulfilled" ? gov.value.data : null);
    setBackups(backup.status === "fulfilled" ? backup.value.data : null);
    setIndependent(ind.status === "fulfilled" && Array.isArray(ind.value.data) ? ind.value.data : []);
    setErrors(
      results.flatMap((result, index) =>
        result.status === "rejected"
          ? [`${paths[index]}: ${String(result.reason?.message || "sin respuesta")}`]
          : []
      )
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const interval = window.setInterval(() => {
      if (!document.hidden) void load(controller.signal);
    }, 90000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [load]);

  const apps = useMemo(() => snapshot?.apps || [], [snapshot]);
  const current = useMemo(
    () => apps.filter((a) => (a.lifecycle?.state || "active") === "active"),
    [apps]
  );

  const saasList = useMemo(
    () =>
      SAAS_PRODUCTS.map((p) => {
        const app = apps.find((a) => a.slug === p.slug);
        const source = governance?.sources?.find((s) => s.saas === p.slug);
        const tenants = (governance?.tenants || []).filter((t) => t.saas === p.slug);
        const managed = governance?.managementProducts?.includes(p.slug) ?? false;
        const expiring = tenants.filter((t) => {
          const d = daysUntil(t.planExpiresAt);
          return d !== null && d <= 7;
        }).length;
        return { product: p, app, source, tenants, managed, expiring };
      }),
    [apps, governance]
  );

  const membershipAlerts = useMemo(() => {
    const tenants = governance?.tenants || [];
    return tenants
      .filter((t: UniversalTenant) => {
        if (t.status === "SUSPENDED" || t.status === "CANCELED") return true;
        const d = daysUntil(t.planExpiresAt);
        return d !== null && d <= 7;
      })
      .sort((a, b) => (daysUntil(a.planExpiresAt) ?? 999) - (daysUntil(b.planExpiresAt) ?? 999));
  }, [governance]);

  const infraIssues = useMemo(
    () =>
      current.flatMap((app) => {
        const notes: { id: string; label: string; detail: string; href: string }[] = [];
        if (app.status === "down" || app.status === "degraded") {
          notes.push({
            id: app.slug,
            label: app.name,
            detail: "Contenedores o servicio requieren revisión",
            href: "/infraestructura",
          });
        }
        if (app.git.dirtyFilesCount > 0) {
          notes.push({
            id: `${app.slug}-git`,
            label: app.name,
            detail: `${app.git.dirtyFilesCount} cambios locales sin confirmar`,
            href: "/infraestructura",
          });
        }
        if (app.git.remoteStatus === "different") {
          notes.push({
            id: `${app.slug}-diff`,
            label: app.name,
            detail: "Commit local y remoto diferentes",
            href: "/infraestructura",
          });
        }
        if (app.web?.status === "offline" || app.web?.status === "http_error") {
          notes.push({
            id: `${app.slug}-web`,
            label: app.name,
            detail: "Revisar acceso web público",
            href: "/infraestructura?tab=dominios",
          });
        }
        return notes;
      }),
    [current]
  );

  const missingBackups = backups
    ? saasList.filter((x) => !backups.some((b) => b.appSlug === x.product.slug && b.status === "verified")).length
    : null;
  const healthy = saasList.filter(
    (x) => x.app?.status === "operational" && (x.app.lifecycle?.state || "active") === "active"
  ).length;
  const running = snapshot?.containers.filter((c) => c.state === "running").length;
  const hasAnyGovSource = governance?.sources?.some((s) => s.status === "available");

  return (
    <div className="ot-pagina">
      <Encabezado
        icono={LayoutDashboard}
        antetitulo="NanoLabs Hub · Centro de comando"
        titulo="Toda tu operación, en un solo lugar."
        bajada="Control rápido de membresías, salud de tus SaaS, servidor y respaldos sin pantallas duplicadas."
        accion={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/clientes" className="hub-primary-action">
              <Building2 size={15} />
              <span>Ir a Membresías</span>
            </Link>
            <NanoLabsButton
              variant="secondary"
              size="small"
              onClick={() => void load()}
              disabled={loading}
              icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
            >
              {loading ? "Actualizando…" : "Actualizar"}
            </NanoLabsButton>
          </div>
        }
      />

      {errors.length > 0 && (
        <NanoLabsAlert
          severity="warning"
          title={`Algunos datos no pudieron actualizarse (${errors.length})`}
          description={errors.join(" · ")}
        />
      )}

      {loading && !snapshot && !governance ? (
        <Cargando texto="Consultando estado de plataforma y SaaS…" />
      ) : (
        <>
          <div className="bh-stats ot-stats-4">
            <Link href="/clientes" style={{ textDecoration: "none" }}>
              <Indicador
                tono={healthy === SAAS_PRODUCTS.length ? "success" : "primary"}
                icono={LayoutGrid}
                valor={snapshot ? `${healthy} / ${SAAS_PRODUCTS.length}` : "—"}
                etiqueta="SaaS operativas"
                onClick={() => undefined}
              />
            </Link>
            <Link href="/clientes?vencimiento=atencion" style={{ textDecoration: "none" }}>
              <Indicador
                tono={membershipAlerts.length > 0 ? "warning" : "success"}
                icono={Clock}
                valor={hasAnyGovSource ? membershipAlerts.length : "—"}
                etiqueta="Membresías a revisar"
                onClick={() => undefined}
              />
            </Link>
            <Link href="/infraestructura" style={{ textDecoration: "none" }}>
              <Indicador
                tono="info"
                icono={ServerCog}
                valor={running == null ? "—" : `${running} / ${snapshot?.containers.length ?? 0}`}
                etiqueta="Contenedores activos"
                onClick={() => undefined}
              />
            </Link>
            <Link href="/backups" style={{ textDecoration: "none" }}>
              <Indicador
                tono={missingBackups && missingBackups > 0 ? "danger" : "success"}
                icono={DatabaseBackup}
                valor={missingBackups == null ? "—" : missingBackups}
                etiqueta="SaaS sin backup verificado"
                onClick={() => undefined}
              />
            </Link>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
            {/* Ecosistema SaaS */}
            <section className="bh-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="hub-section-heading">Ecosistema SaaS</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Acceso directo a clientes, vencimientos y planes de cada producto.
                  </p>
                </div>
                <Link href="/clientes" className="hub-text-link">
                  Ver todos los clientes <ArrowUpRight size={14} />
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {saasList.map(({ product, app, source, tenants, managed, expiring }) => (
                  <div
                    key={product.slug}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-orange-400/50 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-bold">{product.name}</h3>
                          {managed && <NanoLabsChip severity="special">Gestión</NanoLabsChip>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{product.focus}</p>
                      </div>
                      {appBadge(app)}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {source?.status === "available"
                            ? `${tenants.length} clientes`
                            : source?.status === "disabled"
                            ? "Conector desactivado"
                            : "Sin lectura"}
                        </span>
                        {expiring > 0 && (
                          <NanoLabsChip severity="warning">{expiring} por vencer/venc.</NanoLabsChip>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Link href={`/clientes?saas=${product.slug}`} className="hub-text-link">
                          Clientes
                        </Link>
                        {managed && (
                          <Link href={`/clientes?saas=${product.slug}&tab=planes`} className="hub-text-link">
                            Planes
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Apps independientes del circuito ({INDEPENDENT_BILLED_APPS.length} con cobro · {INSTITUTIONAL_APPS.length} institucional)
                  </h3>
                  <Link href="/clientes?saas=__independent__" className="hub-text-link text-xs">
                    Gestionar cobros <ArrowUpRight size={13} />
                  </Link>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {independent.map((c) => {
                    const app = apps.find((a) => a.slug === c.slug);
                    return (
                      <Link
                        key={c.slug}
                        href={`/clientes?saas=${c.slug}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs transition-colors hover:border-orange-400/50 dark:border-slate-800"
                        style={{ textDecoration: "none" }}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold">{c.appName}</p>
                          <p className="truncate text-[11px] text-slate-500">
                            {c.status} · Vence {new Date(c.periodEnd).toLocaleDateString("es-AR")}
                          </p>
                        </div>
                        {appBadge(app)}
                      </Link>
                    );
                  })}
                  {INSTITUTIONAL_APPS.map((inst) => {
                    const app = apps.find((a) => a.slug === inst.slug);
                    return (
                      <Link
                        key={inst.slug}
                        href="/infraestructura"
                        className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-xs dark:border-slate-800"
                        style={{ textDecoration: "none" }}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold">{inst.name}</p>
                          <p className="truncate text-[11px] text-slate-500">Web propia · Sin cobro</p>
                        </div>
                        {appBadge(app)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Atención inmediata */}
            <section className="bh-card space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="hub-section-heading">Atención inmediata</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Membresías por vencer, vencidas o incidentes técnicos.
                  </p>
                </div>
                <NanoLabsChip
                  severity={membershipAlerts.length + infraIssues.length > 0 ? "warning" : "success"}
                >
                  {membershipAlerts.length + infraIssues.length}
                </NanoLabsChip>
              </div>

              <div className="space-y-2">
                {membershipAlerts.slice(0, 4).map((t) => {
                  const d = daysUntil(t.planExpiresAt);
                  const detail =
                    t.status === "SUSPENDED" || t.status === "CANCELED"
                      ? `Estado ${t.status}`
                      : d !== null && d < 0
                      ? `Membresía vencida hace ${Math.abs(d)} días`
                      : d === 0
                      ? "Membresía vence hoy"
                      : `Vence en ${d} días`;
                  return (
                    <Link
                      key={`mem-${t.saas}-${t.id}`}
                      href={`/clientes?saas=${t.saas}&tenantId=${encodeURIComponent(t.id)}`}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                      style={{ textDecoration: "none" }}
                    >
                      <Clock size={16} className="mt-0.5 shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                          {t.name} · <span className="opacity-70">{t.saasName}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
                      </div>
                      <ArrowUpRight size={14} className="shrink-0 text-slate-400" />
                    </Link>
                  );
                })}

                {infraIssues.slice(0, 4).map((issue) => (
                  <Link
                    key={issue.id}
                    href={issue.href}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    style={{ textDecoration: "none" }}
                  >
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{issue.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{issue.detail}</p>
                    </div>
                    <ArrowUpRight size={14} className="shrink-0 text-slate-400" />
                  </Link>
                ))}

                {membershipAlerts.length === 0 && infraIssues.length === 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-500">
                    <ShieldCheck size={18} />
                    <span>No se detectaron membresías vencidas ni incidentes activos.</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
