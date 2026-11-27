"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ManagedPlan, ManagedSaaS, ManagedTenant, ManagementCatalog, ManagementCommand, ManagementOperation } from "@/lib/saas-management-types";
import { Cargando, NanoLabsAlert, NanoLabsButton, NanoLabsChip, NanoLabsModal, NanoLabsTabs, useToast } from "./nanolabs";
import { OnlyCarsDomains } from "./OnlyCarsControls";
import { UnifiedSaaSPayments } from "./UnifiedSaaSPayments";
import { SAAS_PRODUCTS } from "@/lib/product-taxonomy";

const MODULE_LABELS: Record<string, string> = {
  VENTAS: "Ventas y pedidos",
  COMPRAS: "Compras",
  INVENTARIO: "Inventario",
  CLIENTES: "Clientes",
  PROVEEDORES: "Proveedores",
  LISTAS_PRECIO: "Listas de precios",
  PRESUPUESTOS: "Presupuestos",
  CAJA: "Caja",
  CUENTAS_CORRIENTES: "Cuentas corrientes",
  LOGISTICA: "Logística",
  CHEQUES: "Cheques",
  COMISIONES: "Comisiones",
  AFIP: "Facturación AFIP",
  PORTAL_B2B: "Portal B2B",
  VENDEDORES_PWA: "App de vendedores",
  maxWarehouses: "Depósitos",
  pwa_clientes: "App de clientes",
  seller_pwa: "App de vendedores",
  branding_documentos: "Personalización de documentos",
  maxVehicles: "Vehículos",
  orders: "Pedidos y catálogo",
  loyalty: "Fidelización",
  roulette: "Ruleta",
  whatsapp: "Avisos por WhatsApp",
  multipleLocations: "Múltiples sucursales",
  printNode: "Impresión automática",
  cashRegister: "Caja diaria",
  quantityDiscounts: "Descuentos por cantidad",
  maxProducts: "Productos",
  pwaEnabled: "Tienda PWA",
  accountsEnabled: "Cuentas corrientes",
  reservations: "Reservas",
  users: "Usuarios",
  tournaments: "Torneos",
  rankings: "Rankings",
  player_categories: "Categorías de jugadores",
  expenses: "Gastos",
  push: "Notificaciones Push",
  payments: "Pagos",
  community: "Comunidad",
  analytics: "Analytics",
  integrations: "Integraciones",
  owner_portal: "Portal de propietarios",
  renter_portal: "Portal de inquilinos",
  automation: "Automatizaciones",
  inventory: "Inventario",
  lotTracking: "Lotes y vencimientos",
  transformations: "Transformaciones",
  pos: "Punto de venta (POS)",
  promotions: "Promociones",
  finance: "Finanzas",
  reports: "Reportes",
  maxUsers: "Usuarios",
  maxBranches: "Sucursales",
  maxLocations: "Sedes",
  maxProperties: "Propiedades",
  maxGarages: "Cocheras",
  maxPublications: "Publicaciones",
  maxCourts: "Canchas",
  maxBookings: "Reservas mensuales",
};

const STATES_LABEL: Record<string, string> = {
  ACTIVE: "Activo",
  TRIAL: "En prueba",
  SUSPENDED: "Suspendido",
  CANCELED: "Cancelado",
  PAST_DUE: "Vencido por deuda",
};

const dateInput = (isoDate: string) => {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const toIso = (value: FormDataEntryValue | null) => new Date(String(value)).toISOString();

const money = (cents: number | null, currency = "ARS") =>
  cents === null ? "No informado" : new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(cents / 100);

export interface TenantDrawerProps {
  open: boolean;
  onClose: () => void;
  product: ManagedSaaS;
  tenantId: string;
  initialTab?: "resumen" | "modulos" | "pagos" | "accesos";
  onUpdated: () => void;
}

export function TenantDrawer({
  open,
  onClose,
  product,
  tenantId,
  initialTab = "resumen",
  onUpdated,
}: TenantDrawerProps) {
  const toast = useToast();
  const drawerRef = useRef<HTMLDivElement>(null);
  const api = `/api/saas-management/${product}`;

  const [tab, setTab] = useState<"resumen" | "modulos" | "pagos" | "accesos">(initialTab);
  const [catalog, setCatalog] = useState<ManagementCatalog | null>(null);
  const [plans, setPlans] = useState<ManagedPlan[]>([]);
  const [tenant, setTenant] = useState<ManagedTenant | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingCmd, setPendingCmd] = useState<ManagementCommand | null>(null);

  // Batch module edits: map key -> "inherit" | "on" | "off" | number string
  const [moduleDrafts, setModuleDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, tenantId]);

  const fetchData = useCallback(
    async <T,>(resource: string, extra: Record<string, string> = {}): Promise<T> => {
      const response = await fetch(`${api}?${new URLSearchParams({ resource, ...extra })}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "No se pudieron consultar los datos.");
      return json.data as T;
    },
    [api]
  );

  const loadDetail = useCallback(async () => {
    if (!open || !tenantId) return;
    setLoading(true);
    setError("");
    try {
      const [c, firstPlans, t] = await Promise.all([
        fetchData<ManagementCatalog>("catalog"),
        fetchData<{ items: ManagedPlan[]; nextOffset: number | null }>("plans"),
        fetchData<ManagedTenant>("tenant", { tenantId }),
      ]);
      const allPlans = [...firstPlans.items];
      let offset = firstPlans.nextOffset;
      for (let i = 0; offset !== null && i < 20; i++) {
        const page = await fetchData<{ items: ManagedPlan[]; nextOffset: number | null }>("plans", {
          offset: String(offset),
        });
        allPlans.push(...page.items);
        if (page.nextOffset !== null && page.nextOffset <= offset) break;
        offset = page.nextOffset;
      }
      setCatalog(c);
      setPlans(allPlans);
      setTenant(t);
      const initialDrafts: Record<string, string> = {};
      for (const [k, v] of Object.entries(t.modules)) {
        if (c.modules.includes(k)) {
          initialDrafts[k] = v.override === null ? "inherit" : v.override ? "on" : "off";
        } else {
          initialDrafts[k] = typeof v.override === "number" ? String(v.override) : "";
        }
      }
      setModuleDrafts(initialDrafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la ficha del cliente.");
    } finally {
      setLoading(false);
    }
  }, [fetchData, open, tenantId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const sendCommand = useCallback(
    async (command: ManagementCommand, silent = false) => {
      setBusy(true);
      setError("");
      setPendingCmd(command);
      try {
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
        let json: { success?: boolean; error?: string; data?: { version?: string } } = {};
        try {
          json = await res.json();
        } catch {
          throw new Error("No se confirmó la respuesta de la plataforma.");
        }
        if (!res.ok || !json.success) {
          throw new Error(json.error || "No se pudo completar el cambio.");
        }
        drawerRef.current?.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((el) => {
          el.value = "";
        });
        setPendingCmd(null);
        if (!silent) toast("Cambio confirmado y auditado.", "ok");
        await loadDetail();
        onUpdated();
        return json.data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo completar el cambio.";
        setError(msg);
        toast(msg, "error");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [api, loadDetail, onUpdated, toast]
  );

  const submit = useCallback(
    (operation: ManagementOperation, input: Record<string, unknown>) => {
      if (busy || !catalog?.operations.includes(operation)) {
        if (!catalog?.operations.includes(operation)) setError("Esta credencial no permite la operación.");
        return;
      }
      void sendCommand({ requestId: crypto.randomUUID(), operation, input }).catch(() => undefined);
    },
    [busy, catalog, sendCommand]
  );

  const dirtyModules = useMemo(() => {
    if (!tenant || !catalog) return [];
    return Object.entries(tenant.modules).filter(([k, val]) => {
      const currentVal = catalog.modules.includes(k)
        ? val.override === null
          ? "inherit"
          : val.override
          ? "on"
          : "off"
        : typeof val.override === "number"
        ? String(val.override)
        : "";
      return (moduleDrafts[k] ?? currentVal) !== currentVal;
    });
  }, [catalog, moduleDrafts, tenant]);

  const saveAllModules = async () => {
    if (!tenant || !catalog || dirtyModules.length === 0) return;
    setBusy(true);
    setError("");
    let latestVersion = tenant.version;
    try {
      for (const [key] of dirtyModules) {
        const draft = moduleDrafts[key];
        const isBool = catalog.modules.includes(key);
        const input = {
          tenantId: tenant.id,
          version: latestVersion,
          key,
          enabled: isBool ? (draft === "inherit" ? null : draft === "on") : null,
          limit: !isBool && draft ? Number(draft) : null,
        };
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: crypto.randomUUID(), operation: "module.set", input }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || `Error guardando ${key}`);
        if (json.data?.version) latestVersion = json.data.version;
      }
      toast(`${dirtyModules.length} módulo(s) actualizados correctamente.`, "ok");
      await loadDetail();
      onUpdated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudieron guardar los módulos.";
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  const base = () => ({ tenantId: tenant!.id, version: tenant!.version });

  return (
    <NanoLabsModal
      open={open}
      onClose={onClose}
      type="right"
      title={tenant ? tenant.name : "Administración de cliente"}
      subtitle={tenant ? `${product.toUpperCase()} · ${tenant.slug}` : "Cargando ficha…"}
    >
      <div ref={drawerRef} className="saas-management space-y-4">
        {error && <NanoLabsAlert severity="error" title="Atención" description={error} />}

        {pendingCmd && !busy && (
          <NanoLabsAlert
            severity="warning"
            title="Solicitud pendiente de confirmación"
            description={
              <div className="flex items-center justify-between gap-2">
                <span>Podés reintentar sin riesgo de duplicación.</span>
                <NanoLabsButton size="small" onClick={() => void sendCommand(pendingCmd).catch(() => undefined)}>
                  Reintentar
                </NanoLabsButton>
              </div>
            }
          />
        )}

        {loading && !tenant ? (
          <Cargando texto="Cargando ficha del cliente…" />
        ) : tenant && catalog ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <NanoLabsChip severity={tenant.status === "ACTIVE" ? "success" : tenant.status === "TRIAL" ? "info" : "warning"}>
                    {STATES_LABEL[tenant.status] || tenant.status}
                  </NanoLabsChip>
                  <span className="font-semibold">{tenant.plan?.name || "Sin plan"}</span>
                </div>
                <p className="text-slate-500">
                  Vencimiento:{" "}
                  {tenant.subscription ? new Date(tenant.subscription.end).toLocaleDateString("es-AR") : "Sin suscripción"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {catalog.operations.includes("subscription.renew") && (
                  <NanoLabsButton
                    size="small"
                    disabled={busy}
                    onClick={() => submit("subscription.renew", { ...base(), days: 30 })}
                  >
                    +30 días
                  </NanoLabsButton>
                )}
              </div>
            </div>

            <NanoLabsTabs
              idBase="tenant-drawer"
              activa={tab}
              onCambiar={setTab}
              tabs={[
                { id: "resumen", label: "Suscripción" },
                {
                  id: "modulos",
                  label: dirtyModules.length > 0 ? `Módulos (${dirtyModules.length})` : "Módulos",
                },
                { id: "pagos", label: "Pagos" },
                { id: "accesos", label: "Accesos" },
              ]}
            >
              {tab === "resumen" && (
                <div className="space-y-4">
                  {/* Estado rápido */}
                  <form
                    className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      submit("tenant.status", { ...base(), status: f.get("status") });
                    }}
                  >
                    <h4 className="text-sm font-bold">Estado de acceso</h4>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="min-w-[180px] flex-1 space-y-1 text-xs">
                        <span className="text-slate-500">Estado</span>
                        <select name="status" defaultValue={tenant.status} className="bh-select">
                          {Object.entries(STATES_LABEL)
                            .filter(([k]) => (catalog.statuses ? catalog.statuses.includes(k) : k !== "PAST_DUE"))
                            .map(([k, lbl]) => (
                              <option key={k} value={k}>
                                {lbl}
                              </option>
                            ))}
                        </select>
                      </label>
                      <NanoLabsButton type="submit" size="small" disabled={busy}>
                        Aplicar estado
                      </NanoLabsButton>
                    </div>
                  </form>

                  {/* Plan y fechas */}
                  <form
                    className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      submit("subscription.update", {
                        ...base(),
                        planId: f.get("planId"),
                        start: toIso(f.get("start")),
                        end: toIso(f.get("end")),
                        status: f.get("status"),
                        ...(catalog.trialDates
                          ? { trialEndsAt: f.get("trialEndsAt") ? toIso(f.get("trialEndsAt")) : null }
                          : {}),
                      });
                    }}
                  >
                    <h4 className="text-sm font-bold">Plan y período</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-xs">
                        <span className="text-slate-500">Plan</span>
                        <select name="planId" defaultValue={tenant.subscription?.planId || ""} required className="bh-select">
                          <option value="" disabled>
                            Elegir plan
                          </option>
                          {plans
                            .filter((pl) => pl.active || pl.id === tenant.subscription?.planId)
                            .map((pl) => (
                              <option key={pl.id} value={pl.id}>
                                {pl.name} · {money(pl.priceCents, pl.currency)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-slate-500">Estado</span>
                        <select name="status" defaultValue={tenant.status} className="bh-select">
                          {Object.entries(STATES_LABEL)
                            .filter(([k]) => (catalog.statuses ? catalog.statuses.includes(k) : k !== "PAST_DUE"))
                            .map(([k, lbl]) => (
                              <option key={k} value={k}>
                                {lbl}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-slate-500">Inicio</span>
                        <input
                          name="start"
                          type="datetime-local"
                          required
                          defaultValue={dateInput(tenant.subscription?.start || new Date().toISOString())}
                          className="bh-input"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-slate-500">Vencimiento</span>
                        <input
                          name="end"
                          type="datetime-local"
                          required
                          defaultValue={tenant.subscription ? dateInput(tenant.subscription.end) : ""}
                          className="bh-input"
                        />
                      </label>
                    </div>
                    <NanoLabsButton type="submit" size="small" disabled={busy}>
                      Guardar suscripción
                    </NanoLabsButton>
                  </form>

                  {/* Identidad */}
                  <form
                    className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      submit("tenant.update", {
                        ...base(),
                        name: f.get("name"),
                        slug: f.get("slug"),
                        ...Object.fromEntries((catalog.tenantFields || []).map((k) => [k, f.get(k) || null])),
                      });
                    }}
                  >
                    <h4 className="text-sm font-bold">Datos de la empresa</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-xs">
                        <span className="text-slate-500">Nombre</span>
                        <input name="name" defaultValue={tenant.name} required className="bh-input" />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-slate-500">Slug</span>
                        <input name="slug" defaultValue={tenant.slug} readOnly={catalog.immutableSlug} required className="bh-input" />
                      </label>
                      {catalog.tenantFields?.map((k) => (
                        <label key={k} className="space-y-1 text-xs">
                          <span className="text-slate-500 capitalize">{k}</span>
                          <input name={k} defaultValue={tenant.contact?.[k] || ""} className="bh-input" />
                        </label>
                      ))}
                    </div>
                    <NanoLabsButton type="submit" variant="secondary" size="small" disabled={busy}>
                      Actualizar datos
                    </NanoLabsButton>
                  </form>

                  {catalog.domainManagement && <OnlyCarsDomains tenant={tenant} submit={submit} />}
                </div>
              )}

              {tab === "modulos" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      Modificá los módulos o límites y guardá todos juntos en un solo clic.
                    </p>
                    <NanoLabsButton
                      size="small"
                      disabled={busy || dirtyModules.length === 0}
                      onClick={() => void saveAllModules()}
                    >
                      Guardar cambios ({dirtyModules.length})
                    </NanoLabsButton>
                  </div>

                  <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {Object.entries(tenant.modules).map(([key, value]) => {
                      const isBool = catalog.modules.includes(key);
                      const draft =
                        moduleDrafts[key] ??
                        (isBool
                          ? value.override === null
                            ? "inherit"
                            : value.override
                            ? "on"
                            : "off"
                          : typeof value.override === "number"
                          ? String(value.override)
                          : "");
                      return (
                        <div key={key} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold">{MODULE_LABELS[key] || key}</p>
                            <p className="text-[11px] text-slate-500">
                              Efectivo:{" "}
                              {typeof value.enabled === "boolean"
                                ? value.enabled
                                  ? "Habilitado"
                                  : "Deshabilitado"
                                : value.enabled}
                            </p>
                          </div>
                          {isBool ? (
                            <select
                              aria-label={MODULE_LABELS[key] || key}
                              value={draft}
                              onChange={(e) => setModuleDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                              className="bh-select !h-8 !w-44 text-xs"
                            >
                              <option value="inherit">Heredar del plan</option>
                              <option value="on">Habilitado</option>
                              <option value="off">Deshabilitado</option>
                            </select>
                          ) : (
                            <input
                              type="number"
                              min={1}
                              placeholder="Heredar"
                              value={draft}
                              onChange={(e) => setModuleDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                              className="bh-input !h-8 !w-28 text-xs"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === "pagos" && (
                <UnifiedSaaSPayments
                  productName={SAAS_PRODUCTS.find((p) => p.slug === product)?.name || product}
                  defaultCurrency={catalog.currency || "ARS"}
                  tenant={tenant}
                  plans={plans}
                  supportsStatusUpdate={catalog.operations.includes("payment.status")}
                  submit={submit}
                />
              )}

              {tab === "accesos" && (
                <div className="space-y-3">
                  {tenant.admins.map((admin) => (
                    <div key={admin.id} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                      <form
                        className="grid gap-3 sm:grid-cols-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          submit("admin.update", {
                            ...base(),
                            userId: admin.id,
                            name: f.get("name"),
                            ...(catalog.adminIdentity === "username"
                              ? { username: f.get("username") }
                              : { email: f.get("email") }),
                            ...(f.get("password") ? { password: f.get("password") } : {}),
                          });
                        }}
                      >
                        <div className="flex items-center justify-between sm:col-span-2">
                          <span className="text-xs font-bold">
                            {admin.role} · {admin.active ? "Activo" : "Inactivo"}
                          </span>
                          <NanoLabsButton
                            type="button"
                            variant="tertiary"
                            size="small"
                            disabled={busy}
                            onClick={() => submit("admin.revoke", { ...base(), userId: admin.id })}
                          >
                            Cerrar sesiones
                          </NanoLabsButton>
                        </div>
                        <label className="space-y-1 text-xs">
                          <span className="text-slate-500">Nombre</span>
                          <input name="name" defaultValue={admin.name} required className="bh-input" />
                        </label>
                        {catalog.adminIdentity === "username" ? (
                          <label className="space-y-1 text-xs">
                            <span className="text-slate-500">Usuario</span>
                            <input name="username" defaultValue={admin.username} required className="bh-input" />
                          </label>
                        ) : (
                          <label className="space-y-1 text-xs">
                            <span className="text-slate-500">Correo</span>
                            <input name="email" type="email" defaultValue={admin.email} required className="bh-input" />
                          </label>
                        )}
                        <label className="space-y-1 text-xs sm:col-span-2">
                          <span className="text-slate-500">Nueva contraseña (opcional, mín. 12 caracteres)</span>
                          <input name="password" type="password" autoComplete="new-password" className="bh-input" />
                        </label>
                        <div className="sm:col-span-2">
                          <NanoLabsButton type="submit" size="small" disabled={busy}>
                            Actualizar acceso
                          </NanoLabsButton>
                        </div>
                      </form>
                    </div>
                  ))}
                  {tenant.admins.length === 0 && (
                    <p className="text-xs text-slate-500">No hay administradores registrados.</p>
                  )}
                </div>
              )}
            </NanoLabsTabs>
          </>
        ) : null}
      </div>
    </NanoLabsModal>
  );
}
