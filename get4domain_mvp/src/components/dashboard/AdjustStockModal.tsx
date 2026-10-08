'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, History } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { REASONS_BY_MODE, REASON_LABEL, type AdjustMode, type StockReason, validateAdjust } from '@/lib/stock-ui';

export interface StockProductRef { id: string; name: string; stockQty: number | null; reorderLevel: number | null }
interface Movement { id: string; delta: number; reason: string; note: string | null; balanceAfter: number; createdBy: string | null; createdAt: string }

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';
const MODE_LABEL: Record<AdjustMode, string> = { add: 'Add stock', remove: 'Remove stock', set: 'Set counted quantity' };

/** Adjust stock for ONE product: add, remove or set a counted quantity, with a reason and note. Below it, that product's movement history. */
export default function AdjustStockModal({ product, onClose, onDone }: { product: StockProductRef | null; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<AdjustMode>('remove');
  const [reason, setReason] = useState<StockReason>('SHOP_SALE');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState<number | null>(null);
  const [history, setHistory] = useState<Movement[] | null>(null);
  const [key, setKey] = useState('');

  const loadHistory = useCallback(async (id: string) => {
    try { const r = await api.stockHistory(id); setHistory((r.data ?? r) as Movement[]); } catch { setHistory([]); }
  }, []);

  useEffect(() => {
    if (!product) return;
    setMode('remove'); setReason('SHOP_SALE'); setQty(''); setNote(''); setError(''); setHistory(null);
    setCurrent(product.stockQty ?? 0);
    setKey(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2, 8)}`);
    void loadHistory(product.id);
  }, [product, loadHistory]);

  function pickMode(m: AdjustMode) {
    setMode(m);
    setReason(REASONS_BY_MODE[m][0]); // every direction has its own sensible reasons
    setError('');
  }

  if (!product) return null;
  const quantity = qty.trim() === '' ? NaN : Number(qty);
  const problem = qty.trim() === '' ? 'Enter a quantity.' : validateAdjust(mode, quantity, current ?? 0);
  const after = Number.isFinite(quantity) && !problem ? (mode === 'add' ? (current ?? 0) + quantity : mode === 'remove' ? (current ?? 0) - quantity : quantity) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product || problem) { setError(problem ?? ''); return; }
    setBusy(true); setError('');
    try {
      const r = await api.adjustStock(product.id, { mode, quantity, reason, note: note.trim() || undefined, idempotencyKey: key });
      const out = (r.data ?? r) as { stockQty?: number };
      setCurrent(typeof out.stockQty === 'number' ? out.stockQty : after);
      setQty(''); setNote('');
      // a new key per successful change; a retry of a FAILED request keeps the same key (so it can never apply twice)
      setKey(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2, 8)}`);
      await loadHistory(product.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the stock.');
    } finally { setBusy(false); }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Adjust stock — ${product.name}`} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
          <span className="text-xs text-slate-500">In stock now</span>
          <span className="text-2xl font-bold text-slate-900" aria-live="polite">{current ?? 0}</span>
        </div>

        <div role="radiogroup" aria-label="What are you doing?" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {(['add', 'remove', 'set'] as AdjustMode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => pickMode(m)}
              className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${mode === m ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`}>{MODE_LABEL[m]}</button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="adj-qty">{mode === 'set' ? 'Counted quantity' : 'Quantity'}</label>
            <input id="adj-qty" inputMode="numeric" value={qty} onChange={(e) => { setQty(e.target.value.replace(/[^\d]/g, '')); setError(''); }} className={inputCls} autoFocus />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="adj-reason">Reason</label>
            <select id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value as StockReason)} className={inputCls}>
              {REASONS_BY_MODE[mode].map((r) => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="adj-note">Note <span className="text-slate-400">(optional)</span></label>
          <input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. sold at the counter, bill #123" className={inputCls} />
        </div>

        {after !== null && <p className="text-xs text-slate-500">Stock will become <strong className="text-slate-800">{after}</strong>.</p>}
        {qty.trim() !== '' && problem && <p role="alert" className="text-xs font-medium text-error-600">{problem}</p>}
        {error && <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-sm text-error-700">{error}</div>}

        <Button type="submit" fullWidth loading={busy} disabled={busy || Boolean(problem)}>{MODE_LABEL[mode]}</Button>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><History className="h-3.5 w-3.5" /> Stock history</h4>
        {history === null ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
        ) : history.length === 0 ? (
          <p className="text-xs text-slate-400">No stock changes recorded yet.</p>
        ) : (
          <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto text-xs">
            {history.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0">
                  <span className="font-medium text-slate-700">{REASON_LABEL[m.reason as StockReason] ?? m.reason.replace(/_/g, ' ').toLowerCase()}</span>
                  {m.note ? <span className="text-slate-400"> — {m.note}</span> : null}
                  <span className="block text-[11px] text-slate-400">{new Date(m.createdAt).toLocaleString('en-IN')}</span>
                </span>
                <span className="flex-shrink-0 text-right">
                  <span className={`font-bold ${m.delta >= 0 ? 'text-success-600' : 'text-error-600'}`}>{m.delta >= 0 ? `+${m.delta}` : m.delta}</span>
                  <span className="block text-[11px] text-slate-400">→ {m.balanceAfter}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
