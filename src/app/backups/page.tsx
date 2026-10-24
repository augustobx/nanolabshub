"use client";

import { Header } from "@/components/Header";
import { JobPanel } from "@/components/JobPanel";
import { TerminalModal } from "@/components/TerminalModal";
import { KNOWN_APPS } from "@/lib/apps-registry";
import { BackupRecord } from "@/lib/types";
import {
AlertTriangle,
ArrowRight,
CheckCircle2,
Cloud,
Database,
Download,
FileArchive,
HardDrive,
LoaderCircle,
Play,
Search,
ShieldCheck,
X
} from "lucide-react";
import { useEffect,useState,useRef,useCallback } from "react";

export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [schedules, setSchedules] = useState<Array<{
    slug: string; name: string; enabled: boolean; hourLocal: number; weekdays: string; lastRunDay: string | null;
  }>>([]);
  const [scheduleSaving, setScheduleSaving] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<string>("all");
  const [externalCopies,setExternalCopies]=useState<Array<{slug:string;count:number|null}>>([]);
  const [isTriggering, setIsTriggering] = useState<string | null>(null);
  const [manualAppSlug, setManualAppSlug] = useState("nanolabshub");
  const [manualSearch, setManualSearch] = useState("");
  const [confirmBackupSlug, setConfirmBackupSlug] = useState<string | null>(null);
  const pendingRequests=useRef(new Map<string,string>());
  const loadGeneration=useRef(0);

  // Terminal modal
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTitle, setTerminalTitle] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalLoading, setTerminalLoading] = useState(false);

  const fetchBackups = useCallback(async () => {
    const generation=++loadGeneration.current;
    setIsLoading(true);
    setPageError(null);
    try {
      const res = await fetch("/api/backups", { cache: "no-store" });
      const data = await res.json();
      if(generation!==loadGeneration.current)return;
      if (!res.ok || !data.success) throw new Error(data.error || "No se pudo cargar el historial");
      setBackups(data.data);
      setExternalCopies(data.externalCopies || []);
      setSchedules(data.schedules || []);
    } catch (error) {
      if(generation!==loadGeneration.current)return;
      setBackups([]);setSchedules([]);setExternalCopies([]);
      setPageError(error instanceof Error ? error.message : "Error al consultar backups");
    } finally {
      if(generation===loadGeneration.current)setIsLoading(false);
    }
  },[]);

  useEffect(() => {
    void fetchBackups();
    const timer=setInterval(()=>void fetchBackups(),15000);
    return()=>clearInterval(timer);
  }, [fetchBackups]);

  const handleTriggerBackup = async (slug: string) => {
    const appDef = KNOWN_APPS.find((a) => a.slug === slug);
    if (!appDef || isTriggering) return;
    setConfirmBackupSlug(null);
    setIsTriggering(slug);
    setTerminalTitle(`Generando Backup: ${appDef.name}`);
    setTerminalOutput(`Solicitando respaldo de ${appDef.name} (${appDef.dbType}).\nLa solicitud queda persistida; podés seguir su estado en Trabajos persistentes.`);
    setTerminalLoading(true);
    setTerminalOpen(true);

    try {
      let savedRequest:string|null=null;
      try{savedRequest=sessionStorage.getItem("hub.backup.request:"+slug);}catch{/* The in-memory request remains usable when browser storage is unavailable. */}
      const requestId=pendingRequests.current.get(slug)||(savedRequest&&/^[a-f0-9-]{36}$/.test(savedRequest)?savedRequest:crypto.randomUUID());
      pendingRequests.current.set(slug,requestId);
      try{sessionStorage.setItem("hub.backup.request:"+slug,requestId);}catch{/* Request still lives in this tab's memory. */}
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, requestId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        pendingRequests.current.delete(slug);
        try{sessionStorage.removeItem("hub.backup.request:"+slug);}catch{/* A stale request key stays idempotent on the server. */}
        setTerminalOutput(`Solicitud registrada.\n\nTrabajo: ${data.data.jobId}\nEstado: ${data.data.state}\n\nEl worker genera y verifica la copia. Podés cerrar esta ventana y consultar el resultado en Trabajos persistentes; aún no se afirma que exista un archivo íntegro.`);
        void fetchBackups();
      } else {
        if(res.status<500){pendingRequests.current.delete(slug);try{sessionStorage.removeItem("hub.backup.request:"+slug);}catch{/* No operation was accepted. */}}
        setTerminalOutput(`❌ Error generando backup:\n\n${data.error}`);
      }
    } catch (err: any) {
      setTerminalOutput(`No se confirmó la respuesta del servidor: ${err.message}.\nRevisá Trabajos persistentes antes de repetir; se conservará el mismo ID de solicitud para un reintento.`);
    } finally {
      setIsTriggering(null);
      setTerminalLoading(false);
    }
  };

  const handleSchedule = async (slug: string, enabled: boolean, hourLocal: number, weekdays: string) => {
    setScheduleSaving(slug);
    setPageError(null);
    try {
      const res = await fetch("/api/backups/schedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, config: { enabled, hourLocal, weekdays } }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Error al guardar programación");
      setSchedules(data.data);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Error de programación");
    } finally {
      setScheduleSaving(null);
    }
  };

  const manualApps = KNOWN_APPS.filter((app) =>
    app.dbType !== "none" && ["nanolabshub","onlyfood","onlygym","onlyturn"].includes(app.slug) &&
    (app.name.toLowerCase().includes(manualSearch.trim().toLowerCase()) ||
     app.slug.toLowerCase().includes(manualSearch.trim().toLowerCase()))
  );
  const selectedManualApp = KNOWN_APPS.find((app) => app.slug === manualAppSlug && app.dbType !== "none");
  const lastBackupFor = (slug: string) => backups
    .filter((backup) => backup.appSlug === slug && backup.status === "verified")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const filteredBackups = backups.filter(
    (b) => selectedApp === "all" || b.appSlug === selectedApp
  );

  const totalBackupBytes = backups.reduce((acc, b) => acc + b.sizeBytes, 0);
  const totalMB = (totalBackupBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header onRefresh={fetchBackups} isRefreshing={isLoading} />

      <div className="hub-content space-y-7">
        <p className="rounded-xl border border-white/10 p-3 text-xs text-slate-300">Este historial contiene copias creadas por el Hub. {externalCopies.reduce((n,x)=>n+(x.count||0),0)} archivos adicionales fueron detectados fuera de su registro; solo se consultaron metadatos y su integridad está pendiente de verificación. Las aplicaciones protegidas no admiten nuevas operaciones.</p>
        <section className="hub-hero space-y-3">
          <p className="hub-eyebrow">Operación / Respaldo</p>
          <h1 className="hub-hero-title">Copias de seguridad y recuperación.</h1>
          <p className="hub-description">
            Copias reales por aplicación, respaldo manual o programado, comprobación gzip/SHA-256
            y descarga privada. La integridad de un archivo no garantiza una restauración probada.
          </p>
        </section>

        {/* Backups Summary Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="hub-card p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400">
              <span className="flex items-center gap-1.5">
                <FileArchive className="w-4 h-4 text-brand-cyan" />
                Respaldos registrados
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {pageError?"—":backups.length}{" "}
              <span className="text-xs font-normal text-gray-400">archivos</span>
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              Retención local en /opt/backups
            </div>
          </div>

          <div className="hub-card p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-purple-400" />
                Espacio utilizado
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {pageError?"—":totalMB} MB
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              Comprimidos con gzip (.gz)
            </div>
          </div>

          <div className="hub-card p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400">
              <span className="flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-amber-300" />
                Copia externa (configuración)
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              <span>No conectada</span>
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              No hay copia externa verificada por el Hub
            </div>
          </div>
        </div>

        <JobPanel/>
        {/* A single primary manual action: select an application, review it, then confirm. */}
        <section aria-labelledby="manual-backup-title" className="hub-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-5 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10">
                <Database className="h-5 w-5 text-brand-cyan" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-cyan">Respaldo bajo demanda</p>
                <h2 id="manual-backup-title" className="text-base font-bold tracking-tight text-white sm:text-lg">Generar backup manual</h2>
                <p className="text-xs leading-5 text-slate-400">Elegí una aplicación, revisá sus datos y ejecutá una copia segura.</p>
              </div>
            </div>
            <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[11px] font-medium text-slate-300">
              {KNOWN_APPS.filter((app) => app.dbType !== "none").length} bases configuradas
            </span>
          </div>

          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.55fr)_minmax(290px,1fr)]">
            <div className="space-y-4 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-white"><span className="mr-2 text-brand-cyan">01</span>Seleccionar aplicación</p>
                  <p className="mt-1 text-[11px] text-slate-500">Cada tarjeta identifica la base y el último respaldo íntegro.</p>
                </div>
                <label className="relative w-full sm:w-52">
                  <span className="sr-only">Buscar aplicación para backup</span>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input type="search" value={manualSearch} onChange={(e) => setManualSearch(e.target.value)}
                    placeholder="Buscar aplicación"
                    className="w-full rounded-xl border border-white/10 bg-[#101b2b] py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-brand-cyan/60 focus:outline-none"
                  />
                </label>
              </div>
              <div role="group" aria-label="Aplicaciones con base de datos" className="grid max-h-[500px] grid-cols-1 gap-2.5 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2 xl:max-h-[460px]">
                {manualApps.map((app) => {
                  const latest = lastBackupFor(app.slug);
                  const active = manualAppSlug === app.slug;
                  return (
                    <button key={app.slug} type="button" aria-pressed={active}
                      aria-label={`Seleccionar ${app.name} para backup`}
                      onClick={() => setManualAppSlug(app.slug)}
                      disabled={isTriggering !== null}
                      className={`group min-w-0 rounded-xl border p-3.5 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:cursor-wait disabled:opacity-60 ${active
                        ? "border-brand-cyan/60 bg-brand-cyan/[0.09] ring-1 ring-brand-cyan/20"
                        : "border-white/[0.09] bg-white/[0.025] hover:border-white/25 hover:bg-white/[0.06]"}`}>
                      <span className="flex items-start justify-between gap-2">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-brand-cyan/15 text-brand-cyan" : "bg-white/[0.06] text-slate-400"}`}>
                          <Database className="h-[18px] w-[18px]" />
                        </span>
                        <span aria-hidden="true" className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border ${active ? "border-brand-cyan bg-brand-cyan text-[#101827]" : "border-slate-600"}`}>
                          {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                        </span>
                      </span>
                      <span className="mt-3 block truncate text-[13px] font-semibold text-white">{app.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono uppercase text-slate-300">{app.dbType}</span>
                        <span className={latest ? "text-emerald-300" : "text-slate-500"}>{latest ? "Copia íntegra registrada" : "Sin copia verificada"}</span>
                      </span>
                    </button>
                  );
                })}
                {manualApps.length === 0 && (
                  <p className="col-span-full rounded-xl border border-dashed border-white/15 p-6 text-center text-xs text-slate-400">
                    No encontramos aplicaciones con ese nombre.
                  </p>
                )}
              </div>
            </div>

            <aside className="flex min-w-0 flex-col justify-between gap-6 border-t border-white/[0.07] bg-[#111e30]/60 p-4 sm:p-6 xl:border-l xl:border-t-0">
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold text-white"><span className="mr-2 text-brand-cyan">02</span>Confirmar respaldo</p>
                  <p className="mt-1 text-[11px] text-slate-500">Solo se crea una copia; no se modifica la base original.</p>
                </div>
                {selectedManualApp && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/[0.09] bg-white/[0.035] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Aplicación seleccionada</p>
                      <p className="mt-2 break-words text-lg font-bold tracking-tight text-white">{selectedManualApp.name}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-md bg-brand-cyan/10 px-2 py-1 text-[11px] font-medium uppercase text-brand-cyan">{selectedManualApp.dbType}</span>
                        <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-300">
                          {selectedManualApp.dbType === "sqlite" ? "Archivo .sqlite.gz" : "Archivo .sql.gz"}
                        </span>
                      </div>
                      <div className="mt-4 border-t border-white/[0.08] pt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Último respaldo con integridad OK</p>
                        {lastBackupFor(selectedManualApp.slug) ? (
                          <p className="mt-1 text-xs font-medium text-emerald-300">{lastBackupFor(selectedManualApp.slug)?.createdAt}</p>
                        ) : (
                          <p className="mt-1 text-xs text-amber-200">Todavía no hay uno registrado.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs leading-5 text-slate-400">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-cyan" />
                      <p>El Hub comprueba gzip y SHA-256. Para garantizar recuperación aún se necesita una restauración de prueba.</p>
                    </div>
                  </div>
                )}
              </div>
              <button type="button" disabled={!selectedManualApp || isTriggering !== null || isLoading}
                onClick={() => setConfirmBackupSlug(selectedManualApp?.slug || null)}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan px-4 py-3 text-sm font-bold text-[#0b1b2d] shadow-lg shadow-cyan-900/10 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:cursor-not-allowed disabled:opacity-40">
                {isTriggering ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                {isTriggering ? "Generando respaldo…" : "Generar backup ahora"}
                {!isTriggering && <ArrowRight className="ml-auto h-4 w-4" />}
              </button>
            </aside>
          </div>
        </section>

        {confirmBackupSlug && (() => {
          const app = KNOWN_APPS.find((item) => item.slug === confirmBackupSlug);
          if (!app) return null;
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog"
              aria-modal="true" aria-labelledby="backup-confirm-title"
              onKeyDown={(e) => { if (e.key === "Escape") setConfirmBackupSlug(null); }}>
              <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/15 bg-[#172235] p-5 shadow-2xl sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-brand-cyan/15 p-2.5"><Database className="h-5 w-5 text-brand-cyan" /></div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">Backup manual</p>
                      <h3 id="backup-confirm-title" className="text-base font-bold text-white">Confirmar respaldo</h3>
                    </div>
                  </div>
                  <button type="button" onClick={() => setConfirmBackupSlug(null)} aria-label="Cerrar confirmación"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/25 p-4">
                  <p className="font-semibold text-white">{app.name}</p>
                  <p className="mt-1 text-xs text-slate-400">Motor: {app.dbType.toUpperCase()} · Destino: /opt/backups/{app.slug}/</p>
                </div>
                <p className="text-xs leading-5 text-slate-300">Se generará un nuevo archivo comprimido y se verificará su integridad. No se detendrá el servicio ni se restaurará información.</p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setConfirmBackupSlug(null)}
                    className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-slate-200 hover:bg-white/5">
                    Cancelar
                  </button>
                  <button type="button" onClick={() => void handleTriggerBackup(app.slug)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-cyan px-4 text-sm font-bold text-[#0b1b2d] hover:brightness-110">
                    <Play className="h-4 w-4 fill-current" /> Sí, generar backup
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
        {pageError && (
          <div role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{pageError}</div>
        )}

        <section aria-label="Programación de respaldos" className="hub-card space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-white">Backups programados</h2>
            <p className="mt-1 text-xs text-slate-400">
              Horario argentino (UTC−3). Requiere el servicio adicional de programación activo.
              La programación no elimina automáticamente copias anteriores.
            </p>
          </div>
          <div className="space-y-2">
            {schedules.map((schedule) => (
              <div key={schedule.slug} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 p-3">
                <span className="min-w-[155px] flex-1 text-xs font-semibold text-white">{schedule.name}</span>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  Hora
                  <select aria-label={`Hora de ${schedule.name}`} value={schedule.hourLocal}
                    onChange={(e) => setSchedules((prev) => prev.map((s) => s.slug === schedule.slug ? { ...s, hourLocal: Number(e.target.value) } : s))}
                    className="rounded-lg border border-white/15 bg-surface-100 px-2 py-2 text-white">
                    {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  Frecuencia
                  <select aria-label={`Frecuencia de ${schedule.name}`}
                    value={schedule.weekdays === "0,1,2,3,4,5,6" ? "daily" : "weekly"}
                    onChange={(e) => setSchedules((prev) => prev.map((s) => s.slug === schedule.slug ?
                      { ...s, weekdays: e.target.value === "daily" ? "0,1,2,3,4,5,6" : "0" } : s))}
                    className="rounded-lg border border-white/15 bg-surface-100 px-2 py-2 text-white">
                    <option value="daily">Diaria</option>
                    <option value="weekly">Domingos</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-200">
                  <input type="checkbox" checked={schedule.enabled}
                    onChange={(e) => setSchedules((prev) => prev.map((s) => s.slug === schedule.slug ? { ...s, enabled: e.target.checked } : s))} />
                  Activa
                </label>
                <button type="button" disabled={!["nanolabshub","onlyfood","onlygym","onlyturn"].includes(schedule.slug) || scheduleSaving === schedule.slug}
                  onClick={() => void handleSchedule(schedule.slug, schedule.enabled, schedule.hourLocal, schedule.weekdays)}
                  className="rounded-lg border border-brand-cyan/40 px-3 py-2 text-xs font-semibold text-brand-cyan disabled:opacity-50">
                  {scheduleSaving === schedule.slug ? "Guardando…" : "Guardar"}
                </button>
                {schedule.lastRunDay && <span className="text-[11px] text-slate-500">Última ejecución: {schedule.lastRunDay}</span>}
              </div>
            ))}
          </div>
        </section>

        {/* Backups Inventory Table */}
        <div className="hub-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Historial de copias de seguridad</span>
              </h2>
              <p className="text-xs text-gray-500 font-mono">
                {filteredBackups.length} archivos mostrados
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400">Filtrar:</span>
              <select
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
                className="bg-surface-100 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-brand-cyan/40"
              >
                <option value="all">Todas las apps</option>
                {KNOWN_APPS.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredBackups.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5 text-center text-xs text-slate-400">
                No hay respaldos registrados para este filtro.
              </div>
            ) : filteredBackups.map((backup) => (
              <div key={backup.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white">{backup.appName}</div>
                    <p className="mt-1 break-all text-[11px] leading-5 text-slate-400">{backup.filename}</p>
                  </div>
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${backup.status === "verified"
                    ? "bg-emerald-400/10 text-emerald-300"
                    : backup.status === "failed" ? "bg-rose-400/10 text-rose-300" : "bg-amber-400/10 text-amber-200"}`}>
                    {backup.status === "verified" ? "Integridad OK" : backup.status === "failed" ? "Fallido" : "No verificado"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  {backup.status === "verified" && <a href={`/api/backups/download?id=${encodeURIComponent(backup.id)}`}
                    className="rounded-lg border border-brand-cyan/30 px-3 py-2 text-brand-cyan">Descargar backup</a>}
                  <span className="text-slate-500">{backup.trigger === "scheduled" ? "Programado" : "Manual"} · {backup.restoreTested ? "Restauración probada" : "Restauración no probada"}</span>
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-white/[0.07] pt-3 text-[11px]">
                  <span className="text-slate-400">{backup.dbType.toUpperCase()} · {backup.sizeFormatted}</span>
                  <span className="text-slate-500">{backup.createdAt}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-100/60 text-gray-400 uppercase text-[10px] tracking-wider border-b border-white/5">
                <tr>
                  <th className="py-2.5 px-3">Aplicación / Origen</th>
                  <th className="py-2.5 px-3">Nombre de Archivo</th>
                  <th className="py-2.5 px-3">Motor</th>
                  <th className="py-2.5 px-3">Tamaño</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Fecha de Creación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {filteredBackups.map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {b.appName}
                    </td>
                    <td className="py-2.5 px-3 text-gray-300 flex items-center gap-2 font-mono">
                      <FileArchive className="w-3.5 h-3.5 text-brand-cyan" />
                      <span className="truncate max-w-[280px]" title={b.filename}>
                        {b.filename}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 uppercase">{b.dbType}</td>
                    <td className="py-2.5 px-3 text-brand-cyan font-bold">{b.sizeFormatted}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold ${b.status === "verified"
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                        : b.status === "failed"
                        ? "border-rose-400/20 bg-rose-400/10 text-rose-300"
                        : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>
                        {b.status === "verified" ? "Integridad OK" : b.status === "failed" ? "Fallido" : "No verificado"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400">
                      <span>{b.createdAt}</span>
                      {b.status === "verified" && <a href={`/api/backups/download?id=${encodeURIComponent(b.id)}`}
                        className="ml-2 inline-flex items-center gap-1 text-brand-cyan hover:underline">
                        <Download className="h-3.5 w-3.5" /> Descargar
                      </a>}
                      <span className="mt-1 block text-[10px] text-slate-500">Restauración no probada</span>
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
        onClose={() => setTerminalOpen(false)}
        title={terminalTitle}
        output={terminalOutput}
        isLoading={terminalLoading}
      />
    </div>
  );
}
