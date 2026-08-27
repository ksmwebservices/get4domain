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

interface Stock {
  id: string; produceName: string; grade: string; unit: string; quantityAvailable: number; ratePerUnit: number; harvestDate?: string; status: string;
}

const UNITS = ['kg', 'quintal', 'tonne', 'dozen', 'crate'];
const GRADES = ['A', 'B', 'C'];
const STATUS: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: '#16a34a' }, reserved: { label: 'Reserved', color: '#f59e0b' }, sold: { label: 'Sold', color: '#64748b' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const emptyForm = (): Record<string, unknown> => ({ produceName: '', grade: 'A', unit: 'kg', quantityAvailable: 0, ratePerUnit: 0, harvestDate: '', status: 'available' });

export default function ProduceInventoryView() {
  const [rows, setRows] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Stock | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getProduceStock().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((s) => s.status === filter)), [rows, filter]);
  const availValue = useMemo(() => rows.filter((s) => s.status === 'available').reduce((sum, s) => sum + s.quantityAvailable * s.ratePerUnit, 0), [rows]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (s: Stock) => { setEditing(s); setForm({ ...s, harvestDate: s.harvestDate?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.produceName).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, quantityAvailable: Number(form.quantityAvailable) || 0, ratePerUnit: Number(form.ratePerUnit) || 0, harvestDate: form.harvestDate || undefined };
      editing ? await api.updateProduceStock(editing.id, payload) : await api.createProduceStock(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(s: Stock) { if (confirm(`Delete "${s.produceName}"?`)) { await api.deleteProduceStock(s.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Inventory</h1><p className="mt-0.5 text-sm text-slate-500">Harvested stock on hand — grade, quantity and value.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Stock</Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {(['all', 'available', 'reserved', 'sold'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${filter === f ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>{f === 'all' ? 'All' : STATUS[f].label}</button>
          ))}
        </div>
        <div className="text-sm"><span className="text-slate-500">Available value </span><span className="font-bold text-success-600">{inr(availValue)}</span></div>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="Boxes" title={rows.length ? 'Nothing here' : 'No stock yet'} subtitle="Log harvested produce to track availability." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Stock</Button>} /></Card>
        : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const st = STATUS[s.status] ?? STATUS.available;
              return (
                <Card key={s.id} padded className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Boxes className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="truncate text-sm font-bold text-slate-900">{s.produceName}</span><Badge color={st.color}>{st.label}</Badge></div>
                      <div className="truncate text-xs text-slate-500">Grade {s.grade} · {inr(s.ratePerUnit)}/{s.unit}{s.harvestDate && ` · harvested ${fmt(s.harvestDate)}`}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right"><div className="text-sm font-bold text-slate-900">{s.quantityAvailable} {s.unit}</div><div className="text-[10px] uppercase text-slate-400">{inr(s.quantityAvailable * s.ratePerUnit)}</div></div>
                    <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Stock' : 'Add Stock'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <Input label="Produce" required value={(form.produceName as string) ?? ''} onChange={(e) => setForm({ ...form, produceName: e.target.value })} placeholder="Onions" />
          <div className="grid grid-cols-4 gap-3">
            <Input label="Quantity" type="number" value={(form.quantityAvailable as number) ?? 0} onChange={(e) => setForm({ ...form, quantityAvailable: Number(e.target.value) })} />
            <Select label="Unit" value={(form.unit as string) ?? 'kg'} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
            <Select label="Grade" value={(form.grade as string) ?? 'A'} onChange={(e) => setForm({ ...form, grade: e.target.value })}>{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</Select>
            <Input label="Rate/unit (₹)" type="number" value={(form.ratePerUnit as number) ?? 0} onChange={(e) => setForm({ ...form, ratePerUnit: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Harvest date" type="date" value={(form.harvestDate as string) ?? ''} onChange={(e) => setForm({ ...form, harvestDate: e.target.value })} />
            <Select label="Status" value={(form.status as string) ?? 'available'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
