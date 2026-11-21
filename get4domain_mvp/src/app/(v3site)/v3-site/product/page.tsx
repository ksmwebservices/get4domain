import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import PageHead from '@/components/portal/PageHead';
import { CtaBox, FaqList } from '@/components/site/Blocks';
import { assertV3Public } from '@/lib/v3-public/guard';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { faqLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { productPath } from '@/lib/v3-public/site-routes';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: MARKETING.product.metaTitle, description: MARKETING.product.metaDescription, path: '/product' });
}

export default function ProductHubPage() {
  assertV3Public();
  const P = MARKETING.product;
  return (
    <>
      <JsonLd items={[faqLd(P.faq)]} />
      <PageHead crumbs={[{ name: P.crumb, path: '/product' }]} h1={P.h1} lead={P.lead} />
      <ul className="grid gap-5 pt-10 md:grid-cols-2">
        {P.pages.map((p) => (
          <li key={p.slug} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="text-lg font-bold text-ink-900"><Link href={productPath(p.slug)} className="hover:underline">{p.name}</Link></h2>
            <p className="mt-2 text-sm text-slate-700">{p.lead}</p>
            <p className="mt-3 text-sm"><Link href={productPath(p.slug)} className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800">{P.viewLink}<span className="sr-only">: {p.name}</span></Link></p>
          </li>
        ))}
      </ul>
      <FaqList id="faq-title" heading={P.faqHeading} items={P.faq} />
      <CtaBox id="cta-title" heading={P.ctaHeading} links={[{ href: '/register', label: P.ctaPrimary }, { href: '/pricing', label: P.ctaSecondary }]} />
    </>
  );
}
