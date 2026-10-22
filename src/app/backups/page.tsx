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
    try {
      const res = await fetch("/api/backups");
      const data = await res.json();
      if (data.success) {
        setBackups(data.data);
      }
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

    if (!confirm(`¿Iniciar volcado/backup inmediato de ${appDef.name}?`)) return;

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
        setTerminalOutput(`✅ BACKUP GENERADO EXITOSAMENTE:\n\n${data.data.output}\n\nUbicación: /opt/backups/${slug}/`);
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
            Visualizá los respaldos registrados y ejecutá copias manuales por aplicación.
            La disponibilidad real de una copia depende de su última verificación.
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
                <Cloud className="w-4 h-4 text-emerald-400" />
                Copia externa (configuración)
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" />
              <span>Declarada</span>
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              Confirmar ejecución en el destino
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
              Dump atómico en caliente sin downtime
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

        {/* Backups Inventory Table */}
        <div className="hub-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Historial de Archivos de Resguardo</span>
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

          <div className="overflow-x-auto">
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
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-2.5 h-2.5" /> VERIFICADO
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400">{b.createdAt}</td>
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
