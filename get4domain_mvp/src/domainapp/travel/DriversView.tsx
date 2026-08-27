'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, UserCog, Pencil, Trash2, Phone, IdCard } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Driver {
  id: string; name: string; phone?: string; licenseNo?: string; status: string; notes?: string;
}

const STATUS: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: '#16a34a' },
  on_trip: { label: 'On Trip', color: '#2563eb' },
  off_duty: { label: 'Off Duty', color: '#64748b' },
};
const emptyForm = { name: '', phone: '', licenseNo: '', status: 'available', notes: '' };

export default function DriversView() {
  const [rows, setRows] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getDrivers().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (d: Driver) => { setEditing(d); setForm({ ...d }); setOpen(true); };

  async function save() {
    if (!String(form.name).trim()) return;
    setSaving(true);
    try {
      if (editing) await api.updateDriver(editing.id, form);
      else await api.createDriver(form);
      setOpen(false); load();
    } finally { setSaving(false); }
  }

  async function remove(d: Driver) {
    if (!confirm(`Delete ${d.name}?`)) return;
    await api.deleteDriver(d.id); load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Drivers</h1>
          <p className="mt-0.5 text-sm text-slate-500">Your drivers — assign them to trips from the Trips tab.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Driver</Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <Card padded>
          <EmptyState icon="UserCog" title="No drivers yet" subtitle="Add your first driver to start assigning them to trips."
            action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Driver</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => {
            const s = STATUS[d.status] ?? STATUS.available;
            return (
              <Card key={d.id} padded className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><UserCog className="h-5 w-5" /></div>
                    <div className="text-sm font-bold text-slate-900">{d.name}</div>
                  </div>
                  <Badge color={s.color}>{s.label}</Badge>
                </div>
                {d.phone && <div className="flex items-center gap-1.5 text-xs text-slate-500"><Phone className="h-3.5 w-3.5" />{d.phone}</div>}
                {d.licenseNo && <div className="flex items-center gap-1.5 text-xs text-slate-500"><IdCard className="h-3.5 w-3.5" />{d.licenseNo}</div>}
                {d.notes && <div className="text-xs text-slate-500">{d.notes}</div>}
                <div className="mt-1 flex gap-2">
                  <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(d)}>Edit</Button>
                  <Button size="sm" variant="outline" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(d)}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Driver' : 'Add Driver'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <Input label="Name" required value={(form.name as string) ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ramesh Kumar" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={(form.phone as string) ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
            <Input label="License No." value={(form.licenseNo as string) ?? ''} onChange={(e) => setForm({ ...form, licenseNo: e.target.value })} />
          </div>
          <Select label="Status" value={(form.status as string) ?? 'available'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </Select>
          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add Driver'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
