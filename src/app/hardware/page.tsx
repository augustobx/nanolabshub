"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { TerminalModal } from "@/components/TerminalModal";
import {
  Cpu,
  Layers,
  HardDrive,
  Boxes,
  Activity,
  Server,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Terminal,
  Trash2,
  TrendingUp,
  Sparkles,
  Play,
} from "lucide-react";
import { ServerMetrics, ContainerInfo } from "@/lib/types";

export default function HardwarePage() {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,setError]=useState<string|null>(null);

  // Terminal modal state
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTitle, setTerminalTitle] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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
    setTerminalOutput(`Conectando con contenedor ${containerName}...\n`);
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
          setTerminalOutput((prev) => (prev + decoder.decode(value, { stream: true })).slice(-200000));
        }
      }
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
    if (!confirm(`¿Estás seguro de reiniciar el contenedor ${containerName}?`)) return;
    handleStopStream();
    setTerminalTitle(`Reiniciando ${containerName}`);
    setTerminalOutput(`Enviando orden de reinicio seguro a Docker daemon para ${containerName}...\n`);
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
        setTerminalOutput(`✅ CONTENEDOR REINICIADO EXITOSAMENTE:\n\n${data.data.output}`);
        fetchMetrics();
      } else {
        setTerminalOutput(`❌ Error reiniciando contenedor:\n\n${data.error}`);
      }
    } catch (err: any) {
      setTerminalOutput(`Error: ${err.message}`);
    } finally {
      setTerminalLoading(false);
    }
  };

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const [resTelem, resHist] = await Promise.all([
        fetch("/api/telemetry"),
        fetch("/api/telemetry/history?limit=30"),
      ]);
      const dataTelem = await resTelem.json();
      const dataHist = await resHist.json();

      if (!resTelem.ok || !dataTelem.success || !resHist.ok || !dataHist.success) throw Error("No se pudo verificar la telemetría actual");
      setError(null);
      if (dataTelem.success) {
        setMetrics(dataTelem.data.telemetry);
        setContainers(dataTelem.data.containers);
      }
      if (dataHist.success) {
        setHistory(dataHist.data || []);
      }
    } catch(e) { setMetrics(null);setContainers([]);setHistory([]);setError(e instanceof Error?e.message:"Lectura no disponible");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 20000);
    return () => clearInterval(interval);
  }, []);


  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header onRefresh={fetchMetrics} isRefreshing={isLoading} />

      <div className="hub-content space-y-7">
        <section className="hub-hero flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="hub-eyebrow">Operación / Infraestructura</p>
            <h1 className="hub-hero-title">Infraestructura y rendimiento.</h1>
            <p className="hub-description">
              Uso de recursos, disponibilidad de contenedores y tendencias del servidor.
              Supervisá el entorno sin salir del Hub.
            </p>
          </div>
          <button type="button" disabled
            title="Limpieza global bloqueada: requiere revisión fuera del Hub"
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-400/10">
            <Trash2 className="h-4 w-4" /> Limpieza global bloqueada
          </button>
        </section>

        {error&&<p role="alert" className="text-sm text-amber-200">{error}. Sin mediciones actuales.</p>}
        {/* Primary Hardware Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* CPU Card */}
          <div className="hub-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-xs font-mono text-gray-400 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-brand-cyan" />
                Procesador
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
                CPU
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-gray-400">Modelo:</div>
              <div className="text-sm font-bold text-white font-mono">
                {metrics?.cpu.model || "Modelo no disponible"}
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {metrics?.cpu.cores ? `${metrics.cpu.cores} procesadores lógicos · lectura del host` : "Cantidad de procesadores no disponible"}
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-400">Carga Actual:</span>
                <span className="text-brand-cyan font-bold">
                  {metrics ? `${metrics.cpu.usagePercent}%` : "---"}
                </span>
              </div>
              <div className="gauge-track h-2.5">
                <div
                  className="gauge-fill-cyan h-full transition-all duration-500"
                  style={{ width: `${metrics ? metrics.cpu.usagePercent : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-gray-500 pt-1">
                <span>Load 1m: {metrics ? metrics.cpu.loadAvg[0] : "---"}</span>
                <span>5m: {metrics ? metrics.cpu.loadAvg[1] : "---"}</span>
                <span>15m: {metrics ? metrics.cpu.loadAvg[2] : "---"}</span>
              </div>
            </div>
          </div>

          {/* RAM Card */}
          <div className="hub-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-xs font-mono text-gray-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                MEMORIA RAM & SWAP
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                RAM / SWAP
              </span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-400">RAM en uso:</span>
                  <span className="text-purple-300 font-bold">
                    {metrics ? `${metrics.memory.usedPercent}%` : "---"}
                  </span>
                </div>
                <div className="gauge-track h-2.5">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                    style={{ width: `${metrics ? metrics.memory.usedPercent : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-gray-500">
                  <span>
                    Usado: {metrics ? (metrics.memory.usedBytes / 1024 ** 3).toFixed(2) : "—"} GB
                  </span>
                  <span>
                    Total: {metrics ? (metrics.memory.totalBytes / 1024 ** 3).toFixed(2) : "—"} GB
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-white/5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-400">SWAP en uso:</span>
                  <span className="text-gray-300">
                    {metrics ? `${metrics.memory.swapUsedPercent}%` : "---"}
                  </span>
                </div>
                <div className="gauge-track h-2">
                  <div
                    className="h-full bg-gray-500 transition-all duration-500"
                    style={{ width: `${metrics ? metrics.memory.swapUsedPercent : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-gray-500">
                  <span>
                    Usado: {metrics ? (metrics.memory.swapUsedBytes / 1024 ** 3).toFixed(2) : "—"} GB
                  </span>
                  <span>
                    Total: {metrics ? (metrics.memory.swapTotalBytes / 1024 ** 3).toFixed(2) : "—"} GB
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* NVMe Storage Card */}
          <div className="hub-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-xs font-mono text-gray-400 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                ALMACENAMIENTO DEL HOST
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Disco
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-gray-400">Filesystem monitorizado:</div>
              <div className="text-sm font-bold text-white font-mono">
                {metrics?.disks[0]?.filesystem || "No informado"}
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {metrics?.disks[0]?.mount ? `Montaje analizado: ${metrics.disks[0].mount}` : "Montaje sin información"}
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-400">Espacio Ocupado:</span>
                <span className="text-emerald-400 font-bold">
                  {metrics && metrics.disks[0] ? `${metrics.disks[0].usedPercent}%` : "---"}
                </span>
              </div>
              <div className="gauge-track h-2.5">
                <div
                  className="gauge-fill-emerald h-full transition-all duration-500"
                  style={{
                    width: `${metrics && metrics.disks[0] ? metrics.disks[0].usedPercent : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-gray-500 pt-1">
                <span>
                  Ocupado:{" "}
                  {metrics && metrics.disks[0]
                    ? `${(metrics.disks[0].usedBytes / 1024 ** 3).toFixed(1)} GB`
                    : "---"}
                </span>
                <span className="text-emerald-400 font-medium">
                  Libre:{" "}
                  {metrics && metrics.disks[0]
                    ? `${(metrics.disks[0].freeBytes / 1024 ** 3).toFixed(1)} GB`
                    : "---"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Historical Telemetry Snapshot Bars */}
        <div className="hub-card p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-xs font-mono text-gray-300 font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-cyan" />
              TENDENCIAS HISTÓRICAS DE CONSUMO (ÚLTIMAS LECTURAS)
            </h3>
            <span className="text-[10px] text-gray-500 font-mono">
              Persistido en SQLite /app/data
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-end gap-1.5 h-20 bg-surface-100/40 p-2 rounded-lg border border-white/5">
              {history.length === 0 ? (
                <div className="w-full text-center text-gray-500 text-xs font-mono self-center">
                  Registrando primeras lecturas de telemetría histórica...
                </div>
              ) : (
                history.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-brand-cyan/20 to-brand-cyan hover:from-cyan-400 hover:to-brand-cyan rounded-t transition-all group relative"
                    style={{ height: `${Math.max(8, Math.min(100, h.cpu_usage || 10))}%` }}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black text-[9px] text-brand-cyan font-mono border border-brand-cyan/30 pointer-events-none whitespace-nowrap z-20">
                      {h.cpu_usage}% CPU · {h.timestamp ? h.timestamp.split("T")[1]?.slice(0, 5) : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-gray-500 px-1">
              <span>Lecturas iniciales</span>
              <span>Tiempo real (Momento actual)</span>
            </div>
          </div>
        </div>

        {/* Live Docker Containers Fleet Table */}
        <div className="hub-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Boxes className="w-5 h-5 text-brand-cyan" />
                <span>Contenedores del servidor</span>
              </h2>
              <p className="text-xs text-gray-500 font-mono">
                {containers.length} contenedores registrados en el Docker Daemon
              </p>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {containers.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5 text-center text-xs text-slate-400">
                No hay contenedores registrados.
              </div>
            ) : containers.map((container) => (
              <div key={container.id} className="rounded-xl border border-white/[0.09] bg-white/[0.025] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-all text-xs font-semibold text-white">{container.name}</div>
                    <div className="mt-1 break-all text-[11px] text-slate-500">{container.image}</div>
                  </div>
                  <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${container.state === "running"
                    ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>
                    {container.state === "running" ? "Activo" : container.state === "exited" ? "Detenido" : container.state}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div><p className="text-slate-500">Salud</p><p className="mt-1 text-slate-300">{container.health === "none" ? "Sin verificación" : container.health}</p></div>
                  <div><p className="text-slate-500">Puertos</p><p className="mt-1 break-all text-slate-300">{container.ports || "Internos"}</p></div>
                </div>
                <div className="mt-4 flex gap-2 border-t border-white/[0.08] pt-3">
                  <button type="button" onClick={() => handleOpenStreamingLogs(container.name)}
                    className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-slate-200">
                    <Terminal className="h-4 w-4 text-brand-cyan" /> Logs
                  </button>
                  <button type="button" onClick={() => handleRestartContainer(container.name)}
                    className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] text-xs text-amber-200">
                    <RotateCw className="h-4 w-4" /> Reiniciar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-100/60 text-gray-400 uppercase text-[10px] tracking-wider border-b border-white/5">
                <tr>
                  <th className="py-2.5 px-3">Contenedor</th>
                  <th className="py-2.5 px-3">Imagen</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Healthcheck</th>
                  <th className="py-2.5 px-3">Puertos</th>
                  <th className="py-2.5 px-3">Creado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {containers.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          c.state === "running"
                            ? "bg-emerald-400"
                            : c.state === "exited"
                            ? "bg-gray-600"
                            : "bg-amber-400"
                        }`}
                      />
                      <span>{c.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 truncate max-w-[200px]" title={c.image}>
                      {c.image}
                    </td>
                    <td className="py-2.5 px-3 text-gray-300">{c.status}</td>
                    <td className="py-2.5 px-3">
                      {c.health === "healthy" ? (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          HEALTHY
                        </span>
                      ) : c.health === "unhealthy" ? (
                        <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          UNHEALTHY
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500">STANDBY</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 truncate max-w-[150px]" title={c.ports}>
                      {c.ports || "interna"}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">{c.created}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenStreamingLogs(c.name)}
                          className="px-2 py-1 rounded bg-surface-100 hover:bg-brand-cyan/20 text-gray-300 hover:text-brand-cyan border border-white/5 hover:border-brand-cyan/30 text-[10px] font-mono flex items-center gap-1 transition-all"
                          title={`Ver logs en streaming de ${c.name}`}
                        >
                          <Terminal className="w-3 h-3 text-brand-cyan" />
                          <span>Logs</span>
                        </button>
                        <button
                          onClick={() => handleRestartContainer(c.name)}
                          className="px-2 py-1 rounded bg-surface-100 hover:bg-amber-500/20 text-gray-300 hover:text-amber-400 border border-white/5 hover:border-amber-500/30 text-[10px] font-mono flex items-center gap-1 transition-all"
                          title={`Reiniciar contenedor ${c.name}`}
                        >
                          <RotateCw className="w-3 h-3 text-amber-400" />
                          <span>Reiniciar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
