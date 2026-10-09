'use client';

import { useState } from 'react';
import { FileText, Repeat } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { bos, dateShort, plain, rupees, useLoad, type Doc } from './client';
import { Alert, Empty, ErrorView, Field, Gate, Spinner, Stat, Tabs, csvDownload, downloadFile, inputCls, useTabParam } from './ui';
import { PeriodPicker, periods, type Period } from './Accounts';

interface Rec { id: string; templateId: string; frequency: string; nextRunOn: string; lastRunOn: string | null; endsOn: string | null; active: boolean }

/** Recurring billing (Pro): an issued invoice that repeats monthly, quarterly or yearly. Each run is made once; a downgrade pauses it and deletes nothing. */
export function Recurring() {
  return <Gate capabilityId="bos.recurring"><RecurringInner /></Gate>;
}
function RecurringInner() {
  const rec = useLoad(() => bos<Rec[]>('/bos/books/recurring'), []);
  const invs = useLoad(() => bos<{ rows: Doc[] }>('/bos/documents?docType=SALES_INVOICE&take=100'), []);
  const [f, setF] = useState({ templateId: '', frequency: 'MONTHLY', next: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) });
  const [err, setErr] = useState('');
  const issued = (invs.data?.rows ?? []).filter((d) => d.status !== 'DRAFT' && d.status !== 'CANCELLED' && d.partyId);
  const label = (id: string) => { const d = (invs.data?.rows ?? []).find((x) => x.id === id); return d ? `${d.number} · ${d.partyName}` : 'Invoice'; };
  async function add() { setErr(''); try { await bos('/bos/books/recurring', { method: 'POST', body: { templateId: f.templateId, frequency: f.frequency, nextRunOn: new Date(`${f.next}T09:00:00`).toISOString() } }); rec.reload(); } catch (e) { setErr(plain(e)); } }
  async function stop(id: string) { try { await bos(`/bos/books/recurring/${id}/stop`, { method: 'POST' }); rec.reload(); } catch (e) { setErr(plain(e)); } }
  if (rec.loading && !rec.data) return <Spinner />;
  if (rec.error) return <ErrorView error={rec.error} />;
  return (
    <div className="mx-auto max-w-4xl space-y-4 py-2">
      <div><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Repeat className="h-6 w-6 text-primary-600" /> Recurring billing</h1><p className="mt-1 text-sm text-slate-500">Choose an invoice you have already made and a repeat. A new invoice with the same items is issued on each date, and you are told who is overdue every morning.</p></div>
      <Card padded>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2"><Field label="Invoice to repeat"><select className={inputCls} value={f.templateId} onChange={(e) => setF({ ...f, templateId: e.target.value })}><option value="">Choose…</option>{issued.map((d) => <option key={d.id} value={d.id}>{d.number} · {d.partyName} · {rupees(d.totalPaise)}</option>)}</select></Field></div>
          <Field label="Repeat"><select className={inputCls} value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })}><option value="MONTHLY">Every month</option><option value="QUARTERLY">Every 3 months</option><option value="YEARLY">Every year</option></select></Field>
          <Field label="First new invoice on"><input type="date" className={inputCls} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
        </div>
        {err && <div className="mt-3"><Alert>{err}</Alert></div>}
        <div className="mt-3"><Button onClick={add} disabled={!f.templateId}>Start repeating</Button></div>
      </Card>
      {(rec.data?.length ?? 0) === 0 ? <Empty title="Nothing repeats yet">A customer on a monthly plan, a rent, a subscription: make the first invoice, then repeat it here.</Empty> : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
          {rec.data!.map((r) => <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><div className="font-semibold text-slate-900">{label(r.templateId)}</div><div className="text-xs text-slate-400">{r.frequency.toLowerCase()} · next {dateShort(r.nextRunOn)}{r.lastRunOn ? ` · last ${dateShort(r.lastRunOn)}` : ''}</div></div><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.active ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>{r.active ? 'Running' : 'Stopped'}</span>{r.active && <Button size="sm" variant="ghost" onClick={() => stop(r.id)}>Stop</Button>}</div>)}
        </div>
      )}
    </div>
  );
}

interface Gst {
  gstr1: { b2b: Bucket; b2c: Bucket; byRate: { rate: number; taxablePaise: number; taxPaise: number }[] };
  gstr3b: { outwardTaxablePaise: number; outwardNilPaise: number; outputTax: Tax; inputTaxCredit: Tax & { taxablePaise: number }; netPayablePaise: number };
}
interface Bucket { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; count: number }
interface Tax { cgstPaise: number; sgstPaise: number; igstPaise: number }
interface Hsn { hsn: string; gstRate: number; qty: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }

/** Accounts for the CA (Pro): GST tables, HSN summary, the one-file CA pack, and the period lock. Not a filing integration. */
export function CaAccounts() {
  return <Gate capabilityId="bos.ca-pack"><CaInner /></Gate>;
}
function CaInner() {
  const [tab, setTab] = useTabParam(['gst', 'hsn', 'pack', 'lock'], 'gst');
  const [period, setPeriod] = useState<Period>(periods()[0]);
  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><FileText className="h-6 w-6 text-primary-600" /> Accounts for the CA</h1><p className="mt-1 text-sm text-slate-500">GST tables in the shape your CA needs for GSTR-1 and GSTR-3B, built from the bills you have already made. This is a hand-over pack, not a filing.</p></div><PeriodPicker value={period} onChange={setPeriod} /></div>
      <Tabs active={tab} onChange={setTab} tabs={[{ key: 'gst', label: 'GST summary' }, { key: 'hsn', label: 'HSN summary' }, { key: 'pack', label: 'CA pack' }, { key: 'lock', label: 'Lock a month' }]} />
      {tab === 'gst' && <GstTables period={period} />}
      {tab === 'hsn' && <HsnTable period={period} />}
      {tab === 'pack' && <Pack period={period} />}
      {tab === 'lock' && <Lock />}
    </div>
  );
}

function GstTables({ period }: { period: Period }) {
  const g = useLoad(() => bos<Gst>(`/bos/books/gst-summary?from=${period.from}&to=${period.to}`), [period.key]);
  if (g.loading && !g.data) return <Spinner />;
  if (g.error) return <ErrorView error={g.error} />;
  const { gstr1, gstr3b } = g.data!;
  const row = (k: string, b: Bucket) => <tr key={k} className="border-t border-slate-50"><td className="px-3 py-2">{k}</td><td className="px-3 py-2 text-right">{b.count}</td><td className="px-3 py-2 text-right">{rupees(b.taxablePaise)}</td><td className="px-3 py-2 text-right">{rupees(b.cgstPaise)}</td><td className="px-3 py-2 text-right">{rupees(b.sgstPaise)}</td><td className="px-3 py-2 text-right">{rupees(b.igstPaise)}</td></tr>;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Outward sales (taxable)" value={rupees(gstr3b.outwardTaxablePaise)} />
        <Stat label="Tax on sales" value={rupees(gstr3b.outputTax.cgstPaise + gstr3b.outputTax.sgstPaise + gstr3b.outputTax.igstPaise)} />
        <Stat label="Tax you can claim back" value={rupees(gstr3b.inputTaxCredit.cgstPaise + gstr3b.inputTaxCredit.sgstPaise + gstr3b.inputTaxCredit.igstPaise)} tone="good" />
        <Stat label="Net GST to pay" value={rupees(gstr3b.netPayablePaise)} tone={gstr3b.netPayablePaise > 0 ? 'warn' : 'default'} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-sm"><caption className="px-3 pt-3 text-left text-sm font-bold">Sales, as GSTR-1 groups them</caption><thead className="text-left text-xs text-slate-500"><tr><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Bills</th><th className="px-3 py-2 text-right">Taxable</th><th className="px-3 py-2 text-right">CGST</th><th className="px-3 py-2 text-right">SGST</th><th className="px-3 py-2 text-right">IGST</th></tr></thead><tbody>{row('To businesses with a GSTIN (B2B)', gstr1.b2b)}{row('To consumers (B2C)', gstr1.b2c)}</tbody></table></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-sm"><caption className="px-3 pt-3 text-left text-sm font-bold">Sales by GST rate</caption><thead className="text-left text-xs text-slate-500"><tr><th className="px-3 py-2">Rate</th><th className="px-3 py-2 text-right">Taxable</th><th className="px-3 py-2 text-right">Tax</th></tr></thead><tbody>{gstr1.byRate.map((r) => <tr key={r.rate} className="border-t border-slate-50"><td className="px-3 py-2">{r.rate}%</td><td className="px-3 py-2 text-right">{rupees(r.taxablePaise)}</td><td className="px-3 py-2 text-right">{rupees(r.taxPaise)}</td></tr>)}</tbody></table></div>
      <Button variant="outline" onClick={() => csvDownload(`gst-summary-${period.from}-to-${period.to}.csv`, [['Section', 'Taxable', 'CGST', 'SGST', 'IGST'], ['B2B sales', gstr1.b2b.taxablePaise / 100, gstr1.b2b.cgstPaise / 100, gstr1.b2b.sgstPaise / 100, gstr1.b2b.igstPaise / 100], ['B2C sales', gstr1.b2c.taxablePaise / 100, gstr1.b2c.cgstPaise / 100, gstr1.b2c.sgstPaise / 100, gstr1.b2c.igstPaise / 100], ['Input tax credit', gstr3b.inputTaxCredit.taxablePaise / 100, gstr3b.inputTaxCredit.cgstPaise / 100, gstr3b.inputTaxCredit.sgstPaise / 100, gstr3b.inputTaxCredit.igstPaise / 100], ...gstr1.byRate.map((r): (string | number)[] => [`Rate ${r.rate}%`, r.taxablePaise / 100, r.taxPaise / 100, '', ''])])}>Download CSV</Button>
    </div>
  );
}

function HsnTable({ period }: { period: Period }) {
  const h = useLoad(() => bos<Hsn[]>(`/bos/books/hsn-summary?from=${period.from}&to=${period.to}`), [period.key]);
  if (h.loading && !h.data) return <Spinner />;
  if (h.error) return <ErrorView error={h.error} />;
  if ((h.data?.length ?? 0) === 0) return <Empty title="No sales in this period">The HSN summary groups your sales by HSN / SAC code and GST rate.</Empty>;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-3 py-2">HSN / SAC</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Quantity</th><th className="px-3 py-2 text-right">Taxable</th><th className="px-3 py-2 text-right">CGST</th><th className="px-3 py-2 text-right">SGST</th><th className="px-3 py-2 text-right">IGST</th></tr></thead>
        <tbody>{h.data!.map((r) => <tr key={`${r.hsn}-${r.gstRate}`} className="border-t border-slate-50"><td className="px-3 py-2">{r.hsn}</td><td className="px-3 py-2 text-right">{r.gstRate}%</td><td className="px-3 py-2 text-right">{r.qty}</td><td className="px-3 py-2 text-right">{rupees(r.taxablePaise)}</td><td className="px-3 py-2 text-right">{rupees(r.cgstPaise)}</td><td className="px-3 py-2 text-right">{rupees(r.sgstPaise)}</td><td className="px-3 py-2 text-right">{rupees(r.igstPaise)}</td></tr>)}</tbody></table></div>
      {h.data!.some((r) => r.hsn === '(none)') && <Alert tone="info">Some items have no HSN code. Add it under Stock, Cost / GST, so your CA does not have to.</Alert>}
      <Button variant="outline" onClick={() => csvDownload(`hsn-summary-${period.from}-to-${period.to}.csv`, [['HSN/SAC', 'Rate', 'Quantity', 'Taxable', 'CGST', 'SGST', 'IGST'], ...h.data!.map((r): (string | number)[] => [r.hsn, r.gstRate, r.qty, r.taxablePaise / 100, r.cgstPaise / 100, r.sgstPaise / 100, r.igstPaise / 100])])}>Download CSV</Button>
    </div>
  );
}

function Pack({ period }: { period: Period }) {
  const [kind, setKind] = useState<'month' | 'quarter' | 'fy'>('month');
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [fy, setFy] = useState(`${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`);
  const [quarter, setQuarter] = useState(`${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  void period;
  async function get(format: 'zip' | 'xlsx') {
    setErr(''); setBusy(true);
    const value = kind === 'month' ? month : kind === 'quarter' ? quarter : fy;
    try { await downloadFile(`/bos/books/ca-pack?kind=${kind}&value=${encodeURIComponent(value)}&format=${format}`, format === 'xlsx' ? 'accounts.xlsx' : 'ca-pack.zip'); } catch (e) { setErr(plain(e)); } finally { setBusy(false); }
  }
  return (
    <Card padded className="space-y-4">
      <p className="text-sm text-slate-600">One download for your CA: an Excel workbook with the sales and purchase registers, receipts, expenses, GST and HSN tables and the books, a printable summary, and a list of the bill photos you attached.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Period"><select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="month">A month</option><option value="quarter">A quarter</option><option value="fy">A financial year</option></select></Field>
        {kind === 'month' && <Field label="Month"><input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} /></Field>}
        {kind === 'quarter' && <Field label="Quarter (calendar)"><select className={inputCls} value={quarter} onChange={(e) => setQuarter(e.target.value)}>{[0, 1].flatMap((back) => [1, 2, 3, 4].map((q) => `${now.getFullYear() - back}-Q${q}`)).map((v) => <option key={v} value={v}>{v.replace('-Q', ' quarter ')}</option>)}</select></Field>}
        {kind === 'fy' && <Field label="Financial year"><select className={inputCls} value={fy} onChange={(e) => setFy(e.target.value)}>{[0, 1, 2].map((b) => { const s = fyStart - b; return `${String(s).slice(2)}-${String(s + 1).slice(2)}`; }).map((v) => <option key={v} value={v}>{v}</option>)}</select></Field>}
      </div>
      {err && <Alert>{err}</Alert>}
      <div className="flex gap-2"><Button loading={busy} onClick={() => get('zip')}>Download CA pack (zip)</Button><Button variant="outline" loading={busy} onClick={() => get('xlsx')}>Excel workbook only</Button></div>
    </Card>
  );
}

function Lock() {
  const s = useLoad(() => bos<{ lockedUntil: string | null }>('/bos/settings'), []);
  const [d, setD] = useState('');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  async function set(v: string | null) { setErr(''); setMsg(''); try { await bos('/bos/settings/lock', { method: 'PUT', body: { lockedUntil: v } }); setMsg(v ? 'Locked. Nothing dated up to then can be changed or added.' : 'Unlocked.'); s.reload(); } catch (e) { setErr(plain(e)); } }
  return (
    <Card padded className="space-y-3">
      <p className="text-sm text-slate-600">Once your CA has a month, lock it. Invoices, receipts and expenses dated up to the day you choose can no longer be added or changed. If something has to be fixed later, issue a credit note or an adjustment dated today.</p>
      <p className="text-sm">{s.data?.lockedUntil ? <>Locked up to <b>{dateShort(s.data.lockedUntil)}</b>.</> : 'Nothing is locked.'}</p>
      <div className="flex flex-wrap items-end gap-3"><Field label="Lock everything up to and including"><input type="date" className={inputCls} value={d} onChange={(e) => setD(e.target.value)} /></Field><Button onClick={() => set(d)} disabled={!d}>Lock</Button>{s.data?.lockedUntil && <Button variant="outline" onClick={() => set(null)}>Unlock</Button>}</div>
      {err && <Alert>{err}</Alert>}{msg && <Alert tone="ok">{msg}</Alert>}
    </Card>
  );
}
