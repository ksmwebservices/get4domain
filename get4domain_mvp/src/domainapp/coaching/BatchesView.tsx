'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Layers, Users, CalendarClock, CheckCircle2, Circle, XCircle, X } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Session { id: string; topic: string; date?: string; startTime?: string; status: string }
interface Batch {
  id: string; name: string; subject?: string; faculty?: string; timing?: string; mode: string;
  startDate?: string; capacity: number; fee: number; status: string; _count?: { enrollments: number }; sessions?: Session[];
}

const STATUS: Record<string, { label: string; color: string }> = {
  upcoming: { label: 'Upcoming', color: '#64748b' }, active: { label: 'Active', color: '#16a34a' }, completed: { label: 'Completed', color: '#2563eb' },
};
const SESSION_STATUS: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  scheduled: { label: 'Scheduled', color: '#2563eb', icon: Circle },
  held: { label: 'Held', color: '#16a34a', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: '#dc2626', icon: XCircle },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const emptyForm = (): Record<string, unknown> => ({ name: '', subject: '', faculty: '', timing: '', mode: 'Classroom', startDate: '', capacity: 30, fee: 0, status: 'upcoming' });

export default function BatchesView() {
  const [rows, setRows] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Batch | null>(null);
  const [newSession, setNewSession] = useState({ topic: '', date: '', startTime: '' });

  const load = useCallback(() => {
    setLoading(true);
    api.getCoachingBatches().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (b: Batch) => { setEditing(b); setForm({ ...b, startDate: b.startDate?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.name).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, capacity: Number(form.capacity) || 30, fee: Number(form.fee) || 0, startDate: form.startDate || undefined };
      editing ? await api.updateCoachingBatch(editing.id, payload) : await api.createCoachingBatch(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(b: Batch) { if (confirm(`Delete batch ${b.name}?`)) { await api.deleteCoachingBatch(b.id); load(); } }

  async function refreshDetail(id: string) { const r = await api.getCoachingBatch(id); setDetail(r.data ?? null); load(); }
  async function cycleSession(s: Session) {
    if (!detail) return;
    const next = s.status === 'scheduled' ? 'held' : s.status === 'held' ? 'cancelled' : 'scheduled';
    await api.updateCoachingSession(s.id, { status: next });
    refreshDetail(detail.id);
  }
  async function addSession() {
    if (!detail || !newSession.topic.trim()) return;
    await api.addCoachingSession(detail.id, { topic: newSession.topic.trim(), date: newSession.date || undefined, startTime: newSession.startTime || undefined });
    setNewSession({ topic: '', date: '', startTime: '' }); refreshDetail(detail.id);
  }
  async function delSession(s: Session) { if (!detail) return; await api.deleteCoachingSession(s.id); refreshDetail(detail.id); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Batches</h1><p className="mt-0.5 text-sm text-slate-500">Batches with faculty, timing and session scheduling.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Batch</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="Layers" title="No batches yet" subtitle="Create a batch and schedule its class sessions." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Batch</Button>} /></Card>
        : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((b) => {
              const s = STATUS[b.status] ?? STATUS.upcoming; const held = (b.sessions ?? []).filter((x) => x.status === 'held').length; const total = (b.sessions ?? []).length;
              return (
                <Card key={b.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Layers className="h-5 w-5" /></div>
                      <div><div className="text-sm font-bold text-slate-900">{b.name}</div><div className="text-xs text-slate-500">{b.subject || b.mode}</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {b.faculty && <span>{b.faculty}</span>}
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{b._count?.enrollments ?? 0}/{b.capacity}</span>
                    {b.fee > 0 && <span className="font-semibold text-slate-700">{inr(b.fee)}</span>}
                  </div>
                  {b.timing && <div className="flex items-center gap-1 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" />{b.timing}</div>}
                  <div className="mt-1 flex items-center justify-between">
                    <button onClick={() => setDetail(b)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"><CalendarClock className="h-3.5 w-3.5" />{held}/{total} sessions</button>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(b)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(b)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Batch' : 'Add Batch'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Batch name" required value={(form.name as string) ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="NEET 2027 Evening" />
            <Input label="Subject" value={(form.subject as string) ?? ''} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Physics" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Faculty" value={(form.faculty as string) ?? ''} onChange={(e) => setForm({ ...form, faculty: e.target.value })} />
            <Select label="Mode" value={(form.mode as string) ?? 'Classroom'} onChange={(e) => setForm({ ...form, mode: e.target.value })}>{['Classroom', 'Online', 'Hybrid'].map((m) => <option key={m} value={m}>{m}</option>)}</Select>
            <Select label="Status" value={(form.status as string) ?? 'upcoming'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          </div>
          <Input label="Timing" value={(form.timing as string) ?? ''} onChange={(e) => setForm({ ...form, timing: e.target.value })} placeholder="Mon/Wed/Fri 6–8pm" />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Start date" type="date" value={(form.startDate as string) ?? ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="Capacity" type="number" value={(form.capacity as number) ?? 30} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            <Input label="Fee (₹)" type="number" value={(form.fee as number) ?? 0} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.name} — Sessions` : ''} maxWidth="max-w-lg">
        {detail && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {(detail.sessions ?? []).length === 0 ? <p className="text-sm text-slate-400">No sessions scheduled yet.</p>
                : (detail.sessions ?? []).map((s) => {
                  const ss = SESSION_STATUS[s.status] ?? SESSION_STATUS.scheduled; const Icon = ss.icon;
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <button onClick={() => cycleSession(s)} className="flex min-w-0 items-center gap-2 text-left">
                        <Icon className="h-4 w-4 shrink-0" style={{ color: ss.color }} />
                        <div className="min-w-0"><div className={`truncate text-sm ${s.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{s.topic}</div><div className="text-xs text-slate-400">{fmt(s.date)}{s.startTime && ` · ${s.startTime}`}</div></div>
                      </button>
                      <div className="flex items-center gap-2">
                        <Badge color={ss.color}>{ss.label}</Badge>
                        <button onClick={() => delSession(s)} className="text-slate-300 hover:text-error-500"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className="text-[11px] text-slate-400">Tap a session to cycle Scheduled → Held → Cancelled.</p>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
              <input value={newSession.topic} onChange={(e) => setNewSession({ ...newSession, topic: e.target.value })} placeholder="Topic" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none" />
              <input value={newSession.date} onChange={(e) => setNewSession({ ...newSession, date: e.target.value })} type="date" className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm focus:outline-none" />
              <input value={newSession.startTime} onChange={(e) => setNewSession({ ...newSession, startTime: e.target.value })} placeholder="6pm" className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm focus:outline-none" />
              <Button variant="outline" onClick={addSession}>Add</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
