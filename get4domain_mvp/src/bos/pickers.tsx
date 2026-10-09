'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { bos, plain, type Party, type StockRow } from './client';
import { Alert, Field, inputCls } from './ui';
import Button from '@/components/ui/Button';

/** Choose a customer or supplier, or add one without leaving the form. */
export function PartyPicker({ kind = 'customer', value, onChange, label }: { kind?: 'customer' | 'supplier'; value: Party | null; onChange: (p: Party | null) => void; label?: string }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Party[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', phone: '', state: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { bos<Party[] | { rows: Party[] }>(`/bos/parties?kind=${kind}&search=${encodeURIComponent(q)}`).then((r) => setRows(Array.isArray(r) ? r : r.rows ?? [])).catch(() => setRows([])); }, 200);
    return () => clearTimeout(t);
  }, [q, open, kind]);

  async function create() {
    setErr(''); setBusy(true);
    try {
      const made = await bos<{ id: string; name: string }>('/bos/parties', { method: 'POST', body: { name: draft.name.trim(), phone: draft.phone.trim(), state: draft.state.trim() || undefined, type: kind } });
      onChange({ id: made.id, name: made.name, phone: draft.phone.trim(), email: null, type: kind, gstin: null, state: draft.state.trim() || null });
      setAdding(false); setOpen(false);
    } catch (e) { setErr(plain(e, 'Enter the name and a phone number of at least 5 digits.')); } finally { setBusy(false); }
  }

  const noun = kind === 'supplier' ? 'supplier' : 'customer';
  return (
    <div className="relative">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label ?? (kind === 'supplier' ? 'Supplier' : 'Customer')}</span>
      {value ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><span><b>{value.name}</b> <span className="text-slate-400">{value.phone}</span></span><button type="button" className="text-xs font-semibold text-primary-600" onClick={() => { onChange(null); setOpen(true); }}>Change</button></div>
      ) : (
        <div>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className={`${inputCls} pl-9`} placeholder={`Search ${noun} by name or phone`} value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} aria-label={`Search ${noun}`} autoComplete="off" /></div>
          {open && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {rows.map((p) => <button type="button" key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { onChange(p); setOpen(false); }}><b>{p.name}</b> <span className="text-slate-400">{p.phone}</span></button>)}
              {rows.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No {noun} found.</div>}
              <button type="button" className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-primary-600 hover:bg-primary-50" onClick={() => { setAdding(true); setOpen(false); setDraft({ name: q, phone: '', state: '' }); }}><Plus className="h-4 w-4" /> Add a new {noun}</button>
            </div>
          )}
        </div>
      )}
      {adding && (
        <div className="mt-2 space-y-2 rounded-xl border border-primary-100 bg-primary-50/40 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Name"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="off" /></Field>
            <Field label="Phone"><input className={inputCls} inputMode="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} autoComplete="off" /></Field>
            <Field label="State" hint="For GST"><input className={inputCls} value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} placeholder="Tamil Nadu" autoComplete="off" /></Field>
          </div>
          {err && <Alert>{err}</Alert>}
          <div className="flex gap-2"><Button size="sm" loading={busy} onClick={create}>Save {noun}</Button><Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button></div>
        </div>
      )}
    </div>
  );
}

let itemCache: { at: number; rows: StockRow[] & { ratePaise?: number | null; gstRate?: number | null; hsn?: string | null; variants?: { variantKey: string; onHand: number }[] }[] } | null = null;
export type PickItem = StockRow & { ratePaise?: number | null; gstRate?: number | null; hsn?: string | null; variants?: { variantKey: string; onHand: number }[] };

/** The vendor's items (one catalogue: the same products that are on the website). */
export function useItems(): { items: PickItem[]; reload: () => void } {
  const [items, setItems] = useState<PickItem[]>(itemCache && Date.now() - itemCache.at < 20_000 ? (itemCache.rows as PickItem[]) : []);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (tick === 0 && itemCache && Date.now() - itemCache.at < 20_000) return;
    bos<{ rows: PickItem[] }>('/bos/stock').then((r) => { itemCache = { at: Date.now(), rows: r.rows }; setItems(r.rows); }).catch(() => undefined);
  }, [tick]);
  return { items, reload: () => { itemCache = null; setTick((t) => t + 1); } };
}

export function ItemSearch({ onPick, placeholder = 'Search item or scan barcode / SKU' }: { onPick: (i: PickItem) => void; placeholder?: string }) {
  const { items } = useItems();
  const [q, setQ] = useState('');
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.slice(0, 8);
    return items.filter((i) => i.name.toLowerCase().includes(s) || (i.sku ?? '').toLowerCase() === s || (i.sku ?? '').toLowerCase().includes(s)).slice(0, 12);
  }, [items, q]);
  const [open, setOpen] = useState(false);
  function enter() {
    const s = q.trim().toLowerCase();
    const exact = items.find((i) => (i.sku ?? '').toLowerCase() === s);
    const pick = exact ?? (hits.length === 1 ? hits[0] : null);
    if (pick) { onPick(pick); setQ(''); setOpen(false); }
  }
  return (
    <div className="relative">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className={`${inputCls} pl-9`} placeholder={placeholder} value={q} aria-label="Search items" autoComplete="off"
        onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enter(); } }} /></div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {hits.map((i) => (
            <button type="button" key={i.id} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { onPick(i); setQ(''); setOpen(false); }}>
              <span><b>{i.name}</b>{i.sku && <span className="ml-2 text-xs text-slate-400">{i.sku}</span>}</span>
              <span className="text-xs text-slate-500">{i.ratePaise != null ? `₹${(i.ratePaise / 100).toLocaleString('en-IN')}` : ''}{i.tracked ? ` · ${i.onHand} in stock` : ''}</span>
            </button>
          ))}
          {hits.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No item found. You can type a line by hand below.</div>}
          <button type="button" className="block w-full border-t border-slate-100 px-3 py-1.5 text-left text-xs text-slate-400" onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
}
