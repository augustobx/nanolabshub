"use client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  Bell,
  Building2,
  CheckCircle2,
  DatabaseBackup,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ServerCog,
  ShieldCheck,
  Sun,
  UserCheck,
  X,
} from "lucide-react";
import type { SystemAlert } from "@/lib/alerts";
import { PaletteSelector } from "./nanolabs/PaletteSelector";
import { useERPTheme } from "./nanolabs/ThemeContext";

const CLAVE_PLEGADO = "nl-hub-sidebar-collapsed";
const PLEGADO_W = 76;

export const HUB_NAV_ITEMS = [
  {
    ruta: "/",
    nombre: "Inicio",
    descripcion: "Centro de comando y alertas",
    Icono: LayoutDashboard,
    match: (p: string) => p === "/",
  },
  {
    ruta: "/clientes",
    nombre: "Membresías y Clientes",
    descripcion: "Vista rápida, vencimientos, SaaS y planes",
    Icono: Building2,
    match: (p: string) =>
      p.startsWith("/clientes") ||
      p.startsWith("/governance") ||
      p.startsWith("/superadmin") ||
      p.startsWith("/saas") ||
      p.startsWith("/legacy"),
  },
  {
    ruta: "/infraestructura",
    nombre: "Apps y Servidor",
    descripcion: "Aplicaciones, Docker, Git y dominios",
    Icono: ServerCog,
    match: (p: string) =>
      p.startsWith("/infraestructura") ||
      p.startsWith("/infrastructure") ||
      p.startsWith("/operations") ||
      p.startsWith("/hardware") ||
      p.startsWith("/software") ||
      p.startsWith("/networking"),
  },
  {
    ruta: "/backups",
    nombre: "Backups y Continuidad",
    descripcion: "Respaldos, programación y restore aislado",
    Icono: DatabaseBackup,
    match: (p: string) => p.startsWith("/backups") || p.startsWith("/continuity"),
  },
  {
    ruta: "/seguridad",
    nombre: "Seguridad y Cuenta",
    descripcion: "Conectores, MFA, usuarios y auditoría",
    Icono: ShieldCheck,
    match: (p: string) =>
      p.startsWith("/seguridad") ||
      p.startsWith("/security") ||
      p.startsWith("/audit") ||
      p.startsWith("/account"),
  },
] as const;

export function HubShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { palette, isDark, toggleDarkMode } = useERPTheme();

  const [plegado, setPlegado] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tooltip, setTooltip] = useState<{ texto: string; top: number } | null>(null);

  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const alertsRef = useRef<HTMLDivElement>(null);

  const [account, setAccount] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      setPlegado(localStorage.getItem(CLAVE_PLEGADO) === "1");
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setAlertsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/login") return;
    let active = true;
    const loadAlerts = async () => {
      try {
        const res = await fetch("/api/alerts", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
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
    const loadAccount = async () => {
      try {
        const res = await fetch("/api/auth/account", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (active && json.success && json.data?.username) {
            setAccount({ username: json.data.username, role: json.data.role || "owner" });
          }
        }
      } catch {
        // optional display info
      }
    };
    void loadAlerts();
    void loadAccount();
    const interval = setInterval(loadAlerts, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [pathname, router]);

  useEffect(() => {
    if (pathname === "/login") return;
    let lastTouched = 0;
    const touch = () => {
      const now = Date.now();
      if (now - lastTouched < 60000) return;
      lastTouched = now;
      fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "session.touch" }),
      })
        .then((r) => {
          if (r.status === 401) router.replace("/login");
        })
        .catch(() => {
          // failed heartbeat does not extend session
        });
    };
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!alertsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setAlertsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [alertsOpen]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const togglePlegado = () => {
    setPlegado((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CLAVE_PLEGADO, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("No se pudo cerrar la sesión");
      window.location.replace("/login");
    } catch {
      window.alert("No se pudo cerrar la sesión. Volvé a intentarlo.");
    }
  };

  const critical = alerts.filter((a) => a.level === "critical").length;
  const userName = account?.username || "Administrador";
  const initials =
    userName
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "NL";

  return (
    <div className="bh-layout theme-nanolabs" data-nl-theme="2">
      {/* HEADER 80px */}
      <header className="bh-header bh-header--retail">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Cerrar navegación" : "Abrir navegación"}
            aria-expanded={mobileOpen}
            className="bh-header__icon-btn lg:!hidden"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className="bh-logo min-w-0" style={{ textDecoration: "none" }}>
            <div className="bh-logo__mark">
              <span
                className="ot-mark nl-mark"
                style={{
                  background: palette.gradient,
                  boxShadow: `0 4px 14px ${palette.glow}`,
                }}
              >
                <Activity size={22} strokeWidth={2.2} />
              </span>
            </div>
            <div className="bh-logo__text truncate">
              NanoLabs Hub
              <span>Control SaaS & Plataforma</span>
            </div>
          </Link>
        </div>

        <div className="bh-header__actions">
          {/* Centro de alertas */}
          <div className="relative" ref={alertsRef}>
            <button
              type="button"
              aria-label={alertsLoaded ? `Alertas: ${alerts.length}` : "Consultar alertas"}
              aria-expanded={alertsOpen}
              title="Centro de alertas"
              onClick={() => setAlertsOpen((v) => !v)}
              className="bh-header__icon-btn relative"
            >
              <Bell size={18} />
              {alerts.length > 0 && (
                <span
                  className="bh-notif-badge"
                  style={critical ? { background: "#dc2626" } : undefined}
                >
                  {alerts.length > 99 ? "99+" : alerts.length}
                </span>
              )}
            </button>

            {alertsOpen && (
              <div
                role="dialog"
                aria-label="Centro de alertas"
                className="bh-card bh-notif-dropdown"
              >
                <div className="bh-notif-dropdown__header">
                  <span className="text-xs font-bold">
                    Centro de alertas ({alerts.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setAlertsOpen(false)}
                    aria-label="Cerrar alertas"
                    className="bh-header__icon-btn !h-7 !w-7"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="space-y-2 p-2">
                  {!alertsLoaded ? (
                    <p className="py-4 text-center text-xs text-slate-500">
                      No se pudo verificar el estado de las alertas.
                    </p>
                  ) : alerts.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-5 text-xs text-slate-500">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      Sin alertas registradas
                    </div>
                  ) : (
                    alerts.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-xl border border-slate-200 p-2.5 text-xs dark:border-slate-800"
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          <AlertCircle
                            size={15}
                            className={
                              a.level === "critical" ? "text-rose-500" : "text-amber-500"
                            }
                          />
                          <span>{a.title}</span>
                        </div>
                        <p className="mt-1 opacity-80">{a.message}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider opacity-60">
                          {a.source}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Selector de las 7 paletas */}
          <PaletteSelector />

          {/* Usuario y cuenta */}
          <Link
            href="/seguridad?tab=cuenta"
            className="hidden items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60 sm:flex"
            title="Mi cuenta y MFA"
            style={{ textDecoration: "none" }}
          >
            <div className="ot-usuario">
              <div className="bh-list-primary font-bold">{userName}</div>
              <div className="bh-list-secondary text-[10px] font-semibold uppercase tracking-wider opacity-75">
                {account?.role === "owner" ? "Propietario" : account?.role || "Admin"}
              </div>
            </div>
            <div className="bh-avatar">{initials}</div>
          </Link>

          <Link
            href="/seguridad?tab=cuenta"
            className="bh-header__icon-btn sm:!hidden"
            aria-label="Mi cuenta"
            title="Mi cuenta"
          >
            <UserCheck size={18} />
          </Link>

          {/* Cerrar sesión */}
          <button
            type="button"
            className="bh-header__icon-btn text-rose-500 hover:text-rose-600"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* BODY + SIDEBAR */}
      <div className="bh-layout__body">
        {mobileOpen && (
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          />
        )}

        <aside
          id="hub-primary-navigation"
          aria-label="Navegación principal"
          className={`bh-sidebar hub-sidebar-drawer${plegado ? " bh-sidebar--collapsed" : ""}${
            mobileOpen ? " hub-sidebar-drawer--open" : ""
          }`}
          style={plegado ? { ["--bh-sidebar-width" as string]: `${PLEGADO_W}px` } : undefined}
        >
          <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="Secciones principales">
            {HUB_NAV_ITEMS.map(({ ruta, nombre, descripcion, Icono, match }) => {
              const active = match(pathname);
              return (
                <Link
                  key={ruta}
                  href={ruta}
                  aria-label={nombre}
                  aria-current={active ? "page" : undefined}
                  title={plegado ? undefined : descripcion}
                  className={`bh-sidebar__item${active ? " active" : ""}${
                    plegado ? " bh-sidebar__item--collapsed" : ""
                  }`}
                  onMouseEnter={(e) => {
                    if (!plegado) return;
                    const r = e.currentTarget.getBoundingClientRect();
                    setTooltip({ texto: nombre, top: r.top + r.height / 2 });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <span className="bh-sidebar__icon-chip">
                    <Icono size={17} strokeWidth={2} />
                  </span>
                  {!plegado && <span className="truncate">{nombre}</span>}
                </Link>
              );
            })}
          </nav>

          <div
            className={`bh-sidebar__footer${plegado ? " bh-sidebar__footer--collapsed" : ""}`}
          >
            <button
              type="button"
              className="bh-sidebar__icon-btn"
              onClick={toggleDarkMode}
              aria-label="Cambiar tema claro u oscuro"
              title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              className="bh-sidebar__icon-btn bh-sidebar__desktop-only"
              onClick={togglePlegado}
              aria-label={plegado ? "Expandir navegación" : "Contraer navegación"}
              title={plegado ? "Expandir navegación" : "Contraer navegación"}
            >
              {plegado ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
        </aside>

        <main id="main-content" className="bh-main bh-cascada ot-pagina min-w-0 flex-1">
          {children}
        </main>
      </div>

      {mounted &&
        tooltip &&
        createPortal(
          <span
            className="bh-sidebar__tooltip ot-tooltip"
            style={{ top: tooltip.top, left: PLEGADO_W + 10, zIndex: 1000 }}
          >
            {tooltip.texto}
          </span>,
          document.body
        )}
    </div>
  );
}
