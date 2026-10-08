'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Loader2, Plus, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { canSeeCommerce } from '@/lib/admin-nav';
import type { AdminRole } from '@/lib/auth';
import {
  arrangementsApi, planAccessApi, rupees, fmtDate, PLAN_LABEL, type ArrangementRow, type GstReport, type PlanKey,
} from '@/lib/commerce';
import { ErrorBox, Field, Pill, cardCls, inputCls, msg, selectCls } from '@/components/admin/commerce-ui';

type Filter = 'all' | 'active' | 'expiring' | 'expired';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'active', label: 'In force' }, { key: 'expiring', label: 'Expiring in 30 days' }, { key: 'expired', label: 'Expired' },
];
const CHANNEL_LABEL: Record<string, string> = { UPI_QR: 'UPI QR', OFFLINE: 'Offline' };
const toInputDate = (iso: string): string => iso.slice(0, 10);
const endOfDayIso = (d: string): string => new Date(`${d}T23:59:59+05:30`).toISOString();

interface FormState { vendorId: string; allowHalfYear: boolean; gstMode: 'EXCLUSIVE' | 'NONE'; upi: boolean; offline: boolean; validUntil: string; reason: string }
const EMPTY: FormState = { vendorId: '', allowHalfYear: false, gstMode: 'EXCLUSIVE', upi: false, offline: false, validUntil: '', reason: '' };

/**
 * Admin > Pricing > Special arrangements. Standard rule for every client: annual, Razorpay only, GST 18% on top. This page is the ONLY way to
 * allow a half-year term, a manual QR / offline payment or GST not charged, for one client, with a reason and an end date. The server enforces
 * the same rules; nothing here is a UI-only switch.
 */
export default function SpecialArrangementsPage() {
  const { user, loading: authLoading } = useAuth();
  const adminRole: AdminRole = user?.adminRole ?? 'SUPER_ADMIN';
  const allowed = canSeeCommerce(adminRole);
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<ArrangementRow[]>([]);
  const [report, setReport] = useState<GstReport | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ id: string; businessName: string; subdomain: string | null }[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    arrangementsApi.list(filter).then((r) => setRows(r.data ?? [])).catch((e) => setError(msg(e)));
    arrangementsApi.gstReport().then((r) => setReport(r.data ?? null)).catch(() => undefined);
  }, [filter]);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);
  useEffect(() => {
    if (!allowed || q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => planAccessApi.vendors(q).then((r) => setHits(r.data ?? [])).catch(() => setHits([])), 250);
    return () => clearTimeout(t);
  }, [q, allowed]);

  if (authLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  if (!allowed) return <div role="alert" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">Your staff role does not include billing and payments. Ask a Super Admin if you need access.</div>;

  const body = () => ({
    allowHalfYear: form.allowHalfYear, gstMode: form.gstMode, allowedChannels: [form.upi && 'UPI_QR', form.offline && 'OFFLINE'].filter(Boolean) as string[],
    validUntil: form.validUntil ? endOfDayIso(form.validUntil) : '', reason: form.reason,
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      if (editing) await arrangementsApi.update(editing, body());
      else await arrangementsApi.create({ ...body(), vendorId: form.vendorId });
      setNotice(editing ? 'Arrangement updated and recorded in the audit log.' : 'Arrangement created and recorded in the audit log.');
      setForm(EMPTY); setEditing(null); setQ(''); load();
    } catch (err) { setError(msg(err)); } finally { setBusy(false); }
  }
  async function endIt(id: string) {
    const reason = window.prompt('Why is this arrangement ending? (at least 10 characters, kept in the audit log)') ?? '';
    if (!reason.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try { await arrangementsApi.end(id, reason.trim()); setNotice('Arrangement ended. The next invoice for this client goes back to annual, Razorpay, GST on top.'); load(); }
    catch (err) { setError(msg(err)); } finally { setBusy(false); }
  }
  function startEdit(a: ArrangementRow) {
    setEditing(a.id);
    setForm({ vendorId: a.vendorId, allowHalfYear: a.allowHalfYear, gstMode: a.gstMode, upi: a.allowedChannels.includes('UPI_QR'), offline: a.allowedChannels.includes('OFFLINE'), validUntil: toInputDate(a.validUntil), reason: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function csv() {
    if (!report) return;
    const lines = [['Month', 'Client', 'Invoices', 'GST not charged (INR)', 'of which already paid (INR)'], ...report.rows.map((r) => [r.month, r.businessName, String(r.invoices), (r.gstForgonePaise / 100).toFixed(2), (r.paidGstForgonePaise / 100).toFixed(2)]), ['Total', '', '', (report.totalPaise / 100).toFixed(2), (report.paidTotalPaise / 100).toFixed(2)]];
    const blob = new Blob([lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gst-not-collected.csv'; a.click(); URL.revokeObjectURL(a.href);
  }
  const stateTone = (s: ArrangementRow['state']) => (s === 'ACTIVE' ? 'ACTIVE' : s === 'EXPIRING' ? 'PENDING' : 'VOID');
  const formOk = (editing || form.vendorId) && form.validUntil && form.reason.trim().length >= 10 && (form.allowHalfYear || form.gstMode === 'NONE' || form.upi || form.offline);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/pricing" className="text-xs text-slate-400 hover:underline">← Pricing Manager</Link>
        <h1 className="mt-1 text-xl font-bold text-white">Special arrangements</h1>
        <p className="mt-1 text-sm text-slate-400">Standard for every client: annual plan, Razorpay only, GST 18% on top. Use this page to allow a half-year plan, manual QR / offline payment, or GST not charged for one client, with a reason and an end date. After the end date the next invoice goes back to the standard rule on its own.</p>
      </div>
      <ErrorBox message={error} />
      {notice && <div role="status" className="rounded-xl border border-success-500/30 bg-success-500/10 px-4 py-2.5 text-sm text-success-400">{notice}</div>}

      <form onSubmit={save} className={`${cardCls} space-y-4`}>
        <h2 className="text-sm font-bold text-white">{editing ? 'Edit arrangement' : 'New arrangement'}</h2>
        {!editing && (
          <div>
            <Field label="Client" hint="Search by business name or subdomain.">
              <div className="flex gap-2"><input className={inputCls} value={q} onChange={(e) => { setQ(e.target.value); setForm({ ...form, vendorId: '' }); }} placeholder="e.g. stepnrock" aria-label="Search clients" /><span className="flex items-center px-2 text-slate-500"><Search className="h-4 w-4" /></span></div>
            </Field>
            {hits.length > 0 && !form.vendorId && (
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">{hits.map((h) => <li key={h.id}><button type="button" className="w-full rounded-xl border border-slate-700 px-3 py-2 text-left text-sm text-slate-200 hover:border-primary-500" onClick={() => { setForm({ ...form, vendorId: h.id }); setQ(h.businessName); setHits([]); }}>{h.businessName} <span className="text-xs text-slate-500">{h.subdomain}</span></button></li>)}</ul>
            )}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" className="accent-primary-500" checked={form.allowHalfYear} onChange={(e) => setForm({ ...form, allowHalfYear: e.target.checked })} />Allow a half-year plan (Essentials or Pro)</label>
          <Field label="GST"><select className={selectCls} value={form.gstMode} onChange={(e) => setForm({ ...form, gstMode: e.target.value as 'EXCLUSIVE' | 'NONE' })}><option value="EXCLUSIVE">Standard: 18% on top</option><option value="NONE">GST not charged (max 6 months)</option></select></Field>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-200">
            <span className="text-xs font-semibold text-slate-400">Manual payment:</span>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-primary-500" checked={form.upi} onChange={(e) => setForm({ ...form, upi: e.target.checked })} />UPI QR</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-primary-500" checked={form.offline} onChange={(e) => setForm({ ...form, offline: e.target.checked })} />Offline</label>
          </div>
          <Field label="Ends on" hint="Required. The arrangement stops by itself on this date."><input type="date" className={inputCls} value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></Field>
        </div>
        <Field label={editing ? 'Reason for this change (required)' : 'Reason (required)'} hint="At least 10 characters. Kept in the audit log with your name."><input className={inputCls} maxLength={300} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
        <div className="flex gap-2">
          <Button type="submit" loading={busy} disabled={!formOk} leftIcon={<Plus className="h-4 w-4" />}>{editing ? 'Save changes' : 'Create arrangement'}</Button>
          {editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancel</Button>}
        </div>
      </form>

      <section className={cardCls}>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className={`rounded-xl px-3 py-1.5 text-sm font-medium ${filter === f.key ? 'bg-primary-600/20 text-primary-300' : 'text-slate-400 hover:bg-slate-800'}`}>{f.label}</button>)}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="text-xs text-slate-500"><tr><th className="py-2 pr-3">Client</th><th className="pr-3">Plan and term</th><th className="pr-3">GST</th><th className="pr-3">Channels</th><th className="pr-3">Reason</th><th className="pr-3">Ends</th><th className="pr-3">Set by</th><th>State</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-slate-500">No arrangements here.</td></tr>}
              {rows.map((a) => (
                <>
                  <tr key={a.id} className="border-t border-slate-800 text-slate-300">
                    <td className="py-2 pr-3"><Link className="text-primary-300 hover:underline" href={`/admin/customers/${a.vendorId}`}>{a.vendor?.businessName ?? a.vendorId}</Link></td>
                    <td className="pr-3">{a.plan ? `${PLAN_LABEL[a.plan.planKey as PlanKey] ?? a.plan.planKey} · ${a.plan.cycleMonths} months` : '—'}{a.allowHalfYear ? ' (half-year allowed)' : ''}</td>
                    <td className="pr-3">{a.gstMode === 'NONE' ? 'Not charged' : '18% on top'}</td>
                    <td className="pr-3">{['Razorpay', ...a.allowedChannels.map((c) => CHANNEL_LABEL[c] ?? c)].join(', ')}</td>
                    <td className="max-w-[16rem] pr-3 text-xs">{a.reason}</td>
                    <td className="pr-3">{fmtDate(a.validUntil)}</td>
                    <td className="pr-3 text-xs">{a.createdBy}<br />{fmtDate(a.createdAt)}</td>
                    <td><Pill value={stateTone(a.state)} label={a.state === 'EXPIRING' ? 'Expiring' : a.state === 'ACTIVE' ? 'In force' : a.state === 'EXPIRED' ? 'Expired' : 'Ended'} /></td>
                    <td className="space-x-2 whitespace-nowrap text-xs">
                      <button type="button" className="text-primary-300 hover:underline" onClick={() => setOpen(open === a.id ? null : a.id)}>History</button>
                      {(a.state === 'ACTIVE' || a.state === 'EXPIRING') && <><button type="button" className="text-primary-300 hover:underline" onClick={() => startEdit(a)}>Edit</button><button type="button" className="text-error-400 hover:underline" onClick={() => endIt(a.id)}>End</button></>}
                    </td>
                  </tr>
                  {open === a.id && (
                    <tr key={`${a.id}-h`} className="border-t border-slate-800 bg-slate-950/40"><td colSpan={9} className="px-3 py-3 text-xs text-slate-400">
                      {a.history.length === 0 ? 'No history.' : <ul className="space-y-1">{[...a.history].reverse().map((h, i) => <li key={i}>{fmtDate(h.at)} · {h.by} · <strong className="text-slate-200">{h.action}</strong>{h.reason ? ` — ${h.reason}` : ''}</li>)}</ul>}
                    </td></tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-sm font-bold text-white">GST not collected</h2><p className="text-xs text-slate-500">For the CA: the GST that invoices issued under an arrangement did not carry. Void invoices are left out.</p></div>
          <Button type="button" variant="outline" onClick={csv} disabled={!report || report.rows.length === 0} leftIcon={<Download className="h-4 w-4" />}>Download CSV</Button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="text-xs text-slate-500"><tr><th className="py-2 pr-3">Month</th><th className="pr-3">Client</th><th className="pr-3">Invoices</th><th className="pr-3">GST not charged</th><th>Already paid</th></tr></thead>
            <tbody>
              {(report?.rows ?? []).length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">No invoices without GST yet.</td></tr>}
              {(report?.rows ?? []).map((r) => <tr key={`${r.month}-${r.vendorId}`} className="border-t border-slate-800 text-slate-300"><td className="py-2 pr-3">{r.month}</td><td className="pr-3">{r.businessName}</td><td className="pr-3">{r.invoices}</td><td className="pr-3">{rupees(r.gstForgonePaise)}</td><td>{rupees(r.paidGstForgonePaise)}</td></tr>)}
              {report && report.rows.length > 0 && <tr className="border-t border-slate-700 font-semibold text-white"><td className="py-2 pr-3" colSpan={3}>Total</td><td className="pr-3">{rupees(report.totalPaise)}</td><td>{rupees(report.paidTotalPaise)}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
