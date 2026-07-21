'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Phone, MessageCircle, MapPin, CheckCircle2, Loader2, Send, Users2, Star,
} from 'lucide-react';
import { api } from '@/lib/api';

interface CampaignPageData {
  id: string;
  slug: string;
  title: string;
  headline: string;
  subheadline: string | null;
  benefits: string[];
  aboutText: string | null;
  heroImage: string | null;
  photos: string[] | null;
  style: 'LIGHT' | 'DARK' | 'VIBRANT';
  phone: string;
  whatsapp: string;
  address: string | null;
  mapsLink: string | null;
  testimonials: Array<{ name: string; text: string; rating?: number }> | null;
  ctaText: string;
  leadsThisWeek: number;
}

const THEMES = {
  LIGHT: {
    bg: 'bg-white',
    text: 'text-slate-900',
    subtext: 'text-slate-600',
    hero: 'bg-gradient-to-br from-primary-50 via-white to-white',
    accent: 'bg-primary-600 hover:bg-primary-700',
    accentText: 'text-primary-600',
    card: 'bg-slate-50 border border-slate-200',
  },
  DARK: {
    bg: 'bg-slate-950',
    text: 'text-white',
    subtext: 'text-slate-300',
    hero: 'bg-gradient-to-br from-slate-900 via-slate-950 to-black',
    accent: 'bg-primary-500 hover:bg-primary-400',
    accentText: 'text-primary-400',
    card: 'bg-slate-900 border border-slate-800',
  },
  VIBRANT: {
    bg: 'bg-white',
    text: 'text-slate-900',
    subtext: 'text-slate-600',
    hero: 'bg-gradient-to-br from-fuchsia-500 via-primary-600 to-secondary-500',
    accent: 'bg-secondary-500 hover:bg-secondary-600',
    accentText: 'text-secondary-600',
    card: 'bg-fuchsia-50 border border-fuchsia-100',
  },
};

export default function CampaignPublicPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [page, setPage] = useState<CampaignPageData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPublicCampaignPage(slug)
      .then((res) => {
        const data = res.data as CampaignPageData;
        setPage(data);
        api.incrementCampaignPageView(data.id).catch(() => {});
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.submitCampaignPageLead(slug, form);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit — please try calling us directly.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">This page may have been removed or is no longer active.</p>
      </div>
    );
  }

  const theme = THEMES[page.style] ?? THEMES.LIGHT;
  const waLink = `https://wa.me/${page.whatsapp.replace(/\D/g, '')}`;
  const callLink = `tel:${page.phone}`;

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text}`}>
      {/* Hero */}
      <section className={`relative overflow-hidden px-5 pb-12 pt-10 ${theme.hero}`}>
        {page.heroImage && (
          <div className="absolute inset-0">
            <img src={page.heroImage} alt={page.title} className="h-full w-full object-cover opacity-30" />
          </div>
        )}
        <div className="relative mx-auto max-w-md text-center">
          <div className={`mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${page.style === 'DARK' ? 'bg-white/10 text-white' : 'bg-white/70 backdrop-blur text-slate-700'}`}>
            <Users2 className="h-3.5 w-3.5" />{page.leadsThisWeek} people enquired this week
          </div>
          <h1 className="text-3xl font-bold leading-tight">{page.headline}</h1>
          {page.subheadline && <p className={`mt-3 text-sm ${page.style === 'DARK' || page.style === 'VIBRANT' ? 'text-white/80' : theme.subtext}`}>{page.subheadline}</p>}
          <a href="#enquiry" className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg ${theme.accent}`}>
            {page.ctaText}
          </a>
        </div>
      </section>

      {/* Benefits */}
      {page.benefits?.length > 0 && (
        <section className="px-5 py-8">
          <div className="mx-auto max-w-md grid grid-cols-1 gap-3">
            {page.benefits.slice(0, 5).map((b, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-xl p-3.5 ${theme.card}`}>
                <CheckCircle2 className={`h-5 w-5 flex-shrink-0 ${theme.accentText}`} />
                <span className="text-sm font-medium">{b}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gallery */}
      {page.photos && page.photos.length > 0 && (
        <section className="py-4">
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 snap-x snap-mandatory">
            {page.photos.map((src, i) => (
              <img key={i} src={src} alt={`${page.title} photo ${i + 1}`} className="h-48 w-64 flex-shrink-0 snap-center rounded-2xl object-cover" />
            ))}
          </div>
        </section>
      )}

      {/* About */}
      {page.aboutText && (
        <section className="px-5 py-8">
          <div className={`mx-auto max-w-md rounded-2xl p-5 ${theme.card}`}>
            <h2 className="text-sm font-bold uppercase tracking-wide mb-2 opacity-70">About Us</h2>
            <p className={`text-sm leading-relaxed ${theme.subtext}`}>{page.aboutText}</p>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {page.testimonials && page.testimonials.length > 0 && (
        <section className="py-4">
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 snap-x snap-mandatory">
            {page.testimonials.map((t, i) => (
              <div key={i} className={`w-72 flex-shrink-0 snap-center rounded-2xl p-4 ${theme.card}`}>
                {t.rating && (
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star key={idx} className={`h-3.5 w-3.5 ${idx < t.rating! ? 'fill-warning-400 text-warning-400' : 'text-slate-300'}`} />
                    ))}
                  </div>
                )}
                <p className="text-sm italic">&ldquo;{t.text}&rdquo;</p>
                <p className="mt-2 text-xs font-semibold opacity-70">— {t.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Enquiry form */}
      <section id="enquiry" className="px-5 py-10">
        <div className={`mx-auto max-w-md rounded-2xl p-5 ${theme.card}`}>
          <h2 className="text-lg font-bold mb-1">Get in Touch</h2>
          <p className={`text-xs mb-4 ${theme.subtext}`}>Fill this in and we&apos;ll call you back shortly.</p>

          {submitted ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-success-500 mb-3" />
              <p className="text-sm font-semibold">Thank you! We will call you within 1 hour.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && <div className="rounded-lg bg-error-50 px-3 py-2 text-xs text-error-700">{error}</div>}
              <input
                required
                placeholder="Your Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
              <input
                required
                type="tel"
                placeholder="Phone Number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
              <textarea
                rows={2}
                placeholder="Message (optional)"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none"
              />
              <button type="submit" disabled={submitting} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60 ${theme.accent}`}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Enquiry
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Contact */}
      <section className="px-5 pb-10">
        <div className="mx-auto max-w-md grid grid-cols-3 gap-3">
          <a href={callLink} className={`flex flex-col items-center gap-1.5 rounded-xl py-3 text-xs font-semibold ${theme.card}`}>
            <Phone className={`h-5 w-5 ${theme.accentText}`} />Call
          </a>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className={`flex flex-col items-center gap-1.5 rounded-xl py-3 text-xs font-semibold ${theme.card}`}>
            <MessageCircle className={`h-5 w-5 ${theme.accentText}`} />WhatsApp
          </a>
          <a
            href={page.mapsLink ?? `https://www.google.com/maps?q=${encodeURIComponent(page.address ?? page.title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex flex-col items-center gap-1.5 rounded-xl py-3 text-xs font-semibold ${theme.card}`}
          >
            <MapPin className={`h-5 w-5 ${theme.accentText}`} />Maps
          </a>
        </div>
      </section>

      {/* Footer watermark */}
      <footer className={`px-5 py-6 text-center text-xs ${theme.subtext}`}>
        Powered by <span className="font-semibold">Get4Domain</span>
      </footer>

      {/* Floating always-visible Call/WhatsApp */}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-3">
        <a href={callLink} className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg">
          <Phone className="h-5 w-5" />
        </a>
        <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white shadow-lg">
          <MessageCircle className="h-5 w-5" />
        </a>
      </div>
    </div>
  );
}
