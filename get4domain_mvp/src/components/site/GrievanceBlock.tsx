import { CONTACT_STRINGS as C } from '@/lib/v3-public/company-strings';
import type { FirmFacts } from '@/lib/v3-public/firm-facts';
import { grievanceRows, hasGrievanceContact } from '@/lib/v3-public/firm-facts';

/**
 * The grievance officer block (name, email, phone and the timelines). Shared by the Contact page and by the policy pages that carry it (Terms, Refund).
 * Prints nothing when no grievance value is set, and a row only when it has a value.
 */
export default function GrievanceBlock({ facts }: { facts: FirmFacts }) {
  if (!hasGrievanceContact(facts)) return null;
  const rows = grievanceRows(facts, C.grievanceLabels);
  return (
    <section aria-labelledby="grievance-h" className="mt-8 rounded-xl border border-slate-200 p-4">
      <h2 id="grievance-h" className="text-xl font-semibold text-slate-900">{C.grievanceHeading}</h2>
      <p className="mt-2 text-slate-700">{C.grievanceBody}</p>
      <dl className="mt-2 space-y-1 text-sm">
        {rows.map((r) => (
          <div key={r.key}>
            <dt className="inline font-medium text-slate-900">{r.label}: </dt>
            <dd className="inline text-slate-700">{r.href ? <a href={r.href} className="underline">{r.value}</a> : r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
