'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, BedDouble, Users, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface RoomRef { id: string; number: string; roomType?: string }
interface Booking {
  id: string; guestName: string; guestPhone?: string; roomId?: string; checkIn: string; checkOut: string;
  guests: number; totalAmount: number; status: string; notes?: string; room?: RoomRef | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
  booked: { label: 'Booked', color: '#64748b' }, confirmed: { label: 'Confirmed', color: '#2563eb' },
  checked_in: { label: 'Checked In', color: '#f59e0b' }, checked_out: { label: 'Checked Out', color: '#16a34a' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const emptyForm = (): Record<string, unknown> => ({ guestName: '', guestPhone: '', roomId: '', checkIn: '', checkOut: '', guests: 1, totalAmount: 0, status: 'booked', notes: '' });

export default function ReservationsView() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<RoomRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getRoomBookings().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
    api.getRooms().then((r) => setRooms((r.data ?? []).map((x: RoomRef & { number: string }) => ({ id: x.id, number: x.number, roomType: (x as RoomRef).roomType })))).catch(() => setRooms([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (b: Booking) => { setEditing(b); setForm({ ...b, roomId: b.roomId ?? '', checkIn: b.checkIn?.slice(0, 10), checkOut: b.checkOut?.slice(0, 10) }); setOpen(true); };

  async function save() {
    if (!String(form.guestName).trim() || !String(form.checkIn) || !String(form.checkOut)) return;
    setSaving(true);
    try {
      const payload = { ...form, guests: Number(form.guests) || 1, totalAmount: Number(form.totalAmount) || 0, roomId: form.roomId || undefined };
      editing ? await api.updateRoomBooking(editing.id, payload) : await api.createRoomBooking(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function setStatus(b: Booking, status: string) {
    setRows((prev) => prev.map((r) => (r.id === b.id ? { ...r, status } : r)));
    try { await api.updateRoomBooking(b.id, { status }); } catch { load(); }
  }
  async function remove(b: Booking) { if (confirm(`Delete reservation for ${b.guestName}?`)) { await api.deleteRoomBooking(b.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Reservations</h1><p className="mt-0.5 text-sm text-slate-500">Room bookings with check-in / check-out and status.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Reservation</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="CalendarClock" title="No reservations yet" subtitle="Create your first room booking." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Reservation</Button>} /></Card>
        : (
          <div className="space-y-2">
            {rows.map((b) => (
              <Card key={b.id} padded className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{b.guestName}</span>{b.room && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><BedDouble className="h-3.5 w-3.5" />Room {b.room.number}</span>}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{fmt(b.checkIn)} → {fmt(b.checkOut)}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{b.guests}</span>
                    {b.totalAmount > 0 && <span className="font-semibold text-slate-700">{inr(b.totalAmount)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={b.status} onChange={(e) => setStatus(b, e.target.value)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button onClick={() => openEdit(b)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(b)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
            ))}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Reservation' : 'New Reservation'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Guest name" required value={(form.guestName as string) ?? ''} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
            <Input label="Phone" value={(form.guestPhone as string) ?? ''} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} />
          </div>
          <Select label="Room" value={(form.roomId as string) ?? ''} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
            <option value="">{rooms.length ? 'Unassigned' : 'Add rooms first'}</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.number}{r.roomType ? ` · ${r.roomType}` : ''}</option>)}
          </Select>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Check-in" type="date" required value={(form.checkIn as string) ?? ''} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
            <Input label="Check-out" type="date" required value={(form.checkOut as string) ?? ''} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
            <Input label="Guests" type="number" value={(form.guests as number) ?? 1} onChange={(e) => setForm({ ...form, guests: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Total (₹)" type="number" value={(form.totalAmount as number) ?? 0} onChange={(e) => setForm({ ...form, totalAmount: Number(e.target.value) })} />
            <Select label="Status" value={(form.status as string) ?? 'booked'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </div>
          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Book'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
