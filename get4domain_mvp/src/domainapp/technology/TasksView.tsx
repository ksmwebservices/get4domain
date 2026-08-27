'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface ProjectRef { id: string; name: string }
interface Task {
  id: string; title: string; projectId?: string; sprint?: string; status: string; priority: string;
  assignee?: string; estimateHours?: number; dueDate?: string; project?: ProjectRef | null;
}

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'todo', label: 'To Do', color: '#64748b' },
  { key: 'in_progress', label: 'In Progress', color: '#2563eb' },
  { key: 'done', label: 'Done', color: '#16a34a' },
];
const PRIORITY: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: '#94a3b8' }, medium: { label: 'Med', color: '#2563eb' }, high: { label: 'High', color: '#dc2626' },
};
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const emptyForm = (): Record<string, unknown> => ({ title: '', projectId: '', sprint: '', status: 'todo', priority: 'medium', assignee: '', estimateHours: 0, dueDate: '' });

export default function TasksView() {
  const [rows, setRows] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [projFilter, setProjFilter] = useState<'all' | string>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getTechTasks().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
    api.getTechProjects().then((r) => setProjects((r.data ?? []).map((p: ProjectRef) => ({ id: p.id, name: p.name })))).catch(() => setProjects([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (projFilter === 'all' ? rows : rows.filter((t) => t.projectId === projFilter)), [rows, projFilter]);
  const byCol = (status: string) => filtered.filter((t) => t.status === status);

  async function save() {
    if (!String(form.title).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, estimateHours: Number(form.estimateHours) || undefined, projectId: form.projectId || undefined, dueDate: form.dueDate || undefined };
      await api.createTechTask(payload);
      setOpen(false); setForm(emptyForm()); load();
    } finally { setSaving(false); }
  }
  async function move(t: Task, dir: 1 | -1) {
    const i = COLUMNS.findIndex((c) => c.key === t.status); const next = COLUMNS[i + dir];
    if (!next) return;
    await api.updateTechTask(t.id, { status: next.key }); load();
  }
  async function remove(t: Task) { await api.deleteTechTask(t.id); load(); }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-slate-900">Tasks</h1><p className="mt-0.5 text-sm text-slate-500">Sprint board — move tasks across To Do, In Progress and Done.</p></div>
        <div className="flex items-center gap-2">
          <Select value={projFilter} onChange={(e) => setProjFilter(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setForm(emptyForm()); setOpen(true); }}>New Task</Button>
        </div>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="ListChecks" title="No tasks yet" subtitle="Add tasks and track them across sprint columns." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setForm(emptyForm()); setOpen(true); }}>New Task</Button>} /></Card>
        : (
          <div className="grid gap-3 md:grid-cols-3">
            {COLUMNS.map((col, ci) => (
              <div key={col.key} className="rounded-2xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: col.color }} /><span className="text-sm font-bold text-slate-700">{col.label}</span></div>
                  <span className="text-xs font-semibold text-slate-400">{byCol(col.key).length}</span>
                </div>
                <div className="space-y-2">
                  {byCol(col.key).map((t) => {
                    const pr = PRIORITY[t.priority] ?? PRIORITY.medium;
                    return (
                      <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{t.title}</span>
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ color: pr.color, background: `${pr.color}18` }}>{pr.label}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                          {t.project && <span className="truncate rounded bg-slate-100 px-1.5 py-0.5">{t.project.name}</span>}
                          {t.sprint && <span>{t.sprint}</span>}
                          {t.assignee && <span>· {t.assignee}</span>}
                          {t.estimateHours ? <span>· {t.estimateHours}h</span> : null}
                          {t.dueDate && <span>· {fmt(t.dueDate)}</span>}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex gap-1">
                            {ci > 0 && <button onClick={() => move(t, -1)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><ChevronLeft className="h-4 w-4" /></button>}
                            {ci < COLUMNS.length - 1 && <button onClick={() => move(t, 1)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-primary-600"><ChevronRight className="h-4 w-4" /></button>}
                          </div>
                          <button onClick={() => remove(t)} className="rounded-lg p-1 text-slate-300 hover:bg-slate-100 hover:text-error-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                  {byCol(col.key).length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">Nothing here</p>}
                </div>
              </div>
            ))}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="New Task" maxWidth="max-w-lg">
        <div className="space-y-3">
          <Input label="Title" required value={(form.title as string) ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Wire up checkout API" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Project" value={(form.projectId as string) ?? ''} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">{projects.length ? 'Unassigned' : 'Add projects first'}</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Input label="Sprint" value={(form.sprint as string) ?? ''} onChange={(e) => setForm({ ...form, sprint: e.target.value })} placeholder="Sprint 3" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Status" value={(form.status as string) ?? 'todo'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select>
            <Select label="Priority" value={(form.priority as string) ?? 'medium'} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
            <Input label="Est. (hrs)" type="number" value={(form.estimateHours as number) ?? 0} onChange={(e) => setForm({ ...form, estimateHours: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Assignee" value={(form.assignee as string) ?? ''} onChange={(e) => setForm({ ...form, assignee: e.target.value })} />
            <Input label="Due date" type="date" value={(form.dueDate as string) ?? ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>Add Task</Button></div>
        </div>
      </Modal>
    </div>
  );
}
