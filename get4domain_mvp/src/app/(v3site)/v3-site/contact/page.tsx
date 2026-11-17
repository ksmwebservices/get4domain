import type { Metadata } from 'next';
import Crumbs from '@/components/site/Crumbs';
import JsonLd from '@/components/directory/JsonLd';
import { CONTACT_STRINGS as C } from '@/lib/v3-public/company-strings';
import { firmRows, getFirmFacts, hasGrievanceContact } from '@/lib/v3-public/firm-facts';
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
  const grievance = [
    { key: 'name', label: C.grievanceLabels.name, value: f.grievanceName, href: undefined as string | undefined },
    { key: 'email', label: C.grievanceLabels.email, value: f.grievanceEmail, href: f.grievanceEmail ? `mailto:${f.grievanceEmail}` : undefined },
    { key: 'phone', label: C.grievanceLabels.phone, value: f.grievancePhone, href: f.grievancePhone ? `tel:${f.grievancePhone.replace(/[^0-9+]/g, '')}` : undefined },
  ].filter((r) => r.value);
  return (
    <>
      <JsonLd items={[firmOrganizationLd(f)]} />
      <Crumbs here={C.h1} path={C.path} />
      <article className="max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-900">{C.h1}</h1>
        <p className="mt-4 text-slate-700">{C.intro}</p>

        <section aria-labelledby="help-h" className="mt-8">
          <h2 id="help-h" className="text-xl font-semibold text-slate-900">{C.helpHeading}</h2>
          <p className="mt-2 text-slate-700">{C.accountHelp} {hasSupport ? C.otherHelpWithDetails : C.otherHelpNoDetails}</p>
        </section>

        <section aria-labelledby="details-h" className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 id="details-h" className="text-lg font-semibold text-slate-900">{C.detailsHeading}</h2>
          <dl className="mt-2 space-y-1 text-sm">
            {rows.map((r) => (
              <div key={r.key}>
                <dt className="inline font-medium text-slate-900">{r.label}: </dt>
                <dd className="inline text-slate-700">{r.href ? <a href={r.href} className="underline">{r.value}</a> : r.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="payments-h" className="mt-8">
          <h2 id="payments-h" className="text-xl font-semibold text-slate-900">{C.paymentsHeading}</h2>
          <p className="mt-2 text-slate-700">{C.paymentsBody}</p>
        </section>

        <section aria-labelledby="requests-h" className="mt-8">
          <h2 id="requests-h" className="text-xl font-semibold text-slate-900">{C.requestsHeading}</h2>
          <p className="mt-2 text-slate-700">{C.requestsBody}</p>
        </section>

        {hasGrievanceContact(f) ? (
          <section aria-labelledby="grievance-h" className="mt-8 rounded-xl border border-slate-200 p-4">
            <h2 id="grievance-h" className="text-xl font-semibold text-slate-900">{C.grievanceHeading}</h2>
            <p className="mt-2 text-slate-700">{C.grievanceBody}</p>
            <dl className="mt-2 space-y-1 text-sm">
              {grievance.map((r) => (
                <div key={r.key}>
                  <dt className="inline font-medium text-slate-900">{r.label}: </dt>
                  <dd className="inline text-slate-700">{r.href ? <a href={r.href} className="underline">{r.value}</a> : r.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </article>
    </>
  );
}
