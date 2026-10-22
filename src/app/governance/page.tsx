"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import {
  Crown,
  Layers,
  Users,
  Settings2,
  DollarSign,
  Shield,
  Key,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Building2,
  UtensilsCrossed,
  Gamepad2,
  Car,
  Dumbbell,
  Clock,
} from "lucide-react";

// Initial Multi-SaaS Tenants sample data showing the unified governance schema
const SAMPLE_TENANTS = [
  {
    id: "t-1",
    name: "Padel Club Central",
    saas: "OnlyPadel",
    slug: "padelcentral",
    domain: "padelcentral.onlypadel.com",
    plan: "Pro Club",
    mrr: "$45.000",
    status: "active",
    owner: "admin@padelcentral.com",
    modules: ["Canchas & Turnos", "Kiosco / Bar", "Torneos", "Pagos Online"],
  },
  {
    id: "t-2",
    name: "Burger & Co. Palermo",
    saas: "OnlyFood",
    slug: "burgerpalermo",
    domain: "burgerpalermo.onlyfood.ar",
    plan: "Enterprise Gourmet",
    mrr: "$68.000",
    status: "active",
    owner: "gerencia@burgerpalermo.com",
    modules: ["Comandas Cocina", "Menú Digital QR", "Delivery WhatsApp", "Stock Insumos"],
  },
  {
    id: "t-3",
    name: "AutoMotor San Isidro",
    saas: "OnlyCars",
    slug: "automotorsanisidro",
    domain: "sanisidro.onlycars.ar",
    plan: "Agencia Full",
    mrr: "$85.000",
    status: "active",
    owner: "ventas@automotorsanisidro.com",
    modules: ["Stock Vehículos", "Cotizaciones", "Contratos & Formularios", "Leads CRM"],
  },
  {
    id: "t-4",
    name: "Iron Fitness Gym",
    saas: "OnlyGym",
    slug: "ironfitness",
    domain: "ironfitness.onlygym.ar",
    plan: "Gimnasio Plus",
    mrr: "$52.000",
    status: "active",
    owner: "iron@fitnessgym.com",
    modules: ["Membresías", "Torniquete & Acceso", "Rutinas", "Cobro Automático"],
  },
  {
    id: "t-5",
    name: "Pádel San Pedro (Exclusivo)",
    saas: "OnlyPadel",
    slug: "sanpedropadel",
    domain: "sanpedropadel.nanoapps.ar",
    plan: "Custom Dedicated",
    mrr: "$60.000",
    status: "active",
    owner: "club@sanpedropadel.com",
    modules: ["Canchas & Turnos", "Tienda Paletas", "Iluminación Automática"],
  },
  {
    id: "t-6",
    name: "Pizzería Don Mario",
    saas: "OnlyFood",
    slug: "donmario",
    domain: "donmario.onlyfood.ar",
    plan: "Starter Food",
    mrr: "$32.000",
    status: "trial",
    owner: "mario@donmario.com",
    modules: ["Menú Digital QR", "Comandas Cocina"],
  },
];

export default function GovernancePage() {
  const [selectedSaas, setSelectedSaas] = useState<string>("all");
  const [activeTenant, setActiveTenant] = useState<any | null>(null);

  const filteredTenants = SAMPLE_TENANTS.filter(
    (t) => selectedSaas === "all" || t.saas === selectedSaas
  );

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header />

      <div className="px-6 py-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Supreme Governance Header */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-blue-950/30 to-brand-cyan/10 border border-purple-500/20 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-amber-400" />
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Supreme Governance · NanoLabsHUB
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 font-semibold">
                  ESTADO: CONSOLIDACIÓN CENTRAL
                </span>
              </div>
              <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">
                NanoLabsHUB asume el gobierno central de todos los SaaS de la compañía. Los paneles administrativos individuales y fragmentados serán absorbidos aquí, eliminando la necesidad de acceder a URLs de administración por separado.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 font-mono text-center">
                <div className="text-[10px] text-gray-400 uppercase">MRR Consolidado</div>
                <div className="text-lg font-bold text-emerald-400">$342.000</div>
              </div>
            </div>
          </div>
        </div>

        {/* Master Roadmap Stepper */}
        <div className="hub-card p-5 space-y-4">
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-cyan" />
            Hoja de Ruta: De Paneles Dispersos al Governance Supremo
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-brand-cyan/10 border border-brand-cyan/30 space-y-1">
              <div className="flex items-center justify-between text-brand-cyan font-bold">
                <span>Fase 1: En Ejecución</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-white font-semibold">NanoLabsHUB 100% Online</div>
              <div className="text-[10px] text-gray-400">
                Control de Hardware, Docker, Git, Despliegues y Backups en el servidor dedicado.
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface-100/60 border border-white/5 space-y-1">
              <div className="text-purple-400 font-bold">Fase 2: Conectores DB</div>
              <div className="text-gray-200 font-semibold">Puente de Datos Multi-SaaS</div>
              <div className="text-[10px] text-gray-500">
                Lectura y escritura segura sobre las bases MariaDB y PostgreSQL de OnlyFood, OnlyPadel, etc.
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface-100/60 border border-white/5 space-y-1">
              <div className="text-amber-400 font-bold">Fase 3: Centralización</div>
              <div className="text-gray-200 font-semibold">Gestión de Tenants & Módulos</div>
              <div className="text-[10px] text-gray-500">
                Alta de clientes, modificación de planes, asignación de módulos y gestión de dueños desde el HUB.
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface-100/60 border border-white/5 space-y-1">
              <div className="text-rose-400 font-bold">Fase 4: Sunset de Paneles</div>
              <div className="text-gray-200 font-semibold">Apagado de Paneles Aislados</div>
              <div className="text-[10px] text-gray-500">
                Eliminación de accesos como `onlyfood.nanoapps.ar/admin` y redirección 100% al HUB.
              </div>
            </div>
          </div>
        </div>

        {/* Multi-SaaS Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "all", label: "Todos los SaaS", icon: Layers },
            { id: "OnlyFood", label: "OnlyFood", icon: UtensilsCrossed },
            { id: "OnlyPadel", label: "OnlyPadel", icon: Gamepad2 },
            { id: "OnlyCars", label: "OnlyCars", icon: Car },
            { id: "OnlyGym", label: "OnlyGym", icon: Dumbbell },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedSaas === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedSaas(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono transition-all flex items-center gap-2 ${
                  isSelected
                    ? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 font-semibold shadow-glow"
                    : "bg-surface-100/60 text-gray-400 hover:text-white border border-white/5 hover:bg-surface-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Tenants Directory */}
        <div className="hub-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-cyan" />
                <span>Directorio Unificado de Tenants & Clientes</span>
              </h2>
              <p className="text-xs text-gray-500 font-mono">
                {filteredTenants.length} tenants registrados bajo el mando de NanoLabsHUB
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-100/60 text-gray-400 uppercase text-[10px] tracking-wider border-b border-white/5">
                <tr>
                  <th className="py-2.5 px-3">Cliente / Tenant</th>
                  <th className="py-2.5 px-3">Plataforma SaaS</th>
                  <th className="py-2.5 px-3">Plan Activo</th>
                  <th className="py-2.5 px-3">Módulos Habilitados</th>
                  <th className="py-2.5 px-3">MRR</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acción de Gobierno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white text-xs">{t.name}</div>
                      <div className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <span>{t.domain}</span>
                        <span className="text-gray-600">·</span>
                        <span className="text-gray-400">{t.owner}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-semibold">
                        {t.saas}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-300 font-medium">{t.plan}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {t.modules.map((m) => (
                          <span
                            key={m}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-300 border border-white/5"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-400">{t.mrr}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full border ${
                          t.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {t.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setActiveTenant(t)}
                        className="px-2.5 py-1 rounded-lg bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 text-[11px] font-mono transition-all flex items-center gap-1 ml-auto"
                      >
                        <Settings2 className="w-3 h-3" />
                        <span>GESTIONAR</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tenant Detail Modal Preview */}
        {activeTenant && (
          <div className="p-5 rounded-xl bg-surface-100 border border-brand-cyan/40 space-y-4 font-mono text-xs animate-in fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white text-sm">
                  Configuración de Gobierno: {activeTenant.name} ({activeTenant.saas})
                </span>
              </div>
              <button
                onClick={() => setActiveTenant(null)}
                className="text-gray-400 hover:text-white"
              >
                Cerrar panel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
                <div className="text-[10px] text-gray-500 uppercase">Credenciales & Acceso</div>
                <div className="text-gray-200">{activeTenant.owner}</div>
                <button
                  onClick={() => alert("Función de reseteo de clave conectada con backend.")}
                  className="text-[10px] text-brand-cyan hover:underline flex items-center gap-1 pt-1"
                >
                  <Key className="w-3 h-3" /> Blanquear contraseña
                </button>
              </div>

              <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
                <div className="text-[10px] text-gray-500 uppercase">Plan y Cuotas</div>
                <div className="text-gray-200 font-bold">{activeTenant.plan}</div>
                <div className="text-emerald-400 font-semibold">{activeTenant.mrr} / mes</div>
              </div>

              <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
                <div className="text-[10px] text-gray-500 uppercase">Impersonación Directa</div>
                <div className="text-gray-400 text-[11px]">Acceso administrativo sin contraseña</div>
                <button
                  onClick={() => alert(`Acceso directo generado para ${activeTenant.domain}`)}
                  className="px-2 py-1 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 text-[10px] flex items-center gap-1 font-semibold hover:bg-amber-400/20 transition-colors mt-1"
                >
                  <Lock className="w-2.5 h-2.5" /> Ingresar al Tenant
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
