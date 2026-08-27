'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Camera, MapPin, Clock, Package2, CheckCircle2, Circle, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Deliverable { id: string; name: string; status: string; dueDate?: string }
interface Shoot {
  id: string; title: string; clientName: string; contactId?: string; eventType: string; eventDate?: string; venue?: string;
  coverageHours?: number; status: string; packageValue: number; advancePaid: number; deliveryDueDate?: string; galleryUrl?: string; deliverables?: Deliverable[];
}

const TYPES = ['Wedding', 'Pre-Wedding', 'Portrait', 'Product', 'Event', 'Other'];
const STATUS: Record<string, { label: string; color: string }> = {
  enquiry: { label: 'Enquiry', color: '#64748b' }, confirmed: { label: 'Confirmed', color: '#2563eb' },
  shot: { label: 'Shot Done', color: '#f59e0b' }, delivered: { label: 'Delivered', color: '#16a34a' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const DEL_STATUS: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  pending: { label: 'Pending', color: '#94a3b8', icon: Circle },
  in_progress: { label: 'Editing', color: '#f59e0b', icon: Loader2 },
  delivered: { label: 'Delivered', color: '#16a34a', icon: CheckCircle2 },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const emptyForm = (): Record<string, unknown> => ({ title: '', clientName: '', eventType: 'Wedding', eventDate: '', venue: '', coverageHours: 0, status: 'enquiry', packageValue: 0, advancePaid: 0, deliveryDueDate: '', galleryUrl: '' });

export default function ShootsView() {
  const [rows, setRows] = useState<Shoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shoot | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Shoot | null>(null);
  const [newDel, setNewDel] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.getShoots().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (s: Shoot) => { setEditing(s); setForm({ ...s, eventDate: s.eventDate?.slice(0, 10) ?? '', deliveryDueDate: s.deliveryDueDate?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.title).trim() || !String(form.clientName).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, coverageHours: Number(form.coverageHours) || undefined, packageValue: Number(form.packageValue) || 0, advancePaid: Number(form.advancePaid) || 0, eventDate: form.eventDate || undefined, deliveryDueDate: form.deliveryDueDate || undefined };
      editing ? await api.updateShoot(editing.id, payload) : await api.createShoot(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(s: Shoot) { if (confirm(`Delete shoot "${s.title}"?`)) { await api.deleteShoot(s.id); load(); } }

  async function refreshDetail(id: string) { const r = await api.getShoot(id); setDetail(r.data ?? null); load(); }
  async function cycleDel(d: Deliverable) {
    if (!detail) return;
    const next = d.status === 'pending' ? 'in_progress' : d.status === 'in_progress' ? 'delivered' : 'pending';
    await api.updateDeliverable(d.id, { status: next });
    refreshDetail(detail.id);
  }
  async function addDel() {
    if (!detail || !newDel.trim()) return;
    await api.addDeliverable(detail.id, { name: newDel.trim() });
    setNewDel(''); refreshDetail(detail.id);
  }
  async function delDel(d: Deliverable) { if (!detail) return; await api.deleteDeliverable(d.id); refreshDetail(detail.id); }

  const delProgress = (s: Shoot) => { const d = s.deliverables ?? []; return { done: d.filter((x) => x.status === 'delivered').length, total: d.length }; };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Bookings</h1><p className="mt-0.5 text-sm text-slate-500">Shoot scheduling with deliverables and delivery tracking.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Shoot</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="Camera" title="No shoots yet" subtitle="Book a shoot and track its deliverables to handover." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Shoot</Button>} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((s) => {
              const st = STATUS[s.status] ?? STATUS.enquiry; const dp = delProgress(s); const balance = Math.max(0, s.packageValue - s.advancePaid);
              return (
                <Card key={s.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Camera className="h-5 w-5" /></div>
                      <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{s.title}</div><div className="truncate text-xs text-slate-500">{s.clientName}</div></div>
                    </div>
                    <Badge color={st.color}>{st.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{s.eventType}</span>
                    {s.eventDate && <span>{fmt(s.eventDate)}</span>}
                    {s.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.venue}</span>}
                    {s.coverageHours ? <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{s.coverageHours}h</span> : null}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Advance <span className="font-semibold text-slate-700">{inr(s.advancePaid)}</span> / {inr(s.packageValue)}</span>
                    {balance > 0 && <span className="font-medium text-error-600">{inr(balance)} balance</span>}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <button onClick={() => setDetail(s)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"><Package2 className="h-3.5 w-3.5" />{dp.done}/{dp.total} delivered</button>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Shoot' : 'New Shoot'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Title" required value={(form.title as string) ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Riya & Arjun Wedding" />
            <Input label="Client" required value={(form.clientName as string) ?? ''} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Type" value={(form.eventType as string) ?? 'Wedding'} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
            <Input label="Event date" type="date" value={(form.eventDate as string) ?? ''} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
            <Select label="Status" value={(form.status as string) ?? 'enquiry'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Venue" value={(form.venue as string) ?? ''} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
            <Input label="Coverage (hrs)" type="number" value={(form.coverageHours as number) ?? 0} onChange={(e) => setForm({ ...form, coverageHours: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Package (₹)" type="number" value={(form.packageValue as number) ?? 0} onChange={(e) => setForm({ ...form, packageValue: Number(e.target.value) })} />
            <Input label="Advance (₹)" type="number" value={(form.advancePaid as number) ?? 0} onChange={(e) => setForm({ ...form, advancePaid: Number(e.target.value) })} />
            <Input label="Delivery due" type="date" value={(form.deliveryDueDate as string) ?? ''} onChange={(e) => setForm({ ...form, deliveryDueDate: e.target.value })} />
          </div>
          {!editing && <p className="text-xs text-slate-400">A standard deliverable set for this shoot type is added automatically.</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Create'}</Button></div>
        </div>
      </Modal>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.title} — Deliverables` : ''} maxWidth="max-w-lg">
        {detail && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {(detail.deliverables ?? []).length === 0 ? <p className="text-sm text-slate-400">No deliverables yet.</p>
                : (detail.deliverables ?? []).map((d) => {
                  const ds = DEL_STATUS[d.status] ?? DEL_STATUS.pending; const Icon = ds.icon;
                  return (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <button onClick={() => cycleDel(d)} className="flex min-w-0 items-center gap-2 text-left">
                        <Icon className={`h-4 w-4 shrink-0 ${d.status === 'in_progress' ? 'animate-spin' : ''}`} style={{ color: ds.color }} />
                        <span className={`truncate text-sm ${d.status === 'delivered' ? 'text-slate-900' : 'text-slate-700'}`}>{d.name}</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <Badge color={ds.color}>{ds.label}</Badge>
                        <button onClick={() => delDel(d)} className="text-slate-300 hover:text-error-500"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className="text-[11px] text-slate-400">Tap a deliverable to cycle Pending → Editing → Delivered.</p>
            <div className="flex gap-2">
              <input value={newDel} onChange={(e) => setNewDel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDel()} placeholder="Add a deliverable…" className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100" />
              <Button variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={addDel}>Add</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
