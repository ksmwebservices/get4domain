'use client';

import { useState } from 'react';
import { Mail, MessageCircle, Headphones, MapPin, Clock, PhoneCall, Check, Loader2 } from 'lucide-react';
import { SectionHeading } from './ui/Accordion';
import Button from './ui/Button';
import { api } from '@/lib/api';

// Policy (28-Aug-2026): Get4Domain publishes no inbound phone/WhatsApp. Support is the
// in-app assistant + a callback (we call you) + email. No number to dial or message us.
const contactCards = [
  { icon: MessageCircle, title: 'Chat with us', label: 'Instant answers', value: 'Open the assistant (bottom-right)', color: 'bg-primary-50 text-primary-600' },
  { icon: PhoneCall, title: 'Request a callback', label: 'We call you', value: 'Leave your number below →', color: 'bg-success-50 text-success-600' },
  { icon: Mail, title: 'Email', label: 'Support', value: 'support@get4domain.com', color: 'bg-secondary-50 text-secondary-600' },
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.phone.replace(/\D/g, '').length < 10) {
      setError('Please add your name and a 10-digit phone number.');
      return;
    }
    setError('');
    setState('sending');
    try {
      await api.requestCallback({ name: form.name.trim(), phone: form.phone.trim(), context: 'marketing', message: form.message || undefined });
      setState('done');
    } catch {
      setError('Could not send — please email support@get4domain.com.');
      setState('idle');
    }
  }

  return (
    <section id="contact" className="section-py bg-slate-50">
      <div className="container-mx container-px">
        <SectionHeading eyebrow="Contact Us" title="Get in Touch" description="Chat with our assistant for instant answers, or leave your number and our team will call you back." />
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            {contactCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="card-base card-hover p-5 flex items-center gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${card.color}`}><Icon className="h-6 w-6" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400">{card.label}</p>
                    <p className="text-sm font-bold text-slate-900">{card.title}</p>
                    <p className="text-sm text-slate-600 truncate">{card.value}</p>
                  </div>
                </div>
              );
            })}
            <div className="card-base p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50"><Headphones className="h-5 w-5 text-primary-600" /></div>
                <div><p className="text-sm font-bold text-slate-900">Dedicated Support</p><p className="text-xs text-slate-500">30 days included with every package</p></div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600"><Clock className="h-4 w-4 text-slate-400" /><span>Mon - Sat: 9:00 AM - 8:00 PM IST</span></div>
              <div className="mt-2 flex items-start gap-2 text-sm text-slate-600"><MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" /><span>Tidel Park, 1st Floor D Block, Tharamani, Chennai - 600113</span></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card-base overflow-hidden">
              <div className="relative h-64 bg-slate-100">
                <iframe
                  title="Get4Domain Office Location"
                  src="https://www.google.com/maps?q=Tidel+Park,+Tharamani,+Chennai,+Tamil+Nadu+600113&output=embed"
                  className="h-full w-full border-0"
                  loading="lazy"
                />
                <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 shadow-md backdrop-blur">
                  <MapPin className="h-4 w-4 text-primary-600" />
                  <span className="text-xs font-medium text-slate-700">Tidel Park, Tharamani, Chennai - 600113</span>
                </div>
              </div>
            </div>
            <div className="card-base p-5">
              <p className="mb-1 text-sm font-bold text-slate-900">Request a callback</p>
              <p className="mb-4 text-xs text-slate-500">Leave your number — our team calls you back. We never ask you to call us.</p>
              {state === 'done' ? (
                <div className="flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 text-sm font-medium text-success-700">
                  <Check className="h-4 w-4" /> Thanks! We&apos;ll call you back shortly.
                </div>
              ) : (
                <form className="space-y-3" onSubmit={submit}>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your Name" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                    <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone Number" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                  <textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="What can we help with? (optional)" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none" />
                  {error && <p className="text-xs text-error-600">{error}</p>}
                  <Button type="submit" fullWidth loading={state === 'sending'} leftIcon={state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}>Request a callback</Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
