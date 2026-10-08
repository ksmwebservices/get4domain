// Single source of truth for plan pricing across the marketing pricing card,
// the /pricing page and the dashboard checkout disclosure.
//
// Billing structure (dispatch 01-Oct-2026): DomainApp is now two ANNUAL-ONLY
// tiers — Workspace and BOS. Quarterly billing is retired for new purchases.
// Prices are GST-EXCLUSIVE; 18% GST is added on top at checkout, matching the
// platform's GST-exclusive convention.

export const GST_RATE = 0.18;

export interface PlanTerm {
  key: 'workspace' | 'bos';
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
  freeSeoKeywords: number;
  themeChangesPerYear: number;
  features: string[];
  cta: string;
}

export const PLAN_TERMS: Record<'workspace' | 'bos', PlanTerm> = {
  workspace: {
    key: 'workspace',
    label: 'Workspace',
    headline: '₹999',
    headlinePeriod: '/month',
    baseAmount: 11988,
    cycleLabel: 'per year',
    billingNote: 'Billed ₹11,988 + 18% GST once a year',
    welcomeCredit: 499,
    freeSeoKeywords: 3,
    themeChangesPerYear: 2,
    features: [
      'Lead capture, CRM & TeleCRM',
      'Website auto-bot reply',
      'Communication Hub — WhatsApp, SMS & email',
      'GST invoicing & expense tracking',
      'Staff dashboard & team access with roles',
      'AI Studio — content, images & blog writing',
      '3 SEO keywords + GEO/AEO, meta optimization & 20 backlinks',
      'Google Business Profile, Analytics & Search Console',
      'Social media management & posting',
      'PWA — installable on any phone',
      '2 theme & website customizations/year',
      '₹499 one-time AI Studio credit',
    ],
    cta: 'Buy Now — ₹999/mo',
  },
  bos: {
    key: 'bos',
    label: 'BOS',
    headline: '₹1,999',
    headlinePeriod: '/month',
    baseAmount: 23988,
    cycleLabel: 'per year',
    billingNote: 'Billed ₹23,988 + 18% GST once a year',
    welcomeCredit: 1299,
    freeSeoKeywords: 6,
    themeChangesPerYear: 4,
    features: [
      'Everything in Workspace',
      'WhatsApp bot reply',
      'Accounting & GST — P&L and GSTR filing',
      'HRM — staff, attendance & payroll',
      'Inventory management',
      'Task management & assigning',
      '6 SEO keywords + GEO/AEO, meta optimization & 20 backlinks',
      '4 theme & website customizations/year',
      '₹1,299 one-time AI Studio credit',
    ],
    cta: 'Buy Now — ₹1,999/mo',
  },
};

export const formatINR = (amount: number): string =>
  `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// ── Live pricing from the admin-managed source of truth (g4d_platform_settings,
//    category 'pricing') via the public GET /pricing endpoint. The constants above
//    are the fallback when the API is unreachable, so the page never renders blank.
export interface LivePricing {
  subscription: { workspaceYearly: number; bosYearly: number };
  topups: Record<string, number>;
  freeCredit: { trial: number; workspace: number; bos: number };
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
export function applyLivePricing(live: LivePricing | null): Record<'workspace' | 'bos', PlanTerm> {
  if (!live?.subscription) return PLAN_TERMS;
  const { workspaceYearly, bosYearly } = live.subscription;
  const workspaceMonthly = Math.round(workspaceYearly / 12);
  const bosMonthly = Math.round(bosYearly / 12);
  return {
    workspace: {
      ...PLAN_TERMS.workspace,
      headline: formatINR(workspaceMonthly),
      baseAmount: workspaceYearly,
      billingNote: `Billed ${formatINR(workspaceYearly)} + 18% GST once a year`,
      welcomeCredit: live.freeCredit?.workspace ?? PLAN_TERMS.workspace.welcomeCredit,
      cta: `Buy Now — ${formatINR(workspaceMonthly)}/mo`,
    },
    bos: {
      ...PLAN_TERMS.bos,
      headline: formatINR(bosMonthly),
      baseAmount: bosYearly,
      billingNote: `Billed ${formatINR(bosYearly)} + 18% GST once a year`,
      welcomeCredit: live.freeCredit?.bos ?? PLAN_TERMS.bos.welcomeCredit,
      cta: `Buy Now — ${formatINR(bosMonthly)}/mo`,
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
  { task: 'Bulk WhatsApp marketing', market: '₹0.80–1.50/msg + monthly tool fee', ours: '₹1/msg, no monthly fee' },
  { task: '"We post for you" — social media mgmt', market: 'Agency ₹5,000–15,000/month retainer', ours: '₹10/post, pay only when posted' },
];
