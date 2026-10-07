# STATUS — Get4Domain V2 (current reality)

> Reflects reality, not intent. Product requirements live in [`../reference/GET4DOMAIN_V2_PRD.md`](../reference/GET4DOMAIN_V2_PRD.md); evidence in [AUDIT_REPORT.md](AUDIT_REPORT.md). **Last updated: 2026-10-02.** Update this file after every completed dispatch.

## Headline
V2 execution has **not started** (PRD §99: audit baseline first). The existing application is **not** 100% functional against the PRD — see the verdict and the critical-findings table in [AUDIT_REPORT.md](AUDIT_REPORT.md). **Security items S1–S6 are live in production today** and are recommended before any V2 feature work.

## Security patch (2026-10-02) — S1–S6 fixed in code, **not yet deployed**
Fixes for the critical findings S1–S6 are written and verified (135 assertions; before/after exploit proofs) — see [SECURITY_PATCH_2026-10-02.md](SECURITY_PATCH_2026-10-02.md). **Awaiting KSM:** apply migration `20261002130000_payment_idempotency` (`cd backend-api && npx prisma migrate deploy`) *before* deploying; deploy backend + frontend together; set the WhatsApp webhook secret (the bot is intentionally offline until then). S7–S15 remain open.

## Commercial Engine v1 (07-Oct-2026) + follow-up A — built, tested, **not yet deployed**
Custom deals, invoices, pay links, UPI QR, promo codes, renewals and the stepnrock go-live are implemented (commit `69a8c44`); follow-up A adds **(1)** named volumes so public uploads survive `--force-recreate`, **(2)** MARKETING staff locked out of every commerce endpoint and the Commerce UI, **(3)** an editable, audited net price when approving a plan change, billed by the renewal after it (plus a fix for a one-time credit leaking into the term price). See [COMMERCIAL_ENGINE.md](COMMERCIAL_ENGINE.md), [BILLING.md](BILLING.md) and [DEPLOYMENT.md §3b](DEPLOYMENT.md) (exact, ordered VM commands including the one-time uploads backup/restore). **Awaiting KSM:** back up uploads → pull → `prisma migrate deploy` (applies `20261007120000_commercial_engine` and `20261007130000_plan_change_price`) → rebuild API, web and stepnrock → restore uploads → enter **Payee & QR** → `scripts/activate-stepnrock.js` (dry run → `--apply`). Verification: `npm run verify:commercial` = 351 assertions (116 + 221 + 14); security suites unchanged; both apps build; `audit:vendor-dark` clean. Not verified: the migration SQL has never run on Postgres, Razorpay was a fake gateway, no browser E2E, the Docker volume/chown behaviour is untested here (no Docker on the dev machine).

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
| `20261007130000_plan_change_price` | **NOT applied** — 5 nullable columns for the approved plan-change price (`g4d_plan_change_requests`, `g4d_billing_terms`). Additive; apply right after the commercial-engine migration. |
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
