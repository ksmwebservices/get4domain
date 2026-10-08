'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart, type CartItem } from '@/lib/cart-context';
import { formatPrice } from '@/lib/products';
import { useSiteData } from '@/lib/use-site';
import { useProducts } from '@/lib/use-products';
import { API_ORIGIN, STEPNROCK_SUBDOMAIN } from '@/lib/site-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Minus, Plus, Trash2, ShoppingBag, ShieldCheck, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

const API_BASE = API_ORIGIN;
const FALLBACK_PHONE = '+919360011107';
const IDEM_KEY = 'snr_order_key';

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

/** One idempotency key per cart attempt: the same cart keeps the same key (a double tap or a retry after a dropped connection
 *  can never place two orders), a changed cart gets a new one. Lives in sessionStorage; falls back to a fresh key if that is blocked. */
function idempotencyKeyFor(signature: string): string {
  const fresh = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2, 10)}`);
  try {
    const saved = JSON.parse(sessionStorage.getItem(IDEM_KEY) || 'null') as { sig: string; key: string } | null;
    if (saved && saved.sig === signature && saved.key) return saved.key;
    const key = fresh();
    sessionStorage.setItem(IDEM_KEY, JSON.stringify({ sig: signature, key }));
    return key;
  } catch {
    return fresh();
  }
}
const forgetKey = () => { try { sessionStorage.removeItem(IDEM_KEY); } catch { /* blocked */ } };

const apiMessage = (j: unknown, fallback: string): string => {
  const m = (j as { message?: unknown } | null)?.message;
  return Array.isArray(m) ? m.join(' ') : typeof m === 'string' && m ? m : fallback;
};

type Line = CartItem & { productId: string; livePrice: number; issue: null | 'gone' | 'out' | 'cap'; liveCap: number };

export function CartView() {
  const { items, updateQuantity, removeFromCart, clearCart, count } = useCart();
  const { site } = useSiteData();
  const { products, loading: catalogueLoading, failed: catalogueFailed, reload } = useProducts();

  // Re-check every line against the shop's CURRENT catalogue: price, availability and the per-order cap can all have changed since it was added.
  const lines: Line[] = useMemo(() => items.map((it) => {
    const productId = it.productId ?? it.slug;
    const fresh = products.find((p) => p.id === productId);
    if (!fresh) return { ...it, productId, livePrice: it.price, issue: catalogueLoading || catalogueFailed ? null : 'gone', liveCap: it.maxQty ?? 10 };
    if (fresh.availability === 'out') return { ...it, productId, livePrice: fresh.price, issue: 'out', liveCap: 0 };
    return { ...it, productId, livePrice: fresh.price, issue: it.quantity > fresh.maxQty ? 'cap' : null, liveCap: fresh.maxQty };
  }), [items, products, catalogueLoading, catalogueFailed]);

  const blocked = lines.some((l) => l.issue !== null);
  const total = lines.reduce((s, l) => s + l.livePrice * l.quantity, 0);
  const priceChanged = lines.some((l) => l.livePrice !== l.price);

  const fixCart = () => {
    for (const l of lines) {
      if (l.issue === 'gone' || l.issue === 'out') removeFromCart(l.id);
      else if (l.issue === 'cap') updateQuantity(l.id, l.liveCap);
    }
    toast('Your cart was updated to what is available.');
  };

  const mode = site?.checkoutMode ?? (site?.paymentsEnabled ? 'ONLINE' : 'NONE');
  const shopPhone = site?.cms?.phone || site?.cms?.whatsapp || FALLBACK_PHONE;
  const shopPhoneDigits = shopPhone.replace(/[^\d+]/g, '');

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | { orderId: string; mode: 'request' | 'paid' }>(null);
  const submitting = useRef(false); // synchronous double-tap guard (state updates are async)

  // Opening checkout refreshes availability first, so the shopper never fills a form for a cart that can't be fulfilled.
  const openCheckout = () => { reload(); setCheckoutOpen(true); };
  useEffect(() => { if (!checkoutOpen) { setError(''); } }, [checkoutOpen]);

  const validate = (): string | null => {
    const phone = form.phone.replace(/\D/g, '').slice(-10);
    if (!form.name.trim()) return 'Enter your name.';
    if (phone.length !== 10) return 'Enter a 10-digit mobile number.';
    if (mode === 'ORDER_REQUEST' && form.address.trim().length < 10) return 'Enter your full delivery address (house/street, area, city, PIN).';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return 'That email does not look right.';
    return null;
  };

  const lineItems = () => lines.map((l) => ({ productId: l.productId, name: `${l.name} — ${l.size} / ${l.color}`, qty: l.quantity }));

  /** ORDER_REQUEST: no payment on the site. The shop gets the order (stock is reserved for it) and calls to confirm and collect payment. */
  const sendRequest = async () => {
    const problem = validate();
    if (problem) return setError(problem);
    if (blocked) return setError('Some items in your cart are no longer available. Update your cart first.');
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    setBusy(true);
    try {
      const signature = lines.map((l) => `${l.productId}:${l.size}:${l.color}:${l.quantity}`).sort().join('|');
      const res = await fetch(`${API_BASE}/engine/public/${STEPNROCK_SUBDOMAIN}/actions/engine.checkout.request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lineItems(), name: form.name.trim(), phone: form.phone.replace(/\D/g, '').slice(-10),
          email: form.email.trim() || undefined, address: form.address.trim(), note: form.note.trim() || undefined,
          idempotencyKey: idempotencyKeyFor(signature),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400 || res.status === 409) reload(); // stock changed under us: refresh what the cart shows
        throw new Error(apiMessage(json, 'We could not send your order. Please try again.'));
      }
      const data = (json.data ?? json) as { orderId: string };
      forgetKey();
      clearCart();
      setDone({ orderId: data.orderId, mode: 'request' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not send your order. Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  /** ONLINE: the shop's own Razorpay. Money goes straight to the shop. */
  const pay = async () => {
    const problem = validate();
    if (problem) return setError(problem);
    if (blocked) return setError('Some items in your cart are no longer available. Update your cart first.');
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    setBusy(true);
    const phone = form.phone.replace(/\D/g, '').slice(-10);
    try {
      const body = { items: lineItems(), name: form.name.trim(), phone, email: form.email.trim() || undefined };
      const orderRes = await fetch(`${API_BASE}/engine/public/${STEPNROCK_SUBDOMAIN}/actions/engine.checkout.order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const orderJson = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) { if (orderRes.status === 400) reload(); throw new Error(apiMessage(orderJson, 'Could not start checkout.')); }
      const order = (orderJson.data ?? orderJson) as { razorpayOrderId: string; keyId: string; amount: number; currency: string };
      const ok = await loadRazorpay();
      const Rzp = (window as unknown as { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay;
      if (!ok || !Rzp) throw new Error('Could not load the payment window. Please try again.');
      const rzp = new Rzp({
        key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.razorpayOrderId,
        name: 'Step N Rock', description: `Order · ${lines.length} item(s)`,
        prefill: { name: form.name, email: form.email, contact: phone },
        handler: async (r: RzpResponse) => {
          try {
            const confirmRes = await fetch(`${API_BASE}/engine/public/${STEPNROCK_SUBDOMAIN}/actions/engine.checkout.confirm`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...body, razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature }),
            });
            const j = await confirmRes.json().catch(() => ({}));
            if (!confirmRes.ok) throw new Error(apiMessage(j, `Payment received but we could not record the order — please contact the shop and quote payment ${r.razorpay_payment_id}.`));
            clearCart();
            setDone({ orderId: ((j.data ?? j) as { saleId?: string }).saleId ?? '', mode: 'paid' });
          } catch (e) {
            setError(e instanceof Error ? e.message : `Payment received but we could not record the order — please contact the shop and quote payment ${r.razorpay_payment_id}.`);
          } finally { submitting.current = false; setBusy(false); }
        },
        modal: { ondismiss: () => { submitting.current = false; setBusy(false); } },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout.');
      submitting.current = false;
      setBusy(false);
    }
  };

  if (items.length === 0 && !done) {
    return (
      <>
        <Toaster position="top-center" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="flex flex-col items-center justify-center text-center gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent">
              <ShoppingBag className="h-12 w-12 text-muted-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold mb-2">Your cart is empty</h1>
              <p className="text-muted-foreground max-w-md">
                Looks like you haven&apos;t added anything yet. Explore the collection and find your next favourite pair.
              </p>
            </div>
            <Button asChild size="lg"><Link href="/shop">Start shopping <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>
          </div>
        </div>
      </>
    );
  }

  const cta = mode === 'ORDER_REQUEST' ? 'Place order request' : 'Proceed to checkout';

  return (
    <>
      <Toaster position="top-center" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <nav className="text-sm text-muted-foreground mb-4">
          <Link href="/" className="hover:text-primary">Home</Link> / <span className="text-foreground font-medium">Cart</span>
        </nav>

        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Your cart</h1>
        <p className="text-muted-foreground mb-8">Review your items and proceed when you&apos;re ready.</p>

        {blocked && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> Some items are no longer available in the quantity you chose.</span>
            <Button size="sm" variant="outline" onClick={fixCart}>Update my cart</Button>
          </div>
        )}
        {priceChanged && !blocked && (
          <div className="mb-6 rounded-xl border border-border bg-accent/50 p-3 text-sm text-muted-foreground">Some prices changed since you added them — the totals below use today&apos;s prices.</div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {lines.map((item) => (
              <div key={item.id} className={`flex gap-4 p-4 rounded-2xl border hover:shadow-md transition-shadow ${item.issue ? 'border-amber-400' : 'border-border'}`}>
                <Link href={`/product/${item.productId}`} className="shrink-0">
                  <img src={item.image} alt={item.name} className="h-24 w-24 sm:h-28 sm:w-28 rounded-xl object-cover border border-border" />
                </Link>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <Link href={`/product/${item.productId}`}>
                      <h3 className="font-semibold text-sm sm:text-base hover:text-primary transition-colors line-clamp-1">{item.name}</h3>
                    </Link>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{item.color} / Size {item.size}</p>
                    <p className="text-sm font-semibold mt-1">{formatPrice(item.livePrice)}</p>
                    {item.issue === 'gone' && <p className="mt-1 text-xs font-medium text-amber-700">No longer available</p>}
                    {item.issue === 'out' && <p className="mt-1 text-xs font-medium text-amber-700">Out of stock</p>}
                    {item.issue === 'cap' && <p className="mt-1 text-xs font-medium text-amber-700">Only {item.liveCap} available</p>}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 border border-border rounded-lg">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center hover:bg-accent rounded-l-lg transition-colors" aria-label="Decrease quantity">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.liveCap} className="flex h-8 w-8 items-center justify-center hover:bg-accent rounded-r-lg transition-colors disabled:opacity-40" aria-label="Increase quantity">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm sm:text-base">{formatPrice(item.livePrice * item.quantity)}</span>
                      <button onClick={() => { removeFromCart(item.id); toast('Item removed'); }} className="text-muted-foreground hover:text-destructive transition-colors" aria-label="Remove item">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-between items-center pt-2">
              <Button asChild variant="ghost"><Link href="/shop">Continue shopping</Link></Button>
              <Button variant="ghost" onClick={() => { clearCart(); toast('Cart cleared'); }} className="text-muted-foreground hover:text-destructive">Clear cart</Button>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              <div className="p-6 rounded-2xl border border-border bg-background">
                <h2 className="font-display text-lg font-bold mb-4">Order summary</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal ({count} item{count !== 1 ? 's' : ''})</span>
                    <span className="font-medium">{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery</span>
                    <span>Confirmed by the shop</span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between text-base font-bold">
                    <span>Items total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>

                <Button onClick={openCheckout} disabled={blocked} size="lg" className="w-full mt-4">
                  {cta} <ArrowRight className="h-4 w-4 ml-1" />
                </Button>

                {mode === 'ORDER_REQUEST' ? (
                  <p className="mt-3 text-center text-xs text-muted-foreground">You won&apos;t be charged now. The shop will call to confirm your order and arrange payment.</p>
                ) : mode === 'ONLINE' ? (
                  <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Secure payment · UPI · Cards · Net banking
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={(o) => { setCheckoutOpen(o); if (!o && done) setDone(null); }}>
        <DialogContent>
          {done ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="font-display text-xl font-bold">{done.mode === 'request' ? 'Order request sent' : 'Order placed'}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Thanks, {form.name.trim().split(' ')[0] || 'there'}!{' '}
                {done.mode === 'request'
                  ? 'Step N Rock has your request and will call you to confirm the order, delivery and payment.'
                  : 'Step N Rock has your order and will be in touch.'}
              </p>
              {done.orderId && <p className="mt-2 text-xs text-muted-foreground">Reference: {done.orderId.slice(-8).toUpperCase()}</p>}
              <Button onClick={() => { setCheckoutOpen(false); setDone(null); }} className="mt-5">Done</Button>
            </div>
          ) : mode === 'NONE' ? (
            <>
              <DialogHeader>
                <DialogTitle>Order by phone</DialogTitle>
                <DialogDescription>
                  Online ordering isn&apos;t switched on yet. Your cart is saved — call or WhatsApp{' '}
                  <a href={`tel:${shopPhoneDigits}`} className="text-primary hover:underline">{shopPhone}</a> and we&apos;ll take your order directly.
                </DialogDescription>
              </DialogHeader>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{mode === 'ORDER_REQUEST' ? 'Send your order request' : 'Complete your order'}</DialogTitle>
                <DialogDescription>{formatPrice(total)} · {count} item{count !== 1 ? 's' : ''}{mode === 'ORDER_REQUEST' ? ' · pay the shop when it confirms' : ''}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Your name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="10-digit mobile" autoComplete="tel" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                {mode === 'ORDER_REQUEST' && (
                  <textarea
                    placeholder="Delivery address — house/street, area, city, PIN"
                    autoComplete="street-address"
                    rows={3}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
                <Input placeholder="Email (optional)" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                {mode === 'ORDER_REQUEST' && (
                  <Input placeholder="Note for the shop (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                )}
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {mode === 'ORDER_REQUEST' ? (
                <Button onClick={sendRequest} disabled={busy || blocked} size="lg" className="w-full">
                  {busy ? 'Sending…' : `Send order request · ${formatPrice(total)}`}
                </Button>
              ) : (
                <Button onClick={pay} disabled={busy || blocked} size="lg" className="w-full">
                  <ShieldCheck className="h-4 w-4 mr-1" /> {busy ? 'Processing…' : `Pay ${formatPrice(total)}`}
                </Button>
              )}
              <p className="text-center text-xs text-muted-foreground">
                {mode === 'ORDER_REQUEST' ? 'No payment is taken on this site.' : 'Secure payment · goes directly to Step N Rock.'}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
