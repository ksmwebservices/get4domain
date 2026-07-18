'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard, Shield, CheckCircle2, Clock, ArrowRight,
  Smartphone, Building2, Info
} from 'lucide-react';
import Button from '@/components/ui/Button';

const pendingInvoice = {
  id: 'INV-002',
  description: 'DomainCampaign Business — 1 Year',
  amount: 29999,
  gst: 5400,
  total: 35399,
  dueDate: '25 Jan 2026',
};

const paymentMethods = [
  { id: 'upi', label: 'UPI', icon: Smartphone, desc: 'GPay, PhonePe, Paytm, BHIM' },
  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, RuPay' },
  { id: 'netbanking', label: 'Net Banking', icon: Building2, desc: 'All major banks' },
];

export default function BillingPage() {
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const handlePay = () => {
    setPaying(true);
    // Phase 2: Razorpay SDK — window.Razorpay({ key, amount, ... }).open()
    setTimeout(() => { setPaying(false); setPaid(true); }, 2000);
  };

  if (paid) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success-100">
          <CheckCircle2 className="h-10 w-10 text-success-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Payment Successful!</h2>
        <p className="mt-2 text-sm text-slate-500">Your DomainCampaign Business subscription is now active. Invoice sent to your email.</p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Invoice</span>
            <span className="font-semibold text-slate-900">{pendingInvoice.id}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Amount Paid</span>
            <span className="font-bold text-success-700">₹{pendingInvoice.total.toLocaleString('en-IN')}</span>
          </div>
        </div>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/dashboard/invoices"><Button variant="outline" size="sm">View Invoice</Button></Link>
          <Link href="/dashboard"><Button size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>Dashboard</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Billing & Payments</h2>
        <p className="mt-1 text-sm text-slate-500">Manage subscriptions and make payments securely via Razorpay.</p>
      </div>

      {/* Active subscriptions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Active Subscriptions</h3>
        <div className="flex items-center justify-between rounded-xl bg-success-50 border border-success-100 p-4">
          <div>
            <div className="text-sm font-bold text-slate-900">DomainApp Enterprise</div>
            <div className="text-xs text-slate-500 mt-0.5">Active · Renews 15 Jan 2027</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-slate-900">₹24,999/yr</div>
            <span className="text-xs text-success-700 font-semibold">Paid ✓</span>
          </div>
        </div>
      </div>

      {/* Pending invoice */}
      <div className="rounded-2xl border-2 border-warning-300 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="h-5 w-5 text-warning-600" />
          <h3 className="text-base font-bold text-slate-900">Payment Pending</h3>
          <span className="ml-auto rounded-full bg-warning-100 px-2.5 py-1 text-xs font-semibold text-warning-800">Due {pendingInvoice.dueDate}</span>
        </div>

        <div className="mb-5 rounded-xl bg-slate-50 p-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Invoice</span>
            <span className="font-semibold text-slate-900">{pendingInvoice.id}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Description</span>
            <span className="font-medium text-slate-900">{pendingInvoice.description}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-900">₹{pendingInvoice.amount.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">GST (18%)</span>
            <span className="text-slate-900">₹{pendingInvoice.gst.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2">
            <span>Total</span>
            <span className="text-lg">₹{pendingInvoice.total.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Payment Method</p>
          <div className="space-y-2">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id)}
                  className={`flex w-full items-center gap-4 rounded-xl border-2 p-3.5 text-left transition-all ${isSelected ? 'border-primary-500 bg-primary-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isSelected ? 'bg-primary-100' : 'bg-slate-100'}`}>
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-primary-600' : 'text-slate-500'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900">{method.label}</div>
                    <div className="text-xs text-slate-500">{method.desc}</div>
                  </div>
                  {isSelected && (
                    <div className="h-4 w-4 rounded-full border-2 border-primary-600 flex items-center justify-center flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-primary-600" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <Button size="lg" fullWidth loading={paying} onClick={handlePay} leftIcon={<Shield className="h-5 w-5" />}>
          Pay ₹{pendingInvoice.total.toLocaleString('en-IN')} via Razorpay
        </Button>

        <div className="mt-3 flex items-center justify-center gap-5 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" />256-bit SSL</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Razorpay Secured</span>
          <span className="flex items-center gap-1"><Info className="h-3.5 w-3.5" />GST Invoice included</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
        Want to add more products or need a custom plan?{' '}
        <Link href="/dashboard/support" className="font-semibold text-primary-600 hover:underline">Contact our team →</Link>
      </div>
    </div>
  );
}
