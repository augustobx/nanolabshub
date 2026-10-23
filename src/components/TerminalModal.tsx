"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal as TerminalIcon, X, Copy, Check, Download, RefreshCw, Radio, Square } from "lucide-react";

interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  output: string;
  isLoading?: boolean;
  isStreaming?: boolean;
  onStopStream?: () => void;
  onRefresh?: () => void;
}

export function TerminalModal({
  isOpen, onClose, title, output, isLoading, isStreaming, onStopStream, onRefresh,
}: TerminalModalProps) {
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const shouldFollowRef = useRef(true);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    shouldFollowRef.current = true;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      ) ?? []).filter((node) => node.getClientRects().length > 0);
      if (!controls.length) return;
      if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        controls[controls.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
        event.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    const viewport = outputRef.current;
    if (isOpen && viewport && shouldFollowRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [output, isOpen]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_")}_output.log`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060a12]/85 p-2 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="hub-terminal-title"
        className="flex h-[min(85dvh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121c2b] font-mono text-xs shadow-2xl outline-none">
        <div className="flex min-h-[66px] items-center justify-between gap-2 border-b border-white/[0.08] bg-[#1a2639] px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2c3e5d] text-brand-cyan">
              <TerminalIcon className="h-[17px] w-[17px]" />
            </span>
            <div className="min-w-0">
              <div id="hub-terminal-title" className="truncate text-xs font-semibold text-slate-100 sm:text-sm">{title}</div>
              <div role="status" className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                {isStreaming ? (
                  <><Radio className="h-3 w-3 text-emerald-400" /> Recibiendo información en vivo</>
                ) : isLoading ? (
                  <><RefreshCw className="h-3 w-3 animate-spin text-amber-400" /> Procesando</>
                ) : "Registro de ejecución"}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {isStreaming && onStopStream && (
              <button type="button" onClick={onStopStream} title="Detener recepción" aria-label="Detener recepción de logs"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-400/20 bg-rose-400/[0.08] px-2.5 text-[11px] text-rose-200 hover:bg-rose-400/15">
                <Square className="h-3 w-3" /><span className="hidden sm:inline">Detener</span>
              </button>
            )}
            {onRefresh && (
              <button type="button" onClick={onRefresh} title="Actualizar" aria-label="Actualizar consola"
                className="hub-icon-button !h-9 !w-9"><RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /></button>
            )}
            <button type="button" onClick={handleCopy} title="Copiar registro" aria-label="Copiar registro"
              className="hub-icon-button !h-9 !w-9">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
            <button type="button" onClick={handleDownload} title="Descargar registro" aria-label="Descargar registro"
              className="hub-icon-button !h-9 !w-9"><Download className="h-4 w-4" /></button>
            <button type="button" onClick={onClose} title="Cerrar consola" aria-label="Cerrar consola"
              className="hub-icon-button !h-9 !w-9 hover:!text-rose-300"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div ref={outputRef}
          onScroll={(event) => {
            const el = event.currentTarget;
            shouldFollowRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70;
          }}
          aria-label="Salida de la consola" role="log" aria-live="off"
          className="min-h-0 flex-1 overflow-auto bg-[#080f1b] px-4 py-5 font-mono text-xs leading-6 text-slate-300 sm:px-6">
          {output ? <pre className="whitespace-pre-wrap break-words font-mono">{output}</pre> :
            <div className="flex h-full items-center justify-center text-center text-slate-500">Conectando con el registro…</div>}
        </div>
        <div className="flex min-h-[42px] flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] bg-[#131e2d] px-4 py-2 text-[10px] text-slate-500 sm:px-6">
          <span>{isStreaming ? "Transmisión activa" : "Salida de comando"}</span>
          <span>Esc para cerrar · Copiar o guardar registro</span>
        </div>
      </div>
    </div>
  );
}
