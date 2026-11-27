"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Layers3,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { INSTITUTIONAL_APPS, SAAS_PRODUCTS } from "@/lib/product-taxonomy";
import type { ManagedPlan, ManagedSaaS, ManagedTenant, ManagementAudit, ManagementCatalog } from "@/lib/saas-management-types";
import type { GovernanceOverview, IndependentContract, UniversalTenant } from "@/lib/types";
import {
  Cargando,
  Encabezado,
  Indicador,
  NanoLabsAlert,
  NanoLabsButton,
  NanoLabsChip,
  NanoLabsModal,
  NanoLabsTabs,
  Vacio,
  useToast,
} from "./nanolabs";
import { TenantDrawer } from "./TenantDrawer";
import { IndependentAppDrawer } from "./IndependentAppDrawer";

const MANAGED_SLUGS: ManagedSaaS[] = ["onlyfood", "onlypadel", "onlycars", "onlymarket", "onlyerp", "onlyshop", "onlymob"];

function isManaged(slug: string): slug is ManagedSaaS {
  return (MANAGED_SLUGS as readonly string[]).includes(slug);
}

function daysUntil(isoDate?: string | null): number | null {
  if (!isoDate) return null;
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) return null;
  return Math.ceil((ts - Date.now()) / 86400000);
}

function expirationBadge(isoDate?: string | null) {
  const days = daysUntil(isoDate);
  if (days === null) return { kind: "none" as const, label: "Sin fecha", severity: "neutral" as const };
  if (days < 0) return { kind: "expired" as const, label: `Venció hace ${Math.abs(days)}d`, severity: "danger" as const };
  if (days <= 7) {
    return {
      kind: "expiring" as const,
      label: days === 0 ? "Vence hoy" : `Vence en ${days}d`,
      severity: "warning" as const,
    };
  }
  return { kind: "ok" as const, label: `Vence en ${days}d`, severity: "success" as const };
}

function statusChip(status: UniversalTenant["status"] | IndependentContract["status"]) {
  switch (status) {
    case "ACTIVE":
      return <NanoLabsChip severity="success">Activo</NanoLabsChip>;
    case "TRIAL":
      return <NanoLabsChip severity="info">Prueba</NanoLabsChip>;
    case "PAST_DUE":
      return <NanoLabsChip severity="danger">Vencido por deuda</NanoLabsChip>;
    case "SUSPENDED":
      return <NanoLabsChip severity="warning">Suspendido</NanoLabsChip>;
    default:
      return <NanoLabsChip severity="neutral">Cancelado</NanoLabsChip>;
  }
}

const money = (cents: number | null, currency = "ARS") =>
  cents === null ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(cents / 100);

const toDateTimeLocal = (isoDate: string) => {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export type MembershipQuickFilter = "all" | "active" | "expiring" | "expired" | "attention" | "paused";

export function MembershipsWorkspace({
  initialSaas = "all",
  initialTab = "membresias",
  initialFilter = "all",
  initialTenantId = "",
}: {
  initialSaas?: string;
  initialTab?: "membresias" | "planes" | "conectores";
  initialFilter?: MembershipQuickFilter;
  initialTenantId?: string;
}) {
  const toast = useToast();
  const [data, setData] = useState<GovernanceOverview | null>(null);
  const [independentList, setIndependentList] = useState<IndependentContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tab, setTab] = useState<"membresias" | "planes" | "conectores">(initialTab);
  const [selectedSaas, setSelectedSaas] = useState<string>(initialSaas);
  const [quickFilter, setQuickFilter] = useState<MembershipQuickFilter>(initialFilter);
  const [search, setSearch] = useState("");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProduct, setDrawerProduct] = useState<ManagedSaaS>("onlyfood");
  const [drawerTenantId, setDrawerTenantId] = useState("");
  const [drawerTab, setDrawerTab] = useState<"resumen" | "modulos" | "pagos" | "accesos">("resumen");

  // Independent App Drawer state
  const [indDrawerOpen, setIndDrawerOpen] = useState(false);
  const [indSlug, setIndSlug] = useState("");
  const [indTab, setIndTab] = useState<"resumen" | "pagos" | "historial">("resumen");

  // Read-only tenant modal
  const [readonlyTenant, setReadonlyTenant] = useState<UniversalTenant | null>(null);

  // Quick confirm modal (+30d / suspend / activate)
  const [quickConfirm, setQuickConfirm] = useState<{
    tenant: UniversalTenant;
    action: "renew30" | "suspend" | "activate";
  } | null>(null);
  const [indQuickConfirm, setIndQuickConfirm] = useState<{
    contract: IndependentContract;
    action: "renew30" | "suspend" | "activate";
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Create Tenant Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaas, setCreateSaas] = useState<ManagedSaaS>(
    isManaged(initialSaas) ? initialSaas : "onlyshop"
  );
  const [createCatalog, setCreateCatalog] = useState<ManagementCatalog | null>(null);
  const [createPlans, setCreatePlans] = useState<ManagedPlan[]>([]);

  // Plans & Audit tab state
  const [planSaas, setPlanSaas] = useState<ManagedSaaS>(
    isManaged(initialSaas) ? initialSaas : "onlyshop"
  );
  const [plansCatalog, setPlansCatalog] = useState<ManagementCatalog | null>(null);
  const [plans, setPlans] = useState<ManagedPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ManagedPlan | "new" | null>(null);
  const [auditEvents, setAuditEvents] = useState<ManagementAudit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchGovernance = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [govRes, indRes] = await Promise.all([
        fetch("/api/governance", { cache: "no-store" }),
        fetch("/api/independent-billing", { cache: "no-store" }),
      ]);
      const json = await govRes.json();
      if (!govRes.ok || !json.success || !json.data) {
        throw new Error(json.error || "No se pudo consultar el estado de clientes");
      }
      setData(json.data as GovernanceOverview);
      if (indRes.ok) {
        const indJson = await indRes.json();
        if (indJson.success && Array.isArray(indJson.data)) {
          setIndependentList(indJson.data as IndependentContract[]);
        }
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Error consultando membresías");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGovernance();
  }, [fetchGovernance]);

  useEffect(() => {
    if (!initialTenantId || !data?.tenants) return;
    const target = data.tenants.find((t) => t.id === initialTenantId && (initialSaas === "all" || t.saas === initialSaas));
    if (target && isManaged(target.saas)) {
      setDrawerProduct(target.saas);
      setDrawerTenantId(target.id);
      setDrawerTab("resumen");
      setDrawerOpen(true);
    }
  }, [data, initialSaas, initialTenantId]);

  const managedSet = useMemo(() => new Set<string>(data?.managementProducts || []), [data]);

  const allTenants = useMemo(() => data?.tenants || [], [data]);
  const counts = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let paused = 0;
    for (const t of allTenants) {
      if (t.status === "ACTIVE") active++;
      if (t.status === "TRIAL" || t.status === "SUSPENDED" || t.status === "CANCELED") paused++;
      const meta = expirationBadge(t.planExpiresAt);
      if (meta.kind === "expiring") expiring++;
      if (meta.kind === "expired") expired++;
    }
    for (const c of independentList) {
      if (c.status === "ACTIVE") active++;
      if (c.status === "TRIAL" || c.status === "SUSPENDED" || c.status === "CANCELED") paused++;
      const meta = expirationBadge(c.periodEnd);
      if (meta.kind === "expiring") expiring++;
      if (meta.kind === "expired" || c.status === "PAST_DUE") expired++;
    }
    return { all: allTenants.length + independentList.length, active, expiring, expired, paused };
  }, [allTenants, independentList]);

  const filteredTenants = useMemo(() => {
    if (selectedSaas === "__independent__") return [];
    const q = search.trim().toLocaleLowerCase("es");
    return allTenants
      .filter((t) => {
        if (selectedSaas !== "all" && t.saas !== selectedSaas) return false;
        const meta = expirationBadge(t.planExpiresAt);
        if (quickFilter === "active" && t.status !== "ACTIVE") return false;
        if (quickFilter === "expiring" && meta.kind !== "expiring") return false;
        if (quickFilter === "expired" && meta.kind !== "expired") return false;
        if (quickFilter === "paused" && !["TRIAL", "SUSPENDED", "CANCELED"].includes(t.status)) return false;
        if (quickFilter === "attention") {
          const needsAttention =
            meta.kind === "expired" ||
            meta.kind === "expiring" ||
            t.status === "SUSPENDED" ||
            t.status === "CANCELED";
          if (!needsAttention) return false;
        }
        if (q) {
          return [t.name, t.slug, t.domain, t.saasName, t.plan].some((val) =>
            String(val || "")
              .toLocaleLowerCase("es")
              .includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const da = daysUntil(a.planExpiresAt) ?? 99999;
        const db = daysUntil(b.planExpiresAt) ?? 99999;
        if (da !== db) return da - db;
        return a.name.localeCompare(b.name, "es");
      });
  }, [allTenants, quickFilter, search, selectedSaas]);

  const filteredIndependent = useMemo(() => {
    if (selectedSaas !== "all" && selectedSaas !== "__independent__" && !independentList.some((c) => c.slug === selectedSaas)) {
      return [];
    }
    const q = search.trim().toLocaleLowerCase("es");
    return independentList.filter((c) => {
      if (selectedSaas !== "all" && selectedSaas !== "__independent__" && c.slug !== selectedSaas) return false;
      const meta = expirationBadge(c.periodEnd);
      if (quickFilter === "active" && c.status !== "ACTIVE") return false;
      if (quickFilter === "expiring" && meta.kind !== "expiring") return false;
      if (quickFilter === "expired" && meta.kind !== "expired" && c.status !== "PAST_DUE") return false;
      if (quickFilter === "paused" && !["TRIAL", "SUSPENDED", "CANCELED"].includes(c.status)) return false;
      if (quickFilter === "attention") {
        const needsAttention = meta.kind === "expired" || meta.kind === "expiring" || c.status === "PAST_DUE" || c.status === "SUSPENDED" || c.status === "CANCELED";
        if (!needsAttention) return false;
      }
      if (q) {
        return [c.appName, c.clientName, c.slug, c.domain, c.planName].some((val) =>
          String(val || "").toLocaleLowerCase("es").includes(q)
        );
      }
      return true;
    });
  }, [independentList, quickFilter, search, selectedSaas]);

  const openDrawer = (t: UniversalTenant, initial: "resumen" | "modulos" | "pagos" | "accesos" = "resumen") => {
    if (isManaged(t.saas) && managedSet.has(t.saas)) {
      setDrawerProduct(t.saas);
      setDrawerTenantId(t.id);
      setDrawerTab(initial);
      setDrawerOpen(true);
    } else {
      setReadonlyTenant(t);
    }
  };

  const executeQuickAction = async () => {
    if (!quickConfirm) return;
    const { tenant, action } = quickConfirm;
    if (!isManaged(tenant.saas)) return;
    setActionBusy(true);
    try {
      const detailRes = await fetch(
        `/api/saas-management/${tenant.saas}?resource=tenant&tenantId=${encodeURIComponent(tenant.id)}`,
        { cache: "no-store" }
      );
      const detailJson = await detailRes.json();
      if (!detailRes.ok || !detailJson.success || !detailJson.data) {
        throw new Error(detailJson.error || "No se pudo leer la versión actual del cliente.");
      }
      const fresh = detailJson.data as ManagedTenant;
      const command =
        action === "renew30"
          ? {
              requestId: crypto.randomUUID(),
              operation: "subscription.renew",
              input: { tenantId: fresh.id, version: fresh.version, days: 30 },
            }
          : {
              requestId: crypto.randomUUID(),
              operation: "tenant.status",
              input: {
                tenantId: fresh.id,
                version: fresh.version,
                status: action === "suspend" ? "SUSPENDED" : "ACTIVE",
              },
            };

      const res = await fetch(`/api/saas-management/${tenant.saas}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "No se pudo aplicar la acción.");
      }
      toast(
        action === "renew30"
          ? `${tenant.name}: membresía extendida +30 días.`
          : action === "suspend"
          ? `${tenant.name}: acceso suspendido.`
          : `${tenant.name}: cliente activado.`,
        "ok"
      );
      setQuickConfirm(null);
      await fetchGovernance();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error ejecutando acción rápida.", "error");
    } finally {
      setActionBusy(false);
    }
  };

  const executeIndQuickAction = async () => {
    if (!indQuickConfirm) return;
    const { contract, action } = indQuickConfirm;
    setActionBusy(true);
    try {
      const payload =
        action === "renew30"
          ? { requestId: crypto.randomUUID(), operation: "contract.renew", input: { slug: contract.slug, days: 30 } }
          : {
              requestId: crypto.randomUUID(),
              operation: "contract.update",
              input: { slug: contract.slug, status: action === "suspend" ? "SUSPENDED" : "ACTIVE" },
            };
      const res = await fetch("/api/independent-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "No se pudo aplicar la acción.");
      toast(
        action === "renew30"
          ? `${contract.appName}: período extendido +30 días.`
          : action === "suspend"
          ? `${contract.appName}: contrato suspendido.`
          : `${contract.appName}: contrato activado.`,
        "ok"
      );
      setIndQuickConfirm(null);
      await fetchGovernance();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error ejecutando acción.", "error");
    } finally {
      setActionBusy(false);
    }
  };

  const loadCreateMeta = useCallback(async (slug: ManagedSaaS) => {
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/saas-management/${slug}?resource=catalog`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/saas-management/${slug}?resource=plans`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (cRes.success) setCreateCatalog(cRes.data);
      if (pRes.success) setCreatePlans(pRes.data.items || []);
    } catch {
      setCreateCatalog(null);
      setCreatePlans([]);
    }
  }, []);

  useEffect(() => {
    if (createOpen) void loadCreateMeta(createSaas);
  }, [createOpen, createSaas, loadCreateMeta]);

  const loadPlans = useCallback(async (slug: ManagedSaaS) => {
    setPlansLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/saas-management/${slug}?resource=catalog`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/saas-management/${slug}?resource=plans`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      setPlansCatalog(cRes.success ? cRes.data : null);
      setPlans(pRes.success ? pRes.data.items || [] : []);
    } catch {
      setPlansCatalog(null);
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async (slug: ManagedSaaS) => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/saas-management/${slug}?resource=audit`, { cache: "no-store" }).then((r) =>
        r.json()
      );
      setAuditEvents(res.success ? res.data.items || [] : []);
    } catch {
      setAuditEvents([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "planes") void loadPlans(planSaas);
    if (tab === "conectores") void loadAudit(planSaas);
  }, [tab, planSaas, loadPlans, loadAudit]);

  return (
    <div className="ot-pagina">
      <Encabezado
        icono={Building2}
        antetitulo="Negocio · Membresías y SaaS"
        titulo="Membresías y Clientes"
        bajada="Vista rápida unificada de todos tus clientes, vencimientos, cobros, planes y módulos en un solo lugar."
        accion={
          <div className="flex flex-wrap items-center gap-2">
            <NanoLabsButton
              size="small"
              icon={<Plus size={15} />}
              onClick={() => setCreateOpen(true)}
              disabled={managedSet.size === 0}
            >
              Nuevo cliente
            </NanoLabsButton>
            <NanoLabsButton
              variant="secondary"
              size="small"
              onClick={() => void fetchGovernance()}
              disabled={loading}
              icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
            >
              {loading ? "Sincronizando…" : "Actualizar"}
            </NanoLabsButton>
          </div>
        }
      />

      {loadError && (
        <NanoLabsAlert severity="error" title="Error consultando conectores" description={loadError} />
      )}

      {data?.sources?.some((s) => s.status === "unavailable") && (
        <NanoLabsAlert
          severity="warning"
          title="Algunos conectores no respondieron"
          description={`Sin respuesta: ${data.sources
            .filter((s) => s.status === "unavailable")
            .map((s) => s.saas)
            .join(", ")}. Los totales corresponden únicamente a las SaaS disponibles.`}
        />
      )}

      <NanoLabsTabs
        idBase="memberships-workspace"
        activa={tab}
        onCambiar={setTab}
        tabs={[
          { id: "membresias", label: "Membresías (Vista rápida)" },
          { id: "planes", label: "Planes por SaaS" },
          { id: "conectores", label: "Conectores y Auditoría" },
        ]}
      >
        {tab === "membresias" && (
          <div className="space-y-5">
            {/* KPIs filtrables */}
            <div className="bh-stats">
              <Indicador
                tono="primary"
                icono={Building2}
                valor={counts.all}
                etiqueta="Total clientes"
                activo={quickFilter === "all"}
                onClick={() => setQuickFilter("all")}
              />
              <Indicador
                tono="success"
                icono={CheckCircle2}
                valor={counts.active}
                etiqueta="Activos"
                activo={quickFilter === "active"}
                onClick={() => setQuickFilter("active")}
              />
              <Indicador
                tono="warning"
                icono={Clock}
                valor={counts.expiring}
                etiqueta="Por vencer (<=7d)"
                activo={quickFilter === "expiring"}
                onClick={() => setQuickFilter("expiring")}
              />
              <Indicador
                tono="danger"
                icono={AlertTriangle}
                valor={counts.expired}
                etiqueta="Vencidos"
                activo={quickFilter === "expired"}
                onClick={() => setQuickFilter("expired")}
              />
              <Indicador
                tono="info"
                icono={PauseCircle}
                valor={counts.paused}
                etiqueta="Prueba / Pausados"
                activo={quickFilter === "paused"}
                onClick={() => setQuickFilter("paused")}
              />
            </div>

            {/* Filtros */}
            <div className="bh-toolbar">
              <div className="bh-field bh-search-field">
                <label className="bh-label" htmlFor="buscar-membresia">
                  Buscar cliente
                </label>
                <span className="bh-search-field__icon">
                  <Search size={16} />
                </span>
                <input
                  id="buscar-membresia"
                  type="search"
                  className="bh-input"
                  placeholder="Nombre, slug, dominio o plan…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="bh-field max-w-xs">
                <label className="bh-label" htmlFor="filtro-saas">
                  Plataforma SaaS
                </label>
                <select
                  id="filtro-saas"
                  className="bh-select"
                  value={selectedSaas}
                  onChange={(e) => setSelectedSaas(e.target.value)}
                >
                  <option value="all">Todas las plataformas ({allTenants.length + independentList.length})</option>
                  <option value="__independent__">Apps Independientes ({independentList.length})</option>
                  {SAAS_PRODUCTS.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {quickFilter === "attention" && (
                <div className="flex items-end">
                  <NanoLabsButton size="small" variant="secondary" onClick={() => setQuickFilter("all")}>
                    Mostrando: Requieren atención (Quitar filtro)
                  </NanoLabsButton>
                </div>
              )}
            </div>

            {/* Tabla Maestra */}
            {loading && !data ? (
              <Cargando texto="Cargando membresías y clientes…" />
            ) : filteredTenants.length === 0 && filteredIndependent.length === 0 ? (
              <Vacio
                titulo="No hay clientes que coincidan"
                texto="Probá cambiando los filtros de plataforma, estado o vencimiento."
              />
            ) : (
              <div className="ot-tabla">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="bh-table ot-fija min-w-[960px]">
                    <thead>
                      <tr>
                        <th style={{ width: "24%" }}>Cliente / Dominio</th>
                        <th style={{ width: "13%" }}>Plataforma</th>
                        <th style={{ width: "14%" }}>Plan</th>
                        <th style={{ width: "12%" }}>Estado</th>
                        <th style={{ width: "16%" }}>Vencimiento</th>
                        <th style={{ width: "21%", textAlign: "right" }}>Acciones rápidas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIndependent.map((c) => {
                        const exp = expirationBadge(c.periodEnd);
                        return (
                          <tr key={`ind-${c.slug}`}>
                            <td>
                              <div className="bh-table-title">{c.appName}</div>
                              <div className="bh-table-meta flex items-center gap-2">
                                <span className="ot-mono">{c.clientName}</span>
                                <a
                                  href={`https://${c.domain}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hub-text-link !text-[11px]"
                                >
                                  {c.domain} <ExternalLink size={11} />
                                </a>
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-xs font-bold">App independiente</span>
                                <span className="text-[10px] text-slate-500">Circuito NanoLabs</span>
                              </div>
                            </td>
                            <td>
                              <span className="text-xs font-medium">{c.planName}</span>
                              <div className="bh-table-meta">
                                {c.priceCents > 0 ? money(c.priceCents, c.currency) : c.billingCycle}
                              </div>
                            </td>
                            <td>{statusChip(c.status)}</td>
                            <td>
                              <div className="flex flex-col items-start gap-1">
                                <NanoLabsChip severity={exp.severity}>{exp.label}</NanoLabsChip>
                                <span className="ot-mono text-[11px] text-slate-500">
                                  {new Date(c.periodEnd).toLocaleDateString("es-AR")}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <NanoLabsButton
                                  size="small"
                                  variant="secondary"
                                  title="Renovar +30 días"
                                  onClick={() => setIndQuickConfirm({ contract: c, action: "renew30" })}
                                >
                                  +30d
                                </NanoLabsButton>
                                <NanoLabsButton
                                  size="small"
                                  variant="tertiary"
                                  icon={c.status === "SUSPENDED" ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                                  onClick={() =>
                                    setIndQuickConfirm({
                                      contract: c,
                                      action: c.status === "SUSPENDED" ? "activate" : "suspend",
                                    })
                                  }
                                >
                                  {c.status === "SUSPENDED" ? "Activar" : "Pausar"}
                                </NanoLabsButton>
                                <NanoLabsButton
                                  size="small"
                                  variant="tertiary"
                                  title="Cobros de la app"
                                  icon={<CreditCard size={14} />}
                                  onClick={() => {
                                    setIndSlug(c.slug);
                                    setIndTab("pagos");
                                    setIndDrawerOpen(true);
                                  }}
                                />
                                <NanoLabsButton
                                  size="small"
                                  icon={<Settings2 size={14} />}
                                  onClick={() => {
                                    setIndSlug(c.slug);
                                    setIndTab("resumen");
                                    setIndDrawerOpen(true);
                                  }}
                                >
                                  Gestionar
                                </NanoLabsButton>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredTenants.map((t) => {
                        const exp = expirationBadge(t.planExpiresAt);
                        const canManage = isManaged(t.saas) && managedSet.has(t.saas);
                        return (
                          <tr key={`${t.saas}-${t.id}`}>
                            <td>
                              <div className="bh-table-title">{t.name}</div>
                              <div className="bh-table-meta flex items-center gap-2">
                                <span className="ot-mono">{t.slug}</span>
                                {t.domain && (
                                  <a
                                    href={`https://${t.domain}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hub-text-link !text-[11px]"
                                  >
                                    {t.domain} <ExternalLink size={11} />
                                  </a>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-xs font-bold">{t.saasName}</span>
                                <span className="text-[10px] text-slate-500">
                                  {canManage ? "Control total" : "Solo lectura"}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className="text-xs font-medium">{t.plan}</span>
                              {t.metrics.available !== false && (
                                <div className="bh-table-meta">
                                  {t.metrics.totalRecords.toLocaleString("es-AR")} {t.metrics.recordLabel}
                                </div>
                              )}
                            </td>
                            <td>{statusChip(t.status)}</td>
                            <td>
                              <div className="flex flex-col items-start gap-1">
                                <NanoLabsChip severity={exp.severity}>{exp.label}</NanoLabsChip>
                                {t.planExpiresAt && (
                                  <span className="ot-mono text-[11px] text-slate-500">
                                    {new Date(t.planExpiresAt).toLocaleDateString("es-AR")}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {canManage ? (
                                  <>
                                    <NanoLabsButton
                                      size="small"
                                      variant="secondary"
                                      title="Renovar +30 días"
                                      onClick={() => setQuickConfirm({ tenant: t, action: "renew30" })}
                                    >
                                      +30d
                                    </NanoLabsButton>
                                    <NanoLabsButton
                                      size="small"
                                      variant="tertiary"
                                      title={t.status === "SUSPENDED" ? "Activar cliente" : "Suspender acceso"}
                                      icon={
                                        t.status === "SUSPENDED" ? (
                                          <PlayCircle size={14} />
                                        ) : (
                                          <PauseCircle size={14} />
                                        )
                                      }
                                      onClick={() =>
                                        setQuickConfirm({
                                          tenant: t,
                                          action: t.status === "SUSPENDED" ? "activate" : "suspend",
                                        })
                                      }
                                    >
                                      {t.status === "SUSPENDED" ? "Activar" : "Pausar"}
                                    </NanoLabsButton>
                                    <NanoLabsButton
                                      size="small"
                                      variant="tertiary"
                                      title="Registrar pago SaaS"
                                      icon={<CreditCard size={14} />}
                                      onClick={() => openDrawer(t, "pagos")}
                                    />
                                    <NanoLabsButton
                                      size="small"
                                      icon={<Settings2 size={14} />}
                                      onClick={() => openDrawer(t, "resumen")}
                                    >
                                      Gestionar
                                    </NanoLabsButton>
                                  </>
                                ) : (
                                  <NanoLabsButton
                                    size="small"
                                    variant="secondary"
                                    onClick={() => setReadonlyTenant(t)}
                                  >
                                    Ver ficha
                                  </NanoLabsButton>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800">
              <span>
                Web institucional sin cobro:{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {INSTITUTIONAL_APPS.map((a) => `${a.name} (${a.domain})`).join(", ")}
                </strong>
              </span>
              <span>Solo monitoreo técnico y respaldos en Infraestructura/Backups</span>
            </div>
          </div>
        )}

        {tab === "planes" && (
          <div className="space-y-4">
            <div className="bh-toolbar">
              <div className="bh-field max-w-xs">
                <label className="bh-label" htmlFor="plan-saas-select">
                  Elegí la plataforma SaaS
                </label>
                <select
                  id="plan-saas-select"
                  className="bh-select"
                  value={planSaas}
                  onChange={(e) => setPlanSaas(e.target.value as ManagedSaaS)}
                >
                  {MANAGED_SLUGS.map((slug) => (
                    <option key={slug} value={slug}>
                      {SAAS_PRODUCTS.find((p) => p.slug === slug)?.name || slug}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end justify-end">
                <NanoLabsButton
                  size="small"
                  icon={<Plus size={14} />}
                  disabled={!plansCatalog}
                  onClick={() => setEditingPlan("new")}
                >
                  Crear plan
                </NanoLabsButton>
              </div>
            </div>

            {plansLoading ? (
              <Cargando texto="Cargando planes…" />
            ) : !plansCatalog ? (
              <NanoLabsAlert
                severity="warning"
                title="Plataforma sin catálogo disponible"
                description="Esta SaaS no respondió al endpoint de administración o no tiene credenciales activas."
              />
            ) : (
              <div className="ot-tabla">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="bh-table ot-fija min-w-[780px]">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Precio</th>
                        <th>Estado</th>
                        <th>Módulos activos</th>
                        <th style={{ textAlign: "right" }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((pl) => (
                        <tr key={pl.id}>
                          <td className="ot-mono font-bold">{pl.code}</td>
                          <td>
                            <div className="bh-table-title">{pl.name}</div>
                            {pl.description && <div className="bh-table-meta">{pl.description}</div>}
                          </td>
                          <td className="ot-mono">{money(pl.priceCents, pl.currency)}</td>
                          <td>
                            <NanoLabsChip severity={pl.active ? "success" : "neutral"}>
                              {pl.active ? "Disponible" : "Inactivo"}
                            </NanoLabsChip>
                          </td>
                          <td className="text-xs">
                            {Object.values(pl.modules).filter(Boolean).length} / {Object.keys(pl.modules).length}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <NanoLabsButton size="small" variant="secondary" onClick={() => setEditingPlan(pl)}>
                              Editar
                            </NanoLabsButton>
                          </td>
                        </tr>
                      ))}
                      {plans.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center text-xs text-slate-500">
                            No hay planes registrados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "conectores" && (
          <div className="space-y-5">
            <div className="ot-tabla">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="bh-table ot-fija min-w-[760px]">
                  <thead>
                    <tr>
                      <th>SaaS</th>
                      <th>Dominio</th>
                      <th>Lectura de clientes</th>
                      <th>Gestión central</th>
                      <th>Tenants reportados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAAS_PRODUCTS.map((p) => {
                      const src = data?.sources?.find((s) => s.saas === p.slug);
                      const mgmt = data?.managementSources?.find((s) => s.saas === p.slug);
                      return (
                        <tr key={p.slug}>
                          <td>
                            <div className="bh-table-title">{p.name}</div>
                            <div className="bh-table-meta">{p.focus}</div>
                          </td>
                          <td className="ot-mono text-xs">{p.domain}</td>
                          <td>
                            <NanoLabsChip
                              severity={
                                src?.status === "available"
                                  ? "success"
                                  : src?.status === "disabled"
                                  ? "neutral"
                                  : "warning"
                              }
                            >
                              {src?.status === "available"
                                ? "Conectado"
                                : src?.status === "disabled"
                                ? "Desactivado"
                                : "Sin respuesta"}
                            </NanoLabsChip>
                          </td>
                          <td>
                            <NanoLabsChip
                              severity={
                                mgmt?.status === "available"
                                  ? "success"
                                  : mgmt?.status === "disabled"
                                  ? "neutral"
                                  : "warning"
                              }
                            >
                              {mgmt?.status === "available"
                                ? `${mgmt.operations.length} operaciones`
                                : mgmt?.status === "disabled"
                                ? "Pendiente"
                                : "Sin respuesta"}
                            </NanoLabsChip>
                          </td>
                          <td className="ot-mono font-semibold">{src?.count ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bh-card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="hub-section-heading">
                  <Layers3 size={16} /> Auditoría de comandos en plataforma
                </h3>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="SaaS auditoría"
                    className="bh-select !h-9 !w-44"
                    value={planSaas}
                    onChange={(e) => setPlanSaas(e.target.value as ManagedSaaS)}
                  >
                    {MANAGED_SLUGS.map((slug) => (
                      <option key={slug} value={slug}>
                        {SAAS_PRODUCTS.find((p) => p.slug === slug)?.name || slug}
                      </option>
                    ))}
                  </select>
                  <NanoLabsButton size="small" variant="secondary" onClick={() => void loadAudit(planSaas)}>
                    Consultar
                  </NanoLabsButton>
                </div>
              </div>
              {auditLoading ? (
                <Cargando texto="Consultando eventos…" />
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="bh-table min-w-[600px]">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Operador</th>
                        <th>Acción</th>
                        <th>Entidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditEvents.map((ev) => (
                        <tr key={ev.id}>
                          <td className="text-xs">{new Date(ev.createdAt).toLocaleString("es-AR")}</td>
                          <td className="text-xs">{ev.actor || "Sistema"}</td>
                          <td className="ot-mono text-xs">{ev.action}</td>
                          <td className="text-xs">
                            {ev.entity} {ev.entityId}
                          </td>
                        </tr>
                      ))}
                      {auditEvents.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center text-xs text-slate-500">
                            Sin eventos recientes registrados para esta plataforma.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </NanoLabsTabs>

      {/* Drawer lateral completo */}
      <TenantDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        product={drawerProduct}
        tenantId={drawerTenantId}
        initialTab={drawerTab}
        onUpdated={() => void fetchGovernance()}
      />

      <IndependentAppDrawer
        open={indDrawerOpen}
        onClose={() => setIndDrawerOpen(false)}
        slug={indSlug}
        initialTab={indTab}
        onUpdated={() => void fetchGovernance()}
      />

      <NanoLabsModal
        open={!!indQuickConfirm}
        onClose={() => !actionBusy && setIndQuickConfirm(null)}
        title={
          indQuickConfirm?.action === "renew30"
            ? "Renovar app independiente +30 días"
            : indQuickConfirm?.action === "suspend"
            ? "Suspender contrato"
            : "Activar contrato"
        }
        subtitle={indQuickConfirm ? `${indQuickConfirm.contract.appName} · ${indQuickConfirm.contract.domain}` : undefined}
        icon={CalendarClock}
        width={460}
      >
        {indQuickConfirm && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-500">
              {indQuickConfirm.action === "renew30"
                ? "Se extenderá el período 30 días y el estado quedará Activo."
                : indQuickConfirm.action === "suspend"
                ? "El estado administrativo pasará a Suspendido."
                : "El contrato pasará a estado Activo."}
            </p>
            <div className="bh-dialog__actions">
              <NanoLabsButton variant="secondary" disabled={actionBusy} onClick={() => setIndQuickConfirm(null)}>
                Cancelar
              </NanoLabsButton>
              <NanoLabsButton disabled={actionBusy} onClick={() => void executeIndQuickAction()}>
                {actionBusy ? "Aplicando…" : "Confirmar"}
              </NanoLabsButton>
            </div>
          </div>
        )}
      </NanoLabsModal>

      {/* Modal de confirmación rápida (+30d / Pausar / Activar) */}
      <NanoLabsModal
        open={!!quickConfirm}
        onClose={() => !actionBusy && setQuickConfirm(null)}
        title={
          quickConfirm?.action === "renew30"
            ? "Renovar membresía +30 días"
            : quickConfirm?.action === "suspend"
            ? "Suspender acceso del cliente"
            : "Activar cliente"
        }
        subtitle={quickConfirm ? `${quickConfirm.tenant.name} · ${quickConfirm.tenant.saasName}` : undefined}
        icon={CalendarClock}
        width={480}
      >
        {quickConfirm && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-500">
              {quickConfirm.action === "renew30"
                ? "Se extenderá la suscripción 30 días desde la fecha vigente (o desde hoy si ya venció) y el estado pasará a Activo. No registra un pago automático."
                : quickConfirm.action === "suspend"
                ? "El cliente perderá acceso operativo en su plataforma, conservando todos sus datos."
                : "Se habilitará el acceso operativo del cliente si su membresía está vigente."}
            </p>
            <div className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
              <div>
                <strong>Plan actual:</strong> {quickConfirm.tenant.plan}
              </div>
              <div className="mt-1">
                <strong>Vencimiento actual:</strong>{" "}
                {quickConfirm.tenant.planExpiresAt
                  ? new Date(quickConfirm.tenant.planExpiresAt).toLocaleDateString("es-AR")
                  : "Sin fecha"}
              </div>
            </div>
            <div className="bh-dialog__actions">
              <NanoLabsButton variant="secondary" disabled={actionBusy} onClick={() => setQuickConfirm(null)}>
                Cancelar
              </NanoLabsButton>
              <NanoLabsButton disabled={actionBusy} onClick={() => void executeQuickAction()}>
                {actionBusy ? "Aplicando…" : "Confirmar"}
              </NanoLabsButton>
            </div>
          </div>
        )}
      </NanoLabsModal>

      {/* Modal solo-lectura para SaaS sin conector de escritura */}
      <NanoLabsModal
        open={!!readonlyTenant}
        onClose={() => setReadonlyTenant(null)}
        title={readonlyTenant?.name || "Detalle"}
        subtitle={readonlyTenant ? `${readonlyTenant.saasName} · Solo lectura` : undefined}
        icon={ShieldAlert}
        width={540}
      >
        {readonlyTenant && (
          <div className="space-y-4 text-xs">
            <NanoLabsAlert
              severity="info"
              title="Conector en modo consulta"
              description="Esta plataforma aún no tiene habilitada la gestión central de escritura desde el Hub."
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <span className="text-slate-500">Estado</span>
                <div className="mt-1">{statusChip(readonlyTenant.status)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <span className="text-slate-500">Plan</span>
                <div className="mt-1 font-bold">{readonlyTenant.plan}</div>
              </div>
            </div>
            <div>
              <p className="mb-2 font-bold">Módulos reportados</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(readonlyTenant.modules).map(([k, v]) => (
                  <NanoLabsChip key={k} severity={v ? "success" : "neutral"}>
                    {k}: {v ? "Sí" : "No"}
                  </NanoLabsChip>
                ))}
              </div>
            </div>
            <div className="bh-dialog__actions">
              <NanoLabsButton onClick={() => setReadonlyTenant(null)}>Cerrar</NanoLabsButton>
            </div>
          </div>
        )}
      </NanoLabsModal>

      {/* Modal Crear Cliente */}
      <NanoLabsModal
        open={createOpen}
        onClose={() => !actionBusy && setCreateOpen(false)}
        title="Crear cliente (Tenant)"
        subtitle="Alta directa y auditada en la plataforma elegida"
        icon={Plus}
        width={620}
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setActionBusy(true);
            try {
              const payload = {
                requestId: crypto.randomUUID(),
                operation: "tenant.create",
                input: {
                  name: f.get("name"),
                  slug: f.get("slug"),
                  planId: f.get("planId"),
                  ownerName: f.get("ownerName"),
                  ...(createCatalog?.ownerIdentity === "username"
                    ? { ownerUsername: f.get("ownerUsername") }
                    : { ownerEmail: f.get("ownerEmail") }),
                  password: f.get("password"),
                  status: f.get("status"),
                  start: new Date(String(f.get("start"))).toISOString(),
                  end: new Date(String(f.get("end"))).toISOString(),
                },
              };
              const res = await fetch(`/api/saas-management/${createSaas}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = await res.json();
              if (!res.ok || !json.success) throw new Error(json.error || "No se pudo crear el tenant");
              toast("Cliente creado correctamente.", "ok");
              setCreateOpen(false);
              await fetchGovernance();
            } catch (err) {
              toast(err instanceof Error ? err.message : "Error creando cliente", "error");
            } finally {
              setActionBusy(false);
            }
          }}
        >
          <label className="block space-y-1 text-xs">
            <span className="text-slate-500">Plataforma SaaS</span>
            <select
              className="bh-select"
              value={createSaas}
              onChange={(e) => setCreateSaas(e.target.value as ManagedSaaS)}
            >
              {MANAGED_SLUGS.filter((s) => managedSet.has(s)).map((s) => (
                <option key={s} value={s}>
                  {SAAS_PRODUCTS.find((p) => p.slug === s)?.name || s}
                </option>
              ))}
            </select>
          </label>

          {!createCatalog ? (
            <Cargando texto="Cargando planes disponibles…" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Nombre de la empresa</span>
                <input name="name" required className="bh-input" />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Slug (identificador)</span>
                <input name="slug" required placeholder="empresa-ejemplo" className="bh-input" />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Plan</span>
                <select name="planId" required defaultValue="" className="bh-select">
                  <option value="" disabled>
                    Seleccioná un plan
                  </option>
                  {createPlans
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {money(p.priceCents, p.currency)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Estado inicial</span>
                <select name="status" className="bh-select" defaultValue="TRIAL">
                  <option value="TRIAL">En prueba</option>
                  <option value="ACTIVE">Activo</option>
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Propietario</span>
                <input name="ownerName" required className="bh-input" />
              </label>
              {createCatalog.ownerIdentity === "username" ? (
                <label className="space-y-1 text-xs">
                  <span className="text-slate-500">Usuario del propietario</span>
                  <input name="ownerUsername" required className="bh-input" />
                </label>
              ) : (
                <label className="space-y-1 text-xs">
                  <span className="text-slate-500">Correo del propietario</span>
                  <input name="ownerEmail" type="email" required className="bh-input" />
                </label>
              )}
              <label className="space-y-1 text-xs sm:col-span-2">
                <span className="text-slate-500">Contraseña inicial (mínimo 12 caracteres)</span>
                <input name="password" type="password" minLength={12} required autoComplete="new-password" className="bh-input" />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Inicio</span>
                <input name="start" type="datetime-local" required defaultValue={toDateTimeLocal(new Date().toISOString())} className="bh-input" />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Vencimiento</span>
                <input
                  name="end"
                  type="datetime-local"
                  required
                  defaultValue={toDateTimeLocal(new Date(Date.now() + 14 * 86400000).toISOString())}
                  className="bh-input"
                />
              </label>
            </div>
          )}

          <div className="bh-dialog__actions">
            <NanoLabsButton type="button" variant="secondary" disabled={actionBusy} onClick={() => setCreateOpen(false)}>
              Cancelar
            </NanoLabsButton>
            <NanoLabsButton type="submit" disabled={actionBusy || !createCatalog}>
              {actionBusy ? "Creando…" : "Crear cliente"}
            </NanoLabsButton>
          </div>
        </form>
      </NanoLabsModal>

      {/* Modal Crear/Editar Plan */}
      <NanoLabsModal
        open={!!editingPlan && !!plansCatalog}
        onClose={() => !actionBusy && setEditingPlan(null)}
        title={editingPlan === "new" ? `Nuevo plan en ${planSaas}` : `Editar plan: ${(editingPlan as ManagedPlan)?.name}`}
        width={620}
      >
        {editingPlan && plansCatalog && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const isNew = editingPlan === "new";
              const existing = isNew ? null : editingPlan;
              setActionBusy(true);
              try {
                const payload = {
                  requestId: crypto.randomUUID(),
                  operation: isNew ? "plan.create" : "plan.update",
                  input: {
                    ...(existing ? { planId: existing.id, version: existing.version } : { code: f.get("code") }),
                    name: f.get("name"),
                    description: f.get("description") || "",
                    priceCents: Math.round(Number(f.get("price")) * 100),
                    currency: plansCatalog.currency || "ARS",
                    active: f.has("active"),
                    modules: Object.fromEntries(plansCatalog.modules.map((k) => [k, f.has(`mod_${k}`)])),
                    limits: Object.fromEntries(
                      plansCatalog.limits
                        .filter((k) => f.get(`lim_${k}`))
                        .map((k) => [k, Number(f.get(`lim_${k}`))])
                    ),
                  },
                };
                const res = await fetch(`/api/saas-management/${planSaas}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.error || "No se pudo guardar el plan");
                toast("Plan guardado correctamente.", "ok");
                setEditingPlan(null);
                await loadPlans(planSaas);
              } catch (err) {
                toast(err instanceof Error ? err.message : "Error guardando plan", "error");
              } finally {
                setActionBusy(false);
              }
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {editingPlan === "new" && (
                <label className="space-y-1 text-xs">
                  <span className="text-slate-500">Código</span>
                  <input name="code" required placeholder="PRO" className="bh-input" />
                </label>
              )}
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Nombre</span>
                <input
                  name="name"
                  required
                  defaultValue={editingPlan === "new" ? "" : editingPlan.name}
                  className="bh-input"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Precio ({plansCatalog.currency})</span>
                <input
                  name="price"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  defaultValue={editingPlan === "new" ? 0 : editingPlan.priceCents / 100}
                  className="bh-input"
                />
              </label>
              <label className="space-y-1 text-xs sm:col-span-2">
                <span className="text-slate-500">Descripción</span>
                <input
                  name="description"
                  defaultValue={editingPlan === "new" ? "" : editingPlan.description}
                  className="bh-input"
                />
              </label>
              <label className="bh-check-label sm:col-span-2">
                <input
                  type="checkbox"
                  name="active"
                  className="bh-check"
                  defaultChecked={editingPlan === "new" ? true : editingPlan.active}
                />
                Disponible para nuevas altas
              </label>
              {plansCatalog.limits.map((k) => (
                <label key={k} className="space-y-1 text-xs">
                  <span className="text-slate-500">Límite {k}</span>
                  <input
                    name={`lim_${k}`}
                    type="number"
                    min={1}
                    required={!plansCatalog.optionalLimits.includes(k)}
                    defaultValue={
                      editingPlan === "new"
                        ? plansCatalog.optionalLimits.includes(k)
                          ? ""
                          : 100
                        : editingPlan.limits[k] ?? ""
                    }
                    className="bh-input"
                  />
                </label>
              ))}
              <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-bold">Módulos incluidos</p>
                <div className="flex flex-wrap gap-3">
                  {plansCatalog.modules.map((k) => (
                    <label key={k} className="bh-check-label text-xs">
                      <input
                        type="checkbox"
                        name={`mod_${k}`}
                        className="bh-check"
                        defaultChecked={editingPlan === "new" ? true : editingPlan.modules[k] ?? true}
                      />
                      {k}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="bh-dialog__actions">
              <NanoLabsButton type="button" variant="secondary" disabled={actionBusy} onClick={() => setEditingPlan(null)}>
                Cancelar
              </NanoLabsButton>
              <NanoLabsButton type="submit" disabled={actionBusy}>
                {actionBusy ? "Guardando…" : "Guardar plan"}
              </NanoLabsButton>
            </div>
          </form>
        )}
      </NanoLabsModal>
    </div>
  );
}
