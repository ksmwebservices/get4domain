'use client';

import { useState } from 'react';
import { Plus, ShoppingCart } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { bos, dateShort, plain, rupees, useLoad, type Doc } from './client';
import { Alert, Empty, ErrorView, Field, Gate, Spinner, Stat, StatusPill, Tabs, inputCls, useTabParam } from './ui';
import { DocEditor, DocView, PaymentModal } from './DocModals';

interface OutParty { partyId: string | null; partyName: string; totalPaise: number; documents: { id: string; number: string | null; docDate: string; dueDate: string | null; outstandingPaise: number; ageDays: number }[] }
interface SupplierRow { id: string; name: string; phone: string; gstin: string | null; owesYouPaise: number; youOwePaise: number }

/** Purchases and suppliers (Pro): purchase bills with the GST you can claim, stock coming in, what you owe and who you have paid. */
export default function Purchases() {
  return <Gate capabilityId="bos.purchases"><Inner /></Gate>;
}

function Inner() {
  const [tab, setTab] = useTabParam(['bills', 'payables', 'suppliers'], 'bills');
  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      <div><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><ShoppingCart className="h-6 w-6 text-primary-600" /> Purchases and suppliers</h1><p className="mt-1 text-sm text-slate-500">Record what you buy. Stock goes up, the GST you can claim is kept, and what you owe each supplier is always known.</p></div>
      <Tabs active={tab} onChange={setTab} tabs={[{ key: 'bills', label: 'Purchase bills' }, { key: 'payables', label: 'What you owe' }, { key: 'suppliers', label: 'Suppliers' }]} />
      {tab === 'bills' && <Bills />}
      {tab === 'payables' && <Payables />}
      {tab === 'suppliers' && <Suppliers />}
    </div>
  );
}

function Bills() {
  const [editing, setEditing] = useState<{ doc?: Doc | null } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [paying, setPaying] = useState<Doc | null>(null);
  const { data, loading, error, reload } = useLoad(() => bos<{ rows: Doc[]; total: number }>('/bos/purchases'), []);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorView error={error} />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>New purchase bill</Button></div>
      {(data?.rows.length ?? 0) === 0 ? <Empty title="No purchase bills yet" action={<Button onClick={() => setEditing({})}>Record your first purchase</Button>}>Choose the supplier, add the items you received and issue it. Your stock and cost prices update by themselves.</Empty> : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {data!.rows.map((d) => (
            <button key={d.id} onClick={() => setViewing(d.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{d.number ?? 'Draft'} <span className="font-normal text-slate-500">· {d.partyName}</span></div><div className="text-xs text-slate-400">{dateShort(d.docDate)}</div></div>
              <StatusPill status={d.status} />
              <div className="w-28 text-right"><div className="text-sm font-bold text-slate-900">{rupees(d.totalPaise)}</div>{d.outstandingPaise > 0 && <div className="text-xs text-amber-700">{rupees(d.outstandingPaise)} to pay</div>}</div>
            </button>
          ))}
        </div>
      )}
      {editing && <DocEditor docType="PURCHASE_BILL" doc={editing.doc ?? null} onClose={() => setEditing(null)} onSaved={(d) => { setEditing(null); reload(); setViewing(d.id); }} />}
      {viewing && <DocView id={viewing} onClose={() => setViewing(null)} onChanged={reload} onEdit={(d) => { setViewing(null); setEditing({ doc: d }); }} onPay={(d) => { setViewing(null); setPaying(d); }} onCredit={(d: Doc) => { void d; }} />}
      {paying && <PaymentModal doc={paying} onClose={() => setPaying(null)} onDone={() => { const id = paying.id; setPaying(null); reload(); setViewing(id); }} />}
    </div>
  );
}

function Payables() {
  const { data, loading, error, reload } = useLoad(() => bos<{ totalPaise: number; parties: OutParty[] }>('/bos/outstanding?kind=SUPPLIER'), []);
  const [paying, setPaying] = useState<{ id: string; name: string } | null>(null);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorView error={error} />;
  return (
    <div className="space-y-4">
      <Stat label="You owe suppliers" value={rupees(data!.totalPaise)} tone={data!.totalPaise ? 'warn' : 'default'} />
      {data!.parties.length === 0 ? <Empty title="You do not owe anyone">Unpaid purchase bills appear here with how long they have been waiting.</Empty> : data!.parties.map((p) => (
        <Card key={p.partyId ?? p.partyName} padded>
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm font-bold text-slate-900">{p.partyName}</div><div className="flex items-center gap-3"><b className="text-lg text-amber-700">{rupees(p.totalPaise)}</b>{p.partyId && <Button size="sm" onClick={() => setPaying({ id: p.partyId as string, name: p.partyName })}>Pay supplier</Button>}</div></div>
          <div className="mt-2 divide-y divide-slate-50 text-sm">{p.documents.map((d) => <div key={d.id} className="flex justify-between py-1.5"><span>{d.number} <span className="text-xs text-slate-400">· {dateShort(d.docDate)} · {d.ageDays} days</span></span><b>{rupees(d.outstandingPaise)}</b></div>)}</div>
        </Card>
      ))}
      {paying && <PaymentModal kind="PAYMENT_OUT" party={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); reload(); }} />}
    </div>
  );
}

function Suppliers() {
  const { data, loading, error, reload } = useLoad(() => bos<SupplierRow[]>('/bos/parties?kind=supplier'), []);
  const [f, setF] = useState({ name: '', phone: '', gstin: '', state: '', opening: '' });
  const [err, setErr] = useState('');
  async function add() {
    setErr('');
    try { await bos('/bos/parties', { method: 'POST', body: { name: f.name.trim(), phone: f.phone.trim(), type: 'supplier', ...(f.gstin.trim() ? { gstin: f.gstin.trim().toUpperCase() } : {}), ...(f.state.trim() ? { state: f.state.trim() } : {}), ...(Number(f.opening) ? { openingBalance: Number(f.opening) } : {}) } }); setF({ name: '', phone: '', gstin: '', state: '', opening: '' }); reload(); } catch (e) { setErr(plain(e, 'Enter the supplier name and a phone number.')); }
  }
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorView error={error} />;
  return (
    <div className="space-y-4">
      <Card padded>
        <h2 className="text-sm font-bold text-slate-900">Add a supplier</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-5">
          <Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" /></Field>
          <Field label="Phone"><input className={inputCls} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="off" /></Field>
          <Field label="GSTIN"><input className={inputCls} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} autoComplete="off" /></Field>
          <Field label="State"><input className={inputCls} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} autoComplete="off" /></Field>
          <Field label="You already owe ₹" hint="Optional, set once"><input className={inputCls} inputMode="decimal" value={f.opening} onChange={(e) => setF({ ...f, opening: e.target.value })} autoComplete="off" /></Field>
        </div>
        {err && <div className="mt-2"><Alert>{err}</Alert></div>}
        <div className="mt-3"><Button onClick={add} disabled={f.name.trim().length < 2 || f.phone.trim().length < 5}>Save supplier</Button></div>
      </Card>
      {(data?.length ?? 0) === 0 ? <Empty title="No suppliers yet">Add the people you buy from. You can also add one while recording a purchase bill.</Empty> : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
          {data!.map((s) => <div key={s.id} className="flex items-center justify-between px-4 py-2.5"><span><b>{s.name}</b> <span className="text-xs text-slate-400">{s.phone}{s.gstin ? ` · ${s.gstin}` : ''}</span></span>{s.youOwePaise > 0 ? <span className="font-bold text-amber-700">you owe {rupees(s.youOwePaise)}</span> : <span className="text-xs text-slate-400">nothing owed</span>}</div>)}
        </div>
      )}
    </div>
  );
}
