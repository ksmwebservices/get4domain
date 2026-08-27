'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Layers, Phone } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface BatchRef { id: string; name: string }
interface Enrollment {
  id: string; studentName: string; studentPhone?: string; guardianContact?: string; batchId?: string;
  feeAmount: number; feePaid: number; status: string; notes?: string; batch?: BatchRef | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
  enrolled: { label: 'Enrolled', color: '#2563eb' }, ongoing: { label: 'Ongoing', color: '#f59e0b' },
  completed: { label: 'Completed', color: '#16a34a' }, dropped: { label: 'Dropped', color: '#dc2626' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const emptyForm = (): Record<string, unknown> => ({ studentName: '', studentPhone: '', guardianContact: '', batchId: '', feeAmount: 0, feePaid: 0, status: 'enrolled', notes: '' });

export default function EnrollmentsView() {
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [batches, setBatches] = useState<BatchRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Enrollment | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getEnrollments().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
    api.getBatches().then((r) => setBatches((r.data ?? []).map((b: BatchRef) => ({ id: b.id, name: b.name })))).catch(() => setBatches([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((e) => (filter === 'all' || e.status === filter) && e.studentName.toLowerCase().includes(search.toLowerCase())), [rows, filter, search]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (e: Enrollment) => { setEditing(e); setForm({ ...e, batchId: e.batchId ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.studentName).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, feeAmount: Number(form.feeAmount) || 0, feePaid: Number(form.feePaid) || 0, batchId: form.batchId || undefined };
      editing ? await api.updateEnrollment(editing.id, payload) : await api.createEnrollment(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(e: Enrollment) { if (confirm(`Delete enrollment for ${e.studentName}?`)) { await api.deleteEnrollment(e.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Students</h1><p className="mt-0.5 text-sm text-slate-500">Enrollment roster with batch and fee tracking.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Enroll Student</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div className="flex flex-wrap gap-1">
          {(['all', 'enrolled', 'ongoing', 'completed', 'dropped'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${filter === f ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>{f === 'all' ? 'All' : STATUS[f].label}</button>
          ))}
        </div>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="Users" title={rows.length ? 'No students match' : 'No students yet'} subtitle="Enroll students into batches and track their fees." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Enroll Student</Button>} /></Card>
        : (
          <div className="space-y-2">
            {filtered.map((e) => {
              const s = STATUS[e.status] ?? STATUS.enrolled; const pending = Math.max(0, e.feeAmount - e.feePaid);
              return (
                <Card key={e.id} padded className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{e.studentName}</span><Badge color={s.color}>{s.label}</Badge></div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      {e.batch && <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{e.batch.name}</span>}
                      {e.studentPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{e.studentPhone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">{inr(e.feePaid)}<span className="text-xs font-normal text-slate-400">/{inr(e.feeAmount)}</span></div>
                      {pending > 0 && <div className="text-xs font-medium text-error-600">{inr(pending)} due</div>}
                    </div>
                    <button onClick={() => openEdit(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Enrollment' : 'Enroll Student'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Student name" required value={(form.studentName as string) ?? ''} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
            <Input label="Phone" value={(form.studentPhone as string) ?? ''} onChange={(e) => setForm({ ...form, studentPhone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Batch" value={(form.batchId as string) ?? ''} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
              <option value="">{batches.length ? 'Unassigned' : 'Add batches first'}</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Input label="Guardian contact" value={(form.guardianContact as string) ?? ''} onChange={(e) => setForm({ ...form, guardianContact: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Fee (₹)" type="number" value={(form.feeAmount as number) ?? 0} onChange={(e) => setForm({ ...form, feeAmount: Number(e.target.value) })} />
            <Input label="Paid (₹)" type="number" value={(form.feePaid as number) ?? 0} onChange={(e) => setForm({ ...form, feePaid: Number(e.target.value) })} />
            <Select label="Status" value={(form.status as string) ?? 'enrolled'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </div>
          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Enroll'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
