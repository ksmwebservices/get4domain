// Single source of truth for plan pricing across the marketing pricing card,
// the /pricing page and the dashboard checkout disclosure.
//
// Billing structure (dispatch 26-Aug-2026, Phase 1): the former "monthly" plan
// is now billed QUARTERLY (quarterly fully replaces standalone single-month —
// confirmed with KSM 27-Aug-2026). It is always shown as "₹999/month, billed
// quarterly" — never the bare ₹999 alone. Prices are GST-EXCLUSIVE; 18% GST is
// added on top at checkout, matching the platform's GST-exclusive convention.

export const GST_RATE = 0.18;

export interface PlanTerm {
  key: 'quarterly' | 'yearly';
  label: string;
  /** Headline shown big on the card. */
  headline: string;
  headlinePeriod: string;
  /** GST-exclusive amount actually charged each cycle, in ₹. */
  baseAmount: number;
  cycleLabel: string;
  /** Mandatory billing disclosure — never show the headline without this. */
  billingNote: string;
  /** Free wallet credit granted on the first successful payment, in ₹. */
  welcomeCredit: number;
  features: string[];
  cta: string;
}

export const PLAN_TERMS: Record<'quarterly' | 'yearly', PlanTerm> = {
  quarterly: {
    key: 'quarterly',
    label: 'Monthly',
    headline: '₹999',
    headlinePeriod: '/month',
    baseAmount: 2997,
    cycleLabel: 'every 3 months',
    billingNote: 'Billed quarterly at ₹2,997 + 18% GST every 3 months',
    welcomeCredit: 100,
    features: [
      'Full platform access',
      'Webapp + Vendor + Client apps',
      'WhatsApp API integration',
      'AI Studio (wallet pay-per-use)',
      'All industry templates',
      '₹100 free wallet credit',
      '24h support',
    ],
    cta: 'Buy Now — ₹999/mo',
  },
  yearly: {
    key: 'yearly',
    label: 'Yearly',
    headline: '₹9,999',
    headlinePeriod: '/year',
    baseAmount: 9999,
    cycleLabel: 'per year',
    billingNote: 'Billed ₹9,999 + 18% GST once a year',
    welcomeCredit: 400,
    features: [
      'Everything in Monthly',
      'Save ₹1,989 (17%) vs quarterly',
      'Priority support',
      'Custom domain setup help',
      '₹400 free wallet credit',
      'Dedicated onboarding',
    ],
    cta: 'Buy Now — ₹9,999/yr',
  },
};

export const formatINR = (amount: number): string =>
  `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// ── Live pricing from the admin-managed source of truth (g4d_platform_settings,
//    category 'pricing') via the public GET /pricing endpoint. The constants above
//    are the fallback when the API is unreachable, so the page never renders blank.
export interface LivePricing {
  subscription: { monthly: number; quarterly: number; yearly: number };
  topups: Record<string, number>;
  freeCredit: { trial: number; pro: number };
  usage: Record<string, number>;
}

const PRICING_API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

/** Fetch live pricing. Works in server components (ISR-cached) and the client.
 *  Returns null on any failure so callers fall back to the PLAN_TERMS defaults. */
export async function fetchLivePricing(): Promise<LivePricing | null> {
  try {
    const res = await fetch(`${PRICING_API_BASE}/pricing`, { next: { revalidate: 300 } } as RequestInit);
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: LivePricing } & Partial<LivePricing>;
    const live = (body.data ?? body) as LivePricing;
    return live?.subscription ? live : null;
  } catch {
    return null;
  }
}

/** Overlay live subscription numbers onto the PLAN_TERMS shape the card renders. */
export function applyLivePricing(live: LivePricing | null): Record<'quarterly' | 'yearly', PlanTerm> {
  if (!live?.subscription) return PLAN_TERMS;
  const { monthly, quarterly, yearly } = live.subscription;
  const annualizedQuarterly = quarterly * 4;
  const save = Math.max(0, annualizedQuarterly - yearly);
  const savePct = annualizedQuarterly > 0 ? Math.round((save / annualizedQuarterly) * 100) : 0;
  return {
    quarterly: {
      ...PLAN_TERMS.quarterly,
      headline: formatINR(monthly),
      baseAmount: quarterly,
      billingNote: `Billed quarterly at ${formatINR(quarterly)} + 18% GST every 3 months`,
      welcomeCredit: live.freeCredit?.trial ?? PLAN_TERMS.quarterly.welcomeCredit,
      cta: `Buy Now — ${formatINR(monthly)}/mo`,
    },
    yearly: {
      ...PLAN_TERMS.yearly,
      headline: formatINR(yearly),
      baseAmount: yearly,
      billingNote: `Billed ${formatINR(yearly)} + 18% GST once a year`,
      welcomeCredit: live.freeCredit?.pro ?? PLAN_TERMS.yearly.welcomeCredit,
      features: PLAN_TERMS.yearly.features.map((f) => (/^Save /.test(f) ? `Save ${formatINR(save)} (${savePct}%) vs quarterly` : f)),
      cta: `Buy Now — ${formatINR(yearly)}/yr`,
    },
  };
}

/** GST amount (₹) for a GST-exclusive base, rounded to the rupee. */
export const gstOn = (base: number): number => Math.round(base * GST_RATE);

/** GST-inclusive total (₹) for a GST-exclusive base. */
export const totalWithGst = (base: number): number => base + gstOn(base);

// Item 4 — "do it yourself / typical market rate" vs Get4Domain pay-per-use.
// Only rows where the platform is genuinely cheaper are listed, with defensible
// market ranges; the honest value is per-use with no monthly retainer.
export interface UsageComparison {
  task: string;
  market: string;
  ours: string;
}

export const USAGE_VS_MARKET: UsageComparison[] = [
  { task: 'Festival / marketing poster', market: 'Designer ₹300–1,500 each', ours: '₹8 (AI Studio)' },
  { task: 'SEO blog article (~800 words)', market: 'Freelancer ₹500–2,000 each', ours: '₹15 (AI Studio)' },
  { task: 'Social media post + creative', market: 'Agency ₹200–500 each', ours: '₹5 (AI Studio)' },
  { task: 'Reel / short video', market: 'Editor ₹1,000–5,000 each', ours: '₹50–100 (AI Studio)' },
  { task: 'Bulk WhatsApp marketing', market: '₹0.80–1.50/msg + monthly tool fee', ours: '₹1/msg, no monthly fee' },
  { task: '"We post for you" — social media mgmt', market: 'Agency ₹5,000–15,000/month retainer', ours: '₹10/post, pay only when posted' },
];
