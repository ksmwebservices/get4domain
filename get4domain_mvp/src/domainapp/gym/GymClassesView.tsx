'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Clock, Users, Dumbbell } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface GymClass { id: string; name: string; trainer?: string; dayOfWeek: string; startTime: string; durationMin: number; capacity: number; active: boolean }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Daily'];
const DAY_ORDER: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6, Daily: 7 };
const emptyForm = (): Record<string, unknown> => ({ name: '', trainer: '', dayOfWeek: 'Mon', startTime: '06:00', durationMin: 60, capacity: 20, active: true });

export default function GymClassesView() {
  const [rows, setRows] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GymClass | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getGymClasses().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (c: GymClass) => { setEditing(c); setForm({ ...c }); setOpen(true); };

  async function save() {
    if (!String(form.name).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, durationMin: Number(form.durationMin) || 60, capacity: Number(form.capacity) || 20 };
      editing ? await api.updateGymClass(editing.id, payload) : await api.createGymClass(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(c: GymClass) { if (confirm(`Delete ${c.name}?`)) { await api.deleteGymClass(c.id); load(); } }

  const sorted = [...rows].sort((a, b) => (DAY_ORDER[a.dayOfWeek] - DAY_ORDER[b.dayOfWeek]) || a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Class Schedule</h1><p className="mt-0.5 text-sm text-slate-500">Weekly classes and slots — trainer, time and capacity.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Class</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="CalendarClock" title="No classes yet" subtitle="Add your weekly class schedule with trainers and slots." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Class</Button>} /></Card>
        : (
          <div className="space-y-2">
            {sorted.map((c) => (
              <Card key={c.id} padded className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Dumbbell className="h-5 w-5" /></div>
                  <div>
                    <div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{c.name}</span>{!c.active && <Badge color="#64748b">Inactive</Badge>}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                      <span className="font-semibold text-primary-600">{c.dayOfWeek}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.startTime} · {c.durationMin}m</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.capacity} spots</span>
                      {c.trainer && <span>Coach {c.trainer}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
            ))}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Class' : 'Add Class'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Class name" required value={(form.name as string) ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Morning HIIT" />
            <Input label="Trainer" value={(form.trainer as string) ?? ''} onChange={(e) => setForm({ ...form, trainer: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Day" value={(form.dayOfWeek as string) ?? 'Mon'} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Input label="Start time" type="time" value={(form.startTime as string) ?? '06:00'} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Duration (min)" type="number" value={(form.durationMin as number) ?? 60} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
            <Input label="Capacity" type="number" value={(form.capacity as number) ?? 20} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.active as boolean} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded text-primary-600" />Active on the schedule
          </label>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
