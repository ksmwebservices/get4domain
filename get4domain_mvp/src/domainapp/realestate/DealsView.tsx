'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Building2, User } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface ListingRef { id: string; title: string }
interface Deal {
  id: string; clientName: string; clientPhone?: string; listingId?: string; stage: string; value: number; agent?: string; notes?: string;
  listing?: ListingRef | null;
}

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: '#64748b' }, { key: 'site_visit', label: 'Site Visit', color: '#2563eb' },
  { key: 'negotiation', label: 'Negotiation', color: '#f59e0b' }, { key: 'closed_won', label: 'Won', color: '#16a34a' }, { key: 'closed_lost', label: 'Lost', color: '#dc2626' },
];
const SM = Object.fromEntries(STAGES.map((s) => [s.key, s]));
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const emptyForm = (): Record<string, unknown> => ({ clientName: '', clientPhone: '', listingId: '', stage: 'new', value: 0, agent: '', notes: '' });

export default function DealsView() {
  const [rows, setRows] = useState<Deal[]>([]);
  const [listings, setListings] = useState<ListingRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getDeals().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
    api.getListings().then((r) => setListings((r.data ?? []).map((l: ListingRef) => ({ id: l.id, title: l.title })))).catch(() => setListings([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => STAGES.map((s) => { const ds = rows.filter((d) => d.stage === s.key); return { ...s, count: ds.length, value: ds.reduce((a, d) => a + d.value, 0) }; }), [rows]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (d: Deal) => { setEditing(d); setForm({ ...d, listingId: d.listingId ?? '' }); setOpen(true); };

  async function save() {
    if (!String(form.clientName).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, value: Number(form.value) || 0, listingId: form.listingId || undefined };
      editing ? await api.updateDeal(editing.id, payload) : await api.createDeal(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function setStage(d: Deal, stage: string) {
    setRows((prev) => prev.map((r) => (r.id === d.id ? { ...r, stage } : r)));
    try { await api.updateDeal(d.id, { stage }); } catch { load(); }
  }
  async function remove(d: Deal) { if (confirm(`Delete deal with ${d.clientName}?`)) { await api.deleteDeal(d.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Deal Pipeline</h1><p className="mt-0.5 text-sm text-slate-500">Track deals from enquiry to close.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Deal</Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.key} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</div>
            <div className="text-lg font-extrabold text-slate-900">{s.count}</div>
            {s.value > 0 && <div className="text-[11px] text-slate-500">{inr(s.value)}</div>}
          </div>
        ))}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="MessageSquare" title="No deals yet" subtitle="Add a deal to start tracking your pipeline." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New Deal</Button>} /></Card>
        : (
          <div className="space-y-2">
            {rows.map((d) => (
              <Card key={d.id} padded className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{d.clientName}</span>{d.value > 0 && <span className="text-sm font-semibold text-slate-700">{inr(d.value)}</span>}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {d.listing && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{d.listing.title}</span>}
                    {d.agent && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{d.agent}</span>}
                    {d.clientPhone && <span>{d.clientPhone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={d.stage} onChange={(e) => setStage(d, e.target.value)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <button onClick={() => openEdit(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
            ))}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Deal' : 'New Deal'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Client name" required value={(form.clientName as string) ?? ''} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
            <Input label="Phone" value={(form.clientPhone as string) ?? ''} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} />
          </div>
          <Select label="Property" value={(form.listingId as string) ?? ''} onChange={(e) => setForm({ ...form, listingId: e.target.value })}>
            <option value="">{listings.length ? 'None' : 'Add listings first'}</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </Select>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Value (₹)" type="number" value={(form.value as number) ?? 0} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
            <Input label="Agent" value={(form.agent as string) ?? ''} onChange={(e) => setForm({ ...form, agent: e.target.value })} />
            <Select label="Stage" value={(form.stage as string) ?? 'new'} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </div>
          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
