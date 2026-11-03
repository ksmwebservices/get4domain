# V3 Implementation Plan

> Derived from `V3_REQUIREMENTS_MATRIX.md`. Revised 2026-11-02 to apply the owner's final decisions D1, D3, D4. Each phase needs **explicit approval** before it starts (spec Rule 9; no auto-advance).

## 0. Decisions

### Final (owner, 2026-11-02 — override anything earlier)

| ID | Decision | Consequence for the plan |
|---|---|---|
| **D1** | V3 = **public business directory + instant free websites + plans as data: three tracks (Handyman, Professional, Ecommerce), each with a Free and a Pro level = six plan rows (owner decision 2026-11-03; replaces the earlier four-plans reading of spec §3).** Billing quarterly / half-yearly / annual; optional monthly possible later. Plans, prices, taxes, billing periods, discounts, grace periods and entitlements are **database data editable by admin without code changes.** **Workspace and BOS are legacy, out of V3 scope**: not extended, built on, deleted or migrated; existing vendor data is not touched. | V3 plan tables are new and V3-named. No V3 code reads/writes the legacy billing, BOS, commercial-engine or menu-gating tables. The earlier "build on Commercial Engine", "grandfather", "reuse BOS spine" ideas are **withdrawn**. |
| **D3** | Keep the existing **HTML/CSS themes**. **Defer Next.js theme packages.** | V3.3 is hardening/eligibility of the HTML/CSS marketplace only. |
| **D4** | **Redis/BullMQ approved, but not added in Step 0.** A managed Redis service is introduced only when queues are needed (≈V3.6/V3.7). | Step 0–V3.5 use no Redis; light cron stays on `@nestjs/schedule`. |

### Not yet decided by the owner — working assumptions (confirm or correct)

| ID | Item | Working assumption | Why it matters |
|---|---|---|---|
| D2 | Tenant model | `Vendor` **is** the tenant (no ID rewrite, no new `Tenant` table). The Step 0 tenant guard is built on `vendorId` | Every later migration and test |
| D5 | Directory naming | Done: the real-estate `Listing` is untouched; all directory objects are `Directory*` (`DirectoryBusiness`, `DirectoryCategory`, `DirectoryLocation`, …) | Prevents Prisma/table clashes |
| D6 | Production reconciliation | Read-only comparison of production to the 53 local migrations is Step 0 item 1 | Baseline for staging and for rehearsing V3 migrations |
| Q1 | Are the 20 industry modules, DomainApp, universal catalogue and LeadSpace legacy or reusable platform assets? | **Unknown — blocks V3.5 design** (V3.5 is not detailed until answered) | Decides how much of V3.5 can reuse code |
| Q2 | Website Manager / category packs / `/site/<sub>` renderer | Reuse the renderer and packs for the free website; replace their plan-based limits with V3 entitlements; do not touch legacy data | V3.2/V3.3 scope |
| Q3 | Legacy dashboard/billing for Workspace/BOS vendors | Stays available and untouched | Coexistence |

## 1. Phase plan

Effort is in rough engineer-weeks for one engineer: an **estimate**, not a commitment.

### V3.1 — SaaS Foundation (est. 4–5 wks, starting with Step 0)

**Step 0 — Stabilise baseline (est. 1.5–2 wks). No product features until Step 0 is green (tests pass in CI on staging).**
1. Read-only comparison of production to the 53 local migrations (no writes of any kind).
2. Separate **staging database**; migrations never run against production from this work.
3. Test runner, CI, and a `/health` endpoint.
4. Tenant guard + first cross-tenant isolation tests.
5. Close open security findings S7–S15, one fix each.
Detailed plan is in the Step 0 plan presented for approval (not auto-started).

**Status (updated with slice 5.1, 2026-11-03).** Tests and CI now exist: Jest unit and staging-integration projects (`npm run test:ci`, `npm run test:int`), `.github/workflows/v3-ci.yml`, `/health`, the tenant guard with `forTenant()`, a reviewed route-classification baseline, the admin role matrix with its oracle test, and the staging gate (`backend-api/scripts/staging`). Step 0 items 2 to 5 and the security fixes S7 to S13 are done on `v3-step0` (see `AUTORUN_LOG.md`); the push, merge and production release are the owner's steps (the release runbook). Slice 5.1 (below) adds 12 `g4d_` tables on staging only.

**Slice 5.3 status (provisioning engine, claim links and invites; built on `v3-s53`, staging only, nothing pushed).** Staff create a business through a job of five idempotent steps (vendor, Free plan, DRAFT site, claim link, invite) run by a database-backed runner (atomic claim with a lease, retry with backoff, crash takeover; no Redis, decision D4). The invite goes through an adapter that is sandbox by default; the live adapter exists and is OFF. The claim link validates by token only (phone OTP and password are slice 5.7). Design: `V3_S3_PROVISIONING.md`. Includes the remainder of 5.2 (every new table is classified for the tenant guard by a CI test). Not built: the theme-kit renderer for the Free site (5.4), the live invite wording and expiry (owner decisions), the staging run (needs `.env.staging`).

**Slice 5.4 status (theme renderer, SEO layer and publish; built on `v3-s54`, staging only, nothing pushed).** The theme kit is merged and the backend uses its renderer through a build-time transform (one source, no copy, a test guards it). A vendor's draft content is mapped through a small port, rendered into versioned HTML snapshots (a DRAFT_PREVIEW, then PUBLISHED, with rollback), wrapped in a platform-written head (title, description, canonical, robots, Open Graph, hreflang, JSON-LD, sitemap, robots.txt) that never carries a price or a retired product name, and noindex until the owner has claimed the business and the mandatory facts are there. Publishing means only that the snapshot is the one an internal read API serves: no real host, domain, DNS or server is touched. The slice 5.3 draft step can build the preview (`siteDraftBuilderMode`, default legacy). Design: `V3_S4_RENDERER_PUBLISH.md`. Not built: exposure on a real host (5.6), richer content such as structured hours (5.5), the dashboard screens, the staging run (needs `.env.staging`).

**Then V3.1 proper (after approval):**
- **Plans & entitlements as data (D1):** `g4d_plans`, `g4d_plan_prices` (plan × period), `g4d_features`, `g4d_plan_features`, `g4d_tax_rates`, `g4d_discount_rules`, `g4d_plan_settings` (grace, upgrade rules), V3 subscription/term tables, entitlement overrides. **Slice 5.1 (built, staging only; see `V3_S1_PLANS_ENTITLEMENTS.md`):** the plan model is **three tracks x two levels = six plans** (`handyman_free`, `handyman_pro`, `professional_free`, `professional_pro`, `ecommerce_free`, `ecommerce_pro`). Pro base monthly-equivalent rates are Rs 499, 999 and 1499; billing terms are quarterly (3), half-yearly (6) and annual (12) months only, with TERM discounts of 0, 10 and 20 percent (proposed, admin-editable); the price rows are GENERATED from those, so the Pro prices are Handyman Rs 1,497 / 2,695 / 4,790, Professional Rs 2,997 / 5,395 / 9,590, Ecommerce Rs 4,497 / 8,095 / 14,390. The older figures (2,997 / 5,694 / 9,990 and so on) are superseded. The data, the engine (`resolve`, `can`, limits, grace and downgrade, overrides, the theme-kit mapping), the admin API and the vendor and public API exist; the payment flow is slice 5.1b. One server-side `can(tenant, feature)` check used everywhere. Admin screens to edit all of it. Optional monthly = a price row with term 1, switched on by the plan setting `allowMonthly` (default off), no code change.
- **Staff roles:** role/permission tables for the 14 spec roles (replacing reliance on the 3-value enum for V3 screens).
- **Vendor registration + employee-assisted registration** with provenance.
- **Platform audit log** (new table).
- **Billing for V3 plans:** Razorpay order/payment-link flow for V3 subscriptions, built fresh against the new tables (reusing only generic, non-legacy utilities like payment idempotency helpers and advisory locks).

### V3.2 — Public Business Directory + Free Website (est. 6–8 wks) — **main V3 deliverable**
- **Directory (spec §7):** `DirectoryLocation` (state→district→city, Tamil Nadu first), `DirectoryCategory` (tree, spec's 21 categories + subcategories), `DirectoryBusiness` with services / products / media / placements, optional `DirectoryReview`.
- **Public routes:** `/businesses/`, `/businesses/<state>/`, `/businesses/<state>/<city>/`, `/businesses/<state>/<city>/<category>/`, `/business/<slug>/`. Server-rendered, canonical URLs, JSON-LD, noindex for thin location/category pages below a content threshold.
- **Search:** keyword + category + location using Postgres full-text/trigram on the same database; no new search service in V3.2.
- **Profile:** hours, map, contact, services, products, gallery, verification status, WhatsApp/website links, enquiry form → existing lead pipeline (vendor-scoped); plan-based appearance and clearly labelled sponsored placement from entitlements; organic relevance not purely price-ranked.
- **Free website:** instant one-page site from registration using existing category packs + `/site/<sub>` renderer + free subdomain, limits from V3 entitlements (Q2).
- **Free vendor onboarding:** self-registration and employee-assisted registration create a vendor, a directory profile and a free site together.
- **Sitemaps:** main, category, location, business, with index files.
- **Naming rule:** nothing named `Listing`.

### V3.3 — HTML/CSS Theme Marketplace + Website Manager hardening (est. 3–4 wks)
- HTML/CSS themes only (D3). Map theme eligibility to V3 plans; ensure five usable themes cover the spec's verticals; add scheduled publication and employee/vendor approval; keep the single-document `VendorCMS` model.

### V3.4 — Domain Services (est. 5–7 wks; credential-gated)
- Validate ResellerClub on the sandbox first (never run live). Registrar adapter interface. DNS record manager, nameserver manager, ownership verification (TXT), automated TLS decision, custom-domain tenant resolution + canonical redirects, transfers with encrypted auth codes, renewal/expiry reminders and cron, migration history. Never mark a transfer complete until the registrar confirms.

### V3.5 — Paid webapps, CRM, ecommerce operations (est. TBD — **re-scope after Q1**)
- Not detailed. Cannot assume reuse of BOS spine, counter billing or industry modules (D1). Candidates once Q1 is answered: six-stage lead pipeline, duplicate detection, export, appointments, vendor coupons, variants, shipping adapter, returns/refunds, ecommerce analytics.

### V3.6 — Central Enquiry Hub + Chatbots (est. 5–6 wks; approval-gated)
- Unified `Enquiry` + router + attribution; common chatbot engine with channel adapters (website widget, WhatsApp, Messenger, Instagram); human handover. **Managed Redis introduced here if queues are required (D4).** Sandbox providers first; Meta approvals gate live.

### V3.7 — Communication and Billing (est. 4–5 wks)
- Usage ledger with idempotency, per-plan allowances, prepaid packs with validity, Resend webhooks + suppression, SMS DLT mapping, reports. **Redis/BullMQ in use here** for dispatch/retry.

### V3.8 — Social and marketing operations (est. 4–5 wks; approval-gated)
- Build on the existing sandbox `social/` publisher; calendar, approval, vendor OAuth, marketing requests, monthly entitlement counters.

### V3.9 — SEO, GEO, AEO (est. 3–4 wks)
- RSS/Atom, redirect manager, full sitemap index, structured data per entity, technical audit job, Search Console / GA4.

### V3.10 — Production testing (est. 3–4 wks)
- Tenant isolation on every API, security review, E2E, load/perf, backup/restore drill, migration rehearsal on a production copy, deployment/rollback, Node base-image upgrade.

**Order-of-magnitude total ≈ 40 weeks single-engineer**, excluding external approvals and credentials; V3.5 is unestimated.

## 2. Legacy handling (replaces the earlier "pending production backlog" section)

- Workspace/BOS and everything coupled to them are **legacy**: see "Legacy, out of V3 scope" in the requirements matrix, including the vendors, subscriptions and payments known to depend on them.
- V3 does not apply, finish or revert legacy pending migrations (e.g. `universal_catalogue_columns`). Step 0 only **records** what production has applied.
- The owner decides the future of legacy data and vendors separately.

## 3. Cross-cutting engineering rules for every V3 phase

1. **Additive database changes only**; the migration guard scripts must pass; back up before applying anywhere that holds real data; never `db push` against production; **never run migrations against production from V3 work without explicit approval**.
2. **Feature flags** so a phase can ship dark. V3 flags are new and V3-named; V3 does not depend on the legacy `nav_v2` / `site_doc_v2` / `workspace_menu` switches.
3. **No fake functionality** — a UI action needs a working backend or a visible "Coming soon / Pending approval" state. Mock providers stay labelled.
4. **Integrations behind adapters** with `sandbox | live` mode and Rule 6 status values.
5. **Identifiers:** the code uses `cuid()` IDs on every model. The platform `CLAUDE.md` said UUID; the correction is proposed separately. V3 keeps `cuid()` and does not rewrite existing IDs.
6. Each phase ends with the Rule 9 report (objective, reuse, files modified, files added, DB changes, routes, frontend, tests, results, outstanding) and updates the tracker set.
