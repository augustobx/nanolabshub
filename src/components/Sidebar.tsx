"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Building2, Boxes, Server, DatabaseBackup, Globe2, Menu, X, ChevronRight, ShieldCheck, Command } from "lucide-react";

const NAV_GROUPS = [
  { title: "Espacio de trabajo", items: [
    { name: "Centro de control", href: "/", icon: LayoutDashboard, description: "Operación en vivo del servidor" },
    { name: "Clientes y SaaS", href: "/governance", icon: Building2, description: "Empresas, planes y módulos" },
    { name: "Productos y versiones", href: "/software", icon: Boxes, description: "Aplicaciones y despliegues" },
  ] },
  { title: "Operación y plataforma", items: [
    { name: "Infraestructura", href: "/hardware", icon: Server, description: "Servidores y contenedores" },
    { name: "Copias de seguridad", href: "/backups", icon: DatabaseBackup, description: "Protección y recuperación" },
    { name: "Dominios y red", href: "/networking", icon: Globe2, description: "Proxy y certificados" },
  ] },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);

  if (pathname === "/login") return null;

  return (
    <>
      <button type="button" onClick={() => setMobileOpen((v) => !v)}
        className="lg:hidden fixed left-4 top-4 z-[70] flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#1b263b] text-slate-100 shadow-lg"
        aria-label={mobileOpen ? "Cerrar navegación" : "Abrir navegación"}
        aria-expanded={mobileOpen} aria-controls="hub-primary-navigation">
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm lg:hidden" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}
      <aside id="hub-primary-navigation"
        className={`hub-sidebar fixed inset-y-0 left-0 z-50 flex w-[272px] shrink-0 flex-col border-r border-white/[0.07] bg-[#101827] transition-transform duration-200 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Link href="/" className="flex h-20 items-center gap-3 border-b border-white/[0.07] px-6" aria-label="NanoLabs, ir al resumen">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8ea8ff] text-[#101827] shadow-sm"><Command className="h-5 w-5 stroke-[2.4]" /></div>
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold tracking-[-0.045em] text-white">nano<span className="text-[#9bb0ff]">labs</span></div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Governance Hub</div>
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto px-3.5 py-7">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-7">
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.17em] text-slate-500">{group.title}</p>
              <nav aria-label={group.title} className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} title={item.description}
                      className={`group flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${active ? "bg-[#263450] text-white" : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100"}`}>
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-[#9db5ff]" : "text-slate-500 group-hover:text-slate-300"}`} strokeWidth={1.9} />
                      <span className="min-w-0 flex-1">{item.name}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5 text-[#9db5ff]" />}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
        <div className="border-t border-white/[0.07] p-4">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3.5 py-3.5">
            <div className="flex items-center gap-2.5 text-xs font-medium text-slate-200"><ShieldCheck className="h-4 w-4 text-[#9db5ff]" /> Administración central</div>
            <p className="mt-1.5 pl-[26px] text-[11px] leading-relaxed text-slate-500">NanoLabs · Entorno de producción</p>
          </div>
        </div>
      </aside>
    </>
  );
}
