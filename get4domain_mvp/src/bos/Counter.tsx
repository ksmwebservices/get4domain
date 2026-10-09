'use client';

import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Printer, Store, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { bos, plain, rupees, useLoad, type Doc, type Party } from './client';
import { Alert, Field, Stat, inputCls, openHtml } from './ui';
import { ItemSearch, PartyPicker, useItems, type PickItem } from './pickers';

interface CartLine { key: number; itemId: string; name: string; qty: number; rate: string; variantKey: string; gstRate: number | null; variants: { variantKey: string; onHand: number }[]; tracked: boolean; onHand: number | null }
interface Pay { key: number; mode: string; amount: string }
interface Totals { totalPaise: number; roundOffPaise: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }
interface Summary { bills: number; totalPaise: number; byMode: Record<string, number> }

let k = 1;
const newKey = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(36).slice(2, 10)}`);
const MODES: [string, string][] = [['CASH', 'Cash'], ['UPI', 'UPI'], ['CARD', 'Card'], ['BANK', 'Bank']];

/**
 * Counter billing: pick items (type a name, or scan a barcode / SKU), take the money, done. One transaction creates the invoice, the receipt(s),
 * the stock movement and the books entry. Pressing Charge twice cannot bill twice (one key per sale).
 */
export default function Counter() {
  const { items, reload: reloadItems } = useItems();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [party, setParty] = useState<Party | null>(null);
  const [discount, setDiscount] = useState('');
  const [pays, setPays] = useState<Pay[]>([{ key: k++, mode: 'CASH', amount: '' }]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [saleKey, setSaleKey] = useState(newKey());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ invoice: Doc; warnings: string[]; outstandingPaise: number } | null>(null);
  const [gst, setGst] = useState(true);
  const summary = useLoad(() => bos<Summary>('/bos/counter/summary'), []);
  useEffect(() => { bos<{ gstRegistered: boolean }>('/bos/settings').then((s) => setGst(s.gstRegistered)).catch(() => undefined); }, []);

  const lines = useMemo(() => cart.map((l) => ({ itemId: l.itemId, qty: l.qty, rate: Number(l.rate) || 0, variantKey: l.variantKey.trim() || undefined })), [cart]);
  useEffect(() => {
    if (!lines.length || lines.some((l) => !(l.qty > 0))) { setTotals(null); return; }
    const t = setTimeout(() => {
      bos<Totals>('/bos/documents/preview', { method: 'POST', body: { docType: 'SALES_INVOICE', partyId: party?.id, taxKind: gst ? 'GST' : 'NONE', ...(Number(discount) ? { discount: Number(discount) } : {}), lines } })
        .then((r) => { setTotals(r); setErr(''); }).catch((e) => { setTotals(null); setErr(plain(e, '')); });
    }, 250);
    return () => clearTimeout(t);
  }, [lines, party?.id, discount, gst]);

  function add(i: PickItem) {
    setDone(null);
    setCart((c) => {
      const same = c.find((l) => l.itemId === i.id && !l.variantKey && !(i.variants && i.variants.length));
      if (same) return c.map((l) => (l === same ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { key: k++, itemId: i.id, name: i.name, qty: 1, rate: i.ratePaise != null ? String(i.ratePaise / 100) : '', variantKey: '', gstRate: i.gstRate ?? null, variants: i.variants ?? [], tracked: i.tracked, onHand: i.onHand }];
    });
  }
  const setLine = (key: number, patch: Partial<CartLine>) => setCart((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const total = totals?.totalPaise ?? 0;
  const paid = pays.reduce((a, p) => a + Math.round((Number(p.amount) || 0) * 100), 0);
  const balance = total - paid;

  async function charge() {
    setErr('');
    if (!cart.length) { setErr('Add at least one item.'); return; }
    if (!totals) { setErr('Check the quantities and prices first.'); return; }
    const payments = pays.filter((p) => Number(p.amount) > 0).map((p) => ({ mode: p.mode, amount: Number(p.amount) }));
    setBusy(true);
    try {
      const r = await bos<{ invoice: Doc; warnings: string[]; outstandingPaise: number }>('/bos/counter/sale', { method: 'POST', body: { lines: lines.map((l) => ({ ...l })), partyId: party?.id, ...(Number(discount) ? { discount: Number(discount) } : {}), taxKind: gst ? 'GST' : 'NONE', payments, idempotencyKey: saleKey } });
      setDone(r); setCart([]); setParty(null); setDiscount(''); setPays([{ key: k++, mode: 'CASH', amount: '' }]); setTotals(null); setSaleKey(newKey()); summary.reload(); reloadItems();
    } catch (e) { setErr(plain(e)); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      <div><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Store className="h-6 w-6 text-primary-600" /> Counter billing</h1><p className="mt-1 text-sm text-slate-500">Bill a walk-in customer in seconds. Stock goes down and the books are updated at the same moment.</p></div>
      {summary.data && <div className="grid gap-3 sm:grid-cols-3"><Stat label="Bills today" value={summary.data.bills} /><Stat label="Taken today" value={rupees(summary.data.totalPaise)} tone="good" /><Stat label="By mode" value={<span className="text-sm font-medium">{Object.entries(summary.data.byMode).map(([m, v]) => `${m.toLowerCase()} ${rupees(v)}`).join(' · ') || 'none yet'}</span>} /></div>}

      {done && (
        <Alert tone="ok">
          <div className="flex flex-wrap items-center gap-3"><span><b>{done.invoice.number}</b> saved{done.outstandingPaise > 0 ? `, ${rupees(done.outstandingPaise)} left to collect from ${done.invoice.partyName}` : ', paid in full'}.</span>
            <Button size="sm" variant="outline" leftIcon={<Printer className="h-4 w-4" />} onClick={() => openHtml(`/bos/documents/${done.invoice.id}/html?thermal=1`).catch((e) => setErr(plain(e)))}>Print receipt</Button></div>
          {done.warnings.map((w) => <div key={w} className="mt-1 text-xs">{w}</div>)}
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <ItemSearch onPick={add} placeholder="Type an item name, or scan a barcode / SKU and press Enter" />
          {cart.length === 0 ? <Card padded className="text-center text-sm text-slate-500">The bill is empty. Search for an item above.</Card> : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {cart.map((l) => (
                <div key={l.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{l.name}</div>
                    {l.variants.length > 0 ? <select className="mt-1 rounded-lg border border-slate-200 px-2 py-1 text-xs" value={l.variantKey} onChange={(e) => setLine(l.key, { variantKey: e.target.value })} aria-label="Size or colour"><option value="">Size / colour…</option>{l.variants.map((v) => <option key={v.variantKey} value={v.variantKey}>{v.variantKey} ({v.onHand} left)</option>)}</select>
                      : l.tracked && l.onHand != null ? <div className="text-xs text-slate-400">{l.onHand} in stock</div> : null}</div>
                  <div className="flex items-center gap-1"><button className="rounded-lg border border-slate-200 p-1.5" aria-label="One less" onClick={() => setLine(l.key, { qty: Math.max(1, l.qty - 1) })}><Minus className="h-3.5 w-3.5" /></button><span className="w-8 text-center text-sm font-bold">{l.qty}</span><button className="rounded-lg border border-slate-200 p-1.5" aria-label="One more" onClick={() => setLine(l.key, { qty: l.qty + 1 })}><Plus className="h-3.5 w-3.5" /></button></div>
                  <input className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm" inputMode="decimal" value={l.rate} onChange={(e) => setLine(l.key, { rate: e.target.value })} aria-label={`Price of ${l.name}`} />
                  <button className="rounded-lg p-2 text-slate-400 hover:text-error-600" aria-label={`Remove ${l.name}`} onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Card padded className="space-y-3">
          <div className="flex items-baseline justify-between"><span className="text-sm text-slate-500">To pay</span><span className="text-2xl font-bold text-slate-900">{totals ? rupees(total) : '₹0'}</span></div>
          {totals && totals.roundOffPaise !== 0 && <div className="text-xs text-slate-400">includes round off {rupees(totals.roundOffPaise)}</div>}
          <Field label="Discount on the whole bill ₹"><input className={inputCls} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} autoComplete="off" /></Field>
          <PartyPicker value={party} onChange={setParty} label="Customer (optional, needed if not fully paid)" />
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-600">Payment</span>
            {pays.map((p) => (
              <div key={p.key} className="flex items-center gap-2">
                <select className="rounded-lg border border-slate-200 px-2 py-2 text-sm" value={p.mode} onChange={(e) => setPays((ps) => ps.map((x) => (x.key === p.key ? { ...x, mode: e.target.value } : x)))} aria-label="Payment mode">{MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <input className={inputCls} inputMode="decimal" placeholder="Amount ₹" value={p.amount} onChange={(e) => setPays((ps) => ps.map((x) => (x.key === p.key ? { ...x, amount: e.target.value } : x)))} aria-label="Amount received" autoComplete="off" />
                {totals && <button className="whitespace-nowrap text-xs font-semibold text-primary-600" onClick={() => setPays((ps) => ps.map((x) => (x.key === p.key ? { ...x, amount: String(Math.max(0, (total - (paid - Math.round((Number(x.amount) || 0) * 100)))) / 100) } : x)))}>Full</button>}
              </div>
            ))}
            {pays.length < 4 && <button className="text-xs font-semibold text-primary-600" onClick={() => setPays((ps) => [...ps, { key: k++, mode: 'UPI', amount: '' }])}>+ Split the payment</button>}
          </div>
          {totals && <div className={`text-sm font-medium ${balance === 0 ? 'text-success-700' : balance > 0 ? 'text-amber-700' : 'text-error-600'}`}>{balance === 0 ? 'Paid in full' : balance > 0 ? `${rupees(balance)} still to collect` : `${rupees(-balance)} more than the bill`}</div>}
          {err && <Alert>{err}</Alert>}
          <Button fullWidth size="lg" loading={busy} disabled={busy || !cart.length} onClick={charge}>Charge {totals ? rupees(total) : ''}</Button>
        </Card>
      </div>
    </div>
  );
}
