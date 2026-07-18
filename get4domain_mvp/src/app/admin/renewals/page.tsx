'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mail, MessageCircle, FileText, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';

interface Subscription {
  id: string;
  product: string;
  plan: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  endDate: string | null;
  amount: number;
  vendor: { id: string; name: string; businessName: string; email: string; phone: string | null };
}

const formatCurrency = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN')}`;
const formatDate = (date: string | null): string =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function urgencyOf(endDate: string | null): { label: string; color: string; days: number } | null {
  if (!endDate) return null;
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: 'Expired', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', days };
  if (days <= 1) return { label: 'Due in 1 day', color: 'bg-error-500/20 text-error-400 border-error-500/30', days };
  if (days <= 7) return { label: `Due in ${days} days`, color: 'bg-warning-500/20 text-warning-400 border-warning-500/30', days };
  if (days <= 30) return { label: `Due in ${days} days`, color: 'bg-primary-500/20 text-primary-400 border-primary-500/30', days };
  return null;
}

export default function RenewalsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [invoiced, setInvoiced] = useState<string[]>([]);

  useEffect(() => {
    api.getSubscriptions()
      .then((res) => setSubscriptions(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load subscriptions'))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = subscriptions
    .filter((s) => s.status === 'ACTIVE')
    .map((s) => ({ sub: s, urgency: urgencyOf(s.endDate) }))
    .filter((r) => r.urgency !== null)
    .sort((a, b) => (a.urgency!.days) - (b.urgency!.days));

  async function createRenewalInvoice(sub: Subscription) {
    setCreatingId(sub.id);
    try {
      await api.createInvoice({
        vendorId: sub.vendor.id,
        subscriptionId: sub.id,
        description: `${sub.product.replace('_', ' ')} ${sub.plan} — renewal`,
        amount: sub.amount,
      });
      setInvoiced((prev) => [...prev, sub.id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create renewal invoice');
    } finally {
      setCreatingId(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Renewals</h2>
        <p className="mt-1 text-sm text-slate-400">Subscriptions approaching or past their renewal date.</p>
      </div>

      {error && <div className="rounded-xl border border-error-800 bg-error-950/50 px-4 py-3 text-sm text-error-400">{error}</div>}

      {upcoming.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
          <p className="text-slate-500 text-sm">No renewals due in the next 30 days.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map(({ sub, urgency }) => (
            <div key={sub.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{sub.vendor.businessName}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${urgency!.color}`}>{urgency!.label}</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{sub.product.replace('_', ' ')} {sub.plan} · {formatCurrency(sub.amount)} · expires {formatDate(sub.endDate)}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <a href={`mailto:${sub.vendor.email}?subject=${encodeURIComponent('Your Get4Domain subscription is renewing soon')}&body=${encodeURIComponent(`Hi ${sub.vendor.name}, your ${sub.plan} plan renews on ${formatDate(sub.endDate)}. Reply to this email or contact us to renew.`)}`}>
                  <Button size="sm" variant="outline" leftIcon={<Mail className="h-3.5 w-3.5" />} className="border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white">Email</Button>
                </a>
                {sub.vendor.phone && (
                  <a href={`https://wa.me/${sub.vendor.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${sub.vendor.name}, your Get4Domain ${sub.plan} plan renews on ${formatDate(sub.endDate)}. Let us know if you'd like to renew.`)}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" leftIcon={<MessageCircle className="h-3.5 w-3.5" />} className="border-slate-700 text-slate-300 hover:border-success-500 hover:text-success-400">WhatsApp</Button>
                  </a>
                )}
                {invoiced.includes(sub.id) ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-success-400"><CheckCircle2 className="h-4 w-4" />Invoice created</span>
                ) : (
                  <Button size="sm" loading={creatingId === sub.id} leftIcon={<FileText className="h-3.5 w-3.5" />} onClick={() => createRenewalInvoice(sub)}>
                    Create Renewal Invoice
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
