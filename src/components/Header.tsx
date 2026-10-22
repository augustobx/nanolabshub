"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  RefreshCw,
  Terminal,
  Shield,
  Clock,
  Cpu,
  Layers,
  Bell,
  LogOut,
  AlertTriangle,
  X,
  CheckCircle2,
} from "lucide-react";
import { SystemAlert } from "@/lib/alerts";

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function Header({ onRefresh, isRefreshing }: HeaderProps) {
  const router = useRouter();
  const [time, setTime] = useState<string>("");
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [showAlertsDrawer, setShowAlertsDrawer] = useState(false);

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

  // Fetch alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch("/api/alerts");
        const data = await res.json();
        if (data.success && data.data?.alerts) {
          setAlerts(data.data.alerts);
        }
      } catch {}
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const criticalCount = alerts.filter((a) => a.level === "critical").length;

  return (
    <header className="h-16 border-b border-white/5 bg-[#080c14]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 font-sans">
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

      {/* Right: Actions, Live Clock, Alerts & Master Access */}
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

        {/* Alerts Bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlertsDrawer(!showAlertsDrawer)}
            className={`p-2 rounded-lg border transition-all relative ${
              criticalCount > 0
                ? "bg-rose-500/15 border-rose-500/30 text-rose-400 shadow-glow-rose"
                : alerts.length > 0
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "bg-surface-100 border-white/10 text-gray-400 hover:text-gray-200"
            }`}
            title="Centro de Alertas y Diagnóstico"
          >
            <Bell className="w-4 h-4" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-mono text-[9px] flex items-center justify-center font-bold">
                {alerts.length}
              </span>
            )}
          </button>

          {/* Alerts Dropdown Drawer */}
          {showAlertsDrawer && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0a0f1c] border border-white/10 rounded-xl shadow-2xl p-4 z-50 font-mono text-xs space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Alertas del Sistema ({alerts.length})
                </span>
                <button
                  onClick={() => setShowAlertsDrawer(false)}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {alerts.length === 0 ? (
                  <div className="py-4 text-center text-gray-500 flex flex-col items-center gap-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Todos los sistemas operando con normalidad</span>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-2.5 rounded-lg border space-y-1 ${
                        alert.level === "critical"
                          ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-[11px]">
                        <span>{alert.title}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-black/30">
                          {alert.source}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-300 leading-relaxed">
                        {alert.message}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Master User & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="flex items-center gap-2">
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

          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors ml-1"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
