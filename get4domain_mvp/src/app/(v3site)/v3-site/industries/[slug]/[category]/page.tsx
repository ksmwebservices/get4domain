import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import { CtaBox, FaqList, Steps } from '@/components/site/Blocks';
import Trail from '@/components/site/Trail';
import { categoriesOfPack, categoryPage, categoryPath } from '@/lib/v3-public/catalogue';
import { assertV3Public } from '@/lib/v3-public/guard';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
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
  return (
    <>
      <JsonLd items={[faqLd(faq)]} />
      <Trail items={[{ name: SITE.industries.h1, path: '/industries' }, { name: packName, path: packPath }, { name: category.name, path: categoryPath(category) }]} />
      <h1 className="text-3xl font-bold text-slate-900">{category.name} website</h1>
      <p className="mt-2 max-w-2xl text-lg text-slate-600">{fill(C.lead, vars)}</p>
      <p className="mt-1 text-sm text-slate-600">{fill(C.groupLine, vars)}</p>
      <p className="mt-4"><Link href={register} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">{C.cta}</Link></p>

      <section aria-labelledby="gives-title" className="mt-10">
        <h2 id="gives-title" className="text-xl font-semibold text-slate-900">{C.givesHeading}</h2>
        <p className="mt-1 text-slate-600">{fill(C.givesIntro, vars)}</p>
        <ul className="mt-3 grid list-disc gap-1 pl-5 text-slate-700 sm:grid-cols-2">{industry.pack.gives.map((g) => <li key={g}>{g}</li>)}</ul>
      </section>

      <Steps id="how-title" heading={C.howHeading} steps={C.steps.map((s) => ({ title: s.title, body: fill(s.body, vars) }))} />
      <p className="mt-3 text-sm text-slate-600">{C.note}</p>

      <FaqList id="faq-title" heading={C.faqHeading} items={faq} />

      {others.length > 0 ? (
        <section aria-labelledby="more-title" className="mt-10">
          <h2 id="more-title" className="text-xl font-semibold text-slate-900">{fill(C.moreHeading, vars)}</h2>
          <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 md:grid-cols-3">
            {others.map((c) => <li key={c.id}><Link href={categoryPath(c)} className="text-slate-900 underline">{c.name}</Link></li>)}
          </ul>
        </section>
      ) : null}

      <CtaBox id="cta-title" heading={C.ctaHeading} links={[{ href: register, label: C.cta }, { href: packPath, label: fill(C.packLink, vars) }, { href: '/pricing', label: C.pricingLink }]} />
    </>
  );
}
