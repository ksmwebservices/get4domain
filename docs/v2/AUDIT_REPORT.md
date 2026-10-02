# Get4Domain V2 — Audit Report (PRD §94 required first response)

**Date:** 2026-10-02 · **Branch:** `get4domain-site` · **Authority:** [`docs/reference/GET4DOMAIN_V2_PRD.md`](../reference/GET4DOMAIN_V2_PRD.md) (supersedes all prior PRD/spec documents)
**Mode:** audit and documentation only (PRD §99). No V2 execution, no feature building. The only code change made this session (the DomainCampaign fee correction, `f7ad328`) was a separate, explicitly requested task and is listed under *Post-audit changes*.

## How this audit was done, and its limits

Six parallel read-only inspections (communication, growth/social/AI, BOS core, industries + client WebApp, platform/security/infrastructure, frontend) read the actual service/controller/page code across `backend-api` (NestJS, 75 controllers, 99 Prisma models) and `get4domain_mvp` (Next.js, 89 routes, 453 API-client methods), plus four standalone vendor sites. I then **personally re-verified the most serious claims** in the code (marked ✔ below) and checked live database migration state with a read-only query.

**Limits you must keep in mind:**
- **Static-verified only.** Nothing was run end-to-end. The dev frontend points at the production API, auth-gated flows were not exercised, and creating admin/vendor test credentials is outside what this session may do. Every status is "static-verified" unless stated. §64.3 "100% working" requires runtime verification and tests, which do not exist — so **nothing in the repo can currently qualify as WORKING under the PRD's own definition**; the WORKING counts below mean "complete code path found, no defect found statically".
- Counts overlap slightly (e.g. payment verification appears in BOS, platform and client-WebApp areas).
- Remaining unverified areas are listed in *What was not verified*.

---

## THE ANSWER

> **"Is the existing application currently 100% functional against this PRD?" — No.**

The evidence-based picture, from **362 assessed capability rows** (see [FEATURE_MATRIX.md](FEATURE_MATRIX.md)):

| Status | Rows | Share |
|---|---:|---:|
| WORKING (static) | 56 | 15% |
| PARTIAL | 122 | 34% |
| MISSING | 117 | 32% |
| BROKEN | 25 | 7% |
| BLOCKED-EXTERNAL | 17 | 5% |
| MOCKED | 12 | 3% |
| UI-ONLY | 8 | 2% |
| BACKEND-ONLY | 5 | 1% |
| DEFERRED-APPROVED | 0 | 0% |

Separately, of **84 sampled clickable UI actions**, 46 work, 16 are partial, 6 are mocked, 5 UI-only, 3 broken ([UI_ACTION_MATRIX.md](UI_ACTION_MATRIX.md)); of the **52 dashboard/admin pages**, 41 (79%) are genuinely data-backed and 5 are static/fake.

**What the application genuinely is:** a solid, tenant-scoped *record-keeping and public-site platform* — 20 industries each with real UI→API→DB back-office CRUD (~218 endpoints), a working TeleCRM, campaign landing pages that feed the CRM, a wallet ledger, platform subscription invoicing, a theme marketplace, an AI text studio with wallet metering, and a Managed Services / DomainCampaign admin toolset. Vendor-data tenancy is genuinely good.

**What it is not (against the PRD):** a Business Operating System. HR/payroll, purchasing, stock ledger, GST engine, double-entry accounting, quotation engine, task engine, audit log, automation engine, Social Publisher, SEO Manager, Search Insights, Offers/Loyalty/Referrals, Sales Channels, per-vendor subdomain serving and per-vendor PWA are **missing**. Several shipped features are **mocked or misleading**, and **four money paths and a credential-leak path are insecure** (next section). There are **zero automated tests**.

---

## ⚠ Critical findings that need action independent of the V2 plan

These are defects in the live system, not missing V2 features. They are ranked by harm. ✔ = I re-read the code myself; others are from the evidence files (static).

| # | Severity | Finding | Evidence |
|---|---|---|---|
| S1 ✔ | **CRITICAL** | **Platform payment verification is forgeable.** `POST /payments/verify` checks only the Razorpay HMAC, then marks *any* `invoiceId` PAID (activating subscriptions, granting wallet bonus, recording income) — no ownership, amount, order-binding or replay check. `POST /payments/create-order` accepts *any amount* from any logged-in user. A ₹1 order can settle any invoice, repeatedly. | `payments.service.ts:61-103`, `payments.controller.ts:14-26` |
| S2 | **CRITICAL** | Same flaw in **wallet top-up** (replayable credit), **go-live conversion** (₹1 order → paid Workspace/BOS plan + AI credit) and **premium theme unlock**. | `wallet.service.ts:85-130`, `demo.service.ts:84`, `website-themes.service.ts:50` |
| S3 ✔ | **CRITICAL** | **Public checkout trusts client prices** and is replayable: the order total is `Σ price×qty` from the request body; `confirm` doesn't bind to the paid amount and has no idempotency or webhook. A shopper can buy a ₹1,000 item for ₹1; one real payment can mint unlimited sales. Stock decrement is also a silent no-op. | `public-checkout.service.ts:47-49,52-122`, `engine.dto.ts:60-84` |
| S4 ✔ | **HIGH** | **Password hashes and invite tokens are returned to the browser.** `GET /team/members` returns raw `TeamMember` rows (`password`, `inviteToken`) to *any* vendor session including restricted staff; admin `GET /vendors` returns vendor password hashes to every admin role. Invite tokens never expire. | `team.service.ts:45-47`; `TeamMember` model has `password`, `inviteToken`; `vendors.service.ts:25-35` |
| S5 ✔ | **HIGH** | **WhatsApp inbound webhook is unauthenticated.** The check reads `webhook_secret_key`, which is not defined in the settings catalogue, so the secret always resolves to null and the check is skipped. Anyone can POST forged messages that make the platform message arbitrary numbers, spend AI credits and debit vendor wallets. | `whatsapp-bot.controller.ts:57-71`, `platform-settings.service.ts:121-123`, constants lack the key |
| S6 | **HIGH** | **No rate limiting, lockout, CAPTCHA or helmet anywhere.** Login, register (₹100 free credit per signup, no email verification), OTP request/verify, customer-portal OTP, public leads, public AI chat (platform LLM spend), `/go/:slug/lead` (debits the target vendor's wallet) are all unthrottled. Customer-portal OTP is brute-forceable and is logged/echoed outside production. | grep: no throttler/helmet; `customer.service.ts:49-82`, `otp.service.ts` |
| S7 | **HIGH** | **Admin sub-roles are cosmetic**; every invited admin is minted `role:'ADMIN'` and `AdminGuard` ignores `adminRole`. Marketing staff can delete vendors, mark invoices paid, deduct wallets. | `admin.guard.ts:9-12`, `auth.service.ts:125-131` |
| S8 | **HIGH** | **Restricted team members have owner-level API access** outside 9 controllers — including `PUT /vendor-payments` (they can replace the vendor's Razorpay keys and redirect public-checkout money). Nav hiding is client-side only. | `@RequireModule` on 9/75 controllers; `vendor-payments.controller.ts:18-21` |
| S9 | HIGH | **Vendor invoice collection is broken**: payment links use the *platform's* Razorpay keys and no webhook ever reconciles a `GenericInvoice` (money lands in Get4Domain's account, invoice stays unpaid). Invoice numbering (`count+1`, globally unique, cuid-prefix) can collide; print HTML is unescaped (stored XSS in the owner's browser). | `domainapp/invoices.service.ts`, `generic-invoice.template.ts` |
| S10 ✔ | MEDIUM | **Email delivery is never verified** — Resend's `{data,error}` result is ignored (the SDK returns errors rather than throwing), so rejections are logged as sent and charged. Welcome emails contain the plaintext password. | `email.service.ts:172-182` |
| S11 | MEDIUM | **Mock integrations report success.** Meta publish fabricates a post id and returns `status:'published'` (✔ `meta.service.ts:35-42`); Google Ads launch is a mock; Growth Hub marks a mock-launched ad "active"; AI video returns a stock sample MP4 as the vendor's video when no key is set. | violates PRD §54, §96 |
| S12 | MEDIUM | Wallet debit is read-then-decrement (race can overdraw); campaign approve can debit twice; campaign-page alert debits before sending and never refunds. | `wallet.service.ts:141-167`, `campaigns.service.ts:60-83` |
| S13 | MEDIUM | No password reset/change anywhere (the Settings "Change Password" form is a fake `setTimeout`); "refresh token" just re-signs a 7-day JWT forever; JWT lives in `localStorage`. | `auth.service.ts:195-205` |
| S14 | MEDIUM | Uploads: client-declared MIME, SVG allowed and served same-origin, no quota, **stored on container disk with no volume** (lost on `--force-recreate`, the documented deploy command). | `uploads.controller.ts`, `backend-api/docker-compose.yml` |
| S15 | LOW | Defect in my own DomainCampaign code: `generateInvoice` does not check `record.invoiceId` (the admin UI hides the button once invoiced, the API does not guard). | `domain-campaign.service.ts` |

**Recommendation:** treat S1–S6 as a pre-V2 stabilisation sprint (PRD §91 priority #1: "security/data integrity"). They are a few days of work and each is independent of the V2 build. This audit did **not** fix any of them (PRD §99: audit only).

---

## PRD conflicts and ambiguities that need KSM's decision

1. **Domain Campaign fee (PRD §88).** Resolved by instruction: bracket model implemented (`f7ad328`). **Needs confirmation:** "Enterprise/multi-brand → custom" is implemented as an admin "Mark as Enterprise / Custom" toggle with a manually entered fee per client-month (not a spend threshold). Also assumed: GST (18%) is added on top of the §88 fees, as with every other platform price — the PRD does not say.
2. **Tier naming/pricing.** PRD §69–70 names the products "DomainApp Business Growth System" and "DomainApp Business Operating System" with no prices. The shipped tiers are "Workspace" (₹999/mo, billed ₹11,988/yr) and "BOS" (₹1,999/mo, billed ₹23,988/yr). **Confirm Workspace ≙ Growth System** and whether the PRD's tier boundaries (TeleCRM Lite vs Advanced TeleCRM, manual social publishing for Growth vs approval workflows for BOS) should now drive entitlements. No server-side entitlement enforcement exists today.
3. **AI Reels/Video.** PRD §18/§39 says "Coming Soon". The code ships and markets video generation as live (with a fake sample clip when unkeyed; Kling routed to HeyGen). Decide: relabel Coming Soon, or accept as a deliberate deviation.
4. **Project rules vs reality (`CLAUDE.md`).** CLAUDE.md claims UUID ids, soft delete on every model, JWT + refresh token, `@Roles()`, shadcn/ui, lint/tests before commit. Actual: cuid ids on 98/99 models, `deletedAt` on 1/99 and unused, 69 hard-delete calls, no refresh-token system, no `@Roles()`, no shadcn dependency, no eslint config and no tests. Decide whether the code or the rule changes (V2 PRD §63AB says financial records must not be silently overwritten — implying soft delete/reversal for money tables at least).
5. **Pricing source of truth.** Three places can diverge (Pricing Manager settings, hard-coded fallbacks/constants, the static Admin Plans page). A stale "₹999/month or ₹9,999/year" line also remains on `/features` (`get4domain_mvp/src/app/(marketing)/features/page.tsx:122`), left over from last night's pricing task.

---

# PRD §94 — the 26 required items

### 1. Applications and packages
| App | Stack | Port | Notes |
|---|---|---|---|
| `backend-api` | NestJS 11, Prisma 6.19.3, Postgres (Supabase) | 3008 | 77 modules, 75 controllers, ~480 routes, 99 models, 38 migration folders |
| `get4domain_mvp` | Next.js 15.5, React 19, Tailwind 3.4 | 3006 | marketing + vendor dashboard + admin + customer portal + engine/site routes; 89 `page.tsx`, 3 API route handlers |
| `stepnrock`, `deebiphotography` | Next 14.2 / 13.5 (old, known-vulnerable line), shadcn | 3015 / 3016 | Standalone Bolt-generated vendor sites wired to the shared backend (live) |
| `ksm-quantum` | Next 15 | 3014 | Parent-company site, no backend calls; deploy/DNS pending |
| `allwin-tours` | Next 15 + Anthropic SDK | 3010 | Own chat route with no auth/rate limit |
| `theme-uploads/`, `docs/bolt-*` | assets / reference | — | Theme ingest + Bolt reference sources |

No monorepo tooling: six independent package manifests/Dockerfiles; ~80 loose dispatch docs and several `.zip` bundles in the working tree.

### 2. Current architecture
Single NestJS API (default-deny global JWT guard, global validation pipe with whitelist, response envelope `{success,statusCode,message,data,timestamp}`) + Next.js front end; Supabase Postgres (pooled + direct URL; RLS enabled via a manual SQL script); Docker Compose per app on one VM with nginx; Razorpay (platform + per-vendor keys, AES-256-GCM at rest), Resend, Fast2SMS (SMS/OTP/WhatsApp), ResellerClub, OpenAI/Anthropic, Supabase Storage (AI hero images only). Platform admin is a `Vendor` row with role SUPER_ADMIN; there is an `Industry Website Engine` (`src/engine/`) driving 20 industry sites from a registry. Details: [evidence/platform.md](evidence/platform.md) §1.

### 3. What is genuinely working (static-verified — complete path found, no defect seen)
Vendor-scoped CRUD for the 19 industry modules + DomainApp contacts/catalog/records; TeleCRM (lead list, call log, follow-up queue, CSV import); campaign landing pages → lead → CRM/notification; embeddable widget; AI text generation with real wallet debit (given a key); platform subscription invoicing (GST back-computed); wallet credit ledger; theme marketplace (price/unlock/admin-create); Razorpay *webhook* HMAC; AES-GCM platform settings; travel recurring-contract billing (idempotent cron); vendor Accounts page (DB-backed); letterhead/visiting-card/ID-card generators; Managed Services proposals; DomainCampaign enquiry → client → spend → invoice; response envelope, validation pipe, strict TS, 0 `console.log`, only 2 `any` in backend; tenant scoping on ~95% of vendor routes.

### 4. What is partial
122 rows — the bulk of the product. Representative: pipeline stages (static registry, free-text status, no validation); notes (single overwritten string); roles (8 coarse areas on 9 controllers); POS (no barcode/hold/split/print, client-supplied tax); per-industry modules (CRUD only — no state machines, no double-booking checks, no booking→invoice link); GST summary (cash-basis, excludes POS/web); P&L (excludes POS/restaurant/web revenue); Hub inbox (just a contact list); customer portal (read-only); Domain registration (code real, "NOT verified against a live account").

### 5. What is UI-only
Vendor Settings (fake `setTimeout` "Saved", pre-filled with a real customer's name/email/phone), Admin Settings, Admin Plans (static list), `dashboard/domain-app` index, gym Attendance tab and real-estate Documents tab (ComingSoon stubs), Growth-Hub "schedule reminder" (writes a localStorage key nothing reads).

### 6. What is mocked
Meta publish (fabricated post id, "published"); Google Ads launch; integration "Test connection" (presence check); AI video when unkeyed (stock Google MP4); vendor Notifications page and bell (hard-coded MR Travels data); admin Accounting expenses (browser `localStorage` only); Hub WhatsApp/SMS tabs permanently locked by a static `NEEDS_SETUP` map.

### 7. What is broken
Platform payment verify, wallet top-up verify, go-live/theme-unlock verify, public checkout (S1–S3); vendor invoice payment-link collection (S9); vendor team-invite link (`/team/accept-invite` route does not exist — vendors cannot onboard team members); customer OTP security; demo OTP gate (re-issues the pass cookie without re-verifying the OTP; falls back to a hard-coded signing secret); admin "View Invoice" (unauthenticated hard-coded URL → 401); Analytics Hub wallet spend shown 100× too high (paise as rupees); admin quote-send likely fails (admin email passed as `vendorId`) yet the quote is already marked sent; Kling video routed to HeyGen; POS revenue never reaches Accounts P&L.

### 8. What is missing
Business Master (GSTIN/PAN/branches/numbering/FY/bank/T&C/signature); granular roles; Employee/HR/attendance/leave/payroll/payslip; task engine (the `VendorTask` model is an orphan); purchase/supplier/PO/GRN; stock ledger/warehouses; vendor quotation engine & quote→invoice; credit/debit notes; CGST/SGST/IGST/HSN/GSTR; double-entry accounting; audit log; soft delete; automation engine; message templates/consent/opt-out/queue/DLR; Social Publisher (OAuth, accounts, publications, scheduling); SEO Manager; Search Insights; share links/UTM; Growth Analytics; offers/coupons/loyalty/referrals; Sales Channels/marketplace/shipping connectors; per-vendor subdomain & custom-domain serving; per-vendor PWA; password reset; rate limiting; health endpoint; monitoring; backups; CI; **tests**; refunds/settlement/reconciliation; subscription expiry/renewal enforcement; CSV import/export beyond CRM leads.

### 9. Existing features that must be preserved
Everything in item 3, plus: the Industry Website Engine and its 20 registry industries; the public Action Registry dispatch (`engine.enquiry`, `engine.checkout.*`); vendor-direct Razorpay storage; theme marketplace; campaign pages; TeleCRM; wallet ledger and pricing-manager settings; Managed Services + DomainCampaign admin tooling; travel contracts; the AI-hero-at-vendor-creation flow; standalone-vendor onboarding pattern (stepnrock/deebiphotography). Per PRD §65.3, nothing above is to be removed — migrate it into the new IA and fix it in place.

### 10. Database / schema issues
- **Migration history is not reproducible**: 28 schema tables have no `CREATE TABLE` in any migration (created via `prisma db push` on the VM; the runbook still tells operators to do this). A fresh DB from `migrate deploy` would lack core tables. One applied migration (`20260719093736_add_leads`) exists in the live DB but has no local folder.
- **State verified this session (read-only query):** all 38 local migration folders are applied on the live DB, including `20261001100000` (theme-change tracking) and `20261001110000` (DomainCampaign records). `20261002120000_domain_campaign_custom_fee` (new) is **not yet applied**.
- Convention drift vs CLAUDE.md: UUID ids 0/99; `deletedAt` 1/99 (never used in code); 69 hard deletes; only 10 `$transaction` usages.
- Money stored as `Float` rupees in vendor tables vs `Int` paise in platform tables; no Decimal.
- Orphan models with no code: `VendorTask`, `KitchenTicket`, `Appointment`; `OperationType`/`IndustryExperience` tables are written by seed and never read (4–5 hand-synced copies of industry config).
- Five parameterised raw-SQL calls exist only because the Prisma client wasn't regenerated for `DomainCampaignRecord`.

### 11. Authentication / tenant / permission issues
See S4, S6, S7, S8, S13 and [PERMISSIONS.md](PERMISSIONS.md). Positive: JWT strategy re-loads the principal from the DB every request (suspended vendors/removed staff rejected immediately); bcrypt; vendor-data tenancy is good — **no cross-tenant read/write IDOR was found on industry, DomainApp, CRM, CMS or campaign endpoints** (the most valuable result of the tenancy review).

### 12. Integration status
See [INTEGRATIONS.md](INTEGRATIONS.md). Summary: Razorpay PARTIAL/unsafe; Resend WORKING but unverified delivery; Fast2SMS PARTIAL + BLOCKED-EXTERNAL (DLT/template approvals; mock when no key); WhatsApp is Fast2SMS on a **central** account, not the vendor's own Meta WABA (PRD §11); Supabase Storage PARTIAL; ResellerClub BLOCKED-EXTERNAL; OpenAI/Anthropic WORKING (static); Meta, Google Ads, Runway/HeyGen/Kling MOCKED; Stability AI MISSING (settings entry, no code); LinkedIn/YouTube/GBP/Search Console/Analytics MISSING (the GA id is stored but never injected into any page). Razorpay/Resend keys entered in Admin → Integrations are **ignored** (code reads only `process.env`).

### 13. Test coverage
**0%.** No `*.spec`/`*.test`/e2e files, no test script, no jest/vitest/playwright dependency in any package; no ESLint config/dependency in the two main apps (the `lint` script cannot run); no CI. This is how S1–S3 survived. See [TEST_PLAN.md](TEST_PLAN.md).

### 14. Client WebApp status
20 industry sites on a shared kit are real and data-fed (CMS content, products, enquiries, theme marketplace). But: in 18/20 industries "Book / Reserve / Order" only creates a CRM lead; real cart→Razorpay→order exists on Retail only and is unsafe (S3); live sites show **invented content** (doctors, "15k+ patients", ratings, testimonials, hours, seed properties) wherever the vendor hasn't overridden it; subdomain/custom-domain serving not implemented (middleware matches `/demo` only); no per-vendor PWA (platform-level only; service worker registers only after a push opt-in); vendor-site SEO thin (no vendor sitemap/robots, JSON-LD on one render branch); the three PRD webapp modes (business / e-commerce / restaurant) exist as visual variants, not three distinct customer experiences; no "enable commerce" toggle (§63D). Cart gating (live + paymentsEnabled) is correct. See [INDUSTRY_MATRIX.md](INDUSTRY_MATRIX.md).

### 15. Growth System status
Capture (website enquiry, campaign pages, widget) works into a real TeleCRM; "TeleCRM Lite" statuses/notes/follow-ups exist. Missing: SEO settings/keyword manager/sitemap/schema management, GBP/Search Console/GA integration, backlink tracking, SEO Manager and score, Search Insights, Share Links/UTM, Growth Analytics, Content Studio beyond text generation + 3 print-style document types (no data-aware generation from the business master, no template engine/versioning, library in localStorage, AI images are temporary URLs). Basic documents/billing: invoices yes (weak), estimate/quotation/receipt no.

### 16. BOS status
Record-keeping layer only — see item 8 and [FEATURE_MATRIX.md](FEATURE_MATRIX.md) Part 1. HRM and office management are *advertised as "coming soon"* on the pricing page and are in fact not built. Advanced TeleCRM (assignment rules, round-robin, scoring, lead→customer conversion) is not built (`assignedTo` exists in the API with no UI).

### 17. Social Publisher status
**MISSING.** No OAuth, no connected-account model, no publication entity/status lifecycle, no scheduling, no capability discovery, no token store. The only related code is the mock Meta service (S11), unused by any UI.

### 18. WhatsApp status
Provider = Fast2SMS (central platform account). Outbound send/template send implemented (mock-labelled when unkeyed); an AI/KB auto-reply bot works per-vendor (KB isolation is good, wallet-metered). Missing: vendor's own WABA connection, template lifecycle (name/language/category/approval state), inbound conversation threads UI (Hub tab locked), delivery/read status, broadcasts, consent/opt-out, human hand-off, catalogue sync. Webhook is unauthenticated (S5). BLOCKED-EXTERNAL on Fast2SMS DLT/template approvals.

### 19. SMS status
Fast2SMS bulkV2 via settings key; OTP flow (in-memory store, `Math.random`, 5-attempt cap, 30 s cooldown); transactional/lead notifications as hard-coded hooks; wallet-metered. Missing: provider abstraction, templates model, DLR storage, retry, opt-out, campaigns. BLOCKED-EXTERNAL on DLT.

### 20. Email status
Resend, transactional only (invoice/welcome/notifications), awaited inconsistently; result ignored (S10). Missing: templates model, campaigns, scheduling, bounce/unsubscribe/open/click, sender-domain verification UI.

### 21. Automation status
**No automation engine.** The only automatic behaviour is hard-coded hooks (SMS/WhatsApp/email on a handful of events) and one `@Cron` (travel contract billing). No trigger→condition→action model, no execution log, no retry, no loop protection, no overdue/reminder/follow-up/task automation.

### 22. Industry coverage
Of the 32 industries in PRD §68: **0 WORKING** against the §63X workflow chains, **19 PARTIAL**, **5 UI-ONLY** (demo sub-categories only, no real module: Jewellery, Electronics, Clothing, Sweet shop/Bakery, Astrologer), **8 MISSING** (Grocery/Kirana, Vehicle Dealer, News/Media, Pharmacy, Distributor/Wholesaler, Export House, Group of Companies, Manufacturing). Vehicle Rental is only approximated by the Travel fleet module; Repair/Workshop maps to the `automobile` job-card module (PARTIAL). Real transactional logic exists only for Retail POS, Restaurant order/table/kitchen, and Travel recurring-contract billing. (Per-row detail: [INDUSTRY_MATRIX.md](INDUSTRY_MATRIX.md).)

### 23. Major technical debt
Zero tests/CI/lint; non-reproducible migrations; Float money; three disjoint product stores (`VendorProduct` / `CatalogItem` / `RetailProduct`) and two invoice systems; two WhatsApp stacks (MSG91 legacy + Fast2SMS); three pricing sources; frontend 121 `any`, a single 840-line API client, API-base fallback duplicated in 10+ files; 46 dead API-client methods; 4–5 hand-synced copies of industry config; Node 20 container image (EOL); standalone sites on Next 13.5/14.2; 80 loose docs in the root; stale `CLAUDE.md`.

### 24. Security / data-integrity risks
S1–S15 above. Additional: JWT secret read at import time and a `'dev-secret'`/hard-coded demo-secret fallback; CORS reflects any origin; Swagger open in production; HTTP exception filter returns raw 500 messages; wildcard server block present with no host→site rewrite; no audit log or impersonation trail; platform settings key absent from the local env (verify on the VM).

### 25. Recommended V2 release sequence
Reorders PRD §90's baseline by §91's priorities (security → tenancy/auth → shared engines → complete workflows → connectors → industry → polish):
**V2.0a Stabilise** (S1–S7, S10, tests for money/tenancy, CI, lint) → **V2.0b Foundation** (migration baseline, Business Master, audit log, real roles/permissions, entitlement enforcement, remove fake/mock success) → **V2.1** Client WebApp (honest content, subdomain serving, per-vendor PWA/SEO, checkout safety) → **V2.2** Growth (SEO Manager, Content Studio on business master, social connect + vendor-initiated publish) → **V2.3** Communication Hub (templates, consent, queue/DLR, vendor WABA, automation engine) → **V2.4** Standard BOS (tasks, HR, products/inventory/purchasing, quotation→invoice, GST, accounting) → **V2.5** Industry operations → **V2.6** Hardening. Detail and dependencies: [ROADMAP.md](ROADMAP.md), [RELEASE_PLAN.md](RELEASE_PLAN.md), [TASKS.md](TASKS.md).

### 26. Proposed implementation schedule
PRD §91 forbids inventing dates before team capacity is known. Provided instead: a **single-developer sequence** with relative effort sizes (S ≤ 3 days, M ≈ 1–2 weeks, L ≈ 3–5 weeks, XL ≈ 6+ weeks) and per-release acceptance criteria in [RELEASE_PLAN.md](RELEASE_PLAN.md) and [TASKS.md](TASKS.md). Rough total for the standard-product scope (V2.0a–V2.6) is on the order of **12–20 engineer-months** at the current code quality; sizing should be revisited after V2.0a, when real test coverage exists to estimate against. **These are estimates, not commitments.**

---

## Post-audit changes (since the audit snapshot)

- `f7ad328` — DomainCampaign fee model replaced with PRD §88 brackets + admin Enterprise/Custom override (adds migration `20261002120000_domain_campaign_custom_fee`, **not applied**; apply before deploying: `cd backend-api && npx prisma migrate deploy`). Evidence files written before this commit describe the old 10%/₹9,999 logic; STATUS.md is authoritative.
- Doc-only: superseded notices added to `docs/PRD.md`, `docs/reference/PRD_FULL_PLATFORM_VISION.md`, root `GET4DOMAIN_V2_PRD_CLAUDE_CODE_PROMPT.md`; PRD file renamed from `GET4DOMAIN_V2_PRD.md.md`. `GET4DOMAIN_V2_MASTER_SPEC.md` does not exist in the repo or its git history.

## What was not verified

Runtime behaviour of everything (no live run); real provider round-trips (Razorpay, Fast2SMS, Resend, Resend deliverability, ResellerClub); production environment variables and VM state (e.g. whether `PLATFORM_SETTINGS_KEY` is set; whether Docker uploads path is writable); the ~15 smaller industry services beyond the sampled ones (ownership checks sampled across 19, all consistent); competitor review of lentlosites.com (PRD §53 — not performed; this audit was repository-only); responsive/mobile rendering at the PRD §58 breakpoints; accessibility. These belong to V2.0a/V2.6 verification.
