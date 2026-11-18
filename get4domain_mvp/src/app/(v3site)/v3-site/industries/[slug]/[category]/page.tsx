import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import { SampleSite } from '@/components/portal/Mockups';
import PageHero from '@/components/portal/PageHero';
import { Band, CtaPanel, FaqAccordion, SectionHead } from '@/components/portal/Section';
import { btn, CARD, CHIP } from '@/components/portal/ui';
import { categoriesOfPack, categoryPage, categoryPath } from '@/lib/v3-public/catalogue';
import { assertV3Public } from '@/lib/v3-public/guard';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { portalLinks } from '@/lib/v3-public/portal-links';
import { searchQueryString } from '@/lib/v3-public/portal-search';
import { PORTAL } from '@/lib/v3-public/portal-strings';
import { faqLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

const fill = (t: string, v: Record<string, string>): string => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');

type Params = Promise<{ slug: string; category: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  assertV3Public();
  const p = await params;
  const page = categoryPage(p.slug, p.category);
  if (!page) notFound();
  return siteMetadata({
    title: `${page.category.name} website`,
    description: fill(MARKETING.categoryPage.metaDescription, { name: page.category.name }),
    path: categoryPath(page.category),
  });
}

export default async function CategoryLandingPage({ params }: { params: Params }) {
  assertV3Public();
  const p = await params;
  const page = categoryPage(p.slug, p.category);
  if (!page) notFound();
  const C = MARKETING.categoryPage;
  const { industry, category } = page;
  const packName = industry.pack.name;
  const vars = { name: category.name, pack: packName, family: category.family, gives: industry.pack.gives.map((g) => g.toLowerCase()).join(', ') };
  const faq = C.faq.map((f) => ({ q: fill(f.q, vars), a: fill(f.a, vars) }));
  const others = categoriesOfPack(industry.pack.key).filter((c) => c.id !== category.id);
  const register = `/register?pack=${industry.pack.key}&category=${category.id}`;
  const packPath = `/industries/${industry.slug}`;
  const l = portalLinks();
  return (
    <>
      <JsonLd items={[faqLd(faq)]} />
      <PageHero
        crumbs={[{ name: SITE.industries.h1, path: '/industries' }, { name: packName, path: packPath }, { name: category.name, path: categoryPath(category) }]}
        h1={`${category.name} website`}
        lead={fill(C.lead, vars)}
        eyebrow={fill(C.groupLine, vars)}
        actions={<><Link href={register} className={btn('primary')}>{C.cta}</Link><a href={`${l.search}${searchQueryString({ what: category.name })}`} className={btn('secondary')}>{PORTAL.industries.searchThis}</a></>}
        aside={<><SampleSite name={category.name} tone="blue" /><p className="mt-3 text-sm text-slate-600">{PORTAL.industries.sampleNote}</p></>}
      />

      <Band id="gives-title">
        <SectionHead id="gives-title" title={C.givesHeading} lead={fill(C.givesIntro, vars)} />
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {industry.pack.gives.map((g) => (
            <li key={g} className={`${CARD} flex items-center gap-3 p-4`}>
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-700"><Check className="h-4 w-4" /></span>
              <span className="font-medium text-ink-900">{g}</span>
            </li>
          ))}
        </ul>
      </Band>

      <Band id="how-title" tone="soft">
        <SectionHead id="how-title" title={C.howHeading} />
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {C.steps.map((s, i) => (
            <li key={s.title} className={`${CARD} p-6`}>
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
              <h3 className="mt-4 text-lg font-bold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-700">{fill(s.body, vars)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-slate-600">{C.note}</p>
      </Band>

      <Band id="faq-title">
        <SectionHead id="faq-title" title={C.faqHeading} />
        <div className="mt-6 max-w-3xl"><FaqAccordion items={faq} /></div>
      </Band>

      {others.length > 0 ? (
        <Band id="more-title" tone="soft">
          <SectionHead id="more-title" title={fill(C.moreHeading, vars)} />
          <ul className="mt-5 flex flex-wrap gap-2">
            {others.map((c) => <li key={c.id}><Link href={categoryPath(c)} className={CHIP}>{c.name}</Link></li>)}
          </ul>
        </Band>
      ) : null}

      <div className="pt-12">
        <CtaPanel id="cta-title" title={C.ctaHeading} body={PORTAL.home.ctaBody} primary={{ href: register, label: C.cta }} secondary={{ href: packPath, label: fill(C.packLink, vars) }} />
      </div>
    </>
  );
}
