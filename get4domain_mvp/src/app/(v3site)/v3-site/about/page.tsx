import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import PageHead from '@/components/portal/PageHead';
import { ABOUT_STRINGS as A } from '@/lib/v3-public/company-strings';
import { getFirmFacts } from '@/lib/v3-public/firm-facts';
import { assertV3Public } from '@/lib/v3-public/guard';
import { LEGAL_DOCS } from '@/lib/v3-public/legal-strings';
import { firmOrganizationLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: A.metaTitle, description: A.metaDescription, path: A.path });
}

/** About Us: what Get4Domain is and who operates it, from the decided facts only. The Organization block is written from the firm facts. */
export default async function AboutPage() {
  assertV3Public();
  const facts = await getFirmFacts();
  return (
    <>
      <JsonLd items={[firmOrganizationLd(facts)]} />
      <PageHead crumbs={[{ name: A.h1, path: A.path }]} h1={A.h1} lead={A.intro} />
      <article className="max-w-3xl pt-2">
        {A.sections.map((s) => (
          <section key={s.id} aria-labelledby={`${s.id}-h`} className="mt-8">
            <h2 id={`${s.id}-h`} className="text-2xl font-bold tracking-tight text-ink-900">{s.heading}</h2>
            {s.paragraphs?.map((p) => <p key={p} className="mt-2 text-slate-700">{p}</p>)}
            {s.bullets?.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul> : null}
          </section>
        ))}
        <p className="mt-4 text-slate-700">{facts.legalName}, {facts.address}.</p>
        <section aria-labelledby="policies-h" className="mt-8">
          <h2 id="policies-h" className="text-2xl font-bold tracking-tight text-ink-900">{A.policiesHeading}</h2>
          <p className="mt-2 text-slate-700">{A.policiesIntro}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {LEGAL_DOCS.map((d) => <li key={d.path}><Link href={d.path} className="text-brand-700 underline underline-offset-2 hover:text-brand-800">{d.title}</Link></li>)}
            <li><Link href="/contact" className="text-brand-700 underline underline-offset-2 hover:text-brand-800">{A.contactLink}</Link></li>
          </ul>
        </section>
      </article>
    </>
  );
}
