'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ClipboardList, Sprout, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Order {
  id: string; buyerName: string; contactId?: string; produceName: string; quantity: number; unit: string; grade: string;
  ratePerUnit: number; totalAmount: number; status: string; harvestDate?: string;
}

const UNITS = ['kg', 'quintal', 'tonne', 'dozen', 'crate'];
const GRADES = ['A', 'B', 'C'];
const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#64748b' }, confirmed: { label: 'Confirmed', color: '#2563eb' },
  dispatched: { label: 'Dispatched', color: '#f59e0b' }, delivered: { label: 'Delivered', color: '#16a34a' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const NEXT: Record<string, string> = { pending: 'confirmed', confirmed: 'dispatched', dispatched: 'delivered' };
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const emptyForm = (): Record<string, unknown> => ({ buyerName: '', produceName: '', quantity: 0, unit: 'kg', grade: 'A', ratePerUnit: 0, status: 'pending', harvestDate: '' });

export default function OrdersView() {
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getProduceOrders().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((o) => o.status === filter)), [rows, filter]);
  const preview = (Number(form.quantity) || 0) * (Number(form.ratePerUnit) || 0);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (o: Order) => { setEditing(o); setForm({ ...o, harvestDate: o.harvestDate?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.buyerName).trim() || !String(form.produceName).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, quantity: Number(form.quantity) || 0, ratePerUnit: Number(form.ratePerUnit) || 0, harvestDate: form.harvestDate || undefined };
      editing ? await api.updateProduceOrder(editing.id, payload) : await api.createProduceOrder(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(o: Order) { if (confirm(`Delete order for ${o.buyerName}?`)) { await api.deleteProduceOrder(o.id); load(); } }
  async function advance(o: Order) { const n = NEXT[o.status]; if (!n) return; await api.updateProduceOrder(o.id, { status: n }); load(); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Orders</h1><p className="mt-0.5 text-sm text-slate-500">Produce orders — quantity, grade, dispatch and delivery.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Order</Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {(['all', 'pending', 'confirmed', 'dispatched', 'delivered'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${filter === f ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>{f === 'all' ? 'All' : STATUS[f].label}</button>
        ))}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="ClipboardList" title={rows.length ? 'Nothing here' : 'No orders yet'} subtitle="Log a buyer order and track it to delivery." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Order</Button>} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((o) => {
              const s = STATUS[o.status] ?? STATUS.pending; const canAdvance = NEXT[o.status];
              return (
                <Card key={o.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Sprout className="h-5 w-5" /></div>
                      <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{o.produceName}</div><div className="truncate text-xs text-slate-500">{o.buyerName}</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{o.quantity} {o.unit}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">Grade {o.grade}</span>
                    <span>{inr(o.ratePerUnit)}/{o.unit}</span>
                    <span className="font-semibold text-slate-700">{inr(o.totalAmount)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    {canAdvance ? <Button size="sm" variant="outline" leftIcon={o.status === 'confirmed' ? <Truck className="h-3.5 w-3.5" /> : undefined} onClick={() => advance(o)}>Mark {STATUS[canAdvance].label}</Button> : <span />}
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(o)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(o)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Order' : 'New Order'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Buyer" required value={(form.buyerName as string) ?? ''} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} />
            <Input label="Produce" required value={(form.produceName as string) ?? ''} onChange={(e) => setForm({ ...form, produceName: e.target.value })} placeholder="Tomatoes" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Quantity" type="number" value={(form.quantity as number) ?? 0} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            <Select label="Unit" value={(form.unit as string) ?? 'kg'} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
            <Select label="Grade" value={(form.grade as string) ?? 'A'} onChange={(e) => setForm({ ...form, grade: e.target.value })}>{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</Select>
            <Input label="Rate/unit (₹)" type="number" value={(form.ratePerUnit as number) ?? 0} onChange={(e) => setForm({ ...form, ratePerUnit: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={(form.status as string) ?? 'pending'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
            <Input label="Harvest date" type="date" value={(form.harvestDate as string) ?? ''} onChange={(e) => setForm({ ...form, harvestDate: e.target.value })} />
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-500">Order total </span><span className="font-bold text-slate-900">{inr(preview)}</span></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Create'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
