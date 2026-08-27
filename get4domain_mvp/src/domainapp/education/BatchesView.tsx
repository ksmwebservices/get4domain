'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Layers, Users, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Batch {
  id: string; name: string; courseName?: string; faculty?: string; mode: string;
  startDate?: string; endDate?: string; schedule?: string; capacity: number; fee: number; status: string;
  _count?: { enrollments: number };
}

const STATUS: Record<string, { label: string; color: string }> = {
  upcoming: { label: 'Upcoming', color: '#64748b' }, active: { label: 'Active', color: '#16a34a' }, completed: { label: 'Completed', color: '#2563eb' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const emptyForm = (): Record<string, unknown> => ({ name: '', courseName: '', faculty: '', mode: 'Classroom', startDate: '', endDate: '', schedule: '', capacity: 30, fee: 0, status: 'upcoming' });

export default function BatchesView() {
  const [rows, setRows] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getBatches().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (b: Batch) => { setEditing(b); setForm({ ...b, startDate: b.startDate?.slice(0, 10) ?? '', endDate: b.endDate?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.name).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, capacity: Number(form.capacity) || 30, fee: Number(form.fee) || 0, startDate: form.startDate || undefined, endDate: form.endDate || undefined };
      editing ? await api.updateBatch(editing.id, payload) : await api.createBatch(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(b: Batch) { if (confirm(`Delete batch ${b.name}?`)) { await api.deleteBatch(b.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Batches</h1><p className="mt-0.5 text-sm text-slate-500">Course batches — faculty, schedule, capacity and fee.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Batch</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="Layers" title="No batches yet" subtitle="Create a batch to schedule courses and enroll students." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Batch</Button>} /></Card>
        : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((b) => {
              const s = STATUS[b.status] ?? STATUS.upcoming;
              return (
                <Card key={b.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Layers className="h-5 w-5" /></div>
                      <div><div className="text-sm font-bold text-slate-900">{b.name}</div><div className="text-xs text-slate-500">{b.courseName || b.mode}</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {b.faculty && <span>{b.faculty}</span>}
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{b._count?.enrollments ?? 0}/{b.capacity}</span>
                    {b.fee > 0 && <span className="font-semibold text-slate-700">{inr(b.fee)}</span>}
                  </div>
                  {(b.startDate || b.schedule) && <div className="flex items-center gap-1 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" />{b.schedule || `${fmt(b.startDate)}${b.endDate ? ` → ${fmt(b.endDate)}` : ''}`}</div>}
                  <div className="mt-1 flex gap-2">
                    <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(b)}>Edit</Button>
                    <Button size="sm" variant="outline" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(b)}>Delete</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Batch' : 'Add Batch'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Batch name" required value={(form.name as string) ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="JEE 2027 Morning" />
            <Input label="Course" value={(form.courseName as string) ?? ''} onChange={(e) => setForm({ ...form, courseName: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Faculty" value={(form.faculty as string) ?? ''} onChange={(e) => setForm({ ...form, faculty: e.target.value })} />
            <Select label="Mode" value={(form.mode as string) ?? 'Classroom'} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              {['Classroom', 'Online', 'Hybrid'].map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Select label="Status" value={(form.status as string) ?? 'upcoming'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </div>
          <Input label="Schedule" value={(form.schedule as string) ?? ''} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="Mon/Wed/Fri 6–8pm" />
          <div className="grid grid-cols-4 gap-3">
            <Input label="Start" type="date" value={(form.startDate as string) ?? ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="End" type="date" value={(form.endDate as string) ?? ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            <Input label="Capacity" type="number" value={(form.capacity as number) ?? 30} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            <Input label="Fee (₹)" type="number" value={(form.fee as number) ?? 0} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
