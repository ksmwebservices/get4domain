import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import PageHead from '@/components/portal/PageHead';
import { FaqList } from '@/components/site/Blocks';
import { assertV3Public } from '@/lib/v3-public/guard';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { faqLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: SITE.how.metaTitle, description: SITE.how.metaDescription, path: '/how-it-works' });
}

export default function HowItWorksPage() {
  assertV3Public();
  const W = SITE.how;
  const X = MARKETING.how;
  return (
    <>
      <JsonLd items={[faqLd(X.faq)]} />
      <PageHead crumbs={[{ name: W.h1, path: '/how-it-works' }]} h1={W.h1} lead={X.whoBody} />
      <section aria-labelledby="who-title" className="sr-only">
        <h2 id="who-title" className="text-2xl font-bold tracking-tight text-ink-900">{X.whoHeading}</h2>
        <p className="mt-2 max-w-3xl text-slate-700">{X.whoBody}</p>
      </section>
      <section aria-labelledby="steps-title" className="pt-10">
        <h2 id="steps-title" className="text-2xl font-bold tracking-tight text-ink-900">{X.stepsHeading}</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {W.steps.map((s, i) => (<li key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"><span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span><h3 className="mt-4 text-lg font-bold text-ink-900">{s.title}</h3><p className="mt-2 text-sm text-slate-700">{s.body}</p></li>))}
        </ol>
      </section>
      <section aria-labelledby="after-title" className="mt-10">
        <h2 id="after-title" className="text-2xl font-bold tracking-tight text-ink-900">{X.afterHeading}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">{X.after.map((a) => <li key={a}>{a}</li>)}</ul>
      </section>
      <p className="mt-8 text-sm text-slate-600">{W.note}</p>
      <p className="mt-6"><Link href="/register" className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2">{W.cta}</Link></p>
      <FaqList id="faq-title" heading={X.faqHeading} items={X.faq} />
      <section aria-labelledby="more-title" className="mt-10">
        <h2 id="more-title" className="text-2xl font-bold tracking-tight text-ink-900">{X.moreHeading}</h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">{X.moreLinks.map((l) => <li key={l.path}><Link href={l.path} className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800">{l.label}</Link></li>)}</ul>
      </section>
    </>
  );
}
