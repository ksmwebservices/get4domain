'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Images, Circle, Loader2, CheckCircle2, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/domainapp/shared/EmptyState';

interface ShootRef { id: string; title: string; clientName: string; eventType: string; deliveryDueDate?: string; galleryUrl?: string }
interface Deliverable { id: string; name: string; status: string; dueDate?: string; shoot?: ShootRef | null }

const STATUS: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  pending: { label: 'Pending', color: '#94a3b8', icon: Circle },
  in_progress: { label: 'Editing', color: '#f59e0b', icon: Loader2 },
  delivered: { label: 'Delivered', color: '#16a34a', icon: CheckCircle2 },
};
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

export default function DeliveryView() {
  const [rows, setRows] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | string>('pending');

  const load = useCallback(() => {
    setLoading(true);
    api.getDeliverables().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    pending: rows.filter((d) => d.status === 'pending').length,
    in_progress: rows.filter((d) => d.status === 'in_progress').length,
    delivered: rows.filter((d) => d.status === 'delivered').length,
  }), [rows]);
  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((d) => d.status === filter)), [rows, filter]);

  async function cycle(d: Deliverable) {
    const next = d.status === 'pending' ? 'in_progress' : d.status === 'in_progress' ? 'delivered' : 'pending';
    await api.updateDeliverable(d.id, { status: next });
    load();
  }

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-bold text-slate-900">Gallery &amp; Delivery</h1><p className="mt-0.5 text-sm text-slate-500">Every deliverable across shoots — track editing and handover.</p></div>

      <div className="grid grid-cols-3 gap-3">
        {(['pending', 'in_progress', 'delivered'] as const).map((k) => {
          const st = STATUS[k];
          return (
            <button key={k} onClick={() => setFilter(filter === k ? 'all' : k)} className={`rounded-2xl border p-4 text-left transition ${filter === k ? 'border-primary-300 bg-primary-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
              <div className="text-2xl font-extrabold" style={{ color: st.color }}>{counts[k]}</div>
              <div className="text-xs font-semibold text-slate-500">{st.label}</div>
            </button>
          );
        })}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="Images" title={rows.length ? 'Nothing here' : 'No deliverables yet'} subtitle={rows.length ? 'No deliverables in this state.' : 'Deliverables appear as you book shoots.'} /></Card>
        : (
          <div className="space-y-2">
            {filtered.map((d) => {
              const st = STATUS[d.status] ?? STATUS.pending; const Icon = st.icon;
              return (
                <Card key={d.id} padded className="flex items-center justify-between gap-3">
                  <button onClick={() => cycle(d)} className="flex min-w-0 items-center gap-3 text-left">
                    <Icon className={`h-5 w-5 shrink-0 ${d.status === 'in_progress' ? 'animate-spin' : ''}`} style={{ color: st.color }} />
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-semibold ${d.status === 'delivered' ? 'text-slate-900' : 'text-slate-800'}`}>{d.name}</div>
                      <div className="truncate text-xs text-slate-500">
                        {d.shoot ? <>{d.shoot.title} · {d.shoot.clientName}</> : 'Unlinked'}
                        {d.shoot && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{d.shoot.eventType}</span>}
                      </div>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.shoot?.deliveryDueDate && <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Calendar className="h-3 w-3" />{fmt(d.shoot.deliveryDueDate)}</span>}
                    <Badge color={st.color}>{st.label}</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}
