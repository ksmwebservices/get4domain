import type { Metadata } from 'next';
import Link from 'next/link';
import PageHead from '@/components/portal/PageHead';
import { assertV3Public } from '@/lib/v3-public/guard';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: SITE.features.metaTitle, description: SITE.features.metaDescription, path: '/features' });
}

export default function FeaturesPage() {
  assertV3Public();
  const F = SITE.features;
  return (
    <>
      <PageHead crumbs={[{ name: F.h1, path: '/features' }]} h1={F.h1} />
      <div className="grid gap-5 pt-10 md:grid-cols-3">
        {F.groups.map((g) => (
          <section key={g.title} aria-labelledby={`g-${g.title}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 id={`g-${g.title}`} className="text-lg font-bold text-ink-900">{g.title}</h2>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">{g.points.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm text-slate-600">{F.note}</p>
      <p className="mt-6"><Link href="/pricing" className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2">{F.cta}</Link></p>
    </>
  );
}
