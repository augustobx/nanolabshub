"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowUpRight, Boxes, Building2, Cpu,
  ExternalLink, GitBranch, HardDrive, Layers, RefreshCw, RotateCw, Search,
  Server, Terminal, Wifi, DatabaseBackup,
} from "lucide-react";
import { Header } from "@/components/Header";
import { TerminalModal } from "@/components/TerminalModal";
import type { AppInfo, ContainerInfo } from "@/lib/types";
import type { OperationsSnapshot } from "@/lib/operations";

const shortSha = (sha?: string | null) => sha && /^[a-f0-9]{40}$/i.test(sha) ? sha.slice(0, 8) : "—";
const fmtBytes = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

function Pill({ text, tone = "neutral" }: { text: string; tone?: "good" | "bad" | "warn" | "neutral" }) {
  const tones = {
    good: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    bad: "bg-rose-400/10 text-rose-300 border-rose-400/20",
    warn: "bg-amber-400/10 text-amber-200 border-amber-400/20",
    neutral: "bg-slate-400/10 text-slate-300 border-white/10",
  };
  return <span className={`inline-flex items-center whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{text}</span>;
}
function WebBadge({ app }: { app: AppInfo }) {
  switch (app.web?.status) {
    case "online": return <Pill text={`Online${app.web.latencyMs != null ? ` · ${app.web.latencyMs} ms` : ""}`} tone="good" />;
    case "restricted": return <Pill text={`Restringida · ${app.web.httpStatus}`} tone="warn" />;
    case "http_error": return <Pill text={`Web HTTP ${app.web.httpStatus || "error"}`} tone="warn" />;
    case "offline": return <Pill text="Sin conexión web" tone="bad" />;
    default: return <Pill text="Sin comprobación" />;
  }
}
function GitBadge({ app }: { app: AppInfo }) {
  if (app.git.remoteStatus === "synced" && app.git.dirtyFilesCount > 0) {
    return <Pill text={`Mismo commit · ${app.git.dirtyFilesCount} cambios locales`} tone="warn" />;
  }
  if (app.git.remoteStatus === "synced") return <Pill text={app.git.remoteRef === "HEAD" ? "Coincide con HEAD remoto" : "Mismo commit remoto"} tone="good" />;
  if (app.git.remoteStatus === "different") return <Pill text={app.git.remoteRef === "HEAD" ? "Distinto al HEAD remoto" : "Commits diferentes"} tone="warn" />;
  if (app.git.remoteStatus === "not_repo") return <Pill text="Sin Git local" />;
  return <span title={app.git.remoteError || app.git.localError || "No se pudo confirmar el commit remoto"}><Pill text={app.git.localError ? "Revisar Git local" : app.git.remoteError ? "Remoto no consultable" : "Git remoto no accesible"} /></span>;
}
function Metric({ label, value, detail, icon: Icon, percent, warning }: {
  label: string; value: string; detail: string; icon: typeof Cpu; percent?: number; warning?: boolean;
}) {
  return (
    <div className="hub-card flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <Icon className={`h-[18px] w-[18px] ${warning ? "text-amber-300" : "text-[#a9bdff]"}`} />
      </div>
      <div className="text-[26px] font-bold tracking-tight text-white">{value}</div>
      {percent !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-[#303d50]">
          <div className={`h-full rounded-full ${warning ? "bg-amber-400" : "bg-[#94aefa]"}`}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        </div>
      )}
      <div className="text-[11px] leading-5 text-slate-400">{detail}</div>
    </div>
  );
}

export function OperationsDashboard() {
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "attention">("all");
  const [showFinishedTasks, setShowFinishedTasks] = useState(false);
  const [terminal, setTerminal] = useState({ open: false, title: "", output: "", loading: false });

  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch("/api/operations", { cache: "no-store", signal });
      const json = await response.json();
      if (!response.ok || !json.success || !json.data) throw new Error(json.error || "Error de conexión");
      if (signal?.aborted) return;
      setSnapshot(json.data as OperationsSnapshot);
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "No se pudieron actualizar las mediciones");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    const interval = window.setInterval(() => {
      if (!document.hidden) void reload(controller.signal);
    }, 60000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [reload]);

  const openLogs = async (containerName: string) => {
    setTerminal({ open: true, title: `Logs de ${containerName}`, output: "", loading: true });
    try {
      const response = await fetch(`/api/apps/logs?container=${encodeURIComponent(containerName)}&lines=150`);
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "No se pudieron consultar los logs");
      setTerminal({ open: true, title: `Logs de ${containerName}`, output: json.data.logs, loading: false });
    } catch (err) {
      setTerminal({ open: true, title: `Logs de ${containerName}`, output: err instanceof Error ? err.message : "Error", loading: false });
    }
  };

  const restart = async (containerName: string) => {
    if (!window.confirm(`Vas a reiniciar el contenedor "${containerName}" en producción. Puede interrumpir el servicio. ¿Confirmás?`)) return;
    setTerminal({ open: true, title: `Reinicio de ${containerName}`, output: "Solicitando reinicio a Docker…", loading: true });
    try {
      const response = await fetch("/api/apps/restart", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ containerName }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "No se pudo reiniciar");
      setTerminal({ open: true, title: `Reinicio de ${containerName}`, output: json.data.output || "Reinicio completado.", loading: false });
      await reload();
    } catch (err) {
      setTerminal({ open: true, title: `Reinicio de ${containerName}`, output: `Error: ${err instanceof Error ? err.message : "Desconocido"}`, loading: false });
    }
  };

  const apps = snapshot?.apps ?? [];
  const containers = snapshot?.containers ?? [];
  const metrics = snapshot?.telemetry;
  const running = containers.filter((c) => c.state === "running").length;
  const finishedTasks = containers.filter((c) => c.isJob && c.state === "exited" && c.exitCode === 0);
  const visibleContainers = containers.filter((c) =>
    showFinishedTasks || !(c.isJob && c.state === "exited" && c.exitCode === 0)
  );
  const unhealthy = containers.filter((c) => c.health === "unhealthy" ||
    (c.state === "exited" && !(c.isJob && c.exitCode === 0))).length;
  const gitDiff = apps.filter((a) => a.git.remoteStatus === "different").length;
  const dirtyGitApps = apps.filter((a) => a.git.isRepo && a.git.dirtyFilesCount > 0).length;
  const gitReview = apps.filter((a) => a.git.remoteStatus === "different" || a.git.dirtyFilesCount > 0).length;
  const websitesDown = apps.filter((a) => a.web?.status === "offline").length;
  const websitesWithHttpErrors = apps.filter((a) => a.web?.status === "http_error").length;
  const attention = apps.filter((app) =>
    app.git.remoteStatus === "different" || app.git.dirtyFilesCount > 0 || app.web?.status === "offline" || app.web?.status === "http_error" ||
    app.status === "down" || app.status === "degraded"
  ).length;

  const filtered = useMemo(() => apps.filter((app) => {
    if (scope === "attention" && !(app.git.remoteStatus === "different" || app.git.dirtyFilesCount > 0 || app.web?.status === "offline" ||
      app.web?.status === "http_error" || app.status === "down" || app.status === "degraded")) return false;
    const query = search.trim().toLocaleLowerCase("es");
    return !query || [app.name, app.slug, app.path].some((text) => text.toLocaleLowerCase("es").includes(query));
  }).sort((a, b) => {
    const priority = (app: AppInfo) => Number(app.web?.status === "offline") * 4 + Number(app.web?.status === "http_error") * 2 +
      Number(app.status === "down") * 3 + Number(app.git.remoteStatus === "different") * 2 +
      Number(app.git.dirtyFilesCount > 0);
    return priority(b) - priority(a) || a.name.localeCompare(b.name, "es");
  }), [apps, search, scope]);

  const firstSeen = snapshot?.timestamp
    ? new Date(snapshot.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col pb-12">
      <Header onRefresh={() => void reload()} isRefreshing={loading} />
      <main className="hub-content space-y-7">
        <section className="relative overflow-hidden rounded-[22px] border border-[#5774ae]/30 bg-gradient-to-br from-[#233957] via-[#192b42] to-[#172233] px-5 py-6 sm:px-8 sm:py-7">
          <div className="absolute -right-20 -top-32 h-72 w-72 rounded-full bg-[#708ff9]/[0.09] blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[.17em] text-[#b5c7ff]">NanoLabs / Operación en vivo</span>
                {error ? <Pill text="Conexión sin verificar" tone="bad" />
                  : snapshot ? <Pill text="Datos del servidor" tone="good" />
                  : <Pill text="Conectando…" />}
              </div>
              <h2 className="text-[26px] font-bold tracking-[-.045em] text-white sm:text-[34px]">Centro de control</h2>
              <p className="max-w-2xl text-[13px] leading-6 text-slate-300">
                Versiones de Git, imágenes desplegadas, webs, contenedores y recursos del servidor en una única vista.
              </p>
              <p className="text-[11px] text-slate-400">
                {metrics?.hostname ? `Servidor: ${metrics.hostname}` : "Servidor sin confirmar"}
                {firstSeen ? ` · Última consulta: ${firstSeen}` : ""}
                {loading ? " · Actualizando…" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/governance" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-xs font-semibold text-slate-100 hover:bg-white/10">
                <Building2 className="h-4 w-4" /> Clientes
              </Link>
              <Link href="/backups" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-xs font-semibold text-slate-100 hover:bg-white/10">
                <DatabaseBackup className="h-4 w-4" /> Backups
              </Link>
              <button type="button" onClick={() => void reload()} disabled={loading}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#a9bdff] px-4 py-2.5 text-xs font-bold text-[#142037] hover:bg-[#c2d0ff] disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] px-4 py-3">
            <p className="flex items-center gap-2 text-xs text-rose-200"><AlertTriangle className="h-4 w-4" />
              {error}. {snapshot ? "Mostrando la última consulta, posiblemente desactualizada." : "Sin datos; no se muestran valores de ejemplo."}
            </p>
            <button type="button" onClick={() => void reload()} className="text-xs font-semibold text-rose-200 underline">Reintentar</button>
          </div>
        )}

        <section aria-label="Indicadores operativos" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric label="Aplicaciones" icon={Boxes} value={snapshot ? String(apps.length) : "—"}
            detail={snapshot ? `${apps.filter((a) => a.status === "operational").length} con contenedores operativos` : "Consultando inventario"} />
          <Metric label="Contenedores activos" icon={Server} value={snapshot ? `${running} / ${containers.length}` : "—"}
            detail={snapshot ? `${unhealthy} detenidos o no saludables` : "Consultando Docker"} warning={unhealthy > 0} />
          <Metric label="Git por revisar" icon={GitBranch} value={snapshot ? String(gitReview) : "—"}
            detail={`${gitDiff} commits distintos · ${dirtyGitApps} con cambios locales`} warning={gitReview > 0} />
          <Metric label="Webs sin respuesta" icon={Wifi} value={snapshot ? String(websitesDown) : "—"}
            detail={`Fallos de conexión · ${websitesWithHttpErrors} respuestas HTTP anómalas`} warning={websitesDown > 0 || websitesWithHttpErrors > 0} />
        </section>

        <section aria-labelledby="hardware-overview" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="hub-eyebrow mb-1">Host físico</p><h2 id="hardware-overview" className="hub-section-heading">Recursos del servidor</h2></div>
            <Link href="/hardware" className="flex items-center gap-1.5 text-xs font-semibold text-brand-cyan hover:underline">Infraestructura <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric label="Uso real de CPU" icon={Cpu}
              value={metrics ? `${metrics.cpu.usagePercent.toFixed(1)}%` : "—"}
              percent={metrics?.cpu.usagePercent}
              detail={metrics ? `${metrics.cpu.cores} hilos · carga 1 min: ${metrics.cpu.loadAvg[0]}` : "Sin medición"} />
            <Metric label="Memoria RAM" icon={Layers}
              value={metrics ? fmtBytes(metrics.memory.usedBytes) : "—"}
              percent={metrics?.memory.usedPercent}
              detail={metrics ? `${metrics.memory.usedPercent}% de ${fmtBytes(metrics.memory.totalBytes)}` : "Sin medición"} />
            <Metric label="Almacenamiento" icon={HardDrive}
              value={metrics?.disks[0] ? `${metrics.disks[0].usedPercent}%` : "—"}
              percent={metrics?.disks[0]?.usedPercent}
              detail={metrics?.disks[0] ? `${fmtBytes(metrics.disks[0].freeBytes)} libres · ${metrics.disks[0].mount}` : "Sin medición"} />
          </div>
        </section>

        <section aria-labelledby="application-inventory" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="hub-eyebrow mb-1">GitHub · Servidor · Docker · HTTP</p>
              <h2 id="application-inventory" className="hub-section-heading">Aplicaciones y versiones</h2>
              <p className="mt-1 text-xs text-slate-400">Los tres identificadores son distintos: Git remoto, archivos del servidor e imagen realmente ejecutada.</p>
            </div>
            <Link href="/software" className="flex items-center gap-1.5 text-xs font-semibold text-brand-cyan hover:underline">Gestión completa <ArrowUpRight className="h-4 w-4" /></Link>
          </div>

          <div className="hub-card space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input type="search" aria-label="Buscar aplicaciones" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar aplicación o repositorio"
                  className="w-full rounded-xl border border-white/10 bg-[#101b2b] py-2.5 pl-10 pr-3 text-xs text-white placeholder:text-slate-500" />
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-pressed={scope === "all"} onClick={() => setScope("all")}
                  className={`rounded-lg px-3 py-2 text-xs ${scope === "all" ? "bg-[#33466c] font-semibold text-white" : "text-slate-400 hover:text-white"}`}>
                  Todas {snapshot ? `(${apps.length})` : ""}
                </button>
                <button type="button" aria-pressed={scope === "attention"} onClick={() => setScope("attention")}
                  className={`rounded-lg px-3 py-2 text-xs ${scope === "attention" ? "bg-[#33466c] font-semibold text-white" : "text-slate-400 hover:text-white"}`}>
                  Requieren revisión {attention > 0 ? `(${attention})` : ""}
                </button>
              </div>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[990px] text-left">
                <thead><tr>
                  <th className="px-3">Producto</th><th className="px-3">Web</th><th className="px-3">Servidor / Git</th>
                  <th className="px-3">Git remoto</th><th className="px-3">Imagen desplegada</th>
                  <th className="px-3">Docker</th><th className="px-3 text-right">Acciones</th>
                </tr></thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {filtered.map((app) => (
                    <tr key={app.slug} className="transition-colors hover:bg-white/[0.025]">
                      <td className="px-3">
                        <div className="font-semibold text-slate-100">{app.name}</div>
                        <div className="mt-1 text-[11px] text-slate-400">{app.git.branch || (app.git.isRepo ? "Git inaccesible" : "Sin Git local")}</div>
                      </td>
                      <td className="px-3"><WebBadge app={app} /></td>
                      <td className="px-3">
                        <div className="font-mono text-xs text-slate-100" title={app.git.commitHash}>{shortSha(app.git.commitHash)}</div>
                        <div className="mt-1 text-[11px] text-slate-400" title={app.git.localError || undefined}>{app.git.localError ? "Error Git local (ver detalle)" : app.git.dirtyFilesCount ? `${app.git.dirtyFilesCount} archivos modificados` : app.git.isRepo ? "Árbol limpio" : "Sin repositorio"}</div>
                        {app.git.localError && <div className="mt-1 max-w-[220px] break-words text-[11px] leading-4 text-amber-200">{app.git.localError}</div>}
                      </td>
                      <td className="px-3">
                        <div className="font-mono text-xs text-slate-100" title={app.git.remoteCommit || undefined}>{shortSha(app.git.remoteCommit)}</div>
                        <div className="mt-1"><GitBadge app={app} /></div>
                        {app.git.remoteRef === "HEAD" && <div className="mt-1 text-[10px] text-slate-500">Rama remota por defecto</div>}
                        {app.git.remoteError && <div className="mt-1 max-w-[220px] text-[11px] leading-4 text-amber-200">{app.git.remoteError}</div>}
                      </td>
                      <td className="px-3">
                        <div className="font-mono text-xs text-slate-100" title={app.deployment?.revision || app.deployment?.imageId || undefined}>
                          {shortSha(app.deployment?.revision)}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">{app.deployment?.status === "identified" ? "Commit de build" : app.deployment?.imageId ? `Imagen ${app.deployment.imageId.slice(7, 19)}` : "Sin identificar"}</div>
                        {app.deployment?.imageTag && <div className="mt-1 max-w-[180px] truncate text-[11px] text-slate-500" title={app.deployment.imageTag}>{app.deployment.imageTag}</div>}
                      </td>
                      <td className="px-3">
                        <Pill text={app.status === "not_deployed" ? "No desplegada" : `${app.containers.filter(c => c.state === "running").length}/${app.containers.length} activos`}
                          tone={app.status === "operational" ? "good" : app.status === "not_deployed" ? "neutral" : "bad"} />
                      </td>
                      <td className="px-3">
                        <div className="flex justify-end gap-1">
                          {app.url?.startsWith("https://") && <a href={app.url} target="_blank" rel="noopener noreferrer" title="Abrir web"
                            className="hub-icon-button !h-9 !w-9"><ExternalLink className="h-4 w-4" /></a>}
                          {app.containers[0] && <>
                            <button title="Consultar logs" aria-label={`Logs de ${app.name}`} onClick={() => void openLogs(app.containers[0].name)} className="hub-icon-button !h-9 !w-9"><Terminal className="h-4 w-4" /></button>
                            <button title="Reiniciar contenedor" aria-label={`Reiniciar ${app.name}`} onClick={() => void restart(app.containers[0].name)} className="hub-icon-button !h-9 !w-9"><RotateCw className="h-4 w-4" /></button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {filtered.map((app) => (
                <div key={app.slug} className="rounded-xl border border-white/[0.085] bg-[#142033] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{app.name}</div>
                      <div className="mt-1 text-[11px] text-slate-400">{app.git.branch || "Sin rama"}</div>
                    </div>
                    <WebBadge app={app} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-white/[0.025] p-3">
                    <div><div className="text-[10px] text-slate-500">Servidor</div><div className="mt-1 font-mono text-xs text-white">{shortSha(app.git.commitHash)}</div></div>
                    <div><div className="text-[10px] text-slate-500">Git remoto</div><div className="mt-1 font-mono text-xs text-white">{shortSha(app.git.remoteCommit)}</div></div>
                    <div><div className="text-[10px] text-slate-500">Desplegado</div><div className="mt-1 font-mono text-xs text-white">{shortSha(app.deployment?.revision)}</div></div>
                  </div>
                  {(app.git.localError || app.git.remoteError) && (
                    <p className="mt-2 break-words text-[11px] leading-5 text-amber-200">{app.git.localError || app.git.remoteError}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <GitBadge app={app} />
                    <div className="flex gap-2">
                      {app.containers[0] && <>
                        <button onClick={() => void openLogs(app.containers[0].name)} className="hub-icon-button !h-9 !w-9" aria-label={`Logs de ${app.name}`}><Terminal className="h-4 w-4" /></button>
                        <button onClick={() => void restart(app.containers[0].name)} className="hub-icon-button !h-9 !w-9" aria-label={`Reiniciar ${app.name}`}><RotateCw className="h-4 w-4" /></button>
                      </>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!loading && filtered.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">
                {snapshot ? "No hay aplicaciones con estos filtros." : "No se pudo cargar el inventario."}
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="containers-overview" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="hub-eyebrow mb-1">Docker en vivo</p><h2 id="containers-overview" className="hub-section-heading">Contenedores</h2></div>
            <div className="flex flex-wrap items-center gap-3">
              {finishedTasks.length > 0 && (
                <button type="button" aria-pressed={showFinishedTasks} onClick={() => setShowFinishedTasks(v => !v)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5">
                  {showFinishedTasks ? "Ocultar tareas completadas" : `Ver ${finishedTasks.length} tareas terminadas`}
                </button>
              )}
              <Link href="/hardware" className="flex items-center gap-1.5 text-xs font-semibold text-brand-cyan hover:underline">Inventario técnico <ArrowUpRight className="h-4 w-4" /></Link>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {visibleContainers.map((container: ContainerInfo) => (
              <div key={container.id} className="hub-card flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${container.state === "running" ? "bg-emerald-400" : "bg-rose-400"}`} />
                    <span className="break-all text-xs font-semibold text-white">{container.name}</span>
                    <Pill text={container.health === "none" ? container.state : container.health}
                      tone={container.health === "unhealthy" || container.state !== "running" ? "bad" : "good"} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    <span>CPU {container.cpuPercent || "—"}</span>
                    <span>RAM {container.memoryUsage || "—"}</span>
                    <span className="max-w-[250px] truncate" title={container.image}>{container.image}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void openLogs(container.name)} title="Logs"
                    className="hub-icon-button !h-9 !w-9"><Terminal className="h-4 w-4" /></button>
                  <button type="button" onClick={() => void restart(container.name)} title={`Reiniciar ${container.name}`}
                    className="hub-icon-button !h-9 !w-9"><RotateCw className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {snapshot && containers.length === 0 && <div className="hub-card p-6 text-sm text-slate-400">Docker no informó contenedores.</div>}
          </div>
        </section>
        <p className="text-xs leading-5 text-slate-500">Los repositorios privados pueden no permitir consultas remotas desde el contenedor. Si la imagen Docker no tiene etiqueta de commit, se muestra el identificador de imagen, sin atribuirle una versión Git.</p>
      </main>
      <TerminalModal isOpen={terminal.open} title={terminal.title} output={terminal.output}
        isLoading={terminal.loading} onClose={() => setTerminal((state) => ({ ...state, open: false }))} />
    </div>
  );
}
