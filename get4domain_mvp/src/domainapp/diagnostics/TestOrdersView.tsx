'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, FlaskConical, Stethoscope, TestTube, X } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Item { id: string; testName: string; sampleType: string; price: number }
interface Order {
  id: string; patientName: string; contactId?: string; referringDoctor?: string; status: string; amount: number;
  sampleId?: string; testDate?: string; reportUrl?: string; notes?: string; items?: Item[];
}

const SAMPLES = ['Blood', 'Urine', 'Imaging', 'Swab', 'Other'];
const STATUS: Record<string, { label: string; color: string }> = {
  booked: { label: 'Booked', color: '#64748b' }, sample_collected: { label: 'Sample Collected', color: '#2563eb' },
  processing: { label: 'Processing', color: '#f59e0b' }, report_ready: { label: 'Report Ready', color: '#16a34a' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const NEXT: Record<string, string> = { booked: 'sample_collected', sample_collected: 'processing', processing: 'report_ready' };
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const emptyForm = (): Record<string, unknown> => ({ patientName: '', referringDoctor: '', status: 'booked', sampleId: '', testDate: '' });

export default function TestOrdersView() {
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);
  const [newItem, setNewItem] = useState({ testName: '', sampleType: 'Blood', price: 0 });

  const load = useCallback(() => {
    setLoading(true);
    api.getTestOrders().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((o) => o.status === filter)), [rows, filter]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (o: Order) => { setEditing(o); setForm({ ...o, testDate: o.testDate?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.patientName).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, testDate: form.testDate || undefined };
      editing ? await api.updateTestOrder(editing.id, payload) : await api.createTestOrder(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(o: Order) { if (confirm(`Delete order for ${o.patientName}?`)) { await api.deleteTestOrder(o.id); load(); } }
  async function advance(o: Order) { const n = NEXT[o.status]; if (!n) return; await api.updateTestOrder(o.id, { status: n }); load(); }

  async function refreshDetail(id: string) { const r = await api.getTestOrder(id); setDetail(r.data ?? null); load(); }
  async function addItem() {
    if (!detail || !newItem.testName.trim()) return;
    await api.addTestOrderItem(detail.id, { ...newItem, price: Number(newItem.price) || 0 });
    setNewItem({ testName: '', sampleType: 'Blood', price: 0 }); refreshDetail(detail.id);
  }
  async function delItem(i: Item) { if (!detail) return; await api.deleteTestOrderItem(i.id); refreshDetail(detail.id); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Bookings</h1><p className="mt-0.5 text-sm text-slate-500">Test orders — sample collection, processing and reports.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Order</Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {(['all', 'booked', 'sample_collected', 'processing', 'report_ready'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${filter === f ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>{f === 'all' ? 'All' : STATUS[f].label}</button>
        ))}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="FlaskConical" title={rows.length ? 'Nothing here' : 'No orders yet'} subtitle="Book a test order and track it to report." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Order</Button>} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((o) => {
              const s = STATUS[o.status] ?? STATUS.booked; const canAdvance = NEXT[o.status];
              return (
                <Card key={o.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FlaskConical className="h-5 w-5" /></div>
                      <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{o.patientName}</div><div className="truncate text-xs text-slate-500">{o.sampleId ? `#${o.sampleId}` : (o.testDate ? fmt(o.testDate) : 'No sample id')}</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {o.referringDoctor && <span className="inline-flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" />{o.referringDoctor}</span>}
                    <span>{(o.items ?? []).length} test{(o.items ?? []).length === 1 ? '' : 's'}</span>
                    {o.amount > 0 && <span className="font-semibold text-slate-700">{inr(o.amount)}</span>}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex gap-2">
                      <button onClick={() => setDetail(o)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"><TestTube className="h-3.5 w-3.5" />Tests</button>
                      {canAdvance && <Button size="sm" variant="outline" onClick={() => advance(o)}>{STATUS[canAdvance].label}</Button>}
                    </div>
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
            <Input label="Patient" required value={(form.patientName as string) ?? ''} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
            <Input label="Referring doctor" value={(form.referringDoctor as string) ?? ''} onChange={(e) => setForm({ ...form, referringDoctor: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Sample ID" value={(form.sampleId as string) ?? ''} onChange={(e) => setForm({ ...form, sampleId: e.target.value })} />
            <Input label="Test date" type="date" value={(form.testDate as string) ?? ''} onChange={(e) => setForm({ ...form, testDate: e.target.value })} />
            <Select label="Status" value={(form.status as string) ?? 'booked'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          </div>
          {!editing && <p className="text-xs text-slate-400">Add tests to the order after creating it — the amount totals automatically.</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Create'}</Button></div>
        </div>
      </Modal>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.patientName} — Tests` : ''} maxWidth="max-w-lg">
        {detail && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {(detail.items ?? []).length === 0 ? <p className="text-sm text-slate-400">No tests added yet.</p>
                : (detail.items ?? []).map((i) => (
                  <div key={i.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <div className="min-w-0"><div className="truncate text-sm text-slate-800">{i.testName}</div><div className="text-xs text-slate-400">{i.sampleType}</div></div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">{inr(i.price)}</span>
                      <button onClick={() => delItem(i)} className="text-slate-300 hover:text-error-500"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-sm"><span className="font-medium text-slate-500">Total</span><span className="font-bold text-slate-900">{inr((detail.items ?? []).reduce((s, i) => s + i.price, 0))}</span></div>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
              <input value={newItem.testName} onChange={(e) => setNewItem({ ...newItem, testName: e.target.value })} placeholder="Test name" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none" />
              <select value={newItem.sampleType} onChange={(e) => setNewItem({ ...newItem, sampleType: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm focus:outline-none">{SAMPLES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <input value={newItem.price || ''} onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })} type="number" placeholder="₹" className="w-20 rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm focus:outline-none" />
              <Button variant="outline" onClick={addItem}>Add</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
