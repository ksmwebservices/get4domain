'use client';

import { useState } from 'react';
import { Loader2, Phone, MessageCircle, Check } from 'lucide-react';
import { api } from '@/lib/api';

interface Props { business: string; industryLabel: string }

/**
 * Enquiry form + WhatsApp CTA for the demo sites. Submitting sends an outbound
 * WhatsApp confirmation via Fast2SMS (the closest "automated first response" our
 * providers allow — true inbound auto-reply needs a WhatsApp Business API/BSP; see
 * the inbound-capture investigation). The WhatsApp button opens wa.me with an
 * industry-aware prefilled message.
 */
export default function DemoContactSection({ business, industryLabel }: Props) {
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const waText = encodeURIComponent(`Hi ${business}, I saw your ${industryLabel.toLowerCase()} website and I'm interested. Could you share more details?`);

  const submit = async () => {
    setErr(''); setSending(true);
    try {
      await api.demoEnquiry({ name: form.name, phone: form.phone, industry: industryLabel, message: form.message || undefined });
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send — please try again.');
    } finally { setSending(false); }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-5 flex justify-center">
        <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-success-500 px-5 py-3 text-sm font-bold text-white hover:bg-success-600">
          <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
        </a>
      </div>
      {sent ? (
        <div className="rounded-2xl border border-success-200 bg-success-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-100"><Check className="h-6 w-6 text-success-600" /></div>
          <p className="font-semibold text-slate-900">Thanks, {form.name.split(' ')[0] || 'there'}!</p>
          <p className="mt-1 text-sm text-slate-600">We&apos;ve received your enquiry and sent a confirmation to your WhatsApp.</p>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-200 p-6">
          <input type="text" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          <input type="tel" inputMode="numeric" placeholder="Mobile number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          <textarea rows={3} placeholder="What are you looking for? (optional)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          {err && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700">{err}</div>}
          <button onClick={submit} disabled={sending || !form.name.trim() || form.phone.replace(/\D/g, '').length < 10}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Send Enquiry
          </button>
        </div>
      )}
    </div>
  );
}
