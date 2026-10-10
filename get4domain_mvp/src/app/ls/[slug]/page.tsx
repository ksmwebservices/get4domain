import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LeadForm from './LeadForm';
import { ReportBox, ViewBeacon } from './PageClient';
import LeadSpaceApp from './themes/LeadSpaceApp';
import type { PageModel } from './themes/model';

// Server rendered and cached for a minute: a LeadSpace page has to be fast on a phone and readable by search engines without running a script.
export const revalidate = 60;

const API = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(m.seo.jsonLd).replace(/</g, '\\u003c') }} />
      <ViewBeacon slug={m.slug} />
      {m.mode === 'EXISTING_PAGE' ? (
        // Older pages that only added a request form to a website the business already had. New pages are always the app below.
        <div style={{ background: t.soft, color: t.ink }} className="min-h-screen px-5 py-10">
          <main className="mx-auto max-w-xl space-y-6">
            <h1 className="text-2xl font-bold" style={{ color: t.accentDark }}>{m.business.name}</h1>
            <p className="text-slate-600">{m.business.categoryLabel} in {m.business.city}</p>
            <LeadForm model={{ slug: m.slug, theme: t, form: m.form, cartItems: [] }} />
            {m.disclaimer ? <p className="rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-600">{m.disclaimer}</p> : null}
            <ReportBox slug={m.slug} initiallyOpen={report === '1'} />
            <p className="text-center text-xs text-slate-500"><a href="/privacy-policy" className="underline">Privacy notice</a> &middot; Page by <a href="https://get4domain.com" className="underline" rel="noopener">Get4Domain LeadSpace</a></p>
          </main>
        </div>
      ) : (
        <LeadSpaceApp model={m} reportOpen={report === '1'} />
      )}
    </>
  );
}
