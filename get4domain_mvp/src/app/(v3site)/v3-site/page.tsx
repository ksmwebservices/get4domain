import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import { assertV3Public } from '@/lib/v3-public/guard';
import { faqLd, organizationLd, webSiteLd } from '@/lib/v3-public/site-jsonld';
import { directoryOrigin, siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: SITE.home.metaTitle, description: SITE.home.metaDescription, path: '/' });
}

export default function HomePage() {
  assertV3Public();
  const H = SITE.home;
  const directory = directoryOrigin();
  return (
    <>
      <JsonLd items={[organizationLd(), webSiteLd(), faqLd(H.faq)]} />
      <h1 className="text-4xl font-bold text-slate-900">{H.h1}</h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-600">{H.lead}</p>
      <p className="mt-6 flex flex-wrap gap-3">
        <Link href="/register" className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">{H.ctaPrimary}</Link>
        <Link href="/pricing" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-900">{H.ctaSecondary}</Link>
      </p>

      <section aria-labelledby="steps-title" className="mt-12">
        <h2 id="steps-title" className="text-2xl font-semibold text-slate-900">{H.stepsHeading}</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {H.steps.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-500" aria-hidden="true">{i + 1}</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-700">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="plans-title" className="mt-12">
        <h2 id="plans-title" className="text-2xl font-semibold text-slate-900">{H.plansHeading}</h2>
        <p className="mt-2 text-slate-700">{H.plansBody}</p>
        <p className="mt-3"><Link href="/pricing" className="font-medium text-slate-900 underline">{H.ctaSecondary}</Link></p>
      </section>

      {directory ? (
        <section aria-labelledby="dir-title" className="mt-12">
          <h2 id="dir-title" className="text-2xl font-semibold text-slate-900">{H.directoryHeading}</h2>
          <p className="mt-2 text-slate-700">{H.directoryBody}</p>
          <p className="mt-3"><a href={directory} className="font-medium text-slate-900 underline">{H.directoryCta}</a></p>
        </section>
      ) : null}

      <section aria-labelledby="faq-title" className="mt-12">
        <h2 id="faq-title" className="text-2xl font-semibold text-slate-900">{H.faqHeading}</h2>
        <dl className="mt-4 space-y-4">{H.faq.map((f) => (<div key={f.q}><dt className="font-medium text-slate-900">{f.q}</dt><dd className="mt-1 text-slate-700">{f.a}</dd></div>))}</dl>
      </section>
    </>
  );
}
