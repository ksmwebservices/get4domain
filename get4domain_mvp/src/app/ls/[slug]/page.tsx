import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LeadForm from './LeadForm';
import { CtaButton, ReportBox, StickyCta, ViewBeacon } from './PageClient';

// Server rendered and cached for a minute: a LeadSpace page has to be fast on a phone and readable by search engines without running a script.
export const revalidate = 60;

const API = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

type Block =
  | { type: 'hero'; headline: string; subline: string; image: string | null; primaryButton: string }
  | { type: 'offer'; headline: string; text: string; validUntil: string | null }
  | { type: 'services'; title: string; items: { name: string; priceText: string | null; description: string | null; image: string | null }[] }
  | { type: 'gallery'; images: { src: string; alt: string }[] }
  | { type: 'trust'; items: string[] }
  | { type: 'map'; address: string | null; mapsLink: string | null; area: string | null; hours: string | null }
  | { type: 'faq'; items: { q: string; a: string }[] }
  | { type: 'about'; text: string };

interface PageModel {
  slug: string; mode: 'TEMPLATE' | 'EXISTING_PAGE'; goal: string;
  theme: { accent: string; accentDark: string; soft: string; ink: string };
  business: { name: string; city: string; categoryLabel: string };
  blocks: Block[]; primaryButton: string; stickyCta: { label: string };
  form: { goal: string; fields: { key: string; label: string; kind: 'text' | 'tel' | 'textarea' | 'date' | 'select' | 'cart'; required: boolean; options?: string[]; hint?: string }[]; submitLabel: string; consentText: string };
  disclaimer: string | null; rera: string | null;
  seo: { title: string; description: string; canonical: string; robots: string; jsonLd: Record<string, unknown> };
  existingPageUrl: string | null; indexable: boolean;
}

async function load(slug: string): Promise<{ status: 'ok'; page: PageModel } | { status: 'gone' | 'missing' }> {
  try {
    const res = await fetch(`${API}/leadspace/public/page/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    if (res.status === 410) return { status: 'gone' };
    if (!res.ok) return { status: 'missing' };
    const json = (await res.json()) as { data: PageModel };
    return { status: 'ok', page: json.data };
  } catch {
    return { status: 'missing' };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await load(slug);
  if (r.status !== 'ok') return { title: 'Page not available', robots: { index: false, follow: false } };
  const { seo } = r.page;
  const index = seo.robots.startsWith('index');
  return {
    title: { absolute: seo.title }, description: seo.description, alternates: { canonical: seo.canonical },
    robots: index ? { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } } : { index: false, follow: false },
    openGraph: { title: seo.title, description: seo.description, url: seo.canonical, type: 'website' },
  };
}

export default async function LeadSpacePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ report?: string }> }): Promise<React.ReactElement> {
  const { slug } = await params;
  const { report } = await searchParams;
  const r = await load(slug);
  if (r.status === 'gone') {
    return <main className="mx-auto max-w-md px-5 py-24 text-center"><h1 className="text-2xl font-bold text-slate-900">This page has been taken down</h1><p className="mt-3 text-slate-600">If you think this is a mistake, write to support@get4domain.com.</p></main>;
  }
  if (r.status !== 'ok') notFound();
  const m = r.page;
  const t = m.theme;
  const services = m.blocks.find((b): b is Extract<Block, { type: 'services' }> => b.type === 'services');
  const cartItems = m.goal === 'CART_ORDER' ? (services?.items.map((i) => i.name) ?? []) : [];

  return (
    <div style={{ background: t.soft, color: t.ink }} className="min-h-screen pb-24 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(m.seo.jsonLd).replace(/</g, '\\u003c') }} />
      <ViewBeacon slug={m.slug} />
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
        <p className="text-lg font-bold" style={{ color: t.accentDark }}>{m.business.name}</p>
        <p className="text-sm text-slate-500">{m.business.city}</p>
      </header>
      <main className="mx-auto max-w-3xl space-y-10 px-5 pb-12">
        {m.mode === 'EXISTING_PAGE' ? (
          <section className="text-center">
            <h1 className="text-2xl font-bold" style={{ color: t.accentDark }}>{m.business.name}</h1>
            <p className="mt-2 text-slate-600">{m.business.categoryLabel} in {m.business.city}</p>
            {m.existingPageUrl ? <p className="mt-2 text-sm"><a className="underline" href={m.existingPageUrl} rel="noopener nofollow">Visit our website</a></p> : null}
          </section>
        ) : null}
        {m.blocks.map((b, i) => {
          switch (b.type) {
            case 'hero':
              return (
                <section key={i} className="pt-2">
                  {b.image ? <img src={b.image} alt={m.business.name} className="mb-5 h-56 w-full rounded-2xl object-cover md:h-72" loading="eager" /> : null}
                  <h1 className="text-3xl font-bold leading-tight md:text-4xl" style={{ color: t.accentDark }}>{b.headline}</h1>
                  <p className="mt-3 text-lg text-slate-700">{b.subline}</p>
                  <div className="mt-5"><CtaButton slug={m.slug} label={b.primaryButton} color={t.accent} /></div>
                </section>
              );
            case 'offer':
              return (
                <section key={i} className="rounded-2xl p-5" style={{ background: '#ffffff', border: `2px dashed ${t.accent}` }}>
                  <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: t.accent }}>Offer</p>
                  <p className="mt-1 text-xl font-bold">{b.headline}</p>
                  <p className="mt-1 text-slate-700">{b.text}</p>
                  {b.validUntil ? <p className="mt-2 text-sm text-slate-500">Valid until {b.validUntil}</p> : null}
                </section>
              );
            case 'services':
              return (
                <section key={i}>
                  <h2 className="mb-3 text-xl font-bold" style={{ color: t.accentDark }}>{b.title}</h2>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {b.items.map((it, j) => (
                      <li key={j} id={`item-${j + 1}`} className="rounded-xl bg-white p-4 shadow-sm">
                        {it.image ? <img src={it.image} alt={it.name} className="mb-3 h-32 w-full rounded-lg object-cover" loading="lazy" /> : null}
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold">{it.name}</p>
                          {it.priceText ? <p className="whitespace-nowrap font-semibold" style={{ color: t.accentDark }}>{it.priceText}</p> : null}
                        </div>
                        {it.description ? <p className="mt-1 text-sm text-slate-600">{it.description}</p> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            case 'about':
              return <section key={i}><h2 className="mb-2 text-xl font-bold" style={{ color: t.accentDark }}>About us</h2><p className="text-slate-700">{b.text}</p></section>;
            case 'gallery':
              return (
                <section key={i}>
                  <h2 className="mb-3 text-xl font-bold" style={{ color: t.accentDark }}>Our work</h2>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{b.images.map((g, j) => <img key={j} src={g.src} alt={g.alt} className="h-36 w-full rounded-lg object-cover" loading="lazy" />)}</div>
                </section>
              );
            case 'trust':
              return (
                <section key={i}>
                  <ul className="grid gap-2 sm:grid-cols-2">{b.items.map((x, j) => <li key={j} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm"><span aria-hidden style={{ color: t.accent }}>&#10003;</span><span>{x}</span></li>)}</ul>
                </section>
              );
            case 'map':
              return (
                <section key={i}>
                  <h2 className="mb-2 text-xl font-bold" style={{ color: t.accentDark }}>Where we serve</h2>
                  {b.area ? <p className="text-sm text-slate-600">Areas we serve: {b.area}</p> : null}
                  {b.hours ? <p className="text-sm text-slate-600">Hours: {b.hours}</p> : null}
                </section>
              );
            case 'faq':
              return (
                <section key={i}>
                  <h2 className="mb-3 text-xl font-bold" style={{ color: t.accentDark }}>Questions people ask</h2>
                  <div className="space-y-2">{b.items.map((f, j) => <details key={j} className="rounded-lg bg-white px-4 py-3 shadow-sm"><summary className="cursor-pointer font-medium">{f.q}</summary><p className="mt-2 text-sm text-slate-700">{f.a}</p></details>)}</div>
                </section>
              );
            default:
              return null;
          }
        })}
        <section>
          <h2 className="mb-3 text-xl font-bold" style={{ color: t.accentDark }}>{m.primaryButton}</h2>
          <LeadForm model={{ slug: m.slug, theme: t, form: m.form, cartItems }} />
        </section>
        {m.rera ? <p className="text-sm text-slate-700">RERA registration: <strong>{m.rera}</strong></p> : null}
        {m.disclaimer ? <p className="rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-600">{m.disclaimer}</p> : null}
      </main>
      <footer className="mx-auto max-w-3xl space-y-3 px-5 pb-10 text-center text-xs text-slate-500">
        <ReportBox slug={m.slug} initiallyOpen={report === '1'} />
        <p><a href="/privacy-policy" className="underline">Privacy notice</a> · <a href="mailto:privacy@get4domain.com?subject=Please%20delete%20my%20data" className="underline">Delete my data</a></p>
        <p>Page by <a href="https://get4domain.com" className="underline" rel="noopener">Get4Domain LeadSpace</a></p>
      </footer>
      <StickyCta slug={m.slug} label={m.stickyCta.label} color={t.accent} />
    </div>
  );
}
