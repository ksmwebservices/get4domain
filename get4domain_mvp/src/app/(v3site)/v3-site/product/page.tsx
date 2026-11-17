import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import { CtaBox, FaqList } from '@/components/site/Blocks';
import Trail from '@/components/site/Trail';
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
      <Trail items={[{ name: P.crumb, path: '/product' }]} />
      <h1 className="text-3xl font-bold text-slate-900">{P.h1}</h1>
      <p className="mt-2 max-w-2xl text-slate-600">{P.lead}</p>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {P.pages.map((p) => (
          <li key={p.slug} className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900"><Link href={productPath(p.slug)} className="hover:underline">{p.name}</Link></h2>
            <p className="mt-2 text-sm text-slate-700">{p.lead}</p>
            <p className="mt-3 text-sm"><Link href={productPath(p.slug)} className="font-medium text-slate-900 underline">{P.viewLink}<span className="sr-only">: {p.name}</span></Link></p>
          </li>
        ))}
      </ul>
      <FaqList id="faq-title" heading={P.faqHeading} items={P.faq} />
      <CtaBox id="cta-title" heading={P.ctaHeading} links={[{ href: '/register', label: P.ctaPrimary }, { href: '/pricing', label: P.ctaSecondary }]} />
    </>
  );
}
