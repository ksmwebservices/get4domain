'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, CalendarClock, Stethoscope, Phone, ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface DoctorRef { id: string; name: string; specialty?: string; consultationFee?: number }
interface Appt {
  id: string; patientName: string; patientPhone?: string; contactId?: string; doctorId?: string; startAt: string;
  durationMin: number; status: string; reason?: string; fee: number; diagnosis?: string; prescriptionNotes?: string;
  followUpDate?: string; notes?: string; doctor?: DoctorRef | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: '#64748b' }, confirmed: { label: 'Confirmed', color: '#2563eb' },
  completed: { label: 'Completed', color: '#16a34a' }, no_show: { label: 'No Show', color: '#f59e0b' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmtDT = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
const toLocalInput = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};
const emptyForm = (): Record<string, unknown> => ({ patientName: '', patientPhone: '', doctorId: '', startAt: toLocalInput(), durationMin: 30, status: 'scheduled', reason: '', fee: 0, diagnosis: '', prescriptionNotes: '', followUpDate: '' });

export default function AppointmentsView() {
  const [rows, setRows] = useState<Appt[]>([]);
  const [doctors, setDoctors] = useState<DoctorRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appt | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getClinicAppointments().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
    api.getDoctors().then((r) => setDoctors((r.data ?? []).map((d: DoctorRef) => ({ id: d.id, name: d.name, specialty: d.specialty, consultationFee: d.consultationFee })))).catch(() => setDoctors([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((a) => a.status === filter)), [rows, filter]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (a: Appt) => { setEditing(a); setForm({ ...a, startAt: toLocalInput(a.startAt), followUpDate: a.followUpDate?.slice(0, 10) ?? '' }); setOpen(true); };

  function pickDoctor(id: string) {
    const doc = doctors.find((d) => d.id === id);
    setForm((f) => ({ ...f, doctorId: id, fee: (!f.fee || Number(f.fee) === 0) && doc?.consultationFee ? doc.consultationFee : f.fee }));
  }

  async function save() {
    if (!String(form.patientName).trim() || !String(form.startAt).trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        durationMin: Number(form.durationMin) || 30,
        fee: Number(form.fee) || 0,
        startAt: new Date(form.startAt as string).toISOString(),
        doctorId: form.doctorId || undefined,
        followUpDate: form.followUpDate || undefined,
      };
      editing ? await api.updateClinicAppointment(editing.id, payload) : await api.createClinicAppointment(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(a: Appt) { if (confirm(`Delete appointment for ${a.patientName}?`)) { await api.deleteClinicAppointment(a.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Appointments</h1><p className="mt-0.5 text-sm text-slate-500">Scheduling with doctor assignment and visit tracking.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Appointment</Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {(['all', 'scheduled', 'confirmed', 'completed', 'no_show', 'cancelled'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${filter === f ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>{f === 'all' ? 'All' : STATUS[f].label}</button>
        ))}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="CalendarClock" title={rows.length ? 'Nothing here' : 'No appointments yet'} subtitle="Book a patient in with a doctor and track the visit." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Appointment</Button>} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((a) => {
              const s = STATUS[a.status] ?? STATUS.scheduled;
              return (
                <Card key={a.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><CalendarClock className="h-5 w-5" /></div>
                      <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{a.patientName}</div><div className="truncate text-xs text-slate-500">{fmtDT(a.startAt)} · {a.durationMin}m</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {a.doctor ? <span className="inline-flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" />{a.doctor.name}{a.doctor.specialty && ` · ${a.doctor.specialty}`}</span> : <span className="text-slate-400">Unassigned</span>}
                    {a.patientPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{a.patientPhone}</span>}
                    {a.fee > 0 && <span className="font-semibold text-slate-700">{inr(a.fee)}</span>}
                  </div>
                  {a.reason && <div className="line-clamp-1 text-xs text-slate-500">{a.reason}</div>}
                  {a.prescriptionNotes && <div className="flex items-center gap-1 text-xs text-success-600"><ClipboardList className="h-3.5 w-3.5" />Prescription recorded</div>}
                  <div className="mt-1 flex justify-end gap-1">
                    <button onClick={() => openEdit(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Appointment' : 'New Appointment'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Patient" required value={(form.patientName as string) ?? ''} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
            <Input label="Phone" value={(form.patientPhone as string) ?? ''} onChange={(e) => setForm({ ...form, patientPhone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Doctor" value={(form.doctorId as string) ?? ''} onChange={(e) => pickDoctor(e.target.value)}>
              <option value="">{doctors.length ? 'Unassigned' : 'Add doctors first'}</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` · ${d.specialty}` : ''}</option>)}
            </Select>
            <Select label="Status" value={(form.status as string) ?? 'scheduled'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Date & time" type="datetime-local" value={(form.startAt as string) ?? ''} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            <Input label="Duration (min)" type="number" value={(form.durationMin as number) ?? 30} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
            <Input label="Fee (₹)" type="number" value={(form.fee as number) ?? 0} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })} />
          </div>
          <Textarea label="Reason / symptoms" value={(form.reason as string) ?? ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <div className="rounded-xl border border-slate-100 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Visit notes</p>
            <div className="space-y-3">
              <Textarea label="Diagnosis" value={(form.diagnosis as string) ?? ''} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
              <Textarea label="Prescription" value={(form.prescriptionNotes as string) ?? ''} onChange={(e) => setForm({ ...form, prescriptionNotes: e.target.value })} />
              <Input label="Follow-up date" type="date" value={(form.followUpDate as string) ?? ''} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Book'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
