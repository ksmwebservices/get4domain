'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, PartyPopper, MapPin, Users, Handshake, X } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface VendorAssign { id: string; vendorName: string; service: string; contactPhone?: string; cost: number; status: string }
interface Booking {
  id: string; title: string; clientName: string; contactId?: string; eventType: string; eventDate?: string; venue?: string;
  guestCount: number; status: string; packageValue: number; advancePaid: number; notes?: string; vendors?: VendorAssign[];
}

const TYPES = ['Wedding', 'Birthday', 'Corporate', 'Concert', 'Other'];
const SERVICES = ['Catering', 'Decor', 'Photography', 'Music', 'Transport', 'Other'];
const STATUS: Record<string, { label: string; color: string }> = {
  enquiry: { label: 'Enquiry', color: '#64748b' }, confirmed: { label: 'Confirmed', color: '#2563eb' },
  in_progress: { label: 'In Progress', color: '#f59e0b' }, completed: { label: 'Completed', color: '#16a34a' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const VEND_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#f59e0b' }, confirmed: { label: 'Confirmed', color: '#2563eb' }, paid: { label: 'Paid', color: '#16a34a' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const emptyForm = (): Record<string, unknown> => ({ title: '', clientName: '', eventType: 'Wedding', eventDate: '', venue: '', guestCount: 0, status: 'enquiry', packageValue: 0, advancePaid: 0, notes: '' });

export default function BookingsView() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [newV, setNewV] = useState({ vendorName: '', service: 'Catering', cost: 0 });

  const load = useCallback(() => {
    setLoading(true);
    api.getBookings().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (b: Booking) => { setEditing(b); setForm({ ...b, eventDate: b.eventDate?.slice(0, 10) ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.title).trim() || !String(form.clientName).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, guestCount: Number(form.guestCount) || 0, packageValue: Number(form.packageValue) || 0, advancePaid: Number(form.advancePaid) || 0, eventDate: form.eventDate || undefined };
      editing ? await api.updateBooking(editing.id, payload) : await api.createBooking(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(b: Booking) { if (confirm(`Delete booking "${b.title}"?`)) { await api.deleteBooking(b.id); load(); } }

  async function refreshDetail(id: string) { const r = await api.getBooking(id); setDetail(r.data ?? null); load(); }
  async function cycleV(v: VendorAssign) {
    if (!detail) return;
    const next = v.status === 'pending' ? 'confirmed' : v.status === 'confirmed' ? 'paid' : 'pending';
    await api.updateEventVendor(v.id, { status: next });
    refreshDetail(detail.id);
  }
  async function addV() {
    if (!detail || !newV.vendorName.trim()) return;
    await api.addEventVendor(detail.id, { vendorName: newV.vendorName.trim(), service: newV.service, cost: Number(newV.cost) || 0 });
    setNewV({ vendorName: '', service: 'Catering', cost: 0 }); refreshDetail(detail.id);
  }
  async function delV(v: VendorAssign) { if (!detail) return; await api.deleteEventVendor(v.id); refreshDetail(detail.id); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Bookings</h1><p className="mt-0.5 text-sm text-slate-500">Event bookings with vendor coordination and payments.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Booking</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="PartyPopper" title="No bookings yet" subtitle="Add an event booking and coordinate its vendors." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Booking</Button>} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((b) => {
              const s = STATUS[b.status] ?? STATUS.enquiry; const balance = Math.max(0, b.packageValue - b.advancePaid); const vc = b.vendors?.length ?? 0;
              return (
                <Card key={b.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><PartyPopper className="h-5 w-5" /></div>
                      <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{b.title}</div><div className="truncate text-xs text-slate-500">{b.clientName}</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{b.eventType}</span>
                    {b.eventDate && <span>{fmt(b.eventDate)}</span>}
                    {b.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{b.venue}</span>}
                    {b.guestCount > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{b.guestCount}</span>}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Advance <span className="font-semibold text-slate-700">{inr(b.advancePaid)}</span> / {inr(b.packageValue)}</span>
                    {balance > 0 && <span className="font-medium text-error-600">{inr(balance)} balance</span>}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <button onClick={() => setDetail(b)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"><Handshake className="h-3.5 w-3.5" />{vc} vendor{vc === 1 ? '' : 's'}</button>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(b)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(b)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Booking' : 'New Booking'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Event title" required value={(form.title as string) ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sharma Wedding" />
            <Input label="Client" required value={(form.clientName as string) ?? ''} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Type" value={(form.eventType as string) ?? 'Wedding'} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
            <Input label="Event date" type="date" value={(form.eventDate as string) ?? ''} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
            <Select label="Status" value={(form.status as string) ?? 'enquiry'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Venue" value={(form.venue as string) ?? ''} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
            <Input label="Guest count" type="number" value={(form.guestCount as number) ?? 0} onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Package value (₹)" type="number" value={(form.packageValue as number) ?? 0} onChange={(e) => setForm({ ...form, packageValue: Number(e.target.value) })} />
            <Input label="Advance paid (₹)" type="number" value={(form.advancePaid as number) ?? 0} onChange={(e) => setForm({ ...form, advancePaid: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Create'}</Button></div>
        </div>
      </Modal>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.title} — Vendors` : ''} maxWidth="max-w-lg">
        {detail && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {(detail.vendors ?? []).length === 0 ? <p className="text-sm text-slate-400">No vendors assigned yet.</p>
                : (detail.vendors ?? []).map((v) => {
                  const vs = VEND_STATUS[v.status] ?? VEND_STATUS.pending;
                  return (
                    <div key={v.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{v.vendorName}</div>
                        <div className="text-xs text-slate-500">{v.service}{v.cost > 0 && ` · ${inr(v.cost)}`}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => cycleV(v)}><Badge color={vs.color}>{vs.label}</Badge></button>
                        <button onClick={() => delV(v)} className="text-slate-300 hover:text-error-500"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className="text-[11px] text-slate-400">Tap a status to cycle Pending → Confirmed → Paid.</p>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
              <input value={newV.vendorName} onChange={(e) => setNewV({ ...newV, vendorName: e.target.value })} placeholder="Vendor name" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              <select value={newV.service} onChange={(e) => setNewV({ ...newV, service: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm focus:outline-none">{SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <input value={newV.cost || ''} onChange={(e) => setNewV({ ...newV, cost: Number(e.target.value) })} type="number" placeholder="₹" className="w-20 rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm focus:outline-none" />
              <Button variant="outline" onClick={addV}>Add</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
