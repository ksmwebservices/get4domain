'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, UserCog, Phone, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Doctor {
  id: string; name: string; specialty?: string; phone?: string; email?: string; consultationFee: number; availability?: string; active: boolean;
}

const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const emptyForm = (): Record<string, unknown> => ({ name: '', specialty: '', phone: '', email: '', consultationFee: 0, availability: '', active: true });

export default function DoctorsView() {
  const [rows, setRows] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getDoctors().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (d: Doctor) => { setEditing(d); setForm({ ...d }); setOpen(true); };

  async function save() {
    if (!String(form.name).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, consultationFee: Number(form.consultationFee) || 0 };
      editing ? await api.updateDoctor(editing.id, payload) : await api.createDoctor(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(d: Doctor) { if (confirm(`Delete Dr. ${d.name}?`)) { await api.deleteDoctor(d.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Doctors</h1><p className="mt-0.5 text-sm text-slate-500">Specialist roster — appointments are assigned to a doctor.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Doctor</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="UserCog" title="No doctors yet" subtitle="Add a doctor so appointments can be assigned." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Doctor</Button>} /></Card>
        : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((d) => (
              <Card key={d.id} padded className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><UserCog className="h-5 w-5" /></div>
                    <div><div className="text-sm font-bold text-slate-900">{d.name}</div><div className="text-xs text-slate-500">{d.specialty || 'General'}</div></div>
                  </div>
                  {!d.active && <Badge color="#64748b">Inactive</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {d.consultationFee > 0 && <span className="font-semibold text-slate-700">{inr(d.consultationFee)}</span>}
                  {d.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{d.phone}</span>}
                </div>
                {d.availability && <div className="flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" />{d.availability}</div>}
                <div className="mt-1 flex gap-2">
                  <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(d)}>Edit</Button>
                  <Button size="sm" variant="outline" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(d)}>Delete</Button>
                </div>
              </Card>
            ))}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Doctor' : 'Add Doctor'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" required value={(form.name as string) ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. Meera Rao" />
            <Input label="Specialty" value={(form.specialty as string) ?? ''} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Cardiologist" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={(form.phone as string) ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Consultation fee (₹)" type="number" value={(form.consultationFee as number) ?? 0} onChange={(e) => setForm({ ...form, consultationFee: Number(e.target.value) })} />
          </div>
          <Input label="Availability" value={(form.availability as string) ?? ''} onChange={(e) => setForm({ ...form, availability: e.target.value })} placeholder="Mon–Fri 10am–2pm" />
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="accent-brand-500" checked={Boolean(form.active)} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Accepting appointments</label>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
