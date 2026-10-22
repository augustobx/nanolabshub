"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Cpu,
  Boxes,
  Database,
  Network,
  Crown,
  Server,
  Terminal,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

const NAVIGATION_ITEMS = [
  {
    name: "Mission Control",
    href: "/",
    icon: LayoutDashboard,
    badge: "LIVE",
    badgeColor: "text-brand-cyan bg-brand-cyan/10 border-brand-cyan/20",
  },
  {
    name: "Hardware & Infra",
    href: "/hardware",
    icon: Cpu,
    badge: "12 Cores",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    name: "Software & Versiones",
    href: "/software",
    icon: Boxes,
    badge: "15 Apps",
    badgeColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  {
    name: "Backups & DR",
    href: "/backups",
    icon: Database,
    badge: "Dumps OK",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    name: "Red & Proxy NPM",
    href: "/networking",
    icon: Network,
    badge: "SSL Active",
    badgeColor: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
  {
    name: "Supreme Governance",
    href: "/governance",
    icon: Crown,
    badge: "Multi-SaaS",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-white/5 bg-[#080c14]/90 backdrop-blur-xl flex flex-col h-screen sticky top-0 z-40 select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-cyan via-blue-600 to-purple-600 p-[1px] shadow-glow">
          <div className="w-full h-full bg-[#080c14] rounded-xl flex items-center justify-center">
            <Crown className="w-5 h-5 text-brand-cyan animate-pulse" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-white font-mono text-sm">
              NANOLABS<span className="text-brand-cyan">HUB</span>
            </span>
          </div>
          <p className="text-[10px] text-gray-400 tracking-wider font-mono uppercase">
            GOVERNANCE SUPREMO
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-gray-500 uppercase font-mono">
          Operaciones de Plataforma
        </div>
        {NAVIGATION_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-link-${item.href.replace("/", "") || "home"}`}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                isActive
                  ? "bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/25 shadow-glow font-semibold"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? "text-brand-cyan" : "text-gray-500 group-hover:text-gray-300"
                  }`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Server Status Footer */}
      <div className="p-3 border-t border-white/5 bg-black/20">
        <div className="p-2.5 rounded-lg bg-surface-100/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1.5">
              <Server className="w-3 h-3 text-brand-cyan" />
              149.50.159.163
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              CONECTADO
            </span>
          </div>
          <div className="text-[10px] text-gray-500 font-mono flex items-center justify-between">
            <span>Debian 13 (x86_64)</span>
            <span className="text-gray-400">SSH :2207</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
