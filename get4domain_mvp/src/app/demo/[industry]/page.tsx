'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Phone, MessageCircle, Star, Check, ArrowRight, Sparkles } from 'lucide-react';
import ChatBot from '@/components/ChatBot';
import MarketingBottomNav from '@/components/MarketingBottomNav';
import { api } from '@/lib/api';

interface Service { name: string; price: number; desc: string }
interface Testimonial { name: string; text: string }
interface DemoSite {
  key: string;
  label: string;
  icon: string;
  entities: { catalogItem: { label: string; labelPlural: string }; record: { label: string; labelPlural: string } };
  content: { business: string; tagline: string; about: string; services: Service[]; testimonials: Testimonial[] };
}

const price = (p: number) => (p > 0 ? `₹${p.toLocaleString('en-IN')}` : 'Enquire');

export default function DemoIndustrySite() {
  const params = useParams();
  const industry = String(params.industry ?? 'general');

  const [site, setSite] = useState<DemoSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.getDemoSite(industry)
      .then((res) => { if (res.data) setSite(res.data); else setNotFound(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [industry]);
  useEffect(() => { load(); }, [load]);

  const submitEnquiry = async () => {
    setErr(''); setSending(true);
    try {
      await api.demoEnquiry({ name: form.name, phone: form.phone, industry: site?.label ?? industry, message: form.message || undefined });
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send — please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }
  if (notFound || !site) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-slate-600">This demo site isn&apos;t available.</p>
        <Link href="/industries" className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white">Browse industries</Link>
      </div>
    );
  }

  const c = site.content;

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 text-white font-bold">{c.business.charAt(0)}</div>
            <span className="text-base font-bold text-slate-900">{c.business}</span>
          </div>
          <a href="#enquire" className="rounded-xl bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-700">Enquire</a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-500" />
        <div className="relative mx-auto max-w-5xl px-5 py-16 text-white sm:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            {site.label}
          </span>
          <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">{c.tagline}</h1>
          <p className="mt-4 max-w-xl text-base text-white/90 sm:text-lg">{c.about}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#enquire" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary-700 hover:bg-white/90">
              Book Now <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#enquire" className="inline-flex items-center gap-2 rounded-xl bg-success-500 px-5 py-3 text-sm font-bold text-white hover:bg-success-600">
              <MessageCircle className="h-4 w-4" /> Enquire on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-2xl font-bold text-slate-900">Our {site.entities.catalogItem.labelPlural}</h2>
        <p className="mt-1 text-sm text-slate-500">Popular {site.entities.catalogItem.labelPlural.toLowerCase()} customers love.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.services.map((s) => (
            <div key={s.name} className="rounded-2xl border border-slate-200 p-5 transition-shadow hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Sparkles className="h-5 w-5" /></div>
              <h3 className="mt-3 font-bold text-slate-900">{s.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{s.desc}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-lg font-bold text-slate-900">{price(s.price)}</span>
                <a href="#enquire" className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">Book</a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-2xl font-bold text-slate-900">What our customers say</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {c.testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex gap-0.5 text-amber-400">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
                <p className="mt-3 text-sm text-slate-700">“{t.text}”</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enquiry */}
      <section id="enquire" className="mx-auto max-w-lg px-5 py-16">
        <h2 className="text-center text-2xl font-bold text-slate-900">Get in touch</h2>
        <p className="mt-1 text-center text-sm text-slate-500">Send an enquiry — we&apos;ll confirm on WhatsApp.</p>
        {sent ? (
          <div className="mt-6 rounded-2xl border border-success-200 bg-success-50 p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-100"><Check className="h-6 w-6 text-success-600" /></div>
            <p className="font-semibold text-slate-900">Thanks, {form.name.split(' ')[0] || 'there'}!</p>
            <p className="mt-1 text-sm text-slate-600">We&apos;ve received your enquiry and sent a confirmation to your WhatsApp.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 p-6">
            <input type="text" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <input type="tel" inputMode="numeric" placeholder="Mobile number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <textarea rows={3} placeholder="What are you looking for? (optional)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            {err && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700">{err}</div>}
            <button onClick={submitEnquiry} disabled={sending || !form.name.trim() || form.phone.replace(/\D/g, '').length < 10}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Send Enquiry
            </button>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <p>{c.business} — a Get4Domain demo site.</p>
        <Link href="/book-demo" className="mt-1 inline-block font-semibold text-primary-600">Build your own with Get4Domain →</Link>
      </footer>

      {/* Reused platform components — no parallel versions */}
      <ChatBot />
      <MarketingBottomNav />
    </div>
  );
}
