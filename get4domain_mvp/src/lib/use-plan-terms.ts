'use client';

import { useEffect, useState } from 'react';
import { PLAN_TERMS, applyLivePricing, fetchLivePricing, formatINR, gstOn, totalWithGst, type PlanTerm, type LivePricing } from '@/lib/pricing';

/**
 * Plan prices for the dashboard, from the admin-managed live pricing (GET /pricing) with the lib/pricing.ts defaults until it answers.
 * Every price a vendor reads in the dashboard comes from here, so a price changed by KSM in admin changes everywhere at once (Bug B3).
 */
export function usePlanTerms(): { workspace: PlanTerm; bos: PlanTerm; live: LivePricing | null } {
  const [live, setLive] = useState<LivePricing | null>(null);
  useEffect(() => { let on = true; fetchLivePricing().then((l) => { if (on) setLive(l); }); return () => { on = false; }; }, []);
  const t = live ? applyLivePricing(live) : PLAN_TERMS;
  return { workspace: t.workspace, bos: t.bos, live };
}

/** "₹999/month" for a plan, as the vendor reads it. */
export const perMonth = (p: PlanTerm): string => `${p.headline}${p.headlinePeriod}`;
/** The GST-inclusive yearly total, "₹14,146". */
export const yearlyWithGst = (p: PlanTerm): string => formatINR(totalWithGst(p.baseAmount));
/** The exact GST-inclusive yearly total with paise, "₹14,145.84", as the checkout charges it. */
export const exactYearlyTotal = (p: PlanTerm): string => `₹${(Math.round(p.baseAmount * 118) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export { formatINR, gstOn, totalWithGst };
