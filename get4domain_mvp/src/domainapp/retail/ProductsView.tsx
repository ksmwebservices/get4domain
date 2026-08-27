'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Package, Search } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Product { id: string; name: string; sku?: string; category?: string; price: number; stockQty: number; reorderLevel: number; active: boolean }

const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const emptyForm = (): Record<string, unknown> => ({ name: '', sku: '', category: '', price: 0, stockQty: 0, reorderLevel: 5, active: true });

export default function ProductsView() {
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getRetailProducts().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setForm({ ...p }); setOpen(true); };

  async function save() {
    if (!String(form.name).trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price) || 0, stockQty: Number(form.stockQty) || 0, reorderLevel: Number(form.reorderLevel) || 0 };
      editing ? await api.updateRetailProduct(editing.id, payload) : await api.createRetailProduct(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(p: Product) { if (confirm(`Delete "${p.name}"?`)) { await api.deleteRetailProduct(p.id); load(); } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Products</h1><p className="mt-0.5 text-sm text-slate-500">Your sellable catalog — price, SKU and stock.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Product</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="Package" title={rows.length ? 'No matches' : 'No products yet'} subtitle="Add products to sell them at the point of sale." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Product</Button>} /></Card>
        : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <Card key={p.id} padded className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Package className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="truncate text-sm font-bold text-slate-900">{p.name}</span>{!p.active && <Badge color="#64748b">Inactive</Badge>}{p.stockQty <= p.reorderLevel && <Badge color="#dc2626">Low</Badge>}</div>
                    <div className="truncate text-xs text-slate-500">{p.sku && `${p.sku} · `}{p.category && `${p.category} · `}{inr(p.price)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right"><div className="text-sm font-bold text-slate-900">{p.stockQty}</div><div className="text-[10px] uppercase text-slate-400">in stock</div></div>
                  <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
            ))}
          </div>
        )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Product' : 'Add Product'} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" required value={(form.name as string) ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="SKU" value={(form.sku as string) ?? ''} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Category" value={(form.category as string) ?? ''} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <Input label="Price (₹)" type="number" value={(form.price as number) ?? 0} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Stock qty" type="number" value={(form.stockQty as number) ?? 0} onChange={(e) => setForm({ ...form, stockQty: Number(e.target.value) })} />
            <Input label="Reorder ≤" type="number" value={(form.reorderLevel as number) ?? 5} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={Boolean(form.active)} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Active</label>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
