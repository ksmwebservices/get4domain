import { netAmountPaise, priceFor, formatRupees, PUBLIC_TERMS, type PublicPlan, type PublicPlans } from './plans';

/** What the server works out for one plan card: the price text per term (null = not offered for that term), whether no price is set at all, and the annual saving when it is real. */
export interface PortalPlanRow { key: string; name: string; description: string | null; prices: Record<number, string | null>; pending: boolean; saving: number | null }

/**
 * The whole percentage by which one annual price is below four quarterly prices, from the public price route only. null unless both prices exist and the annual one is lower:
 * a number is never written by hand and never shown when it cannot be worked out.
 */
export function annualSavingPercent(plan: PublicPlan, tax: PublicPlans['tax']): number | null {
  const q = plan.prices.find((p) => p.termMonths === 3);
  const y = plan.prices.find((p) => p.termMonths === 12);
  const qn = q ? netAmountPaise(q, tax) : null;
  const yn = y ? netAmountPaise(y, tax) : null;
  if (qn === null || yn === null) return null;
  const pct = Math.round((1 - yn / (qn * 4)) * 100);
  return pct > 0 && pct < 100 ? pct : null;
}

export function portalPlanRows(data: PublicPlans): PortalPlanRow[] {
  return data.plans.map((p) => {
    const prices: Record<number, string | null> = {};
    for (const t of PUBLIC_TERMS) {
      const { paise } = priceFor(p, t, data.tax);
      prices[t] = paise === null ? null : formatRupees(paise);
    }
    const pending = !p.prices.some((x) => PUBLIC_TERMS.includes(x.termMonths) && netAmountPaise(x, data.tax) !== null);
    return { key: p.key, name: p.name, description: p.description, prices, pending, saving: annualSavingPercent(p, data.tax) };
  });
}
