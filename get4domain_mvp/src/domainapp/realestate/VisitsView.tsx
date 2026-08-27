'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Clock, Building2, User } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface ListingRef { id: string; title: string }
interface Visit {
  id: string; clientName: string; clientPhone?: string; listingId?: string; scheduledAt: string; agent?: string; status: string; notes?: string;
  listing?: ListingRef | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: '#2563eb' }, done: { label: 'Done', color: '#16a34a' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const toLocalInput = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const emptyForm = (): Record<string, unknown> => ({ clientName: '', clientPhone: '', listingId: '', scheduledAt: '', agent: '', status: 'scheduled', notes: '' });

export default function VisitsView() {
  const [rows, setRows] = useState<Visit[]>([]);
  const [listings, setListings] = useState<ListingRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Visit | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getVisits().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
    api.getListings().then((r) => setListings((r.data ?? []).map((l: ListingRef) => ({ id: l.id, title: l.title })))).catch(() => setListings([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (v: Visit) => { setEditing(v); setForm({ ...v, listingId: v.listingId ?? '', scheduledAt: toLocalInput(v.scheduledAt) }); setOpen(true); };

  async function save() {
    if (!String(form.clientName).trim() || !String(form.scheduledAt)) return;
    setSaving(true);
    try {
      const payload = { ...form, listingId: form.listingId || undefined, scheduledAt: new Date(form.scheduledAt as string).toISOString() };
      editing ? await api.updateVisit(editing.id, payload) : await api.createVisit(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function setStatus(v: Visit, status: string) {
    setRows((prev) => prev.map((r) => (r.id === v.id ? { ...r, status } : r)));
    try { await api.updateVisit(v.id, { status }); } catch { load(); }
  }
  async function remove(v: Visit) { if (confirm(`Delete visit for ${v.clientName}?`)) { await api.deleteVisit(v.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Site Visits</h1><p className="mt-0.5 text-sm text-slate-500">Schedule and track property site visits.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Schedule Visit</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="CalendarClock" title="No site visits yet" subtitle="Schedule a property visit for a client." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Schedule Visit</Button>} /></Card>
        : (
          <div className="space-y-2">
            {rows.map((v) => (
              <Card key={v.id} padded className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900">{v.clientName}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmt(v.scheduledAt)}</span>
                    {v.listing && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{v.listing.title}</span>}
                    {v.agent && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{v.agent}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={v.status} onChange={(e) => setStatus(v, e.target.value)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                  </select>
                  <button onClick={() => openEdit(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
            ))}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Visit' : 'Schedule Visit'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Client name" required value={(form.clientName as string) ?? ''} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
            <Input label="Phone" value={(form.clientPhone as string) ?? ''} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} />
          </div>
          <Select label="Property" value={(form.listingId as string) ?? ''} onChange={(e) => setForm({ ...form, listingId: e.target.value })}>
            <option value="">{listings.length ? 'None' : 'Add listings first'}</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date & time" type="datetime-local" required value={(form.scheduledAt as string) ?? ''} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            <Input label="Agent" value={(form.agent as string) ?? ''} onChange={(e) => setForm({ ...form, agent: e.target.value })} />
          </div>
          <Select label="Status" value={(form.status as string) ?? 'scheduled'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </Select>
          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Schedule'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
