import type { Metadata } from 'next';
import Link from 'next/link';
import { Trash2, ShoppingBag, ArrowRight, Plus, Minus } from 'lucide-react';
import PageHero from '@/components/PageHero';
import Button from '@/components/ui/Button';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Cart',
  description: 'Review your selected services before proceeding to checkout.',
  path: '/cart',
});

const cartItems = [
  { id: '1', name: 'Business Launch Pack', description: 'Complete website package with domain, hosting & SSL', price: 4999, quantity: 1 },
  { id: '2', name: 'SEO Services', description: 'On-page & off-page SEO optimization', price: 2999, quantity: 1, duration: 'Monthly' },
  { id: '3', name: 'Logo Design', description: 'Custom logo with multiple concepts', price: 1499, quantity: 1, duration: 'One-time' },
];

export default function CartPage() {
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  return (
    <>
      <PageHero
        eyebrow="Shopping Cart"
        title="Your Cart"
        description="Review your selected services before proceeding to checkout."
        breadcrumbs={[{ label: 'Cart' }]}
      />

      <section className="pb-16">
        <div className="container-mx container-px">
          {cartItems.length > 0 ? (
            <div className="grid gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="card-base p-5 flex items-center gap-4">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50"><ShoppingBag className="h-6 w-6 text-primary-600" /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                      <p className="text-xs text-slate-500">{item.description}</p>
                      {item.duration && (<span className="mt-1 inline-block text-xs text-slate-400">/ {item.duration}</span>)}
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-8 text-center text-sm font-medium text-slate-700">{item.quantity}</span>
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="text-right"><p className="text-sm font-bold text-slate-900">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p></div>
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-error-50 hover:text-error-500 transition-colors" aria-label="Remove item"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-1">
                <div className="card-base p-6 sticky top-24">
                  <h3 className="mb-4 text-base font-bold text-slate-900">Order Summary</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-medium text-slate-900">₹{subtotal.toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between text-slate-600"><span>GST (18%)</span><span className="font-medium text-slate-900">₹{gst.toLocaleString('en-IN')}</span></div>
                    <div className="border-t border-slate-100 pt-3 flex justify-between"><span className="font-bold text-slate-900">Total</span><span className="text-lg font-bold text-primary-600">₹{total.toLocaleString('en-IN')}</span></div>
                  </div>
                  <Link href="/checkout" className="block mt-6"><Button size="lg" fullWidth rightIcon={<ArrowRight className="h-4 w-4" />}>Proceed to Checkout</Button></Link>
                  <Link href="/digital-growth" className="block mt-3"><Button size="md" variant="outline" fullWidth>Add More Services</Button></Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100"><ShoppingBag className="h-8 w-8 text-slate-400" /></div>
              <h3 className="text-lg font-bold text-slate-900">Your cart is empty</h3>
              <p className="mt-2 text-sm text-slate-500">Browse our services and add items to your cart.</p>
              <Link href="/pricing" className="inline-block mt-6"><Button size="lg">Browse Services</Button></Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
