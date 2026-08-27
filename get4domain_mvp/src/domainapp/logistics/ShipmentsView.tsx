'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, PackageCheck, ArrowRight, Truck, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Shipment {
  id: string; trackingNo: string; clientName: string; contactId?: string; origin: string; destination: string;
  mode: string; weight?: number; status: string; freightAmount: number; pickupDate?: string; eta?: string;
  assignedVehicle?: string; assignedDriver?: string; notes?: string;
}

const MODES = ['Road', 'Rail', 'Air', 'Sea'];
const STATUS: Record<string, { label: string; color: string }> = {
  booked: { label: 'Booked', color: '#64748b' }, picked_up: { label: 'Picked Up', color: '#2563eb' },
  in_transit: { label: 'In Transit', color: '#f59e0b' }, delivered: { label: 'Delivered', color: '#16a34a' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const genTracking = () => `SHP${Date.now().toString().slice(-8)}`;
const emptyForm = (): Record<string, unknown> => ({ trackingNo: genTracking(), clientName: '', origin: '', destination: '', mode: 'Road', weight: 0, status: 'booked', freightAmount: 0, pickupDate: '', eta: '', assignedVehicle: '', assignedDriver: '' });

export default function ShipmentsView() {
  const [rows, setRows] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shipment | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getShipments().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((s) => s.status === filter)), [rows, filter]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (s: Shipment) => { setEditing(s); setForm({ ...s, pickupDate: s.pickupDate?.slice(0, 10) ?? '', eta: s.eta?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.trackingNo).trim() || !String(form.origin).trim() || !String(form.destination).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, weight: Number(form.weight) || undefined, freightAmount: Number(form.freightAmount) || 0, pickupDate: form.pickupDate || undefined, eta: form.eta || undefined };
      editing ? await api.updateShipment(editing.id, payload) : await api.createShipment(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(s: Shipment) { if (confirm(`Delete shipment ${s.trackingNo}?`)) { await api.deleteShipment(s.id); load(); } }
  async function advance(s: Shipment) {
    const flow = ['booked', 'picked_up', 'in_transit', 'delivered'];
    const i = flow.indexOf(s.status); if (i < 0 || i === flow.length - 1) return;
    await api.updateShipment(s.id, { status: flow[i + 1] }); load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Shipments</h1><p className="mt-0.5 text-sm text-slate-500">Consignment tracking — origin, destination, status and ETA.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Shipment</Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {(['all', 'booked', 'picked_up', 'in_transit', 'delivered'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${filter === f ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>{f === 'all' ? 'All' : STATUS[f].label}</button>
        ))}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="PackageCheck" title={rows.length ? 'Nothing here' : 'No shipments yet'} subtitle="Book a consignment and track it door to door." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Shipment</Button>} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((s) => {
              const st = STATUS[s.status] ?? STATUS.booked; const canAdvance = ['booked', 'picked_up', 'in_transit'].includes(s.status);
              return (
                <Card key={s.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><PackageCheck className="h-5 w-5" /></div>
                      <div className="min-w-0"><div className="truncate font-mono text-sm font-bold text-slate-900">{s.trackingNo}</div><div className="truncate text-xs text-slate-500">{s.clientName}</div></div>
                    </div>
                    <Badge color={st.color}>{st.label}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700"><span className="truncate">{s.origin}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate">{s.destination}</span></div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{s.mode}</span>
                    {s.weight ? <span>{s.weight} kg</span> : null}
                    {s.eta && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />ETA {fmt(s.eta)}</span>}
                    {s.freightAmount > 0 && <span className="font-semibold text-slate-700">{inr(s.freightAmount)}</span>}
                    {s.assignedVehicle && <span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5" />{s.assignedVehicle}</span>}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    {canAdvance ? <Button size="sm" variant="outline" onClick={() => advance(s)}>Mark {STATUS[({ booked: 'picked_up', picked_up: 'in_transit', in_transit: 'delivered' } as Record<string, string>)[s.status]].label}</Button> : <span />}
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Shipment' : 'New Shipment'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Tracking no." required value={(form.trackingNo as string) ?? ''} onChange={(e) => setForm({ ...form, trackingNo: e.target.value })} />
            <Input label="Client" value={(form.clientName as string) ?? ''} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Origin" required value={(form.origin as string) ?? ''} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="Mumbai" />
            <Input label="Destination" required value={(form.destination as string) ?? ''} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Delhi" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Mode" value={(form.mode as string) ?? 'Road'} onChange={(e) => setForm({ ...form, mode: e.target.value })}>{MODES.map((m) => <option key={m} value={m}>{m}</option>)}</Select>
            <Input label="Weight (kg)" type="number" value={(form.weight as number) ?? 0} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
            <Select label="Status" value={(form.status as string) ?? 'booked'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Pickup" type="date" value={(form.pickupDate as string) ?? ''} onChange={(e) => setForm({ ...form, pickupDate: e.target.value })} />
            <Input label="ETA" type="date" value={(form.eta as string) ?? ''} onChange={(e) => setForm({ ...form, eta: e.target.value })} />
            <Input label="Freight (₹)" type="number" value={(form.freightAmount as number) ?? 0} onChange={(e) => setForm({ ...form, freightAmount: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Vehicle" value={(form.assignedVehicle as string) ?? ''} onChange={(e) => setForm({ ...form, assignedVehicle: e.target.value })} placeholder="MH12 AB 1234" />
            <Input label="Driver" value={(form.assignedDriver as string) ?? ''} onChange={(e) => setForm({ ...form, assignedDriver: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Create'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
