"use client";
import { useState } from "react";
import type { ManagedPlan, ManagedTenant, ManagementOperation } from "@/lib/saas-management-types";

type Submit = (operation: ManagementOperation, input: Record<string, unknown>) => void;
const date = (value?: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
const display = (value?: string | null) => value ? new Date(value).toLocaleString("es-AR") : "—";
function Input({ name, label, type = "text", value, required = true }: { name: string; label: string; type?: string; value?: string; required?: boolean }) {
  return <label className="block space-y-1 text-xs text-slate-300"><span>{label}</span><input name={name} type={type} defaultValue={value} required={required} className="hub-field w-full" min={type === "number" ? "0.01" : undefined} step={type === "number" ? "0.01" : undefined}/></label>;
}
export function OnlyCarsPayments({ tenant, plans, submit }: { tenant: ManagedTenant; plans: ManagedPlan[]; submit: Submit }) {
  const [error, setError] = useState("");
  return <div className="space-y-4"><p className="hub-card p-4 text-sm text-slate-300">Se registra un pago recibido. Un período vigente activa la suscripción y aplica el plan indicado. Los períodos históricos o futuros conservan el acceso actual. Renovar desde Suscripción no registra un cobro.</p>
    <form className="hub-card grid gap-4 p-5 sm:grid-cols-2" onSubmit={e => {
      e.preventDefault(); setError(""); const f = new FormData(e.currentTarget);
      try {
        const start = new Date(String(f.get("start"))), end = new Date(String(f.get("end"))), amountCents = Math.round(Number(f.get("amount")) * 100);
        const currency = String(f.get("currency")).trim().toUpperCase();
        if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start || !Number.isSafeInteger(amountCents) || amountCents <= 0 || !/^[A-Z]{3}$/.test(currency)) throw Error();
        submit("payment.record", { tenantId: tenant.id, version: tenant.version, amountCents, currency, method: f.get("method"), reference: f.get("reference"), notes: f.get("notes") || "", start: start.toISOString(), end: end.toISOString(), paidAt: f.get("paidAt") ? new Date(String(f.get("paidAt"))).toISOString() : null, ...(f.get("planId") ? { planId: f.get("planId") } : {}) });
      } catch { setError("Revisá las fechas, el importe y el código de moneda."); }
    }}>
      <h4 className="font-semibold text-white sm:col-span-2">Registrar pago de OnlyCars</h4>
      {error && <p role="alert" className="text-sm text-amber-100 sm:col-span-2">{error}</p>}
      <Input name="amount" label="Importe recibido" type="number"/><Input name="currency" label="Moneda (código de tres letras)" value="USD"/>
      <Input name="method" label="Método de pago"/><Input name="reference" label="Referencia única"/>
      <Input name="start" label="Inicio del período facturado" type="datetime-local" value={date(tenant.subscription?.start)}/><Input name="end" label="Fin del período facturado" type="datetime-local" value={date(tenant.subscription?.end)}/>
      <Input name="paidAt" label="Fecha efectiva del pago (opcional)" type="datetime-local" required={false}/>
      <label className="block space-y-1 text-xs text-slate-300"><span>Plan para el período vigente</span><select name="planId" className="hub-field w-full" defaultValue={tenant.subscription?.planId || ""}><option value="">Conservar plan actual</option>{plans.filter(p => p.active || p.id === tenant.subscription?.planId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <Input name="notes" label="Notas" required={false}/><div><button className="hub-primary-action" type="submit">Registrar pago SaaS</button></div>
    </form>
    <div className="space-y-3">{tenant.payments.map(p => <div key={p.id} className="hub-card space-y-2 p-4"><h4 className="font-semibold text-white">{p.amountCents === null ? "Importe no informado" : new Intl.NumberFormat("es-AR", { style: "currency", currency: p.currency || "USD" }).format(p.amountCents / 100)} · {p.status === "PAID" ? "Pagado" : p.status}</h4><p className="text-xs text-slate-400">Referencia: {p.reference || "—"} · Método: {p.method} · Período: {display(p.start)} a {display(p.end)} · Pagado: {display(p.paidAt)}</p>{p.notes && <p className="text-xs text-slate-300">{p.notes}</p>}</div>)}</div>
    <p className="text-xs text-slate-400">Últimos 100 pagos de la plataforma. Las ventas, cuotas y préstamos del negocio conservan su gestión en OnlyCars.</p>
  </div>;
}
export function OnlyCarsDomains({ tenant, submit }: { tenant: ManagedTenant; submit: Submit }) {
  return <form className="hub-card space-y-4 p-5" onSubmit={e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    submit("domain.add", { tenantId: tenant.id, version: tenant.version, hostname: String(f.get("hostname")).trim().toLowerCase(), custom: f.has("custom"), primary: f.has("primary"), confirmOwnership: f.has("confirmOwnership") });
  }}><h4 className="font-semibold text-white">Agregar dominio de OnlyCars</h4><Input name="hostname" label="Nombre de dominio"/>
    <label className="flex gap-2 text-xs text-slate-300"><input name="custom" type="checkbox" defaultChecked/> Dominio personalizado</label>
    <label className="flex gap-2 text-xs text-slate-300"><input name="primary" type="checkbox"/> Usar como dominio principal</label>
    <label className="flex gap-2 text-xs text-slate-300"><input name="confirmOwnership" type="checkbox" required/> Confirmo que verifiqué la titularidad y la configuración DNS y HTTPS de este dominio para la empresa.</label>
    <p className="text-xs text-slate-400">La comprobación de titularidad es manual y queda auditada. Registrar el dominio no configura DNS ni emite un certificado. Se conservan los dominios existentes.</p>
    <button className="hub-primary-action" type="submit">Agregar dominio</button>
  </form>;
}
