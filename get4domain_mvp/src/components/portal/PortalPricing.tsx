'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btn, CARD } from '@/components/portal/ui';
import type { PortalPlanRow } from '@/lib/v3-public/portal-pricing';
import { annualSaving, billedLine, PER_MONTH, PORTAL, TERM_LABEL, termOption } from '@/lib/v3-public/portal-strings';

/**
 * The three tracks with the billing term switch. Prices arrive as text worked out on the server from the public price route (without GST); a plan with no price shows words, never a number.
 * "Save N% with annual" appears only when the saving is computed from two real prices. The button goes to register with the plan and term; no payment form here.
 */
export default function PortalPricing({ terms, plans, registerHref, tracks }: { terms: number[]; plans: PortalPlanRow[]; registerHref: string; tracks: Record<string, string> }) {
  // annual is the default whenever it is offered, otherwise the longest term there is
  const [term, setTerm] = useState<number>(terms.includes(12) ? 12 : (terms[terms.length - 1] ?? 12));
  const H = PORTAL.home;
  const savings = plans.map((p) => p.saving).filter((x): x is number => x !== null);
  // the dropdown names one saving for every plan, so it is the smallest real one (never more than a plan really saves)
  const optionSaving = savings.length > 0 ? Math.min(...savings) : null;
  const ordered = [...terms].sort((x, y) => y - x);
  const allPending = plans.length > 0 && plans.every((p) => p.pending);
  return (
    <div>
      <div className="mb-6">
        <label htmlFor="portal-term" className="mb-2 block text-sm font-medium text-slate-700">{TERM_LABEL}</label>
        <select
          id="portal-term"
          value={term}
          onChange={(e) => setTerm(Number(e.target.value))}
          className="min-h-[48px] w-full max-w-xs rounded-xl border border-slate-300 bg-white px-4 py-2 text-base font-semibold text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:w-auto"
        >
          {ordered.map((t) => <option key={t} value={t}>{termOption(H.terms[t] ?? String(t), t === 12 ? optionSaving : null)}</option>)}
        </select>
      </div>
      {allPending ? <p className="mb-4 rounded-xl bg-gold-50 px-4 py-3 text-sm font-medium text-gold-900">{H.pricesPending}</p> : null}
      <ul className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const total = p.prices[term] ?? null;
          const monthly = p.monthly[term] ?? null;
          return (
            <li key={p.key} className={`${CARD} flex flex-col p-6`}>
              <h3 className="text-lg font-bold text-ink-900">{p.name}</h3>
              <p className="mt-1 min-h-[2.5rem] text-sm text-slate-600">{tracks[p.name.toLowerCase()] ?? p.description ?? ''}</p>
              <div className="mt-4" aria-live="polite">
                {p.pending ? <p className="text-base font-medium text-slate-600">{H.pricesPending}</p>
                  : monthly && total ? (
                    <>
                      <p className="text-4xl font-bold text-ink-900">{monthly}<span className="ml-1 text-sm font-normal text-slate-600">{PER_MONTH}</span></p>
                      <p className="mt-1 text-sm text-slate-600">{billedLine(term, total)}</p>
                    </>
                  ) : <p className="text-base font-medium text-slate-600">{H.notOffered}</p>}
              </div>
              {term === 12 && p.saving !== null ? <p className="mt-1 text-sm font-semibold text-success-700">{annualSaving(p.saving)}</p> : <p className="mt-1 text-sm">&nbsp;</p>}
              <Link
                href={`${registerHref}?plan=${encodeURIComponent(p.key)}${p.pending || !total ? '' : `&term=${term}`}`}
                className={`${btn('primary')} mt-5`}
                aria-label={`${H.choose} ${p.name}, ${H.terms[term] ?? term}`}
              >
                {H.choose}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-slate-600">{H.gst}</p>
    </div>
  );
}
