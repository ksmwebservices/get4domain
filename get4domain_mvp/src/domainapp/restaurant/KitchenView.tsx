'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, ChevronRight, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/domainapp/shared/EmptyState';

interface OrderRef { id: string; tableName?: string; orderType: string }
interface Item { id: string; name: string; quantity: number; status: string; station: string; notes?: string; order?: OrderRef | null }

const COLUMNS = [
  { key: 'queued', label: 'Queued', color: '#64748b' },
  { key: 'preparing', label: 'Preparing', color: '#f59e0b' },
  { key: 'ready', label: 'Ready', color: '#16a34a' },
];
const NEXT: Record<string, string> = { queued: 'preparing', preparing: 'ready', ready: 'served' };
const NEXT_LABEL: Record<string, string> = { queued: 'Start', preparing: 'Ready', ready: 'Serve' };

export default function KitchenView() {
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.getRestaurantKitchen().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const byCol = (status: string) => rows.filter((i) => i.status === status);
  const isEmpty = useMemo(() => rows.length === 0, [rows]);

  async function advance(it: Item) { const n = NEXT[it.status]; if (!n) return; await api.updateRestaurantItem(it.id, { status: n }); load(); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Kitchen Display</h1><p className="mt-0.5 text-sm text-slate-500">Live tickets — advance each item as it&apos;s cooked and served.</p></div>
        <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={load}>Refresh</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : isEmpty ? <Card padded><EmptyState icon="ChefHat" title="No tickets in the kitchen" subtitle="Items appear here as orders are sent from the floor." /></Card>
        : (
          <div className="grid gap-3 md:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.key} className="rounded-2xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: col.color }} /><span className="text-sm font-bold text-slate-700">{col.label}</span></div>
                  <span className="text-xs font-semibold text-slate-400">{byCol(col.key).length}</span>
                </div>
                <div className="space-y-2">
                  {byCol(col.key).map((it) => (
                    <div key={it.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">{it.quantity}× {it.name}</span>
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">{it.station}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">{it.order?.tableName ? `Table ${it.order.tableName}` : it.order?.orderType}</div>
                      {it.notes && <div className="mt-0.5 text-xs italic text-slate-400">{it.notes}</div>}
                      <Button size="sm" variant="outline" className="mt-2 w-full" rightIcon={<ChevronRight className="h-3.5 w-3.5" />} onClick={() => advance(it)}>{NEXT_LABEL[it.status]}</Button>
                    </div>
                  ))}
                  {byCol(col.key).length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">Empty</p>}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
