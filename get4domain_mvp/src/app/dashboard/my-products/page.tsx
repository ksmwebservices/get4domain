'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, ExternalLink, Upload, ImageIcon } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { getListingFields } from '@/data/listing-fields';

interface ProductLabels {
  singular: string;
  plural: string;
  placeholder: string;
}

function getProductLabel(industry?: string): ProductLabels {
  const labels: Record<string, ProductLabels> = {
    travel: { singular: 'Tour Package', plural: 'Tour Packages', placeholder: 'e.g. Ooty 3N/4D Package' },
    restaurant: { singular: 'Menu Item', plural: 'Menu Items', placeholder: 'e.g. Chicken Biryani' },
    clinic: { singular: 'Service', plural: 'Services & Packages', placeholder: 'e.g. Full Body Checkup' },
    education: { singular: 'Course', plural: 'Courses', placeholder: 'e.g. JEE Foundation Course' },
    realestate: { singular: 'Property', plural: 'Properties', placeholder: 'e.g. 3BHK Apartment' },
    retail: { singular: 'Product', plural: 'Products', placeholder: 'e.g. Basmati Rice 5kg' },
    salon: { singular: 'Service', plural: 'Services', placeholder: 'e.g. Bridal Package' },
    gym: { singular: 'Membership', plural: 'Memberships & Classes', placeholder: 'e.g. 6-Month Gym Membership' },
    construction: { singular: 'Service', plural: 'Services', placeholder: 'e.g. Interior Design' },
    hotel: { singular: 'Room Type', plural: 'Rooms & Packages', placeholder: 'e.g. Deluxe Room' },
  };
  return labels[industry ?? ''] ?? { singular: 'Product', plural: 'Products & Services', placeholder: 'e.g. Your main service' };
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  image: string | null;
  category: string | null;
  active: boolean;
  customFields?: Record<string, string> | null;
}

const emptyForm = { name: '', description: '', price: '', image: '', category: '' };

export default function MyProductsPage() {
  const { user } = useAuth();
  const labels = getProductLabel(user?.industry);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const listingFields = getListingFields(user?.industry);
  const siteUrl = user?.subdomain ? `/site/${user.subdomain}` : '';

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const r = await api.uploadImage(file);
      if (r.data?.url) setForm((f) => ({ ...f, image: r.data!.url }));
    } catch {
      /* optional — keep any existing URL */
    } finally {
      setUploading(false);
    }
  }

  async function loadProducts() {
    if (!user) return;
    try {
      const res = await api.getVendorProducts(user.id);
      setProducts(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, [user]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setCustom({});
    setTags('');
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description ?? '', price: p.price ?? '', image: p.image ?? '', category: p.category ?? '' });
    const cf = { ...(p.customFields ?? {}) };
    setTags(typeof cf.tags === 'string' ? cf.tags : '');
    delete cf.tags;
    setCustom(cf);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError('');
    // Only keep filled custom fields; attach tags (comma list) if present.
    const customFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(custom)) if (v?.trim()) customFields[k] = v.trim();
    if (tags.trim()) customFields.tags = tags.trim();
    const payload = { ...form, customFields };
    try {
      if (editingId) {
        await api.updateProduct(editingId, payload);
      } else {
        await api.addProduct(user.id, payload);
      }
      setModalOpen(false);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Product) {
    try {
      await api.updateProduct(p.id, { active: !p.active });
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteProduct(id);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My {labels.plural}</h2>
          <p className="mt-1 text-sm text-slate-500">Manage what appears on your website.</p>
        </div>
        <div className="flex items-center gap-2">
          {siteUrl && (
            <a href={siteUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>Preview my site</Button>
            </a>
          )}
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openAdd}>Add {labels.singular}</Button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-500 mb-4">No {labels.plural.toLowerCase()} yet.</p>
          <Button size="sm" variant="outline" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openAdd}>Add Your First {labels.singular}</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              {p.image && <img src={p.image} alt={p.name} className="h-32 w-full object-cover" />}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-bold text-slate-900">{p.name}</span>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${p.active ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>
                    {p.active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                {p.price && <div className="text-sm font-semibold text-primary-600 mb-1">₹{p.price}</div>}
                {p.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{p.description}</p>}
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3 w-3" />} onClick={() => openEdit(p)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(p)}>{p.active ? 'Hide' : 'Show'}</Button>
                  <button onClick={() => handleDelete(p.id)} aria-label="Delete" className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-600 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? `Edit ${labels.singular}` : `Add ${labels.singular}`} maxWidth="max-w-lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={labels.placeholder}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Price (₹)</label>
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Category</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            </div>
          </div>
          {/* Rich per-category fields (real estate → area/config/type, restaurant → course/diet/serves, …) */}
          {listingFields.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {listingFields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">{f.label}</label>
                  {f.type === 'select' ? (
                    <select value={custom[f.key] ?? ''} onChange={(e) => setCustom({ ...custom, [f.key]: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                      <option value="">—</option>
                      {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={custom[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setCustom({ ...custom, [f.key]: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  )}
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Highlights / tags <span className="text-slate-400">(comma separated)</span></label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. Ready to Move, Popular"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Photo</label>
            <div className="flex items-center gap-3">
              {form.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><ImageIcon className="h-6 w-6" /></div>
              )}
              <div className="flex-1 space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {form.image ? 'Change photo' : 'Upload photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
                </label>
                {form.image && <button type="button" onClick={() => setForm({ ...form, image: '' })} className="ml-2 text-xs text-error-600 hover:underline">Remove</button>}
                <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="…or paste an image URL"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
            </div>
          </div>
          <Button type="submit" fullWidth loading={saving}>{editingId ? 'Save Changes' : `Add ${labels.singular}`}</Button>
        </form>
      </Modal>
    </div>
  );
}
