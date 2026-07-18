'use client';

import { useEffect, useState } from 'react';
import {
  Check, CreditCard, MessageCircle, Search, Share2, MapPin, Wrench, PenTool, Palette, Image as ImageIcon, Loader2, Send
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const PLANS = {
  domainapp: {
    label: 'DomainApp',
    plans: {
      startup: { halfYear: 3999, yearly: 6999, label: 'Startup' },
      enterprise: { halfYear: 13999, yearly: 24999, label: 'Enterprise' },
    },
  },
  domaincampaign: {
    label: 'DomainCampaign',
    plans: {
      starter: { halfYear: 3999, yearly: 6999, label: 'Starter' },
      business: { halfYear: 16999, yearly: 29999, label: 'Business' },
    },
  },
};

const ADDONS = [
  { id: 'whatsapp', name: 'WhatsApp Campaign', price: 1999, period: 'per month', icon: MessageCircle },
  { id: 'seo', name: 'SEO Services', price: 2999, period: 'per month', icon: Search },
  { id: 'social', name: 'Social Media Posting', price: 3999, period: 'per month', icon: Share2 },
  { id: 'gbp', name: 'Google Business Profile', price: 1499, period: 'one-time', icon: MapPin },
  { id: 'maintenance', name: 'Website Maintenance', price: 999, period: 'per month', icon: Wrench },
  { id: 'content', name: 'Content Writing', price: 1999, period: 'per page', icon: PenTool },
  { id: 'logo', name: 'Logo Design', price: 1499, period: 'one-time', icon: Palette },
  { id: 'posters', name: 'Extra Poster Designs', price: 2499, period: 'per 10', icon: ImageIcon },
];

interface Invoice {
  id: string;
  description: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  createdAt: string;
}

const formatCurrency = (rupees: number): string => `₹${rupees.toLocaleString('en-IN')}`;

type SelectedItem = { kind: 'plan'; product: string; plan: string; label: string; amount: number; duration: string } | { kind: 'addon'; label: string; amount: number; duration: string };

export default function MyServicesPage() {
  const { user } = useAuth();
  const [duration, setDuration] = useState<'halfYear' | 'yearly'>('yearly');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api.getVendorInvoices(user.id)
      .then((res) => setInvoices(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const activeSubscriptions = invoices.filter((i) => i.status === 'PAID');

  async function confirmRequest() {
    if (!selected) return;
    setRequesting(true);
    setError('');
    try {
      const gst = Math.round(selected.amount * 0.18);
      await api.createTicket({
        category: 'Plan Upgrade',
        subject: `Request: ${selected.label}`,
        message: `Please activate ${selected.label} (${selected.duration}) for my account. Amount: ${formatCurrency(selected.amount)} + GST ${formatCurrency(gst)} = ${formatCurrency(selected.amount + gst)}. We'll send a payment link once confirmed.`,
      });
      setRequestedIds((prev) => [...prev, selected.label]);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">My Plans & Services</h2>
        <p className="mt-1 text-sm text-slate-500">Browse plans and add-ons. Requests are reviewed by our team and a payment link is sent to activate.</p>
      </div>

      {/* Active subscriptions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Active Subscriptions</h3>
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : activeSubscriptions.length === 0 ? (
          <p className="text-sm text-slate-400">No paid subscriptions yet.</p>
        ) : (
          <div className="space-y-2">
            {activeSubscriptions.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-xl bg-success-50 border border-success-100 p-3">
                <div className="text-sm font-medium text-slate-900">{inv.description}</div>
                <span className="text-xs font-semibold text-success-700">Active</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Duration toggle */}
      <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 p-1 w-fit mx-auto">
        {(['halfYear', 'yearly'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDuration(d)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${duration === d ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}
          >
            {d === 'halfYear' ? '6 Months' : 'Yearly (Save more)'}
          </button>
        ))}
      </div>

      {/* Plans grid */}
      {Object.entries(PLANS).map(([productKey, product]) => (
        <div key={productKey}>
          <h3 className="text-base font-bold text-slate-900 mb-3">{product.label}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(product.plans).map(([planKey, plan]) => {
              const amount = plan[duration];
              const label = `${product.label} ${plan.label}`;
              const alreadyRequested = requestedIds.includes(label);
              return (
                <div key={planKey} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-slate-900">{plan.label}</span>
                    <span className="text-lg font-bold text-primary-600">{formatCurrency(amount)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{duration === 'halfYear' ? '6 months' : '1 year'}</p>
                  <Button
                    size="sm"
                    fullWidth
                    variant={alreadyRequested ? 'outline' : 'primary'}
                    disabled={alreadyRequested}
                    onClick={() => setSelected({ kind: 'plan', product: productKey, plan: planKey, label, amount, duration: duration === 'halfYear' ? '6 months' : '1 year' })}
                  >
                    {alreadyRequested ? 'Request Sent' : 'Request This Plan'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Add-ons */}
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-3">Add-on Services</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ADDONS.map((addon) => {
            const Icon = addon.icon;
            const alreadyRequested = requestedIds.includes(addon.name);
            return (
              <div key={addon.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50">
                  <Icon className="h-4 w-4 text-primary-600" />
                </div>
                <div className="text-sm font-semibold text-slate-900">{addon.name}</div>
                <div className="text-xs text-slate-500 mb-3">{formatCurrency(addon.price)} {addon.period}</div>
                <Button
                  size="sm"
                  fullWidth
                  variant={alreadyRequested ? 'outline' : 'ghost'}
                  disabled={alreadyRequested}
                  onClick={() => setSelected({ kind: 'addon', label: addon.name, amount: addon.price, duration: addon.period })}
                >
                  {alreadyRequested ? 'Requested' : 'Add This'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Confirm Request" maxWidth="max-w-md">
        {selected && (
          <div className="space-y-4">
            {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}
            <div className="rounded-xl bg-slate-50 p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Item</span><span className="font-medium text-slate-900">{selected.label}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Duration</span><span className="text-slate-900">{selected.duration}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Amount</span><span className="text-slate-900">{formatCurrency(selected.amount)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">GST (18%)</span><span className="text-slate-900">{formatCurrency(Math.round(selected.amount * 0.18))}</span></div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2"><span>Total</span><span>{formatCurrency(selected.amount + Math.round(selected.amount * 0.18))}</span></div>
            </div>
            <p className="text-xs text-slate-500">We'll review your request and send a Razorpay payment link to activate — usually within a few hours.</p>
            <Button fullWidth loading={requesting} onClick={confirmRequest} leftIcon={<Send className="h-4 w-4" />}>
              Send Request
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
