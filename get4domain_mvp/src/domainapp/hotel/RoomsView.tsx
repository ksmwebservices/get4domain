'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, BedDouble, Users } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Room { id: string; number: string; roomType: string; capacity: number; pricePerNight: number; status: string; housekeeping: string; notes?: string }

const STATUS: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: '#16a34a' }, occupied: { label: 'Occupied', color: '#2563eb' }, maintenance: { label: 'Maintenance', color: '#f59e0b' },
};
const HK: Record<string, { label: string; color: string }> = {
  clean: { label: 'Clean', color: '#16a34a' }, dirty: { label: 'Needs cleaning', color: '#dc2626' }, in_progress: { label: 'Cleaning', color: '#f59e0b' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const emptyForm = (): Record<string, unknown> => ({ number: '', roomType: 'Standard', capacity: 2, pricePerNight: 0, status: 'available', housekeeping: 'clean', notes: '' });

export default function RoomsView() {
  const [rows, setRows] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getRooms().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (r: Room) => { setEditing(r); setForm({ ...r }); setOpen(true); };

  async function save() {
    if (!String(form.number).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, capacity: Number(form.capacity) || 1, pricePerNight: Number(form.pricePerNight) || 0 };
      editing ? await api.updateRoom(editing.id, payload) : await api.createRoom(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(r: Room) { if (confirm(`Delete room ${r.number}?`)) { await api.deleteRoom(r.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Rooms</h1><p className="mt-0.5 text-sm text-slate-500">Room inventory — type, rate, availability &amp; housekeeping.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Room</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="BedDouble" title="No rooms yet" subtitle="Add your rooms to manage inventory and reservations." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Room</Button>} /></Card>
        : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => {
              const s = STATUS[r.status] ?? STATUS.available; const hk = HK[r.housekeeping] ?? HK.clean;
              return (
                <Card key={r.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><BedDouble className="h-5 w-5" /></div>
                      <div><div className="text-sm font-bold text-slate-900">Room {r.number}</div><div className="text-xs text-slate-500">{r.roomType}</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{r.capacity}</span>
                    <span className="font-semibold text-slate-700">{inr(r.pricePerNight)}/night</span>
                    <Badge color={hk.color}>{hk.label}</Badge>
                  </div>
                  <div className="mt-1 flex gap-2">
                    <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(r)}>Edit</Button>
                    <Button size="sm" variant="outline" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(r)}>Delete</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Room' : 'Add Room'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Room number" required value={(form.number as string) ?? ''} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="101" />
            <Input label="Room type" value={(form.roomType as string) ?? ''} onChange={(e) => setForm({ ...form, roomType: e.target.value })} placeholder="Deluxe" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Capacity" type="number" value={(form.capacity as number) ?? 2} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            <Input label="Price / night (₹)" type="number" value={(form.pricePerNight as number) ?? 0} onChange={(e) => setForm({ ...form, pricePerNight: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={(form.status as string) ?? 'available'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <Select label="Housekeeping" value={(form.housekeeping as string) ?? 'clean'} onChange={(e) => setForm({ ...form, housekeeping: e.target.value })}>
              {Object.entries(HK).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </div>
          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
