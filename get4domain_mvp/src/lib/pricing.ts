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
