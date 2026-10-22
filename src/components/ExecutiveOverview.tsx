"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, CheckCircle2, Clock3, Layers3, Boxes, Server, DatabaseBackup, AlertCircle } from "lucide-react";
import type { GovernanceOverview } from "@/lib/types";

const SHORTCUTS = [
  { href: "/governance", title: "Gestionar clientes", subtitle: "Empresas, planes y módulos", icon: Building2 },
  { href: "/software", title: "Ver productos", subtitle: "Versiones y despliegues", icon: Boxes },
  { href: "/hardware", title: "Revisar infraestructura", subtitle: "Capacidad y contenedores", icon: Server },
  { href: "/backups", title: "Consultar respaldos", subtitle: "Copias y recuperación", icon: DatabaseBackup },
];

export function ExecutiveOverview() {
  const [overview, setOverview] = useState<GovernanceOverview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/governance", { signal: controller.signal });
        if (!response.ok) throw new Error("Governance API unavailable");
        const json = await response.json();
        if (!json.success || !json.data) throw new Error("No governance data");
        if (!controller.signal.aborted) {
          setOverview(json.data as GovernanceOverview);
          setState("ready");
        }
      } catch {
        if (!controller.signal.aborted) setState("error");
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const metrics = [
    { label: "Clientes gestionados", value: overview?.totalTenants, icon: Building2, helper: "En todos los productos" },
    { label: "Clientes activos", value: overview?.activeTenants, icon: CheckCircle2, helper: "Con servicio activo" },
    { label: "En período de prueba", value: overview?.trialTenants, icon: Clock3, helper: "Tenants en trial" },
    { label: "Productos conectados", value: overview?.saasCount, icon: Layers3, helper: "Fuentes SaaS reportadas" },
  ];

  return (
    <section aria-labelledby="executive-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="hub-eyebrow mb-1">Negocio y ecosistema</p>
          <h2 id="executive-heading" className="hub-section-heading">NanoLabs en números</h2>
        </div>
        <Link href="/governance" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-cyan hover:underline">
          Administrar SaaS <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      {state === "error" && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Los indicadores de negocio no están disponibles. Consultá el módulo de Clientes y SaaS para revisar las conexiones.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map(({ label, value, helper, icon: Icon }) => (
          <div key={label} className="hub-card hub-stat min-w-0 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-medium text-slate-400">{label}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2b3957] text-[#acc0ff]"><Icon className="h-[17px] w-[17px]" /></span>
            </div>
            <div className="mt-3 text-[27px] sm:text-[30px] font-bold leading-tight tracking-[-0.045em] text-slate-50 tabular-nums">
              {state === "ready" && typeof value === "number" ? value.toLocaleString("es-AR") : state === "loading" ? "…" : "—"}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{helper}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SHORTCUTS.map(({ href, title, subtitle, icon: Icon }) => (
          <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 transition-colors hover:border-[#9db5ff]/30 hover:bg-white/[0.055]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.055] text-slate-300 group-hover:text-brand-cyan"><Icon className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-slate-100">{title}</span>
              <span className="mt-1 block text-[11px] leading-4 text-slate-500">{subtitle}</span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-brand-cyan" />
          </Link>
        ))}
      </div>
    </section>
  );
}
