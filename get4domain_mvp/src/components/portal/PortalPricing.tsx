'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btn, CARD } from '@/components/portal/ui';
import type { PortalPlanRow } from '@/lib/v3-public/portal-pricing';
import { annualSaving, PORTAL } from '@/lib/v3-public/portal-strings';

/**
 * The three tracks with the billing term switch. Prices arrive as text worked out on the server from the public price route (without GST); a plan with no price shows words, never a number.
 * "Save N% with annual" appears only when the saving is computed from two real prices. The button goes to register with the plan and term; no payment form here.
 */
export default function PortalPricing({ terms, plans, registerHref, tracks }: { terms: number[]; plans: PortalPlanRow[]; registerHref: string; tracks: Record<string, string> }) {
  const [term, setTerm] = useState<number>(terms[terms.length - 1] ?? 12);
  const H = PORTAL.home;
  const anySaving = plans.some((p) => p.saving !== null);
  const allPending = plans.length > 0 && plans.every((p) => p.pending);
  return (
    <div>
      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-medium text-slate-700">{H.termLegend}</legend>
        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {terms.map((t) => (
            <label key={t} className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold focus-within:ring-2 focus-within:ring-brand-600 ${term === t ? 'bg-white text-brand-700 shadow-card' : 'text-slate-700'}`}>
              <input type="radio" name="portal-term" value={t} checked={term === t} onChange={() => setTerm(t)} className="sr-only" />
              {H.terms[t] ?? String(t)}
              {t === 12 && anySaving ? <span aria-hidden="true" className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 text-xs text-gold-800">{annualSaving(Math.max(...plans.map((p) => p.saving ?? 0)))}</span> : null}
            </label>
          ))}
        </div>
      </fieldset>
      {allPending ? <p className="mb-4 rounded-xl bg-gold-50 px-4 py-3 text-sm font-medium text-gold-900">{H.pricesPending}</p> : null}
      <ul className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const text = p.prices[term] ?? null;
          return (
            <li key={p.key} className={`${CARD} flex flex-col p-6`}>
              <h3 className="text-lg font-bold text-ink-900">{p.name}</h3>
              <p className="mt-1 min-h-[2.5rem] text-sm text-slate-600">{tracks[p.name.toLowerCase()] ?? p.description ?? ''}</p>
              <p className="mt-4 text-3xl font-bold text-ink-900" aria-live="polite">
                {p.pending ? <span className="text-base font-medium text-slate-600">{H.pricePending}</span>
                  : text ? <>{text}<span className="ml-1 text-sm font-normal text-slate-600">{H.terms[term]?.toLowerCase()}</span></>
                  : <span className="text-base font-medium text-slate-600">{H.notOffered}</span>}
              </p>
              {term === 12 && p.saving !== null ? <p className="mt-1 text-sm font-semibold text-success-700">{annualSaving(p.saving)}</p> : <p className="mt-1 text-sm">&nbsp;</p>}
              <Link
                href={`${registerHref}?plan=${encodeURIComponent(p.key)}${p.pending || !text ? '' : `&term=${term}`}`}
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
