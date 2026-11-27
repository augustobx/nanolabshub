"use client";

import { useCallback, useEffect, useState } from "react";
import type { IndependentContract, IndependentPayment } from "@/lib/types";
import { Cargando, NanoLabsAlert, NanoLabsButton, NanoLabsChip, NanoLabsModal, NanoLabsTabs, useToast } from "./nanolabs";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  TRIAL: "En prueba",
  PAST_DUE: "Vencido por deuda",
  SUSPENDED: "Suspendido",
  CANCELED: "Cancelado",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  OVERDUE: "Vencido",
  REFUNDED: "Reembolsado",
  VOID: "Anulado",
};

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const money = (cents: number, currency = "ARS") =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(cents / 100);

export function IndependentAppDrawer({
  open,
  onClose,
  slug,
  initialTab = "resumen",
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  initialTab?: "resumen" | "pagos" | "historial";
  onUpdated: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"resumen" | "pagos" | "historial">(initialTab);
  const [contract, setContract] = useState<IndependentContract | null>(null);
  const [payments, setPayments] = useState<IndependentPayment[]>([]);
  const [audit, setAudit] = useState<Array<{ id: string; actor: string; action: string; details: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, slug]);

  const loadDetail = useCallback(async () => {
    if (!open || !slug) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/independent-billing?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "No se pudo cargar la aplicación.");
      setContract(json.data.contract);
      setPayments(json.data.payments || []);
      setAudit(json.data.audit || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando contrato.");
    } finally {
      setLoading(false);
    }
  }, [open, slug]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const sendOp = async (operation: string, input: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/independent-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), operation, input: { slug, ...input } }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "No se pudo guardar.");
      toast("Contrato actualizado y auditado.", "ok");
      await loadDetail();
      onUpdated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al guardar.";
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <NanoLabsModal
      open={open}
      onClose={onClose}
      type="right"
      title={contract?.appName || "App independiente"}
      subtitle={contract ? `${contract.domain} · Circuito NanoLabs` : "Cargando…"}
    >
      <div className="space-y-4">
        {error && <NanoLabsAlert severity="error" title="Atención" description={error} />}

        {loading && !contract ? (
          <Cargando texto="Cargando ficha del contrato…" />
        ) : contract ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <NanoLabsChip
                    severity={
                      contract.status === "ACTIVE"
                        ? "success"
                        : contract.status === "TRIAL"
                        ? "info"
                        : contract.status === "PAST_DUE"
                        ? "danger"
                        : "warning"
                    }
                  >
                    {STATUS_LABELS[contract.status] || contract.status}
                  </NanoLabsChip>
                  <span className="font-semibold">
                    {contract.planName} · {money(contract.priceCents, contract.currency)}
                  </span>
                </div>
                <p className="text-slate-500">Vencimiento: {new Date(contract.periodEnd).toLocaleDateString("es-AR")}</p>
              </div>
              <NanoLabsButton size="small" disabled={busy} onClick={() => void sendOp("contract.renew", { days: 30 })}>
                +30 días
              </NanoLabsButton>
            </div>

            <NanoLabsTabs
              idBase="independent-drawer"
              activa={tab}
              onCambiar={setTab}
              tabs={[
                { id: "resumen", label: "Plan y Fechas" },
                { id: "pagos", label: "Pagos" },
                { id: "historial", label: "Auditoría" },
              ]}
            >
              {tab === "resumen" && (
                <form
                  className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void sendOp("contract.update", {
                      clientName: f.get("clientName"),
                      contactEmail: f.get("contactEmail"),
                      contactPhone: f.get("contactPhone"),
                      status: f.get("status"),
                      planName: f.get("planName"),
                      billingCycle: f.get("billingCycle"),
                      priceCents: Math.round(Number(f.get("price") || 0) * 100),
                      currency: f.get("currency"),
                      periodStart: new Date(String(f.get("periodStart"))).toISOString(),
                      periodEnd: new Date(String(f.get("periodEnd"))).toISOString(),
                      notes: f.get("notes") || "",
                    });
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Cliente / Titular</span>
                      <input name="clientName" defaultValue={contract.clientName} required className="bh-input" />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Estado</span>
                      <select name="status" defaultValue={contract.status} className="bh-select">
                        {Object.entries(STATUS_LABELS).map(([k, lbl]) => (
                          <option key={k} value={k}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Plan / Abono</span>
                      <input name="planName" defaultValue={contract.planName} required className="bh-input" />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Ciclo</span>
                      <select name="billingCycle" defaultValue={contract.billingCycle} className="bh-select">
                        <option value="MONTHLY">Mensual</option>
                        <option value="QUARTERLY">Trimestral</option>
                        <option value="ANNUAL">Anual</option>
                        <option value="CUSTOM">Personalizado</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Importe abono</span>
                      <input
                        name="price"
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={contract.priceCents / 100}
                        className="bh-input"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Moneda</span>
                      <select name="currency" defaultValue={contract.currency} className="bh-select">
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Inicio período</span>
                      <input
                        name="periodStart"
                        type="datetime-local"
                        required
                        defaultValue={toDateTimeLocal(contract.periodStart)}
                        className="bh-input"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Vencimiento</span>
                      <input
                        name="periodEnd"
                        type="datetime-local"
                        required
                        defaultValue={toDateTimeLocal(contract.periodEnd)}
                        className="bh-input"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Email contacto</span>
                      <input name="contactEmail" type="email" defaultValue={contract.contactEmail} className="bh-input" />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Teléfono</span>
                      <input name="contactPhone" defaultValue={contract.contactPhone} className="bh-input" />
                    </label>
                    <label className="space-y-1 text-xs sm:col-span-2">
                      <span className="text-slate-500">Notas</span>
                      <input name="notes" defaultValue={contract.notes} className="bh-input" />
                    </label>
                  </div>
                  <NanoLabsButton type="submit" size="small" disabled={busy}>
                    Guardar contrato
                  </NanoLabsButton>
                </form>
              )}

              {tab === "pagos" && (
                <div className="space-y-4">
                  <form
                    className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-800"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void sendOp("payment.record", {
                        amountCents: Math.round(Number(f.get("amount")) * 100),
                        currency: String(f.get("currency") || contract.currency),
                        status: String(f.get("status") || "PAID"),
                        method: String(f.get("method") || "Transferencia"),
                        reference: String(f.get("reference") || ""),
                        notes: String(f.get("notes") || ""),
                        start: new Date(String(f.get("start"))).toISOString(),
                        end: new Date(String(f.get("end"))).toISOString(),
                        dueAt: f.get("dueAt") ? new Date(String(f.get("dueAt"))).toISOString() : null,
                        paidAt: f.get("paidAt") ? new Date(String(f.get("paidAt"))).toISOString() : null,
                      });
                    }}
                  >
                    <h4 className="text-sm font-bold sm:col-span-2">Registrar cobro · {contract.appName}</h4>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Importe</span>
                      <input
                        name="amount"
                        type="number"
                        min={0.01}
                        step="0.01"
                        required
                        defaultValue={contract.priceCents > 0 ? contract.priceCents / 100 : undefined}
                        className="bh-input"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Moneda</span>
                      <select name="currency" defaultValue={contract.currency} className="bh-select">
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Estado</span>
                      <select name="status" defaultValue="PAID" className="bh-select">
                        {Object.entries(PAYMENT_STATUS_LABELS).map(([k, lbl]) => (
                          <option key={k} value={k}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Método</span>
                      <input name="method" defaultValue="Transferencia" required className="bh-input" />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Referencia</span>
                      <input name="reference" required className="bh-input" />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Notas</span>
                      <input name="notes" className="bh-input" />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Inicio período</span>
                      <input
                        name="start"
                        type="datetime-local"
                        required
                        defaultValue={toDateTimeLocal(contract.periodStart)}
                        className="bh-input"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Fin período</span>
                      <input
                        name="end"
                        type="datetime-local"
                        required
                        defaultValue={toDateTimeLocal(new Date(Date.now() + 30 * 86400000).toISOString())}
                        className="bh-input"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <NanoLabsButton type="submit" size="small" disabled={busy}>
                        Registrar cobro
                      </NanoLabsButton>
                    </div>
                  </form>

                  <div className="space-y-2.5">
                    {payments.map((p) => (
                      <div key={p.id} className="space-y-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>
                            {money(p.amountCents, p.currency)} · {PAYMENT_STATUS_LABELS[p.status] || p.status}
                          </strong>
                          <span className="ot-mono text-[11px] text-slate-500">{p.reference}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {p.method} · {new Date(p.periodStart).toLocaleDateString("es-AR")} →{" "}
                          {new Date(p.periodEnd).toLocaleDateString("es-AR")}
                        </p>
                        <form
                          className="flex flex-wrap items-center gap-2 pt-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void sendOp("payment.status", { paymentId: p.id, status: f.get("status") });
                          }}
                        >
                          <select name="status" defaultValue={p.status} className="bh-select !h-8 !w-40 text-xs">
                            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, lbl]) => (
                              <option key={k} value={k}>
                                {lbl}
                              </option>
                            ))}
                          </select>
                          <NanoLabsButton type="submit" size="small" variant="secondary" disabled={busy}>
                            Cambiar estado
                          </NanoLabsButton>
                        </form>
                      </div>
                    ))}
                    {payments.length === 0 && (
                      <p className="text-center text-xs text-slate-500">Sin cobros registrados.</p>
                    )}
                  </div>
                </div>
              )}

              {tab === "historial" && (
                <div className="space-y-2">
                  {audit.map((ev) => (
                    <div key={ev.id} className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="ot-mono font-bold">{ev.action}</span>
                        <span className="text-[11px] text-slate-500">{new Date(ev.created_at).toLocaleString("es-AR")}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">Actor: {ev.actor}</p>
                    </div>
                  ))}
                  {audit.length === 0 && <p className="text-xs text-slate-500">Sin movimientos registrados.</p>}
                </div>
              )}
            </NanoLabsTabs>
          </>
        ) : null}
      </div>
    </NanoLabsModal>
  );
}
