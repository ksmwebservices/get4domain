# Feature Registry — one source of truth (design, 2026-10-08)

> Design only; nothing is implemented. Motivation, evidence and the target navigation are in [VENDOR_DASHBOARD_AUDIT.md](VENDOR_DASHBOARD_AUDIT.md) and [DASHBOARD_IA_PROPOSAL.md](DASHBOARD_IA_PROPOSAL.md). Backlog ids V-020…V-023 implement this.

## 1. Why a registry

Today the same fact is written by hand in many places that drift apart (all evidenced in the audit):

| Fact | Hand-written in | Consequence |
|---|---|---|
| "What screens exist" | `dashboard/layout.tsx:96-159` (array), `dashboard-config.ts` (tab → addon map), `tab-registry.ts`, the `[tab]/page.tsx` dispatcher | orphan routes (`/dashboard/billing`, `/crm`, `/landing-page`, `/my-services`); 12 duplicated purposes |
| "What each plan includes" | `lib/pricing.ts`, `data/platform-features.ts`, `commercial/entitlements.ts`, `llms.txt`, bot prompts (`ai.service.ts`) | 45 public claims, 32 need rewording/removal; `entitlements.ts` flags (`hrm`, `fullAccounting`, `inventory`…) are consumed by **nothing** |
| "What a vendor can open" | per-vendor `VendorModule`/`VendorAddon` rows that **default OFF** (`addons.constants.ts`), set by an admin | a newly paying vendor sees a locked menu; 4 of 5 live vendors were hand-enabled |
| "Does it work?" | nobody — `FEATURE_MATRIX.md` is a point-in-time document | "coming soon" stubs and fake screens ship unnoticed |

The registry replaces all four with **one list of features**, from which the dashboard menu, plan gating, module provisioning, the marketing lists, `llms.txt`, the chat-bot prompts and the test-coverage report are generated — and a CI guard that makes drift a build failure.

## 2. The feature record

```ts
// registry/features.ts  (data, no logic)
export type Plan = 'WORKSPACE' | 'BOS';
export type Profile = 'COMMERCE' | 'APPOINTMENTS' | 'PACKAGES' | 'SERVICES' | 'LISTINGS';   // IA proposal §2
export type Group = 'home' | 'sell' | 'website' | 'grow' | 'money' | 'operate' | 'settings';
export type Status = 'WORKING' | 'PARTIAL' | 'OFF';                                       // OFF = not built / not safe to show

export interface Feature {
  id: string;                    // 'sell.products'  — stable, dotted, unique
  group: Group;
  label: string;                 // menu label (profile overrides below)
  icon: string;
  kind: 'screen' | 'service' | 'connector';   // service = delivered by staff, no UI
  route: string | null;          // '/dashboard/sell/products'   (null for services)
  legacyRoutes?: string[];       // old URLs that redirect here
  purpose: string;               // ONE purpose key: 'catalogue' | 'stock' | 'leads' | 'customers' | 'plan-billing' | …
  plans: Plan[];                 // plans that INCLUDE it; others see an upgrade card (if `upgrade` is set)
  profiles: Profile[] | 'all';
  labelByProfile?: Partial<Record<Profile, string>>;       // Products / Menu / Packages / Listings …
  status: Status;
  endpoint?: string;             // primary backend route (for the coverage report)
  tables?: string[];             // principal tables (for the duplicate check)
  moduleKey?: string;            // VendorModule key to provision (e.g. 'website_manager')
  addonKey?: string;             // VendorAddon key to provision (e.g. 'inventory_management')
  needsConnector?: 'razorpay' | 'whatsapp' | 'google' | 'social' | 'ai';   // shows "Connect …" instead of the screen
  testId?: string;               // id of an assertion in a verify suite; REQUIRED when status === 'WORKING'
  claim?: { title: string; details: string[]; matrixGroup: string };      // marketing text, generated into pricing/matrix/llms/bot
  upgrade?: { headline: string; body: string };            // upgrade-card copy when the plan lacks it
}
```

Example entries (real features found in the audit):

```ts
{ id: 'sell.products', group: 'sell', label: 'Products', icon: 'Package', kind: 'screen',
  route: '/dashboard/sell/products',
  legacyRoutes: ['/dashboard/my-products', '/dashboard/domain-app/products', '/dashboard/domain-app/catalog', '/dashboard/domain-app/menu'],
  purpose: 'catalogue', plans: ['WORKSPACE','BOS'], profiles: 'all',
  labelByProfile: { COMMERCE: 'Products', APPOINTMENTS: 'Services', PACKAGES: 'Packages', SERVICES: 'Services', LISTINGS: 'Listings' },
  status: 'PARTIAL', endpoint: '/cms/vendor/:id/products', tables: ['VendorProduct'], moduleKey: 'website_manager',
  testId: 'commerce.catalogue.crud' }

{ id: 'sell.stock', group: 'sell', label: 'Stock', icon: 'Boxes', kind: 'screen', route: '/dashboard/sell/stock',
  purpose: 'stock', plans: ['BOS'], profiles: ['COMMERCE'], status: 'OFF',          // OFF until V-010/V-011 land
  endpoint: '/stock/*', tables: ['VendorProduct'], addonKey: 'inventory_management',
  upgrade: { headline: 'Know what is in stock', body: 'Track stock, get low-stock alerts and stop overselling.' } }

{ id: 'money.plan-billing', group: 'money', label: 'Plan & billing', icon: 'CreditCard', kind: 'screen',
  route: '/dashboard/money/billing', legacyRoutes: ['/dashboard/billing','/dashboard/go-live','/dashboard/my-services'],
  purpose: 'plan-billing', plans: ['WORKSPACE','BOS'], profiles: 'all', status: 'WORKING',
  endpoint: '/billing/me', tables: ['Invoice','BillingTerm'], testId: 'commercial.flows.vendor-billing' }

{ id: 'grow.social-publish', group: 'grow', label: 'Social posting', icon: 'Share2', kind: 'connector', route: '/dashboard/grow/social',
  purpose: 'social-publish', plans: ['WORKSPACE','BOS'], profiles: 'all', status: 'OFF', needsConnector: 'social',   // mock today → not rendered anywhere
  claim: { title: 'Social media management & posting', details: ['Plan, create and publish to your pages'], matrixGroup: 'AI, content & social' } }

{ id: 'operate.hr', group: 'operate', label: 'HR', icon: 'UserCog', kind: 'screen', route: '/dashboard/operate/hr',
  purpose: 'hr', plans: ['BOS'], profiles: 'all', status: 'OFF', addonKey: 'hr_payroll' }   // placeholder page deleted
```

## 3. Where it lives and how it is consumed

* **Single file** `registry/features.ts` (+ a JSON export) in the monorepo root. The two packages cannot import each other, so a generator (`npm run registry:build`) writes **committed, generated files** into each package, each starting with a `// GENERATED — edit registry/features.ts` header and a content hash:

| Generated file | Consumer | Replaces |
|---|---|---|
| `get4domain_mvp/src/lib/nav.generated.ts` | dashboard layout, mobile bottom nav, route guards | the arrays in `layout.tsx`, `TAB_ADDON_REQUIREMENT` |
| `get4domain_mvp/src/lib/redirects.generated.ts` | `next.config` redirects for `legacyRoutes` | ad-hoc links |
| `get4domain_mvp/src/data/marketing.generated.ts` | `pricing.ts` feature lists, `platform-features.ts` capabilities + comparison matrix, FAQ feature lines | hand-written lists |
| `get4domain_mvp/public/llms.txt` (generated section) | crawlers | hand-written copy |
| `backend-api/src/registry/registry.generated.ts` | `visibleFeatures(vendor)`, **module/addon provisioning at activation/renewal/override**, bot prompt builder (`AiService` marketing + dashboard prompts) | `AVAILABLE_MODULES` defaults, `entitlements.ts` booleans, prompt text |
| `docs/v2/FEATURE_STATUS.md` (generated) | humans | the point-in-time `FEATURE_MATRIX.md` |

### 3.1 Resolution rule (`visible(feature, vendor)`)

1. `status === 'OFF'` → **not rendered anywhere** (menu, pricing, matrix, `llms.txt`, bot).
2. Profile filter: `profiles === 'all'` or includes the vendor's primary/secondary profile.
3. Plan: if the vendor's billing-term `planKey` is in `plans` → render. Else if `upgrade` is set → render an **upgrade card** (never "coming soon"); else hide.
4. `needsConnector` and not connected → render the screen's "Connect …" state.
5. Admin per-vendor `VendorModule`/`VendorAddon` rows become **overrides only** (force on/off), not the default mechanism.

### 3.2 Provisioning
Activation, renewal, plan change and term override (all in `SettlementService`/`TermsService`) call `provisionFor(planKey, profile)` which upserts the `VendorModule`/`VendorAddon` rows the registry derives. This closes finding 6 (a newly paying vendor sees a locked menu).

## 4. Labels and the profile
`labelByProfile` lets one feature serve all industries ("Products" for a shop, "Menu" for a restaurant, "Listings" for real estate). The profile comes from `Vendor.industry` through the existing industry-experience registry, so no new vendor field is needed.

## 5. Test linkage (so "WORKING" means something)

* Every verify suite emits a machine-readable report: `reports/feature-tests.json` = `{ "<testId>": { "passed": n, "failed": m } }`. Convention: assertion names start with `[feat:<testId>]`, e.g. `ok('[feat:commerce.stock.atomic] two simultaneous sales never oversell', …)`.
* The existing suites already contain most of the assertions (`verify:commercial`, security suites, the commerce/journeys traces in `evidence/dashboard-audit/`); they only need the tag.

## 6. CI guard — `scripts/verify-registry.js` (`npm run verify:registry`)

Runs in `verify:commercial`, the frontend `build`, and the PR check. Fails (exit 1) when:

| # | Rule | Check |
|---|---|---|
| R1 | **Every route is registered** | each `app/dashboard/**/page.tsx` route must equal some feature's `route` or appear in a `legacyRoutes` list (the 31 routes found today would produce 6 findings on day one: the orphans `billing`, `crm`, `landing-page`, `my-services`, `domain-app` and `notifications`) |
| R2 | **No two features share a purpose** | `purpose` must be unique; in addition two features may not declare the same `(endpoint, table)` pair unless one lists the other in `shares` |
| R3 | **WORKING needs a passing test** | `status === 'WORKING'` requires `testId`, present in `reports/feature-tests.json` with `failed === 0` and `passed ≥ 1` |
| R4 | **OFF stays out of public output** | none of an `OFF` feature's `label`/`claim.title` may appear in the generated marketing files, `llms.txt` or bot prompts |
| R5 | **Generated files are current** | regenerate in memory and compare hashes; mismatch fails with "run `npm run registry:build`" |
| R6 | **No stubs** | no `ComingSoon` import, no "coming soon" / "available shortly" string in any generated copy or dashboard source |
| R7 | **Plan integrity** | every feature has ≥ 1 plan; BOS ⊇ Workspace (the "Everything in Workspace" claim is asserted, not typed); `moduleKey`/`addonKey` exist in the module registry |
| R8 | **Labels unique per group** | prevents two "Settings"/"Profile" entries to one route |
| R9 | **PARTIAL needs a note** | `PARTIAL` features must carry a `limits` string that is rendered in the admin status page |

The guard itself is tested with seeded violations (a duplicate purpose, an unregistered route, a WORKING feature without a test, an OFF feature leaked into `llms.txt`) — each must fail.

## 7. Migration path (small, safe steps — each ships alone)

| Step | Change | Risk | Done when |
|---|---|---|---|
| 0 | Add `registry/features.ts` describing **today's** menu and routes exactly (no behaviour change); write `verify-registry.js` in **report-only** mode | none | report lists the R1/R2 findings of the audit |
| 1 | Tag existing assertions with `[feat:…]`; emit `reports/feature-tests.json` | none | R3 report shows which features have no test |
| 2 | Fix quick wins outside the registry: Billing in the menu, fake Notifications/Settings replaced (V-001/V-002) | low | registry updated by hand to include them |
| 3 | Generate `nav.generated.ts`; replace the arrays in `layout.tsx` with it; output **identical** to today (snapshot test) | low | snapshot test green |
| 4 | Generate `marketing.generated.ts`, `llms.txt` section and bot prompts; apply the REWORD/REMOVE decisions as registry edits (`OFF` where unbuilt) | low | CLAIMS_VS_REALITY re-run shows 0 REMOVE |
| 5 | Provisioning: activation/renewal/override call `provisionFor` (V-022); admin toggles become overrides | medium | flow test: new BOS vendor sees BOS modules without an admin |
| 6 | Introduce nav v2 (IA proposal) behind `nav_v2`; pilot on `ksm-webtech-services`, then stepnrock; legacy routes redirect | medium | route-coverage test; no dead links |
| 7 | Switch the guard to **fail** mode; delete orphan routes and `ComingSoon` | low | `npm run verify:registry` blocks merges |

## 8. What this does *not* do
It does not build the missing features (V-010 … V-062); it makes it impossible to *advertise or show* them before they work, and it makes duplicates and unregistered screens fail the build.
