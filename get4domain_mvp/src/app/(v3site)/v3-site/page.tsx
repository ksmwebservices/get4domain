import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import { CtaBox, FaqList } from '@/components/site/Blocks';
import { assertV3Public } from '@/lib/v3-public/guard';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { faqLd, organizationLd, webSiteLd } from '@/lib/v3-public/site-jsonld';
import { directoryOrigin, siteMetadata } from '@/lib/v3-public/site-metadata';
import { productPath } from '@/lib/v3-public/site-routes';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: SITE.home.metaTitle, description: SITE.home.metaDescription, path: '/' });
}

const LINK = 'font-medium text-slate-900 underline';
const H2 = 'text-2xl font-semibold text-slate-900';

export default function HomePage() {
  assertV3Public();
  const H = SITE.home;
  const M = MARKETING.home;
  const directory = directoryOrigin();
  const faq = [...H.faq, ...M.faq];
  return (
    <>
      <JsonLd items={[organizationLd(), webSiteLd(), faqLd(faq)]} />
      <h1 className="text-4xl font-bold text-slate-900">{H.h1}</h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-600">{H.lead}</p>
      <p className="mt-6 flex flex-wrap gap-3">
        <Link href="/register" className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">{H.ctaPrimary}</Link>
        <Link href="/pricing" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-900">{H.ctaSecondary}</Link>
      </p>

      <section aria-labelledby="who-title" className="mt-12">
        <h2 id="who-title" className={H2}>{M.audienceHeading}</h2>
        <p className="mt-2 max-w-3xl text-slate-700">{M.audienceBody}</p>
        <p className="mt-3"><Link href="/industries" className={LINK}>{M.audienceLink}</Link></p>
      </section>

      <section aria-labelledby="steps-title" className="mt-12">
        <h2 id="steps-title" className={H2}>{H.stepsHeading}</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {H.steps.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-500" aria-hidden="true">{i + 1}</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-700">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3"><Link href="/how-it-works" className={LINK}>{SITE.nav.how}</Link></p>
      </section>

      <section aria-labelledby="tracks-title" className="mt-12">
        <h2 id="tracks-title" className={H2}>{M.tracksHeading}</h2>
        <p className="mt-2 max-w-3xl text-slate-700">{M.tracksIntro}</p>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {M.tracks.map((t) => (
            <li key={t.name} className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold text-slate-900">{t.name}</h3>
              <p className="mt-2 text-sm text-slate-700">{t.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600">{H.plansBody}</p>
        <p className="mt-2"><Link href="/pricing" className={LINK}>{M.tracksLink}</Link></p>
      </section>

      <section aria-labelledby="product-title" className="mt-12">
        <h2 id="product-title" className={H2}>{M.productHeading}</h2>
        <p className="mt-2 text-slate-700">{M.productIntro}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {MARKETING.product.pages.map((p) => (
            <li key={p.slug}><Link href={productPath(p.slug)} className="block rounded-xl border border-slate-200 p-4 font-medium text-slate-900 hover:bg-slate-50">{p.name}</Link></li>
          ))}
        </ul>
        <p className="mt-3"><Link href="/product" className={LINK}>{MARKETING.product.hubLink}</Link></p>
      </section>

      <section aria-labelledby="dir-title" className="mt-12">
        <h2 id="dir-title" className={H2}>{M.directoryHeading}</h2>
        <p className="mt-2 text-slate-700">{M.directoryBody}</p>
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {directory ? <a href={directory} className={LINK}>{H.directoryCta}</a> : null}
          <Link href={productPath('directory')} className={LINK}>{MARKETING.product.pages.find((p) => p.slug === 'directory')?.name}</Link>
        </p>
      </section>

      <section aria-labelledby="partner-title" className="mt-12">
        <h2 id="partner-title" className={H2}>{M.partnersHeading}</h2>
        <p className="mt-2 text-slate-700">{M.partnersBody}</p>
        <p className="mt-3"><Link href="/partners" className={LINK}>{M.partnersLink}</Link></p>
      </section>

      <section aria-labelledby="guides-title" className="mt-12">
        <h2 id="guides-title" className={H2}>{M.guidesHeading}</h2>
        <p className="mt-2 text-slate-700">{M.guidesBody}</p>
        <p className="mt-3"><Link href="/guides" className={LINK}>{M.guidesLink}</Link></p>
      </section>

      <FaqList id="faq-title" heading={H.faqHeading} items={faq} />
      <CtaBox id="cta-title" heading={M.ctaHeading} body={M.ctaBody} links={[{ href: '/register', label: H.ctaPrimary }, { href: '/pricing', label: H.ctaSecondary }]} />
    </>
  );
}
