// Feature registry types — the ONE vocabulary for Dashboard v2 (KSM, 2026-10-08, Release 1A).
// Edit registry/features.ts, then run `npm run registry:build` in get4domain_mvp (or backend-api). Never edit *.generated.ts by hand.

/** Internal plan keys. Display names (Essentials / Pro) come from planDisplayName() only. `CUSTOM` is NOT a subscription plan: it marks the "BOS Custom" department. */
export type PlanKey = 'WORKSPACE' | 'BOS';
export type MinPlan = PlanKey | 'CUSTOM';

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

export type LegacyRoute = string | { from: string; tab?: string };

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
