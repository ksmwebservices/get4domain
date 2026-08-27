'use client';

import { useCallback, useEffect, useState } from 'react';
import { BedDouble, Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Room { id: string; number: string; roomType: string; status: string; housekeeping: string }

const COLUMNS: { key: string; label: string; icon: typeof BedDouble; tint: string }[] = [
  { key: 'dirty', label: 'Needs cleaning', icon: AlertCircle, tint: 'text-error-600' },
  { key: 'in_progress', label: 'In progress', icon: Loader2, tint: 'text-amber-600' },
  { key: 'clean', label: 'Clean', icon: CheckCircle2, tint: 'text-success-600' },
];
const NEXT: Record<string, { label: string; to: string }[]> = {
  dirty: [{ label: 'Start', to: 'in_progress' }, { label: 'Mark clean', to: 'clean' }],
  in_progress: [{ label: 'Done', to: 'clean' }],
  clean: [{ label: 'Mark dirty', to: 'dirty' }],
};

export default function HousekeepingView() {
  const [rows, setRows] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.getRooms().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setHk(room: Room, to: string) {
    setRows((prev) => prev.map((r) => (r.id === room.id ? { ...r, housekeeping: to } : r)));
    try { await api.updateRoom(room.id, { housekeeping: to }); } catch { load(); }
  }

  if (loading) return <div className="py-16 text-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-bold text-slate-900">Housekeeping</h1><p className="mt-0.5 text-sm text-slate-500">Track and update room cleaning status.</p></div>

      {rows.length === 0 ? (
        <Card padded><EmptyState icon="Sparkles" title="No rooms yet" subtitle="Add rooms under the Rooms tab to track housekeeping." /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = rows.filter((r) => (r.housekeeping || 'clean') === col.key);
            const Ic = col.icon;
            return (
              <div key={col.key}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <Ic className={`h-4 w-4 ${col.tint}`} />
                  <span className="text-sm font-bold text-slate-700">{col.label}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.length === 0 ? <p className="px-1 text-xs text-slate-400">None</p> : list.map((r) => (
                    <Card key={r.id} padded className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BedDouble className="h-4 w-4 text-slate-400" />
                        <div><div className="text-sm font-bold text-slate-900">Room {r.number}</div><div className="text-xs text-slate-500">{r.roomType}</div></div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {(NEXT[col.key] ?? []).map((a) => (
                          <button key={a.to} onClick={() => setHk(r, a.to)} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">{a.label}</button>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
