import { priceLine, PRICING_TERMS, PriceLine } from '../public/public-pricing.shape';

/**
 * B6.2: the plans a vendor may be offered in the plan chooser. PURE: rows in, one answer out.
 *
 * The vendor's track is NOT read from the site (a vendor whose site failed has none). It is the track of the plan the vendor holds (a registration gives the track's Free plan), and when that is
 * missing, the minimum tier of the category chosen at registration. Only plans of that track are offered, and for each plan only the terms that have an APPROVED price already in force.
 * A price that is not approved, not started or not in rupees is never shown, and a term without one is left out (not shown as "pending").
 */
export interface PlanOptionRows {
  now: Date;
  /** the track of the plan the vendor holds (a Free plan counts), or null */
  heldTrack: string | null;
  /** the minimum tier of the category chosen at registration (any case), or null */
  categoryTier: string | null;
  plans: { id: string; key: string; track: string; level: string; name: string; description: string | null; status: string; isPublic: boolean; sortOrder: number }[];
  prices: { planId: string; termMonths: number; amountPaise: number; currency: string; taxInclusive: boolean; status: string; effectiveFrom: Date }[];
  tax: { name: string; ratePercent: number } | null;
}

export type PlanOptionsReason = 'TRACK_UNKNOWN' | 'NO_PLANS_FOR_TRACK' | 'NO_APPROVED_PRICE';
export interface PlanOptions {
  track: string | null;
  trackSource: 'PLAN' | 'CATEGORY' | null;
  plans: { key: string; name: string; track: string; description: string | null; terms: { termMonths: number; price: PriceLine; purchasable: boolean }[] }[];
  /** null when there is something to choose; otherwise why not, and `message` says it in plain words */
  reason: PlanOptionsReason | null;
  message: string | null;
}

const KNOWN = ['handyman', 'professional', 'ecommerce'];
const known = (t: string | null | undefined): string | null => { const x = t?.trim().toLowerCase() ?? ''; return KNOWN.includes(x) ? x : null; };

export const PLAN_OPTION_MESSAGES: Record<PlanOptionsReason, string> = {
  TRACK_UNKNOWN: 'We could not tell which plans fit your kind of business. Please contact support and we will sort it out.',
  NO_PLANS_FOR_TRACK: 'No paid plan has been set up for your kind of business yet.',
  NO_APPROVED_PRICE: 'The prices for your plans are not published yet. Please check back soon.',
};

export function shapePlanOptions(r: PlanOptionRows): PlanOptions {
  const held = known(r.heldTrack);
  const track = held ?? known(r.categoryTier);
  const trackSource: PlanOptions['trackSource'] = held ? 'PLAN' : track ? 'CATEGORY' : null;
  const empty = (reason: PlanOptionsReason): PlanOptions => ({ track, trackSource, plans: [], reason, message: PLAN_OPTION_MESSAGES[reason] });
  if (!track) return empty('TRACK_UNKNOWN');

  const now = r.now.getTime();
  const mine = r.plans.filter((p) => p.status === 'ACTIVE' && p.isPublic && p.level === 'PRO' && p.track.toLowerCase() === track).sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  if (mine.length === 0) return empty('NO_PLANS_FOR_TRACK');

  const plans = mine.map((p) => {
    const terms = PRICING_TERMS.flatMap((termMonths) => {
      const live = r.prices.filter((x) => x.planId === p.id && x.termMonths === termMonths && x.status === 'APPROVED' && x.effectiveFrom.getTime() <= now && x.currency === 'INR').sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
      const line = live ? priceLine(live, r.tax) : null;
      return line ? [{ termMonths, price: line, purchasable: line.totalMinor !== null }] : [];
    });
    return { key: p.key, name: p.name, track, description: p.description, terms };   // the track as the three lower-case words, whatever case the plan row stores
  }).filter((p) => p.terms.length > 0);
  return plans.length === 0 ? empty('NO_APPROVED_PRICE') : { track, trackSource, plans, reason: null, message: null };
}
