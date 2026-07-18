'use client';

import Link from 'next/link';
import { CreditCard, Smartphone, Building2, Shield, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import PageHero from '@/components/PageHero';
import Button from '@/components/ui/Button';

const cartItems = [
  { id: '1', name: 'Business Launch Pack', price: 4999, quantity: 1 },
  { id: '2', name: 'SEO Services', price: 2999, quantity: 1 },
  { id: '3', name: 'Logo Design', price: 1499, quantity: 1 },
];

const paymentMethods = [
  { id: 'upi', label: 'UPI', icon: Smartphone, desc: 'GPay, PhonePe, Paytm' },
  { id: 'card', label: 'Credit/Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, RuPay' },
  { id: 'netbanking', label: 'Net Banking', icon: Building2, desc: 'All major banks' },
];

export default function CheckoutPage() {
  const [selectedPayment, setSelectedPayment] = useState('upi');
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  return (
    <>
      <PageHero
        eyebrow="Checkout"
        title="Complete Your Purchase"
        description="Enter your details and choose a payment method to launch your business online."
        breadcrumbs={[{ label: 'Cart', href: '/cart' }, { label: 'Checkout' }]}
      />

      <section className="pb-16">
        <div className="container-mx container-px">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="card-base p-6">
                <h3 className="mb-4 text-base font-bold text-slate-900">Business Details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Business Name</label>
                    <input type="text" placeholder="Your Business Name" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Industry</label>
                    <select className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                      <option>Select Industry</option>
                      <option>Restaurant & Food</option>
                      <option>Travel & Tours</option>
                      <option>Real Estate</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone Number</label>
                    <input type="tel" placeholder="+91 98765 43210" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Preferred Domain</label>
                    <input type="text" placeholder="yourbusiness.in" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                </div>
              </div>

              <div className="card-base p-6">
                <h3 className="mb-4 text-base font-bold text-slate-900">Payment Method</h3>
                <div className="space-y-3">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    const isSelected = selectedPayment === method.id;
                    return (
                      <button
                        key={method.id}
                        onClick={() => setSelectedPayment(method.id)}
                        className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${isSelected ? 'border-primary-500 bg-primary-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isSelected ? 'bg-primary-100' : 'bg-slate-100'}`}><Icon className={`h-5 w-5 ${isSelected ? 'text-primary-600' : 'text-slate-500'}`} /></div>
                        <div className="flex-1"><p className="text-sm font-semibold text-slate-900">{method.label}</p><p className="text-xs text-slate-500">{method.desc}</p></div>
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${isSelected ? 'border-primary-500 bg-primary-500' : 'border-slate-300'}`}>{isSelected && <Check className="h-3 w-3 text-white" />}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="card-base p-6 sticky top-24">
                <h3 className="mb-4 text-base font-bold text-slate-900">Order Summary</h3>
                <div className="space-y-3 mb-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm"><span className="text-slate-600">{item.name}</span><span className="font-medium text-slate-900">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span></div>
                  ))}
                </div>
                <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
                  <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-slate-600"><span>GST (18%)</span><span>₹{gst.toLocaleString('en-IN')}</span></div>
                  <div className="border-t border-slate-100 pt-2 flex justify-between"><span className="font-bold text-slate-900">Total</span><span className="text-lg font-bold text-primary-600">₹{total.toLocaleString('en-IN')}</span></div>
                </div>
                <Link href="/order-success" className="block mt-6"><Button size="lg" fullWidth rightIcon={<ArrowRight className="h-4 w-4" />}>Pay ₹{total.toLocaleString('en-IN')}</Button></Link>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500"><Shield className="h-3.5 w-3.5" />Secure SSL encrypted payment</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
