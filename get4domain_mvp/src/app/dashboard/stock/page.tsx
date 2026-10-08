'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Boxes, Loader2, Search, AlertTriangle, PackageOpen } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import AdjustStockModal, { type StockProductRef } from '@/components/dashboard/AdjustStockModal';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { STATE_CLASS, STATE_LABEL, stockState } from '@/lib/stock-ui';

interface Row {
  id: string; name: string; image: string | null; category: string | null; active: boolean; status?: string | null;
  trackStock?: boolean; stockQty?: number | null; reorderLevel?: number | null;
}
type View = 'all' | 'low' | 'out';

/** One place to see and change the shop's stock: every tracked product, a Low stock list, and Adjust stock / history for each. */
export default function StockPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('all');
  const [q, setQ] = useState('');
  const [adjusting, setAdjusting] = useState<StockProductRef | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try { const r = await api.getVendorProductsManage(user.id); setRows((r.data ?? r ?? []) as Row[]); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load your stock.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const tracked = useMemo(() => rows.filter((r) => r.trackStock), [rows]);
  const untracked = rows.length - tracked.length;
  const counts = useMemo(() => ({
    low: tracked.filter((r) => stockState(r) === 'low').length,
    out: tracked.filter((r) => stockState(r) === 'out').length,
  }), [tracked]);
  const shown = tracked
    .filter((r) => (view === 'low' ? stockState(r) === 'low' || stockState(r) === 'out' : view === 'out' ? stockState(r) === 'out' : true))
    .filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (a.stockQty ?? 0) - (b.stockQty ?? 0));

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Boxes className="h-6 w-6 text-primary-600" /> Stock</h1>
        <p className="mt-1 text-sm text-slate-500">What you have in the shop. Website orders take stock off automatically; for a sale at the counter use <strong>Adjust stock → Shop sale</strong>.</p>
      </div>

      {error && <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      <div className="grid grid-cols-3 gap-3">
        <Card padded><div className="text-xs text-slate-500">Tracked products</div><div className="text-2xl font-bold text-slate-900">{tracked.length}</div></Card>
        <Card padded><div className="text-xs text-slate-500">Low stock</div><div className={`text-2xl font-bold ${counts.low ? 'text-amber-600' : 'text-slate-900'}`}>{counts.low}</div></Card>
        <Card padded><div className="text-xs text-slate-500">Out of stock</div><div className={`text-2xl font-bold ${counts.out ? 'text-error-600' : 'text-slate-900'}`}>{counts.out}</div></Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Stock view" className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
          {([['all', 'All'], ['low', 'Needs restocking'], ['out', 'Out of stock']] as [View, string][]).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === k ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`}>{label}</button>
          ))}
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className="w-56 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </label>
      </div>

      {tracked.length === 0 ? (
        <Card padded className="text-center text-sm text-slate-500">
          <PackageOpen className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          No product is tracked yet. Open a product in <Link href="/dashboard/my-products" className="font-semibold text-primary-600">My Products</Link>, tick <strong>Track stock</strong> and enter how many you have.
        </Card>
      ) : shown.length === 0 ? (
        <Card padded className="text-center text-sm text-slate-500">{view === 'all' ? 'No products match your search.' : 'Nothing here — all good.'}</Card>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {shown.map((r) => {
            const st = stockState(r);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                {r.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.image} alt="" className="h-11 w-11 flex-shrink-0 rounded-lg object-cover" /> : <div className="h-11 w-11 flex-shrink-0 rounded-lg bg-slate-100" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">{r.name}</div>
                  <div className="text-xs text-slate-400">{r.category ?? 'No category'}{r.reorderLevel != null ? ` · alert at ${r.reorderLevel}` : ''}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_CLASS[st]}`}>{STATE_LABEL[st]}</span>
                <div className="w-14 text-right text-lg font-bold text-slate-900" aria-label={`${r.stockQty ?? 0} in stock`}>{r.stockQty ?? 0}</div>
                <Button size="sm" variant="outline" onClick={() => setAdjusting({ id: r.id, name: r.name, stockQty: r.stockQty ?? 0, reorderLevel: r.reorderLevel ?? null })}>Adjust / history</Button>
              </div>
            );
          })}
        </div>
      )}

      {untracked > 0 && tracked.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-slate-400"><AlertTriangle className="h-3.5 w-3.5" /> {untracked} other product{untracked === 1 ? ' is' : 's are'} not tracked, so customers can always order them. Turn on <Link href="/dashboard/my-products" className="font-semibold text-primary-600">Track stock</Link> to count them.</p>
      )}

      <AdjustStockModal product={adjusting} onClose={() => setAdjusting(null)} onDone={() => { void load(); }} />
    </div>
  );
}
