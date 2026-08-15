'use client';

import { useState } from 'react';
import { Rocket, Check, ShieldCheck, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { setSession } from '@/lib/auth';

interface RazorpayResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
interface RazorpayOptions {
  key: string; amount: number; currency: string; order_id: string; name: string; description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  handler: (r: RazorpayResponse) => void; modal?: { ondismiss?: () => void };
}
type RazorpayCtor = new (o: RazorpayOptions) => { open: () => void };
const getRazorpay = (): RazorpayCtor | undefined =>
  (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (getRazorpay()) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(s);
  });
}

const INCLUDED = [
  'Your industry website + customer portal', 'Bookings, contacts, catalog & GST invoicing',
  'TeleCRM, Campaigns & AI Studio', 'WhatsApp / SMS / Email (wallet)', '₹999 Pro AI Studio credit included',
];

export default function GoLivePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({
    businessName: user?.businessName?.replace(/ Demo$/, '') ?? '',
    email: '', password: '', name: user?.name ?? '', phone: '',
  });
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const valid = form.businessName.trim() && /.+@.+\..+/.test(form.email) && form.password.length >= 6;

  const goLive = async () => {
    if (!valid) { setError('Fill business name, a valid email and a password (6+ chars).'); return; }
    setError(''); setPaying(true);
    try {
      await loadRazorpay();
      const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!key) throw new Error('Payments are not configured yet — missing NEXT_PUBLIC_RAZORPAY_KEY_ID');
      const orderRes = await api.demoBuyOrder();
      const order = orderRes.data;
      const Razorpay = getRazorpay();
      if (!Razorpay) throw new Error('Razorpay checkout unavailable');
      const rzp = new Razorpay({
        key, amount: order.amount, currency: order.currency, order_id: order.orderId,
        name: 'Get4Domain', description: 'DomainApp — Monthly (₹999/month)',
        prefill: { name: form.name, email: form.email, contact: form.phone },
        handler: async (r: RazorpayResponse) => {
          try {
            const res = await api.demoBuyConfirm({
              businessName: form.businessName, email: form.email, password: form.password,
              name: form.name, phone: form.phone,
              razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature,
            });
            const token = res.data?.token as string | undefined;
            if (token) {
              localStorage.setItem('g4d_token', token);
              setSession({
                id: res.data?.vendorId ?? user?.id ?? '', name: form.name || 'Owner', email: form.email,
                role: 'vendor', businessName: form.businessName, industry: user?.industry,
                plan: 'DomainApp Monthly', initials: (form.name || 'O').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2),
              });
              refresh();
            }
            setDone(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Payment succeeded but activation failed — contact support.');
          } finally {
            setPaying(false);
          }
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
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-success-100"><Check className="h-10 w-10 text-success-600" /></div>
        <h1 className="text-2xl font-bold text-slate-900">You&apos;re live! 🎉</h1>
        <p className="mt-3 text-slate-600">Your account is now a full DomainApp subscription. Your GST invoice has been emailed, and your ₹999 AI Studio credit is added.</p>
        <a href="/dashboard"><Button className="mt-6" leftIcon={<Rocket className="h-4 w-4" />}>Go to my dashboard</Button></a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Rocket className="h-6 w-6 text-primary-600" /> Go live</h1>
        <p className="mt-1 text-sm text-slate-500">Turn your demo into a real account — everything included for <strong>₹999/month</strong>.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-3 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-900">Your business details</h2>
          <p className="text-xs text-slate-500">We&apos;ll use these for your account and GST invoice.</p>
          <div className="mt-4 space-y-3">
            <input placeholder="Business name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              <input type="tel" placeholder="Mobile" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            </div>
            <input type="email" placeholder="Email (your login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <input type="password" placeholder="Create a password (6+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          {error && <div className="mt-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}
          <Button className="mt-5" size="lg" fullWidth loading={paying} disabled={!valid || paying} onClick={goLive} leftIcon={<ShieldCheck className="h-5 w-5" />}>
            Pay ₹999 &amp; Go Live
          </Button>
          <p className="mt-2 text-center text-xs text-slate-400">Secure payment via Razorpay. Your demo data carries over.</p>
        </div>

        <div className="md:col-span-2 rounded-2xl border border-primary-100 bg-primary-50/50 p-6">
          <div className="text-3xl font-bold text-slate-900">₹999<span className="text-base font-medium text-slate-500">/month</span></div>
          <div className="mt-4 space-y-2.5">
            {INCLUDED.map((f) => (
              <div key={f} className="flex items-start gap-2 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-600" />{f}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
