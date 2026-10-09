'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { api } from '@/lib/api';
import { bos, dateShort, plain, rupees, useLoad } from './client';
import { Alert, Empty, ErrorView, Field, Gate, Spinner, Stat, Tabs, allowed, csvDownload, inputCls, useEntitlements, useTabParam } from './ui';

const LegacyAccounts = dynamic(() => import('@/app/dashboard/accounts/page'), { loading: () => <Spinner /> });

export interface Period { key: string; label: string; from: string; to: string }

const ymd = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Common periods for every report. A financial year runs from 1 April. */
export function periods(now = new Date()): Period[] {
  const y = now.getFullYear(); const m = now.getMonth();
  const fyStart = m >= 3 ? y : y - 1;
  const q = Math.floor(((m + 9) % 12) / 3); // quarters of the financial year: Apr-Jun = 0
  const qStartMonth = (3 + q * 3) % 12; const qYear = qStartMonth > m ? y - 1 : y;
  return [
    { key: 'month', label: 'This month', from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) },
    { key: 'last-month', label: 'Last month', from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) },
    { key: 'quarter', label: 'This quarter', from: ymd(new Date(qYear, qStartMonth, 1)), to: ymd(new Date(qYear, qStartMonth + 3, 0)) },
    { key: 'fy', label: `Financial year ${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`, from: ymd(new Date(fyStart, 3, 1)), to: ymd(new Date(fyStart + 1, 2, 31)) },
  ];
}

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const list = useMemo(() => periods(), []);
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
      {list.map((p) => <button key={p.key} onClick={() => onChange(p)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${value.key === p.key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`}>{p.label}</button>)}
    </div>
  );
}

/** Accounts: the same numbers as Home. Essentials gets the totals and the expense list; Pro adds the full books. */
export default function Accounts() {
  const [tab, setTab] = useTabParam(['summary', 'expenses', 'books', 'more'], 'summary');
  const [period, setPeriod] = useState<Period>(periods()[0]);
  const ent = useEntitlements();
  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Calculator className="h-6 w-6 text-primary-600" /> Accounts</h1><p className="mt-1 text-sm text-slate-500">What you sold, what you received, what you spent, and what is still to come in. All of it comes from your invoices, receipts and expenses; nothing is typed twice.</p></div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[{ key: 'summary', label: 'Summary' }, { key: 'expenses', label: 'Expenses' }, { key: 'books', label: 'Books', locked: !allowed(ent, 'bos.books') }, { key: 'more', label: 'Industry view and GST filing' }]} />
      {tab === 'summary' && <Summary period={period} />}
      {tab === 'expenses' && <Expenses period={period} />}
      {tab === 'books' && <Gate capabilityId="bos.books"><Books period={period} /></Gate>}
      {tab === 'more' && <LegacyAccounts />}
    </div>
  );
}

interface Sum { invoices: number; salesPaise: number; salesExTaxPaise: number; gstCollectedPaise: number; receivedPaise: number; expensesPaise: number; outstandingPaise: number; outstandingInvoices: number }
interface RegRow { date: string; number: string; type: string; status: string; party: string | null; gstin: string | null; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number }

function Summary({ period }: { period: Period }) {
  const qs = `?from=${period.from}&to=${period.to}`;
  const sum = useLoad(() => bos<Sum>(`/bos/reports/summary${qs}`), [period.key]);
  const reg = useLoad(() => bos<RegRow[]>(`/bos/reports/sales-register${qs}`), [period.key]);
  if (sum.loading && !sum.data) return <Spinner />;
  if (sum.error) return <ErrorView error={sum.error} />;
  const s = sum.data!;
  const empty = s.invoices === 0 && s.expensesPaise === 0 && s.receivedPaise === 0 && s.outstandingPaise === 0;
  return (
    <div className="space-y-4">
      {empty && <Empty title="Nothing recorded in this period yet">Make an invoice, take a payment at the counter or record an expense, and the totals appear here straight away.</Empty>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Sales" value={rupees(s.salesPaise)} hint={`${s.invoices} invoice${s.invoices === 1 ? '' : 's'}, after returns`} />
        <Stat label="Received" value={rupees(s.receivedPaise)} tone="good" />
        <Stat label="Still to come in" value={rupees(s.outstandingPaise)} tone={s.outstandingPaise ? 'warn' : 'default'} hint={`${s.outstandingInvoices} unpaid invoice${s.outstandingInvoices === 1 ? '' : 's'} (all time)`} />
        <Stat label="GST collected" value={rupees(s.gstCollectedPaise)} />
        <Stat label="Expenses" value={rupees(s.expensesPaise)} />
        <Stat label="Sales before tax minus expenses" value={rupees(s.salesExTaxPaise - s.expensesPaise)} hint="A quick view. Full profit and loss is in Books." tone={s.salesExTaxPaise - s.expensesPaise < 0 ? 'warn' : 'good'} />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-900">Sales register</h2>
          {reg.data && reg.data.length > 0 && <Button size="sm" variant="outline" onClick={() => csvDownload(`sales-register-${period.from}-to-${period.to}.csv`, [['Date', 'Number', 'Type', 'Status', 'Customer', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'], ...reg.data!.map((r) => [dateShort(r.date), r.number, r.type, r.status, r.party ?? '', r.gstin ?? '', r.taxablePaise / 100, r.cgstPaise / 100, r.sgstPaise / 100, r.igstPaise / 100, r.totalPaise / 100])])}>Download CSV</Button>}</div>
        {reg.loading && !reg.data ? <Spinner /> : (reg.data?.length ?? 0) === 0 ? null : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Number</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2 text-right">Taxable</th><th className="px-3 py-2 text-right">GST</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
            <tbody>{reg.data!.map((r) => <tr key={r.number + r.date} className="border-t border-slate-50"><td className="px-3 py-2">{dateShort(r.date)}</td><td className="px-3 py-2">{r.number}{r.type === 'CREDIT_NOTE' && <span className="ml-1 text-xs text-slate-400">credit</span>}</td><td className="px-3 py-2">{r.party ?? 'Walk-in'}</td><td className="px-3 py-2 text-right">{rupees(r.taxablePaise)}</td><td className="px-3 py-2 text-right">{rupees(r.cgstPaise + r.sgstPaise + r.igstPaise)}</td><td className="px-3 py-2 text-right font-semibold">{rupees(r.totalPaise)}</td></tr>)}</tbody></table></div>
        )}
      </div>
    </div>
  );
}

interface Expense { id: string; expenseDate: string; category: string; description: string; totalPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; paymentMode: string; status: string; attachment: string | null }
interface Head { code: string; name: string }

function Expenses({ period }: { period: Period }) {
  const { data, loading, error, reload } = useLoad(() => bos<Expense[] | { rows: Expense[] }>(`/bos/expenses?from=${period.from}&to=${period.to}`).then((r) => (Array.isArray(r) ? r : r.rows)), [period.key]);
  const heads = useLoad(() => bos<Head[]>('/bos/expense-heads'), []);
  const [f, setF] = useState({ category: '', description: '', amount: '', gstRate: '', includesGst: true, claim: false, mode: 'CASH', date: ymd(new Date()), attachment: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [up, setUp] = useState(false);
  const [cancelling, setCancelling] = useState<Expense | null>(null); const [why, setWhy] = useState('');
  const nameOf = (code: string) => heads.data?.find((h) => h.code === code)?.name ?? code;

  async function upload(file: File | undefined) {
    if (!file) return;
    setUp(true); setErr('');
    try { const r = await api.uploadImage(file); const url = r.data?.url; if (url) setF((x) => ({ ...x, attachment: url })); } catch (e) { setErr(plain(e, 'That picture could not be uploaded. Use a photo under 5 MB.')); } finally { setUp(false); }
  }
  async function save() {
    setErr(''); setBusy(true);
    try {
      await bos('/bos/expenses', { method: 'POST', body: { expenseDate: new Date(`${f.date}T12:00:00`).toISOString(), category: f.category, description: f.description.trim(), amount: Number(f.amount), ...(Number(f.gstRate) ? { gstRate: Number(f.gstRate), amountIncludesGst: f.includesGst, claimGst: f.claim } : {}), paymentMode: f.mode, ...(f.attachment ? { attachment: f.attachment } : {}), idempotencyKey: `ui-exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } });
      setF({ ...f, description: '', amount: '', attachment: '' }); reload();
    } catch (e) { setErr(plain(e, 'Choose what it was for, describe it and enter the amount.')); } finally { setBusy(false); }
  }
  async function cancel() {
    if (!cancelling) return;
    try { await bos(`/bos/expenses/${cancelling.id}/cancel`, { method: 'POST', body: { reason: why.trim() } }); setCancelling(null); setWhy(''); reload(); } catch (e) { setErr(plain(e)); }
  }

  const total = (data ?? []).filter((x) => x.status === 'ACTIVE').reduce((a, x) => a + x.totalPaise, 0);
  return (
    <div className="space-y-4">
      <Card padded>
        <h2 className="text-sm font-bold text-slate-900">Add an expense</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          <Field label="What was it for"><select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Choose…</option>{(heads.data ?? []).map((h) => <option key={h.code} value={h.code}>{h.name}</option>)}</select></Field>
          <div className="sm:col-span-2"><Field label="Details"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Shop rent for October" autoComplete="off" /></Field></div>
          <Field label="Amount paid ₹"><input className={inputCls} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} autoComplete="off" /></Field>
          <Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Paid by"><select className={inputCls} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK">Bank</option><option value="CARD">Card</option><option value="CHEQUE">Cheque</option></select></Field>
          <Field label="GST on it %" hint="Leave blank if none"><input className={inputCls} inputMode="decimal" value={f.gstRate} onChange={(e) => setF({ ...f, gstRate: e.target.value })} autoComplete="off" /></Field>
          <Field label="Bill photo"><input type="file" accept="image/*" capture="environment" className="block w-full text-xs" onChange={(e) => upload(e.target.files?.[0])} aria-label="Photo of the bill" />{up && <span className="text-xs text-slate-400">Uploading…</span>}{f.attachment && <span className="text-xs text-success-700">Photo added</span>}</Field>
        </div>
        {Number(f.gstRate) > 0 && <div className="mt-2 flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={f.includesGst} onChange={(e) => setF({ ...f, includesGst: e.target.checked })} /> The amount already includes the GST</label><label className="flex items-center gap-2"><input type="checkbox" checked={f.claim} onChange={(e) => setF({ ...f, claim: e.target.checked })} /> I can claim this GST back</label></div>}
        {err && <div className="mt-3"><Alert>{err}</Alert></div>}
        <div className="mt-3"><Button loading={busy} onClick={save} disabled={!f.category || f.description.trim().length < 2 || !(Number(f.amount) > 0)}>Save expense</Button></div>
      </Card>
      {loading && !data ? <Spinner /> : error ? <ErrorView error={error} /> : (data?.length ?? 0) === 0 ? <Empty title="No expenses in this period">Rent, salaries, electricity, transport: add them above and they are counted in your totals.</Empty> : (
        <>
          <div className="flex items-center justify-between text-sm"><span className="text-slate-500">{data!.length} entr{data!.length === 1 ? 'y' : 'ies'}</span><b>Total {rupees(total)}</b></div>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {data!.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1"><div className={`font-medium ${x.status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{x.description}</div><div className="text-xs text-slate-400">{nameOf(x.category)} · {dateShort(x.expenseDate)} · {x.paymentMode.toLowerCase()}{x.attachment ? <> · <a className="text-primary-600" href={x.attachment} target="_blank" rel="noopener noreferrer">bill photo</a></> : ''}</div></div>
                <b>{rupees(x.totalPaise)}</b>
                {x.status === 'ACTIVE' && <button className="text-xs font-semibold text-slate-400 hover:text-error-600" onClick={() => setCancelling(x)}>Cancel</button>}
              </div>
            ))}
          </div>
        </>
      )}
      {cancelling && (
        <Card padded className="space-y-2"><div className="text-sm font-semibold">Cancel &ldquo;{cancelling.description}&rdquo;?</div><p className="text-xs text-slate-500">It stays on record as cancelled; your totals are corrected.</p>
          <input className={inputCls} placeholder="Why? (a few words)" value={why} onChange={(e) => setWhy(e.target.value)} aria-label="Reason" autoComplete="off" />
          <div className="flex gap-2"><Button size="sm" onClick={cancel} disabled={why.trim().length < 3}>Cancel expense</Button><Button size="sm" variant="ghost" onClick={() => setCancelling(null)}>Keep it</Button></div></Card>
      )}
    </div>
  );
}

type Book = 'pl' | 'bs' | 'tb' | 'day' | 'ledger' | 'items';
function Books({ period }: { period: Period }) {
  const [book, setBook] = useState<Book>('pl');
  const [code, setCode] = useState('1000');
  const qs = `?from=${period.from}&to=${period.to}`;
  const to = `?to=${period.to}`;
  const pl = useLoad(() => (book === 'pl' ? bos<{ income: { name: string; amountPaise: number }[]; expenses: { name: string; amountPaise: number }[]; totalIncomePaise: number; totalExpensesPaise: number; grossProfitPaise: number; netProfitPaise: number }>(`/bos/books/profit-and-loss${qs}`) : Promise.resolve(null)), [book, period.key]);
  const bs = useLoad(() => (book === 'bs' ? bos<{ assets: { name: string; amountPaise: number }[]; liabilities: { name: string; amountPaise: number }[]; equity: { name: string; amountPaise: number }[]; totalAssetsPaise: number; totalLiabilitiesAndEquityPaise: number }>(`/bos/books/balance-sheet${to}`) : Promise.resolve(null)), [book, period.key]);
  const tb = useLoad(() => (book === 'tb' ? bos<{ rows: { code: string; name: string; debitPaise: number; creditPaise: number }[]; totalDebitPaise: number; totalCreditPaise: number }>(`/bos/books/trial-balance${to}`) : Promise.resolve(null)), [book, period.key]);
  const day = useLoad(() => (book === 'day' ? bos<{ id: string; date: string; memo: string | null; reversal: boolean; lines: { account: string; debitPaise: number; creditPaise: number }[] }[]>(`/bos/books/day-book${qs}`) : Promise.resolve(null)), [book, period.key]);
  const led = useLoad(() => (book === 'ledger' ? bos<{ account: { code: string; name: string }; openingPaise: number; rows: { date: string; memo: string | null; debitPaise: number; creditPaise: number; balancePaise: number }[]; closingPaise: number }>(`/bos/books/ledger/${code}${qs}`) : Promise.resolve(null)), [book, code, period.key]);
  const items = useLoad(() => (book === 'items' ? bos<{ name: string; qty: number; salesPaise: number; costPaise: number; profitPaise: number }[]>(`/bos/books/item-profit${qs}`) : Promise.resolve(null)), [book, period.key]);
  const accounts = useLoad(() => bos<{ rows: { code: string; name: string }[] }>(`/bos/books/trial-balance?to=${period.to}`), [period.key]);
  const Line = ({ k, v, bold }: { k: string; v: number; bold?: boolean }) => <div className={`flex justify-between py-1 ${bold ? 'border-t border-slate-200 font-bold' : ''}`}><span>{k}</span><span>{rupees(v)}</span></div>;
  const tabs: [Book, string][] = [['pl', 'Profit and loss'], ['bs', 'Balance sheet'], ['tb', 'Trial balance'], ['day', 'Day book'], ['ledger', 'Ledger'], ['items', 'Item-wise profit']];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">{tabs.map(([k, l]) => <button key={k} onClick={() => setBook(k)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${book === k ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`}>{l}</button>)}</div>
      {book === 'pl' && (pl.data ? <Card padded className="text-sm"><h3 className="mb-1 font-bold">Income</h3>{pl.data.income.map((x) => <Line key={x.name} k={x.name} v={x.amountPaise} />)}<Line k="Total income" v={pl.data.totalIncomePaise} bold /><h3 className="mb-1 mt-4 font-bold">Expenses</h3>{pl.data.expenses.map((x) => <Line key={x.name} k={x.name} v={x.amountPaise} />)}<Line k="Total expenses" v={pl.data.totalExpensesPaise} bold /><div className="mt-3 flex justify-between text-base font-bold"><span>Profit</span><span className={pl.data.netProfitPaise < 0 ? 'text-error-600' : 'text-success-700'}>{rupees(pl.data.netProfitPaise)}</span></div><p className="mt-1 text-xs text-slate-400">Gross profit (sales less cost of goods): {rupees(pl.data.grossProfitPaise)}</p></Card> : <Spinner />)}
      {book === 'bs' && (bs.data ? <Card padded className="grid gap-6 text-sm sm:grid-cols-2"><div><h3 className="mb-1 font-bold">What you have</h3>{bs.data.assets.map((x) => <Line key={x.name} k={x.name} v={x.amountPaise} />)}<Line k="Total" v={bs.data.totalAssetsPaise} bold /></div><div><h3 className="mb-1 font-bold">What you owe and your own money</h3>{[...bs.data.liabilities, ...bs.data.equity].map((x) => <Line key={x.name} k={x.name} v={x.amountPaise} />)}<Line k="Total" v={bs.data.totalLiabilitiesAndEquityPaise} bold /></div></Card> : <Spinner />)}
      {book === 'tb' && (tb.data ? <Card padded className="text-sm"><div className="grid grid-cols-12 gap-2 border-b border-slate-100 pb-1 text-xs text-slate-500"><span className="col-span-2">Code</span><span className="col-span-6">Account</span><span className="col-span-2 text-right">Debit</span><span className="col-span-2 text-right">Credit</span></div>{tb.data.rows.map((r) => <div key={r.code} className="grid grid-cols-12 gap-2 py-1"><span className="col-span-2 text-slate-400">{r.code}</span><span className="col-span-6">{r.name}</span><span className="col-span-2 text-right">{r.debitPaise ? rupees(r.debitPaise) : ''}</span><span className="col-span-2 text-right">{r.creditPaise ? rupees(r.creditPaise) : ''}</span></div>)}<div className="grid grid-cols-12 gap-2 border-t border-slate-200 pt-1 font-bold"><span className="col-span-8">Total</span><span className="col-span-2 text-right">{rupees(tb.data.totalDebitPaise)}</span><span className="col-span-2 text-right">{rupees(tb.data.totalCreditPaise)}</span></div></Card> : <Spinner />)}
      {book === 'day' && (day.data ? (day.data.length === 0 ? <Empty title="Nothing in this period" /> : <div className="space-y-2">{day.data.map((e) => <Card key={e.id} padded className="text-sm"><div className="flex justify-between"><b>{e.memo ?? 'Entry'}{e.reversal && <span className="ml-1 text-xs text-slate-400">(reversal)</span>}</b><span className="text-xs text-slate-400">{dateShort(e.date)}</span></div>{e.lines.map((l, i) => <div key={i} className="flex justify-between text-xs text-slate-600"><span>{l.account}</span><span>{l.debitPaise ? `Dr ${rupees(l.debitPaise)}` : `Cr ${rupees(l.creditPaise)}`}</span></div>)}</Card>)}</div>) : <Spinner />)}
      {book === 'ledger' && (<div className="space-y-3"><select className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} aria-label="Account">{(accounts.data?.rows ?? [{ code: '1000', name: 'Cash' }]).map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}</select>{led.data ? <Card padded className="text-sm"><div className="flex justify-between text-slate-500"><span>Opening</span><span>{rupees(led.data.openingPaise)}</span></div>{led.data.rows.map((r, i) => <div key={i} className="grid grid-cols-12 gap-2 py-1"><span className="col-span-2 text-xs text-slate-400">{dateShort(r.date)}</span><span className="col-span-4 truncate">{r.memo}</span><span className="col-span-2 text-right">{r.debitPaise ? rupees(r.debitPaise) : ''}</span><span className="col-span-2 text-right">{r.creditPaise ? rupees(r.creditPaise) : ''}</span><span className="col-span-2 text-right text-xs text-slate-500">{rupees(r.balancePaise)}</span></div>)}<div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-bold"><span>Closing</span><span>{rupees(led.data.closingPaise)}</span></div></Card> : <Spinner />}</div>)}
      {book === 'items' && (items.data ? (items.data.length === 0 ? <Empty title="No sales in this period" /> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Sold</th><th className="px-3 py-2 text-right">Sales</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-right">Profit</th></tr></thead><tbody>{items.data.map((r) => <tr key={r.name} className="border-t border-slate-50"><td className="px-3 py-2">{r.name}</td><td className="px-3 py-2 text-right">{r.qty}</td><td className="px-3 py-2 text-right">{rupees(r.salesPaise)}</td><td className="px-3 py-2 text-right">{rupees(r.costPaise)}</td><td className={`px-3 py-2 text-right font-semibold ${r.profitPaise < 0 ? 'text-error-600' : ''}`}>{rupees(r.profitPaise)}</td></tr>)}</tbody></table></div>) : <Spinner />)}
    </div>
  );
}
