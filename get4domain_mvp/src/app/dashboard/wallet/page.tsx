'use client';

import { useEffect, useState } from 'react';
import { Wallet, Shield, CheckCircle2, Loader2, Info, Clock } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface WalletTxn {
  id: string;
  type: string;
  amount: number;
  description: string;
  service: string;
  balanceAfter: number;
  expiresAt: string | null;
  createdAt: string;
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

const TOPUP_TIERS = [
  { amount: 99900, credits: 110000, label: '₹999', creditsLabel: '₹1,100' },
  { amount: 249900, credits: 300000, label: '₹2,499', creditsLabel: '₹3,000' },
  { amount: 499900, credits: 650000, label: '₹4,999', creditsLabel: '₹6,500' },
];

const formatCurrency = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });
}

export default function WalletPage() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [nextExpiry, setNextExpiry] = useState<{ amount: number; date: string } | null>(null);
  const [transactions, setTransactions] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingTier, setPayingTier] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<number | null>(null);

  function load() {
    Promise.all([api.getWalletBalance(), api.getWalletTransactions(1, 50)])
      .then(([balRes, txnRes]) => {
        setBalance(balRes.data?.balance ?? 0);
        setNextExpiry(balRes.data?.nextExpiry ?? null);
        setTransactions(txnRes.data?.items ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load wallet'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const now = new Date();
  const usageThisMonth = transactions
    .filter((t) => t.type === 'debit' && new Date(t.createdAt).getMonth() === now.getMonth() && new Date(t.createdAt).getFullYear() === now.getFullYear())
    .reduce((sum, t) => sum + t.amount, 0);

  async function handleTopup(tier: typeof TOPUP_TIERS[number]) {
    if (!user) return;
    setError('');
    setPayingTier(tier.amount);

    try {
      await loadRazorpayScript();
      const orderRes = await api.createWalletTopup(tier.amount);
      const order = orderRes.data;

      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKey) throw new Error('Payments are not configured yet — missing NEXT_PUBLIC_RAZORPAY_KEY_ID');

      const rzp = new window.Razorpay({
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Get4Domain',
        description: 'Wallet Top-up',
        prefill: { name: user.name, email: user.email },
        handler: async (response: RazorpayCheckoutResponse) => {
          try {
            await api.verifyWalletTopup({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setSuccess(order.credits);
            load();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment verification failed');
          } finally {
            setPayingTier(null);
          }
        },
        modal: { ondismiss: () => setPayingTier(null) },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment');
      setPayingTier(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Wallet</h2>
        <p className="mt-1 text-sm text-slate-500">Top up credits to run campaigns, post content and send alerts.</p>
      </div>

      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}
      {success !== null && (
        <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm font-medium text-success-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />{formatCurrency(success)} credits added to your wallet!
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 p-6 text-white">
        <div className="flex items-center gap-2 text-primary-100 text-sm"><Wallet className="h-4 w-4" />Wallet Balance</div>
        <div className="mt-2 text-4xl font-bold">{balance !== null ? formatCurrency(balance) : '—'}</div>
        <div className="mt-3 text-xs text-primary-100">credits</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Used this month</div>
          <div className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(usageThisMonth)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3" />Next expiry</div>
          <div className="mt-1 text-lg font-bold text-slate-900">
            {nextExpiry ? `${formatCurrency(nextExpiry.amount)} · ${formatDate(nextExpiry.date)}` : 'None'}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Top Up Wallet</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {TOPUP_TIERS.map((tier) => (
            <div key={tier.amount} className="rounded-xl border-2 border-slate-200 p-4 text-center hover:border-primary-300 transition-colors">
              <div className="text-lg font-bold text-slate-900">{tier.label}</div>
              <div className="mt-1 text-xs text-success-700 font-semibold">Get {tier.creditsLabel} credits</div>
              <Button size="sm" fullWidth className="mt-3" loading={payingTier === tier.amount} onClick={() => handleTopup(tier)}>
                Pay via Razorpay
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-5 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" />256-bit SSL</span>
          <span className="flex items-center gap-1"><Info className="h-3.5 w-3.5" />Credits expire 90 days after top-up</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Transaction History</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                  <th className="pb-2 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 text-slate-500 whitespace-nowrap">{formatDate(t.createdAt)}</td>
                    <td className="py-2.5 text-slate-700">{t.description}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.type === 'credit' ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-600'}`}>{t.type}</span>
                    </td>
                    <td className={`py-2.5 text-right font-semibold whitespace-nowrap ${t.type === 'credit' ? 'text-success-700' : 'text-slate-700'}`}>
                      {t.type === 'credit' ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                    <td className="py-2.5 text-right text-slate-500 whitespace-nowrap">{formatCurrency(t.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
