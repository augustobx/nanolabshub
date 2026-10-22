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
  isOpen,
  onClose,
  title,
  output,
  isLoading,
  isStreaming,
  onStopStream,
  onRefresh,
}: TerminalModalProps) {
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [output, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_output.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[78vh] flex flex-col bg-[#080c14] border border-brand-cyan/35 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs">
        {/* Modal Header */}
        <div className="h-12 px-4 bg-[#0d1424] border-b border-white/10 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30">
              <TerminalIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">{title}</span>
                {isStreaming && (
                  <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold animate-pulse">
                    <Radio className="w-3 h-3" />
                    STREAMING EN VIVO
                  </span>
                )}
                {isLoading && !isStreaming && (
                  <span className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    PROCESANDO...
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isStreaming && onStopStream && (
              <button
                onClick={onStopStream}
                className="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] flex items-center gap-1 transition-colors"
                title="Detener recepción de logs"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>DETENER</span>
              </button>
            )}

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Refrescar"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-brand-cyan" : ""}`} />
              </button>
            )}

            <button
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Copiar texto"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleDownload}
              className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Descargar salida"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors ml-1"
              title="Cerrar ventana"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Terminal Body */}
        <div className="flex-1 p-4 bg-[#05080e] overflow-y-auto text-gray-300 whitespace-pre-wrap font-mono leading-relaxed select-text border-t border-b border-white/5">
          {output ? (
            output
          ) : (
            <div className="text-gray-500 italic flex items-center justify-center h-full">
              Conectando con el flujo de salida en el servidor...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Modal Footer */}
        <div className="h-9 px-4 bg-[#090d16] flex items-center justify-between text-[10px] text-gray-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Servidor Dedicado Debian · /var/run/docker.sock</span>
          </div>
          <span>Presione ESC o Cerrar para salir</span>
        </div>
      </div>
    </div>
  );
}
