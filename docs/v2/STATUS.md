# STATUS — Get4Domain V2 (current reality)

## Release 1A — Dashboard v2 and special arrangements (2026-10-09)

Built on branch `get4domain-site`, nothing deployed. Details: [DASHBOARD_V2.md](DASHBOARD_V2.md).

- **Registry** (`registry/`): one source for every dashboard feature, generated files for both apps, a guard that fails the build on unregistered routes, duplicate purposes and claims without evidence. Menu snapshot covers plan x profile x switch.
- **Dashboard v2**: ten departments, Open / Locked / Coming soon states, phone tabs, payment-due banner, Home "needs attention" and go-live checklist. Behind the per-vendor `nav_v2` switch; flag off = the old dashboard. Verified by hand on a production build ([WALKTHROUGH.md](evidence/dashboard-v2/WALKTHROUGH.md)).
- **Plan-driven access**: `provisionModules` (grant-only, idempotent, audited), `nav-v2-dry-run.js` (read-only), `set-vendor-access.js --nav-v2`, admin Plan access.
- **Honest copy**: Essentials / Pro names, unbuilt claims removed from dashboard text, reels and video Coming soon (no wallet debit, proven by test).
- **Special arrangements**: half-year plan, manual QR payment, GST not charged, only by admin arrangement, enforced on the server, expiring, audited; renewal reverts to annual / Razorpay / GST on top; "GST not collected" report.
- **Found and fixed on the way**: the CRM board listed no leads (`source=undefined`), also in the old dashboard.
- **Needs KSM**: apply migration `20261009100000_special_arrangements` on the VM, re-run the RLS script, deploy both containers, then the switch steps in [DEPLOYMENT.md](DEPLOYMENT.md) section 7.

> The sections below are the 2026-10-02 audit baseline and have not been rewritten; where they disagree with Release 1A above, Release 1A is current.

> Reflects reality, not intent. Product requirements live in [`../reference/GET4DOMAIN_V2_PRD.md`](../reference/GET4DOMAIN_V2_PRD.md); evidence in [AUDIT_REPORT.md](AUDIT_REPORT.md). **Last updated: 2026-10-02.** Update this file after every completed dispatch.

## Headline
V2 execution has **not started** (PRD §99: audit baseline first). The existing application is **not** 100% functional against the PRD — see the verdict and the critical-findings table in [AUDIT_REPORT.md](AUDIT_REPORT.md). **Security items S1–S6 are live in production today** and are recommended before any V2 feature work.

## Security patch (2026-10-02) — S1–S6 fixed in code, **not yet deployed**
Fixes for the critical findings S1–S6 are written and verified (135 assertions; before/after exploit proofs) — see [SECURITY_PATCH_2026-10-02.md](SECURITY_PATCH_2026-10-02.md). **Awaiting KSM:** apply migration `20261002130000_payment_idempotency` (`cd backend-api && npx prisma migrate deploy`) *before* deploying; deploy backend + frontend together; set the WhatsApp webhook secret (the bot is intentionally offline until then). S7–S15 remain open.

## Commercial Engine v1 (07-Oct-2026) + follow-up A — built, tested, **not yet deployed**
Custom deals, invoices, pay links, UPI QR, promo codes, renewals and the stepnrock go-live are implemented (commit `69a8c44`); follow-up A adds **(1)** named volumes so public uploads survive `--force-recreate`, **(2)** MARKETING staff locked out of every commerce endpoint and the Commerce UI, **(3)** an editable, audited net price when approving a plan change, billed by the renewal after it (plus a fix for a one-time credit leaking into the term price). See [COMMERCIAL_ENGINE.md](COMMERCIAL_ENGINE.md), [BILLING.md](BILLING.md) and [DEPLOYMENT.md §3b](DEPLOYMENT.md) (exact, ordered VM commands including the one-time uploads backup/restore). **Awaiting KSM:** back up uploads → pull → `prisma migrate deploy` (applies `20261007120000_commercial_engine` and `20261007130000_plan_change_price`) → rebuild API, web and stepnrock → restore uploads → enter **Payee & QR** → `scripts/activate-stepnrock.js` (dry run → `--apply`). Verification: `npm run verify:commercial` = 351 assertions (116 + 221 + 14); security suites unchanged; both apps build; `audit:vendor-dark` clean. Not verified: the migration SQL has never run on Postgres, Razorpay was a fake gateway, no browser E2E, the Docker volume/chown behaviour is untested here (no Docker on the dev machine).

## Hotfix 2026-10-08 — Prisma "void" advisory-lock error (fixed in code, not yet deployed)
Deal builder → Create invoice + link / Activate now failed on a live click (`Failed to deserialize column of type 'void'`). All advisory locks now use `advisoryXactLock()` (`$executeRaw`); the same bug sat in the live wallet/public-checkout payment locks (`lockPayment`). Guards: `verify:raw-sql`, a strict in-memory Prisma fake, `scripts/verify-db-lock.js` (verified against the live pooler). Stepnrock was left with one unpaid activation invoice (`INV-2026-0005`, ₹5,994) and no term; `activate-stepnrock.js` now resumes on it. Details and the VM sequence: [DEPLOYMENT.md §3b.7](DEPLOYMENT.md). Migrations `20261007120000` and `20261007130000` are now **applied** on the live database (verified read-only 2026-10-08).

## AI Studio credit prorated by term (2026-10-08) — built, tested, not yet deployed
KSM's decision: the one-time AI Studio credit is proportional to the billing term (Workspace half-yearly ₹250, 3 months ₹125, monthly ₹42; BOS half-yearly ₹650; annual unchanged ₹499 / ₹1,299), overridable per deal (₹0–₹5,000). One function (`aiStudioCreditPaise`), nullable `aiCreditPaise` on deals and terms (migration `20261008100000_ai_credit_per_term`, **NOT applied**), grant = max(0, target − already granted), never a clawback, shown to the vendor as "included" and never as a charge. Public pages unchanged (annual-only). Stepnrock: ₹250, nothing granted yet. Details: [COMMERCIAL_ENGINE.md B10c](COMMERCIAL_ENGINE.md), VM sequence: [DEPLOYMENT.md §3b.8](DEPLOYMENT.md). Verification: `verify:commercial` = 142 pure + 290 flows + 14 admin-nav + migration hygiene + raw-SQL guard; security suites unchanged; both apps build.

## Vendor dashboard & platform feature audit (2026-10-08) — docs only
Read-only audit after reports that the vendor dashboard is confusing and partly broken. Production DB was **SELECT-only**; write tests ran against an isolated in-memory Postgres, so nothing was created or deleted in production. Deliverables: [VENDOR_DASHBOARD_AUDIT.md](VENDOR_DASHBOARD_AUDIT.md) (ten findings first), [DASHBOARD_IA_PROPOSAL.md](DASHBOARD_IA_PROPOSAL.md), [FEATURE_REGISTRY_DESIGN.md](FEATURE_REGISTRY_DESIGN.md), [CLAIMS_VS_REALITY.md](CLAIMS_VS_REALITY.md) (45 claims: 13 SAFE, 23 REWORD, 9 REMOVE-UNTIL-BUILT). Headlines: three disconnected product stores; website sales never touch stock (and stock can go negative); 0 of 5 live vendors can take online payments; the Website Manager does not drive standalone vendor sites; plan/BOS entitlements do not drive the menu (modules default OFF); the Billing page is not in the menu; AI Studio failures are masked (OpenAI preferred, no fallback; VM log needed); social posting is a mock; 39 expired demo vendors never cleaned. Backlog V-001…V-070 in [TASKS.md](TASKS.md). **No application code changed.**

## Step N Rock handover (2026-10-08) — built, tested and pushed; **not yet deployed**
Stepnrock (Workspace plan, owner Suresh) is made ready as an **order-request shop** (no online payment yet). Full detail, how-tos and the GO/NO-GO table: [STEPNROCK_HANDOVER.md](STEPNROCK_HANDOVER.md); trace: [STEPNROCK_TRACE.md](STEPNROCK_TRACE.md); custom domain: [CUSTOM_DOMAIN_RUNBOOK.md](CUSTOM_DOMAIN_RUNBOOK.md); counter billing (design only): [COUNTER_BILLING_DESIGN.md](COUNTER_BILLING_DESIGN.md).
- **Stock:** atomic reservation for My Products items, movement ledger on every change, availability-only public API, Adjust stock + history + Low stock list, Stock page. Additive migration `20261008120000_stepnrock_handover` (**the only migration pending in production** — verified read-only: production is at `20261008100000_ai_credit_per_term`).
- **Orders:** per-vendor checkout mode (ORDER_REQUEST / ONLINE), customer + phone + address, idempotent, Mark paid / Cancel (cancel restores stock), notifications.
- **Storefront:** changes show within 30 s (measured 28.9 s); live categories, availability, `SITE_URL`, sitemap/robots; invented content removed.
- **Dashboard:** opt-in Workspace menu (addon `workspace_menu`, default off — applied to stepnrock only by `scripts/set-vendor-access.js`), Plan & Billing in that menu, real notifications, honest Settings, categories manager, orders screen.
- **AI Studio:** wallet checked before the provider, OpenAI⇄Claude fallback, classified errors, images saved to our uploads, `scripts/ai-health.js`.
- **Commercial:** Deal-builder guard against a second activation (typed-reason override, audited), vendor Audit trail now shows invoice/term actions, `scripts/fix-stepnrock-term.js` (dry run on production: INV-2026-0005 void, INV-2026-0006 open, current term grace 2 → 7).
- **Uploads/CORS:** content-checked uploads, SVG scripts refused, sandboxed SVG headers; `CORS_EXTRA_ORIGINS` / `CORS_MODE=strict`.
- **Not built (stated limits):** online payment for stepnrock, counter billing, automatic refunds, stock history for the Retail/Catalog POS paths, an add-page tool.

## Source control
| Item | State |
|---|---|
| Branch | `get4domain-site` |
| Local HEAD vs live remote (`git ls-remote`) | **identical** at last check (`f7ad328`); nothing unpushed on any branch |
| Last session's commits all on origin | yes — `ca95c07` (Managed Services), `0ff83a6` (Workspace/BOS pricing), `0092985` (DomainCampaign), `f7ad328` (fee fix) and the earlier deebiphotography/my-products/stepnrock commits |
| Uncommitted | this audit's documentation (`docs/v2/**`) and the "superseded" notices on three older PRD documents |

## Database / migrations (verified read-only against the live DB, 2026-10-02)
| Migration | State |
|---|---|
| 38 local migration folders | **all applied** on the live DB |
| `20261001100000_add_subscription_theme_change_tracking` | applied (theme-change limits are now enforced for Workspace/BOS subscriptions created after it) |
| `20261001110000_add_domain_campaign_records` | applied (`g4d_domain_campaign_records` exists) |
| `20261002120000_domain_campaign_custom_fee` | **NOT applied** — adds `isCustomFee`. **Apply before deploying the new DomainCampaign code**: `cd backend-api && npx prisma migrate deploy` (otherwise recording a spend fails "column does not exist"). |
| `20261002130000_payment_idempotency` | **NOT applied** — PosSale razorpay columns + unique indexes (security patch). Apply before deploying that code. |
| `20261007120000_commercial_engine` | **NOT applied** — Commercial Engine v1 (8 new tables, `Invoice` extension, 6 `InvoiceStatus` values). Additive. Apply **before** deploying the new backend. First attempt on the VM failed (P3018) because a Prisma update banner had been pasted into the file; the banner is removed and `verify:migrations` guards against it. The failed attempt left an unfinished `_prisma_migrations` row: run `npx prisma migrate resolve --rolled-back 20261007120000_commercial_engine` first (DEPLOYMENT.md §3b.2). |
| `20261007130000_plan_change_price` | **NOT applied** — 5 nullable columns for the approved plan-change price (`g4d_plan_change_requests`, `g4d_billing_terms`). Additive; apply right after the commercial-engine migration. *(Update 2026-10-08: the live `_prisma_migrations` table shows this one and `20261007120000_commercial_engine` and `20261008100000_ai_credit_per_term` as applied.)* |
| `20261008120000_stepnrock_handover` | **NOT applied — the only migration pending.** Stock ledger table (`g4d_stock_movements`), `VendorProduct.trackStock`, order-request columns on `g4d_pos_sales`, `VendorPaymentConfig.checkoutMode`, category order/hidden. Additive; rehearsed on a database holding legacy rows (`verify-stock-pg.js`). Apply before deploying the new backend: `cd backend-api && npx prisma migrate deploy`. |
| `20261003100000_universal_catalogue_columns` | **NOT applied** — additive columns/indexes/FK on `VendorProduct` (Universal Catalogue). Apply with the others via `cd backend-api && npx prisma migrate deploy`, then follow the data-migration order in [UNIVERSAL_CATALOGUE_MODEL.md](UNIVERSAL_CATALOGUE_MODEL.md) §4. Apply **before** deploying the new backend. |
| Drift | `20260719093736_add_leads` is applied in the DB but has no local folder; 28 core tables were created by `prisma db push`, not by migrations (see [MIGRATION_PLAN.md](MIGRATION_PLAN.md)) |

## Product surface — what's shipped
| Area | Status |
|---|---|
| DomainApp plans | **Workspace** ₹999/mo (₹11,988/yr + GST) and **BOS** ₹1,999/mo (₹23,988/yr + GST); annual-only; quarterly retired for new purchases. One-time AI Studio credit (₹499 / ₹1,299) tagged `ai_studio_bonus`. Theme-change allowance 2 / 4 per year. HRM and Office Management shown as "coming soon" (not built). **Razorpay Plans still to be created by KSM**: "DomainApp Workspace — Annual" ₹14,145.84 and "DomainApp BOS — Annual" ₹28,305.84 (GST-inclusive). |
| Domain Campaign | Public page, two lead-capture entry points, admin tab (Managed Services page) with client onboarding, manual spend, billing history, one-click invoice. **Fee = PRD §88 brackets**: spend ≤ ₹20,000 → ₹2,000; ₹20,001–₹1,00,000 → ₹5,000; above → ₹10,000 (+ GST); **Enterprise/Custom = admin-entered fee per client-month (interpretation — needs KSM confirmation)**. Old 10%/₹9,999 logic removed everywhere. |
| Managed Services | Public page + lead capture + admin proposal/quote tool with shareable accept/decline link. |
| Universal Catalogue | **Designed + migration written, not applied, no live code cut over.** `VendorProduct` evolves into the one catalogue table; `CatalogItem` (117 rows, all demo) and `RetailProduct` (0 rows) untouched. See [UNIVERSAL_CATALOGUE_MODEL.md](UNIVERSAL_CATALOGUE_MODEL.md). Cutover/retirement = separate dispatch. |
| Standalone vendor sites | stepnrock and deebiphotography live on the shared backend; ksm-quantum built, deploy/DNS pending; allwin-tours separate. |

## Known open defects (tracked, not fixed in this audit)
- S1–S15 in [AUDIT_REPORT.md](AUDIT_REPORT.md) (critical: forgeable payment verification, client-priced checkout, password-hash/invite-token exposure, open WhatsApp webhook, no rate limiting).
- `generateInvoice` (DomainCampaign) lacks a server-side already-invoiced guard (UI hides the button once invoiced).
- Stale "₹999/month or ₹9,999/year" line on `/features` (`get4domain_mvp/src/app/(marketing)/features/page.tsx:122`).
- Vendor team invite email links to `/team/accept-invite`, which has no route.
- DomainCampaign spend/fee SQL uses raw parameterised queries until `prisma generate` is run for the model.

## Decisions awaiting KSM
1. Confirm the Enterprise/Custom interpretation and "GST on top" for Domain Campaign fees.
2. Confirm Workspace ≙ "Business Growth System" and BOS ≙ "Business Operating System" (PRD §69–70) and whether PRD tier boundaries should now drive server-side entitlements.
3. AI Reels/Video: relabel "Coming Soon" (PRD §18/39) or accept the deviation.
4. `CLAUDE.md` vs reality (UUIDs, soft delete, refresh tokens, shadcn, lint/tests): change the rule or the code.
5. Approve a pre-V2 stabilisation sprint for S1–S6.

## Next actions (no V2 execution until approved)
1. Apply `20261002120000` on the VM, then deploy.
2. Create the two Razorpay Plan objects.
3. Review [ROADMAP.md](ROADMAP.md) / [RELEASE_PLAN.md](RELEASE_PLAN.md) and approve (or amend) the V2.0a stabilisation scope.
