'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Boxes, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Part { id: string; name: string; partNumber?: string; quantity: number; reorderLevel: number; unitPrice: number }

const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const emptyForm = (): Record<string, unknown> => ({ name: '', partNumber: '', quantity: 0, reorderLevel: 5, unitPrice: 0 });

export default function PartsInventoryView() {
  const [rows, setRows] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowOnly, setLowOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getParts().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const isLow = (p: Part) => p.quantity <= p.reorderLevel;
  const filtered = useMemo(() => (lowOnly ? rows.filter(isLow) : rows), [rows, lowOnly]);
  const lowCount = useMemo(() => rows.filter(isLow).length, [rows]);
  const stockValue = useMemo(() => rows.reduce((s, p) => s + p.quantity * p.unitPrice, 0), [rows]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (p: Part) => { setEditing(p); setForm({ ...p }); setOpen(true); };

  async function save() {
    if (!String(form.name).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, quantity: Number(form.quantity) || 0, reorderLevel: Number(form.reorderLevel) || 0, unitPrice: Number(form.unitPrice) || 0 };
      editing ? await api.updatePart(editing.id, payload) : await api.createPart(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(p: Part) { if (confirm(`Delete "${p.name}"?`)) { await api.deletePart(p.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Inventory</h1><p className="mt-0.5 text-sm text-slate-500">Spare-parts stock with reorder alerts.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Part</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card padded><div className="text-2xl font-extrabold text-slate-900">{rows.length}</div><div className="text-xs font-semibold text-slate-500">Parts</div></Card>
        <button onClick={() => setLowOnly((v) => !v)} className={`rounded-2xl border p-4 text-left transition ${lowOnly ? 'border-error-300 bg-error-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
          <div className="text-2xl font-extrabold text-error-600">{lowCount}</div><div className="text-xs font-semibold text-slate-500">Low stock</div>
        </button>
        <Card padded><div className="text-2xl font-extrabold text-success-600">{inr(stockValue)}</div><div className="text-xs font-semibold text-slate-500">Stock value</div></Card>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="Boxes" title={rows.length ? 'No low-stock parts' : 'No parts yet'} subtitle="Track spare-parts stock and get reorder alerts." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Part</Button>} /></Card>
        : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const low = isLow(p);
              return (
                <Card key={p.id} padded className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${low ? 'bg-error-50 text-error-500' : 'bg-slate-100 text-slate-500'}`}>{low ? <AlertTriangle className="h-5 w-5" /> : <Boxes className="h-5 w-5" />}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="truncate text-sm font-bold text-slate-900">{p.name}</span>{low && <Badge color="#dc2626">Reorder</Badge>}</div>
                      <div className="truncate text-xs text-slate-500">{p.partNumber && `${p.partNumber} · `}{inr(p.unitPrice)} each · reorder ≤ {p.reorderLevel}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right"><div className={`text-sm font-bold ${low ? 'text-error-600' : 'text-slate-900'}`}>{p.quantity}</div><div className="text-[10px] uppercase text-slate-400">in stock</div></div>
                    <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Part' : 'Add Part'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Part name" required value={(form.name as string) ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Oil filter" />
            <Input label="Part number" value={(form.partNumber as string) ?? ''} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Quantity" type="number" value={(form.quantity as number) ?? 0} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            <Input label="Reorder ≤" type="number" value={(form.reorderLevel as number) ?? 5} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} />
            <Input label="Unit price (₹)" type="number" value={(form.unitPrice as number) ?? 0} onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
