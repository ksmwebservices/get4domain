import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import PageHead from '@/components/portal/PageHead';
import { CtaBox, FaqList, Steps } from '@/components/site/Blocks';
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
      <PageHead crumbs={[{ name: P.crumb, path: '/product' }, { name: page.name, path: productPath(page.slug) }]} h1={page.h1} lead={page.lead} actions={<><Link href="/register" className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2">{P.ctaPrimary}</Link><Link href="/pricing" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2">{P.ctaSecondary}</Link></>} />
      <section aria-labelledby="gives-title" className="pt-10">
        <h2 id="gives-title" className="text-2xl font-bold tracking-tight text-ink-900">{P.gives}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">{page.gives.map((g) => <li key={g}>{g}</li>)}</ul>
      </section>
      <Steps id="how-title" heading={P.howHeading} steps={page.steps} />
      <section aria-labelledby="plan-title" className="mt-10">
        <h2 id="plan-title" className="text-2xl font-bold tracking-tight text-ink-900">{P.planHeading}</h2>
        <p className="mt-2 text-slate-700">{page.plan}</p>
      </section>
      <FaqList id="faq-title" heading={P.faqHeading} items={page.faq} />
      <section aria-labelledby="related-title" className="mt-10">
        <h2 id="related-title" className="text-2xl font-bold tracking-tight text-ink-900">{P.relatedHeading}</h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {related.map((r) => <li key={r.slug}><Link href={productPath(r.slug)} className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800">{r.name}</Link></li>)}
          <li><Link href="/product" className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800">{P.hubLink}</Link></li>
        </ul>
      </section>
      <CtaBox id="cta-title" heading={P.ctaHeading} links={[{ href: '/register', label: P.ctaPrimary }, { href: '/pricing', label: P.ctaSecondary }]} />
    </>
  );
}
