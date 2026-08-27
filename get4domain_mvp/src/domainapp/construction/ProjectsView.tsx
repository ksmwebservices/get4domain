'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, HardHat, MapPin, Milestone as MilestoneIcon, CheckCircle2, Circle, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Milestone { id: string; name: string; status: string; amount: number; dueDate?: string }
interface Project {
  id: string; name: string; clientName: string; contactId?: string; siteAddress?: string; phase: string; status: string;
  budget: number; spent: number; startDate?: string; targetDate?: string; notes?: string; milestones?: Milestone[];
}

const PHASES = ['Foundation', 'Structure', 'Finishing', 'Handover'];
const STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planning', color: '#64748b' }, in_progress: { label: 'In Progress', color: '#2563eb' },
  on_hold: { label: 'On Hold', color: '#f59e0b' }, completed: { label: 'Completed', color: '#16a34a' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const MS_STATUS: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  pending: { label: 'Pending', color: '#94a3b8', icon: Circle },
  in_progress: { label: 'In Progress', color: '#2563eb', icon: Loader2 },
  done: { label: 'Done', color: '#16a34a', icon: CheckCircle2 },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const emptyForm = (): Record<string, unknown> => ({ name: '', clientName: '', siteAddress: '', phase: 'Foundation', status: 'planning', budget: 0, spent: 0, startDate: '', targetDate: '', notes: '' });

export default function ProjectsView() {
  const [rows, setRows] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Project | null>(null);
  const [newMs, setNewMs] = useState({ name: '', amount: 0 });

  const load = useCallback(() => {
    setLoading(true);
    api.getProjects().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (p: Project) => { setEditing(p); setForm({ ...p, startDate: p.startDate?.slice(0, 10) ?? '', targetDate: p.targetDate?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.name).trim() || !String(form.clientName).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, budget: Number(form.budget) || 0, spent: Number(form.spent) || 0, startDate: form.startDate || undefined, targetDate: form.targetDate || undefined };
      editing ? await api.updateProject(editing.id, payload) : await api.createProject(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(p: Project) { if (confirm(`Delete project "${p.name}"?`)) { await api.deleteProject(p.id); load(); } }

  async function refreshDetail(id: string) { const r = await api.getProject(id); setDetail(r.data ?? null); load(); }
  async function cycleMs(m: Milestone) {
    if (!detail) return;
    const next = m.status === 'pending' ? 'in_progress' : m.status === 'in_progress' ? 'done' : 'pending';
    await api.updateMilestone(m.id, { status: next });
    refreshDetail(detail.id);
  }
  async function addMs() {
    if (!detail || !newMs.name.trim()) return;
    await api.addMilestone(detail.id, { name: newMs.name.trim(), amount: Number(newMs.amount) || 0 });
    setNewMs({ name: '', amount: 0 }); refreshDetail(detail.id);
  }
  async function delMs(m: Milestone) { if (!detail) return; await api.deleteMilestone(m.id); refreshDetail(detail.id); }

  const msProgress = (p: Project) => { const ms = p.milestones ?? []; return { done: ms.filter((m) => m.status === 'done').length, total: ms.length }; };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Projects</h1><p className="mt-0.5 text-sm text-slate-500">Site projects with phase, budget and milestone tracking.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Project</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="HardHat" title="No projects yet" subtitle="Add a project to track its phase, budget and milestones." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Project</Button>} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((p) => {
              const s = STATUS[p.status] ?? STATUS.planning; const mp = msProgress(p); const pct = p.budget > 0 ? Math.min(100, Math.round((p.spent / p.budget) * 100)) : 0;
              return (
                <Card key={p.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><HardHat className="h-5 w-5" /></div>
                      <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{p.name}</div><div className="truncate text-xs text-slate-500">{p.clientName}</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  {p.siteAddress && <div className="flex items-start gap-1 text-xs text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="line-clamp-1">{p.siteAddress}</span></div>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{p.phase}</span>
                    <span className="font-semibold text-slate-700">{inr(p.budget)}</span>
                    {p.targetDate && <span>Target {fmt(p.targetDate)}</span>}
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-slate-400"><span>Spent {inr(p.spent)}</span><span>{pct}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <button onClick={() => setDetail(p)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                      <MilestoneIcon className="h-3.5 w-3.5" />{mp.done}/{mp.total} milestones
                    </button>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Project' : 'New Project'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Project name" required value={(form.name as string) ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Green Villa — Block A" />
            <Input label="Client" required value={(form.clientName as string) ?? ''} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </div>
          <Textarea label="Site address" value={(form.siteAddress as string) ?? ''} onChange={(e) => setForm({ ...form, siteAddress: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Phase" value={(form.phase as string) ?? 'Foundation'} onChange={(e) => setForm({ ...form, phase: e.target.value })}>{PHASES.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
            <Select label="Status" value={(form.status as string) ?? 'planning'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Budget (₹)" type="number" value={(form.budget as number) ?? 0} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} />
            <Input label="Spent (₹)" type="number" value={(form.spent as number) ?? 0} onChange={(e) => setForm({ ...form, spent: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start" type="date" value={(form.startDate as string) ?? ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="Target" type="date" value={(form.targetDate as string) ?? ''} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Create'}</Button></div>
        </div>
      </Modal>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.name} — Milestones` : ''} maxWidth="max-w-lg">
        {detail && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {(detail.milestones ?? []).length === 0 ? <p className="text-sm text-slate-400">No milestones yet.</p>
                : (detail.milestones ?? []).map((m) => {
                  const ms = MS_STATUS[m.status] ?? MS_STATUS.pending; const Icon = ms.icon;
                  return (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <button onClick={() => cycleMs(m)} className="flex min-w-0 items-center gap-2 text-left">
                        <Icon className={`h-4 w-4 shrink-0 ${m.status === 'in_progress' ? 'animate-spin' : ''}`} style={{ color: ms.color }} />
                        <span className={`truncate text-sm ${m.status === 'done' ? 'text-slate-900' : 'text-slate-700'}`}>{m.name}</span>
                      </button>
                      <div className="flex items-center gap-2">
                        {m.amount > 0 && <span className="text-xs font-semibold text-slate-600">{inr(m.amount)}</span>}
                        <Badge color={ms.color}>{ms.label}</Badge>
                        <button onClick={() => delMs(m)} className="text-slate-300 hover:text-error-500"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className="text-[11px] text-slate-400">Tap a milestone to cycle Pending → In Progress → Done.</p>
            <div className="flex gap-2">
              <input value={newMs.name} onChange={(e) => setNewMs({ ...newMs, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addMs()} placeholder="Milestone…" className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              <input value={newMs.amount || ''} onChange={(e) => setNewMs({ ...newMs, amount: Number(e.target.value) })} type="number" placeholder="₹" className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              <Button variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={addMs}>Add</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
