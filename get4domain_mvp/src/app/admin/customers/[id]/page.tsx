'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import {
  commerceApi, rupees, fmtDate, CYCLE_LABEL, GST_LABEL, PLAN_LABEL,
  type Channel, type Cycle, type Entitlements, type GstMode, type InvoiceRow, type PlanKey, type TermRow,
} from '@/lib/commerce';
import { ErrorBox, Field, Pill, cardCls, inputCls, msg, selectCls } from '@/components/admin/commerce-ui';

interface VendorInfo { id: string; name: string; email: string; businessName: string; phone: string | null; industry: string | null; subdomain: string | null; status: string; isSandbox: boolean; createdAt: string }
interface BillingView { current: TermRow | null; history: TermRow[]; invoices: InvoiceRow[]; audit: { id: string; actor: string; actorRole: string | null; action: string; createdAt: string; detail: Record<string, unknown> | null }[]; entitlements: Entitlements | null; aiCredit: { targetPaise: number; computedPaise: number; grantedPaise: number } | null }
const CHANNELS: Channel[] = ['RAZORPAY', 'UPI_QR', 'OFFLINE'];
const STATUS_OPTS = ['ACTIVE', 'ACTIVE_PAYMENT_DUE', 'LAPSED', 'CANCELLED'] as const;

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [billing, setBilling] = useState<BillingView | null>(null);
  const [tab, setTab] = useState<'overview' | 'billing'>('billing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(false);
  const [sched, setSched] = useState(false);
  const [busy, setBusy] = useState(false);

  const [o, setO] = useState({ reason: '', planKey: '' as PlanKey | '', billingCycle: '' as Cycle | '', customMonths: '', netRupees: '', gstMode: '' as GstMode | '', graceDays: '', periodEnd: '', paymentDueAt: '', status: '' as string, channels: [] as Channel[] });
  const [s, setS] = useState({ planKey: 'BOS' as PlanKey, billingCycle: 'ANNUAL' as Cycle, customMonths: '3' });

  const load = useCallback(async () => {
    try {
      const [v, b] = await Promise.all([api.getVendor(id), commerceApi.vendorBilling(id)]);
      setVendor(v.data as VendorInfo); setBilling(b.data as BillingView); setError('');
    } catch (e) { setError(msg(e)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  function openEdit() {
    const c = billing?.current;
    setO({ reason: '', planKey: '', billingCycle: '', customMonths: '', netRupees: c ? String(c.netAmountPaise / 100) : '', gstMode: '', graceDays: c ? String(c.graceDays) : '', periodEnd: c?.periodEnd ? c.periodEnd.slice(0, 10) : '', paymentDueAt: c?.paymentDueAt ? c.paymentDueAt.slice(0, 10) : '', status: '', channels: c?.allowedChannels ?? [] });
    setAiOverride('');
    setEdit(true);
  }
  const [aiOverride, setAiOverride] = useState('');
  async function saveOverride() {
    setBusy(true); setError('');
    try {
      const c = billing?.current;
      const body: Record<string, unknown> = { reason: o.reason.trim() };
      if (o.planKey) body.planKey = o.planKey;
      if (o.billingCycle) body.billingCycle = o.billingCycle;
      if (o.billingCycle === 'CUSTOM_MONTHS' && o.customMonths) body.customMonths = Number(o.customMonths);
      if (o.netRupees !== '' && c && Math.round(Number(o.netRupees) * 100) !== c.netAmountPaise) body.netAmountPaise = Math.round(Number(o.netRupees) * 100);
      if (o.gstMode) body.gstMode = o.gstMode;
      if (o.graceDays !== '' && c && Number(o.graceDays) !== c.graceDays) body.graceDays = Number(o.graceDays);
      if (o.periodEnd && c && o.periodEnd !== c.periodEnd?.slice(0, 10)) body.periodEnd = new Date(`${o.periodEnd}T23:59:59`).toISOString();
      if (o.paymentDueAt && c && o.paymentDueAt !== c.paymentDueAt?.slice(0, 10)) body.paymentDueAt = new Date(`${o.paymentDueAt}T23:59:59`).toISOString();
      if (o.status) body.status = o.status;
      if (aiOverride.trim() !== '') body.aiCreditPaise = Math.round(Number(aiOverride) * 100);
      if (o.channels.length) body.allowedChannels = o.channels;
      await commerceApi.overrideTerm(id, body);
      setEdit(false); await load();
    } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }
  async function saveSchedule() {
    setBusy(true); setError('');
    try { await commerceApi.scheduleNext(id, { planKey: s.planKey, billingCycle: s.billingCycle, customMonths: s.billingCycle === 'CUSTOM_MONTHS' ? Number(s.customMonths) : undefined }); setSched(false); await load(); }
    catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }
  async function clearSchedule() {
    if (!window.confirm('Remove the scheduled plan change?')) return;
    try { await commerceApi.clearScheduled(id); await load(); } catch (e) { setError(msg(e)); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  const cur = billing?.current ?? null;
  const toggleCh = (c: Channel) => setO({ ...o, channels: o.channels.includes(c) ? o.channels.filter((x) => x !== c) : [...o.channels, c] });

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />All vendors</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">{vendor?.businessName ?? 'Vendor'}</h2>
          <p className="mt-0.5 text-sm text-slate-400">{vendor?.name} · {vendor?.email}{vendor?.phone ? ` · ${vendor.phone}` : ''}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">{vendor?.subdomain && <a className="inline-flex items-center gap-1 text-primary-300 hover:underline" href={`https://${vendor.subdomain}.get4domain.com`} target="_blank" rel="noopener noreferrer">{vendor.subdomain}.get4domain.com<ExternalLink className="h-3 w-3" /></a>}{vendor?.isSandbox && <Pill value="DEMO" label="Pre-sale / demo site" />}<span>since {fmtDate(vendor?.createdAt)}</span></div>
        </div>
        <Link href={`/admin/commerce/deals?vendor=${id}`}><Button size="sm">New deal / invoice</Button></Link>
      </div>

      <div className="flex gap-1 border-b border-slate-800">
        {(['billing', 'overview'] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? 'border-primary-500 text-primary-300' : 'border-transparent text-slate-400'}`}>{t === 'billing' ? 'Billing terms' : 'Overview'}</button>)}
      </div>
      <ErrorBox message={error} />

      {tab === 'overview' && vendor && (
        <div className={`${cardCls} grid gap-3 text-sm sm:grid-cols-2`}>
          {([['Industry', vendor.industry ?? '—'], ['Status', vendor.status], ['Business', vendor.businessName], ['Contact', vendor.name]] as const).map(([k, v]) => <div key={k}><div className="text-xs text-slate-500">{k}</div><div className="text-slate-200">{v}</div></div>)}
        </div>
      )}

      {tab === 'billing' && (
        <div className="space-y-6">
          {!cur ? (
            <div className={`${cardCls} text-center text-sm text-slate-400`}>This vendor has no billing term yet. <Link className="text-primary-300 underline" href={`/admin/commerce/deals?vendor=${id}`}>Create a deal</Link> to start one.</div>
          ) : (
            <section className={cardCls}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-white">{PLAN_LABEL[cur.planKey]} · {cur.billingCycle === 'CUSTOM_MONTHS' ? `${cur.cycleMonths} months` : CYCLE_LABEL[cur.billingCycle]}</h3><Pill value={cur.status} />{cur.source === 'ADMIN_DEAL' && <span className="rounded-full bg-primary-500/20 px-2 py-0.5 text-[11px] font-semibold text-primary-300">Negotiated deal</span>}</div>
                  <p className="mt-1 text-sm text-slate-400">{rupees(cur.netAmountPaise)} net{cur.discountPaise > 0 ? ` (list ${rupees(cur.listAmountPaise)}, ${rupees(cur.discountPaise)} off)` : ''} · {GST_LABEL[cur.gstMode]}</p>
                </div>
                <div className="flex gap-2"><Button size="sm" variant="outline" onClick={openEdit}>Edit / override</Button><Button size="sm" variant="outline" onClick={() => setSched(true)}>Schedule change</Button></div>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {([['Period', `${fmtDate(cur.periodStart)} → ${fmtDate(cur.periodEnd)}`], ['Grace after due', `${cur.graceDays} days`], ['Channels', cur.allowedChannels.join(' + ') || '—'], ['Payment due', cur.status === 'ACTIVE_PAYMENT_DUE' ? fmtDate(cur.paymentDueAt) : '—']] as const).map(([k, v]) => <div key={k} className="rounded-xl bg-slate-800 p-3"><div className="text-xs text-slate-500">{k}</div><div className="mt-0.5 font-medium text-white">{v}</div></div>)}
              </div>
              {cur.scheduledNextPlan && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary-500/30 bg-primary-500/10 px-3.5 py-2.5 text-sm text-primary-200"><span>At renewal this vendor moves to <strong>{PLAN_LABEL[cur.scheduledNextPlan]} · {cur.scheduledNextCycle ? CYCLE_LABEL[cur.scheduledNextCycle] : ''}</strong> (priced at list).</span><button type="button" className="text-xs font-semibold underline" onClick={clearSchedule}>Remove</button></div>}
              {billing?.entitlements && <p className="mt-3 text-xs text-slate-500">Entitlements (from the plan, not the price): {billing.aiCredit ? `AI Studio credit ${rupees(billing.aiCredit.targetPaise)} for this term (prorated default ${rupees(billing.aiCredit.computedPaise)}; ${rupees(billing.aiCredit.grantedPaise)} granted so far)` : `${rupees(billing.entitlements.aiCreditAnnualPaise)} annual AI credit`} · {billing.entitlements.seoKeywords} SEO keywords · {billing.entitlements.themeChangesPerYear} theme changes/yr{billing.entitlements.hrm ? ' · HRM, accounting, inventory, tasks, WhatsApp bot' : ''}.</p>}
            </section>
          )}

          <section className={cardCls}>
            <h3 className="mb-3 text-sm font-bold text-white">Invoices</h3>
            {(billing?.invoices ?? []).length === 0 ? <p className="text-sm text-slate-500">None.</p> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="text-xs text-slate-500"><th className="py-1.5 pr-3 font-medium">Number</th><th className="pr-3 font-medium">Type</th><th className="pr-3 font-medium">Total</th><th className="pr-3 font-medium">Created</th><th className="font-medium">Status</th></tr></thead>
                <tbody>{billing!.invoices.map((i) => <tr key={i.id} className="border-t border-slate-800 text-slate-300"><td className="py-2 pr-3 font-semibold text-white">{i.invoiceNumber}</td><td className="pr-3">{i.kind?.replace(/_/g, ' ').toLowerCase()}</td><td className="pr-3">{rupees(i.totalAmount)}</td><td className="pr-3">{fmtDate(i.createdAt)}</td><td><Pill value={i.status} /></td></tr>)}</tbody></table></div>
            )}
            <Link href={`/admin/commerce/invoices`} className="mt-3 inline-block text-xs font-semibold text-primary-300 hover:underline">Manage invoices →</Link>
          </section>

          <section className={cardCls}>
            <h3 className="mb-3 text-sm font-bold text-white">Term history</h3>
            {(billing?.history ?? []).length === 0 ? <p className="text-sm text-slate-500">No terms yet.</p> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="text-xs text-slate-500"><th className="py-1.5 pr-3 font-medium">Created</th><th className="pr-3 font-medium">Plan</th><th className="pr-3 font-medium">Net</th><th className="pr-3 font-medium">Period</th><th className="pr-3 font-medium">By</th><th className="font-medium">Status</th></tr></thead>
                <tbody>{billing!.history.map((t) => <tr key={t.id} className="border-t border-slate-800 text-slate-300"><td className="py-2 pr-3">{fmtDate(t.createdAt)}</td><td className="pr-3">{PLAN_LABEL[t.planKey]} · {CYCLE_LABEL[t.billingCycle]}</td><td className="pr-3">{rupees(t.netAmountPaise)}</td><td className="pr-3">{fmtDate(t.periodStart)} → {fmtDate(t.periodEnd)}</td><td className="pr-3 text-xs">{t.createdBy ?? '—'}</td><td>{t.isCurrent ? <Pill value={t.status} /> : <span className="text-xs text-slate-500">superseded</span>}</td></tr>)}</tbody></table></div>
            )}
          </section>

          <section className={cardCls}>
            <h3 className="mb-3 text-sm font-bold text-white">Audit trail</h3>
            {(billing?.audit ?? []).length === 0 ? <p className="text-sm text-slate-500">Nothing recorded yet.</p> : billing!.audit.map((a) => <div key={a.id} className="border-t border-slate-800 py-2 text-xs text-slate-400"><span className="font-semibold text-slate-200">{a.action}</span> · {a.actor}{a.actorRole ? ` (${a.actorRole})` : ''} · {fmtDate(a.createdAt)}{a.detail && 'reason' in a.detail ? ` — “${String(a.detail.reason)}”` : ''}</div>)}
          </section>
        </div>
      )}

      <Modal isOpen={edit} onClose={() => setEdit(false)} title="Edit / override billing term" maxWidth="max-w-xl" skin="dark">
        <div className="space-y-3">
          <p className="rounded-xl bg-slate-800 px-3.5 py-2.5 text-xs text-slate-300">This never edits history in place: the current term is retired and a new one is created, with your reason in the audit log. Change only what you need.</p>
          <Field label="Reason * (audit-logged)"><input className={inputCls} value={o.reason} onChange={(e) => setO({ ...o, reason: e.target.value })} maxLength={300} autoFocus /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Plan"><select className={selectCls} value={o.planKey} onChange={(e) => setO({ ...o, planKey: e.target.value as PlanKey | '' })}><option value="">Keep current</option><option value="WORKSPACE">Workspace</option><option value="BOS">BOS</option></select></Field>
            <Field label="Billing cycle"><select className={selectCls} value={o.billingCycle} onChange={(e) => setO({ ...o, billingCycle: e.target.value as Cycle | '' })}><option value="">Keep current</option>{(Object.keys(CYCLE_LABEL) as Cycle[]).map((c) => <option key={c} value={c}>{CYCLE_LABEL[c]}</option>)}</select></Field>
            {o.billingCycle === 'CUSTOM_MONTHS' && <Field label="Months"><input className={inputCls} inputMode="numeric" value={o.customMonths} onChange={(e) => setO({ ...o, customMonths: e.target.value.replace(/\D/g, '') })} /></Field>}
            <Field label="Net amount per term (₹)" hint="Used for renewals and proration."><input className={inputCls} inputMode="decimal" value={o.netRupees} onChange={(e) => setO({ ...o, netRupees: e.target.value.replace(/[^0-9.]/g, '') })} /></Field>
            <Field label="GST mode"><select className={selectCls} value={o.gstMode} onChange={(e) => setO({ ...o, gstMode: e.target.value as GstMode | '' })}><option value="">Keep current</option>{(Object.keys(GST_LABEL) as GstMode[]).map((g) => <option key={g} value={g}>{GST_LABEL[g]}</option>)}</select></Field>
            <Field label="AI Studio credit for this term (₹)" hint={`Leave empty to keep. ₹0–₹5,000. Raising it credits only the difference over what was already granted; lowering never claws back.${billing?.aiCredit ? ` Now ${rupees(billing.aiCredit.targetPaise)}.` : ''}`}><input className={inputCls} inputMode="decimal" value={aiOverride} onChange={(e) => setAiOverride(e.target.value.replace(/[^0-9.]/g, ''))} /></Field>
            <Field label="Grace days"><input className={inputCls} inputMode="numeric" value={o.graceDays} onChange={(e) => setO({ ...o, graceDays: e.target.value.replace(/\D/g, '') })} /></Field>
            <Field label="Term ends"><input type="date" className={inputCls} value={o.periodEnd} onChange={(e) => setO({ ...o, periodEnd: e.target.value })} /></Field>
            <Field label="Payment due (if awaiting)"><input type="date" className={inputCls} value={o.paymentDueAt} onChange={(e) => setO({ ...o, paymentDueAt: e.target.value })} /></Field>
            <Field label="Set status"><select className={selectCls} value={o.status} onChange={(e) => setO({ ...o, status: e.target.value })}><option value="">Keep current</option>{STATUS_OPTS.map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ').toLowerCase()}</option>)}</select></Field>
          </div>
          <div><span className="mb-1 block text-xs font-semibold text-slate-400">Allowed payment channels</span><div className="flex flex-wrap gap-3">{CHANNELS.map((c) => <label key={c} className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-primary-500" checked={o.channels.includes(c)} onChange={() => toggleCh(c)} />{c.replace('_', ' ')}</label>)}</div></div>
          <div className="flex justify-end gap-2 pt-1"><Button size="sm" variant="outline" onClick={() => setEdit(false)}>Cancel</Button><Button size="sm" loading={busy} disabled={o.reason.trim().length < 3} onClick={saveOverride}>Save override</Button></div>
        </div>
      </Modal>

      <Modal isOpen={sched} onClose={() => setSched(false)} title="Schedule a change for the next renewal" maxWidth="max-w-md" skin="dark">
        <div className="space-y-3">
          <p className="text-sm text-slate-300">The 15-day renewal invoice will use this plan and cycle at <strong>list price</strong>. Nothing changes until then.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Plan"><select className={selectCls} value={s.planKey} onChange={(e) => setS({ ...s, planKey: e.target.value as PlanKey })}><option value="WORKSPACE">Workspace</option><option value="BOS">BOS</option></select></Field>
            <Field label="Cycle"><select className={selectCls} value={s.billingCycle} onChange={(e) => setS({ ...s, billingCycle: e.target.value as Cycle })}>{(Object.keys(CYCLE_LABEL) as Cycle[]).map((c) => <option key={c} value={c}>{CYCLE_LABEL[c]}</option>)}</select></Field>
            {s.billingCycle === 'CUSTOM_MONTHS' && <Field label="Months"><input className={inputCls} inputMode="numeric" value={s.customMonths} onChange={(e) => setS({ ...s, customMonths: e.target.value.replace(/\D/g, '') })} /></Field>}
          </div>
          <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setSched(false)}>Cancel</Button><Button size="sm" loading={busy} onClick={saveSchedule}>Schedule</Button></div>
        </div>
      </Modal>
    </div>
  );
}
