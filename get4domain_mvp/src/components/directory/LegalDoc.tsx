import Link from 'next/link';
import { getFirm, gstinLine } from '@/lib/v3-public/firm';
import { LEGAL_DOC_KEYS, LEGAL_SLUGS, S, type LegalDocKey } from '@/lib/v3-public/strings';

interface Section { heading: string; body: readonly string[] }

/**
 * One legal page. The draft banner is always shown: these texts wait for counsel. The firm identity comes from one settings object;
 * the GSTIN line appears only when a GSTIN is set.
 */
export default function LegalDoc({ docKey }: { docKey: LegalDocKey }) {
  const doc = S.legal.docs[docKey];
  const firm = getFirm();
  const gstin = gstinLine(firm);
  return (
    <article className="max-w-3xl">
      <p role="note" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">{S.legal.draftBanner}</p>
      <h1 className="text-3xl font-bold text-slate-900">{doc.title}</h1>
      <p className="mt-2 text-slate-600">{doc.summary}</p>

      {(doc.sections as readonly Section[]).map((s) => (
        <section key={s.heading} className="mt-6">
          <h2 className="text-xl font-semibold text-slate-900">{s.heading}</h2>
          {s.body.map((p) => <p key={p} className="mt-2 text-slate-700">{p}</p>)}
        </section>
      ))}

      <section aria-labelledby="firm-title" className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 id="firm-title" className="text-lg font-semibold text-slate-900">{S.legal.firmHeading}</h2>
        <dl className="mt-2 space-y-1 text-sm">
          <div><dt className="inline font-medium text-slate-900">{S.legal.firmName}: </dt><dd className="inline text-slate-700">{firm.name}</dd></div>
          <div><dt className="inline font-medium text-slate-900">{S.legal.firmAddress}: </dt><dd className="inline text-slate-700">{firm.address}</dd></div>
          {gstin && <div><dt className="inline font-medium text-slate-900">{S.legal.firmGstin}: </dt><dd className="inline text-slate-700">{gstin}</dd></div>}
        </dl>
      </section>

      <nav aria-label={S.legal.index.label} className="mt-8 text-sm">
        <h2 className="font-semibold text-slate-900">{S.legal.otherDocs}</h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {LEGAL_DOC_KEYS.filter((k) => k !== docKey).map((k) => (
            <li key={k}><Link href={`/legal/${LEGAL_SLUGS[k]}`} className="text-primary-700 hover:underline">{S.legal.docs[k].title}</Link></li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
