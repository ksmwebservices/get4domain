'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Building2, MapPin, Maximize } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Listing { id: string; title: string; propertyType: string; location?: string; price: number; areaSqft?: number; bhk?: string; status: string; description?: string }

const PTYPE = ['Apartment', 'Villa', 'Plot', 'Commercial', 'Office'];
const STATUS: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: '#16a34a' }, under_offer: { label: 'Under Offer', color: '#f59e0b' },
  sold: { label: 'Sold', color: '#2563eb' }, rented: { label: 'Rented', color: '#64748b' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const emptyForm = (): Record<string, unknown> => ({ title: '', propertyType: 'Apartment', location: '', price: 0, areaSqft: 0, bhk: '', status: 'available', description: '' });

export default function ListingsView() {
  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getListings().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (l: Listing) => { setEditing(l); setForm({ ...l }); setOpen(true); };

  async function save() {
    if (!String(form.title).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price) || 0, areaSqft: Number(form.areaSqft) || undefined };
      editing ? await api.updateListing(editing.id, payload) : await api.createListing(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(l: Listing) { if (confirm(`Delete ${l.title}?`)) { await api.deleteListing(l.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Listings</h1><p className="mt-0.5 text-sm text-slate-500">Your property inventory — type, price, area and status.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Listing</Button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : rows.length === 0 ? <Card padded><EmptyState icon="Building2" title="No listings yet" subtitle="Add properties to manage your inventory and deals." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Listing</Button>} /></Card>
        : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((l) => {
              const s = STATUS[l.status] ?? STATUS.available;
              return (
                <Card key={l.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Building2 className="h-5 w-5" /></div>
                      <div><div className="text-sm font-bold text-slate-900">{l.title}</div><div className="text-xs text-slate-500">{l.propertyType}{l.bhk ? ` · ${l.bhk}` : ''}</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="text-sm font-bold text-slate-900">{inr(l.price)}</span>
                    {l.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{l.location}</span>}
                    {l.areaSqft ? <span className="inline-flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{l.areaSqft} sqft</span> : null}
                  </div>
                  <div className="mt-1 flex gap-2">
                    <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(l)}>Edit</Button>
                    <Button size="sm" variant="outline" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(l)}>Delete</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Listing' : 'Add Listing'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <Input label="Title" required value={(form.title as string) ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="3BHK Whitefield" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={(form.propertyType as string) ?? 'Apartment'} onChange={(e) => setForm({ ...form, propertyType: e.target.value })}>
              {PTYPE.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input label="BHK / config" value={(form.bhk as string) ?? ''} onChange={(e) => setForm({ ...form, bhk: e.target.value })} placeholder="3BHK" />
          </div>
          <Input label="Location" value={(form.location as string) ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Price (₹)" type="number" value={(form.price as number) ?? 0} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            <Input label="Area (sqft)" type="number" value={(form.areaSqft as number) ?? 0} onChange={(e) => setForm({ ...form, areaSqft: Number(e.target.value) })} />
            <Select label="Status" value={(form.status as string) ?? 'available'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </div>
          <Textarea label="Description" value={(form.description as string) ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
