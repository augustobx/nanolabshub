"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, RefreshCw, LogOut, X, AlertCircle, CheckCircle2, ChevronRight, Shield } from "lucide-react";
import { SystemAlert } from "@/lib/alerts";

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const PAGE_INFO: Record<string, { title: string; section: string }> = {
  "/": { title: "Resumen ejecutivo", section: "Inicio" },
  "/governance": { title: "Clientes y SaaS", section: "Negocio" },
  "/software": { title: "Productos y versiones", section: "Productos" },
  "/hardware": { title: "Infraestructura", section: "Plataforma" },
  "/backups": { title: "Copias de seguridad", section: "Plataforma" },
  "/networking": { title: "Dominios y red", section: "Plataforma" },
};

export function Header({ onRefresh, isRefreshing = false }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const info = PAGE_INFO[pathname] ?? PAGE_INFO["/"];
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsLoaded, setAlertsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const loadAlerts = async () => {
      try {
        const res = await fetch("/api/alerts");
        if (!res.ok) throw new Error("No se pudieron consultar las alertas");
        const data = await res.json();
        if (active && data.success && Array.isArray(data.data?.alerts)) {
          setAlerts(data.data.alerts);
          setAlertsLoaded(true);
        }
      } catch {
        if (active) setAlertsLoaded(false);
      }
    };
    void loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  useEffect(() => setAlertsOpen(false), [pathname]);

  const logout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("No se pudo cerrar la sesión");
      router.push("/login");
      router.refresh();
    } catch {
      window.alert("No se pudo cerrar la sesión. Volvé a intentarlo.");
    }
  };
  const critical = alerts.filter((a) => a.level === "critical").length;

  return (
    <header className="hub-header sticky top-0 z-20 flex min-h-[76px] w-full items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0b1220]/95 px-5 pl-[74px] backdrop-blur-xl sm:px-7 sm:pl-[74px] lg:px-9">
      <div className="min-w-0">
        <div className="hidden items-center gap-1.5 text-[11px] font-medium text-slate-500 sm:flex">
          NanoLabs <ChevronRight className="h-3 w-3" /> {info.section}
        </div>
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-100 sm:mt-0.5 sm:text-[18px]">
          {info.title}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onRefresh && (
          <button type="button" onClick={onRefresh} disabled={isRefreshing}
            aria-label="Actualizar datos" title="Actualizar datos"
            className="hub-icon-button flex items-center gap-2 px-3 disabled:cursor-wait disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden text-xs font-medium sm:inline">{isRefreshing ? "Actualizando" : "Actualizar"}</span>
          </button>
        )}
        <div className="relative">
          <button type="button"
            aria-label={alertsLoaded ? `Alertas: ${alerts.length}` : "Consultar alertas"}
            aria-expanded={alertsOpen} title="Centro de alertas"
            onClick={() => setAlertsOpen((v) => !v)} className="hub-icon-button relative">
            <Bell className="h-4 w-4" />
            {alerts.length > 0 && (
              <span className={`absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${critical ? "bg-rose-500" : "bg-amber-500"}`}>
                {alerts.length > 99 ? "99+" : alerts.length}
              </span>
            )}
          </button>
          {alertsOpen && (
            <div role="dialog" aria-label="Centro de alertas"
              className="absolute right-0 top-12 z-50 w-[min(350px,calc(100vw-28px))] overflow-hidden rounded-2xl border border-white/10 bg-[#182235] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="text-sm font-semibold text-white">Centro de alertas <span className="text-slate-400">({alerts.length})</span></div>
                <button type="button" onClick={() => setAlertsOpen(false)} aria-label="Cerrar alertas" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto p-3">
                {!alertsLoaded ? (
                  <p className="px-2 py-5 text-center text-xs text-slate-400">No se pudo verificar el estado de las alertas.</p>
                ) : alerts.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Sin alertas registradas</div>
                ) : alerts.map((a) => (
                  <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                      <AlertCircle className={`h-4 w-4 shrink-0 ${a.level === "critical" ? "text-rose-400" : "text-amber-400"}`} />{a.title}
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-slate-400">{a.message}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">{a.source}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="ml-1 flex items-center gap-2 border-l border-white/10 pl-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#273451] text-[#b0c1ff]" title="Administrador"><Shield className="h-[17px] w-[17px]" /></div>
          <span className="hidden text-xs font-medium text-slate-300 xl:block">Administrador</span>
          <button type="button" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión"
            className="hub-icon-button !border-transparent !bg-transparent hover:!bg-rose-500/10 hover:!text-rose-300"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </header>
  );
}
