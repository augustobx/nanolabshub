"use client";

import type { ManagedPlan, ManagedTenant, ManagementOperation } from "@/lib/saas-management-types";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  OVERDUE: "Vencido",
  REFUNDED: "Reembolsado",
  VOID: "Anulado",
};

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString("es-AR") : "—");

const formatMoney = (cents: number | null, currency = "ARS") =>
  cents === null ? "No informado" : new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(cents / 100);

const toIsoOrNull = (raw: FormDataEntryValue | null) => (raw ? new Date(String(raw)).toISOString() : null);

export function UnifiedSaaSPayments({
  productName,
  defaultCurrency = "ARS",
  tenant,
  plans,
  supportsStatusUpdate = true,
  submit,
}: {
  productName: string;
  defaultCurrency?: string;
  tenant: ManagedTenant;
  plans: ManagedPlan[];
  supportsStatusUpdate?: boolean;
  submit: (operation: ManagementOperation, input: Record<string, unknown>) => void;
}) {
  const base = () => ({ tenantId: tenant.id, version: tenant.version });

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 text-xs text-slate-600 dark:text-amber-100">
        Pagado activa la suscripción y aplica el período indicado. Vencido bloquea el acceso por deuda. Reembolsado y
        Anulado conservan el comprobante en auditoría sin eliminar historial.
      </p>

      <form
        className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const planId = String(f.get("planId") || "").trim();
          submit("payment.record", {
            ...base(),
            amountCents: Math.round(Number(f.get("amount")) * 100),
            currency: String(f.get("currency") || defaultCurrency).trim().toUpperCase(),
            status: String(f.get("status") || "PAID"),
            method: String(f.get("method") || "Transferencia"),
            reference: String(f.get("reference") || ""),
            notes: String(f.get("notes") || ""),
            start: toIsoOrNull(f.get("start")) || new Date().toISOString(),
            end: toIsoOrNull(f.get("end")) || new Date(Date.now() + 30 * 86400000).toISOString(),
            dueAt: toIsoOrNull(f.get("dueAt")),
            paidAt: toIsoOrNull(f.get("paidAt")),
            ...(planId ? { planId } : {}),
          });
        }}
      >
        <h4 className="text-sm font-bold sm:col-span-2">Registrar pago SaaS · {productName}</h4>

        <label className="space-y-1 text-xs">
          <span className="text-slate-500">Importe</span>
          <input name="amount" type="number" min={0.01} step="0.01" required className="bh-input" />
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-slate-500">Moneda</span>
          <select name="currency" defaultValue={defaultCurrency} className="bh-select">
            <option value="ARS">ARS (Pesos argentinos)</option>
            <option value="USD">USD (Dólares)</option>
          </select>
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-slate-500">Estado del pago</span>
          <select name="status" defaultValue="PAID" className="bh-select">
            {Object.entries(PAYMENT_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-slate-500">Método de pago</span>
          <input name="method" required defaultValue="Transferencia" className="bh-input" />
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-slate-500">Referencia única</span>
          <input name="reference" required placeholder="COMPROBANTE-001" className="bh-input" />
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-slate-500">Plan (opcional)</span>
          <select name="planId" defaultValue={tenant.subscription?.planId || ""} className="bh-select">
            <option value="">Conservar plan actual</option>
            {plans
              .filter((p) => p.active || p.id === tenant.subscription?.planId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-slate-500">Inicio período facturado</span>
          <input
            name="start"
            type="datetime-local"
            required
            defaultValue={toDateTimeLocal(tenant.subscription?.start || new Date().toISOString())}
            className="bh-input"
          />
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-slate-500">Fin período facturado</span>
          <input
            name="end"
            type="datetime-local"
            required
            defaultValue={toDateTimeLocal(
              tenant.subscription?.end || new Date(Date.now() + 30 * 86400000).toISOString()
            )}
            className="bh-input"
          />
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-slate-500">Vencimiento del pago (opcional)</span>
          <input name="dueAt" type="datetime-local" className="bh-input" />
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-slate-500">Fecha efectiva de cobro (opcional)</span>
          <input name="paidAt" type="datetime-local" className="bh-input" />
        </label>

        <label className="space-y-1 text-xs sm:col-span-2">
          <span className="text-slate-500">Notas administrativas</span>
          <input name="notes" placeholder="Observaciones del comprobante…" className="bh-input" />
        </label>

        <div className="sm:col-span-2">
          <button className="hub-primary-action" type="submit">
            Registrar pago SaaS
          </button>
        </div>
      </form>

      <div className="space-y-2.5">
        {tenant.payments.map((p) => (
          <div key={p.id} className="space-y-2.5 rounded-xl border border-slate-200 p-3.5 text-xs dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm">
                {formatMoney(p.amountCents, p.currency || defaultCurrency)} ·{" "}
                {PAYMENT_STATUS_LABELS[p.status] || p.status}
              </strong>
              <span className="ot-mono text-[11px] text-slate-500">{p.reference || "Sin referencia"}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Método: {p.method || "—"} · Período: {formatDate(p.start)} → {formatDate(p.end)} · Venc.:{" "}
              {formatDate(p.dueAt)} · Cobrado: {formatDate(p.paidAt || p.createdAt)}
            </p>
            {p.notes && <p className="text-xs text-slate-600 dark:text-slate-300">{p.notes}</p>}

            {supportsStatusUpdate && (
              <form
                className="grid gap-2 border-t border-slate-200 pt-2.5 sm:grid-cols-3 dark:border-slate-800"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const nextStatus = String(f.get("status"));
                  if (
                    window.confirm(
                      `Cambiar el pago ${p.reference || p.id} a ${PAYMENT_STATUS_LABELS[nextStatus] || nextStatus}. ¿Confirmás?`
                    )
                  ) {
                    submit("payment.status", {
                      ...base(),
                      paymentId: p.id,
                      status: nextStatus,
                      paidAt: toIsoOrNull(f.get("paidAt")),
                    });
                  }
                }}
              >
                <label className="space-y-1 text-[11px]">
                  <span className="text-slate-500">Estado</span>
                  <select name="status" defaultValue={p.status} className="bh-select !h-8 text-xs">
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-[11px]">
                  <span className="text-slate-500">Fecha efectiva</span>
                  <input
                    name="paidAt"
                    type="datetime-local"
                    defaultValue={toDateTimeLocal(p.paidAt)}
                    className="bh-input !h-8 text-xs"
                  />
                </label>
                <div className="flex items-end">
                  <button className="hub-secondary-action w-full justify-center !py-1.5 text-xs" type="submit">
                    Actualizar estado
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
        {tenant.payments.length === 0 && (
          <div className="rounded-xl border border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-800">
            Sin pagos SaaS registrados para este tenant.
          </div>
        )}
      </div>
    </div>
  );
}
