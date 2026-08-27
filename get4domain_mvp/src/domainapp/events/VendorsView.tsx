'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Handshake, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/domainapp/shared/EmptyState';

interface BookingRef { id: string; title: string; clientName: string; eventDate?: string }
interface VendorAssign { id: string; vendorName: string; service: string; contactPhone?: string; cost: number; status: string; booking?: BookingRef | null }

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#f59e0b' }, confirmed: { label: 'Confirmed', color: '#2563eb' }, paid: { label: 'Paid', color: '#16a34a' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

export default function VendorsView() {
  const [rows, setRows] = useState<VendorAssign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | string>('all');

  const load = useCallback(() => {
    setLoading(true);
    api.getEventVendors().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    pending: rows.filter((v) => v.status === 'pending').length,
    confirmed: rows.filter((v) => v.status === 'confirmed').length,
    paid: rows.filter((v) => v.status === 'paid').length,
  }), [rows]);
  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((v) => v.status === filter)), [rows, filter]);

  async function cycle(v: VendorAssign) {
    const next = v.status === 'pending' ? 'confirmed' : v.status === 'confirmed' ? 'paid' : 'pending';
    await api.updateEventVendor(v.id, { status: next });
    load();
  }

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-bold text-slate-900">Vendors</h1><p className="mt-0.5 text-sm text-slate-500">Vendor coordination across all events — track confirmations and payments.</p></div>

      <div className="grid grid-cols-3 gap-3">
        {(['pending', 'confirmed', 'paid'] as const).map((k) => {
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
        : filtered.length === 0 ? <Card padded><EmptyState icon="Handshake" title={rows.length ? 'Nothing here' : 'No vendors yet'} subtitle={rows.length ? 'No vendors in this state.' : 'Vendors appear as you assign them to bookings.'} /></Card>
        : (
          <div className="space-y-2">
            {filtered.map((v) => {
              const s = STATUS[v.status] ?? STATUS.pending;
              return (
                <Card key={v.id} padded className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Handshake className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="truncate text-sm font-bold text-slate-900">{v.vendorName}</span><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{v.service}</span></div>
                      <div className="truncate text-xs text-slate-500">{v.booking ? <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{v.booking.title} · {fmt(v.booking.eventDate)}</span> : 'Unlinked'}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {v.cost > 0 && <span className="text-sm font-bold text-slate-900">{inr(v.cost)}</span>}
                    <button onClick={() => cycle(v)}><Badge color={s.color}>{s.label}</Badge></button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}
