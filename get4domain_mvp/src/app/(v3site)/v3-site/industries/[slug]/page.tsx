import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import { assertV3Public } from '@/lib/v3-public/guard';
import { industryBySlug, industryDescription, industryTitle } from '@/lib/v3-public/industries';
import { categoriesOfPack, categoryPath } from '@/lib/v3-public/catalogue';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { breadcrumbLd, faqLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

const fill = (t: string, name: string, gives: string): string => t.replace(/\{name\}/g, name).replace(/\{gives\}/g, gives);

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
  const name = page.pack.name;
  const gives = page.pack.gives.map((g) => g.toLowerCase()).join(', ');
  const faq = S.faq.map((f) => ({ q: fill(f.q, name, gives), a: fill(f.a, name, gives) }));
  const mine = categoriesOfPack(page.pack.key);
  const path = `/industries/${page.slug}`;
  const crumbs = breadcrumbLd([{ name: SITE.crumbs.home, path: '/' }, { name: SITE.industries.h1, path: '/industries' }, { name, path }]);
  const register = `/register?pack=${page.pack.key}`;
  return (
    <>
      <JsonLd items={[faqLd(faq), ...(crumbs ? [crumbs] : [])]} />
      <nav aria-label={SITE.crumbs.label} className="mb-4 text-sm text-slate-600">
        <ol className="flex flex-wrap gap-2">
          <li><Link href="/" className="hover:underline">{SITE.crumbs.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/industries" className="hover:underline">{SITE.industries.h1}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{name}</li>
        </ol>
      </nav>
      <h1 className="text-3xl font-bold text-slate-900">{name}</h1>
      <p className="mt-2 text-slate-600">{SITE.home.lead}</p>
      <p className="mt-4"><Link href={register} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">{S.cta}</Link></p>

      <section aria-labelledby="gives-title" className="mt-10">
        <h2 id="gives-title" className="text-xl font-semibold text-slate-900">{S.givesHeading}</h2>
        <p className="mt-1 text-slate-600">{S.givesIntro}</p>
        <ul className="mt-3 grid list-disc gap-1 pl-5 text-slate-700 sm:grid-cols-2">{page.pack.gives.map((g) => <li key={g}>{g}</li>)}</ul>
      </section>

      <section aria-labelledby="suits-title" className="mt-10">
        <h2 id="suits-title" className="text-xl font-semibold text-slate-900">{S.suitsHeading}</h2>
        <ul className="mt-3 list-disc pl-5 text-slate-700">{page.suits.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>

      {mine.length > 0 ? (
        <section aria-labelledby="cats-title" className="mt-10">
          <h2 id="cats-title" className="text-xl font-semibold text-slate-900">{S.categoriesHeading}</h2>
          <p className="mt-1 text-slate-600">{MARKETING.packExtra.categoriesIntro}</p>
          <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 md:grid-cols-3">
            {mine.map((c) => <li key={c.id}><Link href={categoryPath(c)} className="text-slate-900 underline">{c.name}</Link></li>)}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="how-title" className="mt-10">
        <h2 id="how-title" className="text-xl font-semibold text-slate-900">{S.howHeading}</h2>
        <ol className="mt-3 space-y-3">
          {S.steps.map((st, i) => (
            <li key={st.title}><h3 className="font-medium text-slate-900">{i + 1}. {st.title}</h3><p className="text-slate-700">{st.body}</p></li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-slate-600">{S.note}</p>
      </section>

      <section aria-labelledby="faq-title" className="mt-10">
        <h2 id="faq-title" className="mb-3 text-xl font-semibold text-slate-900">{S.faqHeading}</h2>
        <dl className="space-y-4">{faq.map((f) => (<div key={f.q}><dt className="font-medium text-slate-900">{f.q}</dt><dd className="mt-1 text-slate-700">{f.a}</dd></div>))}</dl>
      </section>

      <section aria-labelledby="cta-title" className="mt-10 rounded-xl border border-slate-200 p-5">
        <h2 id="cta-title" className="text-xl font-semibold text-slate-900">{S.ctaHeading}</h2>
        <p className="mt-4 flex flex-wrap gap-3">
          <Link href={register} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">{S.cta}</Link>
          <Link href="/pricing" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-900">{S.pricingLink}</Link>
          <Link href="/industries" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-900">{S.hubLink}</Link>
        </p>
      </section>
    </>
  );
}
