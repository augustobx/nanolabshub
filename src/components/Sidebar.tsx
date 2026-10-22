"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Layers3, Building2, Package, ServerCog, DatabaseBackup,
  Globe2, Menu, X, PanelLeftClose, PanelLeftOpen, ShieldCheck,
  Workflow, Boxes, Archive, Activity, ChevronRight
} from "lucide-react";

export const NAV_GROUPS = [
  { title: "Gobierno", items: [
    { name: "Inicio", href: "/", icon: LayoutDashboard, description: "Estado y prioridades" },
    { name: "Superadmin", href: "/superadmin", icon: ShieldCheck, description: "Alcance y control global" },
  ] },
  { title: "Negocio", items: [
    { name: "Productos SaaS", href: "/saas", icon: Layers3, description: "Un espacio consistente por producto" },
    { name: "Clientes y tenants", href: "/governance", icon: Building2, description: "Empresas, planes y módulos" },
  ] },
  { title: "Portafolio", items: [
    { name: "Apps internas", href: "/software?segment=internal", icon: Package, description: "Herramientas NanoLabs" },
    { name: "Clientes dedicados", href: "/software?segment=dedicated", icon: Boxes, description: "Instancias particulares" },
    { name: "Archivadas", href: "/software?archived=1", icon: Archive, description: "Historial y reactivación" },
  ] },
  { title: "Plataforma", items: [
    { name: "Operación técnica", href: "/operations", icon: Activity, description: "Docker, Git y acciones avanzadas" },
    { name: "Infraestructura", href: "/infrastructure", icon: ServerCog, description: "Host y componentes clasificados" },
    { name: "Backups", href: "/backups", icon: DatabaseBackup, description: "Protección de datos" },
    { name: "Red y dominios", href: "/networking", icon: Globe2, description: "Red y certificados" },
  ] },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [currentSearch, setCurrentSearch] = useState("");
  useEffect(() => { setMobileOpen(false); setCurrentSearch(window.location.search); }, [pathname]);
  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem("hub-sidebar-collapsed") === "1"); } catch {}
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      try { window.localStorage.setItem("hub-sidebar-collapsed", previous ? "0" : "1"); } catch {}
      return !previous;
    });
  };
  if (pathname === "/login") return null;
  return (
    <>
      <button type="button" onClick={() => setMobileOpen((value) => !value)}
        aria-label={mobileOpen ? "Cerrar navegación" : "Abrir navegación"}
        aria-expanded={mobileOpen} aria-controls="hub-primary-navigation"
        className="fixed left-4 top-4 z-[70] flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-[#1b2b42] text-white shadow-lg lg:hidden">
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {mobileOpen && <button type="button" onClick={() => setMobileOpen(false)}
        aria-label="Cerrar menú" className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-[2px] lg:hidden" />}
      <aside id="hub-primary-navigation" aria-label="Navegación principal"
        className={"hub-sidebar fixed inset-y-0 left-0 z-50 flex w-[280px] shrink-0 flex-col border-r border-white/10 bg-[#111e30] transition-all duration-200 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 " +
          (mobileOpen ? "translate-x-0 " : "-translate-x-full ") +
          (collapsed ? "lg:w-[76px]" : "lg:w-[264px]")}>
        <Link href="/" aria-label="NanoLabs Hub, ir al inicio"
          className={"flex h-[76px] shrink-0 items-center gap-3 border-b border-white/[0.08] " + (collapsed ? "px-4" : "px-5")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#a1bbfa] text-[#14243c] font-black shadow-sm">N</div>
          <div className={"min-w-0 " + (collapsed ? "lg:hidden" : "")}>
            <p className="text-[15px] font-extrabold tracking-tight text-white">NanoLabs <span className="font-medium text-[#9db9f4]">Hub</span></p>
            <p className="mt-0.5 text-[10px] font-medium tracking-[0.08em] text-slate-400">Centro de administración</p>
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto px-2.5 py-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-5">
              <p className={"mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8295af] " +
                (collapsed ? "lg:sr-only" : "")}>{group.title}</p>
              <nav aria-label={group.title} className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const [base, query] = item.href.split("?");
                  const matchesPath = base === "/" ? pathname === "/" :
                    pathname === base || pathname.startsWith(base + "/");
                  const active = matchesPath && (!query || currentSearch.includes(query));
                  return (
                    <Link key={item.href} href={item.href} title={item.description}
                      onClick={() => setCurrentSearch(query ? "?" + query : "")}
                      aria-current={active ? "page" : undefined}
                      className={"group flex min-h-[43px] items-center gap-3 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors " +
                        (active ? "bg-[#30476a] text-white" : "text-[#b5c3d5] hover:bg-white/[0.06] hover:text-white")}>
                      <Icon strokeWidth={1.8} className={"h-[18px] w-[18px] shrink-0 " + (active ? "text-[#b5cbff]" : "text-[#8fa2bc]")} />
                      <span className={"min-w-0 flex-1 truncate " + (collapsed ? "lg:hidden" : "")}>{item.name}</span>
                      {active && <ChevronRight className={"h-4 w-4 text-[#b5cbff] " + (collapsed ? "lg:hidden" : "")} />}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
        <div className="shrink-0 border-t border-white/[0.08] p-3">
          <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            className="hidden min-h-10 w-full items-center gap-3 rounded-xl px-3 text-xs font-semibold text-slate-300 hover:bg-white/[0.05] lg:flex">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && "Contraer navegación"}
          </button>
          <p className={"px-3 py-1 text-[10px] text-slate-500 " + (collapsed ? "lg:hidden" : "")}>NanoLabs · Producción</p>
        </div>
      </aside>
    </>
  );
}
