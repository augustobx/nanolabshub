"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { TerminalModal } from "@/components/TerminalModal";
import {
  Database,
  Download,
  Play,
  RotateCw,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileArchive,
  Cloud,
  Clock,
  Sparkles,
} from "lucide-react";
import { BackupRecord } from "@/lib/types";
import { KNOWN_APPS } from "@/lib/apps-registry";

export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [schedules, setSchedules] = useState<Array<{
    slug: string; name: string; enabled: boolean; hourLocal: number; weekdays: string; lastRunDay: string | null;
  }>>([]);
  const [scheduleSaving, setScheduleSaving] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<string>("all");
  const [isTriggering, setIsTriggering] = useState<string | null>(null);

  // Terminal modal
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTitle, setTerminalTitle] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalLoading, setTerminalLoading] = useState(false);

  const fetchBackups = async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const res = await fetch("/api/backups", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "No se pudo cargar el historial");
      setBackups(data.data);
      setSchedules(data.schedules || []);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Error al consultar backups");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleTriggerBackup = async (slug: string) => {
    const appDef = KNOWN_APPS.find((a) => a.slug === slug);
    if (!appDef) return;

    if (!confirm(`¿Generar backup de ${appDef.name}? Se guardará una copia local y se verificará su integridad.`)) return;

    setIsTriggering(slug);
    setTerminalTitle(`Generando Backup: ${appDef.name}`);
    setTerminalOutput(`Ejecutando volcado consistente de base de datos (${appDef.dbType})...\nGenerando archivo comprimido .sql.gz en /opt/backups/${slug}...`);
    setTerminalLoading(true);
    setTerminalOpen(true);

    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (data.success) {
        setTerminalOutput(`Backup creado y validado (gzip + SHA-256).\n\nArchivo: ${data.data.filename}\n\nSHA-256: ${data.data.checksum}\n\nNota: todavía no se probó una restauración en un entorno aislado.`);
        fetchBackups();
      } else {
        setTerminalOutput(`❌ Error generando backup:\n\n${data.error}`);
      }
    } catch (err: any) {
      setTerminalOutput(`Error: ${err.message}`);
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

  const filteredBackups = backups.filter(
    (b) => selectedApp === "all" || b.appSlug === selectedApp
  );

  const totalBackupBytes = backups.reduce((acc, b) => acc + b.sizeBytes, 0);
  const totalMB = (totalBackupBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header onRefresh={fetchBackups} isRefreshing={isLoading} />

      <div className="hub-content space-y-7">
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
              {backups.length}{" "}
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
              {totalMB} MB
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

        {/* Manual Trigger Panel */}
        <div className="hub-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-xs font-mono text-gray-300 font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-cyan" />
              DISPARADOR MANUAL DE BACKUP POR APLICACIÓN
            </h3>
            <span className="text-[10px] text-gray-500 font-mono">
              Verificación de archivo y hash · no implica restauración probada
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {KNOWN_APPS.filter((a) => a.dbType !== "none").map((app) => (
              <button
                key={app.slug}
                onClick={() => handleTriggerBackup(app.slug)}
                disabled={isTriggering === app.slug}
                className="px-3 py-1.5 rounded-lg bg-surface-100/80 hover:bg-brand-cyan/15 hover:text-brand-cyan border border-white/10 hover:border-brand-cyan/30 text-xs font-mono text-gray-300 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-current text-brand-cyan" />
                <span>{app.name}</span>
                <span className="text-[10px] text-gray-500 uppercase">({app.dbType})</span>
              </button>
            ))}
          </div>
        </div>

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
                <button type="button" disabled={scheduleSaving === schedule.slug}
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
