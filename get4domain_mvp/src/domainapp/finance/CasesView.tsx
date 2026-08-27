'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Landmark, FileCheck2, CalendarClock, CheckCircle2, Circle, MinusCircle, X } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface DocItem { id: string; name: string; required: boolean; status: string }
interface FinCase {
  id: string; title: string; clientName: string; contactId?: string; caseType: string; status: string;
  feeValue: number; filingDeadline?: string; assignedTo?: string; notes?: string; documents?: DocItem[];
}

const TYPES = ['ITR', 'GST', 'Audit', 'Loan', 'Insurance', 'Other'];
const STATUS: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: '#64748b' }, in_review: { label: 'In Review', color: '#2563eb' },
  filed: { label: 'Filed', color: '#f59e0b' }, closed: { label: 'Closed', color: '#16a34a' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const DOC_STATUS: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  pending: { label: 'Pending', color: '#f59e0b', icon: Circle },
  received: { label: 'Received', color: '#16a34a', icon: CheckCircle2 },
  waived: { label: 'Waived', color: '#94a3b8', icon: MinusCircle },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const daysTo = (iso?: string) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null);
const emptyForm = (): Record<string, unknown> => ({ title: '', clientName: '', caseType: 'ITR', status: 'open', feeValue: 0, filingDeadline: '', assignedTo: '', notes: '' });

export default function CasesView() {
  const [rows, setRows] = useState<FinCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinCase | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<FinCase | null>(null);
  const [newDoc, setNewDoc] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.getCases().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (c: FinCase) => { setEditing(c); setForm({ ...c, filingDeadline: c.filingDeadline?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.title).trim() || !String(form.clientName).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, feeValue: Number(form.feeValue) || 0, filingDeadline: form.filingDeadline || undefined };
      editing ? await api.updateCase(editing.id, payload) : await api.createCase(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(c: FinCase) { if (confirm(`Delete case "${c.title}"?`)) { await api.deleteCase(c.id); load(); } }

  async function refreshDetail(id: string) { const r = await api.getCase(id); setDetail(r.data ?? null); load(); }
  async function cycleDoc(d: DocItem) {
    if (!detail) return;
    const next = d.status === 'pending' ? 'received' : d.status === 'received' ? 'waived' : 'pending';
    await api.updateCaseDocument(d.id, { status: next });
    refreshDetail(detail.id);
  }
  async function addDoc() {
    if (!detail || !newDoc.trim()) return;
    await api.addCaseDocument(detail.id, { name: newDoc.trim(), required: true });
    setNewDoc(''); refreshDetail(detail.id);
  }
  async function delDoc(d: DocItem) { if (!detail) return; await api.deleteCaseDocument(d.id); refreshDetail(detail.id); }

  const docProgress = (c: FinCase) => { const docs = c.documents ?? []; return { done: docs.filter((d) => d.status !== 'pending').length, total: docs.length }; };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Cases</h1><p className="mt-0.5 text-sm text-slate-500">Client cases with filing deadlines and a document checklist per type.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Case</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="Landmark" title="No cases yet" subtitle="Open a case to track filings and required documents." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Case</Button>} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((c) => {
              const s = STATUS[c.status] ?? STATUS.open; const dp = docProgress(c); const dt = daysTo(c.filingDeadline);
              const urgent = dt !== null && dt <= 30 && !['closed', 'cancelled'].includes(c.status);
              return (
                <Card key={c.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Landmark className="h-5 w-5" /></div>
                      <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{c.title}</div><div className="truncate text-xs text-slate-500">{c.clientName}</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{c.caseType}</span>
                    {c.feeValue > 0 && <span>{inr(c.feeValue)}</span>}
                    {c.assignedTo && <span>· {c.assignedTo}</span>}
                  </div>
                  {c.filingDeadline && (
                    <div className={`flex items-center gap-1 text-xs ${urgent ? 'font-semibold text-error-600' : 'text-slate-500'}`}>
                      <CalendarClock className="h-3.5 w-3.5" />Due {fmt(c.filingDeadline)}{dt !== null && dt >= 0 && ` · ${dt}d`}{dt !== null && dt < 0 && ' · overdue'}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between">
                    <button onClick={() => setDetail(c)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"><FileCheck2 className="h-3.5 w-3.5" />{dp.done}/{dp.total} docs</button>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Case' : 'New Case'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Case title" required value={(form.title as string) ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ITR FY26 — Mr. Verma" />
            <Input label="Client" required value={(form.clientName as string) ?? ''} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Type" value={(form.caseType as string) ?? 'ITR'} onChange={(e) => setForm({ ...form, caseType: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
            <Select label="Status" value={(form.status as string) ?? 'open'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
            <Input label="Fee (₹)" type="number" value={(form.feeValue as number) ?? 0} onChange={(e) => setForm({ ...form, feeValue: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Filing deadline" type="date" value={(form.filingDeadline as string) ?? ''} onChange={(e) => setForm({ ...form, filingDeadline: e.target.value })} />
            <Input label="Assigned to" value={(form.assignedTo as string) ?? ''} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
          </div>
          {!editing && <p className="text-xs text-slate-400">A standard document checklist for this case type is added automatically.</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Create'}</Button></div>
        </div>
      </Modal>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.title} — Documents` : ''} maxWidth="max-w-lg">
        {detail && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {(detail.documents ?? []).length === 0 ? <p className="text-sm text-slate-400">No documents on this case yet.</p>
                : (detail.documents ?? []).map((d) => {
                  const ds = DOC_STATUS[d.status] ?? DOC_STATUS.pending; const Icon = ds.icon;
                  return (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <button onClick={() => cycleDoc(d)} className="flex min-w-0 items-center gap-2 text-left">
                        <Icon className="h-4 w-4 shrink-0" style={{ color: ds.color }} />
                        <span className={`truncate text-sm ${d.status === 'received' ? 'text-slate-900' : d.status === 'waived' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{d.name}</span>
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
