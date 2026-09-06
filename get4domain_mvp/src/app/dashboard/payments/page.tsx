'use client';

import { useEffect, useState } from 'react';
import { CreditCard, ShieldCheck, Check, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { api } from '@/lib/api';

interface PaymentCfg { razorpayKeyId: string | null; enabled: boolean; hasSecret: boolean }

/**
 * Vendor connects their OWN Razorpay account. Public-site payments (product orders,
 * booking fees, etc.) go DIRECTLY into this account — Get4Domain never holds the funds.
 * The key secret is write-only: it's stored encrypted and never sent back, so the field
 * shows a "saved" state instead of the value.
 */
export default function PaymentsSettingsPage() {
  const [cfg, setCfg] = useState<PaymentCfg | null>(null);
  const [keyId, setKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getVendorPayment()
      .then((r) => {
        const c = (r.data ?? r) as PaymentCfg;
        setCfg(c);
        setKeyId(c.razorpayKeyId ?? '');
        setEnabled(c.enabled);
      })
      .catch(() => setError('Could not load your payment settings.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setError(''); setSaved(false); setSaving(true);
    try {
      const payload: { razorpayKeyId?: string; razorpayKeySecret?: string; enabled?: boolean } = {
        razorpayKeyId: keyId.trim(),
        enabled,
      };
      if (secret.trim()) payload.razorpayKeySecret = secret.trim();
      const r = await api.updateVendorPayment(payload);
      const c = (r.data ?? r) as PaymentCfg;
      setCfg(c);
      setSecret('');
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const ready = enabled && keyId.trim() && (cfg?.hasSecret || secret.trim());

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-2">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><CreditCard className="h-6 w-6 text-primary-600" /> Payments</h1>
        <p className="mt-1 text-sm text-slate-500">Connect your own Razorpay account. Payments customers make on your website go <strong>directly to you</strong> — Get4Domain never holds your money.</p>
      </div>

      <Card padded>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><ShieldCheck className="h-4 w-4 text-success-600" /> Accept payments on my website</div>
          <button type="button" onClick={() => setEnabled((v) => !v)} className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-success-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'left-0.5 translate-x-5' : 'left-0.5'}`} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Razorpay Key ID</label>
            <input value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="rzp_live_xxxxxxxxxxxx" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Razorpay Key Secret</label>
            <input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" placeholder={cfg?.hasSecret ? '•••••••• (saved — leave blank to keep)' : 'Enter your key secret'} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <p className="mt-1 text-xs text-slate-400">Stored encrypted and never shown again. {cfg?.hasSecret && <span className="text-success-600">A secret is saved.</span>}</p>
          </div>
        </div>

        {error && <div className="mt-4 flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-sm text-error-700"><AlertCircle className="h-4 w-4" />{error}</div>}

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={save} loading={saving} disabled={saving} leftIcon={<Check className="h-4 w-4" />}>Save</Button>
          {saved && <span className="inline-flex items-center gap-1 text-sm font-medium text-success-600"><Check className="h-4 w-4" /> Saved</span>}
          <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">Get my keys <ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
      </Card>

      <div className={`rounded-xl border px-4 py-3 text-sm ${ready ? 'border-success-200 bg-success-50 text-success-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
        {ready
          ? <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> Payments are on — customers can pay on your website (once your site has a Buy / Pay option).</span>
          : <span className="inline-flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Add your Razorpay key ID + secret and turn on payments to accept money on your website.</span>}
      </div>
    </div>
  );
}
