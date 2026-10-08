'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Loader2, ExternalLink, Upload, ImageIcon, Boxes, Tags, AlertTriangle, ArrowLeft, ArrowRight, Star } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import AdjustStockModal, { type StockProductRef } from '@/components/dashboard/AdjustStockModal';
import CategoryManager from '@/components/dashboard/CategoryManager';
import { useAuth } from '@/lib/auth-context';
import { openMyWebsite } from '@/lib/view-website';
import { api } from '@/lib/api';
import { getListingFields } from '@/data/listing-fields';
import { STATE_CLASS, STATE_LABEL, checkImageFile, makeMain, moveItem, stockState } from '@/lib/stock-ui';

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
  status?: string | null;
  trackStock?: boolean;
  stockQty?: number | null;
  reorderLevel?: number | null;
  customFields?: Record<string, unknown> | null;
}

const emptyForm = { name: '', description: '', price: '', image: '', category: '' };

// Multi-image gallery + size/color variants — same simple comma-separated-input
// pattern as the existing Highlights/tags field. Stored in VendorProduct.customFields
// (Json, already flexible — no backend/schema change needed), the same field the
// stepnrock live site's adaptLiveProduct() already reads (gallery/colors/sizes).
// Variants are retail-only: they're meaningful for apparel/footwear, not every
// industry's listing (a course or a property doesn't have a "size").
const VARIANT_INDUSTRIES = ['retail'];
// Stock only makes sense for things you hold and count; hidden for service-type industries (still available via the API).
const NO_STOCK_INDUSTRIES = ['travel', 'clinic', 'education', 'realestate', 'salon', 'gym', 'construction', 'hotel'];

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

export default function MyProductsPage() {
  const { user } = useAuth();
  const labels = getProductLabel(user?.industry);
  const showVariants = VARIANT_INDUSTRIES.includes(user?.industry ?? '');
  const showStock = !NO_STOCK_INDUSTRIES.includes(user?.industry ?? '');
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [custom, setCustom] = useState<Record<string, string>>({});
  // customFields keys this form doesn't know how to edit (e.g. a richer field
  // seeded directly via the API, outside this industry's listingFields) - kept
  // as-is and written back unchanged on save, instead of being silently dropped.
  const [preservedFields, setPreservedFields] = useState<Record<string, unknown>>({});
  const [tags, setTags] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [sizes, setSizes] = useState('');
  const [colors, setColors] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  // stock & availability
  const [trackStock, setTrackStock] = useState(false);
  const [wasTracked, setWasTracked] = useState(false);
  const [openingQty, setOpeningQty] = useState('');
  const [currentQty, setCurrentQty] = useState<number | null>(null);
  const [lowLevel, setLowLevel] = useState('');
  const [status, setStatus] = useState<'AVAILABLE' | 'OUT_OF_STOCK' | 'HIDDEN'>('AVAILABLE');
  const [adjusting, setAdjusting] = useState<StockProductRef | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);

  const listingFields = getListingFields(user?.industry);

  async function uploadOne(file: File, apply: (url: string) => void, setBusy: (b: boolean) => void) {
    const problem = checkImageFile(file);
    if (problem) { setUploadError(problem); return; }
    setUploadError('');
    setBusy(true);
    try {
      const r = await api.uploadImage(file);
      if (r.data?.url) apply(r.data.url);
      else setUploadError('The upload finished but no picture address came back. Please try again.');
    } catch (err) {
      // Never swallowed: the vendor must know the photo did NOT go up.
      setUploadError(err instanceof Error ? err.message : 'The photo could not be uploaded. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  const uploadImage = (file: File) => uploadOne(file, (url) => setForm((f) => ({ ...f, image: url })), setUploading);
  const uploadGalleryImage = (file: File) => uploadOne(file, (url) => setGallery((g) => (g.includes(url) ? g : [...g, url])), setUploadingGallery);

  function removeGalleryImage(url: string) {
    setGallery((g) => g.filter((u) => u !== url));
  }

  async function loadProducts() {
    if (!user) return;
    try {
      // The vendor's OWN list: includes hidden items and the stock fields (the public endpoint deliberately has neither).
      const res = await api.getVendorProductsManage(user.id);
      setProducts((res.data ?? res ?? []) as Product[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }
  async function loadCategories() {
    if (!user) return;
    try { const r = await api.getCategoriesManage(user.id); setCategoryNames(((r.data ?? r) as { name: string }[]).map((c) => c.name)); } catch { /* suggestions only */ }
  }

  useEffect(() => { loadProducts(); loadCategories(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setCustom({});
    setPreservedFields({});
    setTags('');
    setGallery([]);
    setSizes('');
    setColors('');
    setTrackStock(false); setWasTracked(false); setOpeningQty(''); setCurrentQty(null); setLowLevel(''); setStatus('AVAILABLE');
    setUploadError('');
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description ?? '', price: p.price ?? '', image: p.image ?? '', category: p.category ?? '' });
    const cf = { ...(p.customFields ?? {}) };
    setTags(typeof cf.tags === 'string' ? cf.tags : '');
    setGallery(Array.isArray(cf.gallery) ? (cf.gallery as unknown as string[]) : []);
    setSizes(Array.isArray(cf.sizes) ? (cf.sizes as unknown as string[]).join(', ') : '');
    setColors(Array.isArray(cf.colors) ? (cf.colors as unknown as string[]).join(', ') : '');
    delete cf.tags;
    delete cf.gallery;
    delete cf.sizes;
    delete cf.colors;
    // Only keys this industry's listingFields actually render as editable inputs
    // go into `custom` (and only if they're genuinely strings). Everything else
    // (e.g. richer fields seeded directly via the API - slug/title/eyebrow/
    // answer/keywords/features/deliverables/video for a photography package) is
    // kept untouched in preservedFields so an unrelated edit here never wipes it.
    const listingKeys = new Set(listingFields.map((f) => f.key));
    const editable: Record<string, string> = {};
    const preserved: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(cf)) {
      if (listingKeys.has(k) && typeof v === 'string') editable[k] = v;
      else preserved[k] = v;
    }
    setCustom(editable);
    setPreservedFields(preserved);
    setTrackStock(Boolean(p.trackStock)); setWasTracked(Boolean(p.trackStock));
    setOpeningQty(''); setCurrentQty(p.stockQty ?? null);
    setLowLevel(p.reorderLevel != null ? String(p.reorderLevel) : '');
    setStatus(stockState(p) === 'hidden' ? 'HIDDEN' : p.status === 'OUT_OF_STOCK' || p.status === 'out_of_stock' ? 'OUT_OF_STOCK' : 'AVAILABLE');
    setUploadError('');
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    const qtyNum = openingQty.trim() === '' ? undefined : Number(openingQty);
    const lowNum = lowLevel.trim() === '' ? undefined : Number(lowLevel);
    if (qtyNum !== undefined && (!Number.isInteger(qtyNum) || qtyNum < 0)) { setError('Stock quantity must be a whole number, 0 or more.'); return; }
    if (lowNum !== undefined && (!Number.isInteger(lowNum) || lowNum < 0)) { setError('The low-stock level must be a whole number, 0 or more.'); return; }
    setSaving(true);
    // Start from whatever this form doesn't edit (untouched), then layer in the
    // editable fields; attach tags (comma list), gallery (image URL list) and
    // size/color variants (comma list → array) if present.
    const customFields: Record<string, unknown> = { ...preservedFields };
    for (const [k, v] of Object.entries(custom)) if (typeof v === 'string' && v.trim()) customFields[k] = v.trim();
    if (tags.trim()) customFields.tags = tags.trim();
    if (gallery.length > 0) customFields.gallery = gallery;
    if (sizes.trim()) customFields.sizes = sizes.split(',').map((s) => s.trim()).filter(Boolean);
    if (colors.trim()) customFields.colors = colors.split(',').map((c) => c.trim()).filter(Boolean);
    const payload: Record<string, unknown> = { ...form, customFields, status };
    if (showStock || wasTracked) {
      payload.trackStock = trackStock;
      if (trackStock) {
        if (lowNum !== undefined) payload.reorderLevel = lowNum;
        // The quantity is only sent as the OPENING stock (new product, or tracking switched on now). Afterwards it moves ONLY through Adjust stock.
        if (!wasTracked) payload.stockQty = qtyNum ?? 0;
      }
    }
    try {
      if (editingId) {
        await api.updateProduct(editingId, payload);
      } else {
        await api.addProduct(user.id, payload);
      }
      setModalOpen(false);
      await Promise.all([loadProducts(), loadCategories()]);
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

  async function handleDelete(p: Product) {
    if (!window.confirm(`Delete "${p.name}"? It will disappear from your website. This cannot be undone.`)) return;
    try {
      await api.deleteProduct(p.id);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  const lowItems = products.filter((p) => p.trackStock && ['low', 'out'].includes(stockState(p)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My {labels.plural}</h2>
          <p className="mt-1 text-sm text-slate-500">Manage what appears on your website.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" leftIcon={<Tags className="h-3.5 w-3.5" />} onClick={() => setCatsOpen(true)}>Categories</Button>
          {showStock && <Link href="/dashboard/stock" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Boxes className="h-3.5 w-3.5" /> Stock</Link>}
          <Button size="sm" variant="outline" leftIcon={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => openMyWebsite(user)}>Preview my site</Button>
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openAdd}>Add {labels.singular}</Button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {lowItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <strong>{lowItems.length} {lowItems.length === 1 ? 'product needs' : 'products need'} restocking:</strong>{' '}
            {lowItems.slice(0, 5).map((p, i) => <span key={p.id}>{i > 0 ? ', ' : ''}{p.name} ({p.stockQty ?? 0} left)</span>)}
            {lowItems.length > 5 ? ` and ${lowItems.length - 5} more` : ''}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-500 mb-4">No {labels.plural.toLowerCase()} yet.</p>
          <Button size="sm" variant="outline" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openAdd}>Add Your First {labels.singular}</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const st = stockState(p);
            return (
              <div key={p.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                {p.image && <img src={p.image} alt={p.name} className={`h-32 w-full object-cover ${st === 'hidden' ? 'opacity-50' : ''}`} />}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900">{p.name}</span>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_CLASS[st]}`}>{STATE_LABEL[st]}</span>
                  </div>
                  {p.price && <div className="text-sm font-semibold text-primary-600 mb-1">₹{p.price}</div>}
                  {p.trackStock && (
                    <div className="mb-1 text-xs text-slate-500">
                      <strong className="text-slate-800">{p.stockQty ?? 0}</strong> in stock{p.reorderLevel != null ? ` · alert at ${p.reorderLevel}` : ''}
                    </div>
                  )}
                  {p.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{p.description}</p>}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3 w-3" />} onClick={() => openEdit(p)}>Edit</Button>
                    {p.trackStock && <Button size="sm" variant="outline" leftIcon={<Boxes className="h-3 w-3" />} onClick={() => setAdjusting({ id: p.id, name: p.name, stockQty: p.stockQty ?? 0, reorderLevel: p.reorderLevel ?? null })}>Adjust stock</Button>}
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(p)}>{p.active ? 'Hide' : 'Show'}</Button>
                    <button onClick={() => handleDelete(p)} aria-label={`Delete ${p.name}`} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-600 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AdjustStockModal product={adjusting} onClose={() => setAdjusting(null)} onDone={() => { void loadProducts(); }} />
      {user && <CategoryManager vendorId={user.id} isOpen={catsOpen} onClose={() => setCatsOpen(false)} onChanged={() => { void loadCategories(); void loadProducts(); }} />}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? `Edit ${labels.singular}` : `Add ${labels.singular}`} maxWidth="max-w-lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={labels.placeholder} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Price (₹)</label>
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Category</label>
              <input value={form.category} list="my-product-categories" onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} />
              <datalist id="my-product-categories">{categoryNames.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
          </div>

          {/* Availability + stock */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="prod-status">Availability on website</label>
                <select id="prod-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputCls}>
                  <option value="AVAILABLE">Available</option>
                  <option value="OUT_OF_STOCK">Out of stock (shown, can&apos;t be ordered)</option>
                  <option value="HIDDEN">Hidden (not shown)</option>
                </select>
              </div>
              {showStock && (
                <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-slate-700">
                  <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
                  Track stock for this product
                </label>
              )}
            </div>
            {showStock && trackStock && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="prod-qty">{wasTracked ? 'In stock now' : 'Quantity in stock (opening stock)'}</label>
                  {wasTracked ? (
                    <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700"><strong>{currentQty ?? 0}</strong> <span className="text-xs text-slate-400">— change it with “Adjust stock” on the product card</span></p>
                  ) : (
                    <input id="prod-qty" inputMode="numeric" value={openingQty} onChange={(e) => setOpeningQty(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" className={inputCls} />
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="prod-low">Low-stock alert at <span className="text-slate-400">(optional)</span></label>
                  <input id="prod-low" inputMode="numeric" value={lowLevel} onChange={(e) => setLowLevel(e.target.value.replace(/[^\d]/g, ''))} placeholder="e.g. 3" className={inputCls} />
                </div>
              </div>
            )}
            {showStock && trackStock && <p className="mt-2 text-[11px] text-slate-400">Customers can never order more than you have. Website orders take stock off automatically; shop sales you record with Adjust stock.</p>}
          </div>

          {/* Rich per-category fields (real estate → area/config/type, restaurant → course/diet/serves, …) */}
          {listingFields.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {listingFields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">{f.label}</label>
                  {f.type === 'select' ? (
                    <select value={custom[f.key] ?? ''} onChange={(e) => setCustom({ ...custom, [f.key]: e.target.value })} className={inputCls}>
                      <option value="">—</option>
                      {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={custom[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setCustom({ ...custom, [f.key]: e.target.value })} className={inputCls} />
                  )}
                </div>
              ))}
            </div>
          )}
          {showVariants && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Sizes <span className="text-slate-400">(comma separated)</span></label>
                <input value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="e.g. S, M, L, XL" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Colors <span className="text-slate-400">(comma separated)</span></label>
                <input value={colors} onChange={(e) => setColors(e.target.value)} placeholder="e.g. Black, Red, Navy Blue" className={inputCls} />
              </div>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Highlights / tags <span className="text-slate-400">(comma separated)</span></label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. Ready to Move, Popular" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Photo <span className="text-slate-400">(main image)</span></label>
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
                  {uploading ? 'Uploading…' : form.image ? 'Change photo' : 'Upload photo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadImage(f); }} />
                </label>
                {form.image && <button type="button" onClick={() => setForm({ ...form, image: '' })} className="ml-2 text-xs text-error-600 hover:underline">Remove</button>}
                <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="…or paste an image URL"
                  className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-xs focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Gallery <span className="text-slate-400">(extra photos — the first one after the main photo is shown first)</span></label>
            <div className="flex flex-wrap gap-3">
              {gallery.map((url, i) => (
                <div key={url} className="w-[4.5rem] flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Extra photo ${i + 1}`} className="h-[4.5rem] w-[4.5rem] rounded-xl object-cover" />
                  <div className="mt-1 flex items-center justify-between">
                    <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => setGallery((g) => moveItem(g, i, -1))} className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Make this the main photo" title="Make main photo" onClick={() => { const m = makeMain(form.image, gallery, i); setForm((f) => ({ ...f, image: m.image })); setGallery(m.gallery); }} className="rounded p-0.5 text-slate-400"><Star className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Move later" disabled={i === gallery.length - 1} onClick={() => setGallery((g) => moveItem(g, i, 1))} className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5" /></button>
                  </div>
                  <button type="button" onClick={() => removeGalleryImage(url)} className="mt-0.5 w-full text-center text-[11px] text-error-600 hover:underline">Remove</button>
                </div>
              ))}
              <label className="flex h-[4.5rem] w-[4.5rem] flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400 hover:border-primary-300 hover:text-primary-500" aria-label="Add another photo">
                {uploadingGallery ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploadingGallery} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadGalleryImage(f); }} />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">png, jpg, webp or gif · up to 5 MB each.</p>
            {uploadError && <p role="alert" className="mt-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700">{uploadError}</p>}
          </div>
          {error && <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700">{error}</div>}
          <Button type="submit" fullWidth loading={saving} disabled={uploading || uploadingGallery}>{editingId ? 'Save Changes' : `Add ${labels.singular}`}</Button>
        </form>
      </Modal>
    </div>
  );
}
