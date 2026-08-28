'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Minus, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

interface Item { id: string; name: string; unit: string | null; quantity: number; reorderThreshold: number | null }

export default function StationeryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', unit: '', quantity: '', reorderThreshold: '' });

  async function load() {
    setLoading(true);
    try { const r = await api.getStationery(); setItems(r.data ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name || form.quantity === '') return;
    setSaving(true); setError('');
    try {
      await api.createStationery({ name: form.name, unit: form.unit || undefined, quantity: parseFloat(form.quantity) || 0, reorderThreshold: form.reorderThreshold ? parseFloat(form.reorderThreshold) : undefined });
      setForm({ name: '', unit: '', quantity: '', reorderThreshold: '' });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
  }
  async function adjust(it: Item, delta: number) {
    const q = Math.max(0, it.quantity + delta);
    setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, quantity: q } : x));
    await api.updateStationery(it.id, { quantity: q }).catch(() => load());
  }
  async function del(id: string) { await api.deleteStationery(id).catch(() => {}); await load(); }

  const field = 'w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Office &amp; Stationery</h2>
        <p className="mt-1 text-sm text-slate-500">Track supplies on hand. Items at or below their reorder level are flagged.</p>
      </div>
      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <input className={`${field} sm:col-span-2`} placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={field} placeholder="Unit (box, ream…)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <input className={field} type="number" placeholder="Qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <input className={`${field} sm:col-span-2`} type="number" placeholder="Reorder level (optional)" value={form.reorderThreshold} onChange={(e) => setForm({ ...form, reorderThreshold: e.target.value })} />
          <button onClick={add} disabled={saving || !form.name || form.quantity === ''} className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add item</button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : (
        <div className="space-y-2">
          {items.length === 0 ? <p className="text-sm text-slate-400">No items yet.</p> : items.map((it) => {
            const low = it.reorderThreshold != null && it.quantity <= it.reorderThreshold;
            return (
              <div key={it.id} className={`flex items-center justify-between rounded-xl border p-3 ${low ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">{it.name} {low && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><AlertTriangle className="h-3 w-3" />Low stock</span>}</div>
                  {it.reorderThreshold != null && <div className="text-xs text-slate-400">Reorder at {it.reorderThreshold}{it.unit ? ` ${it.unit}` : ''}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => adjust(it, -1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="min-w-[3rem] text-center text-sm font-bold text-slate-900">{it.quantity}{it.unit ? <span className="text-xs font-normal text-slate-400"> {it.unit}</span> : ''}</span>
                  <button onClick={() => adjust(it, 1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100"><Plus className="h-3.5 w-3.5" /></button>
                  <button onClick={() => del(it.id)} className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-error-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
