import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import { FaqList } from '@/components/site/Blocks';
import Crumbs from '@/components/site/Crumbs';
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
      <Crumbs here={W.h1} path="/how-it-works" />
      <h1 className="text-3xl font-bold text-slate-900">{W.h1}</h1>
      <section aria-labelledby="who-title" className="mt-4">
        <h2 id="who-title" className="text-xl font-semibold text-slate-900">{X.whoHeading}</h2>
        <p className="mt-2 max-w-3xl text-slate-700">{X.whoBody}</p>
      </section>
      <section aria-labelledby="steps-title" className="mt-8">
        <h2 id="steps-title" className="text-xl font-semibold text-slate-900">{X.stepsHeading}</h2>
        <ol className="mt-4 space-y-5">
          {W.steps.map((s) => (<li key={s.title}><h3 className="text-lg font-semibold text-slate-900">{s.title}</h3><p className="mt-1 text-slate-700">{s.body}</p></li>))}
        </ol>
      </section>
      <section aria-labelledby="after-title" className="mt-10">
        <h2 id="after-title" className="text-xl font-semibold text-slate-900">{X.afterHeading}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">{X.after.map((a) => <li key={a}>{a}</li>)}</ul>
      </section>
      <p className="mt-8 text-sm text-slate-600">{W.note}</p>
      <p className="mt-6"><Link href="/register" className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">{W.cta}</Link></p>
      <FaqList id="faq-title" heading={X.faqHeading} items={X.faq} />
      <section aria-labelledby="more-title" className="mt-10">
        <h2 id="more-title" className="text-xl font-semibold text-slate-900">{X.moreHeading}</h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">{X.moreLinks.map((l) => <li key={l.path}><Link href={l.path} className="font-medium text-slate-900 underline">{l.label}</Link></li>)}</ul>
      </section>
    </>
  );
}
