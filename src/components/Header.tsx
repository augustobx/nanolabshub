"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  RefreshCw,
  Terminal,
  Shield,
  Clock,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenTerminal?: () => void;
}

export function Header({ onRefresh, isRefreshing, onOpenTerminal }: HeaderProps) {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "America/Argentina/Buenos_Aires",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-white/5 bg-[#080c14]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Server Pulse & Host */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>PROD-DEDICATED</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300 font-semibold">149.50.159.163</span>
        </div>

        <div className="hidden lg:flex items-center gap-3 text-xs text-gray-400 font-mono">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/[0.03] border border-white/5">
            <Cpu className="w-3.5 h-3.5 text-brand-cyan" />
            i5-12400 (12T)
          </span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/[0.03] border border-white/5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            16GB RAM · 462GB NVMe
          </span>
        </div>
      </div>

      {/* Right: Actions, Live Clock, SuperAdmin badge */}
      <div className="flex items-center gap-3">
        {/* Clock */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/[0.03] border border-white/5 text-gray-300 font-mono text-xs">
          <Clock className="w-3.5 h-3.5 text-gray-500" />
          <span>{time || "00:00:00"}</span>
          <span className="text-[10px] text-gray-500">ART</span>
        </div>

        {/* Live Refresh */}
        <button
          id="btn-global-refresh"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all border ${
            isRefreshing
              ? "bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30"
              : "bg-surface-100 hover:bg-surface-50 text-gray-300 hover:text-white border-white/10"
          }`}
          title="Actualizar telemetría de producción"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-brand-cyan" : ""}`} />
          <span>{isRefreshing ? "ACTUALIZANDO..." : "REFRESCAR"}</span>
        </button>

        {/* Master Access Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div className="hidden sm:block text-left font-mono">
            <div className="text-[11px] text-gray-200 font-semibold leading-none">augusto</div>
            <div className="text-[9px] text-amber-400 uppercase tracking-wider font-semibold">
              Supreme Master
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
