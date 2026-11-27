"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  DatabaseBackup,
  Download,
  FlaskConical,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { KNOWN_APPS } from "@/lib/apps-registry";
import type { BackupRecord } from "@/lib/types";
import { BackupImportPanel } from "./BackupImportPanel";
import { JobPanel } from "./JobPanel";
import { RetentionPanel, type RetentionReport } from "./RetentionPanel";
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
  useToast,
} from "./nanolabs";

type ScheduleItem = {
  slug: string;
  name: string;
  enabled: boolean;
  hourLocal: number;
  weekdays: string;
  lastRunDay: string | null;
  intervalHours?: number;
  autoRestore?: boolean;
};

type RestoreCheck = {
  id: string;
  backupId: string;
  slug: string;
  status: "passed" | "failed";
  checkedAt: string;
  details: string;
  durationMs?: number | null;
};

const BACKUP_SUPPORTED_SLUGS = new Set([
  "nanolabshub",
  "onlyfood",
  "onlypadel",
  "onlycars",
  "onlymarket",
  "onlyerp",
  "onlyshop",
  "onlymob",
  "acevedocontrol",
  "liga-padel",
  "nanolabs",
]);

export function BackupsWorkspace({
  initialTab = "estado",
}: {
  initialTab?: "estado" | "historial" | "retencion";
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"estado" | "historial" | "retencion">(initialTab);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [checks, setChecks] = useState<RestoreCheck[]>([]);
  const [retention, setRetention] = useState<RetentionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedApp, setSelectedApp] = useState("all");
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const pendingRequests = useRef(new Map<string, string>());

  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTitle, setTerminalTitle] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalLoading, setTerminalLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, rRes] = await Promise.allSettled([
        fetch("/api/backups", { cache: "no-store" }).then(async (r) => {
          const j = await r.json();
          if (!r.ok || !j.success) throw new Error(j.error || "Error consultando respaldos");
          return j;
        }),
        fetch("/api/backups/restore-check", { cache: "no-store" }).then(async (r) => {
          const j = await r.json();
          if (!r.ok || !j.success) throw new Error(j.error || "Error consultando pruebas");
          return j.data as RestoreCheck[];
        }),
      ]);
      if (bRes.status === "fulfilled") {
        setBackups(bRes.value.data || []);
        setSchedules(bRes.value.schedules || []);
        setRetention(bRes.value.retention ?? null);
      } else {
        setError(bRes.reason?.message || "Error cargando backups");
      }
      if (rRes.status === "fulfilled") {
        setChecks(rRes.value || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const dbApps = useMemo(() => KNOWN_APPS.filter((a) => a.dbType !== "none"), []);

  const triggerBackup = async (slug: string) => {
    const appDef = KNOWN_APPS.find((a) => a.slug === slug);
    if (!appDef || busySlug) return;
    setConfirmSlug(null);
    setBusySlug(slug);
    setTerminalTitle(`Generando backup: ${appDef.name}`);
    setTerminalOutput(`Encolando respaldo de ${appDef.name} (${appDef.dbType})…\n`);
    setTerminalLoading(true);
    setTerminalOpen(true);

    try {
      const requestId = pendingRequests.current.get(slug) || crypto.randomUUID();
      pendingRequests.current.set(slug, requestId);
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, requestId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        pendingRequests.current.delete(slug);
        setTerminalOutput(
          `Trabajo registrado: ${json.data.jobId}\nEstado: ${json.data.state}\nPodés seguir el avance en Trabajos persistentes.`
        );
        toast(`Backup programado para ${appDef.name}.`, "ok");
        await load();
      } else {
        if (res.status < 500) pendingRequests.current.delete(slug);
        setTerminalOutput(`Error: ${json.error || "No se pudo iniciar"}`);
        toast(json.error || "Error iniciando backup", "error");
      }
    } catch (e) {
      setTerminalOutput(`Error de red: ${e instanceof Error ? e.message : "Desconocido"}`);
    } finally {
      setBusySlug(null);
      setTerminalLoading(false);
    }
  };

  const triggerRestoreCheck = async (backupId: string, slug: string) => {
    setBusySlug(slug);
    try {
      const res = await fetch("/api/backups/restore-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId, requestId: crypto.randomUUID() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "No se pudo iniciar la prueba");
      toast(`Prueba aislada de restore iniciada para ${slug}.`, "ok");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error iniciando prueba", "error");
    } finally {
      setBusySlug(null);
    }
  };

  const saveSchedule = async (item: ScheduleItem) => {
    setBusySlug(item.slug);
    try {
      const res = await fetch("/api/backups/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: item.slug,
          config: {
            enabled: item.enabled,
            hourLocal: item.hourLocal,
            weekdays: item.weekdays,
            intervalHours: item.intervalHours ?? 6,
            autoRestore: !!item.autoRestore,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "No se pudo guardar programación");
      setSchedules(json.data);
      toast(`Programación de ${item.name} guardada.`, "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error guardando programación", "error");
    } finally {
      setBusySlug(null);
    }
  };

  const verifiedCount = backups.filter((b) => b.status === "verified").length;
  const testedCount = backups.filter((b) => b.restoreTested && b.restoreStatus === "passed").length;
  const filteredBackups = backups.filter((b) => selectedApp === "all" || b.appSlug === selectedApp);

  return (
    <div className="ot-pagina">
      <Encabezado
        icono={DatabaseBackup}
        antetitulo="Plataforma · Respaldo y Continuidad"
        titulo="Backups y Continuidad"
        bajada="Respaldos verificados, programación automática, pruebas de restauración aislada y política de retención en un solo lugar."
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

      {error && <NanoLabsAlert severity="error" title="Error consultando respaldos" description={error} />}

      <div className="bh-stats ot-stats-4">
        <Indicador tono="primary" icono={DatabaseBackup} valor={dbApps.length} etiqueta="Bases registradas" />
        <Indicador tono="success" icono={CheckCircle2} valor={verifiedCount} etiqueta="Copias íntegras" />
        <Indicador tono="info" icono={FlaskConical} valor={testedCount} etiqueta="Restores probados OK" />
        <Indicador
          tono="warning"
          icono={ShieldCheck}
          valor={schedules.filter((s) => s.enabled).length}
          etiqueta="Agendas activas"
        />
      </div>

      <NanoLabsTabs
        idBase="backups-workspace"
        activa={tab}
        onCambiar={setTab}
        tabs={[
          { id: "estado", label: "Estado y Programación" },
          { id: "historial", label: "Historial, Importación y Jobs" },
          { id: "retencion", label: "Retención" },
        ]}
      >
        {tab === "estado" && (
          <div className="space-y-5">
            {loading && backups.length === 0 ? (
              <Cargando texto="Consultando estado de respaldos…" />
            ) : (
              <div className="ot-tabla">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="bh-table ot-fija min-w-[960px]">
                    <thead>
                      <tr>
                        <th>Aplicación</th>
                        <th>Motor</th>
                        <th>Última copia íntegra</th>
                        <th>Restore aislado</th>
                        <th>Agenda</th>
                        <th style={{ textAlign: "right" }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbApps.map((app) => {
                        const latest = backups
                          .filter((b) => b.appSlug === app.slug && b.status === "verified")
                          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                        const latestCheck = latest
                          ? checks.find((c) => c.backupId === latest.id && c.status === "passed")
                          : undefined;
                        const schedule = schedules.find((s) => s.slug === app.slug);
                        const canBackup = BACKUP_SUPPORTED_SLUGS.has(app.slug);
                        return (
                          <tr key={app.slug}>
                            <td>
                              <div className="bh-table-title">{app.name}</div>
                              <div className="bh-table-meta ot-mono">{app.slug}</div>
                            </td>
                            <td>
                              <NanoLabsChip severity="neutral">{app.dbType.toUpperCase()}</NanoLabsChip>
                            </td>
                            <td className="text-xs">
                              {latest ? (
                                <div>
                                  <span className="font-semibold">
                                    {new Date(latest.createdAt).toLocaleString("es-AR")}
                                  </span>
                                  <div className="bh-table-meta">{latest.sizeFormatted}</div>
                                </div>
                              ) : (
                                <NanoLabsChip severity="warning">Sin copia</NanoLabsChip>
                              )}
                            </td>
                            <td>
                              {latestCheck || latest?.restoreStatus === "passed" ? (
                                <NanoLabsChip severity="success">Aprobado</NanoLabsChip>
                              ) : latest?.restoreStatus === "failed" ? (
                                <NanoLabsChip severity="danger">Falló</NanoLabsChip>
                              ) : (
                                <NanoLabsChip severity="neutral">Sin probar</NanoLabsChip>
                              )}
                            </td>
                            <td>
                              {schedule ? (
                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                  <label className="inline-flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={schedule.enabled}
                                      onChange={(e) =>
                                        setSchedules((prev) =>
                                          prev.map((s) =>
                                            s.slug === schedule.slug ? { ...s, enabled: e.target.checked } : s
                                          )
                                        )
                                      }
                                    />
                                    <span>Cada {schedule.intervalHours ?? 6}h</span>
                                  </label>
                                  <NanoLabsButton
                                    size="small"
                                    variant="tertiary"
                                    disabled={busySlug === app.slug}
                                    onClick={() => void saveSchedule(schedule)}
                                  >
                                    Guardar
                                  </NanoLabsButton>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500">Protegida / Manual</span>
                              )}
                            </td>
                            <td>
                              <div className="flex justify-end gap-1.5">
                                {canBackup && (
                                  <NanoLabsButton
                                    size="small"
                                    icon={<Play size={13} />}
                                    disabled={busySlug === app.slug}
                                    onClick={() => setConfirmSlug(app.slug)}
                                  >
                                    Respaldar
                                  </NanoLabsButton>
                                )}
                                {latest && (
                                  <NanoLabsButton
                                    size="small"
                                    variant="secondary"
                                    icon={<FlaskConical size={13} />}
                                    disabled={busySlug === app.slug}
                                    onClick={() => void triggerRestoreCheck(latest.id, app.slug)}
                                  >
                                    Probar
                                  </NanoLabsButton>
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
            )}
          </div>
        )}

        {tab === "historial" && (
          <div className="space-y-5">
            <div className="bh-toolbar">
              <div className="bh-field max-w-xs">
                <label className="bh-label" htmlFor="filtro-backup-app">
                  Filtrar por aplicación
                </label>
                <select
                  id="filtro-backup-app"
                  className="bh-select"
                  value={selectedApp}
                  onChange={(e) => setSelectedApp(e.target.value)}
                >
                  <option value="all">Todas ({backups.length})</option>
                  {dbApps.map((a) => (
                    <option key={a.slug} value={a.slug}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ot-tabla">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="bh-table ot-fija min-w-[820px]">
                  <thead>
                    <tr>
                      <th>Archivo</th>
                      <th>Aplicación</th>
                      <th>Fecha</th>
                      <th>Tamaño</th>
                      <th>Integridad</th>
                      <th style={{ textAlign: "right" }}>Descarga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBackups.map((b) => (
                      <tr key={b.id}>
                        <td className="ot-mono text-xs">{b.filename}</td>
                        <td className="text-xs font-semibold">{b.appName}</td>
                        <td className="text-xs">{new Date(b.createdAt).toLocaleString("es-AR")}</td>
                        <td className="ot-mono text-xs">{b.sizeFormatted}</td>
                        <td>
                          <NanoLabsChip
                            severity={
                              b.status === "verified" ? "success" : b.status === "failed" ? "danger" : "warning"
                            }
                          >
                            {b.status === "verified" ? "Íntegro" : b.status}
                          </NanoLabsChip>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <a
                            href={`/api/backups/download?id=${encodeURIComponent(b.id)}`}
                            className="bh-btn bh-btn-secondary bh-btn--small inline-flex"
                          >
                            <Download size={13} /> Descargar
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <BackupImportPanel />
            <JobPanel />
          </div>
        )}

        {tab === "retencion" && <RetentionPanel report={retention} />}
      </NanoLabsTabs>

      <NanoLabsModal
        open={!!confirmSlug}
        onClose={() => setConfirmSlug(null)}
        title="Confirmar respaldo manual"
        icon={DatabaseBackup}
        width={460}
      >
        {confirmSlug && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-500">
              Se generará un respaldo completo y se verificará su checksum para{" "}
              <strong>{KNOWN_APPS.find((a) => a.slug === confirmSlug)?.name}</strong>.
            </p>
            <div className="bh-dialog__actions">
              <NanoLabsButton variant="secondary" onClick={() => setConfirmSlug(null)}>
                Cancelar
              </NanoLabsButton>
              <NanoLabsButton onClick={() => void triggerBackup(confirmSlug)}>Confirmar respaldo</NanoLabsButton>
            </div>
          </div>
        )}
      </NanoLabsModal>

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
