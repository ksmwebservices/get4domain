'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Briefcase, FileCheck2, Clock, CheckCircle2, Circle, MinusCircle, X } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface DocItem { id: string; name: string; required: boolean; status: string; notes?: string }
interface Engagement {
  id: string; title: string; clientName: string; engagementType: string; billingType: string; status: string;
  feeValue: number; hourlyRate?: number; assignedTo?: string; startDate?: string; dueDate?: string;
  description?: string; notes?: string; documents?: DocItem[];
}

const TYPES = ['Consulting', 'Legal', 'Advisory', 'Retainer', 'Other'];
const BILLING = ['Fixed', 'Hourly', 'Retainer'];
const STATUS: Record<string, { label: string; color: string }> = {
  proposal: { label: 'Proposal', color: '#64748b' }, active: { label: 'Active', color: '#2563eb' },
  on_hold: { label: 'On Hold', color: '#f59e0b' }, completed: { label: 'Completed', color: '#16a34a' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const DOC_STATUS: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  pending: { label: 'Pending', color: '#f59e0b', icon: Circle },
  received: { label: 'Received', color: '#16a34a', icon: CheckCircle2 },
  waived: { label: 'Waived', color: '#94a3b8', icon: MinusCircle },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const emptyForm = (): Record<string, unknown> => ({ title: '', clientName: '', engagementType: 'Consulting', billingType: 'Fixed', status: 'proposal', feeValue: 0, hourlyRate: 0, assignedTo: '', startDate: '', dueDate: '', description: '' });

export default function EngagementsView() {
  const [rows, setRows] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Engagement | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Engagement | null>(null);
  const [newDoc, setNewDoc] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.getEngagements().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (e: Engagement) => { setEditing(e); setForm({ ...e, startDate: e.startDate?.slice(0, 10) ?? '', dueDate: e.dueDate?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.title).trim() || !String(form.clientName).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, feeValue: Number(form.feeValue) || 0, hourlyRate: Number(form.hourlyRate) || undefined, startDate: form.startDate || undefined, dueDate: form.dueDate || undefined };
      editing ? await api.updateEngagement(editing.id, payload) : await api.createEngagement(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(e: Engagement) { if (confirm(`Delete engagement "${e.title}"?`)) { await api.deleteEngagement(e.id); load(); } }

  // Document checklist actions (operate on the open detail engagement)
  async function refreshDetail(id: string) { const r = await api.getEngagement(id); setDetail(r.data ?? null); load(); }
  async function cycleDoc(d: DocItem) {
    if (!detail) return;
    const next = d.status === 'pending' ? 'received' : d.status === 'received' ? 'waived' : 'pending';
    await api.updateEngagementDocument(d.id, { status: next });
    refreshDetail(detail.id);
  }
  async function addDoc() {
    if (!detail || !newDoc.trim()) return;
    await api.addEngagementDocument(detail.id, { name: newDoc.trim(), required: true });
    setNewDoc(''); refreshDetail(detail.id);
  }
  async function delDoc(d: DocItem) { if (!detail) return; await api.deleteEngagementDocument(d.id); refreshDetail(detail.id); }

  const docProgress = (e: Engagement) => {
    const docs = e.documents ?? []; const done = docs.filter((d) => d.status !== 'pending').length; return { done, total: docs.length };
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Engagements</h1><p className="mt-0.5 text-sm text-slate-500">Case &amp; engagement tracking with a document checklist per type.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Engagement</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="Briefcase" title="No engagements yet" subtitle="Open an engagement to track its lifecycle and required documents." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Engagement</Button>} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((e) => {
              const s = STATUS[e.status] ?? STATUS.proposal; const dp = docProgress(e); const allDocs = dp.total > 0 && dp.done === dp.total;
              return (
                <Card key={e.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Briefcase className="h-5 w-5" /></div>
                      <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{e.title}</div><div className="truncate text-xs text-slate-500">{e.clientName}</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{e.engagementType}</span>
                    <span>{e.billingType === 'Hourly' ? `${inr(e.hourlyRate ?? 0)}/hr` : inr(e.feeValue)}</span>
                    {e.dueDate && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Due {fmt(e.dueDate)}</span>}
                    {e.assignedTo && <span>· {e.assignedTo}</span>}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <button onClick={() => setDetail(e)} className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${allDocs ? 'bg-success-50 text-success-700' : 'bg-gold-50 text-gold-700'}`}>
                      <FileCheck2 className="h-3.5 w-3.5" />{dp.done}/{dp.total} docs
                    </button>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      {/* Create / edit engagement */}
      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Engagement' : 'New Engagement'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Title" required value={(form.title as string) ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="GST advisory FY27" />
            <Input label="Client" required value={(form.clientName as string) ?? ''} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Type" value={(form.engagementType as string) ?? 'Consulting'} onChange={(e) => setForm({ ...form, engagementType: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
            <Select label="Billing" value={(form.billingType as string) ?? 'Fixed'} onChange={(e) => setForm({ ...form, billingType: e.target.value })}>{BILLING.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
            <Select label="Status" value={(form.status as string) ?? 'proposal'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label={form.billingType === 'Hourly' ? 'Est. value (₹)' : 'Fee (₹)'} type="number" value={(form.feeValue as number) ?? 0} onChange={(e) => setForm({ ...form, feeValue: Number(e.target.value) })} />
            {form.billingType === 'Hourly' && <Input label="Rate (₹/hr)" type="number" value={(form.hourlyRate as number) ?? 0} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })} />}
            <Input label="Assigned to" value={(form.assignedTo as string) ?? ''} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start" type="date" value={(form.startDate as string) ?? ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="Due" type="date" value={(form.dueDate as string) ?? ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <Textarea label="Description" value={(form.description as string) ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {!editing && <p className="text-xs text-slate-400">A standard document checklist for this engagement type is added automatically.</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Create'}</Button></div>
        </div>
      </Modal>

      {/* Document checklist detail */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.title} — Documents` : ''} maxWidth="max-w-lg">
        {detail && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {(detail.documents ?? []).length === 0 ? <p className="text-sm text-slate-400">No documents on this engagement yet.</p>
                : (detail.documents ?? []).map((d) => {
                  const ds = DOC_STATUS[d.status] ?? DOC_STATUS.pending; const Icon = ds.icon;
                  return (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <button onClick={() => cycleDoc(d)} className="flex min-w-0 items-center gap-2 text-left">
                        <Icon className="h-4 w-4 shrink-0" style={{ color: ds.color }} />
                        <span className={`truncate text-sm ${d.status === 'received' ? 'text-slate-900' : d.status === 'waived' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{d.name}</span>
                        {d.required && <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">req</span>}
                      </button>
                      <div className="flex items-center gap-2">
                        <Badge color={ds.color}>{ds.label}</Badge>
                        <button onClick={() => delDoc(d)} className="text-slate-300 hover:text-error-500"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className="text-[11px] text-slate-400">Tap a document to cycle Pending → Received → Waived.</p>
            <div className="flex gap-2">
              <input value={newDoc} onChange={(e) => setNewDoc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDoc()} placeholder="Add a document…" className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              <Button variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={addDoc}>Add</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
