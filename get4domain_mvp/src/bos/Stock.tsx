'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Boxes, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import AdjustStockModal, { type StockProductRef } from '@/components/dashboard/AdjustStockModal';
import { bos, dateShort, plain, rupees, useLoad, type StockRow } from './client';
import { Alert, Empty, ErrorView, Field, Gate, Spinner, Stat, Tabs, allowed, inputCls, useEntitlements, useTabParam } from './ui';

type Row = StockRow & { hsn?: string | null; gstRate?: number | null; variants?: { variantKey: string; onHand: number }[] };
interface Overview { rows: Row[]; totalValuePaise: number; trackedCount: number }
interface Loc { id: string; name: string; isDefault: boolean }

/**
 * Stock: every item with its on-hand count taken from the movement ledger. Items whose stock is not tracked say "Not tracked" (and can be sold
 * without limit). Adjustments, sizes and colours, locations and transfers all write movements, so every number here can be explained.
 */
export default function StockScreen() {
  const [tab, setTab] = useTabParam(['items', 'low', 'places', 'worth'], 'items');
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useLoad(() => bos<Overview>(`/bos/stock${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ''}`), [q]);
  const alerts = useLoad(() => bos<{ daily: boolean }>('/bos/stock/alerts'), []);
  const [adjusting, setAdjusting] = useState<StockProductRef | null>(null);
  const [variantFor, setVariantFor] = useState<Row | null>(null);
  const [fieldsFor, setFieldsFor] = useState<Row | null>(null);
  const ent = useEntitlements();

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorView error={error} />;
  const rows = data?.rows ?? [];
  const tracked = rows.filter((r) => r.tracked);
  const low = tracked.filter((r) => r.low);
  const out = tracked.filter((r) => (r.onHand ?? 0) <= 0);
  const shown = (tab === 'low' ? low : rows);

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Boxes className="h-6 w-6 text-primary-600" /> Stock</h1>
        <p className="mt-1 text-sm text-slate-500">What you have, where it is, and what it is worth. Sales, returns, purchases and your own adjustments all move stock, and every change is on record.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Items counted" value={tracked.length} />
        <Stat label="Stock value (at cost)" value={rupees(data?.totalValuePaise ?? 0)} />
        <Stat label="Low" value={low.length} tone={low.length ? 'warn' : 'default'} />
        <Stat label="Out of stock" value={out.length} tone={out.length ? 'warn' : 'default'} />
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[{ key: 'items', label: 'All items' }, { key: 'low', label: `Needs restocking${low.length ? ` (${low.length})` : ''}` }, { key: 'places', label: 'Places and transfers', locked: !allowed(ent, 'bos.multi-location') }, { key: 'worth', label: 'Stock value', locked: !allowed(ent, 'bos.stock-valuation') }]} />

      {(tab === 'items' || tab === 'low') && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className={`${inputCls} w-64 pl-9`} placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search items" autoComplete="off" /></label>
            {alerts.data && <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={alerts.data.daily} onChange={async (e) => { try { await bos('/bos/stock/alerts', { method: 'PUT', body: { daily: e.target.checked } }); alerts.reload(); } catch { /* shown on next load */ } }} /> Tell me each morning what is low</label>}
          </div>
          {shown.length === 0 ? (
            <Empty title={tab === 'low' ? 'Nothing is low' : q ? 'No item matches' : 'No items yet'}>{tab === 'low' ? 'Items at or below their alert level appear here.' : 'Add your products in Products and services. Turn on Track stock for the ones you count.'}</Empty>
          ) : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {shown.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  {r.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.image} alt="" className="h-11 w-11 flex-shrink-0 rounded-lg object-cover" /> : <div className="h-11 w-11 flex-shrink-0 rounded-lg bg-slate-100" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-400">{r.tracked ? `${r.reorderLevel != null ? `alert at ${r.reorderLevel} · ` : ''}${r.unitCostPaise != null ? `cost ${rupees(r.unitCostPaise)}` : 'no cost price yet'}${r.lastMovementAt ? ` · last moved ${dateShort(r.lastMovementAt)}` : ''}` : 'Stock is not counted for this item'}</div>
                    {(r.variants?.length ?? 0) > 0 && <div className="mt-1 flex flex-wrap gap-1">{r.variants!.map((v) => <span key={v.variantKey} className={`rounded-full px-2 py-0.5 text-xs ${v.onHand <= 0 ? 'bg-error-50 text-error-700' : 'bg-slate-100 text-slate-600'}`}>{v.variantKey}: {v.onHand}</span>)}</div>}
                  </div>
                  {r.tracked ? (
                    <>
                      {r.low && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{(r.onHand ?? 0) <= 0 ? 'Out of stock' : 'Low'}</span>}
                      <div className="w-16 text-right text-lg font-bold text-slate-900" aria-label={`${r.onHand} in stock`}>{r.onHand}</div>
                      <div className="hidden w-24 text-right text-xs text-slate-500 sm:block">{r.valuePaise != null ? rupees(r.valuePaise) : ''}</div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setAdjusting({ id: r.id, name: r.name, stockQty: r.onHand ?? 0, reorderLevel: r.reorderLevel })}>Adjust / history</Button>
                        <Button size="sm" variant="ghost" onClick={() => setVariantFor(r)}>Sizes</Button>
                        <Button size="sm" variant="ghost" onClick={() => setFieldsFor(r)}>Cost / GST</Button>
                      </div>
                    </>
                  ) : (
                    <><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Not tracked</span><Link href="/dashboard/commerce/products" className="text-xs font-semibold text-primary-600">Track stock</Link></>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {tab === 'places' && <Gate capabilityId="bos.multi-location"><Places rows={tracked} /></Gate>}
      {tab === 'worth' && <Gate capabilityId="bos.stock-valuation"><Valuation /></Gate>}

      <AdjustStockModal product={adjusting} onClose={() => setAdjusting(null)} onDone={() => reload()} />
      {variantFor && <VariantModal row={variantFor} onClose={() => setVariantFor(null)} onDone={() => { setVariantFor(null); reload(); }} />}
      {fieldsFor && <FieldsModal row={fieldsFor} onClose={() => setFieldsFor(null)} onDone={() => { setFieldsFor(null); reload(); }} />}
    </div>
  );
}

function VariantModal({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: () => void }) {
  const [variantKey, setVariantKey] = useState('');
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [reason, setReason] = useState('OPENING');
  const [qty, setQty] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setErr(''); setBusy(true);
    try { await bos(`/bos/stock/items/${row.id}/variant-stock`, { method: 'POST', body: { variantKey: variantKey.trim(), mode, quantity: Number(qty), reason } }); onDone(); } catch (e) { setErr(plain(e)); } finally { setBusy(false); }
  }
  return (
    <Modal isOpen onClose={onClose} title={`Sizes and colours: ${row.name}`} maxWidth="max-w-md">
      <div className="space-y-3 p-4">
        <p className="text-sm text-slate-500">Count a size or colour on its own, for example <b>UK8</b> or <b>Blue / L</b>. The item total is the sum of its sizes. Choose the size when you sell it.</p>
        {(row.variants?.length ?? 0) > 0 && <div className="flex flex-wrap gap-1">{row.variants!.map((v) => <button key={v.variantKey} className="rounded-full bg-slate-100 px-2 py-1 text-xs" onClick={() => setVariantKey(v.variantKey)}>{v.variantKey}: {v.onHand}</button>)}</div>}
        <Field label="Size or colour"><input className={inputCls} value={variantKey} onChange={(e) => setVariantKey(e.target.value)} placeholder="UK8" autoComplete="off" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="What happened"><select className={inputCls} value={`${mode}:${reason}`} onChange={(e) => { const [m, r] = e.target.value.split(':'); setMode(m as 'add' | 'remove'); setReason(r); }}><option value="add:OPENING">Stock I already have</option><option value="add:ADJUSTMENT">Add (found / counted)</option><option value="add:RETURN">Customer return</option><option value="remove:DAMAGE">Damaged or lost</option><option value="remove:ADJUSTMENT">Remove (counted less)</option></select></Field>
          <Field label="How many"><input className={inputCls} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} autoComplete="off" /></Field>
        </div>
        {err && <Alert>{err}</Alert>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Close</Button><Button loading={busy} onClick={save}>Save</Button></div>
      </div>
    </Modal>
  );
}

function FieldsModal({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: () => void }) {
  const [hsn, setHsn] = useState(row.hsn ?? '');
  const [gst, setGst] = useState(row.gstRate != null ? String(row.gstRate) : '');
  const [cost, setCost] = useState(row.unitCostPaise != null ? String(row.unitCostPaise / 100) : '');
  const [err, setErr] = useState('');
  async function save() {
    setErr('');
    try { await bos(`/bos/stock/items/${row.id}`, { method: 'PUT', body: { hsn, ...(gst !== '' ? { gstRate: Number(gst) } : {}), ...(cost !== '' ? { purchasePrice: Number(cost) } : {}) } }); onDone(); } catch (e) { setErr(plain(e)); }
  }
  return (
    <Modal isOpen onClose={onClose} title={`${row.name}: cost and GST`} maxWidth="max-w-md">
      <div className="space-y-3 p-4">
        <p className="text-sm text-slate-500">The purchase price is what each unit costs you. It sets your profit on every sale and the value of your stock.</p>
        <Field label="Purchase price per unit ₹"><input className={inputCls} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} autoComplete="off" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="GST rate %"><input className={inputCls} inputMode="decimal" value={gst} onChange={(e) => setGst(e.target.value)} autoComplete="off" /></Field><Field label="HSN / SAC code"><input className={inputCls} value={hsn} onChange={(e) => setHsn(e.target.value)} autoComplete="off" /></Field></div>
        {err && <Alert>{err}</Alert>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Close</Button><Button onClick={save}>Save</Button></div>
      </div>
    </Modal>
  );
}

function Places({ rows }: { rows: Row[] }) {
  const locs = useLoad(() => bos<Loc[]>('/bos/stock/locations'), []);
  const [name, setName] = useState('');
  const [t, setT] = useState({ productId: '', qty: '', from: '', to: '' });
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  async function add() { setErr(''); try { await bos('/bos/stock/locations', { method: 'POST', body: { name } }); setName(''); locs.reload(); } catch (e) { setErr(plain(e)); } }
  async function move() {
    setErr(''); setOk('');
    try { await bos('/bos/stock/transfer', { method: 'POST', body: { productId: t.productId, qty: Number(t.qty), fromLocationId: t.from, toLocationId: t.to, idempotencyKey: `ui-${Date.now()}` } }); setOk('Moved. The item total did not change.'); setT({ ...t, qty: '' }); } catch (e) { setErr(plain(e)); }
  }
  if (locs.loading && !locs.data) return <Spinner />;
  if (locs.error) return <ErrorView error={locs.error} />;
  const L = locs.data ?? [];
  return (
    <div className="space-y-4">
      <Card padded>
        <h2 className="text-sm font-bold text-slate-900">Your stock places</h2>
        <div className="mt-2 flex flex-wrap gap-2">{L.map((l) => <span key={l.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">{l.name}{l.isDefault ? ' (main)' : ''}</span>)}</div>
        <div className="mt-3 flex gap-2"><input className={inputCls} placeholder="New place, for example Godown" value={name} onChange={(e) => setName(e.target.value)} aria-label="New stock place" autoComplete="off" /><Button onClick={add} disabled={name.trim().length < 2}>Add</Button></div>
      </Card>
      <Card padded>
        <h2 className="text-sm font-bold text-slate-900">Move stock between places</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <select className={inputCls} value={t.productId} onChange={(e) => setT({ ...t, productId: e.target.value })} aria-label="Item"><option value="">Item…</option>{rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          <select className={inputCls} value={t.from} onChange={(e) => setT({ ...t, from: e.target.value })} aria-label="From"><option value="">From…</option>{L.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <select className={inputCls} value={t.to} onChange={(e) => setT({ ...t, to: e.target.value })} aria-label="To"><option value="">To…</option>{L.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <input className={inputCls} inputMode="numeric" placeholder="How many" value={t.qty} onChange={(e) => setT({ ...t, qty: e.target.value })} aria-label="How many" autoComplete="off" />
        </div>
        <div className="mt-3"><Button onClick={move} disabled={!t.productId || !t.from || !t.to || !t.qty}>Move stock</Button></div>
        {err && <div className="mt-3"><Alert>{err}</Alert></div>}
        {ok && <div className="mt-3"><Alert tone="ok">{ok}</Alert></div>}
      </Card>
    </div>
  );
}

function Valuation() {
  const { data, loading, error } = useLoad(() => bos<{ rows: { id: string; name: string; sku: string | null; qty: number; unitCostPaise: number | null; valuePaise: number }[]; totalPaise: number; withoutCost: number }>('/bos/stock/valuation'), []);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorView error={error} />;
  return (
    <div className="space-y-3">
      <Stat label="Total stock value at cost" value={rupees(data!.totalPaise)} hint={data!.withoutCost ? `${data!.withoutCost} item${data!.withoutCost === 1 ? ' has' : 's have'} no cost price, so ${data!.withoutCost === 1 ? 'it is' : 'they are'} counted as zero` : undefined} />
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
        {data!.rows.map((r) => <div key={r.id} className="flex items-center justify-between px-4 py-2"><span>{r.name} <span className="text-xs text-slate-400">{r.qty} × {r.unitCostPaise != null ? rupees(r.unitCostPaise) : 'no cost'}</span></span><b>{rupees(r.valuePaise)}</b></div>)}
      </div>
    </div>
  );
}
