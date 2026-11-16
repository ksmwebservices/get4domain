import type { Metadata } from 'next';
import Link from 'next/link';
import Crumbs from '@/components/site/Crumbs';
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
      <Crumbs here={F.h1} path="/features" />
      <h1 className="text-3xl font-bold text-slate-900">{F.h1}</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {F.groups.map((g) => (
          <section key={g.title} aria-labelledby={`g-${g.title}`} className="rounded-xl border border-slate-200 p-5">
            <h2 id={`g-${g.title}`} className="text-lg font-semibold text-slate-900">{g.title}</h2>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">{g.points.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm text-slate-600">{F.note}</p>
      <p className="mt-6"><Link href="/pricing" className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">{F.cta}</Link></p>
    </>
  );
}
