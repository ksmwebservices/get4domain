import type { Metadata } from 'next';
import Link from 'next/link';
import Crumbs from '@/components/site/Crumbs';
import { assertV3Public } from '@/lib/v3-public/guard';
import { publishedIndustries } from '@/lib/v3-public/industries';
import { categoriesByPack, fetchCategories } from '@/lib/v3-public/packs';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: SITE.industries.metaTitle, description: SITE.industries.metaDescription, path: '/industries' });
}

export default async function IndustriesPage() {
  assertV3Public();
  const I = SITE.industries;
  const cats = await fetchCategories();
  const byPack = cats.kind === 'ok' ? categoriesByPack(cats.data) : null;
  return (
    <>
      <Crumbs here={I.h1} path="/industries" />
      <h1 className="text-3xl font-bold text-slate-900">{I.h1}</h1>
      <p className="mt-2 text-slate-600">{I.intro}</p>
      {cats.kind !== 'ok' ? <p className="mt-4 text-sm text-slate-600" role="status">{I.loadError}</p> : null}
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {publishedIndustries().map(({ pack: p, slug }) => {
          const list = byPack?.get(p.key) ?? [];
          return (
            <li key={p.key} className="rounded-xl border border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-900"><Link href={`/industries/${slug}`} className="hover:underline">{p.name}</Link></h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">{p.gives.map((g) => <li key={g}>{g}</li>)}</ul>
              {list.length > 0 ? (
                <>
                  <h3 className="mt-3 text-sm font-medium text-slate-900">{I.categories}</h3>
                  <p className="mt-1 text-sm text-slate-600">{list.map((c) => c.name).join(', ')}</p>
                </>
              ) : null}
              <p className="mt-3 text-sm"><Link href={`/industries/${slug}`} className="font-medium text-slate-900 underline">{I.viewLink}<span className="sr-only">: {p.name}</span></Link></p>
            </li>
          );
        })}
      </ul>
      <p className="mt-8"><Link href="/register" className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">{I.cta}</Link></p>
    </>
  );
}
