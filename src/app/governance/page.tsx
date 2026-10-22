"use client";

import { useState, useEffect } from "react";
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
  RotateCw,
  Search,
  Filter,
  Check,
  X,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";
import { UniversalTenant, GovernanceOverview, SaaSSlug } from "@/lib/types";

export default function GovernancePage() {
  const [data, setData] = useState<GovernanceOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSaas, setSelectedSaas] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [activeTenant, setActiveTenant] = useState<UniversalTenant | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchGovernance = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/governance");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Error fetching governance data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGovernance();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleUpdateStatus = async (
    tenant: UniversalTenant,
    newStatus: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED"
  ) => {
    setIsUpdating(true);
    try {
      const res = await fetch("/api/governance/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saas: tenant.saas,
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: newStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`✅ Estado de ${tenant.name} actualizado a ${newStatus} en la base de datos.`);
        // Update local state
        if (activeTenant && activeTenant.id === tenant.id) {
          setActiveTenant({ ...activeTenant, status: newStatus });
        }
        fetchGovernance();
      } else {
        showToast(`❌ Error: ${json.error}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleModule = async (tenant: UniversalTenant, moduleKey: string, currentVal: boolean) => {
    setIsUpdating(true);
    const newVal = !currentVal;
    try {
      const res = await fetch("/api/governance/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saas: tenant.saas,
          tenantId: tenant.id,
          tenantName: tenant.name,
          moduleKey,
          enabled: newVal,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`✅ Módulo '${moduleKey}' ${newVal ? "habilitado" : "deshabilitado"} en DB.`);
        if (activeTenant && activeTenant.id === tenant.id) {
          setActiveTenant({
            ...activeTenant,
            modules: { ...activeTenant.modules, [moduleKey]: newVal },
          });
        }
        fetchGovernance();
      } else {
        showToast(`❌ Error: ${json.error}`);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredTenants = (data?.tenants || []).filter((t) => {
    if (selectedSaas !== "all" && t.saas !== selectedSaas) return false;
    if (selectedStatus !== "all" && t.status !== selectedStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.domain.toLowerCase().includes(q) ||
        t.saasName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getSaasIcon = (saas: SaaSSlug) => {
    switch (saas) {
      case "onlyfood":
        return <UtensilsCrossed className="w-4 h-4 text-orange-400" />;
      case "onlypadel":
        return <Gamepad2 className="w-4 h-4 text-emerald-400" />;
      case "onlycars":
        return <Car className="w-4 h-4 text-blue-400" />;
      case "onlygym":
        return <Dumbbell className="w-4 h-4 text-purple-400" />;
      case "onlyturn":
        return <Clock className="w-4 h-4 text-amber-400" />;
      case "onlyerp":
        return <FileSpreadsheet className="w-4 h-4 text-cyan-400" />;
      default:
        return <Building2 className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSaasColor = (saas: SaaSSlug) => {
    switch (saas) {
      case "onlyfood":
        return "border-orange-500/30 text-orange-400 bg-orange-500/10";
      case "onlypadel":
        return "border-emerald-500/30 text-emerald-400 bg-emerald-500/10";
      case "onlycars":
        return "border-blue-500/30 text-blue-400 bg-blue-500/10";
      case "onlygym":
        return "border-purple-500/30 text-purple-400 bg-purple-500/10";
      case "onlyturn":
        return "border-amber-500/30 text-amber-400 bg-amber-500/10";
      case "onlyerp":
        return "border-cyan-500/30 text-cyan-400 bg-cyan-500/10";
      default:
        return "border-gray-500/30 text-gray-400 bg-gray-500/10";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ACTIVO
          </span>
        );
      case "TRIAL":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            TRIAL / PRUEBA
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            SUSPENDIDO
          </span>
        );
      case "CANCELED":
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20 flex items-center gap-1">
            CANCELADO
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-16">
      <Header onRefresh={fetchGovernance} isRefreshing={isLoading} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-xl bg-surface-50 border border-brand-cyan/40 text-xs font-mono text-white shadow-2xl shadow-cyan-950/50 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-cyan" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="hub-content space-y-7">
        <section className="hub-hero flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="hub-eyebrow">Negocio / Clientes y SaaS</p>
            <h1 className="hub-hero-title">Gestioná todo tu ecosistema SaaS.</h1>
            <p className="hub-description">
              Empresas, planes, estados, métricas y módulos de cada producto.
              Todo conectado a una misma experiencia de administración.
            </p>
          </div>
          <button type="button" onClick={fetchGovernance} disabled={isLoading}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/10 disabled:opacity-50">
            <RotateCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Sincronizar datos
          </button>
        </section>

        {/* Global KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="hub-card p-4 space-y-1">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-brand-cyan" />
              SaaS Conectados
            </span>
            <div className="text-2xl font-bold text-white font-mono">{data ? data.saasCount : "—"}</div>
            <div className="text-[10px] text-gray-500 font-mono">Bases de datos vivas</div>
          </div>

          <div className="hub-card p-4 space-y-1">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              Total Tenants
            </span>
            <div className="text-2xl font-bold text-white font-mono">{data ? data.totalTenants : "---"}</div>
            <div className="text-[10px] text-gray-500 font-mono">Empresas / Locales</div>
          </div>

          <div className="hub-card p-4 space-y-1">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Tenants Activos
            </span>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {data ? data.activeTenants : "---"}
            </div>
            <div className="text-[10px] text-gray-500 font-mono">En producción regular</div>
          </div>

          <div className="hub-card p-4 space-y-1">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Trials / Pruebas
            </span>
            <div className="text-2xl font-bold text-amber-400 font-mono">
              {data ? data.trialTenants : "---"}
            </div>
            <div className="text-[10px] text-gray-500 font-mono">En período de prueba</div>
          </div>

          <div className="hub-card p-4 space-y-1">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              Registros Gestionados
            </span>
            <div className="text-2xl font-bold text-brand-cyan font-mono">
              {data ? data.totalRecordsManaged.toLocaleString() : "---"}
            </div>
            <div className="text-[10px] text-gray-500 font-mono">Pedidos, Turnos, Stock</div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* SaaS Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: "all", label: "Todos los SaaS" },
              { id: "onlyfood", label: "OnlyFood" },
              { id: "onlypadel", label: "OnlyPadel" },
              { id: "onlycars", label: "OnlyCars" },
              { id: "onlygym", label: "OnlyGym" },
              { id: "onlyturn", label: "OnlyTurn" },
              { id: "onlyerp", label: "OnlyERP" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedSaas(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all ${
                  selectedSaas === tab.id
                    ? "bg-brand-cyan text-black font-semibold shadow-sm shadow-cyan-500/20"
                    : "bg-surface-100/80 text-gray-400 hover:text-white hover:bg-surface-50 border border-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Status Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar tenant, slug, dominio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface-100 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan/50 font-mono"
              />
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-surface-100 border border-white/10 text-xs text-gray-300 font-mono focus:outline-none focus:border-brand-cyan/50"
            >
              <option value="all">Todos los Estados</option>
              <option value="ACTIVE">Activos</option>
              <option value="TRIAL">Trial / Prueba</option>
              <option value="SUSPENDED">Suspendidos</option>
              <option value="CANCELED">Cancelados</option>
            </select>
          </div>
        </div>

        {/* Universal Tenants Fleet Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTenants.length === 0 ? (
            <div className="col-span-full hub-card p-12 text-center space-y-3">
              <Building2 className="w-10 h-10 text-gray-600 mx-auto" />
              <div className="text-sm font-mono text-gray-400">
                {isLoading ? "Consultando bases de datos SaaS..." : "No se encontraron tenants con los filtros aplicados."}
              </div>
            </div>
          ) : (
            filteredTenants.map((t) => (
              <div
                key={`${t.saas}-${t.id}`}
                className="hub-card p-5 space-y-4 hover:border-brand-cyan/30 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${getSaasColor(t.saas)}`}>
                          {getSaasIcon(t.saas)}
                          <span>{t.saasName}</span>
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white tracking-tight">{t.name}</h3>
                      <p className="text-xs font-mono text-gray-400 flex items-center gap-1">
                        <span>slug:</span>
                        <span className="text-brand-cyan font-semibold">{t.slug}</span>
                      </p>
                    </div>
                    <div>{getStatusBadge(t.status)}</div>
                  </div>

                  {/* Plan & Domain */}
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-gray-400">
                      <span>Plan:</span>
                      <span className="text-white font-medium">{t.plan}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Dominio:</span>
                      <a
                        href={`https://${t.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-cyan hover:underline flex items-center gap-1"
                      >
                        <span>{t.domain}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Metrics snapshot */}
                  <div className="p-3 rounded-xl bg-surface-100/60 border border-white/5 space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-gray-400">Volumen en DB:</span>
                      <span className="text-emerald-400 font-bold">
                        {t.metrics.totalRecords.toLocaleString()} {t.metrics.recordLabel}
                      </span>
                    </div>
                    {t.metrics.secondaryMetric && (
                      <div className="flex justify-between text-[11px] font-mono text-gray-500">
                        <span>{t.metrics.secondaryMetric.label}:</span>
                        <span>{t.metrics.secondaryMetric.value}</span>
                      </div>
                    )}
                  </div>

                  {/* Compact modules preview: full list stays in tenant controls. */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Funcionalidades activas</span>
                      <span className="font-semibold text-slate-200">
                        {Object.values(t.modules).filter(Boolean).length} / {Object.keys(t.modules).length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(t.modules).filter(([, active]) => active).slice(0, 3).map(([name]) => (
                        <span key={name} className="rounded-lg border border-white/10 bg-white/[0.045] px-2 py-1 text-[10px] text-slate-300">
                          {name.replace(/_/g, " ")}
                        </span>
                      ))}
                      {Object.values(t.modules).filter(Boolean).length > 3 && (
                        <span className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-400">
                          +{Object.values(t.modules).filter(Boolean).length - 3} más
                        </span>
                      )}
                      {Object.values(t.modules).filter(Boolean).length === 0 && <span className="text-xs text-slate-500">Sin módulos activos</span>}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-white/5 flex items-center gap-2">
                  <button
                    onClick={() => setActiveTenant(t)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-surface-100 hover:bg-surface-50 text-gray-200 hover:text-white border border-white/10 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-brand-cyan" />
                    <span>Administrar módulos</span>
                  </button>

                  <a
                    href={`https://${t.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-1.5 px-3 rounded-lg bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/20 text-xs font-mono font-medium flex items-center gap-1 transition-all"
                    title="Abrir portal del cliente"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Portal</span>
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Phase 6: Legacy Standalone Panels Sunset Architecture */}
        <div className="hub-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <span>Consolidación de paneles anteriores</span>
              </h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Redirección de accesos /admin y /superadmin hacia la consola central NanoLabsHUB
              </p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Vista de migración
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-100/60 text-gray-400 uppercase text-[10px] tracking-wider border-b border-white/5">
                <tr>
                  <th className="py-2.5 px-3">SaaS Plataforma</th>
                  <th className="py-2.5 px-3">Panel anterior</th>
                  <th className="py-2.5 px-3">Estado de Migración</th>
                  <th className="py-2.5 px-3">Destino en NanoLabs Hub</th>
                  <th className="py-2.5 px-3">Alcance Operativo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {(data?.legacyPanels || []).map((panel, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 font-semibold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>{panel.saas}</span>
                    </td>
                    <td className="py-3 px-3 text-gray-400 font-mono">
                      <span className="line-through text-rose-400/80">{panel.legacyAdminUrl}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {panel.sunsetStatus === "redirected_to_hub" ? "Redirigido" : panel.sunsetStatus === "active_deprecated" ? "En transición" : "Planificado"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-brand-cyan">
                      <span>{panel.replacementUrl}</span>
                    </td>
                    <td className="py-3 px-3 text-gray-400 text-[11px]">{panel.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tenant Control & Module Slide-over Modal */}
      {activeTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="hub-card max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto border-brand-cyan/40 shadow-2xl shadow-cyan-950/50">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${getSaasColor(activeTenant.saas)}`}>
                    {getSaasIcon(activeTenant.saas)}
                    <span>{activeTenant.saasName}</span>
                  </span>
                  <span className="text-xs text-gray-400 font-mono">ID: {activeTenant.id}</span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">{activeTenant.name}</h2>
                <p className="text-xs font-mono text-brand-cyan">https://{activeTenant.domain}</p>
              </div>

              <button
                onClick={() => setActiveTenant(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Status Controls */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono text-gray-300 font-semibold uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Estado en Base de Datos Productiva</span>
              </h3>
              <p className="text-xs text-gray-400">
                Al hacer clic, se actualiza directamente el registro en la base de datos del SaaS correspondiente:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "ACTIVE", label: "ACTIVO", color: "hover:border-emerald-500 hover:bg-emerald-500/10 text-emerald-400" },
                  { id: "TRIAL", label: "TRIAL", color: "hover:border-amber-500 hover:bg-amber-500/10 text-amber-400" },
                  { id: "SUSPENDED", label: "SUSPENDER", color: "hover:border-rose-500 hover:bg-rose-500/10 text-rose-400" },
                  { id: "CANCELED", label: "CANCELAR", color: "hover:border-gray-500 hover:bg-gray-500/10 text-gray-400" },
                ].map((s) => (
                  <button
                    key={s.id}
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus(activeTenant, s.id as any)}
                    className={`py-2 px-3 rounded-xl border text-xs font-mono font-semibold transition-all ${
                      activeTenant.status === s.id
                        ? "border-brand-cyan bg-brand-cyan/20 text-brand-cyan shadow-sm"
                        : `border-white/10 bg-surface-100/60 ${s.color}`
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Feature Modules Toggles */}
            <div className="space-y-3 pt-3 border-t border-white/5">
              <h3 className="text-xs font-mono text-gray-300 font-semibold uppercase tracking-wider flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-brand-cyan" />
                <span>Módulos y Feature Flags</span>
              </h3>
              <p className="text-xs text-gray-400">
                Habilita o deshabilita funcionalidades específicas para este local/cliente:
              </p>

              <div className="space-y-2">
                {Object.entries(activeTenant.modules).map(([key, enabled]) => (
                  <div
                    key={key}
                    className="p-3 rounded-xl bg-surface-100/60 border border-white/5 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-mono font-semibold text-white capitalize">
                        {key.replace(/_/g, " ")}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        Identificador interno: {key}
                      </div>
                    </div>

                    <button
                      disabled={isUpdating}
                      onClick={() => handleToggleModule(activeTenant, key, enabled)}
                      className="transition-transform active:scale-95"
                    >
                      {enabled ? (
                        <ToggleRight className="w-8 h-8 text-brand-cyan" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-gray-600" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Impersonation & Direct Access */}
            <div className="space-y-3 pt-3 border-t border-white/5">
              <h3 className="text-xs font-mono text-gray-300 font-semibold uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-400" />
                <span>Impersonación & Acceso Supremo</span>
              </h3>
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-purple-300 font-mono">
                    Acceso como SuperAdmin de NanoLabs
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono">
                    Abre el portal del cliente con bypass administrativo y auditoría.
                  </div>
                </div>

                <a
                  href={`https://${activeTenant.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-brand-cyan text-black text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-cyan-300 transition-all shadow-md"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>ENTRAR AL PORTAL</span>
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setActiveTenant(null)}
                className="px-4 py-2 rounded-xl bg-surface-100 hover:bg-surface-50 text-xs font-mono text-gray-300 hover:text-white border border-white/10 transition-all"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
