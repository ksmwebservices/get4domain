'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Boxes } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface ProjectRef { id: string; name: string }
interface Material {
  id: string; name: string; projectId?: string; unit?: string; quantity: number; unitCost: number; supplier?: string; status: string;
}

const STATUS: Record<string, { label: string; color: string }> = {
  ordered: { label: 'Ordered', color: '#f59e0b' }, received: { label: 'Received', color: '#2563eb' }, used: { label: 'Used', color: '#16a34a' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const emptyForm = (): Record<string, unknown> => ({ name: '', projectId: '', unit: 'bags', quantity: 0, unitCost: 0, supplier: '', status: 'ordered' });

export default function MaterialsView() {
  const [rows, setRows] = useState<Material[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getMaterials().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
    api.getProjects().then((r) => setProjects((r.data ?? []).map((p: ProjectRef) => ({ id: p.id, name: p.name })))).catch(() => setProjects([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((m) => m.status === filter)), [rows, filter]);
  const projName = (id?: string) => projects.find((p) => p.id === id)?.name;

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (m: Material) => { setEditing(m); setForm({ ...m, projectId: m.projectId ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.name).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, quantity: Number(form.quantity) || 0, unitCost: Number(form.unitCost) || 0, projectId: form.projectId || undefined };
      editing ? await api.updateMaterial(editing.id, payload) : await api.createMaterial(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(m: Material) { if (confirm(`Delete "${m.name}"?`)) { await api.deleteMaterial(m.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Materials</h1><p className="mt-0.5 text-sm text-slate-500">Material procurement — ordered, received and used on site.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Material</Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {(['all', 'ordered', 'received', 'used'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${filter === f ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>{f === 'all' ? 'All' : STATUS[f].label}</button>
        ))}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="Boxes" title={rows.length ? 'Nothing here' : 'No materials yet'} subtitle="Track material orders against your projects." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Material</Button>} /></Card>
        : (
          <div className="space-y-2">
            {filtered.map((m) => {
              const s = STATUS[m.status] ?? STATUS.ordered; const total = m.quantity * m.unitCost;
              return (
                <Card key={m.id} padded className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Boxes className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="truncate text-sm font-bold text-slate-900">{m.name}</span><Badge color={s.color}>{s.label}</Badge></div>
                      <div className="truncate text-xs text-slate-500">{m.quantity} {m.unit} · {inr(m.unitCost)}/{m.unit || 'unit'}{m.supplier && ` · ${m.supplier}`}{projName(m.projectId) && ` · ${projName(m.projectId)}`}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">{inr(total)}</span>
                    <button onClick={() => openEdit(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Material' : 'Add Material'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Material" required value={(form.name as string) ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cement (OPC 53)" />
            <Select label="Project" value={(form.projectId as string) ?? ''} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">{projects.length ? 'Unassigned' : 'Add projects first'}</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Quantity" type="number" value={(form.quantity as number) ?? 0} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            <Input label="Unit" value={(form.unit as string) ?? ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="bags" />
            <Input label="Unit cost (₹)" type="number" value={(form.unitCost as number) ?? 0} onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Supplier" value={(form.supplier as string) ?? ''} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            <Select label="Status" value={(form.status as string) ?? 'ordered'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
