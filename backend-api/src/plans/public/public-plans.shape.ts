/**
 * The public plan comparison, shaped from table rows. PURE. Only what a visitor may see: ACTIVE public plans, APPROVED prices that have started
 * (the latest per term), and the plan-feature rows that are not HIDDEN. No ids, statuses, settings, overrides or timestamps leave this function.
 */
export interface PublicPlanRows {
  now: Date;
  plans: { id: string; key: string; track: string; level: string; name: string; description: string | null; status: string; isPublic: boolean; sortOrder: number }[];
  prices: { id: string; planId: string; termMonths: number; amountPaise: number; currency: string; taxInclusive: boolean; status: string; effectiveFrom: Date }[];
  cells: { planId: string; featureKey: string; state: string; limitValue: number | null; enumValue: string | null; upsellText: string | null }[];
  features: { key: string; name: string; group: string; kind: string; unit: string | null; sortOrder: number }[];
  tax: { name: string; ratePercent: number } | null;
  allowMonthly: boolean;
}

export interface PublicPlans {
  plans: {
    key: string; track: string; level: string; name: string; description: string | null;
    prices: { termMonths: number; amountPaise: number; currency: string; taxInclusive: boolean }[];
    features: { key: string; name: string; group: string; kind: string; unit: string | null; state: string; limit: number | null; enumValue: string | null; upsellText: string | null }[];
  }[];
  terms: number[];
  tax: { name: string; ratePercent: number } | null;
}

export function shapePublicPlans(r: PublicPlanRows): PublicPlans {
  const terms = r.allowMonthly ? [1, 3, 6, 12] : [3, 6, 12];
  const featureByKey = new Map(r.features.map((f) => [f.key, f]));
  const plans = r.plans
    .filter((p) => p.status === 'ACTIVE' && p.isPublic)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
    .map((p) => {
      const latest = new Map<number, PublicPlanRows['prices'][number]>();
      for (const pr of r.prices) {
        if (pr.planId !== p.id || pr.status !== 'APPROVED' || pr.effectiveFrom.getTime() > r.now.getTime() || !terms.includes(pr.termMonths)) continue;
        const cur = latest.get(pr.termMonths);
        if (!cur || pr.effectiveFrom.getTime() > cur.effectiveFrom.getTime()) latest.set(pr.termMonths, pr);
      }
      const prices = [...latest.values()].sort((a, b) => a.termMonths - b.termMonths).map((x) => ({ termMonths: x.termMonths, amountPaise: x.amountPaise, currency: x.currency, taxInclusive: x.taxInclusive }));
      const features = r.cells
        .filter((c) => c.planId === p.id && c.state !== 'HIDDEN' && featureByKey.has(c.featureKey))
        .map((c) => ({ c, f: featureByKey.get(c.featureKey)! }))
        .sort((a, b) => a.f.sortOrder - b.f.sortOrder || a.f.key.localeCompare(b.f.key))
        .map(({ c, f }) => ({ key: f.key, name: f.name, group: f.group, kind: f.kind, unit: f.unit, state: c.state, limit: c.limitValue, enumValue: c.enumValue, upsellText: c.upsellText }));
      return { key: p.key, track: p.track, level: p.level, name: p.name, description: p.description, prices, features };
    });
  return { plans, terms, tax: r.tax };
}
