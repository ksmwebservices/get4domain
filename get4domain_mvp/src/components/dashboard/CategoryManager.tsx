'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, Check, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { moveItem } from '@/lib/stock-ui';

export interface ManagedCategory { id: string; name: string; hidden: boolean; sortOrder: number; productCount: number }
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

/** Create, rename, show/hide, re-order and delete the shop's categories. The website's filters and menus follow this list. */
export default function CategoryManager({ vendorId, isOpen, onClose, onChanged }: { vendorId: string; isOpen: boolean; onClose: () => void; onChanged: () => void }) {
  const [cats, setCats] = useState<ManagedCategory[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleting, setDeleting] = useState<ManagedCategory | null>(null);
  const [moveTo, setMoveTo] = useState('');

  const load = useCallback(async () => {
    try { const r = await api.getCategoriesManage(vendorId); setCats((r.data ?? r) as ManagedCategory[]); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load categories.'); setCats([]); }
  }, [vendorId]);
  useEffect(() => { if (isOpen) { setCats(null); void load(); } }, [isOpen, load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); await load(); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'That did not work.'); }
    finally { setBusy(false); }
  }

  const add = () => { const name = newName.trim(); if (!name) return; void run(async () => { await api.createCategory(vendorId, name); setNewName(''); }); };
  const rename = (c: ManagedCategory) => { const name = editName.trim(); if (!name || name === c.name) { setEditing(null); return; } void run(async () => { await api.updateCategory(vendorId, c.id, { name }); setEditing(null); }); };
  const toggleHidden = (c: ManagedCategory) => void run(() => api.updateCategory(vendorId, c.id, { hidden: !c.hidden }));
  const move = (index: number, delta: -1 | 1) => { if (!cats) return; const next = moveItem(cats, index, delta); if (next === cats) return; setCats(next); void run(() => api.reorderCategories(vendorId, next.map((c) => c.id))); };
  const confirmDelete = () => {
    if (!deleting) return;
    const c = deleting;
    void run(async () => { await api.deleteCategory(vendorId, c.id, c.productCount > 0 ? moveTo : undefined); setDeleting(null); setMoveTo(''); });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Categories" maxWidth="max-w-lg">
      <p className="mb-4 text-xs text-slate-500">These are the filters and menu entries on your website. Hidden categories stay in your dashboard but disappear from the site.</p>
      {error && <div role="alert" className="mb-3 rounded-xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-sm text-error-700">{error}</div>}

      <div className="mb-4 flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} maxLength={60} placeholder="New category, e.g. Kids" className={inputCls} aria-label="New category name" />
        <Button size="sm" onClick={add} disabled={busy || !newName.trim()} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add</Button>
      </div>

      {cats === null ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : cats.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">No categories yet. Add one above, or just type a category when you add a product.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {cats.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2">
              <div className="flex flex-col">
                <button type="button" aria-label={`Move ${c.name} up`} disabled={busy || i === 0} onClick={() => move(i, -1)} className="text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label={`Move ${c.name} down`} disabled={busy || i === cats.length - 1} onClick={() => move(i, 1)} className="text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
              <div className="min-w-0 flex-1">
                {editing === c.id ? (
                  <div className="flex items-center gap-1.5">
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') rename(c); if (e.key === 'Escape') setEditing(null); }} maxLength={60} className={inputCls} aria-label={`Rename ${c.name}`} />
                    <button type="button" aria-label="Save name" onClick={() => rename(c)} className="rounded-lg p-1.5 text-success-600 hover:bg-success-50"><Check className="h-4 w-4" /></button>
                    <button type="button" aria-label="Cancel" onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className={c.hidden ? 'opacity-60' : ''}>
                    <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{c.productCount} product{c.productCount === 1 ? '' : 's'}{c.hidden ? ' · hidden on website' : ''}</span>
                  </div>
                )}
              </div>
              {editing !== c.id && (
                <div className="flex items-center gap-0.5">
                  <button type="button" aria-label={`Rename ${c.name}`} disabled={busy} onClick={() => { setEditing(c.id); setEditName(c.name); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label={c.hidden ? `Show ${c.name} on website` : `Hide ${c.name} on website`} disabled={busy} onClick={() => toggleHidden(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700">{c.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                  <button type="button" aria-label={`Delete ${c.name}`} disabled={busy} onClick={() => { setDeleting(c); setMoveTo(''); setError(''); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-error-50 hover:text-error-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <div className="mt-4 space-y-3 rounded-xl border border-error-200 bg-error-50/60 p-4 text-sm" role="alertdialog" aria-label={`Delete ${deleting.name}`}>
          {deleting.productCount > 0 ? (
            <>
              <p className="text-slate-800"><strong>{deleting.name}</strong> has {deleting.productCount} product{deleting.productCount === 1 ? '' : 's'}. Choose where they should go — they are not deleted.</p>
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={inputCls} aria-label="Move products to">
                <option value="">Choose a category…</option>
                {(cats ?? []).filter((c) => c.id !== deleting.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </>
          ) : (
            <p className="text-slate-800">Delete <strong>{deleting.name}</strong>? It has no products.</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDeleting(null)}>Keep it</Button>
            <Button size="sm" onClick={confirmDelete} disabled={busy || (deleting.productCount > 0 && !moveTo)} loading={busy}>{deleting.productCount > 0 ? 'Move products and delete' : 'Delete category'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
