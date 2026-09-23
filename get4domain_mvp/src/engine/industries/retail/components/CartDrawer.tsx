'use client';

/**
 * Ported from the reference design's `components/cart/CartDrawer.tsx` + `CartView.tsx`
 * (slide-over line list, qty steppers, subtotal) — reimplemented as one drawer (no
 * shadcn `Sheet`/Radix) and, critically, with REAL checkout wired in where the
 * reference had none: its "Checkout" button pointed at a `/checkout` route that
 * doesn't exist, and CartView's own Pay button just showed a toast ("Checkout flow
 * coming soon!"). Here, Pay calls the SAME backend contract `EngineCart.tsx` already
 * uses elsewhere in the engine — `engine.checkout.order` → Razorpay → `engine.checkout.
 * confirm`, via `api.engineDispatchPublic` — so a real PosSale row is created and the
 * vendor is paid directly. Only difference from EngineCart's version: this cart carries
 * size/colour per line, and lets you browse/add/remove even before a vendor (demo mode)
 * exists, with an honest explanation instead of a fake charge when there's no vendor to
 * pay.
 */
import { useState } from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag, ShieldCheck, Check, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useRetailCart } from '../cart-context';

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

export default function CartDrawer() {
  const cart = useRetailCart();
  if (!cart.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={cart.closeCart}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-[var(--eng-surface)] text-[var(--eng-fg)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--eng-border)] px-5 py-4">
          <span className="flex items-center gap-2 text-base font-bold"><ShoppingBag className="h-4.5 w-4.5" /> Your cart {cart.count > 0 && `(${cart.count})`}</span>
          <button onClick={cart.closeCart} aria-label="Close cart" className="rounded-full p-1.5 text-[var(--eng-muted)] hover:bg-[var(--eng-bg)]"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cart.lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="h-10 w-10 text-[var(--eng-muted)]" />
              <p className="mt-3 text-sm text-[var(--eng-muted)]">Your cart is empty — add something from the shop.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.lines.map((l) => (
                <div key={l.lineId} className="flex items-center gap-3 p-2.5" style={{ borderRadius: 'var(--eng-radius)', border: '1px solid var(--eng-border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.image} alt="" className="h-14 w-14 flex-shrink-0 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{l.name}</div>
                    <div className="text-xs text-[var(--eng-muted)]">{rupees(l.price)} each</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => cart.setQty(l.lineId, l.qty - 1)} className="rounded-md border border-[var(--eng-border)] p-1"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                    <button onClick={() => cart.setQty(l.lineId, l.qty + 1)} className="rounded-md border border-[var(--eng-border)] p-1"><Plus className="h-3.5 w-3.5" /></button>
                    <button onClick={() => cart.remove(l.lineId)} aria-label="Remove" className="ml-1 rounded-md p-1 text-[var(--eng-muted)] hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.lines.length > 0 && (
          <div className="border-t border-[var(--eng-border)] p-5">
            <div className="mb-4 flex items-center justify-between text-sm font-bold">
              <span>Subtotal</span><span>{rupees(cart.subtotal)}</span>
            </div>
            {cart.canCheckout ? <CheckoutPanel /> : <DemoCheckoutNotice />}
          </div>
        )}
      </div>
    </div>
  );
}

/** Demo mode: a category page has no vendor to charge — browsing/cart is fully real,
 *  but a genuine payment needs a genuine vendor. Says so plainly instead of faking it. */
function DemoCheckoutNotice() {
  return (
    <div className="space-y-2.5 text-center">
      <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--eng-muted)]">
        <Sparkles className="h-3.5 w-3.5 text-[var(--eng-accent)]" /> This is a live demo of the shopping experience.
      </p>
      <p className="text-xs text-[var(--eng-muted)]">Checkout activates automatically on your own store, with your own products and your own Razorpay account.</p>
      <a href="/book-demo" className="mt-1 flex w-full items-center justify-center gap-2 py-3 text-sm font-bold" style={{ borderRadius: 'var(--eng-radius)', background: 'var(--eng-accent)', color: 'var(--eng-accent-fg)' }}>
        Launch my own store
      </a>
    </div>
  );
}

function CheckoutPanel() {
  const cart = useRetailCart();
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const valid = form.name.trim() && /^\d{10}$/.test(form.phone.replace(/\D/g, '').slice(-10));

  const pay = async () => {
    if (!valid || cart.lines.length === 0) { setError('Enter your name and a 10-digit mobile number.'); return; }
    setError(''); setPaying(true);
    try {
      const phone = form.phone.replace(/\D/g, '').slice(-10);
      const items = cart.lines.map((l) => ({ name: l.name, price: l.price, qty: l.qty, catalogItemId: l.catalogItemId }));
      const orderRes = await api.engineDispatchPublic(cart.subdomain, 'engine.checkout.order', { items, name: form.name, phone, email: form.email || undefined });
      const order = (orderRes.data ?? orderRes) as { razorpayOrderId: string; keyId: string; amount: number; currency: string };
      const ok = await loadRazorpay();
      const Rzp = (window as unknown as { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay;
      if (!ok || !Rzp) throw new Error('Could not load the payment window. Please try again.');
      const rzp = new Rzp({
        key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.razorpayOrderId,
        name: cart.brandName, description: `Order · ${cart.lines.length} item(s)`,
        prefill: { name: form.name, email: form.email, contact: phone },
        handler: async (r: RzpResponse) => {
          try {
            await api.engineDispatchPublic(cart.subdomain, 'engine.checkout.confirm', {
              items, name: form.name, phone, email: form.email || undefined,
              razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature,
            });
            setDone(true);
            cart.clear();
          } catch (e) { setError(e instanceof Error ? e.message : 'Payment captured but order recording failed — keep your payment id and contact us.'); }
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

  if (done) {
    return (
      <div className="py-2 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100"><Check className="h-7 w-7 text-green-600" /></div>
        <h3 className="text-base font-bold">Order placed 🎉</h3>
        <p className="mt-1.5 text-xs text-[var(--eng-muted)]">Thanks, {form.name.split(' ')[0]}! {cart.brandName} has your order and will be in touch.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="w-full px-3.5 py-2.5 text-sm outline-none" style={{ borderRadius: 'var(--eng-radius)', border: '1px solid var(--eng-border)', background: 'var(--eng-bg)', color: 'var(--eng-fg)' }} />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="numeric" placeholder="10-digit mobile" className="w-full px-3.5 py-2.5 text-sm outline-none" style={{ borderRadius: 'var(--eng-radius)', border: '1px solid var(--eng-border)', background: 'var(--eng-bg)', color: 'var(--eng-fg)' }} />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="Email (optional)" className="w-full px-3.5 py-2.5 text-sm outline-none" style={{ borderRadius: 'var(--eng-radius)', border: '1px solid var(--eng-border)', background: 'var(--eng-bg)', color: 'var(--eng-fg)' }} />
      </div>
      {error && <div className="mt-2.5 px-3.5 py-2.5 text-xs text-red-600" style={{ borderRadius: 'var(--eng-radius)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' }}>{error}</div>}
      <button onClick={pay} disabled={paying || !valid} className="mt-3 flex w-full items-center justify-center gap-2 py-3 text-sm font-bold disabled:opacity-50" style={{ borderRadius: 'var(--eng-radius)', background: 'var(--eng-accent)', color: 'var(--eng-accent-fg)' }}>
        <ShieldCheck className="h-4 w-4" /> {paying ? 'Processing…' : `Pay ${rupees(cart.subtotal)}`}
      </button>
      <p className="mt-2 text-center text-[11px] text-[var(--eng-muted)]">Secure payment · goes directly to {cart.brandName}.</p>
    </>
  );
}
