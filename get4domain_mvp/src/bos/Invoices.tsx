'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileText, Plus, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import { bos, dateShort, rupees, useLoad, type Doc } from './client';
import { Empty, ErrorView, OneTimeNote, Spinner, Stat, StatusPill, Tabs, inputCls, useTabParam } from './ui';
import { CreditModal, DocEditor, DocView, PaymentModal } from './DocModals';
import { MoneyIn } from './MoneyIn';

type ListType = 'SALES_INVOICE' | 'QUOTE' | 'CREDIT_NOTE';
const KEYS = ['invoices', 'quotes', 'money-in', 'credit-notes'];

/** Customer invoices: invoices, quotes, money in (receipts and who owes you), credit notes. The same screen for every plan; nothing here is locked. */
export default function Invoices() {
  const [tab, setTab] = useTabParam(KEYS, 'invoices');
  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><FileText className="h-6 w-6 text-primary-600" /> {tab === 'quotes' ? 'Quotes' : 'Customer invoices'}</h1>
        <p className="mt-1 text-sm text-slate-500">Bills you give your customers. Your Get4Domain plan bills are under <Link href="/dashboard/account/billing?tab=billing" className="font-semibold text-primary-600">Plan and billing</Link>.</p>
      </div>
      <OneTimeNote id="billing-moved">Your Get4Domain bills are now under Plan and billing. This page is for the invoices you give your own customers.</OneTimeNote>
      <Tabs active={tab} onChange={setTab} tabs={[{ key: 'invoices', label: 'Invoices' }, { key: 'quotes', label: 'Quotes' }, { key: 'money-in', label: 'Money in' }, { key: 'credit-notes', label: 'Credit notes' }]} />
      {tab === 'invoices' && <DocList type="SALES_INVOICE" />}
      {tab === 'quotes' && <DocList type="QUOTE" />}
      {tab === 'money-in' && <MoneyIn />}
      {tab === 'credit-notes' && <DocList type="CREDIT_NOTE" />}
    </div>
  );
}

export function DocList({ type }: { type: ListType }) {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<{ doc?: Doc | null } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [paying, setPaying] = useState<Doc | null>(null);
  const [crediting, setCrediting] = useState<Doc | null>(null);
  const { data, loading, error, reload } = useLoad(() => bos<{ rows: Doc[]; total: number }>(`/bos/documents?docType=${type}${status ? `&status=${status}` : ''}${q.trim() ? `&search=${encodeURIComponent(q.trim())}` : ''}`), [type, status, q]);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const summary = useLoad(() => bos<{ salesPaise: number; receivedPaise: number; outstandingPaise: number; outstandingInvoices: number }>(`/bos/reports/summary?from=${ymd(monthStart)}&to=${ymd(new Date())}`), []);
  const noun = type === 'QUOTE' ? 'quote' : type === 'CREDIT_NOTE' ? 'credit note' : 'invoice';
  const filters = type === 'QUOTE' ? [['', 'All'], ['ISSUED', 'Sent'], ['ACCEPTED', 'Accepted'], ['CONVERTED', 'Converted']] : type === 'CREDIT_NOTE' ? [['', 'All']] : [['', 'All'], ['OPEN', 'Unpaid'], ['PAID', 'Paid'], ['DRAFT', 'Draft'], ['CANCELLED', 'Cancelled']];

  return (
    <div className="space-y-4">
      {type === 'SALES_INVOICE' && summary.data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Billed this month" value={rupees(summary.data.salesPaise)} />
          <Stat label="Received this month" value={rupees(summary.data.receivedPaise)} tone="good" />
          <Stat label="Waiting to be paid (all invoices)" value={rupees(summary.data.outstandingPaise)} tone={summary.data.outstandingPaise ? 'warn' : 'default'} hint={`${summary.data.outstandingInvoices} invoice${summary.data.outstandingInvoices === 1 ? '' : 's'}`} />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {filters.map(([k, label]) => <button key={k} onClick={() => setStatus(k)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === k ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}
        </div>
        <div className="flex items-center gap-2">
          <label className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className={`${inputCls} w-52 pl-9`} placeholder={`Search ${noun}s`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${noun}s`} autoComplete="off" /></label>
          {type !== 'CREDIT_NOTE' && <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>New {noun}</Button>}
        </div>
      </div>

      {loading && !data ? <Spinner /> : error ? <ErrorView error={error} /> : (data?.rows.length ?? 0) === 0 ? (
        <Empty title={type === 'CREDIT_NOTE' ? 'No credit notes yet' : `No ${noun}s yet`} action={type !== 'CREDIT_NOTE' ? <Button onClick={() => setEditing({})}>Make your first {noun}</Button> : undefined}>
          {type === 'CREDIT_NOTE' ? 'Open an invoice and choose Credit note / return when a customer sends something back.' : type === 'QUOTE' ? 'Send a price to a customer; when they accept, turn it into an invoice in one tap.' : 'Add the items, choose the customer and issue it. You can share it on WhatsApp, e-mail or print it.'}
        </Empty>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {data!.rows.map((d) => (
            <button key={d.id} onClick={() => setViewing(d.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{d.number ?? 'Draft'} <span className="font-normal text-slate-500">· {d.partyName ?? 'Walk-in customer'}</span></div><div className="text-xs text-slate-400">{dateShort(d.docDate)}{d.dueDate ? ` · due ${dateShort(d.dueDate)}` : ''}{d.source === 'ORDER' ? ' · from website order' : d.source === 'COUNTER' ? ' · counter' : ''}</div></div>
              <StatusPill status={d.status} quote={type === 'QUOTE'} />
              <div className="w-28 text-right"><div className="text-sm font-bold text-slate-900">{rupees(d.totalPaise)}</div>{d.outstandingPaise > 0 && <div className="text-xs text-amber-700">{rupees(d.outstandingPaise)} due</div>}</div>
            </button>
          ))}
        </div>
      )}
      {data && data.total > data.rows.length && <p className="text-center text-xs text-slate-400">Showing the latest {data.rows.length} of {data.total}. Search to find an older one.</p>}

      {editing && <DocEditor docType={type === 'QUOTE' ? 'QUOTE' : 'SALES_INVOICE'} doc={editing.doc ?? null} onClose={() => setEditing(null)} onSaved={(d) => { setEditing(null); reload(); summary.reload(); setViewing(d.id); }} />}
      {viewing && <DocView id={viewing} onClose={() => setViewing(null)} onChanged={() => { reload(); summary.reload(); }} onEdit={(d) => { setViewing(null); setEditing({ doc: d }); }} onPay={(d) => { setViewing(null); setPaying(d); }} onCredit={(d) => { setViewing(null); setCrediting(d); }} />}
      {paying && <PaymentModal doc={paying} onClose={() => setPaying(null)} onDone={() => { const id = paying.id; setPaying(null); reload(); summary.reload(); setViewing(id); }} />}
      {crediting && <CreditModal doc={crediting} onClose={() => setCrediting(null)} onDone={() => { setCrediting(null); reload(); summary.reload(); }} />}
    </div>
  );
}

