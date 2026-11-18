import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import PageHero from '@/components/portal/PageHero';
import { CtaPanel } from '@/components/portal/Section';
import { btn, CARD_HOVER, CHIP, FOCUS } from '@/components/portal/ui';
import { categoriesOfPack, categoryPath } from '@/lib/v3-public/catalogue';
import { assertV3Public } from '@/lib/v3-public/guard';
import { publishedIndustries } from '@/lib/v3-public/industries';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { PORTAL } from '@/lib/v3-public/portal-strings';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

/** The categories named on a card of the hub; the full list is on the page of the area. */
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
      <PageHero
        crumbs={[{ name: I.h1, path: '/industries' }]}
        h1={I.h1}
        lead={`${I.intro} ${X.lead}`}
        actions={<><Link href="/register" className={btn('primary')}>{I.cta}</Link><Link href="/guides" className={btn('secondary')}>{X.guidesLink}</Link></>}
      />
      <ul className="grid gap-5 pt-10 md:grid-cols-2">
        {publishedIndustries().map(({ pack: p, slug }) => {
          const list = categoriesOfPack(p.key);
          return (
            <li key={p.key} className={`${CARD_HOVER} flex flex-col p-6`}>
              <h2 className="text-xl font-bold text-ink-900"><Link href={`/industries/${slug}`} className={`rounded hover:text-brand-700 ${FOCUS}`}>{p.name}</Link></h2>
              <ul className="mt-3 flex flex-wrap gap-1.5">{p.gives.map((g) => <li key={g} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">{g}</li>)}</ul>
              {list.length > 0 ? (
                <>
                  <h3 className="mt-4 text-sm font-semibold text-ink-900">{X.categoriesHeading}</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {list.slice(0, SHOWN).map((c) => <li key={c.id}><Link href={categoryPath(c)} className={CHIP}>{c.name}</Link></li>)}
                  </ul>
                </>
              ) : null}
              <p className="mt-auto pt-5 text-sm">
                <Link href={`/industries/${slug}`} className={`inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline ${FOCUS}`}>{list.length > SHOWN ? X.allCategories : I.viewLink}<span className="sr-only">: {p.name}</span><ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
              </p>
            </li>
          );
        })}
      </ul>
      <div className="pt-12">
        <CtaPanel id="hub-cta" title={PORTAL.home.ctaHeading} body={PORTAL.home.ctaBody} primary={{ href: '/register', label: PORTAL.home.ctaPrimary }} secondary={{ href: '/pricing', label: PORTAL.nav.pricing }} />
      </div>
    </>
  );
}
