"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { ExecutiveOverview } from "@/components/ExecutiveOverview";
import { TerminalModal } from "@/components/TerminalModal";
import {
  Cpu,
  Building2,
  Layers,
  HardDrive,
  Boxes,
  Database,
  ShieldCheck,
  Activity,
  Terminal,
  RefreshCw,
  ExternalLink,
  RotateCw,
  Play,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Crown,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { ServerMetrics, ContainerInfo, AppInfo } from "@/lib/types";

export default function MissionControlPage() {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Terminal Modal state
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTitle, setTerminalTitle] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchAllData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resTelem, resApps] = await Promise.all([
        fetch("/api/telemetry"),
        fetch("/api/apps"),
      ]);

      const dataTelem = await resTelem.json();
      const dataApps = await resApps.json();

      if (dataTelem.success) {
        setMetrics(dataTelem.data.telemetry);
        setContainers(dataTelem.data.containers);
      } else {
        setError(dataTelem.error || "Error al obtener telemetría");
      }

      if (dataApps.success) {
        setApps(dataApps.data);
      }
    } catch (err: any) {
      setError(err.message || "Error conectando con el servidor");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setTerminalLoading(false);
  };

  const handleOpenStreamingLogs = async (containerName: string) => {
    handleStopStream();
    setTerminalTitle(`Logs en Vivo: ${containerName}`);
    setTerminalOutput(`Conectando con Docker daemon...\n`);
    setTerminalLoading(true);
    setIsStreaming(true);
    setTerminalOpen(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`/api/apps/logs/stream?container=${encodeURIComponent(containerName)}&lines=120`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      setTerminalLoading(false);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          setTerminalOutput((prev) => prev + decoder.decode(value, { stream: true }));
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setTerminalOutput((prev) => `${prev}\n[ERROR STREAM]: ${err.message}`);
      }
    } finally {
      setIsStreaming(false);
      setTerminalLoading(false);
    }
  };

  const handleStreamingDeploy = async (app: AppInfo) => {
    if (
      !confirm(
        `🚨 ATENCIÓN GOVERNANCE:\n¿Deseas ejecutar git pull y rebuild de "${app.name}" en producción?`
      )
    )
      return;

    handleStopStream();
    setTerminalTitle(`Desplegando en Vivo: ${app.name}`);
    setTerminalOutput("");
    setTerminalLoading(true);
    setIsStreaming(true);
    setTerminalOpen(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`/api/apps/deploy/stream?slug=${encodeURIComponent(app.slug)}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      setTerminalLoading(false);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          setTerminalOutput((prev) => prev + decoder.decode(value, { stream: true }));
        }
      }
      fetchAllData();
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setTerminalOutput((prev) => `${prev}\n[ERROR]: ${err.message}`);
      }
    } finally {
      setIsStreaming(false);
      setTerminalLoading(false);
    }
  };

  const handleRestartContainer = async (containerName: string) => {
    if (!confirm(`¿Confirmas reiniciar el contenedor ${containerName} en producción?`)) return;
    setTerminalTitle(`Reiniciando: ${containerName}`);
    setTerminalOutput(`Enviando orden de reinicio a Docker...`);
    setTerminalLoading(true);
    setIsStreaming(false);
    setTerminalOpen(true);
    try {
      const res = await fetch("/api/apps/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ containerName }),
      });
      const data = await res.json();
      if (data.success) {
        setTerminalOutput(`✅ Contenedor reiniciado exitosamente:\n\n${data.data.output}`);
        fetchAllData();
      } else {
        setTerminalOutput(`❌ Error reiniciando contenedor:\n\n${data.error}`);
      }
    } catch (err: any) {
      setTerminalOutput(`Error: ${err.message}`);
    } finally {
      setTerminalLoading(false);
    }
  };

  const operationalApps = apps.filter((a) => a.status === "operational").length;
  const runningContainers = containers.filter((c) => c.state === "running").length;

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header onRefresh={fetchAllData} isRefreshing={isLoading} />

      <div className="hub-content space-y-7">
        <section className="hub-hero flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="hub-eyebrow">NanoLabs / Gobierno central</p>
            <h1 className="hub-hero-title">Toda tu operación, en un solo lugar.</h1>
            <p className="hub-description">
              Clientes, productos, plataformas y recursos de NanoLabs.
              Una vista unificada para decidir, administrar y actuar con confianza.
            </p>
          </div>
          <Link href="/governance" className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-brand-cyan px-4 py-3 text-xs font-bold text-[#101827] transition-colors hover:bg-[#bdd0ff]">
            <Building2 className="h-4 w-4" /> Gestionar clientes <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2 font-mono">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Alerta de conexión: {error}</span>
          </div>
        )}

        <ExecutiveOverview />

        <section aria-labelledby="infrastructure-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="hub-eyebrow mb-1">Infraestructura</p>
              <h2 id="infrastructure-heading" className="hub-section-heading">Estado de la plataforma</h2>
            </div>
            <Link href="/hardware" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-cyan hover:underline">
              Ver detalles <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CPU Metric Card */}
          <div className="hub-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-brand-cyan" />
                Uso de CPU
              </span>
              <span className="text-[11px] font-mono text-gray-400">
                {metrics ? `${metrics.cpu.cores} núcleos lógicos` : "—"}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold font-mono text-white">
                {metrics ? `${metrics.cpu.usagePercent}%` : "---"}
              </div>
              <div className="text-[11px] font-mono text-gray-400">
                Load: {metrics ? metrics.cpu.loadAvg.join(" · ") : "---"}
              </div>
            </div>
            <div className="gauge-track h-2">
              <div
                className="gauge-fill-cyan h-full transition-all duration-500"
                style={{ width: `${metrics ? metrics.cpu.usagePercent : 0}%` }}
              />
            </div>
          </div>

          {/* RAM Metric Card */}
          <div className="hub-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-400" />
                Memoria RAM
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                {metrics ? `${metrics.memory.usedPercent}%` : "---"}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold font-mono text-white">
                {metrics
                  ? `${(metrics.memory.usedBytes / 1024 ** 3).toFixed(1)} GB`
                  : "---"}
              </div>
              <div className="text-[11px] font-mono text-gray-400">
                de {metrics ? `${(metrics.memory.totalBytes / 1024 ** 3).toFixed(1)} GB` : "---"}
              </div>
            </div>
            <div className="gauge-track h-2">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                style={{ width: `${metrics ? metrics.memory.usedPercent : 0}%` }}
              />
            </div>
          </div>

          {/* Disk Metric Card */}
          <div className="hub-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                Almacenamiento
              </span>
              <span className="text-[11px] font-mono text-gray-400">{metrics?.disks[0]?.mount || "—"}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold font-mono text-white">
                {metrics && metrics.disks[0]
                  ? `${metrics.disks[0].usedPercent}%`
                  : "---"}
              </div>
              <div className="text-[11px] font-mono text-emerald-400">
                {metrics && metrics.disks[0]
                  ? `${Math.round(metrics.disks[0].freeBytes / 1024 ** 3)} GB libres`
                  : "---"}
              </div>
            </div>
            <div className="gauge-track h-2">
              <div
                className="gauge-fill-emerald h-full transition-all duration-500"
                style={{
                  width: `${metrics && metrics.disks[0] ? metrics.disks[0].usedPercent : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Docker Fleet Metric Card */}
          <div className="hub-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-brand-cyan" />
                Contenedores
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                v{metrics?.docker?.version || "—"}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold font-mono text-white">
                {runningContainers}{" "}
                <span className="text-xs font-normal text-gray-400">activos</span>
              </div>
              <div className="text-[11px] font-mono text-gray-400">
                Total: {containers.length}
              </div>
            </div>
            <div className="gauge-track h-2">
              <div
                className="gauge-fill-cyan h-full transition-all duration-500"
                style={{
                  width: `${containers.length ? (runningContainers / containers.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        </section>

        {/* Fleet Applications Matrix */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="hub-section-heading">
                <span>Productos y servicios</span>
                <span className="text-xs font-mono text-gray-400 font-normal">
                  ({operationalApps} de {apps.length} operativas)
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/software"
                className="text-xs text-brand-cyan hover:underline font-mono flex items-center gap-1"
              >
                Ver todos los productos <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => {
              const isSaas = app.type === "saas";
              const isDegraded = app.status === "degraded";
              const isDown = app.status === "down";
              const isDeploying = app.status === "deploying";

              return (
                <div
                  key={app.slug}
                  id={`card-app-${app.slug}`}
                  className="hub-card p-4 flex flex-col justify-between space-y-4 relative group"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white text-sm">{app.name}</h3>
                          {isSaas && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              SaaS
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 font-mono">{app.path}</p>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${
                          isDown
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : (isDegraded || isDeploying)
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isDown ? "bg-rose-400" : (isDegraded || isDeploying) ? "bg-amber-400" : "bg-emerald-400"
                          }`}
                        />
                        {app.status === "operational" ? "Operativa" : app.status === "degraded" ? "Degradada" : app.status === "deploying" ? "Desplegando" : "Caída"}
                      </span>
                    </div>

                    {/* Git Status */}
                    <div className="p-2.5 rounded-lg bg-surface-100/60 border border-white/5 space-y-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-gray-400">
                        <span className="flex items-center gap-1 text-gray-300">
                          <GitBranch className="w-3.5 h-3.5 text-brand-cyan" />
                          {app.git.branch || "no-git"}
                        </span>
                        <span className="text-gray-400">{app.git.commitHash || "---"}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 truncate" title={app.git.commitMessage}>
                        {app.git.commitMessage || "Sin historial disponible"}
                      </div>
                    </div>

                    {/* Containers preview */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono text-gray-500 uppercase">
                        Contenedores Activos:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {app.containers.length > 0 ? (
                          app.containers.map((c) => (
                            <button
                              key={c.name}
                              onClick={() => handleOpenStreamingLogs(c.name)}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] hover:bg-brand-cyan/10 hover:text-brand-cyan border border-white/5 text-gray-300 transition-colors flex items-center gap-1"
                              title="Click para ver logs en vivo (streaming)"
                            >
                              <span>{c.name}</span>
                              <Terminal className="w-2.5 h-2.5 text-gray-500" />
                            </button>
                          ))
                        ) : (
                          <span className="text-[10px] text-gray-600 font-mono">Sin contenedores</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {app.url && (
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          title="Abrir URL pública"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {app.containers[0] && (
                        <button
                          onClick={() => handleRestartContainer(app.containers[0].name)}
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          title="Reiniciar contenedor principal"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {app.hasDockerCompose && (
                      <button
                        onClick={() => handleStreamingDeploy(app)}
                        className="px-2.5 py-1 rounded bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 text-[10px] font-mono font-medium transition-all flex items-center gap-1 shadow-glow"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Desplegar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <TerminalModal
        isOpen={terminalOpen}
        onClose={() => {
          handleStopStream();
          setTerminalOpen(false);
        }}
        title={terminalTitle}
        output={terminalOutput}
        isLoading={terminalLoading}
        isStreaming={isStreaming}
        onStopStream={handleStopStream}
      />
    </div>
  );
}
