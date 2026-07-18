'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Shield, CheckCircle2, Clock, ArrowRight,
  Loader2, Info
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface Invoice {
  id: string;
  invoiceNumber: string;
  description: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  dueDate: string | null;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
}

interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; email: string };
  handler: (response: RazorpayCheckoutResponse) => void;
  modal: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const formatCurrency = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const formatDate = (date: string | null): string =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });
}

export default function BillingPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paidInvoice, setPaidInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api.getVendorInvoices(user.id)
      .then((res) => setInvoices(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load invoices'))
      .finally(() => setLoading(false));
  }, [user]);

  const pendingInvoice = invoices.find((i) => i.status === 'PENDING') ?? null;
  const activeInvoice = invoices.find((i) => i.status === 'PAID') ?? null;

  async function handlePay() {
    if (!pendingInvoice || !user) return;
    setError('');
    setPaying(true);

    try {
      await loadRazorpayScript();

      const orderRes = await api.createOrder({
        amount: pendingInvoice.totalAmount,
        currency: 'INR',
        receipt: pendingInvoice.invoiceNumber,
      });
      const order = orderRes.data;

      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        throw new Error('Payments are not configured yet — missing NEXT_PUBLIC_RAZORPAY_KEY_ID');
      }

      const rzp = new window.Razorpay({
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: 'Get4Domain',
        description: pendingInvoice.description,
        prefill: { name: user.name, email: user.email },
        handler: async (response: RazorpayCheckoutResponse) => {
          try {
            await api.verifyPayment({
              invoiceId: pendingInvoice.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setPaidInvoice(pendingInvoice);
            setPaid(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment verification failed');
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });

      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment');
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (paid && paidInvoice) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success-100">
          <CheckCircle2 className="h-10 w-10 text-success-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Payment Successful!</h2>
        <p className="mt-2 text-sm text-slate-500">Your subscription is now active. Invoice sent to your email.</p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Invoice</span>
            <span className="font-semibold text-slate-900">{paidInvoice.invoiceNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Amount Paid</span>
            <span className="font-bold text-success-700">{formatCurrency(paidInvoice.totalAmount)}</span>
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

      {error && (
        <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>
      )}

      {activeInvoice && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4">Active Subscriptions</h3>
          <div className="flex items-center justify-between rounded-xl bg-success-50 border border-success-100 p-4">
            <div>
              <div className="text-sm font-bold text-slate-900">{user?.plan ?? 'Current Plan'}</div>
              <div className="text-xs text-slate-500 mt-0.5">Active</div>
            </div>
            <span className="text-xs text-success-700 font-semibold">Paid ✓</span>
          </div>
        </div>
      )}

      {pendingInvoice ? (
        <div className="rounded-2xl border-2 border-warning-300 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-5 w-5 text-warning-600" />
            <h3 className="text-base font-bold text-slate-900">Payment Pending</h3>
            <span className="ml-auto rounded-full bg-warning-100 px-2.5 py-1 text-xs font-semibold text-warning-800">Due {formatDate(pendingInvoice.dueDate)}</span>
          </div>

          <div className="mb-5 rounded-xl bg-slate-50 p-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Invoice</span>
              <span className="font-semibold text-slate-900">{pendingInvoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Description</span>
              <span className="font-medium text-slate-900">{pendingInvoice.description}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-900">{formatCurrency(pendingInvoice.amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">GST (18%)</span>
              <span className="text-slate-900">{formatCurrency(pendingInvoice.gstAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2">
              <span>Total</span>
              <span className="text-lg">{formatCurrency(pendingInvoice.totalAmount)}</span>
            </div>
          </div>

          <Button size="lg" fullWidth loading={paying} onClick={handlePay} leftIcon={<Shield className="h-5 w-5" />}>
            Pay {formatCurrency(pendingInvoice.totalAmount)} via Razorpay
          </Button>

          <div className="mt-3 flex items-center justify-center gap-5 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" />256-bit SSL</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Razorpay Secured</span>
            <span className="flex items-center gap-1"><Info className="h-3.5 w-3.5" />GST Invoice included</span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-success-500 mx-auto mb-3" />
          <p className="text-sm text-slate-600">No pending payments right now.</p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
        Want to add more products or need a custom plan?{' '}
        <Link href="/dashboard/support" className="font-semibold text-primary-600 hover:underline">Contact our team →</Link>
      </div>
    </div>
  );
}
