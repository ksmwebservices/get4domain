'use client';

import { useState } from 'react';
import { Check, Loader2, Send } from 'lucide-react';
import { api } from '@/lib/api';

export const MANAGED_SERVICES_OPTIONS = [
  'Custom Web Application',
  'Mobile Application (iOS/Android)',
  'Full SME Software (CRM/ERP/BOS)',
  'Managed Paid Ads — Meta',
  'Managed Paid Ads — Google',
  'Social Media Management',
  'Content Creation (posts/reels)',
  'Influencer Collaboration',
  'Commercial Ad Production',
];

const field =
  'w-full rounded-xl border border-white/10 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 backdrop-blur-xl focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export default function ManagedServicesForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', business: '', message: '' });
  const [interests, setInterests] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  const toggle = (opt: string) =>
    setInterests((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.phone.replace(/\D/g, '').length < 10 || !form.business.trim()) {
      setError('Please add your name, business name and a 10-digit phone number.');
      return;
    }
    if (interests.length === 0) {
      setError('Select at least one service you\'re interested in.');
      return;
    }
    setError('');
    setState('sending');
    try {
      await api.managedServicesEnquiry({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        business: form.business.trim(),
        interests,
        message: form.message.trim() || undefined,
      });
      setState('done');
    } catch {
      setError('Could not send — please email admin@get4domain.com.');
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-success-400/20 bg-success-500/10 px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-500/20"><Check className="h-6 w-6 text-success-300" /></span>
        <p className="text-lg font-semibold text-white">Thanks — we&apos;ve got it.</p>
        <p className="max-w-sm text-sm text-slate-400">Our team will review your requirements and reach out with a custom quote shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-white/5 bg-slate-800/60 p-6 backdrop-blur-xl sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className={field} />
        <input value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} placeholder="Business name" className={field} />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" type="tel" inputMode="tel" className={field} />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email (optional)" type="email" className={field} />
      </div>

      <div>
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">What are you interested in?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {MANAGED_SERVICES_OPTIONS.map((opt) => {
            const checked = interests.includes(opt);
            return (
              <button
                type="button"
                key={opt}
                onClick={() => toggle(opt)}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${checked ? 'border-primary-400/40 bg-primary-500/10 text-primary-200' : 'border-white/10 bg-slate-900/40 text-slate-300 hover:border-white/20'}`}
              >
                <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${checked ? 'border-primary-400 bg-primary-500' : 'border-slate-500'}`}>
                  {checked && <Check className="h-3 w-3 text-white" />}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <textarea
        rows={4}
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        placeholder="Tell us about what you need — scope, timeline, anything that helps us quote accurately."
        className={`${field} resize-none`}
      />

      {error && <p className="text-xs text-error-400">{error}</p>}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-6 py-3 font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber disabled:opacity-60 sm:w-auto"
      >
        {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Get a Custom Quote
      </button>
    </form>
  );
}
