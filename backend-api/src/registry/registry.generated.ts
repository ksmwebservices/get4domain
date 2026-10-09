// GENERATED — do not edit. Source: registry/features.ts (+ types.ts, state.ts). Run `npm run registry:build` after changing the registry.
// registry-hash: 535d3b203808bdc8
// Same registry for the API: provisioning, context endpoint, arrangements.
/* eslint-disable */
// Feature registry types — the ONE vocabulary for Dashboard v2 (KSM, 2026-10-08, Release 1A).
// Edit registry/features.ts, then run `npm run registry:build` in get4domain_mvp (or backend-api). Never edit *.generated.ts by hand.

/** Internal plan keys. Display names (Essentials / Pro) come from planDisplayName() only. `CUSTOM` is NOT a subscription plan: it marks the "BOS Custom" department. */
export type PlanKey = 'WORKSPACE' | 'BOS';
/** What a vendor can be on: a paid plan, or LEADSPACE, the free base tier (a LeadSpace page and wallet, nothing else). Billing and limits only ever use PlanKey. */
export type VendorPlan = PlanKey | 'LEADSPACE';
export type MinPlan = VendorPlan | 'CUSTOM';

/** Business-model profiles (docs/v2/DASHBOARD_IA_PROPOSAL.md §2): A…E. */
export type Profile = 'COMMERCE' | 'APPOINTMENTS' | 'PACKAGES' | 'SERVICES' | 'LISTINGS';

export type DeptId = 'home' | 'sales' | 'marketing' | 'website' | 'commerce' | 'finance' | 'people' | 'communication' | 'account' | 'custom';

/**
 * Honest build status.
 *  WORKING   built AND covered by an automated assertion (`testId`, found as `[feat:<testId>]` in a verify suite)
 *  LIMITED   built, works for its main job, with stated `limits`; needs a `testId` or a documented `manualCheck`
 *  UNTESTED  code exists but was never verified  -> shown as Coming soon
 *  NOT_BUILT does not exist (or is a stub)       -> shown as Coming soon
 */
export type Status = 'WORKING' | 'LIMITED' | 'UNTESTED' | 'NOT_BUILT';

export type FeatureState = 'HIDDEN' | 'OPEN' | 'LOCKED' | 'COMING_SOON';

export type LegacyRoute = string | { from: string; tab?: string; query?: string };

/** A named plan limit: the number each plan gets (null = unlimited). The defaults live here; KSM changes them in admin (g4d_plan_overrides) without a deploy. */
export type PlanLimits = Record<PlanKey, number | null>;

/**
 * What a plan switches on that is NOT a menu screen: reports, exports, extra locations, staff seats.
 * `capture` is the Full BOS rule: capturing a business record (an invoice, a receipt, a stock movement, an expense) is NEVER gated, so an upgrade needs no
 * migration; only views, exports and limits are `gated`.
 */
export interface Capability {
  id: string;
  label: string;
  minPlan: PlanKey;
  capture: 'always' | 'gated';
  /** Named limits of this capability, e.g. { seats: { WORKSPACE: 1, BOS: 5 } }. */
  limits?: Record<string, PlanLimits>;
  upgrade: { headline: string; body: string };
}

export interface Feature {
  /** Stable dotted id, unique. */
  id: string;
  department: DeptId;
  label: string;
  /** Profile-specific wording, e.g. Products / Menu / Services / Packages / Listings. */
  labelByProfile?: Partial<Record<Profile, string>>;
  icon: string; // lucide icon name
  /** Where the screen lives. */
  route: string;
  /** Old addresses that redirect to `route` (kept at least 180 days). `{from, tab}` lands on a tab of the hub. */
  legacyRoutes?: LegacyRoute[];
  /** ONE purpose key; two features may never share one. */
  purpose: string;
  /** Lowest plan that includes it. */
  minPlan: MinPlan;
  profiles: Profile[] | 'all';
  status: Status;
  /** WORKING: required. Found as `[feat:<testId>]` in an automated suite. */
  testId?: string;
  /** LIMITED: alternative to testId — the document + section that records the manual check. */
  manualCheck?: string;
  /** Plain-language limits (LIMITED). */
  limits?: string;
  /** VendorModule key to provision for entitled vendors. */
  moduleKey?: string;
  addonKey?: string;
  /** Upgrade-card copy (LOCKED state): one sentence of benefit + what it unlocks. */
  upgrade?: { headline: string; body: string };
  /** Never rendered in the menu (reachable only from where the registry says). */
  hidden?: boolean;
  /** Named limits of this screen's plan (null = unlimited), e.g. invoices per month. */
  planLimits?: Record<string, PlanLimits>;
  /** Full BOS: `always` = capture is never gated (the screen's records are stored the same for every plan). */
  capture?: 'always' | 'gated';
  /** Tabs of a hub screen (labels; the components are mapped in the frontend). */
  tabs?: { key: string; label: string }[];
}

// Pure logic shared by the dashboard, the API and the tests. No imports except types — the generator embeds this file verbatim
// into the generated files of both packages, so there is exactly ONE implementation.

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

export const REGISTRY_HASH = '535d3b203808bdc8';
export const FEATURES: Feature[] = [
  {
    "id": "home.today",
    "department": "home",
    "label": "Today",
    "icon": "LayoutDashboard",
    "route": "/dashboard",
    "purpose": "home",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#home.today",
    "limits": "Go-live checklist and banner are computed from live data; revenue widgets are the existing Overview."
  },
  {
    "id": "home.reports",
    "department": "home",
    "label": "Reports",
    "icon": "BarChart3",
    "route": "/dashboard/home/reports",
    "legacyRoutes": [
      "/dashboard/reports"
    ],
    "purpose": "reports",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "LIMITED",
    "testId": "reports.usage",
    "limits": "Counts of leads, calls, AI use and orders for the business; charts by period are Coming soon.",
    "moduleKey": "analytics_hub",
    "upgrade": {
      "headline": "See how your business is doing",
      "body": "Cross-module reports for leads, orders and revenue."
    }
  },
  {
    "id": "sales.leads",
    "department": "sales",
    "label": "Leads",
    "icon": "Users",
    "route": "/dashboard/sales/leads",
    "legacyRoutes": [
      {
        "from": "/dashboard/crm",
        "tab": "board"
      },
      {
        "from": "/dashboard/telecrm",
        "tab": "queue"
      }
    ],
    "purpose": "leads",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#sales.leads",
    "limits": "Board and Call queue are two views of the same leads; no telephony (tap-to-call opens the phone).",
    "moduleKey": "telecrm",
    "tabs": [
      {
        "key": "board",
        "label": "Board"
      },
      {
        "key": "queue",
        "label": "Call queue"
      }
    ]
  },
  {
    "id": "sales.lead-tools",
    "department": "sales",
    "label": "Pitch scripts, assignment, sales reports",
    "icon": "ClipboardList",
    "route": "/dashboard/sales/lead-tools",
    "purpose": "lead-tools",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "sales.customers",
    "department": "sales",
    "label": "Customers",
    "icon": "UserCircle",
    "route": "/dashboard/sales/customers",
    "purpose": "customers",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#sales.customers",
    "limits": "One customer list per business (the editor follows your industry).",
    "moduleKey": "domainapp"
  },
  {
    "id": "sales.quotes",
    "department": "sales",
    "label": "Quotes",
    "icon": "FileText",
    "route": "/dashboard/sales/quotes",
    "purpose": "quotes",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "WORKING",
    "testId": "bos.spine"
  },
  {
    "id": "sales.portal",
    "department": "sales",
    "label": "Customer portal",
    "icon": "Share2",
    "route": "/dashboard/sales/portal",
    "legacyRoutes": [
      "/dashboard/customer-hub"
    ],
    "purpose": "customer-portal",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#sales.portal",
    "limits": "Portal invites by SMS/WhatsApp are sent only once the messaging key is set.",
    "moduleKey": "customer_hub"
  },
  {
    "id": "marketing.ai-studio",
    "department": "marketing",
    "label": "AI Studio",
    "icon": "Sparkles",
    "route": "/dashboard/marketing/ai-studio",
    "legacyRoutes": [
      "/dashboard/ai-studio"
    ],
    "purpose": "ai-studio",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "testId": "ai.studio.safe-generation",
    "limits": "Writes text and pictures from your wallet. Reels and video are Coming soon."
  },
  {
    "id": "marketing.leadspace",
    "department": "marketing",
    "label": "LeadSpace",
    "icon": "Megaphone",
    "route": "/dashboard/marketing/leadspace",
    "legacyRoutes": [
      "/dashboard/leadspace",
      {
        "from": "/dashboard/campaigns",
        "tab": "promote"
      },
      {
        "from": "/dashboard/landing-page",
        "tab": "page"
      }
    ],
    "purpose": "leadspace",
    "minPlan": "LEADSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "testId": "leadspace.capture",
    "addonKey": "leadspace",
    "moduleKey": "growth_hub",
    "limits": "A free landing page, verified leads and a prepaid wallet. Customer codes go out on WhatsApp once the common Get4Domain number is approved by Meta (until then it runs in a test mode); posts reach Facebook, Instagram and Telegram once those pages are connected by our team.",
    "tabs": [
      {
        "key": "home",
        "label": "Home"
      },
      {
        "key": "leads",
        "label": "Leads"
      },
      {
        "key": "page",
        "label": "Page"
      },
      {
        "key": "promote",
        "label": "Promote"
      },
      {
        "key": "wallet",
        "label": "Wallet"
      }
    ]
  },
  {
    "id": "marketing.social",
    "department": "marketing",
    "label": "Social posting",
    "icon": "Share2",
    "route": "/dashboard/marketing/social",
    "purpose": "social-publish",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "NOT_BUILT",
    "hidden": true
  },
  {
    "id": "marketing.reviews-offers",
    "department": "marketing",
    "label": "Reviews and offers",
    "icon": "Star",
    "route": "/dashboard/marketing/reviews-offers",
    "purpose": "reviews-offers",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "website.content",
    "department": "website",
    "label": "Content and pages",
    "icon": "Globe",
    "route": "/dashboard/website/content",
    "legacyRoutes": [
      "/dashboard/my-website"
    ],
    "purpose": "website-content",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "WORKING",
    "testId": "site.live-edit",
    "moduleKey": "website_manager"
  },
  {
    "id": "website.new-pages",
    "department": "website",
    "label": "Add new pages",
    "icon": "FileText",
    "route": "/dashboard/website/new-pages",
    "purpose": "website-pages",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "website.design",
    "department": "website",
    "label": "Design and themes",
    "icon": "Sparkles",
    "route": "/dashboard/website/design",
    "purpose": "website-design",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "testId": "themes.unlock",
    "limits": "Pick a template and logo/banner; theme changes per year follow your plan.",
    "moduleKey": "website_manager"
  },
  {
    "id": "website.domain",
    "department": "website",
    "label": "Domain",
    "icon": "Link",
    "route": "/dashboard/website/domain",
    "legacyRoutes": [
      "/dashboard/domain-management"
    ],
    "purpose": "domain",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#website.domain",
    "limits": "Search and connect are shown; registration and DNS steps are completed by Get4Domain."
  },
  {
    "id": "website.search",
    "department": "website",
    "label": "Search and AI visibility",
    "icon": "Search",
    "route": "/dashboard/website/search",
    "purpose": "seo-basic",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#website.search",
    "limits": "Title, description and keywords per page.",
    "moduleKey": "website_manager"
  },
  {
    "id": "website.search-pro",
    "department": "website",
    "label": "AI answers, Google tools",
    "icon": "Search",
    "route": "/dashboard/website/search-pro",
    "purpose": "seo-pro",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "website.widget",
    "department": "website",
    "label": "Chat widget",
    "icon": "Code",
    "route": "/dashboard/website/widget",
    "legacyRoutes": [
      "/dashboard/embed"
    ],
    "purpose": "chat-widget",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#website.widget",
    "limits": "Embeds your chat/enquiry widget on any website you control.",
    "moduleKey": "website_manager"
  },
  {
    "id": "website.readiness",
    "department": "website",
    "label": "Go-live readiness",
    "icon": "Rocket",
    "route": "/dashboard/website/readiness",
    "legacyRoutes": [
      "/dashboard/website-engine"
    ],
    "purpose": "readiness",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#website.readiness",
    "limits": "The technical list of wired actions is an admin view.",
    "moduleKey": "website_manager"
  },
  {
    "id": "commerce.products",
    "department": "commerce",
    "label": "Products and services",
    "labelByProfile": {
      "COMMERCE": "Products",
      "APPOINTMENTS": "Services",
      "PACKAGES": "Packages",
      "SERVICES": "Services",
      "LISTINGS": "Listings"
    },
    "icon": "Package",
    "route": "/dashboard/commerce/products",
    "legacyRoutes": [
      "/dashboard/my-products"
    ],
    "purpose": "catalogue",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "WORKING",
    "testId": "commerce.catalogue",
    "moduleKey": "website_manager",
    "limits": "Three product stores still exist (My Products, industry catalogue, retail products); they are mounted here as tabs and unified in a later release."
  },
  {
    "id": "commerce.stock",
    "department": "commerce",
    "label": "Stock",
    "icon": "Boxes",
    "route": "/dashboard/commerce/stock",
    "legacyRoutes": [
      "/dashboard/stock"
    ],
    "purpose": "stock",
    "minPlan": "WORKSPACE",
    "profiles": [
      "COMMERCE"
    ],
    "status": "WORKING",
    "testId": "bos.stock-ledger",
    "moduleKey": "website_manager"
  },
  {
    "id": "commerce.orders",
    "department": "commerce",
    "label": "Orders, bookings, enquiries",
    "labelByProfile": {
      "COMMERCE": "Orders",
      "APPOINTMENTS": "Appointments",
      "PACKAGES": "Bookings",
      "SERVICES": "Enquiries",
      "LISTINGS": "Site visits"
    },
    "icon": "ShoppingBag",
    "route": "/dashboard/commerce/orders",
    "legacyRoutes": [
      "/dashboard/orders"
    ],
    "purpose": "orders",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "WORKING",
    "testId": "commerce.orders.request",
    "moduleKey": "website_manager"
  },
  {
    "id": "commerce.workspace",
    "department": "commerce",
    "label": "Industry workspace",
    "icon": "LayoutGrid",
    "route": "/dashboard/commerce/workspace",
    "purpose": "industry-workspace",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#commerce.workspace",
    "moduleKey": "domainapp",
    "limits": "Your industry's existing operation screens, with their add-on rules unchanged. The full set is Coming soon."
  },
  {
    "id": "commerce.workspace-full",
    "department": "commerce",
    "label": "Full industry workspace",
    "icon": "LayoutGrid",
    "route": "/dashboard/commerce/workspace-full",
    "purpose": "industry-workspace-full",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "commerce.inventory",
    "department": "commerce",
    "label": "Purchases and suppliers",
    "icon": "Boxes",
    "route": "/dashboard/commerce/inventory",
    "purpose": "inventory-purchases",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "WORKING",
    "testId": "bos.purchases",
    "upgrade": {
      "headline": "Record what you buy",
      "body": "Purchase bills, suppliers, what you owe, and the GST you can claim back. Pro keeps your stock cost up to date from your purchases."
    }
  },
  {
    "id": "commerce.pos",
    "department": "commerce",
    "label": "Counter billing",
    "icon": "Store",
    "route": "/dashboard/commerce/pos",
    "purpose": "pos",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "WORKING",
    "testId": "bos.counter"
  },
  {
    "id": "commerce.tasks",
    "department": "commerce",
    "label": "Tasks and workflow",
    "icon": "ClipboardList",
    "route": "/dashboard/commerce/tasks",
    "purpose": "tasks",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "commerce.documents",
    "department": "commerce",
    "label": "Documents",
    "icon": "FileText",
    "route": "/dashboard/commerce/documents",
    "purpose": "documents",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "finance.invoices",
    "department": "finance",
    "label": "Customer invoices",
    "icon": "FileText",
    "route": "/dashboard/finance/invoices",
    "legacyRoutes": [
      {
        "from": "/dashboard/invoices",
        "query": "note=billing-moved"
      }
    ],
    "purpose": "customer-invoices",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "WORKING",
    "testId": "bos.spine",
    "tabs": [
      {
        "key": "invoices",
        "label": "Invoices"
      },
      {
        "key": "quotes",
        "label": "Quotes"
      },
      {
        "key": "money-in",
        "label": "Money in"
      },
      {
        "key": "credit-notes",
        "label": "Credit notes"
      }
    ]
  },
  {
    "id": "finance.collect-payments",
    "department": "finance",
    "label": "Collect payments",
    "icon": "CreditCard",
    "route": "/dashboard/finance/collect-payments",
    "legacyRoutes": [
      "/dashboard/payments"
    ],
    "purpose": "collect-payments",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "WORKING",
    "testId": "bos.payments-keys"
  },
  {
    "id": "finance.recurring",
    "department": "finance",
    "label": "Recurring billing",
    "icon": "Receipt",
    "route": "/dashboard/finance/recurring",
    "purpose": "recurring-billing",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "WORKING",
    "testId": "bos.recurring",
    "upgrade": {
      "headline": "Bill the same customer every month",
      "body": "Set an invoice to repeat monthly, quarterly or yearly, and get a reminder list of who is overdue."
    }
  },
  {
    "id": "finance.expenses",
    "department": "finance",
    "label": "Accounts",
    "icon": "Receipt",
    "route": "/dashboard/finance/expenses",
    "legacyRoutes": [
      "/dashboard/accounts"
    ],
    "purpose": "expenses-gst",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "WORKING",
    "testId": "bos.journal",
    "tabs": [
      {
        "key": "summary",
        "label": "Summary"
      },
      {
        "key": "expenses",
        "label": "Expenses"
      },
      {
        "key": "books",
        "label": "Books"
      },
      {
        "key": "more",
        "label": "Industry view and GST filing"
      }
    ]
  },
  {
    "id": "finance.ca-accounts",
    "department": "finance",
    "label": "Accounts for the CA",
    "icon": "FileText",
    "route": "/dashboard/finance/ca-accounts",
    "purpose": "ca-accounts",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "WORKING",
    "testId": "bos.ca-pack",
    "upgrade": {
      "headline": "One file for your CA",
      "body": "GST summary, HSN summary and every register in one Excel workbook with a summary page, for any month, quarter or year."
    }
  },
  {
    "id": "people.team",
    "department": "people",
    "label": "Team and roles",
    "icon": "UserPlus",
    "route": "/dashboard/people/team",
    "legacyRoutes": [
      "/dashboard/team"
    ],
    "purpose": "team",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "WORKING",
    "testId": "team.area-access"
  },
  {
    "id": "people.team-pro",
    "department": "people",
    "label": "Branches, departments, audit log",
    "icon": "UserCog",
    "route": "/dashboard/people/team-pro",
    "purpose": "team-pro",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "people.hr",
    "department": "people",
    "label": "HR and payroll",
    "icon": "UserCog",
    "route": "/dashboard/people/hr",
    "legacyRoutes": [
      "/dashboard/hrm"
    ],
    "purpose": "hr",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "communication.inbox",
    "department": "communication",
    "label": "Inbox",
    "icon": "MessagesSquare",
    "route": "/dashboard/communication/inbox",
    "legacyRoutes": [
      "/dashboard/communication"
    ],
    "purpose": "inbox",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#communication.inbox",
    "limits": "WhatsApp and website chat. SMS and e-mail are Coming soon.",
    "moduleKey": "communication_hub"
  },
  {
    "id": "communication.sms-email",
    "department": "communication",
    "label": "SMS and e-mail",
    "icon": "Mail",
    "route": "/dashboard/communication/sms-email",
    "purpose": "sms-email",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "communication.whatsapp-bot",
    "department": "communication",
    "label": "WhatsApp bot",
    "icon": "MessageCircle",
    "route": "/dashboard/communication/whatsapp-bot",
    "legacyRoutes": [
      "/dashboard/whatsapp-bot"
    ],
    "purpose": "whatsapp-bot",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "LIMITED",
    "testId": "bot.kb",
    "limits": "Your questions and answers are kept and checked here; live replies on WhatsApp need your WhatsApp number connected.",
    "moduleKey": "communication_hub",
    "upgrade": {
      "headline": "Answer customers on WhatsApp automatically",
      "body": "Replies from your own answers, with a hand-off to you."
    }
  },
  {
    "id": "communication.notifications",
    "department": "communication",
    "label": "Notifications",
    "icon": "Bell",
    "route": "/dashboard/communication/notifications",
    "legacyRoutes": [
      "/dashboard/notifications"
    ],
    "purpose": "notifications",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "WORKING",
    "testId": "notifications.own-only"
  },
  {
    "id": "communication.reminders",
    "department": "communication",
    "label": "Reminders and feedback",
    "icon": "Bell",
    "route": "/dashboard/communication/reminders",
    "purpose": "reminders-feedback",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "account.billing",
    "department": "account",
    "label": "Plan and billing",
    "icon": "CreditCard",
    "route": "/dashboard/account/billing",
    "legacyRoutes": [
      "/dashboard/billing",
      {
        "from": "/dashboard/billing/receipts",
        "tab": "receipts"
      },
      {
        "from": "/dashboard/go-live",
        "tab": "golive"
      },
      {
        "from": "/dashboard/my-services",
        "tab": "services"
      }
    ],
    "purpose": "plan-billing",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "WORKING",
    "testId": "commercial.vendor-billing",
    "tabs": [
      {
        "key": "billing",
        "label": "Plan and invoices"
      },
      {
        "key": "golive",
        "label": "Buy or go live"
      },
      {
        "key": "services",
        "label": "Add-ons and services"
      },
      {
        "key": "receipts",
        "label": "Receipts"
      }
    ]
  },
  {
    "id": "account.wallet",
    "department": "account",
    "label": "Wallet",
    "icon": "Wallet",
    "route": "/dashboard/account/wallet",
    "legacyRoutes": [
      "/dashboard/wallet"
    ],
    "purpose": "wallet",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "WORKING",
    "testId": "wallet.topup"
  },
  {
    "id": "account.profile",
    "department": "account",
    "label": "Business profile",
    "icon": "Building2",
    "route": "/dashboard/account/profile",
    "legacyRoutes": [
      "/dashboard/settings"
    ],
    "purpose": "business-profile",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#account.profile",
    "limits": "Business name, contact details and address save here; name, e-mail and password changes go through Support."
  },
  {
    "id": "account.connections",
    "department": "account",
    "label": "Connections",
    "icon": "Link",
    "route": "/dashboard/account/connections",
    "purpose": "connections",
    "minPlan": "BOS",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "account.disclosures",
    "department": "account",
    "label": "Website disclosures",
    "icon": "FileText",
    "route": "/dashboard/account/disclosures",
    "purpose": "disclosures",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "account.help",
    "department": "account",
    "label": "Help and support",
    "icon": "HelpCircle",
    "route": "/dashboard/account/help",
    "legacyRoutes": [
      "/dashboard/support"
    ],
    "purpose": "support",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#account.help",
    "limits": "Raises a ticket; our team replies by phone or message."
  },
  {
    "id": "account.stationery",
    "department": "account",
    "label": "Office and stationery",
    "icon": "Package",
    "route": "/dashboard/account/stationery",
    "legacyRoutes": [
      "/dashboard/stationery"
    ],
    "purpose": "stationery",
    "minPlan": "WORKSPACE",
    "profiles": "all",
    "status": "LIMITED",
    "manualCheck": "docs/v2/evidence/dashboard-v2/WALKTHROUGH.md#account.stationery",
    "hidden": true,
    "limits": "Reachable from Business profile > Extras."
  },
  {
    "id": "custom.delivery",
    "department": "custom",
    "label": "Delivery",
    "icon": "Sparkles",
    "route": "/dashboard/custom/delivery",
    "purpose": "custom-delivery",
    "minPlan": "CUSTOM",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "custom.workflow",
    "department": "custom",
    "label": "Workflow",
    "icon": "Sparkles",
    "route": "/dashboard/custom/workflow",
    "purpose": "custom-workflow",
    "minPlan": "CUSTOM",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "custom.portals",
    "department": "custom",
    "label": "Portals",
    "icon": "Sparkles",
    "route": "/dashboard/custom/portals",
    "purpose": "custom-portals",
    "minPlan": "CUSTOM",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "custom.integrations",
    "department": "custom",
    "label": "Integrations",
    "icon": "Sparkles",
    "route": "/dashboard/custom/integrations",
    "purpose": "custom-integrations",
    "minPlan": "CUSTOM",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "custom.finance",
    "department": "custom",
    "label": "Finance",
    "icon": "Sparkles",
    "route": "/dashboard/custom/finance",
    "purpose": "custom-finance",
    "minPlan": "CUSTOM",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "custom.people",
    "department": "custom",
    "label": "People",
    "icon": "Sparkles",
    "route": "/dashboard/custom/people",
    "purpose": "custom-people",
    "minPlan": "CUSTOM",
    "profiles": "all",
    "status": "NOT_BUILT"
  },
  {
    "id": "custom.branding",
    "department": "custom",
    "label": "Branding",
    "icon": "Sparkles",
    "route": "/dashboard/custom/branding",
    "purpose": "custom-branding",
    "minPlan": "CUSTOM",
    "profiles": "all",
    "status": "NOT_BUILT"
  }
];
export const KEPT_ROUTES: { route: string; reason: string }[] = [];
export const CAPABILITIES: Capability[] = [
  {
    "id": "bos.purchases",
    "label": "Purchases, suppliers and payables",
    "minPlan": "BOS",
    "capture": "gated",
    "upgrade": {
      "headline": "Record what you buy",
      "body": "Purchase bills, suppliers, what you owe, and the GST you can claim back. Pro keeps your stock cost up to date from your purchases."
    }
  },
  {
    "id": "bos.multi-location",
    "label": "More than one stock location, transfers",
    "minPlan": "BOS",
    "capture": "gated",
    "limits": {
      "locations": {
        "WORKSPACE": 1,
        "BOS": 10
      }
    },
    "upgrade": {
      "headline": "Stock in more than one place",
      "body": "Keep a shop, a godown and more as separate stock locations and move stock between them. Your existing stock stays as it is."
    }
  },
  {
    "id": "bos.stock-valuation",
    "label": "Stock valuation",
    "minPlan": "BOS",
    "capture": "gated",
    "upgrade": {
      "headline": "See what your stock is worth",
      "body": "Stock value at cost for every item and in total. The cost comes from the purchases and prices you already entered."
    }
  },
  {
    "id": "bos.books",
    "label": "Ledger, day book, trial balance, profit and loss, balance sheet",
    "minPlan": "BOS",
    "capture": "gated",
    "upgrade": {
      "headline": "Your full books",
      "body": "Ledger, day book, trial balance, profit and loss and balance sheet, built from the invoices, payments and expenses you have already recorded, including everything from before you upgraded."
    }
  },
  {
    "id": "bos.gst-reports",
    "label": "GST summary and HSN summary",
    "minPlan": "BOS",
    "capture": "gated",
    "upgrade": {
      "headline": "GST returns made simple",
      "body": "GSTR-1 and GSTR-3B style summaries and the HSN summary, ready to hand to your accountant, from the bills you have already made."
    }
  },
  {
    "id": "bos.ca-pack",
    "label": "CA pack export",
    "minPlan": "BOS",
    "capture": "gated",
    "upgrade": {
      "headline": "One file for your CA",
      "body": "All registers in one Excel workbook with a summary page, for any month, quarter or year."
    }
  },
  {
    "id": "bos.period-lock",
    "label": "Period lock",
    "minPlan": "BOS",
    "capture": "gated",
    "upgrade": {
      "headline": "Lock a closed month",
      "body": "Once your CA has the month, lock it so nothing in it can change by mistake."
    }
  },
  {
    "id": "bos.recurring",
    "label": "Recurring invoices and scheduled payment reminders",
    "minPlan": "BOS",
    "capture": "gated",
    "upgrade": {
      "headline": "Bill the same customer every month",
      "body": "Set an invoice to repeat monthly, quarterly or yearly, and get a reminder list of who is overdue."
    }
  },
  {
    "id": "bos.staff",
    "label": "Extra staff users and roles",
    "minPlan": "WORKSPACE",
    "capture": "gated",
    "limits": {
      "seats": {
        "WORKSPACE": 1,
        "BOS": 5
      }
    },
    "upgrade": {
      "headline": "Add your team",
      "body": "Invite more people with their own access. Your plan includes a number of seats; Pro includes more."
    }
  }
];
