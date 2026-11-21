import type { Metadata } from 'next';
import JsonLd from '@/components/directory/JsonLd';
import PageHead from '@/components/portal/PageHead';
import GrievanceBlock from '@/components/site/GrievanceBlock';
import { CONTACT_STRINGS as C } from '@/lib/v3-public/company-strings';
import { firmRows, getFirmFacts } from '@/lib/v3-public/firm-facts';
import { assertV3Public } from '@/lib/v3-public/guard';
import { LEGAL_UI } from '@/lib/v3-public/legal-strings';
import { firmOrganizationLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: C.metaTitle, description: C.metaDescription, path: C.path });
}

/**
 * Contact: the company details and the support and grievance contact fields from the firm facts (the public firm route and one config module).
 * A value that is empty prints nothing; the grievance officer section exists only when some grievance value is set.
 */
export default async function ContactPage() {
  assertV3Public();
  const f = await getFirmFacts();
  const rows = firmRows(f, LEGAL_UI.rows);
  const hasSupport = !!(f.supportEmail || f.supportPhone);
  return (
    <>
      <JsonLd items={[firmOrganizationLd(f)]} />
      <PageHead crumbs={[{ name: C.h1, path: C.path }]} h1={C.h1} lead={C.intro} />
      <article className="max-w-3xl pt-2">

        <section aria-labelledby="help-h" className="mt-8">
          <h2 id="help-h" className="text-2xl font-bold tracking-tight text-ink-900">{C.helpHeading}</h2>
          <p className="mt-2 text-slate-700">{C.accountHelp} {hasSupport ? C.otherHelpWithDetails : C.otherHelpNoDetails}</p>
        </section>

        <section aria-labelledby="details-h" className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 id="details-h" className="text-lg font-bold text-ink-900">{C.detailsHeading}</h2>
          <dl className="mt-2 space-y-1 text-sm">
            {rows.map((r) => (
              <div key={r.key}>
                <dt className="inline font-semibold text-ink-900">{r.label}: </dt>
                <dd className="inline text-slate-700">{r.href ? <a href={r.href} className="underline">{r.value}</a> : r.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="payments-h" className="mt-8">
          <h2 id="payments-h" className="text-2xl font-bold tracking-tight text-ink-900">{C.paymentsHeading}</h2>
          <p className="mt-2 text-slate-700">{C.paymentsBody}</p>
        </section>

        <section aria-labelledby="requests-h" className="mt-8">
          <h2 id="requests-h" className="text-2xl font-bold tracking-tight text-ink-900">{C.requestsHeading}</h2>
          <p className="mt-2 text-slate-700">{C.requestsBody}</p>
        </section>

        <GrievanceBlock facts={f} />
      </article>
    </>
  );
}
