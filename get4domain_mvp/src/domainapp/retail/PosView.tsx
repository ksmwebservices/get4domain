'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Minus, ShoppingCart, Search, Receipt, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Product { id: string; name: string; sku?: string; price: number; stockQty: number }
interface SaleLine { productId: string; name: string; qty: number; price: number }
interface Sale { id: string; items: SaleLine[]; subtotal: number; taxAmount: number; total: number; paymentMethod: string; status: string; createdAt: string }
interface CartLine { productId: string; name: string; price: number; stockQty: number; qty: number }

const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmtDT = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function PosView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.getRetailProducts().then((r) => setProducts(r.data ?? [])).catch(() => setProducts([])).finally(() => setLoading(false));
    api.getRetailSales().then((r) => setSales(r.data ?? [])).catch(() => setSales([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const cartTotal = useMemo(() => cart.reduce((s, l) => s + l.price * l.qty, 0), [cart]);
  const inCart = (id: string) => cart.find((l) => l.productId === id)?.qty ?? 0;

  function add(p: Product) {
    if (p.stockQty <= 0) return;
    setCart((c) => {
      const i = c.findIndex((l) => l.productId === p.id);
      if (i >= 0) { if (c[i].qty >= p.stockQty) return c; const n = [...c]; n[i] = { ...n[i], qty: n[i].qty + 1 }; return n; }
      return [...c, { productId: p.id, name: p.name, price: p.price, stockQty: p.stockQty, qty: 1 }];
    });
  }
  function bump(idx: number, d: 1 | -1) {
    setCart((c) => { const n = [...c]; const q = n[idx].qty + d; if (q <= 0) return n.filter((_, i) => i !== idx); if (q > n[idx].stockQty) return n; n[idx] = { ...n[idx], qty: q }; return n; });
  }

  async function pay(method: string) {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      const r = await api.createRetailSale({ lines: cart.map((l) => ({ productId: l.productId, qty: l.qty })), paymentMethod: method });
      setCart([]); setCheckout(false); setReceipt(r.data ?? null); load();
    } catch (e: any) {
      alert(e?.message ?? 'Checkout failed');
    } finally { setSaving(false); }
  }
  async function refund(s: Sale) { if (confirm('Refund this sale and restore stock?')) { await api.refundRetailSale(s.id); load(); } }

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-bold text-slate-900">Point of Sale</h1><p className="mt-0.5 text-sm text-slate-500">Ring up a sale — stock is deducted automatically on checkout.</p></div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {/* Product grid */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
            : shown.length === 0 ? <Card padded><EmptyState icon="Package" title={products.length ? 'No matches' : 'No products yet'} subtitle="Add products under the Products tab to sell them here." /></Card>
            : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {shown.map((p) => {
                  const out = p.stockQty <= 0; const n = inCart(p.id);
                  return (
                    <button key={p.id} disabled={out} onClick={() => add(p)} className={`relative rounded-xl border p-3 text-left transition ${out ? 'cursor-not-allowed border-slate-100 opacity-50' : 'border-slate-200 hover:border-primary-300 hover:bg-primary-50'}`}>
                      <div className="text-sm font-semibold text-slate-900 line-clamp-2">{p.name}</div>
                      <div className="mt-1 flex items-center justify-between text-xs"><span className="font-bold text-slate-700">{inr(p.price)}</span><span className={out ? 'text-error-600' : 'text-slate-400'}>{out ? 'Out' : `${p.stockQty} left`}</span></div>
                      {n > 0 && <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1 text-[11px] font-bold text-white">{n}</span>}
                    </button>
                  );
                })}
              </div>
            )}
        </div>

        {/* Cart */}
        <Card padded className="flex h-fit flex-col gap-2 lg:sticky lg:top-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShoppingCart className="h-4 w-4 text-primary-600" />Cart {cart.length > 0 && <span className="text-slate-400">· {cart.length}</span>}</div>
          <div className="space-y-1.5">
            {cart.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">Tap products to add.</p>
              : cart.map((l, i) => (
                <div key={l.productId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-800">{l.name}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => bump(i, -1)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-5 text-center font-semibold">{l.qty}</span>
                    <button onClick={() => bump(i, 1)} disabled={l.qty >= l.stockQty} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><Plus className="h-3.5 w-3.5" /></button>
                    <span className="w-16 text-right font-semibold text-slate-700">{inr(l.price * l.qty)}</span>
                  </div>
                </div>
              ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm"><span className="font-medium text-slate-500">Total</span><span className="text-lg font-extrabold text-slate-900">{inr(cartTotal)}</span></div>
          <Button disabled={cart.length === 0} onClick={() => setCheckout(true)}>Checkout</Button>
        </Card>
      </div>

      {/* Recent sales */}
      {sales.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold text-slate-900">Recent sales</h2>
          <div className="space-y-2">
            {sales.slice(0, 10).map((s) => (
              <Card key={s.id} padded className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Receipt className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{inr(s.total)}</span><Badge color={s.status === 'refunded' ? '#dc2626' : '#16a34a'}>{s.status === 'refunded' ? 'Refunded' : s.paymentMethod}</Badge></div>
                    <div className="truncate text-xs text-slate-500">{(s.items ?? []).reduce((a, l) => a + l.qty, 0)} items · {fmtDT(s.createdAt)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setReceipt(s)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">Receipt</button>
                  {s.status !== 'refunded' && <button onClick={() => refund(s)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-error-600"><RotateCcw className="h-3.5 w-3.5" />Refund</button>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Checkout */}
      <Modal isOpen={checkout} onClose={() => setCheckout(false)} title="Checkout" maxWidth="max-w-sm">
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-center"><div className="text-3xl font-extrabold text-slate-900">{inr(cartTotal)}</div><div className="text-xs text-slate-500">{cart.reduce((a, l) => a + l.qty, 0)} items</div></div>
          <p className="text-center text-xs text-slate-400">Choose a payment method to complete the sale.</p>
          <div className="grid grid-cols-3 gap-2">
            {['cash', 'upi', 'card'].map((m) => <Button key={m} variant={m === 'cash' ? 'primary' : 'outline'} loading={saving} onClick={() => pay(m)}>{m.toUpperCase()}</Button>)}
          </div>
        </div>
      </Modal>

      {/* Receipt */}
      <Modal isOpen={!!receipt} onClose={() => setReceipt(null)} title="Receipt" maxWidth="max-w-sm">
        {receipt && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {(receipt.items ?? []).map((l, i) => (
                <div key={i} className="flex justify-between text-sm"><span className="text-slate-700">{l.qty}× {l.name}</span><span className="font-semibold text-slate-700">{inr(l.price * l.qty)}</span></div>
              ))}
            </div>
            <div className="space-y-1 border-t border-slate-100 pt-2 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{inr(receipt.subtotal)}</span></div>
              {receipt.taxAmount > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>{inr(receipt.taxAmount)}</span></div>}
              <div className="flex justify-between font-bold text-slate-900"><span>Total</span><span>{inr(receipt.total)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Paid via</span><span className="uppercase">{receipt.paymentMethod}</span></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
