'use client';

import { useState } from 'react';
import { MessageCircle, Phone, Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';

const categories = [
  'Technical Issue', 'Billing / Payment', 'Website Changes', 'Plan Upgrade',
  'New Module Request', 'Performance Issue', 'Other',
];

export default function SupportPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 1200);
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success-100">
          <CheckCircle2 className="h-10 w-10 text-success-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Ticket Raised!</h2>
        <p className="mt-2 text-sm text-slate-500">Our team will respond within 24 hours on your registered email and WhatsApp.</p>
        <div className="mt-6">
          <Button onClick={() => setSubmitted(false)} variant="outline" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
            Raise Another Ticket
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Support</h2>
        <p className="mt-1 text-sm text-slate-500">We respond within 24 hours. For urgent issues, WhatsApp us directly.</p>
      </div>

      {/* Quick contacts */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: MessageCircle, label: 'WhatsApp', value: '+91 98765 43210', href: 'https://wa.me/919876543210', color: 'text-success-600', bg: 'bg-success-50' },
          { icon: Phone, label: 'Call', value: '+91 98765 43210', href: 'tel:+919876543210', color: 'text-primary-600', bg: 'bg-primary-50' },
          { icon: Mail, label: 'Email', value: 'support@get4domain.in', href: 'mailto:support@get4domain.in', color: 'text-slate-600', bg: 'bg-slate-50' },
        ].map((contact) => {
          const Icon = contact.icon;
          return (
            <a
              key={contact.label}
              href={contact.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-primary-200 hover:shadow-sm transition-all"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${contact.bg}`}>
                <Icon className={`h-4.5 w-4.5 ${contact.color}`} />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">{contact.label}</div>
                <div className="text-sm font-medium text-slate-900 truncate">{contact.value}</div>
              </div>
            </a>
          );
        })}
      </div>

      {/* Ticket form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900 mb-5">Raise a Support Ticket</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Category <span className="text-error-500">*</span></label>
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">Select category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Subject <span className="text-error-500">*</span></label>
            <input
              required
              type="text"
              placeholder="Brief description of your issue"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Details <span className="text-error-500">*</span></label>
            <textarea
              required
              rows={4}
              placeholder="Describe your issue in detail. The more context you give, the faster we can help."
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none"
            />
          </div>
          <Button type="submit" size="lg" fullWidth loading={loading} rightIcon={<ArrowRight className="h-4 w-4" />}>
            Submit Ticket
          </Button>
          <p className="text-xs text-center text-slate-400">We respond within 24 hours on email and WhatsApp.</p>
        </form>
      </div>
    </div>
  );
}
