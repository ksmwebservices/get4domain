'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { type IndustryConfig } from '@/lib/dashboard-config';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Input';
import { CustomFieldInputs } from './CustomFields';
import EmptyState from './EmptyState';

interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  unit?: string;
  image?: string;
  active: boolean;
  customFields?: Record<string, unknown>;
}

export default function CatalogView({ industry, icon }: { industry: IndustryConfig; icon: string }) {
  const label = industry.entities.catalogItem.label;
  const labelPlural = industry.entities.catalogItem.labelPlural;

  const [rows, setRows] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<Partial<CatalogItem>>({});
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  const uploadItemImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const r = await api.uploadImage(file);
      if (r.data?.url) setForm((f) => ({ ...f, image: r.data!.url }));
    } catch { /* ignore — optional */ } finally {
      setUploadingImg(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.daGetCatalog();
      setRows(res.data.items ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ active: true }); setCustom({}); setModalOpen(true); };
  const openEdit = (c: CatalogItem) => { setEditing(c); setForm(c); setCustom(c.customFields ?? {}); setModalOpen(true); };

  const save = async () => {
    if (!form.name || form.price === undefined || form.price === null) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        unit: form.unit,
        image: form.image ?? null,
        active: form.active ?? true,
        customFields: custom,
      };
      if (editing) await api.daUpdateCatalogItem(editing.id, payload);
      else await api.daCreateCatalogItem(payload);
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{labelPlural}</h1>
          <p className="text-sm text-slate-500">Your {labelPlural.toLowerCase()} and pricing</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New {label}</Button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={icon} title={`No ${labelPlural.toLowerCase()} yet`}
          subtitle={`Add your first ${label.toLowerCase()}.`}
          action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New {label}</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((item) => (
            <Card key={item.id} hover className="cursor-pointer" onClick={() => openEdit(item)}>
              {item.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt={item.name} className="mb-3 h-32 w-full rounded-lg object-cover" />
              )}
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-slate-900">{item.name}</h3>
                <Badge tone={item.active ? 'success' : 'neutral'}>{item.active ? 'Active' : 'Inactive'}</Badge>
              </div>
              {item.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.description}</p>}
              <div className="mt-3 text-lg font-bold text-slate-900">
                ₹{item.price.toLocaleString('en-IN')}
                {item.unit && <span className="ml-1 text-xs font-normal text-slate-400">/ {item.unit}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${label}` : `New ${label}`} maxWidth="max-w-lg">
        <div className="space-y-4">
          <Input label="Name" required value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label="Description" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Price (₹)" required type="number" value={form.price ?? ''} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            <Input label="Unit" placeholder="e.g. per person" value={form.unit ?? ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          {/* Product/service photo (uploaded to our server) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Photo <span className="font-normal text-slate-400">(optional)</span></label>
            <div className="flex items-center gap-3">
              {form.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt="Item" className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />
              )}
              <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-primary-300 hover:text-primary-700">
                {uploadingImg ? 'Uploading…' : form.image ? 'Change photo' : 'Upload photo'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadItemImage(f); }} />
              </label>
              {form.image && <button onClick={() => setForm({ ...form, image: undefined })} className="text-xs font-medium text-slate-500 hover:text-error-600">Remove</button>}
            </div>
          </div>
          <CustomFieldInputs fields={industry.catalogCustomFields} values={custom} onChange={(k, v) => setCustom({ ...custom, [k]: v })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>{editing ? 'Save' : `Create ${label}`}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
