import {
  WORKSPACE_AI_CREDIT_PAISE, BOS_AI_CREDIT_PAISE,
  WORKSPACE_FREE_SEO_KEYWORDS, BOS_FREE_SEO_KEYWORDS,
  WORKSPACE_THEME_CHANGE_LIMIT, BOS_THEME_CHANGE_LIMIT,
} from '../payments/plan-pricing.constants';

/**
 * What each plan entitles a vendor to. Derived from `planKey` ONLY — never from price, discount,
 * billing cycle or how the invoice was paid. A ₹1 deal on BOS is still a BOS vendor.
 */
export type PlanKey = 'WORKSPACE' | 'BOS';

export interface Entitlements {
  /** One-time AI Studio wallet credit, granted exactly once per vendor. */
  aiCreditPaise: number;
  /** Free SEO keywords included. */
  seoKeywords: number;
  /** Theme/website customisations per 12 months. */
  themeChangesPerYear: number;
  whatsappBotReply: boolean;
  fullAccounting: boolean;
  hrm: boolean;
  inventory: boolean;
  taskManagement: boolean;
}

export const ENTITLEMENTS: Record<PlanKey, Entitlements> = {
  WORKSPACE: {
    aiCreditPaise: WORKSPACE_AI_CREDIT_PAISE, seoKeywords: WORKSPACE_FREE_SEO_KEYWORDS, themeChangesPerYear: WORKSPACE_THEME_CHANGE_LIMIT,
    whatsappBotReply: false, fullAccounting: false, hrm: false, inventory: false, taskManagement: false,
  },
  BOS: {
    aiCreditPaise: BOS_AI_CREDIT_PAISE, seoKeywords: BOS_FREE_SEO_KEYWORDS, themeChangesPerYear: BOS_THEME_CHANGE_LIMIT,
    whatsappBotReply: true, fullAccounting: true, hrm: true, inventory: true, taskManagement: true,
  },
};

export function entitlementsFor(planKey: PlanKey): Entitlements {
  const e = ENTITLEMENTS[planKey];
  if (!e) throw new RangeError(`Unknown plan key: ${String(planKey)}`);
  return e;
}

/** Number of distinct keywords in a free-text SEO keywords field ("a, b, c"). */
export function countSeoKeywords(raw: string | null | undefined): number {
  if (!raw) return 0;
  return new Set(raw.split(/[,\n;]/).map((k) => k.trim().toLowerCase()).filter(Boolean)).size;
}
