'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Clock, UserCog, Armchair, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Ref { id: string; name: string }
interface Appt {
  id: string; contactId?: string; clientName: string; clientPhone?: string; serviceName: string;
  stylistId?: string; chairId?: string; startAt: string; durationMin: number; price: number; status: string; notes?: string;
  stylist?: Ref | null; chair?: Ref | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: '#64748b' }, confirmed: { label: 'Confirmed', color: '#2563eb' },
  completed: { label: 'Completed', color: '#16a34a' }, no_show: { label: 'No Show', color: '#f59e0b' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const toLocalInput = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const emptyForm = (): Record<string, unknown> => ({ clientName: '', clientPhone: '', serviceName: '', stylistId: '', chairId: '', startAt: '', durationMin: 45, price: 0, status: 'scheduled', notes: '' });

export default function SalonScheduleView() {
  const [rows, setRows] = useState<Appt[]>([]);
  const [stylists, setStylists] = useState<Ref[]>([]);
  const [chairs, setChairs] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appt | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getSalonAppointments().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
    api.getStylists().then((r) => setStylists(r.data ?? [])).catch(() => setStylists([]));
    api.getChairs().then((r) => setChairs(r.data ?? [])).catch(() => setChairs([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (a: Appt) => {
    setEditing(a);
    setForm({ clientName: a.clientName, clientPhone: a.clientPhone ?? '', serviceName: a.serviceName, stylistId: a.stylistId ?? '', chairId: a.chairId ?? '', startAt: toLocalInput(a.startAt), durationMin: a.durationMin, price: a.price, status: a.status, notes: a.notes ?? '' });
    setOpen(true);
  };

  async function save() {
    if (!String(form.clientName).trim() || !String(form.serviceName).trim() || !String(form.startAt)) return;
    setSaving(true);
    try {
      const payload = { ...form, durationMin: Number(form.durationMin) || 45, price: Number(form.price) || 0, stylistId: form.stylistId || undefined, chairId: form.chairId || undefined, startAt: new Date(form.startAt as string).toISOString() };
      editing ? await api.updateSalonAppointment(editing.id, payload) : await api.createSalonAppointment(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function setStatus(a: Appt, status: string) {
    setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, status } : r)));
    try { await api.updateSalonAppointment(a.id, { status }); } catch { load(); }
  }
  async function remove(a: Appt) { if (confirm(`Delete appointment for ${a.clientName}?`)) { await api.deleteSalonAppointment(a.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Appointments</h1><p className="mt-0.5 text-sm text-slate-500">Schedule services, assign a stylist and chair, track status.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Appointment</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="CalendarClock" title="No appointments yet" subtitle="Book your first appointment to start scheduling." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Appointment</Button>} /></Card>
        : (
          <div className="space-y-2">
            {rows.map((a) => (
              <Card key={a.id} padded className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{a.clientName}</span><span className="text-xs text-slate-500">· {a.serviceName}</span></div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmt(a.startAt)} · {a.durationMin}m</span>
                    {a.stylist && <span className="inline-flex items-center gap-1"><UserCog className="h-3.5 w-3.5" />{a.stylist.name}</span>}
                    {a.chair && <span className="inline-flex items-center gap-1"><Armchair className="h-3.5 w-3.5" />{a.chair.name}</span>}
                    {a.price > 0 && <span className="font-semibold text-slate-700">{inr(a.price)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={a.status} onChange={(e) => setStatus(a, e.target.value)}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button onClick={() => openEdit(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
            ))}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Appointment' : 'New Appointment'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Client name" required value={(form.clientName as string) ?? ''} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
            <Input label="Client phone" value={(form.clientPhone as string) ?? ''} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} />
          </div>
          <Input label="Service" required value={(form.serviceName as string) ?? ''} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} placeholder="Hair Cut & Style" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Stylist" value={(form.stylistId as string) ?? ''} onChange={(e) => setForm({ ...form, stylistId: e.target.value })}>
              <option value="">{stylists.length ? 'Unassigned' : 'Add stylists first'}</option>
              {stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select label="Chair" value={(form.chairId as string) ?? ''} onChange={(e) => setForm({ ...form, chairId: e.target.value })}>
              <option value="">{chairs.length ? 'None' : 'Add chairs first'}</option>
              {chairs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Date & time" type="datetime-local" required value={(form.startAt as string) ?? ''} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            <Input label="Duration (min)" type="number" value={(form.durationMin as number) ?? 45} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
            <Input label="Price (₹)" type="number" value={(form.price as number) ?? 0} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </div>
          <Select label="Status" value={(form.status as string) ?? 'scheduled'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Book'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
