'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SITE } from '@/lib/v3-public/site-strings';

/** What the server worked out for one plan: the net price text per term (null = not offered for that term), and whether no price is set for any term. */
export interface PlanRow { key: string; name: string; description: string | null; prices: Record<number, string | null>; pending: boolean }

/**
 * The plan cards with the billing term switch. Prices arrive as text already formatted without GST; a pending plan shows words and never a number.
 * Every call to action goes to register with the plan and the term in the address. No payment form here: payment happens only inside the business app.
 */
export default function PricingPlans({ terms, plans }: { terms: number[]; plans: PlanRow[] }) {
  const [term, setTerm] = useState<number>(terms[terms.length - 1] ?? 12);
  const P = SITE.pricing;
  return (
    <div>
      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-medium text-slate-700">{P.termLegend}</legend>
        <div className="flex flex-wrap gap-2">
          {terms.map((t) => (
            <label key={t} className={`cursor-pointer rounded-lg border px-4 py-2 text-sm focus-within:ring-2 focus-within:ring-slate-900 ${term === t ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-800'}`}>
              <input type="radio" name="term" value={t} checked={term === t} onChange={() => setTerm(t)} className="sr-only" />
              {P.terms[t] ?? String(t)}
            </label>
          ))}
        </div>
      </fieldset>
      <ul className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const text = plan.prices[term] ?? null;
          return (
            <li key={plan.key} className="flex flex-col rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
              {plan.description ? <p className="mt-1 text-sm text-slate-600">{plan.description}</p> : null}
              <p className="mt-4 text-2xl font-bold text-slate-900" aria-live="polite">
                {plan.pending ? <span className="text-base font-medium text-slate-600">{P.pending}</span> : text ? <>{text}<span className="ml-1 text-sm font-normal text-slate-600">{P.billed} {P.terms[term]?.toLowerCase()}</span></> : <span className="text-base font-medium text-slate-600">{P.noTermPrice}</span>}
              </p>
              <p className="mt-1 text-xs text-slate-500">{P.gstLine}</p>
              <Link
                href={plan.pending || !text ? `/register?plan=${encodeURIComponent(plan.key)}` : `/register?plan=${encodeURIComponent(plan.key)}&term=${term}`}
                className="mt-5 inline-block rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white"
                aria-label={P.perPlan.replace('{plan}', plan.name).replace('{term}', P.terms[term] ?? String(term))}
              >
                {P.planCta}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
