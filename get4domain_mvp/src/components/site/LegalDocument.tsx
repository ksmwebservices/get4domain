import Link from 'next/link';
import Crumbs from '@/components/site/Crumbs';
import GrievanceBlock from '@/components/site/GrievanceBlock';
import type { FirmFacts } from '@/lib/v3-public/firm-facts';
import { firmRows } from '@/lib/v3-public/firm-facts';
import { formatEffectiveDate, LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, type LegalDocDef } from '@/lib/v3-public/legal-meta';
import { LEGAL_DOCS, LEGAL_UI } from '@/lib/v3-public/legal-strings';

/**
 * The shared layout of every policy page: one H1, effective date and version from one constant, a table of contents of the headings, the sections,
 * the company details (a row is printed only when it has a value) and links to the other policies. Server rendered, print friendly (the page shell is hidden when printing).
 */
export default function LegalDocument({ doc, facts }: { doc: LegalDocDef; facts: FirmFacts }) {
  const rows = firmRows(facts, LEGAL_UI.rows);
  const others = LEGAL_DOCS.filter((d) => d.path !== doc.path);
  return (
    <>
      <div className="print:hidden"><Crumbs here={doc.title} path={doc.path} /></div>
      <article className="max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-900">{doc.title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {LEGAL_UI.effective}: <time dateTime={LEGAL_EFFECTIVE_DATE}>{formatEffectiveDate()}</time>
          <span aria-hidden="true"> · </span>
          {LEGAL_UI.version}: {LEGAL_VERSION}
        </p>
        <p className="mt-4 text-slate-700">{doc.intro}</p>

        <nav aria-label={LEGAL_UI.contentsNavLabel} className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm print:hidden">
          <h2 className="font-semibold text-slate-900">{LEGAL_UI.contents}</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {doc.sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-slate-700 underline">{s.heading}</a></li>)}
          </ol>
        </nav>

        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-8 scroll-mt-4 print:break-inside-avoid">
            <h2 id={`${s.id}-h`} className="text-xl font-semibold text-slate-900">{s.heading}</h2>
            {s.paragraphs?.map((p) => <p key={p} className="mt-2 text-slate-700">{p}</p>)}
            {s.bullets?.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul> : null}
          </section>
        ))}

        {doc.showGrievance ? <GrievanceBlock facts={facts} /> : null}

        {rows.length ? (
          <section aria-labelledby="company-h" className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 id="company-h" className="text-lg font-semibold text-slate-900">{LEGAL_UI.companyHeading}</h2>
            <dl className="mt-2 space-y-1 text-sm">
              {rows.map((r) => (
                <div key={r.key}>
                  <dt className="inline font-medium text-slate-900">{r.label}: </dt>
                  <dd className="inline text-slate-700">{r.href ? <a href={r.href} className="underline">{r.value}</a> : r.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {others.length ? (
          <nav aria-label={LEGAL_UI.policiesNavLabel} className="mt-8 text-sm print:hidden">
            <h2 className="font-semibold text-slate-900">{LEGAL_UI.otherPolicies}</h2>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {others.map((d) => <li key={d.path}><Link href={d.path} className="text-slate-700 underline">{d.title}</Link></li>)}
            </ul>
          </nav>
        ) : null}
      </article>
    </>
  );
}
