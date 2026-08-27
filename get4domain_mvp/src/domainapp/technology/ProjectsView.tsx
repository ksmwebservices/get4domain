'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, FolderKanban, Code2, Clock, ListChecks } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Project {
  id: string; name: string; clientName: string; contactId?: string; projectType: string; techStack?: string; billingType: string;
  status: string; contractValue: number; deadline?: string; notes?: string; _count?: { tasks: number };
}

const TYPES = ['Web', 'Mobile', 'SaaS', 'AI/ML', 'Support', 'Other'];
const BILLING = ['Fixed', 'Hourly', 'Retainer'];
const STATUS: Record<string, { label: string; color: string }> = {
  proposal: { label: 'Proposal', color: '#64748b' }, in_progress: { label: 'In Progress', color: '#2563eb' },
  testing: { label: 'Testing', color: '#f59e0b' }, delivered: { label: 'Delivered', color: '#16a34a' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const emptyForm = (): Record<string, unknown> => ({ name: '', clientName: '', projectType: 'Web', techStack: '', billingType: 'Fixed', status: 'proposal', contractValue: 0, deadline: '', notes: '' });

export default function ProjectsView() {
  const [rows, setRows] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getTechProjects().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (p: Project) => { setEditing(p); setForm({ ...p, deadline: p.deadline?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.name).trim() || !String(form.clientName).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, contractValue: Number(form.contractValue) || 0, deadline: form.deadline || undefined };
      editing ? await api.updateTechProject(editing.id, payload) : await api.createTechProject(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(p: Project) { if (confirm(`Delete project "${p.name}"?`)) { await api.deleteTechProject(p.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Projects</h1><p className="mt-0.5 text-sm text-slate-500">Client engagements — type, stack, status and value.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Project</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="FolderKanban" title="No projects yet" subtitle="Add a client project and track its delivery." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Project</Button>} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((p) => {
              const s = STATUS[p.status] ?? STATUS.proposal;
              return (
                <Card key={p.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FolderKanban className="h-5 w-5" /></div>
                      <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{p.name}</div><div className="truncate text-xs text-slate-500">{p.clientName}</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{p.projectType}</span>
                    <span>{p.billingType === 'Hourly' ? 'Hourly' : inr(p.contractValue)}</span>
                    <span className="inline-flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />{p._count?.tasks ?? 0}</span>
                    {p.deadline && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmt(p.deadline)}</span>}
                  </div>
                  {p.techStack && <div className="flex items-center gap-1 text-xs text-slate-500"><Code2 className="h-3.5 w-3.5" /><span className="truncate">{p.techStack}</span></div>}
                  <div className="mt-1 flex justify-end gap-1">
                    <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Project' : 'New Project'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Project name" required value={(form.name as string) ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Storefront revamp" />
            <Input label="Client" required value={(form.clientName as string) ?? ''} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Type" value={(form.projectType as string) ?? 'Web'} onChange={(e) => setForm({ ...form, projectType: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
            <Select label="Billing" value={(form.billingType as string) ?? 'Fixed'} onChange={(e) => setForm({ ...form, billingType: e.target.value })}>{BILLING.map((b) => <option key={b} value={b}>{b}</option>)}</Select>
            <Select label="Status" value={(form.status as string) ?? 'proposal'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          </div>
          <Input label="Tech stack" value={(form.techStack as string) ?? ''} onChange={(e) => setForm({ ...form, techStack: e.target.value })} placeholder="Next.js · NestJS · Postgres" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Contract value (₹)" type="number" value={(form.contractValue as number) ?? 0} onChange={(e) => setForm({ ...form, contractValue: Number(e.target.value) })} />
            <Input label="Deadline" type="date" value={(form.deadline as string) ?? ''} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Create'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
