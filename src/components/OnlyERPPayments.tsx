"use client";
import type { ManagedTenant, ManagementOperation } from '@/lib/saas-management-types';
export function OnlyERPPayments({ tenant, submit }: { tenant: ManagedTenant; submit: (operation: ManagementOperation, input: Record<string, unknown>) => void }) {
  const now = new Date();
  return <div className="space-y-4"><form className="hub-card grid gap-4 p-5 sm:grid-cols-2" onSubmit={e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    submit('payment.record', { tenantId: tenant.id, version: tenant.version, amountCents: Math.round(Number(f.get('amount')) * 100), currency: 'ARS', method: f.get('method'), reference: f.get('reference'), notes: f.get('notes') || '', month: Number(f.get('month')), year: Number(f.get('year')), dueAt: new Date(String(f.get('dueAt'))).toISOString(), paidAt: f.get('paidAt') ? new Date(String(f.get('paidAt'))).toISOString() : null, applySubscription: f.has('applySubscription') });
  }}><h4 className="font-semibold text-white sm:col-span-2">Registrar cobro SaaS de OnlyERP</h4>
    <label className="text-xs text-slate-300">Importe en pesos argentinos<input className="hub-field w-full" name="amount" type="number" min="0.01" step="0.01" required/></label>
    <label className="text-xs text-slate-300">Método de pago<input className="hub-field w-full" name="method" required/></label>
    <label className="text-xs text-slate-300">Referencia única<input className="hub-field w-full" name="reference" required/></label>
    <label className="text-xs text-slate-300">Mes facturado<input className="hub-field w-full" name="month" type="number" min="1" max="12" defaultValue={now.getMonth() + 1} required/></label>
    <label className="text-xs text-slate-300">Año facturado<input className="hub-field w-full" name="year" type="number" min="2000" max="2100" defaultValue={now.getFullYear()} required/></label>
    <label className="text-xs text-slate-300">Vencimiento del período<input className="hub-field w-full" name="dueAt" type="datetime-local" required/></label>
    <label className="text-xs text-slate-300">Fecha del cobro (opcional)<input className="hub-field w-full" name="paidAt" type="datetime-local"/></label>
    <label className="text-xs text-slate-300">Notas<input className="hub-field w-full" name="notes"/></label>
    <label className="text-xs text-slate-300 sm:col-span-2"><input name="applySubscription" type="checkbox"/> Aplicar vencimiento a la membresía vigente. Solo mes actual; conserva el estado y no acorta el período.</label>
    <p className="text-xs text-slate-400 sm:col-span-2">Registrar un cobro conserva el acceso por defecto. La renovación y reactivación se administran desde Suscripción. Los pagos comerciales de clientes permanecen en OnlyERP.</p>
    <button className="hub-primary-action" type="submit">Registrar pago SaaS</button>
  </form><div className="hub-card overflow-x-auto"><table className="min-w-[600px] w-full text-left text-xs"><thead><tr><th>Período</th><th>Importe ARS</th><th>Estado</th><th>Referencia</th><th>Fecha del cobro</th></tr></thead><tbody>{tenant.payments.map(p => <tr key={p.id}><td>{p.month}/{p.year}</td><td>{p.amountCents === null ? 'No informado' : (p.amountCents / 100).toLocaleString('es-AR')}</td><td>{p.status}</td><td>{p.reference}</td><td>{p.paidAt ? new Date(p.paidAt).toLocaleString('es-AR') : '—'}</td></tr>)}</tbody></table></div></div>;
}
