"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { TerminalModal } from "@/components/TerminalModal";
import {
  Boxes,
  GitBranch,
  Terminal,
  Play,
  RotateCw,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FolderGit2,
  Calendar,
  User,
} from "lucide-react";
import { AppInfo } from "@/lib/types";

export default function SoftwarePage() {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Terminal modal state
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTitle, setTerminalTitle] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchApps = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/apps");
      const data = await res.json();
      if (data.success) {
        setApps(data.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
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
    setTerminalOutput(`Conectando con contenedor ${containerName}...\n`);
    setTerminalLoading(true);
    setIsStreaming(true);
    setTerminalOpen(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`/api/apps/logs/stream?container=${encodeURIComponent(containerName)}&lines=150`, {
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
        setTerminalOutput((prev) => `${prev}\n[ERROR]: ${err.message}`);
      }
    } finally {
      setIsStreaming(false);
      setTerminalLoading(false);
    }
  };

  const handleRestart = async (containerName: string) => {
    if (!confirm(`¿Reiniciar ${containerName}?`)) return;
    setTerminalTitle(`Reiniciando ${containerName}`);
    setTerminalOutput("Enviando orden a Docker...");
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
        setTerminalOutput(`✅ Contenedor reiniciado:\n\n${data.data.output}`);
        fetchApps();
      } else {
        setTerminalOutput(`❌ Error:\n\n${data.error}`);
      }
    } catch (err: any) {
      setTerminalOutput(`Error: ${err.message}`);
    } finally {
      setTerminalLoading(false);
    }
  };

  const handleStreamingDeploy = async (app: AppInfo) => {
    if (!confirm(`¿Desplegar ${app.name}? (git pull && docker compose up -d --build)`)) return;

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
      fetchApps();
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setTerminalOutput((prev) => `${prev}\n[ERROR]: ${err.message}`);
      }
    } finally {
      setIsStreaming(false);
      setTerminalLoading(false);
    }
  };

  const filteredApps = apps.filter((app) => {
    const matchesFilter = filterType === "all" || app.type === filterType;
    const matchesSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.slug.toLowerCase().includes(search.toLowerCase()) ||
      app.path.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header onRefresh={fetchApps} isRefreshing={isLoading} />

      <div className="hub-content space-y-7">
        <section className="hub-hero space-y-3">
          <p className="hub-eyebrow">Productos / Aplicaciones</p>
          <h1 className="hub-hero-title">Tus productos, bajo control.</h1>
          <p className="hub-description">
            Estado de aplicaciones, repositorios y despliegues de NanoLabs.
            Encontrá cada producto y sus acciones sin navegar por diferentes consolas.
          </p>
        </section>

        {/* Filters and Search Bar */}
        <div className="hub-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, slug o ruta..."
                className="w-full bg-surface-100/80 border border-white/5 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-cyan/40 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {[
              { id: "all", label: "Todos" },
              { id: "saas", label: "SaaS Core" },
              { id: "client", label: "Clientes" },
              { id: "internal", label: "Internos" },
              { id: "infrastructure", label: "Infra" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  filterType === tab.id
                    ? "bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30 font-semibold"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Apps Matrix Table */}
        <div className="space-y-4">
          {filteredApps.map((app) => (
            <div
              key={app.slug}
              id={`software-item-${app.slug}`}
              className="hub-card p-4 space-y-3"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* App Title & Path */}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">{app.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-gray-400 border border-white/5 uppercase">
                      {app.type}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        app.status === "operational"
                          ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                          : "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                      }`}
                    >
                      {app.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-mono flex items-center gap-3 mt-1">
                    <span>{app.path}</span>
                    {app.url && (
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-cyan hover:underline flex items-center gap-1"
                      >
                        {app.url} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {app.containers.length > 0 && (
                    <button
                      onClick={() => handleOpenStreamingLogs(app.containers[0].name)}
                      className="px-3 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-50 text-gray-300 hover:text-white border border-white/10 text-xs font-mono flex items-center gap-1.5 transition-colors"
                      title="Ver logs en vivo (streaming)"
                    >
                      <Terminal className="w-3.5 h-3.5 text-brand-cyan" />
                      <span>LOGS EN VIVO</span>
                    </button>
                  )}
                  {app.containers[0] && (
                    <button
                      onClick={() => handleRestart(app.containers[0].name)}
                      className="px-3 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-50 text-gray-300 hover:text-white border border-white/10 text-xs font-mono flex items-center gap-1.5 transition-colors"
                      title="Reiniciar contenedor principal"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>REINICIAR</span>
                    </button>
                  )}
                  {app.hasDockerCompose && (
                    <button
                      onClick={() => handleStreamingDeploy(app)}
                      className="px-3 py-1.5 rounded-lg bg-brand-cyan/15 hover:bg-brand-cyan/25 text-brand-cyan border border-brand-cyan/30 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all shadow-glow"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>STREAM DEPLOY</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Git & Stack Status Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-white/5 font-mono text-xs">
                {/* Git Branch & Commit */}
                <div className="p-2.5 rounded-lg bg-surface-100/50 border border-white/5 space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                    <FolderGit2 className="w-3 h-3 text-brand-cyan" />
                    Rama & Commit
                  </div>
                  <div className="flex items-center justify-between text-gray-200 font-semibold">
                    <span>{app.git.branch || "no-git"}</span>
                    <span className="text-brand-cyan">{app.git.commitHash || "---"}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate" title={app.git.commitMessage}>
                    {app.git.commitMessage || "Sin cambios registrados"}
                  </div>
                </div>

                {/* Author & Date */}
                <div className="p-2.5 rounded-lg bg-surface-100/50 border border-white/5 space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                    <User className="w-3 h-3 text-purple-400" />
                    Autor & Fecha
                  </div>
                  <div className="text-gray-300 font-medium truncate">
                    {app.git.commitAuthor || "N/A"}
                  </div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {app.git.commitDate || "N/A"}
                  </div>
                </div>

                {/* Dirty Files Status */}
                <div className="p-2.5 rounded-lg bg-surface-100/50 border border-white/5 space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase">Estado Local Git</div>
                  <div className="flex items-center gap-1.5">
                    {app.git.dirtyFilesCount === 0 ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Limpio (clean)
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {app.git.dirtyFilesCount} archivos modificados
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {app.hasDockerCompose ? "Compose detectado" : "Sin compose"}
                  </div>
                </div>

                {/* Database Engine */}
                <div className="p-2.5 rounded-lg bg-surface-100/50 border border-white/5 space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase">Base de Datos</div>
                  <div className="text-gray-200 font-semibold uppercase">
                    {app.database?.type || "none"}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {app.database?.host ? `${app.database.host}:${app.database.port}` : "Sin motor dedicado"}
                  </div>
                </div>
              </div>

              {/* Containers list */}
              {app.containers.length > 0 && (
                <div className="flex items-center gap-2 pt-2 text-xs font-mono">
                  <span className="text-[10px] text-gray-500 uppercase">Contenedores:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {app.containers.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => handleOpenStreamingLogs(c.name)}
                        className="text-[11px] px-2 py-0.5 rounded bg-white/[0.03] hover:bg-brand-cyan/15 hover:text-brand-cyan border border-white/5 text-gray-300 flex items-center gap-1.5 transition-colors"
                        title={`Click para inspeccionar logs en vivo de ${c.name}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.state === "running" ? "bg-emerald-400" : "bg-rose-400"
                          }`}
                        />
                        <span>{c.name}</span>
                        <Terminal className="w-2.5 h-2.5 text-gray-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
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
