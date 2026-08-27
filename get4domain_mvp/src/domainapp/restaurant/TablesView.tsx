'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Grid3x3, Users } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Table { id: string; name: string; seats: number; status: string; orderTotal?: number | null }

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: 'Available', color: '#16a34a', bg: 'bg-success-50' },
  occupied: { label: 'Occupied', color: '#dc2626', bg: 'bg-error-50' },
  reserved: { label: 'Reserved', color: '#2563eb', bg: 'bg-primary-50' },
  cleaning: { label: 'Cleaning', color: '#f59e0b', bg: 'bg-amber-50' },
};
const CYCLE = ['available', 'reserved', 'cleaning'];
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const emptyForm = (): Record<string, unknown> => ({ name: '', seats: 2, status: 'available' });

export default function TablesView() {
  const [rows, setRows] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Table | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getRestaurantTables().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (t: Table) => { setEditing(t); setForm({ ...t }); setOpen(true); };

  async function save() {
    if (!String(form.name).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, seats: Number(form.seats) || 2 };
      editing ? await api.updateRestaurantTable(editing.id, payload) : await api.createRestaurantTable(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(t: Table) { if (confirm(`Delete table ${t.name}?`)) { await api.deleteRestaurantTable(t.id); load(); } }
  async function cycle(t: Table) {
    if (t.status === 'occupied') return; // occupied is driven by orders
    const i = CYCLE.indexOf(t.status); const next = CYCLE[(i + 1) % CYCLE.length];
    await api.updateRestaurantTable(t.id, { status: next }); load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Tables</h1><p className="mt-0.5 text-sm text-slate-500">Floor status — occupied tables update from live orders.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Table</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="Grid3x3" title="No tables yet" subtitle="Add your tables to manage the floor." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Table</Button>} /></Card>
        : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((t) => {
              const s = STATUS[t.status] ?? STATUS.available;
              return (
                <Card key={t.id} padded className="flex flex-col gap-2">
                  <button onClick={() => cycle(t)} className={`flex flex-col items-center rounded-xl ${s.bg} py-4`} title={t.status === 'occupied' ? 'Occupied by an order' : 'Tap to change status'}>
                    <Grid3x3 className="h-6 w-6" style={{ color: s.color }} />
                    <span className="mt-1 text-base font-extrabold text-slate-900">{t.name}</span>
                    <span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                  </button>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{t.seats}</span>
                    {t.status === 'occupied' && t.orderTotal ? <span className="font-semibold text-slate-700">{inr(t.orderTotal)}</span> : null}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(t)} className="flex-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="mx-auto h-4 w-4" /></button>
                    <button onClick={() => remove(t)} className="flex-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="mx-auto h-4 w-4" /></button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Table' : 'Add Table'} maxWidth="max-w-sm">
        <div className="space-y-3">
          <Input label="Name / number" required value={(form.name as string) ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="T1" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Seats" type="number" value={(form.seats as number) ?? 2} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} />
            <Select label="Status" value={(form.status as string) ?? 'available'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
