'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/products';
import { useSiteData } from '@/lib/use-site';
import { STEPNROCK_SUBDOMAIN } from '@/lib/site-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Minus, Plus, Trash2, ShoppingBag, ShieldCheck, Truck, ArrowRight, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

const FREE_SHIPPING_THRESHOLD = 999;
const SHIPPING_COST = 49;
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

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

export function CartView() {
  const { items, updateQuantity, removeFromCart, clearCart, total, count } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const { site } = useSiteData();

  const shipping = total >= FREE_SHIPPING_THRESHOLD || total === 0 ? 0 : SHIPPING_COST;
  const discount = couponApplied ? total * 0.1 : 0;
  const grandTotal = total + shipping - discount;

  const handleApplyCoupon = () => {
    if (couponCode.toUpperCase() === 'STEP10') {
      setCouponApplied(true);
      toast.success('Coupon applied! 10% off your order.');
    } else {
      toast.error('Invalid coupon code. Try STEP10.');
    }
  };

  // Checkout — wired to the real, already-existing engine.checkout.order/.confirm
  // endpoints (the same contract every live get4domain vendor site's cart uses):
  // create the order with the VENDOR's own Razorpay keys, open Razorpay, confirm on
  // success. Money goes straight to Step N Rock; nothing here is mocked. Payments
  // only actually run once Suresh turns on Razorpay in his dashboard — until then
  // this shows that plainly rather than pretending to charge a card.
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [orderDone, setOrderDone] = useState(false);

  const handleCheckout = () => setCheckoutOpen(true);

  const pay = async () => {
    const phone = form.phone.replace(/\D/g, '').slice(-10);
    if (!form.name.trim() || phone.length !== 10) {
      setPayError('Enter your name and a 10-digit mobile number.');
      return;
    }
    setPayError('');
    setPaying(true);
    try {
      const lineItems = items.map((l) => ({ name: `${l.name} — ${l.size} / ${l.color}`, price: l.price, qty: l.quantity }));
      const orderRes = await fetch(`${API_BASE}/engine/public/${STEPNROCK_SUBDOMAIN}/actions/engine.checkout.order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lineItems, name: form.name, phone, email: form.email || undefined }),
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderJson?.message || 'Could not start checkout.');
      const order = (orderJson.data ?? orderJson) as { razorpayOrderId: string; keyId: string; amount: number; currency: string };
      const ok = await loadRazorpay();
      const Rzp = (window as unknown as { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay;
      if (!ok || !Rzp) throw new Error('Could not load the payment window. Please try again.');
      const rzp = new Rzp({
        key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.razorpayOrderId,
        name: 'Step N Rock', description: `Order · ${items.length} item(s)`,
        prefill: { name: form.name, email: form.email, contact: phone },
        handler: async (r: RzpResponse) => {
          try {
            const confirmRes = await fetch(`${API_BASE}/engine/public/${STEPNROCK_SUBDOMAIN}/actions/engine.checkout.confirm`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: lineItems, name: form.name, phone, email: form.email || undefined,
                razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature,
              }),
            });
            if (!confirmRes.ok) { const j = await confirmRes.json().catch(() => ({})); throw new Error(j?.message || 'Order recording failed'); }
            setOrderDone(true);
            clearCart();
          } catch (e) {
            setPayError(e instanceof Error ? e.message : 'Payment captured but order recording failed — keep your payment id and contact us.');
          } finally { setPaying(false); }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Could not start checkout.');
      setPaying(false);
    }
  };

  if (items.length === 0) {
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

  return (
    <>
      <Toaster position="top-center" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-4">
          <Link href="/" className="hover:text-primary">Home</Link> / <span className="text-foreground font-medium">Cart</span>
        </nav>

        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Your cart</h1>
        <p className="text-muted-foreground mb-8">Review your items and proceed to checkout when you&apos;re ready.</p>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Free shipping bar */}
            <div className="p-4 rounded-xl bg-accent/50 border border-border">
              <div className="flex items-center gap-2 text-sm mb-2">
                <Truck className="h-4 w-4 text-primary" />
                {total >= FREE_SHIPPING_THRESHOLD ? (
                  <span className="font-medium text-emerald-600">You qualify for FREE shipping!</span>
                ) : (
                  <span>Add {formatPrice(FREE_SHIPPING_THRESHOLD - total)} more for FREE shipping</span>
                )}
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(100, (total / FREE_SHIPPING_THRESHOLD) * 100)}%` }}
                />
              </div>
            </div>

            {items.map((item) => (
              <div key={item.id} className="flex gap-4 p-4 rounded-2xl border border-border hover:shadow-md transition-shadow">
                <Link href={`/product/${item.slug}`} className="shrink-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-24 w-24 sm:h-28 sm:w-28 rounded-xl object-cover border border-border"
                  />
                </Link>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <Link href={`/product/${item.slug}`}>
                      <h3 className="font-semibold text-sm sm:text-base hover:text-primary transition-colors line-clamp-1">{item.name}</h3>
                    </Link>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      {item.color} / Size {item.size}
                    </p>
                    <p className="text-sm font-semibold mt-1">{formatPrice(item.price)}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 border border-border rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center hover:bg-accent rounded-l-lg transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center hover:bg-accent rounded-r-lg transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm sm:text-base">{formatPrice(item.price * item.quantity)}</span>
                      <button
                        onClick={() => { removeFromCart(item.id); toast('Item removed'); }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-between items-center pt-2">
              <Button asChild variant="ghost"><Link href="/shop">Continue shopping</Link></Button>
              <Button variant="ghost" onClick={() => { clearCart(); toast('Cart cleared'); }} className="text-muted-foreground hover:text-destructive">
                Clear cart
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              <div className="p-6 rounded-2xl border border-border bg-background">
                <h2 className="font-display text-lg font-bold mb-4">Order summary</h2>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal ({count} items)</span>
                    <span className="font-medium">{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium">{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount (STEP10)</span>
                      <span className="font-medium">-{formatPrice(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Estimated tax</span>
                    <span>Calculated at checkout</span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span>{formatPrice(grandTotal)}</span>
                  </div>
                </div>

                {/* Coupon */}
                <div className="mt-4 flex gap-2">
                  <Input
                    type="text"
                    placeholder="Coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={handleApplyCoupon} className="shrink-0">Apply</Button>
                </div>
                {couponApplied && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1 mt-2">
                    <Check className="h-3 w-3" /> Coupon STEP10 applied — 10% off!
                  </p>
                )}

                <Button onClick={handleCheckout} size="lg" className="w-full mt-4">
                  Proceed to checkout <ArrowRight className="h-4 w-4 ml-1" />
                </Button>

                <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Secure payment · 256-bit SSL encryption
                </div>

                <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
                  UPI · Cards · Net banking · Wallets
                </div>
              </div>

              {/* Trust badges */}
              <div className="p-4 rounded-2xl bg-secondary/30 space-y-2">
                {[
                  { icon: Truck, text: 'Free shipping over ₹999' },
                  { icon: ShieldCheck, text: 'Secure payment' },
                  { icon: Check, text: '30-day easy returns' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="h-4 w-4 text-primary" /> {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={(o) => { setCheckoutOpen(o); if (!o) { setPayError(''); setOrderDone(false); } }}>
        <DialogContent>
          {orderDone ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="font-display text-xl font-bold">Order placed 🎉</h3>
              <p className="mt-2 text-sm text-muted-foreground">Thanks, {form.name.split(' ')[0]}! Step N Rock has your order and will be in touch.</p>
              <Button onClick={() => setCheckoutOpen(false)} className="mt-5">Done</Button>
            </div>
          ) : !site?.paymentsEnabled ? (
            <>
              <DialogHeader>
                <DialogTitle>Checkout isn&apos;t live yet</DialogTitle>
                <DialogDescription>
                  Step N Rock is still setting up online payments. Your cart is saved — call or WhatsApp{' '}
                  <a href="tel:+919360011107" className="text-primary hover:underline">+91 93600 11107</a> and we&apos;ll take your order directly.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2.5 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" /> Checkout activates automatically the moment Razorpay is turned on in the dashboard.
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Complete your order</DialogTitle>
                <DialogDescription>{formatPrice(grandTotal)} · {count} item{count !== 1 ? 's' : ''}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="10-digit mobile" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Input placeholder="Email (optional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              {payError && <p className="text-sm text-destructive">{payError}</p>}
              <Button onClick={pay} disabled={paying} size="lg" className="w-full">
                <ShieldCheck className="h-4 w-4 mr-1" /> {paying ? 'Processing…' : `Pay ${formatPrice(grandTotal)}`}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Secure payment · goes directly to Step N Rock.</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
