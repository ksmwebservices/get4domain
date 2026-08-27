'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Plane } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Trip { id: string; title: string }
interface Visa {
  id: string; travelerName: string; country: string; tripId?: string;
  passportNo?: string; visaType?: string; status: string;
  appliedDate?: string; decisionDate?: string; notes?: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  applied: { label: 'Applied', cls: 'bg-slate-100 text-slate-700' },
  in_process: { label: 'In Process', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-success-50 text-success-700' },
  rejected: { label: 'Rejected', cls: 'bg-error-50 text-error-700' },
};
const emptyForm = { travelerName: '', country: '', tripId: '', passportNo: '', visaType: '', status: 'applied', appliedDate: '', decisionDate: '', notes: '' };
const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function VisaView() {
  const [rows, setRows] = useState<Visa[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Visa | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getVisas().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
    api.getTrips().then((r) => setTrips(r.data ?? [])).catch(() => setTrips([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (v: Visa) => {
    setEditing(v);
    setForm({ ...v, appliedDate: v.appliedDate?.slice(0, 10) ?? '', decisionDate: v.decisionDate?.slice(0, 10) ?? '', tripId: v.tripId ?? '' });
    setOpen(true);
  };

  async function save() {
    if (!String(form.travelerName).trim() || !String(form.country).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, tripId: form.tripId || undefined, appliedDate: form.appliedDate || undefined, decisionDate: form.decisionDate || undefined };
      if (editing) await api.updateVisa(editing.id, payload);
      else await api.createVisa(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }

  async function setStatus(v: Visa, status: string) {
    setRows((prev) => prev.map((r) => (r.id === v.id ? { ...r, status } : r)));
    try { await api.updateVisa(v.id, { status }); } catch { load(); }
  }

  async function remove(v: Visa) {
    if (!confirm(`Delete visa for ${v.travelerName}?`)) return;
    await api.deleteVisa(v.id); load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Visa Tracker</h1>
          <p className="mt-0.5 text-sm text-slate-500">Track each traveler&apos;s visa from applied through to approved or rejected.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Application</Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <Card padded>
          <EmptyState icon="Stamp" title="No visa applications yet" subtitle="Add a traveler's visa application to start tracking its status."
            action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Application</Button>} />
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((v) => {
            const trip = trips.find((t) => t.id === v.tripId);
            return (
              <Card key={v.id} padded className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{v.travelerName}</span>
                    <span className="text-xs text-slate-500">→ {v.country}{v.visaType ? ` · ${v.visaType}` : ''}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {v.passportNo && <span>Passport {v.passportNo}</span>}
                    {v.appliedDate && <span>Applied {fmt(v.appliedDate)}</span>}
                    {v.decisionDate && <span>Decision {fmt(v.decisionDate)}</span>}
                    {trip && <span className="inline-flex items-center gap-1"><Plane className="h-3 w-3" />{trip.title}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={v.status} onChange={(e) => setStatus(v, e.target.value)}
                    className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${STATUS[v.status]?.cls ?? STATUS.applied.cls}`}>
                    {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                  </select>
                  <button onClick={() => openEdit(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Visa Application' : 'New Visa Application'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Traveler name" required value={(form.travelerName as string) ?? ''} onChange={(e) => setForm({ ...form, travelerName: e.target.value })} />
            <Input label="Destination country" required value={(form.country as string) ?? ''} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="United Arab Emirates" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Passport no." value={(form.passportNo as string) ?? ''} onChange={(e) => setForm({ ...form, passportNo: e.target.value })} />
            <Input label="Visa type" value={(form.visaType as string) ?? ''} onChange={(e) => setForm({ ...form, visaType: e.target.value })} placeholder="Tourist" />
          </div>
          <Select label="Linked trip (optional)" value={(form.tripId as string) ?? ''} onChange={(e) => setForm({ ...form, tripId: e.target.value })}>
            <option value="">None</option>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Applied date" type="date" value={(form.appliedDate as string) ?? ''} onChange={(e) => setForm({ ...form, appliedDate: e.target.value })} />
            <Input label="Decision date" type="date" value={(form.decisionDate as string) ?? ''} onChange={(e) => setForm({ ...form, decisionDate: e.target.value })} />
          </div>
          <Select label="Status" value={(form.status as string) ?? 'applied'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </Select>
          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>{editing ? 'Save' : 'Create'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
