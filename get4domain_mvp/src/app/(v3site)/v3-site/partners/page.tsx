import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import { CtaBox, FaqList, Steps } from '@/components/site/Blocks';
import Trail from '@/components/site/Trail';
import { assertV3Public } from '@/lib/v3-public/guard';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { faqLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: MARKETING.partners.metaTitle, description: MARKETING.partners.metaDescription, path: '/partners' });
}

export default function PartnersPage() {
  assertV3Public();
  const P = MARKETING.partners;
  return (
    <>
      <JsonLd items={[faqLd(P.faq)]} />
      <Trail items={[{ name: P.h1, path: '/partners' }]} />
      <h1 className="text-3xl font-bold text-slate-900">{P.h1}</h1>
      <p className="mt-2 max-w-2xl text-lg text-slate-600">{P.lead}</p>
      <Steps id="how-title" heading={P.howHeading} steps={P.steps} />
      <section aria-labelledby="portal-title" className="mt-10">
        <h2 id="portal-title" className="text-xl font-semibold text-slate-900">{P.portalHeading}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">{P.portal.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
      <section aria-labelledby="terms-title" className="mt-10">
        <h2 id="terms-title" className="text-xl font-semibold text-slate-900">{P.termsHeading}</h2>
        <p className="mt-2 text-slate-700">{P.termsBody} <Link href="/partner-terms" className="font-medium text-slate-900 underline">{P.termsLink}</Link></p>
      </section>
      <FaqList id="faq-title" heading={P.faqHeading} items={P.faq} />
      <CtaBox id="cta-title" heading={P.ctaHeading} body={P.ctaBody} links={[{ href: '/contact', label: P.ctaLink }]} />
    </>
  );
}
