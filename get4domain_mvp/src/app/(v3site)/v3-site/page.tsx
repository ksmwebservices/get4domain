import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import ListingCard from '@/components/directory/ListingCard';
import DirectoryEmpty from '@/components/portal/DirectoryEmpty';
import CategoryGrid from '@/components/portal/CategoryGrid';
import FullBleed from '@/components/portal/FullBleed';
import { BrowserFrame, DashboardScreen, DirectoryScreen, PanelPreview, PhoneFrame } from '@/components/portal/Mockups';
import { navPacks } from '@/components/portal/nav-data';
import PortalPricing from '@/components/portal/PortalPricing';
import SearchBox from '@/components/portal/SearchBox';
import { Band, CtaPanel, FaqAccordion, SectionHead } from '@/components/portal/Section';
import { CARD, CHIP, CONTAINER, PROSE_LINK } from '@/components/portal/ui';
import { getPageModel } from '@/lib/v3-public/data';
import { assertV3Public } from '@/lib/v3-public/guard';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { fetchPlans, PUBLIC_TERMS } from '@/lib/v3-public/plans';
import { portalLinks } from '@/lib/v3-public/portal-links';
import { portalPlanRows } from '@/lib/v3-public/portal-pricing';
import { searchQueryString } from '@/lib/v3-public/portal-search';
import { browseCount, PORTAL } from '@/lib/v3-public/portal-strings';
import { baseDomain, readHostConfig } from '@/lib/v3-public/hostnames';
import { faqLd, organizationLd, webSiteLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: SITE.home.metaTitle, description: SITE.home.metaDescription, path: '/' });
}

export default async function HomePage() {
  assertV3Public();
  const H = PORTAL.home;
  const l = portalLinks();
  const packs = navPacks();
  const categoryCount = packs.reduce((n, p) => n + p.categories.length, 0);
  const [plans, dir] = await Promise.all([fetchPlans(), getPageModel('/')]);
  const rows = plans.kind === 'ok' ? portalPlanRows(plans.data) : [];
  const tracks = Object.fromEntries(MARKETING.home.tracks.map((t) => [t.name.toLowerCase(), t.body]));
  const cards = dir.kind === 'ok' ? dir.data.cards.slice(0, 6) : [];
  const base = baseDomain(readHostConfig());
  const faq = [...SITE.home.faq, ...MARKETING.home.faq];
  const register = l.main('/register');
  return (
    <>
      <JsonLd items={[organizationLd(), webSiteLd(), faqLd(faq)]} />

      {/* 1. Hero with the two-mode search */}
      <FullBleed className="-mt-8 overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-brand-900 pb-14 pt-12 sm:pb-20 sm:pt-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-radial-glow" />
        <div className={`${CONTAINER} relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.15fr_1fr]`}>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-300">{H.eyebrow}</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">{H.h1}</h1>
            <p className="mt-4 max-w-xl text-lg text-ink-200">{H.lead}</p>
            <div className="mt-8 max-w-2xl">
              <SearchBox action={l.search} registerHref={register} suffix={base ? `.${base}` : ''} idPrefix="hero" />
            </div>
            <div className="mt-6">
              <p className="text-sm font-medium text-ink-200">{H.popularLabel}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {H.popular.map((w) => (
                  <li key={w}><a href={`${l.search}${searchQueryString({ what: w })}`} className={CHIP}>{w}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div aria-hidden="true" className="relative hidden lg:block">
            <BrowserFrame className="motion-safe:animate-float-slow"><DashboardScreen /></BrowserFrame>
            <PhoneFrame className="absolute -bottom-10 -left-6 w-40"><DirectoryScreen /></PhoneFrame>
          </div>
        </div>
      </FullBleed>

      {/* 2. Categories */}
      <Band id="browse-title">
        <SectionHead id="browse-title" title={H.browseHeading} lead={`${H.browseLead} ${browseCount(packs.length, categoryCount)}`} />
        <div className="mt-8"><CategoryGrid packs={packs} prefix={l.main('')} /></div>
        <p className="mt-6"><Link href={l.main('/industries')} className={PROSE_LINK}>{H.browseAll}</Link></p>
      </Band>

      {/* 3. How it works */}
      <Band id="how-title" tone="soft">
        <SectionHead id="how-title" title={H.howHeading} lead={H.howLead} />
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {SITE.home.steps.map((s, i) => (
            <li key={s.title} className={`${CARD} p-6`}>
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
              <h3 className="mt-4 text-lg font-bold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-700">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6"><Link href={l.main('/how-it-works')} className={PROSE_LINK}>{PORTAL.nav.how}</Link></p>
      </Band>

      {/* 4. The product, drawn */}
      <Band id="show-title">
        <SectionHead id="show-title" title={H.showHeading} lead={H.showLead} />
        <ul className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {PORTAL.panels.map((p) => (
            <li key={p.key} className={`${CARD} flex flex-col overflow-hidden`}>
              <div className="flex min-h-[15rem] items-center justify-center bg-gradient-to-br from-brand-50 to-gold-50 p-5"><div className="w-full max-w-sm"><PanelPreview k={p.key} /></div></div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold text-ink-900">{p.title}</h3>
                <p className="mt-2 flex-1 text-sm text-slate-700">{p.body}</p>
                <Link href={l.main(p.href)} className={`${PROSE_LINK} mt-3 text-sm`}>{H.learnMore}</Link>
              </div>
            </li>
          ))}
        </ul>
      </Band>

      {/* 5. Tracks and prices (numbers come only from the public price route) */}
      <Band id="tracks-title" tone="soft">
        <SectionHead id="tracks-title" title={H.tracksHeading} lead={H.tracksLead} />
        <div className="mt-8">
          {plans.kind === 'ok' && rows.length > 0
            ? <PortalPricing terms={[...PUBLIC_TERMS]} plans={rows} registerHref={register} tracks={tracks} />
            : (
              <div>
                <ul className="grid gap-4 md:grid-cols-3">
                  {MARKETING.home.tracks.map((t) => (
                    <li key={t.name} className={`${CARD} p-6`}><h3 className="text-lg font-bold text-ink-900">{t.name}</h3><p className="mt-2 text-sm text-slate-700">{t.body}</p><p className="mt-4 text-sm font-medium text-slate-600">{H.pricesPending}</p></li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-slate-600">{H.gst}</p>
              </div>
            )}
        </div>
        <p className="mt-6"><Link href={l.main('/pricing')} className={PROSE_LINK}>{H.comparePlans}</Link></p>
      </Band>

      {/* 6. Directory preview */}
      <Band id="dir-title">
        <SectionHead id="dir-title" title={H.directoryHeading} lead={H.directoryLead} />
        {cards.length > 0 ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map((c) => <li key={c.slug}><ListingCard card={c} headingLevel={3} /></li>)}</ul>
        ) : (
          <div className="mt-8"><DirectoryEmpty title={H.directoryEmptyTitle} body={H.directoryEmptyBody} registerHref={register} claimHref={l.claim} /></div>
        )}
        <p className="mt-6"><a href={l.directoryHome} className={PROSE_LINK}>{H.openDirectory}</a></p>
      </Band>

      {/* 7. Domain and subdomain search */}
      <Band id="domain-title" tone="soft">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
          <SectionHead id="domain-title" title={H.domainHeading} lead={H.domainLead} />
          <SearchBox action={l.search} registerHref={register} suffix={base ? `.${base}` : ''} defaultMode="domain" idPrefix="domain" />
        </div>
      </Band>

      {/* 8. Questions */}
      <Band id="faq-title">
        <SectionHead id="faq-title" title={H.faqHeading} />
        <div className="mt-6 max-w-3xl"><FaqAccordion items={faq} /></div>
      </Band>

      {/* 9. Final call to action */}
      <section className="pb-4 pt-2">
        <CtaPanel id="cta-title" title={H.ctaHeading} body={H.ctaBody} primary={{ href: register, label: H.ctaPrimary }} secondary={{ href: l.main('/how-it-works'), label: H.ctaSecondary }} />
      </section>
    </>
  );
}
