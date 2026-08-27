'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Phone, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Membership {
  id: string; memberName: string; memberPhone?: string; planName: string; price: number;
  startDate: string; endDate: string; status: string; notes?: string;
}
type Derived = 'active' | 'expiring' | 'expired' | 'frozen' | 'cancelled';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const derive = (m: Membership): Derived => {
  if (m.status === 'cancelled') return 'cancelled';
  if (m.status === 'frozen') return 'frozen';
  const end = new Date(m.endDate).getTime();
  const now = Date.now();
  if (end < now) return 'expired';
  if (end - now <= WEEK_MS) return 'expiring';
  return 'active';
};
const D: Record<Derived, { label: string; color: string }> = {
  active: { label: 'Active', color: '#16a34a' }, expiring: { label: 'Expiring', color: '#f59e0b' },
  expired: { label: 'Expired', color: '#dc2626' }, frozen: { label: 'Frozen', color: '#2563eb' }, cancelled: { label: 'Cancelled', color: '#64748b' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const emptyForm = (): Record<string, unknown> => ({ memberName: '', memberPhone: '', planName: '', price: 0, startDate: '', endDate: '', status: 'active', notes: '' });

export default function MembershipsView() {
  const [rows, setRows] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Derived>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getMemberships().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((m) => (filter === 'all' || derive(m) === filter) && m.memberName.toLowerCase().includes(search.toLowerCase())), [rows, filter, search]);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const m of rows) c[derive(m)] = (c[derive(m)] ?? 0) + 1; return c; }, [rows]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (m: Membership) => { setEditing(m); setForm({ ...m, startDate: m.startDate?.slice(0, 10), endDate: m.endDate?.slice(0, 10) }); setOpen(true); };

  async function save() {
    if (!String(form.memberName).trim() || !String(form.planName).trim() || !String(form.startDate) || !String(form.endDate)) return;
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price) || 0 };
      editing ? await api.updateMembership(editing.id, payload) : await api.createMembership(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(m: Membership) { if (confirm(`Delete membership for ${m.memberName}?`)) { await api.deleteMembership(m.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Members</h1><p className="mt-0.5 text-sm text-slate-500">Membership roster with live active / expiring / expired status.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Member</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div className="flex flex-wrap gap-1">
          {(['all', 'active', 'expiring', 'expired', 'frozen', 'cancelled'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${filter === f ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>
              {f === 'all' ? 'All' : D[f].label}{f !== 'all' && counts[f] ? ` (${counts[f]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="Users" title={rows.length ? 'No members match' : 'No members yet'} subtitle="Add members with a plan and validity to track their status." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Member</Button>} /></Card>
        : (
          <div className="space-y-2">
            {filtered.map((m) => {
              const d = D[derive(m)];
              return (
                <Card key={m.id} padded className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{m.memberName}</span><Badge color={d.color}>{d.label}</Badge></div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span>{m.planName}</span>
                      <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{fmt(m.startDate)} → {fmt(m.endDate)}</span>
                      {m.memberPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{m.memberPhone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.price > 0 && <span className="text-sm font-bold text-slate-900">{inr(m.price)}</span>}
                    <button onClick={() => openEdit(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Member' : 'Add Member'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Member name" required value={(form.memberName as string) ?? ''} onChange={(e) => setForm({ ...form, memberName: e.target.value })} />
            <Input label="Phone" value={(form.memberPhone as string) ?? ''} onChange={(e) => setForm({ ...form, memberPhone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Plan" required value={(form.planName as string) ?? ''} onChange={(e) => setForm({ ...form, planName: e.target.value })} placeholder="Monthly Gym + Cardio" />
            <Input label="Price (₹)" type="number" value={(form.price as number) ?? 0} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start date" type="date" required value={(form.startDate as string) ?? ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="End date" type="date" required value={(form.endDate as string) ?? ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <Select label="Status" value={(form.status as string) ?? 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option><option value="frozen">Frozen</option><option value="cancelled">Cancelled</option>
          </Select>
          <p className="text-[11px] text-slate-400">Expiring / expired is derived automatically from the end date.</p>
          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
