'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Car, Pencil, Trash2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Vehicle {
  id: string; name: string; type: string; regNumber?: string;
  capacity: number; status: string; notes?: string;
}

const TYPES = ['sedan', 'suv', 'tempo', 'bus', 'other'];
const STATUS: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: '#16a34a' },
  on_trip: { label: 'On Trip', color: '#2563eb' },
  maintenance: { label: 'Maintenance', color: '#f59e0b' },
};
const emptyForm = { name: '', type: 'sedan', regNumber: '', capacity: 4, status: 'available', notes: '' };

export default function FleetView() {
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getVehicles().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); setForm({ ...v }); setOpen(true); };

  async function save() {
    if (!String(form.name).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, capacity: Number(form.capacity) || 1 };
      if (editing) await api.updateVehicle(editing.id, payload);
      else await api.createVehicle(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }

  async function remove(v: Vehicle) {
    if (!confirm(`Delete ${v.name}?`)) return;
    await api.deleteVehicle(v.id); load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fleet</h1>
          <p className="mt-0.5 text-sm text-slate-500">Your vehicles — assign them to trips from the Trips tab.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Vehicle</Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <Card padded>
          <EmptyState icon="Car" title="No vehicles yet" subtitle="Add your first vehicle to start assigning it to trips."
            action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Vehicle</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((v) => {
            const s = STATUS[v.status] ?? STATUS.available;
            return (
              <Card key={v.id} padded className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Car className="h-5 w-5" /></div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{v.name}</div>
                      <div className="text-xs capitalize text-slate-500">{v.type}{v.regNumber ? ` · ${v.regNumber}` : ''}</div>
                    </div>
                  </div>
                  <Badge color={s.color}>{s.label}</Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500"><Users className="h-3.5 w-3.5" />Capacity {v.capacity}</div>
                {v.notes && <div className="text-xs text-slate-500">{v.notes}</div>}
                <div className="mt-1 flex gap-2">
                  <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(v)}>Edit</Button>
                  <Button size="sm" variant="outline" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(v)}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Vehicle' : 'Add Vehicle'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <Input label="Name" required value={(form.name as string) ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Toyota Innova Crysta" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={(form.type as string) ?? 'sedan'} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
            </Select>
            <Input label="Capacity" type="number" value={(form.capacity as number) ?? 4} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Reg. Number" value={(form.regNumber as string) ?? ''} onChange={(e) => setForm({ ...form, regNumber: e.target.value })} placeholder="KA01AB1234" />
            <Select label="Status" value={(form.status as string) ?? 'available'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </Select>
          </div>
          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add Vehicle'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
