"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, History, PauseCircle, PlayCircle, ShieldAlert, Clock3 } from "lucide-react";
import type { AppInfo } from "@/lib/types";

type Action = "suspend" | "resume" | "pending_retirement" | "archive";
type Event = {
  id: number; timestamp: string; actor: string; action: string;
  oldState: string; newState: string; details: string;
};
const labels = {
  active: "Activa", suspended: "Suspendida",
  pending_retirement: "Baja pendiente", archived: "Archivada",
};
const choices: { action: Action; title: string; help: string }[] = [
  { action: "suspend", title: "Suspender servicio", help: "Detiene todos los contenedores registrados y desactiva su reinicio automático." },
  { action: "pending_retirement", title: "Baja pendiente", help: "Registra la baja pendiente. Mantiene Docker como está y detiene la vigilancia web." },
  { action: "archive", title: "Archivar aplicación", help: "Detiene los contenedores, deshabilita su reinicio y oculta la aplicación del panel principal. No borra datos." },
  { action: "resume", title: "Reactivar aplicación", help: "Inicia solo los contenedores que estaban activos y restaura sus políticas de reinicio originales." },
];

export function AppLifecycleControls({ app, onChanged }: { app: AppInfo; onChanged: () => Promise<void> | void }) {
  const state = app.lifecycle?.state || "active";
  const protectedApp = app.type === "infrastructure" || app.slug === "nanolabshub";
  const [selected, setSelected] = useState<Action | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [backupAck, setBackupAck] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [history, setHistory] = useState<Event[] | null>(null);
  const [backupInfo, setBackupInfo] = useState<{ status: "ready" | "missing" | "loading" | "error"; at?: string }>({ status: "loading" });
  useEffect(() => {
    if (selected !== "archive") return;
    let cancelled = false;
    setBackupInfo({ status: "loading" });
    fetch("/api/backups", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) throw Error("Historial de respaldos no disponible");
      const found = (result.data as Array<{ appSlug: string; status: string; createdAt: string }>).find((backup) =>
        backup.appSlug === app.slug && backup.status === "verified");
      if (!cancelled) setBackupInfo(found ? { status: "ready", at: found.createdAt } : { status: "missing" });
    }).catch(() => { if (!cancelled) setBackupInfo({ status: "error" }); });
    return () => { cancelled = true; };
  }, [selected, app.slug]);

  const [loadingHistory, setLoadingHistory] = useState(false);
  const selectedChoice = choices.find((choice) => choice.action === selected);
  const transitions = state === "archived" ? ["resume"] :
    state === "suspended" ? ["pending_retirement", "archive", "resume"] :
    state === "pending_retirement" ? ["suspend", "archive", "resume"] :
    ["suspend", "pending_retirement", "archive"];

  async function loadHistory() {
    if (history) { setHistory(null); return; }
    setLoadingHistory(true);
    setError(null);
    try {
      const response = await fetch("/api/apps/lifecycle?slug=" + encodeURIComponent(app.slug), { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Historial no disponible");
      setHistory(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo consultar el historial");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function apply() {
    if (!selected || confirmation !== app.slug || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/apps/lifecycle", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: app.slug, action: selected, confirmation,
          acknowledgeBackup: backupAck, note: note.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Operación rechazada");
      setSuccess(payload.data.details + " Estado: " + payload.data.label + ".");
      setHistory(null);
      setSelected(null);
      setConfirmation("");
      setBackupAck(false);
      setNote("");
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo aplicar la acción");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={"Ciclo de vida de " + app.name} className="rounded-xl border border-white/10 bg-slate-950/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ciclo de vida</p>
          <p className={"mt-1 text-xs font-semibold " + (state === "active" ? "text-emerald-300" : state === "archived" ? "text-slate-300" : "text-amber-200")}>
            {labels[state]}
            {app.lifecycle?.updatedAt && <span className="ml-2 font-normal text-slate-500">· {new Date(app.lifecycle.updatedAt).toLocaleString("es-AR")}</span>}
          </p>
          {app.lifecycle?.note && <p className="mt-1 text-xs text-slate-400">{app.lifecycle.note}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void loadHistory()} disabled={loadingHistory}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50">
            <History className="h-3.5 w-3.5" /> Historial
          </button>
          {!protectedApp && transitions.map((transition) => {
            const choice = choices.find((item) => item.action === transition)!;
            const Icon = choice.action === "suspend" ? PauseCircle :
              choice.action === "archive" ? Archive : choice.action === "resume" ? PlayCircle : Clock3;
            return <button type="button" key={choice.action} onClick={() => { setSelected(choice.action); setConfirmation(""); setBackupAck(false); setError(null); }}
              className={"inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors " +
                (choice.action === "archive" ? "border-rose-500/30 text-rose-200 hover:bg-rose-500/10" :
                 "border-white/10 text-slate-300 hover:bg-white/5")}>
              <Icon className="h-3.5 w-3.5" /> {choice.title}
            </button>;
          })}
        </div>
      </div>
      {protectedApp && <p className="mt-2 text-xs text-slate-500">Infraestructura protegida: no se permite desactivar desde el Hub.</p>}
      {success && <p role="status" className="mt-2 text-xs leading-5 text-emerald-300">{success}</p>}
      {error && !selected && <p role="alert" className="mt-2 text-xs leading-5 text-rose-300">{error}</p>}
      {history && <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        {history.length === 0 ? <p className="text-xs text-slate-400">Sin operaciones registradas.</p> :
          history.map((event) => <div key={event.id} className="rounded-lg bg-white/[0.03] p-2.5 text-xs">
            <p className="font-medium text-slate-200">{event.oldState} → {event.newState} · {event.action}</p>
            <p className="mt-0.5 text-slate-500">{new Date(event.timestamp).toLocaleString("es-AR")} · {event.actor}</p>
            <p className="mt-1 text-slate-400">{event.details}</p>
          </div>)}
      </div>}
      {selected && selectedChoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog"
          aria-modal="true" aria-label={selectedChoice.title}>
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/15 bg-[#172235] p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-200"><ShieldAlert className="h-5 w-5" /><h3 className="text-base font-semibold">{selectedChoice.title}</h3></div>
            <p className="text-sm text-slate-300">{selectedChoice.help}</p>
            <p className="text-xs leading-5 text-slate-400">Aplicación: <strong className="text-white">{app.name}</strong>. Esta acción afecta producción. No elimina archivos, volúmenes Docker ni bases de datos. No modifica DNS ni Nginx Proxy Manager.</p>
            <div className="rounded-lg border border-white/10 bg-slate-950/30 p-3 text-xs leading-5 text-slate-300">
              <p className="font-semibold text-white">Contenedores afectados ({app.containers.length})</p>
              {app.containers.length ? <p className="mt-1 break-words font-mono">{app.containers.map((c) => c.name).join(", ")}</p> :
                <p className="mt-1 text-amber-200">No hay contenedores detectados; solo se registrará el estado administrativo.</p>}
              {app.database?.type && app.database.type !== "none" && <p className="mt-1 text-amber-200">Motor de datos: {app.database.type}. La base no se elimina.</p>}
            </div>
            {selected === "archive" && (
              <p className="rounded-lg border border-white/10 p-3 text-xs leading-5 text-slate-300">
                {backupInfo.status === "loading" ? "Consultando último backup…" :
                 backupInfo.status === "ready" ? "Último backup con integridad comprobada: " + backupInfo.at + ". No existe restauración probada." :
                 backupInfo.status === "missing" ? "No hay backups de esta aplicación con integridad comprobada." :
                 "No fue posible comprobar el historial de backups."}
                {" "}<Link href="/backups" className="font-semibold text-brand-cyan underline">Ir al centro de backups</Link>
              </p>
            )}
            {selected === "archive" && (
              <label className="flex items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-amber-100">
                <input type="checkbox" checked={backupAck} onChange={(e) => setBackupAck(e.target.checked)} className="mt-1" />
                Entiendo que el Hub todavía no comprobó la existencia de un backup restaurable. Archivar conserva los datos, pero no crea un respaldo nuevo.
              </label>
            )}
            <label className="block space-y-1.5 text-xs text-slate-300">
              Motivo (opcional)
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={250}
                className="w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2.5 text-sm text-white" placeholder="Por qué se realiza esta acción" />
            </label>
            <label className="block space-y-1.5 text-xs text-slate-300">
              Para confirmar, escribí <strong className="font-mono text-white">{app.slug}</strong>
              <input type="text" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off"
                className="w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2.5 font-mono text-sm text-white"
                placeholder={app.slug} aria-label="Confirmar identificador de aplicación" />
            </label>
            {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => { setSelected(null); setError(null); }}
                className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-slate-200 disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={() => void apply()}
                disabled={busy || confirmation !== app.slug || (selected === "archive" && !backupAck)}
                className="rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? "Aplicando en Docker…" : "Confirmar " + selectedChoice.title.toLowerCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
