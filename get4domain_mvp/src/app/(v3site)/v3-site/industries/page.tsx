import type { Metadata } from 'next';
import Link from 'next/link';
import Crumbs from '@/components/site/Crumbs';
import { categoriesOfPack, categoryPath } from '@/lib/v3-public/catalogue';
import { assertV3Public } from '@/lib/v3-public/guard';
import { publishedIndustries } from '@/lib/v3-public/industries';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

/** The categories named on a card of the hub; the full list is on the page of the pack. */
const SHOWN = 6;

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: SITE.industries.metaTitle, description: SITE.industries.metaDescription, path: '/industries' });
}

export default function IndustriesPage() {
  assertV3Public();
  const I = SITE.industries;
  const X = MARKETING.industriesHub;
  return (
    <>
      <Crumbs here={I.h1} path="/industries" />
      <h1 className="text-3xl font-bold text-slate-900">{I.h1}</h1>
      <p className="mt-2 text-slate-600">{I.intro}</p>
      <p className="mt-2 max-w-3xl text-slate-700">{X.lead}</p>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {publishedIndustries().map(({ pack: p, slug }) => {
          const list = categoriesOfPack(p.key);
          return (
            <li key={p.key} className="rounded-xl border border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-900"><Link href={`/industries/${slug}`} className="hover:underline">{p.name}</Link></h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">{p.gives.map((g) => <li key={g}>{g}</li>)}</ul>
              {list.length > 0 ? (
                <>
                  <h3 className="mt-3 text-sm font-medium text-slate-900">{X.categoriesHeading}</h3>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {list.slice(0, SHOWN).map((c) => <li key={c.id}><Link href={categoryPath(c)} className="text-slate-700 underline">{c.name}</Link></li>)}
                  </ul>
                </>
              ) : null}
              <p className="mt-3 text-sm">
                <Link href={`/industries/${slug}`} className="font-medium text-slate-900 underline">{list.length > SHOWN ? X.allCategories : I.viewLink}<span className="sr-only">: {p.name}</span></Link>
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href="/register" className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">{I.cta}</Link>
        <Link href="/guides" className="font-medium text-slate-900 underline">{X.guidesLink}</Link>
      </p>
    </>
  );
}
