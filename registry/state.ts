// Pure logic shared by the dashboard, the API and the tests. No imports except types — the generator embeds this file verbatim
// into the generated files of both packages, so there is exactly ONE implementation.
import type { DeptId, Feature, FeatureState, MinPlan, PlanKey, Profile, VendorPlan } from './types';

export interface VendorFacts {
  /** The vendor's billing-term plan; null (demo / no term yet) is treated as the entry plan. LEADSPACE = a LeadSpace-only account (free base tier). */
  plan: VendorPlan | null;
  /** A "BOS Custom" client (never a plan): gets the Pro feature set plus the Custom department. */
  custom: boolean;
  profile: Profile;
  /** The per-vendor Dashboard v2 switch. Off = the old dashboard; the v2 menu does not exist for this vendor. */
  navV2: boolean;
}

/** Display names live HERE only (Release 1B will make the source admin-managed). Internal keys never change. */
export function planDisplayName(planKey: string | null | undefined): string {
  if (planKey === 'WORKSPACE') return 'Essentials';
  if (planKey === 'BOS') return 'Pro';
  if (planKey === 'CUSTOM') return 'Custom';
  if (planKey === 'LEADSPACE') return 'LeadSpace';
  return planKey ? String(planKey) : 'Essentials';
}

const RANK: Record<MinPlan, number> = { LEADSPACE: 0, WORKSPACE: 1, BOS: 2, CUSTOM: 3 };

/** The 20 industries (+ the general fallback) → business-model profile. */
export const INDUSTRY_PROFILE: Record<string, Profile> = {
  retail: 'COMMERCE', restaurant: 'COMMERCE', agriculture: 'COMMERCE',
  clinic: 'APPOINTMENTS', salon: 'APPOINTMENTS', gym: 'APPOINTMENTS', diagnostics: 'APPOINTMENTS',
  travel: 'PACKAGES', hotel: 'PACKAGES', events: 'PACKAGES', photography: 'PACKAGES',
  professional: 'SERVICES', finance: 'SERVICES', coaching: 'SERVICES', education: 'SERVICES', construction: 'SERVICES',
  technology: 'SERVICES', logistics: 'SERVICES', automobile: 'SERVICES', general: 'SERVICES',
  realestate: 'LISTINGS',
};

export function profileOfIndustry(industry: string | null | undefined): Profile {
  return INDUSTRY_PROFILE[String(industry ?? 'general').toLowerCase()] ?? 'SERVICES';
}

/** Words for the profile's main work screen (mobile tab, Orders label). */
export const PRIMARY_WORK_LABEL: Record<Profile, string> = {
  COMMERCE: 'Orders', APPOINTMENTS: 'Appointments', PACKAGES: 'Bookings', SERVICES: 'Enquiries', LISTINGS: 'Site visits',
};

export function labelFor(f: Pick<Feature, 'label' | 'labelByProfile'>, profile: Profile): string {
  return f.labelByProfile?.[profile] ?? f.label;
}

const BUILT = (f: Pick<Feature, 'status'>): boolean => f.status === 'WORKING' || f.status === 'LIMITED';

/**
 * What the v2 menu shows for one feature and one vendor (KSM's rules, 2026-10-08):
 *  - the v2 menu exists only for vendors with `navV2` on (otherwise every feature is HIDDEN: they see the old dashboard)
 *  - `hidden` features and features outside the vendor's profile are HIDDEN
 *  - the Custom department is HIDDEN unless the vendor is a Custom client; its items are not built → COMING_SOON
 *  - NOT built or NOT tested → COMING_SOON, even for a higher plan (never tell anyone to upgrade for something that does not exist)
 *  - built, and the vendor's plan includes it → OPEN
 *  - built, but the plan lacks it → LOCKED (upgrade card)
 */
export function featureState(f: Feature, v: VendorFacts): FeatureState {
  if (!v.navV2) return 'HIDDEN';
  if (f.hidden) return 'HIDDEN';
  if (f.profiles !== 'all' && !f.profiles.includes(v.profile)) return 'HIDDEN';
  if (f.minPlan === 'CUSTOM' && !v.custom) return 'HIDDEN';
  if (!BUILT(f)) return 'COMING_SOON';
  const have = RANK[v.plan ?? 'WORKSPACE'] ?? 1;
  const need = RANK[f.minPlan] ?? 1;
  return have >= need ? 'OPEN' : 'LOCKED';
}

export interface MenuItem { feature: Feature; label: string; state: FeatureState }
export interface MenuDept { id: DeptId; label: string; items: MenuItem[] }

export const DEPARTMENTS: { id: DeptId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'LayoutDashboard' },
  { id: 'sales', label: 'Sales and CRM', icon: 'Users' },
  { id: 'marketing', label: 'Marketing and Growth', icon: 'Megaphone' },
  { id: 'website', label: 'Website and Domain', icon: 'Globe' },
  { id: 'commerce', label: 'Commerce and Operations', icon: 'Package' },
  { id: 'finance', label: 'Finance and Accounts', icon: 'Receipt' },
  { id: 'people', label: 'People and HR', icon: 'UserCog' },
  { id: 'communication', label: 'Communication', icon: 'MessagesSquare' },
  { id: 'account', label: 'Your Get4Domain account', icon: 'CreditCard' },
  { id: 'custom', label: 'BOS Custom', icon: 'Sparkles' },
];

/** The full v2 menu for one vendor: departments in order, HIDDEN items dropped, empty departments dropped. */
export function buildMenu(features: Feature[], v: VendorFacts): MenuDept[] {
  const out: MenuDept[] = [];
  for (const d of DEPARTMENTS) {
    const items: MenuItem[] = [];
    for (const f of features) {
      if (f.department !== d.id) continue;
      const state = featureState(f, v);
      if (state === 'HIDDEN') continue;
      items.push({ feature: f, label: labelFor(f, v.profile), state });
    }
    if (items.length > 0) out.push({ id: d.id, label: d.label, items });
  }
  return out;
}

// ── Industry tab keys → which v2 screen owns them (the existing `/dashboard/domain-app/<tab>` editors are MOUNTED, not rewritten) ──
export const PRODUCT_TABS = ['products', 'catalog', 'menu', 'services', 'packages', 'courses', 'tests', 'plans', 'properties', 'produce'];
export const CUSTOMER_TABS = ['customers', 'clients', 'patients', 'buyers', 'members', 'students', 'guests'];
export const INVOICE_TABS = ['billing', 'invoicing', 'fees', 'transactions'];
export const ORDER_TABS = ['orders', 'bookings', 'appointments', 'enquiries', 'reservations', 'visits'];

export type TabOwner = 'products' | 'customers' | 'invoices' | 'orders' | 'workspace';
export function tabOwner(tabKey: string): TabOwner {
  if (PRODUCT_TABS.includes(tabKey)) return 'products';
  if (CUSTOMER_TABS.includes(tabKey)) return 'customers';
  if (INVOICE_TABS.includes(tabKey)) return 'invoices';
  if (ORDER_TABS.includes(tabKey)) return 'orders';
  return 'workspace';
}

const OWNER_FEATURE: Record<TabOwner, string> = {
  products: 'commerce.products', customers: 'sales.customers', invoices: 'finance.invoices', orders: 'commerce.orders', workspace: 'commerce.workspace',
};

/**
 * Where an OLD dashboard address goes in v2 (null = not a legacy address). Pure, so the middleware, the client fallback and the
 * tests all use the same answer. `search` (with or without "?") is carried over unchanged.
 */
export function resolveLegacyRoute(features: Feature[], pathname: string, search = ''): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const qs = search ? (search.startsWith('?') ? search.slice(1) : search) : '';
  const join = (target: string): string => {
    if (!qs) return target;
    return target.includes('?') ? `${target}&${qs}` : `${target}?${qs}`;
  };
  if (path === '/dashboard/domain-app') return join('/dashboard');
  const m = path.match(/^\/dashboard\/domain-app\/([^/]+)$/);
  if (m) {
    const tab = decodeURIComponent(m[1]);
    const owner = features.find((f) => f.id === OWNER_FEATURE[tabOwner(tab)]);
    return owner ? join(`${owner.route}?tab=${encodeURIComponent(tab)}`) : null;
  }
  for (const f of features) {
    for (const l of f.legacyRoutes ?? []) {
      const from = typeof l === 'string' ? l : l.from;
      if (from !== path) continue;
      const tab = typeof l === 'string' ? undefined : l.tab;
      const query = typeof l === 'string' ? undefined : l.query;
      const base = tab ? `${f.route}?tab=${encodeURIComponent(tab)}` : query ? `${f.route}?${query}` : f.route;
      return join(base);
    }
  }
  return null;
}

// ── Go-live checklist (Home), computed per profile from live signals ─────────────────────────────────────────────────
export interface GoLiveSignals {
  productsAdded: number;
  paymentsConnected: boolean;
  domainConnected: boolean;
  seoBasics: boolean;
  firstLead: boolean;
}
export type ChecklistId = 'payments' | 'products' | 'domain' | 'seo' | 'lead';
export interface ChecklistItem { id: ChecklistId; label: string; hint: string; route: string }

const PRODUCT_WORD: Record<Profile, string> = { COMMERCE: 'products', APPOINTMENTS: 'services', PACKAGES: 'packages', SERVICES: 'services', LISTINGS: 'listings' };

/** What a new vendor must have done before telling customers about the site. Payments only matter to businesses that take orders or deposits online. */
export function goLiveChecklist(profile: Profile): ChecklistItem[] {
  const word = PRODUCT_WORD[profile];
  const items: ChecklistItem[] = [
    { id: 'products', label: `Add your ${word}`, hint: `Customers can only see what you add.`, route: '/dashboard/commerce/products' },
  ];
  if (profile === 'COMMERCE' || profile === 'PACKAGES') {
    items.unshift({ id: 'payments', label: 'Choose how customers order or pay', hint: 'Order requests need no gateway; online payment needs your Razorpay keys.', route: '/dashboard/payments' });
  }
  items.push(
    { id: 'domain', label: 'Connect your own domain', hint: 'Your address, instead of the Get4Domain one.', route: '/dashboard/website/domain' },
    { id: 'seo', label: 'Set your search title and description', hint: 'This is what Google shows for your site.', route: '/dashboard/website/search' },
    { id: 'lead', label: 'Send yourself a test enquiry', hint: 'Fill in your own website form once and see it arrive in Leads.', route: '/dashboard/sales/leads' },
  );
  return items;
}

export function checklistDone(id: ChecklistId, s: GoLiveSignals): boolean {
  switch (id) {
    case 'payments': return s.paymentsConnected;
    case 'products': return s.productsAdded > 0;
    case 'domain': return s.domainConnected;
    case 'seo': return s.seoBasics;
    case 'lead': return s.firstLead;
    default: return false;
  }
}
