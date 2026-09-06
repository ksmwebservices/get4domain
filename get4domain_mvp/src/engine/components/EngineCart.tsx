'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ShoppingCart, X, Plus, Minus, Trash2, ShieldCheck, Check } from 'lucide-react';
import { api } from '@/lib/api';

export interface CartLine { name: string; price: number; qty: number; catalogItemId?: string }

interface CartCtx {
  enabled: boolean;
  lines: CartLine[];
  add: (line: Omit<CartLine, 'qty'>) => void;
  setQty: (name: string, qty: number) => void;
  remove: (name: string) => void;
  clear: () => void;
  count: number;
  openCheckout: () => void;
}

const Ctx = createContext<CartCtx | null>(null);

/** Available to any descendant; returns a disabled cart when there's no enabled provider
 *  (so Add buttons self-hide on non-shop / demo / preview sites). */
export function useCart(): CartCtx {
  return useContext(Ctx) ?? { enabled: false, lines: [], add: () => {}, setQty: () => {}, remove: () => {}, clear: () => {}, count: 0, openCheckout: () => {} };
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface RzpResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }

/**
 * Public-site shopping cart + checkout. Enabled only on LIVE sites whose vendor has
 * turned on payments. Checkout calls the engine public dispatch: create the order with
 * the VENDOR's Razorpay keys, open Razorpay, then confirm (record sale + stock). Money
 * goes straight to the vendor. Reused across every industry via the engine.
 */
export function CartProvider({ enabled, subdomain, brandName, children }: { enabled: boolean; subdomain: string; brandName: string; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);

  const value = useMemo<CartCtx>(() => ({
    enabled,
    lines,
    add: (line) => setLines((cur) => {
      const i = cur.findIndex((l) => l.name === line.name);
      if (i >= 0) { const next = [...cur]; next[i] = { ...next[i], qty: next[i].qty + 1 }; return next; }
      return [...cur, { ...line, qty: 1 }];
    }),
    setQty: (name, qty) => setLines((cur) => cur.map((l) => (l.name === name ? { ...l, qty: Math.max(1, qty) } : l))),
    remove: (name) => setLines((cur) => cur.filter((l) => l.name !== name)),
    clear: () => setLines([]),
    count: lines.reduce((s, l) => s + l.qty, 0),
    openCheckout: () => setOpen(true),
  }), [enabled, lines]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {enabled && value.count > 0 && !open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-[var(--eng-accent)] px-5 py-3 text-sm font-bold text-[var(--eng-accent-fg)] shadow-xl md:bottom-6"
          style={{ borderRadius: '9999px' }}>
          <ShoppingCart className="h-4 w-4" /> {value.count} · {rupees(lines.reduce((s, l) => s + l.price * l.qty, 0))}
        </button>
      )}
      {enabled && open && <CheckoutModal subdomain={subdomain} brandName={brandName} lines={lines} onClose={() => setOpen(false)} onDone={() => { setLines([]); }} setQty={value.setQty} remove={value.remove} />}
    </Ctx.Provider>
  );
}

function CheckoutModal({ subdomain, brandName, lines, onClose, onDone, setQty, remove }: {
  subdomain: string; brandName: string; lines: CartLine[]; onClose: () => void; onDone: () => void;
  setQty: (name: string, qty: number) => void; remove: (name: string) => void;
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const valid = form.name.trim() && /^\d{10}$/.test(form.phone.replace(/\D/g, '').slice(-10));

  const pay = async () => {
    if (!valid || lines.length === 0) { setError('Add items and enter your name + a 10-digit mobile.'); return; }
    setError(''); setPaying(true);
    try {
      const phone = form.phone.replace(/\D/g, '').slice(-10);
      const items = lines.map((l) => ({ name: l.name, price: l.price, qty: l.qty, catalogItemId: l.catalogItemId }));
      const orderRes = await api.engineDispatchPublic(subdomain, 'engine.checkout.order', { items, name: form.name, phone, email: form.email || undefined });
      const order = (orderRes.data ?? orderRes) as { razorpayOrderId: string; keyId: string; amount: number; currency: string };
      const ok = await loadRazorpay();
      const Rzp = (window as unknown as { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay;
      if (!ok || !Rzp) throw new Error('Could not load the payment window. Please try again.');
      const rzp = new Rzp({
        key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.razorpayOrderId,
        name: brandName, description: `Order · ${lines.length} item(s)`,
        prefill: { name: form.name, email: form.email, contact: phone },
        handler: async (r: RzpResponse) => {
          try {
            await api.engineDispatchPublic(subdomain, 'engine.checkout.confirm', {
              items, name: form.name, phone, email: form.email || undefined,
              razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature,
            });
            setDone(true); onDone();
          } catch (e) { setError(e instanceof Error ? e.message : 'Payment captured but order recording failed — keep your payment id and contact the business.'); }
          finally { setPaying(false); }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout.');
      setPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 text-slate-900 sm:rounded-2xl">
        {done ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"><Check className="h-8 w-8 text-green-600" /></div>
            <h3 className="text-xl font-bold">Order placed 🎉</h3>
            <p className="mt-2 text-sm text-slate-500">Thanks, {form.name.split(' ')[0]}! {brandName} has your order and will be in touch.</p>
            <button onClick={onClose} className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Done</button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Your order</h3>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.name} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{l.name}</div>
                    <div className="text-xs text-slate-500">{rupees(l.price)} each</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(l.name, l.qty - 1)} className="rounded-md border border-slate-200 p-1"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                    <button onClick={() => setQty(l.name, l.qty + 1)} className="rounded-md border border-slate-200 p-1"><Plus className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(l.name)} aria-label="Remove" className="ml-1 rounded-md p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-bold">
              <span>Total</span><span>{rupees(total)}</span>
            </div>
            <div className="mt-4 space-y-2.5">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-slate-400 focus:outline-none" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="numeric" placeholder="10-digit mobile" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-slate-400 focus:outline-none" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="Email (optional)" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-slate-400 focus:outline-none" />
            </div>
            {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>}
            <button onClick={pay} disabled={paying || !valid || lines.length === 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--eng-accent)] px-5 py-3 text-sm font-bold text-[var(--eng-accent-fg)] disabled:opacity-50">
              <ShieldCheck className="h-4 w-4" /> {paying ? 'Processing…' : `Pay ${rupees(total)}`}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">Secure payment · goes directly to {brandName}.</p>
          </>
        )}
      </div>
    </div>
  );
}

/** Item "Add" button — self-hides unless a shop-enabled CartProvider is above it. */
export function AddToCartButton({ name, price, catalogItemId }: { name: string; price: number; catalogItemId?: string }) {
  const cart = useCart();
  if (!cart.enabled || !(price > 0)) return null;
  return (
    <button onClick={() => cart.add({ name, price, catalogItemId })}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--eng-accent)] px-4 py-2 text-xs font-bold text-[var(--eng-accent-fg)]">
      <Plus className="h-3.5 w-3.5" /> Add to cart
    </button>
  );
}
