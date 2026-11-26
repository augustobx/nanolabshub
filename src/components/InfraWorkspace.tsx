"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Cpu,
  Database,
  ExternalLink,
  GitBranch,
  Globe2,
  HardDrive,
  RefreshCw,
  RotateCw,
  Search,
  Server,
  ServerCog,
  Terminal,
  Workflow,
} from "lucide-react";
import type { getInfrastructureInventory } from "@/lib/infrastructure-inventory";
import type { OperationsSnapshot } from "@/lib/operations";
import { portfolioSegment, type PortfolioSegment } from "@/lib/product-taxonomy";
import type { AppInfo } from "@/lib/types";
import { AppLifecycleControls } from "./AppLifecycleControls";
import { MaintenancePanel } from "./MaintenancePanel";
import { ReleasePanel } from "./ReleasePanel";
import { TerminalModal } from "./TerminalModal";
import {
  Cargando,
  Encabezado,
  Indicador,
  NanoLabsAlert,
  NanoLabsButton,
  NanoLabsChip,
  NanoLabsModal,
  NanoLabsTabs,
  Vacio,
  useToast,
} from "./nanolabs";

type Inventory = Awaited<ReturnType<typeof getInfrastructureInventory>>;
const shortSha = (sha?: string | null) => (sha && /^[a-f0-9]{40}$/i.test(sha) ? sha.slice(0, 8) : "—");
const restartBlocked = (name: string) => /^(nanolabshub|onlypadel|onlycars|onlyerp|onlyshop)(?:[_.-]|$)/.test(name);

const SEGMENT_LABELS: Record<PortfolioSegment, string> = {
  saas: "SaaS",
  client: "Cliente dedicado",
  dedicated: "Cliente dedicado",
  internal: "Interna",
  infrastructure: "Infraestructura",
} as Record<string, string>;

export function InfraWorkspace({
  initialTab = "apps",
  initialSegment = "all",
  initialArchived = false,
}: {
  initialTab?: "apps" | "host" | "dominios";
  initialSegment?: PortfolioSegment | "all" | "attention";
  initialArchived?: boolean;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"apps" | "host" | "dominios">(initialTab);
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [segmentFilter, setSegmentFilter] = useState<string>(initialArchived ? "archived" : initialSegment);
  const [search, setSearch] = useState("");
  const [lifecycleApp, setLifecycleApp] = useState<AppInfo | null>(null);

  // Terminal modal state
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTitle, setTerminalTitle] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [opsRes, infRes] = await Promise.allSettled([
        fetch("/api/operations", { cache: "no-store", signal }).then(async (r) => {
          const j = await r.json();
          if (!r.ok || !j.success) throw new Error(j.error || "Operación no disponible");
          return j.data as OperationsSnapshot;
        }),
        fetch("/api/infrastructure", { cache: "no-store", signal }).then(async (r) => {
          const j = await r.json();
          if (!r.ok || !j.success) throw new Error(j.error || "Inventario no disponible");
          return j.data as Inventory;
        }),
      ]);
      if (signal?.aborted) return;
      setSnapshot(opsRes.status === "fulfilled" ? opsRes.value : null);
      setInventory(infRes.status === "fulfilled" ? infRes.value : null);
      if (opsRes.status === "rejected" && infRes.status === "rejected") {
        setError("No se pudieron consultar los datos del servidor.");
      } else {
        setError(null);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const interval = window.setInterval(() => {
      if (!document.hidden) void load(controller.signal);
    }, 60000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [load]);

  const stopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setTerminalLoading(false);
  };

  const openStreamingLogs = async (containerName: string) => {
    stopStream();
    setTerminalTitle(`Logs en vivo: ${containerName}`);
    setTerminalOutput(`Conectando con ${containerName}...\n`);
    setTerminalLoading(true);
    setIsStreaming(true);
    setTerminalOpen(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const res = await fetch(`/api/apps/logs/stream?container=${encodeURIComponent(containerName)}&lines=150`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      setTerminalLoading(false);
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          setTerminalOutput((prev) => (prev + decoder.decode(value, { stream: true })).slice(-200000));
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setTerminalOutput((prev) => `${prev}\n[ERROR]: ${err.message}`);
      }
    } finally {
      setIsStreaming(false);
      setTerminalLoading(false);
    }
  };

  const restartContainer = async (containerName: string) => {
    if (!window.confirm(`¿Reiniciar el contenedor "${containerName}" en producción?`)) return;
    stopStream();
    setTerminalTitle(`Reiniciando: ${containerName}`);
    setTerminalOutput("Enviando orden a Docker…\n");
    setTerminalLoading(true);
    setTerminalOpen(true);
    try {
      const res = await fetch("/api/apps/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ containerName }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setTerminalOutput(json.data.output || "Contenedor reiniciado.");
        toast(`Contenedor ${containerName} reiniciado.`, "ok");
        void load();
      } else {
        setTerminalOutput(`Error: ${json.error || "No se pudo reiniciar"}`);
        toast(json.error || "No se pudo reiniciar", "error");
      }
    } catch (e) {
      setTerminalOutput(`Error: ${e instanceof Error ? e.message : "Desconocido"}`);
    } finally {
      setTerminalLoading(false);
    }
  };

  const allApps = useMemo(() => snapshot?.apps ?? [], [snapshot]);
  const attentionApps = useMemo(
    () =>
      allApps.filter(
        (app) =>
          (app.lifecycle?.state || "active") === "active" &&
          (app.status === "down" ||
            app.status === "degraded" ||
            app.web?.status === "offline" ||
            app.web?.status === "http_error" ||
            app.git.remoteStatus === "different" ||
            app.git.dirtyFilesCount > 0)
      ),
    [allApps]
  );

  const filteredApps = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("es");
    return allApps
      .filter((app) => {
        const isArchived = app.lifecycle?.state === "archived";
        if (segmentFilter === "archived") {
          if (!isArchived) return false;
        } else {
          if (isArchived) return false;
          if (segmentFilter === "attention") {
            if (!attentionApps.some((a) => a.slug === app.slug)) return false;
          } else if (segmentFilter !== "all") {
            if (portfolioSegment(app) !== segmentFilter) return false;
          }
        }
        if (q) {
          return [app.name, app.slug, app.path, app.url || ""].some((text) =>
            text.toLocaleLowerCase("es").includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [allApps, attentionApps, search, segmentFilter]);

  const metrics = snapshot?.telemetry || inventory?.host;
  const runningContainers = snapshot?.containers.filter((c) => c.state === "running").length ?? inventory?.totals.running;
  const totalContainers = snapshot?.containers.length ?? inventory?.containers.length ?? 0;

  return (
    <div className="ot-pagina">
      <Encabezado
        icono={ServerCog}
        antetitulo="Plataforma · Apps y Servidor"
        titulo="Aplicaciones y Servidor"
        bajada="Inventario unificado de todas tus apps, estado web, Git, contenedores Docker, telemetría del host y dominios."
        accion={
          <NanoLabsButton
            variant="secondary"
            size="small"
            onClick={() => void load()}
            disabled={loading}
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </NanoLabsButton>
        }
      />

      {error && <NanoLabsAlert severity="error" title="Error de lectura" description={error} />}

      <div className="bh-stats ot-stats-4">
        <Indicador
          tono="primary"
          icono={Cpu}
          valor={metrics ? `${metrics.cpu.usagePercent.toFixed(1)}%` : "—"}
          etiqueta={metrics ? `CPU · ${metrics.cpu.cores} núcleos` : "CPU"}
        />
        <Indicador
          tono="info"
          icono={Server}
          valor={metrics ? `${metrics.memory.usedPercent.toFixed(1)}%` : "—"}
          etiqueta="Memoria RAM"
        />
        <Indicador
          tono="success"
          icono={Boxes}
          valor={runningContainers == null ? "—" : `${runningContainers} / ${totalContainers}`}
          etiqueta="Contenedores activos"
        />
        <Indicador
          tono={attentionApps.length > 0 ? "warning" : "success"}
          icono={AlertTriangle}
          valor={snapshot ? attentionApps.length : "—"}
          etiqueta="Apps con alertas"
          activo={segmentFilter === "attention"}
          onClick={() => {
            setTab("apps");
            setSegmentFilter((prev) => (prev === "attention" ? "all" : "attention"));
          }}
        />
      </div>

      <NanoLabsTabs
        idBase="infra-workspace"
        activa={tab}
        onCambiar={setTab}
        tabs={[
          { id: "apps", label: "Aplicaciones y Deploy" },
          { id: "host", label: "Contenedores y Host" },
          { id: "dominios", label: "Dominios y Red" },
        ]}
      >
        {tab === "apps" && (
          <div className="space-y-5">
            <div className="bh-toolbar">
              <div className="bh-field bh-search-field">
                <label className="bh-label" htmlFor="buscar-app">
                  Buscar aplicación
                </label>
                <span className="bh-search-field__icon">
                  <Search size={16} />
                </span>
                <input
                  id="buscar-app"
                  type="search"
                  className="bh-input"
                  placeholder="Nombre, slug, ruta o dominio…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="bh-field max-w-xs">
                <label className="bh-label" htmlFor="filtro-segmento">
                  Segmento
                </label>
                <select
                  id="filtro-segmento"
                  className="bh-select"
                  value={segmentFilter}
                  onChange={(e) => setSegmentFilter(e.target.value)}
                >
                  <option value="all">Todas activas</option>
                  <option value="saas">Productos SaaS</option>
                  <option value="dedicated">Clientes dedicados</option>
                  <option value="internal">Apps internas</option>
                  <option value="infrastructure">Infraestructura</option>
                  <option value="attention">Solo con alertas ({attentionApps.length})</option>
                  <option value="archived">Archivadas</option>
                </select>
              </div>
            </div>

            {loading && !snapshot ? (
              <Cargando texto="Consultando aplicaciones y contenedores…" />
            ) : filteredApps.length === 0 ? (
              <Vacio titulo="Sin aplicaciones en este filtro" texto="Probá cambiando el segmento o limpiando el buscador." />
            ) : (
              <div className="ot-tabla">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="bh-table ot-fija min-w-[980px]">
                    <thead>
                      <tr>
                        <th style={{ width: "22%" }}>Aplicación</th>
                        <th style={{ width: "12%" }}>Segmento</th>
                        <th style={{ width: "14%" }}>Web pública</th>
                        <th style={{ width: "18%" }}>Git / Versión</th>
                        <th style={{ width: "16%" }}>Contenedores</th>
                        <th style={{ width: "18%", textAlign: "right" }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApps.map((app) => {
                        const seg = portfolioSegment(app);
                        const primaryContainer = app.containers[0]?.name;
                        const canRestart = primaryContainer && !restartBlocked(primaryContainer);
                        return (
                          <tr key={app.slug}>
                            <td>
                              <div className="bh-table-title">{app.name}</div>
                              <div className="bh-table-meta flex flex-wrap items-center gap-2">
                                <span className="ot-mono">{app.slug}</span>
                                {app.url && (
                                  <a
                                    href={app.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hub-text-link !text-[11px]"
                                  >
                                    Abrir <ExternalLink size={11} />
                                  </a>
                                )}
                              </div>
                            </td>
                            <td>
                              <NanoLabsChip severity="neutral">{SEGMENT_LABELS[seg] || seg}</NanoLabsChip>
                            </td>
                            <td>
                              {app.web?.status === "online" ? (
                                <NanoLabsChip severity="success">
                                  Online {app.web.latencyMs != null ? `· ${app.web.latencyMs}ms` : ""}
                                </NanoLabsChip>
                              ) : app.web?.status === "restricted" ? (
                                <NanoLabsChip severity="info">HTTP {app.web.httpStatus}</NanoLabsChip>
                              ) : app.web?.status === "offline" || app.web?.status === "http_error" ? (
                                <NanoLabsChip severity="danger">
                                  {app.web.status === "offline" ? "Sin conexión" : `HTTP ${app.web.httpStatus}`}
                                </NanoLabsChip>
                              ) : (
                                <NanoLabsChip severity="neutral">Sin probe</NanoLabsChip>
                              )}
                            </td>
                            <td>
                              <div className="flex flex-col items-start gap-1 text-xs">
                                <span className="ot-mono flex items-center gap-1">
                                  <GitBranch size={12} /> {app.git.branch || "—"} · {shortSha(app.git.commitHash)}
                                </span>
                                {app.git.remoteStatus === "different" ? (
                                  <NanoLabsChip severity="warning">Distinto al remoto</NanoLabsChip>
                                ) : app.git.dirtyFilesCount > 0 ? (
                                  <NanoLabsChip severity="warning">{app.git.dirtyFilesCount} cambios</NanoLabsChip>
                                ) : app.git.remoteStatus === "synced" ? (
                                  <NanoLabsChip severity="success">Sincronizado</NanoLabsChip>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-1">
                                {app.containers.length === 0 ? (
                                  <span className="text-xs text-slate-500">Sin contenedores</span>
                                ) : (
                                  app.containers.map((c) => (
                                    <NanoLabsChip
                                      key={c.id}
                                      severity={
                                        c.state === "running" && c.health !== "unhealthy"
                                          ? "success"
                                          : c.state === "exited"
                                          ? "neutral"
                                          : "warning"
                                      }
                                    >
                                      {c.name}
                                    </NanoLabsChip>
                                  ))
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {primaryContainer && (
                                  <NanoLabsButton
                                    size="small"
                                    variant="secondary"
                                    icon={<Terminal size={13} />}
                                    onClick={() => void openStreamingLogs(primaryContainer)}
                                  >
                                    Logs
                                  </NanoLabsButton>
                                )}
                                {canRestart && (
                                  <NanoLabsButton
                                    size="small"
                                    variant="tertiary"
                                    title={`Reiniciar ${primaryContainer}`}
                                    icon={<RotateCw size={13} />}
                                    onClick={() => void restartContainer(primaryContainer)}
                                  />
                                )}
                                <NanoLabsButton
                                  size="small"
                                  variant="tertiary"
                                  onClick={() => setLifecycleApp(app)}
                                >
                                  Ciclo
                                </NanoLabsButton>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <ReleasePanel />
          </div>
        )}

        {tab === "host" && (
          <div className="space-y-5">
            {metrics && (
              <div className="bh-card space-y-3">
                <h3 className="hub-section-heading">
                  <HardDrive size={16} /> Discos del servidor ({metrics.hostname})
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {metrics.disks.map((d) => (
                    <div
                      key={`${d.mount}-${d.filesystem}`}
                      className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800"
                    >
                      <div className="flex justify-between font-semibold">
                        <span className="truncate">{d.mount}</span>
                        <span>{d.usedPercent.toFixed(1)}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, d.usedPercent))}%`,
                            background: "var(--bg-primary-default)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="ot-tabla">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="bh-table ot-fija min-w-[860px]">
                  <thead>
                    <tr>
                      <th>Contenedor</th>
                      <th>App propietaria</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th style={{ textAlign: "right" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inventory?.containers || []).map((c) => {
                      const KindIcon =
                        c.kind === "database"
                          ? Database
                          : c.kind === "worker"
                          ? Workflow
                          : c.kind === "core"
                          ? Server
                          : Boxes;
                      return (
                        <tr key={c.name}>
                          <td className="ot-mono text-xs font-semibold">{c.name}</td>
                          <td className="text-xs">{c.appName || "Sin asignar"}</td>
                          <td>
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <KindIcon size={13} /> {c.kind}
                            </span>
                          </td>
                          <td>
                            <NanoLabsChip
                              severity={
                                c.expectedStopped
                                  ? "neutral"
                                  : c.state === "running" && c.health !== "unhealthy"
                                  ? "success"
                                  : "warning"
                              }
                            >
                              {c.expectedStopped ? "Detenido (esperado)" : `${c.state} · ${c.health}`}
                            </NanoLabsChip>
                          </td>
                          <td>
                            <div className="flex justify-end gap-1.5">
                              <NanoLabsButton
                                size="small"
                                variant="secondary"
                                icon={<Terminal size={13} />}
                                onClick={() => void openStreamingLogs(c.name)}
                              >
                                Logs
                              </NanoLabsButton>
                              {!restartBlocked(c.name) && (
                                <NanoLabsButton
                                  size="small"
                                  variant="tertiary"
                                  icon={<RotateCw size={13} />}
                                  onClick={() => void restartContainer(c.name)}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <MaintenancePanel />
          </div>
        )}

        {tab === "dominios" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Estado HTTP de las URLs declaradas en el registro. Para certificados o Proxy Hosts usá Nginx Proxy Manager.
              </p>
              <a
                href="https://proxy.nanoapps.site"
                target="_blank"
                rel="noopener noreferrer"
                className="hub-secondary-action"
              >
                <Globe2 size={14} /> Abrir Nginx Proxy Manager <ExternalLink size={13} />
              </a>
            </div>

            <div className="ot-tabla">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="bh-table ot-fija min-w-[740px]">
                  <thead>
                    <tr>
                      <th>Aplicación</th>
                      <th>Dominio</th>
                      <th>Estado</th>
                      <th>HTTP</th>
                      <th>Última consulta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inventory?.domains || []).map((d) => (
                      <tr key={d.slug}>
                        <td className="font-semibold">{d.appName}</td>
                        <td>
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hub-text-link"
                          >
                            {new URL(d.url).hostname} <ExternalLink size={12} />
                          </a>
                        </td>
                        <td>
                          <NanoLabsChip
                            severity={
                              d.lifecycle !== "active"
                                ? "neutral"
                                : d.status === "online"
                                ? "success"
                                : d.status === "restricted"
                                ? "info"
                                : "warning"
                            }
                          >
                            {d.lifecycle !== "active"
                              ? "Pausado"
                              : d.status === "online"
                              ? "Responde"
                              : d.status === "restricted"
                              ? "Restringido"
                              : "Revisar"}
                          </NanoLabsChip>
                        </td>
                        <td className="ot-mono text-xs">{d.httpStatus ?? "—"}</td>
                        <td className="text-xs text-slate-500">
                          {d.checkedAt ? new Date(d.checkedAt).toLocaleString("es-AR") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </NanoLabsTabs>

      {/* Modal de Ciclo de Vida */}
      <NanoLabsModal
        open={!!lifecycleApp}
        onClose={() => setLifecycleApp(null)}
        title={lifecycleApp ? `Ciclo de vida: ${lifecycleApp.name}` : "Ciclo de vida"}
        icon={Activity}
        width={620}
      >
        {lifecycleApp && (
          <AppLifecycleControls
            app={lifecycleApp}
            onChanged={async () => {
              await load();
              setLifecycleApp(null);
            }}
          />
        )}
      </NanoLabsModal>

      <TerminalModal
        isOpen={terminalOpen}
        onClose={() => {
          stopStream();
          setTerminalOpen(false);
        }}
        title={terminalTitle}
        output={terminalOutput}
        isLoading={terminalLoading}
        isStreaming={isStreaming}
        onStopStream={stopStream}
      />
    </div>
  );
}
