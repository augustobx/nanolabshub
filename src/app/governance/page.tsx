"use client";

import { useState, useEffect, useRef } from "react";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSaas, setSelectedSaas] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortTenants, setSortTenants] = useState<"name" | "activity" | "status">("name");
  const [search, setSearch] = useState("");
  const [activeTenant, setActiveTenant] = useState<UniversalTenant | null>(null);
  const [tenantTab, setTenantTab] = useState<"status" | "modules" | "access">("status");
  const tenantDialogRef = useRef<HTMLDivElement>(null);

  const [isUpdating, setIsUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchGovernance = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/governance");
      if (!res.ok) throw new Error("No se pudo conectar con la gestión de clientes");
      const json = await res.json();
      if (!json.success || !json.data || !Array.isArray(json.data.tenants)) {
        throw new Error(json.error || "No hay datos disponibles");
      }
      setData(json.data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudieron consultar los clientes");
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

  useEffect(() => {
    if (!activeTenant) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    tenantDialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isUpdating) {
        setActiveTenant(null);
      }
      if (event.key === "Tab") {
        const dialog = tenantDialogRef.current;
        if (!dialog) return;
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter((node) => node.getClientRects().length > 0);
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [activeTenant?.id, isUpdating]);

  const openTenant = (tenant: UniversalTenant) => {
    setTenantTab("status");
    setActiveTenant(tenant);
  };

  const handleUpdateStatus = async (
    tenant: UniversalTenant,
    newStatus: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED"
  ) => {
    if (tenant.status === newStatus) return;
    const risky = newStatus === "SUSPENDED" || newStatus === "CANCELED";
    if (risky && !window.confirm(
      `Vas a ${newStatus === "SUSPENDED" ? "suspender" : "cancelar"} a ${tenant.name} en ${tenant.saasName}. Esta acción modifica la base productiva. ¿Confirmás?`
    )) return;
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
      const q = search.trim().toLocaleLowerCase("es");
      return [t.name, t.slug, t.domain, t.saasName].some((value) =>
        value.toLocaleLowerCase("es").includes(q)
      );
    }
    return true;
  }).sort((a, b) => {
    if (sortTenants === "activity") return b.metrics.totalRecords - a.metrics.totalRecords;
    if (sortTenants === "status") return a.status.localeCompare(b.status) || a.name.localeCompare(b.name, "es");
    return a.name.localeCompare(b.name, "es");
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

  const getSaasColor = (_saas: SaaSSlug) =>
    "border-white/10 text-slate-300 bg-white/[0.035]";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            ACTIVO
          </span>
        );
      case "TRIAL":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            EN PRUEBA
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

        {loadError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-xs text-rose-200">
            <span>{loadError}. La información anterior podría estar desactualizada.</span>
            <button type="button" onClick={fetchGovernance}
              className="rounded-lg border border-rose-400/25 px-3 py-2 font-semibold hover:bg-rose-400/10">
              Reintentar
            </button>
          </div>
        )}

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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="status" className="text-xs text-slate-400">
            {isLoading ? "Consultando clientes…" : `${filteredTenants.length} de ${data?.totalTenants ?? "—"} clientes`}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Ordenar por
            <select aria-label="Orden de clientes" value={sortTenants}
              onChange={(event) => setSortTenants(event.target.value as typeof sortTenants)}
              className="rounded-lg border border-white/10 bg-surface-100 px-3 py-2 text-xs text-slate-100">
              <option value="name">Nombre</option>
              <option value="activity">Mayor actividad</option>
              <option value="status">Estado</option>
            </select>
          </label>
        </div>

        {/* Universal Tenants Fleet Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTenants.length === 0 ? (
            <div className="col-span-full hub-card p-12 text-center space-y-3">
              <Building2 className="w-10 h-10 text-gray-600 mx-auto" />
              <div className="text-sm font-mono text-gray-400">
                {isLoading ? "Consultando clientes…" : loadError ? "No fue posible actualizar los datos de clientes." : "No hay clientes que coincidan con la búsqueda o los filtros."}
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
                    onClick={() => openTenant(t)}
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

      {/* Universal tenant control dialog, organized by action category. */}
      {activeTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060a12]/85 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isUpdating) setActiveTenant(null);
          }}>
          <div ref={tenantDialogRef} role="dialog" aria-modal="true" aria-labelledby="tenant-dialog-title"
            tabIndex={-1} className="flex w-full max-w-[690px] flex-col overflow-hidden rounded-[20px] border border-white/10 bg-[#172233] shadow-2xl outline-none"
            style={{ maxHeight: "min(90dvh, 790px)" }}>
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-5 sm:px-6">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium ${getSaasColor(activeTenant.saas)}`}>
                    {getSaasIcon(activeTenant.saas)}
                    {activeTenant.saasName}
                  </span>
                  <span className="text-[11px] text-slate-500">Cliente #{activeTenant.id}</span>
                </div>
                <h2 id="tenant-dialog-title" className="text-xl font-bold tracking-tight text-slate-50">{activeTenant.name}</h2>
                <p className="truncate text-xs text-slate-400">{activeTenant.domain}</p>
              </div>
              <button type="button" aria-label="Cerrar administración de cliente"
                disabled={isUpdating} onClick={() => setActiveTenant(null)}
                className="hub-icon-button shrink-0 disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div role="tablist" aria-label="Áreas de administración del cliente"
              className="flex gap-1 overflow-x-auto border-b border-white/[0.08] px-4 py-3 sm:px-6">
              {([
                { id: "status", text: "Estado y plan" },
                { id: "modules", text: "Funcionalidades" },
                { id: "access", text: "Acceso" },
              ] as const).map((tab) => (
                <button key={tab.id} type="button" role="tab" id={`tenant-tab-${tab.id}`}
                  aria-controls={`tenant-panel-${tab.id}`}
                  aria-selected={tenantTab === tab.id}
                  tabIndex={tenantTab === tab.id ? 0 : -1}
                  onClick={() => setTenantTab(tab.id)}
                  onKeyDown={(event) => {
                    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                    event.preventDefault();
                    const ids = ["status", "modules", "access"] as const;
                    const current = ids.indexOf(tenantTab);
                    const next = event.key === "Home" ? 0 : event.key === "End" ? 2
                      : (current + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length;
                    setTenantTab(ids[next]);
                    requestAnimationFrame(() => document.getElementById(`tenant-tab-${ids[next]}`)?.focus());
                  }}
                  className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${tenantTab === tab.id
                    ? "bg-[#304366] text-[#dae4ff]"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white"}`}>
                  {tab.text}
                </button>
              ))}
            </div>

            <div className="min-h-[230px] flex-1 overflow-y-auto px-5 py-6 sm:px-6">
              {tenantTab === "status" && (
                <div id="tenant-panel-status" role="tabpanel" aria-labelledby="tenant-tab-status" className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Estado del servicio</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Elegí el estado del cliente. Los cambios se guardan directamente en la base productiva
                      y pueden afectar su acceso al servicio.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {([
                      { id: "ACTIVE", label: "Activo" },
                      { id: "TRIAL", label: "En prueba" },
                      { id: "SUSPENDED", label: "Suspendido" },
                      { id: "CANCELED", label: "Cancelado" },
                    ] as const).map((option) => (
                      <button key={option.id} type="button" disabled={isUpdating}
                        aria-pressed={activeTenant.status === option.id}
                        onClick={() => handleUpdateStatus(activeTenant, option.id)}
                        className={`min-h-11 rounded-xl border px-3 py-3 text-xs font-semibold transition-colors disabled:opacity-50 ${activeTenant.status === option.id
                          ? "border-brand-cyan/50 bg-brand-cyan/15 text-brand-cyan"
                          : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/30 hover:bg-white/[0.06]"}`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Plan asignado</div>
                    <div className="mt-1.5 text-sm font-medium text-slate-100">{activeTenant.plan || "Sin plan"}</div>
                    <p className="mt-2 text-xs text-slate-500">El plan se muestra en modo lectura; esta vista no modifica su facturación.</p>
                  </div>
                </div>
              )}
              {tenantTab === "modules" && (
                <div id="tenant-panel-modules" role="tabpanel" aria-labelledby="tenant-tab-modules" className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Funcionalidades contratadas</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Activá o desactivá funciones para este cliente. Cada cambio se guarda en su base productiva.
                    </p>
                  </div>
                  {Object.keys(activeTenant.modules).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-slate-400">
                      No hay módulos configurables para este cliente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(activeTenant.modules).map(([key, enabled]) => (
                        <div key={key} className="flex min-h-[66px] items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold capitalize text-slate-100">{key.replace(/_/g, " ")}</div>
                            <div className="mt-1 truncate text-[11px] text-slate-500" title={key}>{key}</div>
                          </div>
                          <button type="button" role="switch" aria-checked={enabled}
                            aria-label={`${key.replace(/_/g, " ")}: ${enabled ? "activado" : "desactivado"}`}
                            disabled={isUpdating}
                            onClick={() => handleToggleModule(activeTenant, key, enabled)}
                            className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${enabled
                              ? "border-[#9db5ff]/50 bg-[#6c86d7]"
                              : "border-white/15 bg-[#3b4658]"}`}>
                            <span aria-hidden="true" className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[23px]" : "left-[3px]"}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {tenantTab === "access" && (
                <div id="tenant-panel-access" role="tabpanel" aria-labelledby="tenant-tab-access" className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Portal del cliente</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Abrí el sitio de esta empresa en una pestaña nueva.
                      Este acceso no inicia sesión automáticamente ni cambia de identidad.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <p className="break-all text-xs text-slate-400">https://{activeTenant.domain}</p>
                    <a href={`https://${activeTenant.domain}`} target="_blank" rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-cyan px-4 py-2.5 text-xs font-bold text-[#101827] hover:bg-[#bed0ff]">
                      <ExternalLink className="h-4 w-4" /> Abrir portal
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-3 sm:px-6">
              <span role="status" aria-live="polite" className="text-[11px] text-slate-500">
                {isUpdating ? "Guardando cambios…" : "Datos de la plataforma"}
              </span>
              <button type="button" disabled={isUpdating} onClick={() => setActiveTenant(null)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08] disabled:opacity-50">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
