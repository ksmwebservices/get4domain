'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Car, Wrench, Package, X } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Line { id: string; kind: string; description: string; quantity: number; rate: number }
interface Job {
  id: string; vehicleNumber: string; vehicleModel?: string; customerName: string; contactId?: string; jobType: string; status: string;
  odometer?: number; complaint?: string; estimateAmount: number; promisedDate?: string; notes?: string; lines?: Line[];
}

const JOB_TYPES = ['General Service', 'Repair', 'Body Work', 'Insurance', 'Other'];
const STATUS: Record<string, { label: string; color: string }> = {
  received: { label: 'Received', color: '#64748b' }, in_service: { label: 'In Service', color: '#2563eb' },
  ready: { label: 'Ready', color: '#f59e0b' }, delivered: { label: 'Delivered', color: '#16a34a' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const emptyForm = (): Record<string, unknown> => ({ vehicleNumber: '', vehicleModel: '', customerName: '', jobType: 'General Service', status: 'received', odometer: 0, complaint: '', estimateAmount: 0, promisedDate: '' });

export default function JobsView() {
  const [rows, setRows] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Job | null>(null);
  const [newLine, setNewLine] = useState({ kind: 'labor', description: '', quantity: 1, rate: 0 });

  const load = useCallback(() => {
    setLoading(true);
    api.getJobs().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((j) => j.status === filter)), [rows, filter]);
  const lineTotal = (l: Line) => l.quantity * l.rate;
  const jobTotal = (j: Job) => (j.lines ?? []).reduce((s, l) => s + lineTotal(l), 0);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (j: Job) => { setEditing(j); setForm({ ...j, promisedDate: j.promisedDate?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.vehicleNumber).trim() || !String(form.customerName).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, odometer: Number(form.odometer) || undefined, estimateAmount: Number(form.estimateAmount) || 0, promisedDate: form.promisedDate || undefined };
      editing ? await api.updateJob(editing.id, payload) : await api.createJob(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(j: Job) { if (confirm(`Delete job for ${j.vehicleNumber}?`)) { await api.deleteJob(j.id); load(); } }

  async function refreshDetail(id: string) { const r = await api.getJob(id); setDetail(r.data ?? null); load(); }
  async function addLine() {
    if (!detail || !newLine.description.trim()) return;
    await api.addJobLine(detail.id, { ...newLine, quantity: Number(newLine.quantity) || 1, rate: Number(newLine.rate) || 0 });
    setNewLine({ kind: 'labor', description: '', quantity: 1, rate: 0 }); refreshDetail(detail.id);
  }
  async function delLine(l: Line) { if (!detail) return; await api.deleteJobLine(l.id); refreshDetail(detail.id); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Jobs</h1><p className="mt-0.5 text-sm text-slate-500">Service jobs — vehicle intake, status, parts &amp; labor.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Job</Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {(['all', 'received', 'in_service', 'ready', 'delivered'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${filter === f ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>{f === 'all' ? 'All' : STATUS[f].label}</button>
        ))}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="Wrench" title={rows.length ? 'Nothing here' : 'No jobs yet'} subtitle="Book a vehicle in for service and track parts and labor." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Job</Button>} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((j) => {
              const s = STATUS[j.status] ?? STATUS.received; const parts = (j.lines ?? []).filter((l) => l.kind === 'part').length; const total = jobTotal(j) || j.estimateAmount;
              return (
                <Card key={j.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Car className="h-5 w-5" /></div>
                      <div className="min-w-0"><div className="truncate text-sm font-bold uppercase text-slate-900">{j.vehicleNumber}</div><div className="truncate text-xs text-slate-500">{j.vehicleModel || j.customerName}</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{j.jobType}</span>
                    <span>{j.customerName}</span>
                    {j.promisedDate && <span>Promised {fmt(j.promisedDate)}</span>}
                  </div>
                  {j.complaint && <div className="line-clamp-1 text-xs text-slate-500">“{j.complaint}”</div>}
                  <div className="mt-1 flex items-center justify-between">
                    <button onClick={() => setDetail(j)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"><Package className="h-3.5 w-3.5" />{(j.lines ?? []).length} lines{parts > 0 && ` · ${parts} parts`} · {inr(total)}</button>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(j)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(j)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Job' : 'New Job'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Vehicle number" required value={(form.vehicleNumber as string) ?? ''} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} placeholder="MH12 AB 1234" />
            <Input label="Model" value={(form.vehicleModel as string) ?? ''} onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })} placeholder="Swift VDI" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Customer" required value={(form.customerName as string) ?? ''} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            <Input label="Odometer (km)" type="number" value={(form.odometer as number) ?? 0} onChange={(e) => setForm({ ...form, odometer: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Job type" value={(form.jobType as string) ?? 'General Service'} onChange={(e) => setForm({ ...form, jobType: e.target.value })}>{JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
            <Select label="Status" value={(form.status as string) ?? 'received'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
            <Input label="Promised" type="date" value={(form.promisedDate as string) ?? ''} onChange={(e) => setForm({ ...form, promisedDate: e.target.value })} />
          </div>
          <Textarea label="Complaint / work requested" value={(form.complaint as string) ?? ''} onChange={(e) => setForm({ ...form, complaint: e.target.value })} />
          <Input label="Estimate (₹)" type="number" value={(form.estimateAmount as number) ?? 0} onChange={(e) => setForm({ ...form, estimateAmount: Number(e.target.value) })} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Create'}</Button></div>
        </div>
      </Modal>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.vehicleNumber} — Parts & Labor` : ''} maxWidth="max-w-lg">
        {detail && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {(detail.lines ?? []).length === 0 ? <p className="text-sm text-slate-400">No parts or labor added yet.</p>
                : (detail.lines ?? []).map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {l.kind === 'part' ? <Package className="h-4 w-4 shrink-0 text-amber-500" /> : <Wrench className="h-4 w-4 shrink-0 text-blue-500" />}
                      <div className="min-w-0"><div className="truncate text-sm text-slate-800">{l.description}</div><div className="text-xs text-slate-400">{l.quantity} × {inr(l.rate)}</div></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">{inr(lineTotal(l))}</span>
                      <button onClick={() => delLine(l)} className="text-slate-300 hover:text-error-500"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-sm"><span className="font-medium text-slate-500">Total</span><span className="font-bold text-slate-900">{inr((detail.lines ?? []).reduce((s, l) => s + lineTotal(l), 0))}</span></div>
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2">
              <select value={newLine.kind} onChange={(e) => setNewLine({ ...newLine, kind: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm focus:outline-none"><option value="labor">Labor</option><option value="part">Part</option></select>
              <input value={newLine.description} onChange={(e) => setNewLine({ ...newLine, description: e.target.value })} placeholder="Description" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none" />
              <input value={newLine.quantity || ''} onChange={(e) => setNewLine({ ...newLine, quantity: Number(e.target.value) })} type="number" placeholder="Qty" className="w-14 rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm focus:outline-none" />
              <input value={newLine.rate || ''} onChange={(e) => setNewLine({ ...newLine, rate: Number(e.target.value) })} type="number" placeholder="₹" className="w-20 rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm focus:outline-none" />
              <Button variant="outline" onClick={addLine}>Add</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
