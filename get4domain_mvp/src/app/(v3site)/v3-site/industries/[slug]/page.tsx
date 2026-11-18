import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import { SampleSite } from '@/components/portal/Mockups';
import PageHero from '@/components/portal/PageHero';
import { Band, CtaPanel, FaqAccordion, SectionHead } from '@/components/portal/Section';
import { btn, CARD, CHIP, FOCUS } from '@/components/portal/ui';
import { categoriesOfPack, categoryPath } from '@/lib/v3-public/catalogue';
import { assertV3Public } from '@/lib/v3-public/guard';
import { industryBySlug, industryDescription, industryTitle, publishedIndustries } from '@/lib/v3-public/industries';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { PORTAL } from '@/lib/v3-public/portal-strings';
import { breadcrumbLd, faqLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

const fill = (t: string, name: string, gives: string): string => t.replace(/\{name\}/g, name).replace(/\{gives\}/g, gives);
const TONES = ['blue', 'gold', 'ink'] as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  assertV3Public();
  const page = industryBySlug((await params).slug);
  if (!page) notFound();
  return siteMetadata({ title: industryTitle(page.pack.name), description: industryDescription(page.pack.name), path: `/industries/${page.slug}` });
}

export default async function IndustryLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  assertV3Public();
  const page = industryBySlug((await params).slug);
  if (!page) notFound();
  const S = SITE.industryPage;
  const P = PORTAL.industries;
  const name = page.pack.name;
  const gives = page.pack.gives.map((g) => g.toLowerCase()).join(', ');
  const faq = S.faq.map((f) => ({ q: fill(f.q, name, gives), a: fill(f.a, name, gives) }));
  const mine = categoriesOfPack(page.pack.key);
  const path = `/industries/${page.slug}`;
  const crumbs = breadcrumbLd([{ name: SITE.crumbs.home, path: '/' }, { name: SITE.industries.h1, path: '/industries' }, { name, path }]);
  const register = `/register?pack=${page.pack.key}`;
  const all = publishedIndustries();
  const tone = TONES[Math.max(0, all.findIndex((x) => x.slug === page.slug)) % TONES.length];
  return (
    <>
      <JsonLd items={[faqLd(faq), ...(crumbs ? [crumbs] : [])]} />
      <PageHero
        crumbs={[{ name: SITE.industries.h1, path: '/industries' }, { name, path }]}
        h1={name}
        lead={SITE.home.lead}
        actions={<><Link href={register} className={btn('primary')}>{S.cta}</Link><Link href="/pricing" className={btn('secondary')}>{P.seePlans}</Link></>}
        aside={<><SampleSite name={name.split(/ and |, /)[0]} tone={tone} /><p className="mt-3 text-sm text-slate-600">{P.sampleNote}</p></>}
      />

      <Band id="gives-title">
        <SectionHead id="gives-title" title={S.givesHeading} lead={S.givesIntro} />
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {page.pack.gives.map((g) => (
            <li key={g} className={`${CARD} flex items-center gap-3 p-4`}>
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-700"><Check className="h-4 w-4" /></span>
              <span className="font-medium text-ink-900">{g}</span>
            </li>
          ))}
        </ul>
      </Band>

      <Band id="suits-title" tone="soft">
        <SectionHead id="suits-title" title={S.suitsHeading} />
        <ul className="mt-5 flex flex-wrap gap-2">{page.suits.map((x) => <li key={x} className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-800">{x}</li>)}</ul>
      </Band>

      {mine.length > 0 ? (
        <Band id="cats-title">
          <SectionHead id="cats-title" title={S.categoriesHeading} lead={MARKETING.packExtra.categoriesIntro} />
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mine.map((c) => (
              <li key={c.id}><Link href={categoryPath(c)} className={`${CARD} block p-4 text-sm font-semibold text-ink-900 transition-shadow hover:text-brand-700 hover:shadow-card-hover ${FOCUS}`}>{c.name}</Link></li>
            ))}
          </ul>
        </Band>
      ) : null}

      <Band id="how-title" tone="soft">
        <SectionHead id="how-title" title={S.howHeading} />
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {S.steps.map((st, i) => (
            <li key={st.title} className={`${CARD} p-6`}>
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
              <h3 className="mt-4 text-lg font-bold text-ink-900">{st.title}</h3>
              <p className="mt-2 text-sm text-slate-700">{st.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-slate-600">{S.note}</p>
      </Band>

      <Band id="faq-title">
        <SectionHead id="faq-title" title={S.faqHeading} />
        <div className="mt-6 max-w-3xl"><FaqAccordion items={faq} /></div>
      </Band>

      <Band id="more-areas" tone="soft">
        <SectionHead id="more-areas" title={P.otherAreas} />
        <ul className="mt-5 flex flex-wrap gap-2">
          {all.filter((x) => x.slug !== page.slug).map((x) => <li key={x.slug}><Link href={`/industries/${x.slug}`} className={CHIP}>{x.pack.name}</Link></li>)}
        </ul>
      </Band>

      <div className="pt-12">
        <CtaPanel id="cta-title" title={S.ctaHeading} body={PORTAL.home.ctaBody} primary={{ href: register, label: S.cta }} secondary={{ href: '/pricing', label: S.pricingLink }} />
      </div>
    </>
  );
}
