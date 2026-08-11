'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Phone, MessageCircle, Star, Check, CalendarDays, Sparkles } from 'lucide-react';
import ChatBot from '@/components/ChatBot';
import { api } from '@/lib/api';
import { industryContent } from '@/data/industry-content';

interface Service { name: string; price: number; desc: string }
type Section =
  | { type: 'catalog'; label: string; items: Service[] }
  | { type: 'team'; label: string; members: { name: string; role: string }[] }
  | { type: 'booking'; label: string; records: { title: string; when: string; status: string }[] }
  | { type: 'reviews'; label: string; items: { name: string; text: string }[] }
  | { type: 'about'; label: string; text: string }
  | { type: 'contact'; label: string };

interface DemoSite {
  key: string;
  label: string;
  business: string;
  tagline: string;
  about: string;
  sections: Section[];
}

const price = (p: number) => (p > 0 ? `₹${p.toLocaleString('en-IN')}` : 'Enquire');
const secId = (t: string) => `sec-${t}`;

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

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (notFound || !site) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-slate-600">This demo site isn&apos;t available.</p>
        <Link href="/industries" className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white">Browse industries</Link>
      </div>
    );
  }

  // Nav: Home + a link per meaningful section (skip reviews to keep it tight).
  const navSections = site.sections.filter((s) => s.type !== 'reviews');
  const cover = industryContent.find((c) => c.id === industry)?.coverImage ?? null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header — the demo site's OWN lightweight nav (in-page section links), not
          Get4Domain's app nav. Desktop shows inline links; mobile gets a scrollable
          pill row. No app bottom-nav is borrowed here. */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <a href="#top" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 font-bold text-white">{site.business.charAt(0)}</div>
            <span className="text-base font-bold text-slate-900">{site.business}</span>
          </a>
          <nav className="hidden items-center gap-1 md:flex">
            <a href="#top" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Home</a>
            {navSections.map((s) => (
              <a key={s.type} href={`#${secId(s.type)}`} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">{s.label}</a>
            ))}
          </nav>
          <a href={`#${secId('contact')}`} className="rounded-xl bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-700">Enquire</a>
        </div>
        {/* Mobile in-page section nav */}
        <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <a href="#top" className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600">Home</a>
          {navSections.map((s) => (
            <a key={s.type} href={`#${secId(s.type)}`} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600">{s.label}</a>
          ))}
        </div>
      </header>

      {/* Hero — real industry banner image with a readable overlay */}
      <section id="top" className="relative overflow-hidden">
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={site.business} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-primary-900/70 to-primary-700/60" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-500" />
        )}
        <div className="relative mx-auto max-w-5xl px-5 py-16 text-white sm:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">{site.label}</span>
          <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">{site.tagline}</h1>
          <p className="mt-4 max-w-xl text-base text-white/90 sm:text-lg">{site.about}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={`#${secId('contact')}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary-700 hover:bg-white/90">Book Now</a>
            <a href={`#${secId('contact')}`} className="inline-flex items-center gap-2 rounded-xl bg-success-500 px-5 py-3 text-sm font-bold text-white hover:bg-success-600"><MessageCircle className="h-4 w-4" /> Enquire on WhatsApp</a>
          </div>
        </div>
      </section>

      {/* Sections */}
      {site.sections.map((s) => {
        if (s.type === 'catalog') {
          return (
            <section key={s.type} id={secId(s.type)} className="mx-auto max-w-5xl scroll-mt-20 px-5 py-14">
              <h2 className="text-2xl font-bold text-slate-900">{s.label}</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {s.items.map((it) => (
                  <div key={it.name} className="rounded-2xl border border-slate-200 p-5 transition-shadow hover:shadow-md">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Sparkles className="h-5 w-5" /></div>
                    <h3 className="mt-3 font-bold text-slate-900">{it.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{it.desc}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-lg font-bold text-slate-900">{price(it.price)}</span>
                      <a href={`#${secId('contact')}`} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">Book</a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        }
        if (s.type === 'team') {
          return (
            <section key={s.type} id={secId(s.type)} className="bg-slate-50 py-14">
              <div className="mx-auto max-w-5xl scroll-mt-20 px-5">
                <h2 className="text-2xl font-bold text-slate-900">{s.label}</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {s.members.map((m, i) => (
                    <div key={m.name} className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://i.pravatar.cc/160?img=${((i * 7 + industry.length) % 70) + 1}`} alt={m.name}
                        className="mx-auto h-16 w-16 rounded-full object-cover" />
                      <h3 className="mt-3 font-bold text-slate-900">{m.name}</h3>
                      <p className="text-sm text-primary-600">{m.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        }
        if (s.type === 'booking') {
          return (
            <section key={s.type} id={secId(s.type)} className="mx-auto max-w-5xl scroll-mt-20 px-5 py-14">
              <h2 className="text-2xl font-bold text-slate-900">{s.label}</h2>
              <p className="mt-1 text-sm text-slate-500">Recent {s.label.toLowerCase()} — book yours in seconds.</p>
              <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
                {s.records.map((r) => (
                  <div key={r.title} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-4 w-4 text-primary-600" />
                      <span className="text-sm font-medium text-slate-800">{r.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{r.when}</span>
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
              <a href={`#${secId('contact')}`} className="mt-5 inline-flex rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white hover:bg-primary-700">{s.label} →</a>
            </section>
          );
        }
        if (s.type === 'reviews') {
          return (
            <section key={s.type} id={secId(s.type)} className="bg-slate-50 py-14">
              <div className="mx-auto max-w-5xl scroll-mt-20 px-5">
                <h2 className="text-2xl font-bold text-slate-900">What our customers say</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {s.items.map((t) => (
                    <div key={t.name} className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex gap-0.5 text-amber-400">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
                      <p className="mt-3 text-sm text-slate-700">“{t.text}”</p>
                      <p className="mt-2 text-xs font-semibold text-slate-500">— {t.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        }
        if (s.type === 'about') {
          return (
            <section key={s.type} id={secId(s.type)} className="mx-auto max-w-3xl scroll-mt-20 px-5 py-14">
              <h2 className="text-2xl font-bold text-slate-900">About {site.business}</h2>
              <p className="mt-3 text-slate-600">{s.text}</p>
            </section>
          );
        }
        // contact
        return (
          <section key={s.type} id={secId(s.type)} className="mx-auto max-w-lg scroll-mt-20 px-5 py-16">
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
        );
      })}

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <p>{site.business} — a Get4Domain demo site.</p>
        <Link href="/book-demo" className="mt-1 inline-block font-semibold text-primary-600">Build your own with Get4Domain →</Link>
      </footer>

      {/* Floating chat only — no app bottom-nav on the public demo site */}
      <ChatBot />
    </div>
  );
}
