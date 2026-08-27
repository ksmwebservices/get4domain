'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, AlertTriangle, Plus, Minus } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Product { id: string; name: string; sku?: string; price: number; stockQty: number; reorderLevel: number }

const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

export default function InventoryView() {
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowOnly, setLowOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.getRetailProducts().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const isLow = (p: Product) => p.stockQty <= p.reorderLevel;
  const filtered = useMemo(() => (lowOnly ? rows.filter(isLow) : rows), [rows, lowOnly]);
  const lowCount = useMemo(() => rows.filter(isLow).length, [rows]);
  const stockValue = useMemo(() => rows.reduce((s, p) => s + p.stockQty * p.price, 0), [rows]);

  async function adjust(p: Product, delta: number) {
    if (p.stockQty + delta < 0) return;
    setBusy(p.id);
    try { await api.restockRetailProduct(p.id, delta); load(); } finally { setBusy(null); }
  }
  async function restock(p: Product) {
    const v = prompt(`Add stock for ${p.name} (current ${p.stockQty}):`, '10');
    if (v === null) return; const n = Number(v); if (!Number.isFinite(n) || n === 0) return;
    setBusy(p.id);
    try { await api.restockRetailProduct(p.id, Math.round(n)); load(); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-bold text-slate-900">Inventory</h1><p className="mt-0.5 text-sm text-slate-500">Stock levels and reorder alerts — restock in one tap.</p></div>

      <div className="grid grid-cols-3 gap-3">
        <Card padded><div className="text-2xl font-extrabold text-slate-900">{rows.length}</div><div className="text-xs font-semibold text-slate-500">Products</div></Card>
        <button onClick={() => setLowOnly((v) => !v)} className={`rounded-2xl border p-4 text-left transition ${lowOnly ? 'border-error-300 bg-error-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
          <div className="text-2xl font-extrabold text-error-600">{lowCount}</div><div className="text-xs font-semibold text-slate-500">Low stock</div>
        </button>
        <Card padded><div className="text-2xl font-extrabold text-success-600">{inr(stockValue)}</div><div className="text-xs font-semibold text-slate-500">Stock value</div></Card>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="Boxes" title={rows.length ? 'No low-stock items' : 'No products yet'} subtitle="Products you add appear here with live stock levels." /></Card>
        : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const low = isLow(p);
              return (
                <Card key={p.id} padded className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${low ? 'bg-error-50 text-error-500' : 'bg-slate-100 text-slate-500'}`}>{low ? <AlertTriangle className="h-5 w-5" /> : <Boxes className="h-5 w-5" />}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="truncate text-sm font-bold text-slate-900">{p.name}</span>{low && <Badge color="#dc2626">Reorder</Badge>}</div>
                      <div className="truncate text-xs text-slate-500">{p.sku && `${p.sku} · `}{inr(p.price)} · reorder ≤ {p.reorderLevel}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button disabled={busy === p.id || p.stockQty <= 0} onClick={() => adjust(p, -1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><Minus className="h-4 w-4" /></button>
                    <span className={`w-10 text-center text-sm font-bold ${low ? 'text-error-600' : 'text-slate-900'}`}>{p.stockQty}</span>
                    <button disabled={busy === p.id} onClick={() => adjust(p, 1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><Plus className="h-4 w-4" /></button>
                    <Button size="sm" variant="outline" loading={busy === p.id} onClick={() => restock(p)}>Restock</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}
