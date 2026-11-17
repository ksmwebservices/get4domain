import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import { CtaBox, FaqList, Steps } from '@/components/site/Blocks';
import Trail from '@/components/site/Trail';
import { assertV3Public } from '@/lib/v3-public/guard';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { faqLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { productPath } from '@/lib/v3-public/site-routes';

export const dynamic = 'force-dynamic';

const find = (slug: string) => MARKETING.product.pages.find((p) => p.slug === slug) ?? null;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  assertV3Public();
  const page = find((await params).slug);
  if (!page) notFound();
  return siteMetadata({ title: page.metaTitle, description: page.metaDescription, path: productPath(page.slug) });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  assertV3Public();
  const page = find((await params).slug);
  if (!page) notFound();
  const P = MARKETING.product;
  const related = page.related.map((s) => find(s)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <>
      <JsonLd items={[faqLd(page.faq)]} />
      <Trail items={[{ name: P.crumb, path: '/product' }, { name: page.name, path: productPath(page.slug) }]} />
      <h1 className="text-3xl font-bold text-slate-900">{page.h1}</h1>
      <p className="mt-2 max-w-2xl text-lg text-slate-600">{page.lead}</p>
      <section aria-labelledby="gives-title" className="mt-8">
        <h2 id="gives-title" className="text-xl font-semibold text-slate-900">{P.gives}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">{page.gives.map((g) => <li key={g}>{g}</li>)}</ul>
      </section>
      <Steps id="how-title" heading={P.howHeading} steps={page.steps} />
      <section aria-labelledby="plan-title" className="mt-10">
        <h2 id="plan-title" className="text-xl font-semibold text-slate-900">{P.planHeading}</h2>
        <p className="mt-2 text-slate-700">{page.plan}</p>
      </section>
      <FaqList id="faq-title" heading={P.faqHeading} items={page.faq} />
      <section aria-labelledby="related-title" className="mt-10">
        <h2 id="related-title" className="text-xl font-semibold text-slate-900">{P.relatedHeading}</h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {related.map((r) => <li key={r.slug}><Link href={productPath(r.slug)} className="font-medium text-slate-900 underline">{r.name}</Link></li>)}
          <li><Link href="/product" className="font-medium text-slate-900 underline">{P.hubLink}</Link></li>
        </ul>
      </section>
      <CtaBox id="cta-title" heading={P.ctaHeading} links={[{ href: '/register', label: P.ctaPrimary }, { href: '/pricing', label: P.ctaSecondary }]} />
    </>
  );
}
