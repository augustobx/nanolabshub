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
  const [sortBy, setSortBy] = useState<"name" | "status">("name");
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
    try {
      const res = await fetch("/api/apps");
      if (!res.ok) throw new Error("No se pudo conectar con el inventario de productos");
      const data = await res.json();
      if (!data.success || !Array.isArray(data.data)) throw new Error(data.error || "Inventario no disponible");
      setApps(data.data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los productos");
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
  }).sort((a, b) =>
    sortBy === "status" ? a.status.localeCompare(b.status) || a.name.localeCompare(b.name, "es")
    : a.name.localeCompare(b.name, "es")
  );

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
        <div className="hub-card p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full xl:w-auto">
            <div className="relative w-full xl:w-72">
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

          <div className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-1">
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="status" className="text-xs text-slate-400">
            {isLoading ? "Cargando productos…" : loadError ? "Inventario no disponible" : `${filteredApps.length} de ${apps.length} productos`}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Ordenar por
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
              className="rounded-lg border border-white/10 bg-surface-100 px-3 py-2 text-xs text-white">
              <option value="name">Nombre</option>
              <option value="status">Estado</option>
            </select>
          </label>
        </div>
        {loadError && (
          <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-xs text-rose-200">
            {loadError}. <button type="button" onClick={fetchApps} className="ml-2 font-semibold underline">Reintentar</button>
          </div>
        )}

        {/* Apps Matrix Table */}
        <div className="space-y-4">
          {!isLoading && !loadError && filteredApps.length === 0 && (
            <div className="hub-card px-6 py-10 text-center text-sm text-slate-400">
              No hay productos que coincidan con la búsqueda o los filtros.
            </div>
          )}
          {filteredApps.map((app) => (
            <div
              key={app.slug}
              id={`software-item-${app.slug}`}
              className="hub-card p-4 space-y-3"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* App Title & Path */}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
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
                      {app.status === "operational" ? "Operativa" : app.status === "degraded" ? "Degradada" : app.status === "deploying" ? "Desplegando" : app.status === "not_deployed" ? "No desplegada" : "Caída"}
                    </span>
                  </div>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3 break-all text-xs text-gray-500 font-mono">
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
                <div className="flex flex-wrap items-center gap-2">
                  {app.containers.length > 0 && (
                    <button
                      onClick={() => handleOpenStreamingLogs(app.containers[0].name)}
                      className="px-3 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-50 text-gray-300 hover:text-white border border-white/10 text-xs font-mono flex items-center gap-1.5 transition-colors"
                      title="Ver logs en vivo (streaming)"
                    >
                      <Terminal className="w-3.5 h-3.5 text-brand-cyan" />
                      <span>Ver logs</span>
                    </button>
                  )}
                  {app.containers[0] && (
                    <button
                      onClick={() => handleRestart(app.containers[0].name)}
                      className="px-3 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-50 text-gray-300 hover:text-white border border-white/10 text-xs font-mono flex items-center gap-1.5 transition-colors"
                      title="Reiniciar contenedor principal"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Reiniciar</span>
                    </button>
                  )}
                  {app.hasDockerCompose && (
                    <button
                      type="button"
                      disabled={!app.git.isRepo || !!app.git.localError || !app.git.branch ||
                        app.git.branch === "detached" || app.git.dirtyFilesCount > 0}
                      onClick={() => handleStreamingDeploy(app)}
                      title={!app.git.isRepo ? "La aplicación no tiene un repositorio Git local" :
                        app.git.localError ? app.git.localError :
                        app.git.branch === "detached" ? "Checkout detached: seleccioná una rama válida en el servidor antes de desplegar" :
                        app.git.dirtyFilesCount > 0 ? "Hay cambios locales. Revisalos antes de desplegar" : "Desplegar con Git pull --ff-only"}
                      className="px-3 py-1.5 rounded-lg bg-brand-cyan/15 hover:bg-brand-cyan/25 text-brand-cyan border border-brand-cyan/30 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all shadow-glow disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-700/20 disabled:text-slate-400 disabled:shadow-none"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{!app.git.isRepo || !!app.git.localError || !app.git.branch ||
                        app.git.branch === "detached" || app.git.dirtyFilesCount > 0 ? "Deploy bloqueado" : "Desplegar"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Git & Stack Status Bar */}
              <div className="grid grid-cols-1 gap-3 border-t border-white/5 pt-3 text-xs sm:grid-cols-2 xl:grid-cols-3">
                {/* Git Branch & Commit */}
                <div className="p-2.5 rounded-lg bg-surface-100/50 border border-white/5 space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                    <FolderGit2 className="w-3 h-3 text-brand-cyan" />
                    Servidor · Rama y commit
                  </div>
                  <div className="flex items-center justify-between text-gray-200 font-semibold">
                    <span>{app.git.branch || (app.git.isRepo ? "Git inaccesible" : "Sin repositorio")}</span>
                    <span className="text-brand-cyan">{app.git.commitHash?.slice(0, 8) || "—"}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate" title={app.git.commitMessage}>
                    {app.git.localError || app.git.commitMessage || (app.git.isRepo ? "Sin mensaje de commit" : "No hay repositorio Git local")}
                  </div>
                </div>

                <div className="min-w-0 rounded-lg border border-white/5 bg-surface-100/50 p-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">GitHub / Git remoto</div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-white" title={app.git.remoteCommit || undefined}>
                      {app.git.remoteCommit?.slice(0, 8) || "—"}
                    </span>
                    <span className={`text-[11px] font-medium ${app.git.remoteStatus === "synced" && app.git.dirtyFilesCount === 0 ? "text-emerald-300" : app.git.remoteStatus === "different" || app.git.dirtyFilesCount > 0 ? "text-amber-300" : "text-slate-400"}`}>
                      {app.git.remoteStatus === "synced" && app.git.dirtyFilesCount > 0 ? "Mismo commit · cambios locales" : app.git.remoteStatus === "synced" ? "Mismo commit" : app.git.remoteStatus === "different" ? "Commits distintos" : "Remoto no comprobado"}
                    </span>
                  </div>
                  <p className="text-[11px] leading-5 text-slate-500">
                    {app.git.remoteError || (app.git.remoteRef === "HEAD" ? "Comparado con HEAD de la rama remota predeterminada (checkout detached)." : "Comparación de commits; no implica que el servidor haya desplegado la nueva versión.")}
                  </p>
                </div>

                <div className="min-w-0 rounded-lg border border-white/5 bg-surface-100/50 p-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Imagen realmente ejecutada</div>
                  <p className="font-mono text-sm font-semibold text-white" title={app.deployment?.revision || app.deployment?.imageId || undefined}>
                    {app.deployment?.revision?.slice(0, 8) || (app.deployment?.imageId ? app.deployment.imageId.slice(7, 19) : "—")}
                  </p>
                  <p className="text-[11px] leading-5 text-slate-500">
                    {app.deployment?.status === "identified" ? "SHA registrado en la imagen Docker" : app.deployment?.imageId ? "ID Docker (sin commit registrado)" : "No se detectó imagen activa"}
                    {app.deployment?.imageTag ? ` · ${app.deployment.imageTag}` : ""}
                  </p>
                </div>

                <div className="min-w-0 rounded-lg border border-white/5 bg-surface-100/50 p-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sitio público</div>
                  <p className={`text-sm font-semibold ${app.web?.status === "online" ? "text-emerald-300" : app.web?.status === "offline" ? "text-rose-300" : "text-amber-200"}`}>
                    {app.web?.status === "online" ? "Responde" : app.web?.status === "restricted" ? "Acceso restringido" : app.web?.status === "offline" ? "No conecta" : app.web?.status === "http_error" ? `La web responde HTTP ${app.web.httpStatus}` : "Sin comprobación"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {app.web?.httpStatus ? `HTTP ${app.web.httpStatus}` : "HTTP no disponible"}
                    {app.web?.latencyMs != null ? ` · ${app.web.latencyMs} ms` : ""}
                  </p>
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
                    {app.git.localError ? (
                      <span className="text-amber-300 flex items-center gap-1" title={app.git.localError}>
                        <AlertTriangle className="w-3.5 h-3.5" /> {app.git.localError}
                      </span>
                    ) : app.git.dirtyFilesCount === 0 ? (
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
                    {app.hasDockerCompose ? "Compose detectado" : "Sin Compose predeterminado"}
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
