"use client";

import { useEffect, useRef } from "react";
import { Terminal as TerminalIcon, X, Copy, Check, Download, RefreshCw } from "lucide-react";
import { useState } from "react";

interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  output: string;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function TerminalModal({
  isOpen,
  onClose,
  title,
  output,
  isLoading,
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
    a.download = `${title.toLowerCase().replace(/\s+/g, "_")}_output.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl h-[75vh] flex flex-col bg-[#090d16] border border-brand-cyan/30 rounded-xl shadow-2xl overflow-hidden font-mono text-xs">
        {/* Modal Header */}
        <div className="h-11 px-4 bg-[#0d1424] border-b border-white/10 flex items-center justify-between select-none">
          <div className="flex items-center gap-2 text-brand-cyan">
            <TerminalIcon className="w-4 h-4" />
            <span className="font-semibold text-gray-200">{title}</span>
            {isLoading && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                <RefreshCw className="w-3 h-3 animate-spin" />
                EJECUTANDO...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                title="Refrescar logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              title="Copiar texto"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              title="Descargar archivo .log"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Terminal Body */}
        <div className="flex-1 p-4 bg-[#05080e] overflow-y-auto text-gray-300 whitespace-pre-wrap font-mono leading-relaxed select-text">
          {output ? (
            output
          ) : (
            <div className="text-gray-500 italic flex items-center justify-center h-full">
              Esperando salida de consola...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Modal Footer */}
        <div className="h-8 px-4 bg-[#080c14] border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
          <span>NanoLabs Remote Console · Debian dedicated</span>
          <span>Presione ESC o cerrar para salir</span>
        </div>
      </div>
    </div>
  );
}
