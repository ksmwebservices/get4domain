# V3 Requirements Matrix — Phase V3.0 (Existing System Audit)

> Source spec: `docs/GET4DOMAIN_V3_MASTER_SPEC.md` (2,020 lines, read in full). Audit date: 2026-11-02. Branch `get4domain-site`.
> **No application code was modified.** Only files under `docs/v3/` were created.

## How this was verified (read this first)

- **Static inspection only.** I read the schema, module tree, routes, middleware, configs, scripts and the V2 audit/dispatch docs. I did **not** run builds, the `bos:verify` / `verify:*` suites, or any live API/DB call. Nothing here is "tested by me".
- **Baseline = V2 audit (2026-10-02, `docs/v2/AUDIT_REPORT.md`, `FEATURE_MATRIX.md`, `INTEGRATIONS.md`)**, then the later V2 dispatches (Commercial Engine, Full BOS, LeadSpace, Website Manager, Industry Designs R1/R2, Existing Clients). Those later dispatches state "built and tested locally, **nothing deployed**". I treat them as *built, locally-verified per their own docs, unverified in production*. Where I could not confirm production state I say so.
- **Several V2 docs are stale** (e.g. `DEPLOYMENT.md` says nothing rewrites `*.get4domain.com` → `/site/<sub>`; `get4domain_mvp/src/middleware.ts` now does). Where code and doc disagree I trust the code.

## Classification key

| Code | Meaning (spec Rule 2) |
|---|---|
| **EW** | Existing and working (per code + docs; not re-run by me) |
| **EI** | Existing but incomplete |
| **RM** | Requires modification (exists, but conflicts with the spec's model) |
| **ND** | New development |
| **CRED** | Needs external API credentials |
| **APPR** | Needs external approval (Meta, DLT, registrar, etc.) |
| **COMM** | Needs commercial configuration (prices, packs, allowances, policy) |

A row can carry several flags, e.g. `EI + CRED + APPR`. "Docs-only" = built in a dispatch, not deployed/verified live.

## Owner decisions applied (2026-11-02, final — override anything earlier in this file's history)

| ID | Decision | Effect on this matrix |
|---|---|---|
| **D1** | V3 covers the **public business directory, instant free websites, and the four plans in spec §3 only: Free, Handyman, Professional, Ecommerce.** Billing: quarterly, half-yearly, annual; optional monthly possible later. Plans, prices, taxes, billing periods, discounts, grace periods and entitlements are **database data editable by admin without code changes.** | Rows in §3 are **ND**. **Workspace and BOS are legacy, out of V3 scope**: not extended, not built on, not deleted, not migrated; existing vendor data is untouched. No "grandfathering" or "build on Workspace/BOS" work exists in the V3 plan. Dependents are listed in the section "Legacy, out of V3 scope" below. |
| **D3** | Keep the existing **HTML/CSS themes**. **Next.js theme packages are deferred.** | §5.3 Next.js row = **Deferred**. |
| **D4** | Redis/BullMQ approved, but **not added in Step 0.** A managed Redis is introduced only when queues are needed (≈V3.6/V3.7). | §19 queue row = **ND, scheduled V3.6/V3.7**. |

## Headline findings (the ones that change the plan)

1. **Plan model: resolved by D1.** Spec §3 (Free, Handyman, Professional, Ecommerce; quarterly/half-yearly/annual; data-driven) is the V3 model. It is **new development** on new tables. The existing Workspace (₹11,988/yr) and BOS (₹23,988/yr) annual-only plans, with the "Essentials / Pro" display names used in later dispatches, are **legacy and out of V3 scope**.
2. **There is no public business directory.** No `/businesses/...` routes, no Listing-as-directory, no location engine, no category/location sitemaps. The `Listing` model in the schema is a *real-estate* module model, not a directory. §7 is almost entirely **ND**.
3. **The "Tenant" is the `Vendor` row.** There is no Tenant/Business/Branch/TenantMember split; auth is single-vendor-per-login with a small `TeamMember`. All 148 model IDs are `cuid()`. §20's "Core" entities are mostly **RM** (map onto Vendor) rather than new tables.
4. **Theme packages exist as sanitised HTML/CSS — not Next.js. Resolved by D3:** keep the HTML/CSS contract (`docs/v2/THEME_CONTRACT.md`); Next.js theme packages are deferred.
5. **Zero automated test files are tracked in git and there is no CI** (`.github/` absent). Verification is bespoke Node scripts (`npm run bos:verify`, `verify:commercial`, `security-verify`). Spec Rule 7 (cross-tenant tests on every important API) cannot be claimed met.
6. **No queue infrastructure.** No Redis/BullMQ anywhere (`backend-api/package.json`, `src/`). Approved by D4 but deliberately **not** added in Step 0; managed Redis arrives ≈V3.6/V3.7. Scheduling today is `@nestjs/schedule` cron in-process.
7. **Many "integrations" are mock/sandbox or credential-blocked** (Meta publish, Google Ads, video, WhatsApp Cloud API approval, ResellerClub untested, Fast2SMS DLT). See `V3_INTEGRATION_STATUS.md`. Rule 6 forbids calling any of these complete.
8. **Open security findings from V2 (S7–S15) are not confirmed fixed** in anything I read. S1–S6 were patched in code (commit 6cf999b) but the V2 docs said "not yet deployed" at the time; current production state is unverified by me.

---

## Legacy, out of V3 scope: Workspace and BOS

Per D1, Workspace and BOS (displayed as "Essentials" and "Pro" in later dispatches) are **legacy**. V3 does not extend, build on, delete or migrate them, and existing vendor data is not touched. This section exists so the owner can decide their fate later.

**Production data is not visible to this audit** (no database access was used). The vendor/subscription/payment lists below are therefore from repository docs and code only and **must be confirmed** by a read-only query (V3.1 Step 0, item 1, once approved). Nothing below should be treated as a complete roster.

### Vendors / subscriptions / payments known to depend on them (from docs)

| Dependent | Evidence | What depends |
|---|---|---|
| **stepnrock** (retail, owner Suresh) | `docs/v2/CLAIMS_VS_REALITY.md:67`, `STATUS.md`, `STEPNROCK_HANDOVER.md` | Workspace plan, half-yearly arrangement; billing term was `ACTIVE_PAYMENT_DUE`; documented invoices `INV-2026-0005` (void) and `INV-2026-0006` (open); one-time AI Studio credit (₹250) pending; `workspace_menu` add-on switched on only for this vendor; BOS spine backfill run command targets it |
| Other live vendors | V2 audit: "0 of 5 live vendors have Razorpay keys" (`VENDOR_DASHBOARD_AUDIT.md:24`) | The five are not named in the docs I read; plan per vendor **unknown** until queried. Known live apps in the repo: MR Travels, Allwin Tours, deebiphotography, stepnrock, indianambulance, ksm-quantum (own site) |
| Vendors on the "legacy_quarterly" / "legacy_yearly" tiers | `payments/plan-pricing.constants.ts` (`QUARTERLY_BASE_PAISE` ₹2,997, `YEARLY_BASE_PAISE` ₹9,999) | Amounts already on the books are classified by `planTierForAmount`; these are an *older* legacy tier than Workspace/BOS |
| Demo vendors | V2: 39 expired demo vendors never cleaned | Not paying; unaffected by plan decisions |

### Code that is legacy-coupled (do not extend)

`backend-api/src/payments/plan-pricing.constants.ts`, `backend-api/src/commercial/*` (deals, entitlements, arrangements, manual payments, pay links), `backend-api/src/registry/provisioning.ts`, `backend-api/src/addons/addons.constants.ts`, `registry/*` (feature registry), `get4domain_mvp/src/lib/workspace-menu.ts`, `get4domain_mvp/src/lib/pricing.ts`, `get4domain_mvp/src/app/dashboard/layout.tsx` (workspace menu), `/admin/commerce/*`, `/admin/plans`, `/admin/pricing/*`, `backend-api/src/bos/*` and `get4domain_mvp/src/bos/*`; scripts `activate-stepnrock*`, `fix-stepnrock-term*`, `set-vendor-access*`, `bos-spine-backfill*`, `commercial-verify/*`.

### Tables that are legacy (do not alter; additive V3 tables only)

Plan/billing: `Subscription`, `Invoice`, `BillingTerm`, `BillingDeal`, `PlanOverride`, `PlanChangeRequest`, `PromoCode`, `PromoRedemption`, `ManualPaymentSubmission`, `PayeeSettings`, `SpecialArrangement`, `CommercialAuditLog`, `PaymentRecord`, `PlatformIncome`; enums `Plan`, `Product`, `BillingPlanKey`, `BillingCycle`, `GstMode`, `BillingTermStatus`, `TermSource`, `DealStatus`, `InvoiceKind`, `PayChannel`, `SubmissionStatus`, `PromoType`, `PlanChangeEffective`, `PlanChangeStatus`.
BOS spine: `BosSettings`, `BosDocSeries`, `BosDocument`, `BosDocumentLine`, `BosPayment`, `BosAllocation`, `BosExpense`, `BosAccount`, `BosJournalEntry`, `BosJournalLine`, `BosStockLocation`, `BosRecurring`.
Menu/entitlement: `VendorAddon`, `VendorModule` rows for `workspace_menu`, `nav_v2`, plan-driven modules.
Wallet rows tagged `ai_studio_bonus`; `ThemeEntitlement` theme-change allowance (2 Workspace / 4 BOS per year).

### Open questions for the owner (not decided; I have not assumed answers)

1. The 20 industry operation modules (`g4d_*` tables for salon, gym, hotel, clinic, etc.), "DomainApp", the universal catalogue (`VendorProduct`, `StockMovement`) and LeadSpace were sold or gated through Workspace/BOS plans. Are they **legacy** too, or **platform assets V3 may reuse**? This decides how much of V3.5 can reuse existing code.
2. Website Manager, category packs, themes and the `/site/<sub>` renderer are plan-agnostic in code but limit pages/storage by LeadSpace/Essentials/Pro. I assume V3.2/V3.3 **reuse the renderer and packs** but replace the limits with V3 entitlements, without touching legacy data. Confirm.
3. When Workspace/BOS vendors exist alongside V3 vendors, should the legacy dashboard and billing stay available to them unchanged (assumed: yes, untouched)?

---

## §1–2 Vision, operating environments, business model

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 1.3A | Public marketplace (search by category/location, profiles, enquiries, cart) | **ND** (directory) / **EI** (enquiry, cart) | No directory routes. Per-vendor storefront + cart + checkout exist (`engine.checkout`, PosSale 'web'). |
| 1.3B | Vendor workspace | **EW / EI** | `/dashboard` v2 with 10 departments, registry-driven (docs-only for v2 shell; behind `nav_v2` per-vendor flag). |
| 1.3C | Internal ops workspace (employees register vendors, manage onboarding, themes, domains…) | **EI** | `/admin/*` exists (customers, themes, domains, leadspace, commerce, managed-services…). Only 3 admin roles (see §18). |
| 2.1 | Domain via reseller API | **EI + CRED + APPR** | ResellerClub client written, **never run against a live account** (`resellerclub.service.ts`). |
| 2.1 | Email via Resend (delivery only, not mailboxes) | **EW** (static) | `RESEND_API_KEY` env only; admin setting ignored (V2 note). |
| 2.1 | SMS reseller / WhatsApp BSP / AI / Social / Google | see §12, 13, 15, 16 | — |
| 2.2 | 15 revenue streams | **EI + COMM** | Subscriptions, domain, wallet/AI credits, themes, managed services, DomainCampaign fee exist. No email/SMS/WA packs, no mailbox subscription, no SEO/creative production products. |

## §3 Subscription plans and pricing

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 3.1 | Free listing + free one-page website | **EI** | LeadSpace free page (twelve trades) + free subdomain site via category packs. No *directory listing* half. Docs-only. |
| 3.2 | Handyman plan ₹999 (Q ₹2,997 / H ₹5,694 / A ₹9,990) | **ND + COMM** | Does not exist. Stored as **plan + plan-price rows** (admin-editable), not code. Workspace/BOS are legacy and are **not** a starting point. |
| 3.3 | Professional plan ₹1,999 (Q ₹5,997 / H ₹11,394 / A ₹19,990) | **ND + COMM** | As above. |
| 3.4 | Ecommerce plan ₹2,999 (Q ₹8,997 / H ₹17,094 / A ₹29,990) | **ND + COMM** | As above. |
| 3.1 | Free plan (₹0) as a real plan row with restrictions | **ND** | Free restrictions (no custom domain, no premium themes, no ecommerce checkout, no advanced CRM…) enforced from entitlement rows. |
| 3.5 | Plan/price engine: Q/H/A + optional monthly; admin-editable prices, **taxes**, discounts, **grace periods**, upgrade rules — all DB data, no code change | **ND** | New tables (plans, plan prices, features, plan features, tax rates, discount rules, subscription terms). The legacy Commercial Engine (`BillingTerm`, `BillingDeal`, `PlanOverride`, promo codes) and the hard-coded `payments/plan-pricing.constants.ts` serve legacy plans only; **V3 neither extends nor reads them.** |
| 3.x | Plan entitlements (features per plan; Locked / Open / Coming soon) | **ND** | New data-driven `Feature` / `PlanFeature` model with one server-side check function. The legacy `registry/` + `provisionModules` + `VendorModule`/`VendorAddon` menu gating is legacy-coupled and is **not** the V3 source of truth. |
| 3.x | Monthly allowances: email/SMS/WA units, social creatives, reels | **ND + COMM** | No allowance/metering tables today. Later phases (V3.7+). |

## §4 Domain services and migration

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 4.1 | Search / register domains | **EI + CRED + APPR** | `domains/` (665 LOC). Wallet-debit-first with refund on registrar failure. Untested live. |
| 4.1 | Nameservers, DNS manager, renewals, expiry/reminders, registrant management, SSL management | **ND** | Only DNS *propagation check* (`dns.resolve4/Cname`) and "connect existing domain". No DNS record editor, renewal, expiry reminders. |
| 4.1 | Pricing by extension / term / reseller cost | **EI + COMM** | Settings category `domain` + `pricing`; not per-extension/term. |
| 4.2A | DNS migration (no transfer): verify ownership → DNS → SSL → canonical → activate | **EI** | Partial: DNS check + activate. No ownership-verification token flow, no automated SSL, no canonical selection. Custom domains today are a **manual nginx/Cloudflare runbook** (`docs/v2/CUSTOM_DOMAIN_RUNBOOK.md`). |
| 4.2B | Registrar transfer (auth-code, status tracking, complete only on registrar confirm) | **ND + CRED + APPR** | Nothing exists. Auth-code secure handling must be designed (encrypted, never logged). |
| 4.3 | Domain Manager dashboard (11 tabs) | **EI** | `dashboard/domain-management` exists; tabs mostly absent. |

## §5 Website builder and manager

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 5.1 | Instant free one-page site from registration | **EI** | `starter.service`, `site-doc`, category packs (12 trades + 20 industries). Docs-only; per-vendor flag `site_doc_v2`. |
| 5.2 | ≥5 usable themes (corporate, healthcare, real estate, construction, ecommerce) | **EI** | 13 built-in themes (`site-themes.json`) + reference themes; imported HTML themes. Mapping to the five named verticals not confirmed. |
| 5.3 | Admin theme upload: validate → preview → publish → marketplace | **EI** | `ThemePackage`, `ThemeAsset`, `ThemeEntitlement`, `themes/core/{sanitise,lint,contract}`, `/admin/themes`. Docs-only for round 2. **Format differs from spec (HTML/CSS, not Next.js).** |
| 5.3 | Theme security (no arbitrary code, size limits, version, rollback, tenant isolation) | **EW** (design) | Script-free contract, sanitiser, lint CLI, size limits. Rollback via versions. Static review only. |
| 5.3 | Next.js theme packages with controlled build/preview deployments | **Deferred (D3)** | Out of V3 scope for now. The HTML/CSS contract is the supported format. |
| 5.4 | Vendor Theme Marketplace (browse, filter, desktop/mobile preview, preview with own content, activate, change, restore) | **EI** | Paid yearly marketplace, unlock/buy, `theme-preview`, theme-change limits (2/4 per year). Per-plan eligibility mapping to V3 plans = **RM**. |
| 5.5 | Global/page/section managers (all listed components) | **EI** | Website Manager: `VendorCMS` single-row model + `draft` JSON + pack sections. Not a relational Pages/Sections model (§20 wants `WebsitePages`, `WebsiteSections`). |
| 5.5 | Draft / preview / publish / revision history / restore | **EW** (docs) | `SiteVersion` keeps last 10 versions; signed 30-min preview link. |
| 5.5 | Schedule publication | **ND** | Not found. |
| 5.5 | Employee approval + vendor approval workflow | **ND** | Not found. |
| 5.5 | Shared content schema reused by directory, website, chatbot, CRM | **EI** | `VendorCMS` is read by site, sitemap, readiness, WhatsApp bot (per doc). Directory/CRM reuse absent. |

## §6 Hosting and multi-domain

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 6 | Wildcard subdomain routing | **EW** (static) | `middleware.ts` `vendorHostRewrite` → `/site/<sub>`; nginx `*.get4domain.com`. Reserved-host list present. |
| 6 | Custom-domain routing (same tenant, no duplicate site) | **EI** | Middleware only matches `*.get4domain.com`; **custom domains require manual nginx** and are not resolved by `customDomain` in middleware. |
| 6 | Domain verification, SSL provisioning, canonical, secondary redirects, uptime monitoring | **ND** | SSL is Cloudflare Flexible / manual certbot. No `/health`, no monitoring in repo. |
| 6 | Tenant-specific SEO | **EW** | Per-host `robots.txt` / `sitemap.xml` routes exist. |

## §7 Directory and public marketplace — **the main V3.2 deliverable**

**Naming rule:** the existing Prisma model `Listing` (table `g4d_listings`) belongs to the real-estate module and must not be reused, renamed or shadowed. New directory objects use the `Directory*` prefix: `DirectoryBusiness`, `DirectoryCategory`, `DirectoryLocation`, `DirectoryBusinessService`, `DirectoryBusinessProduct`, `DirectoryBusinessMedia`, `DirectoryPlacement`, `DirectoryReview`; tables `g4d_directory_*`. Public wording may still say "listing"; code, tables, API routes and DTOs do not.

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 7.1 | Searchable public directory, 21 initial categories, subcategories | **ND (V3.2 core)** | Vendor category taxonomy migration (`20260924010000`) exists; no public directory. Category list ≠ spec's 21 (reconcile into `DirectoryCategory`). |
| 7.2 | `/businesses/`, `/businesses/<state>/`, `/businesses/<state>/<city>/`, `/businesses/<state>/<city>/<category>/`, `/business/<slug>/` | **ND (V3.2 core)** | Absent. Needs `DirectoryLocation` (no location model exists). |
| 7.2 | Search (keyword + category + location) | **ND (V3.2 core)** | Absent. Start with Postgres full-text/trigram on the same database; no new search service in V3.2. |
| 7.3 | Business profile features (hours, map, verification status, services, products, gallery, enquiry form, WhatsApp/website links) | **ND (V3.2 core)** | Reviews (`DirectoryReview`) only if moderation is in scope; no Review model exists. |
| 7.4 | Plan-based appearance; sponsored labelling; organic relevance not purely price-ranked | **ND + COMM** | Driven by V3 plan entitlements (D1). Absent. |
| 7.x | Directory sitemaps (main, category, location, business) + sitemap index; noindex for thin pages | **ND** | Part of V3.2 (basic) and V3.9 (full SEO). |

## §8 Central Enquiry Hub

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 8.1 | Multi-source enquiry capture | **EI** | Website forms, LeadSpace verified leads (OTP), WhatsApp bot, widget, public checkout → CRM lead. No directory, Messenger/Instagram, Facebook Lead Ads. |
| 8.2 | Enquiry object (ID, tenant, source channel/account, consent, attribution, conversation ref) | **EI** | `Lead` (status/source/assignedTo), `LeadEvent`, `ConsentRecord`, `LeadOtp`. No single unified Enquiry entity or conversation reference. |
| 8.3 | Routing engine to vendor CRM + notification + attribution | **EI** | Lead → vendor CRM and notifications exist per channel; no central router/attribution report. |
| 8.4 | Separate central vs vendor identities/inboxes | **EI** | `VendorCommsSettings` per-vendor WA config; central inbox absent. |

## §9 Chatbots

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 9.1A | Central Get4Domain website chatbot | **ND / EI** | `widget/` embeddable widget + AI service; central directory-aware bot absent (no directory). |
| 9.1B | Vendor website chatbot (FAQ, lead capture, handover) | **EI** | `widget`, `KnowledgeBaseEntry`, `WhatsappConversation`. Human handover not confirmed. |
| 9.1C | WhatsApp bot (central + vendor) | **EI + CRED + APPR** | `whatsapp-bot/` on **Fast2SMS** WhatsApp; separate Cloud-API provider (`messaging/whatsapp/cloud-api.provider.ts`) with sandbox; **common number awaiting Meta approval**. Webhook was fail-open → patched fail-closed (bot offline until secret set). |
| 9.1D | Messenger / Instagram bots | **ND + CRED + APPR** | Only publish-side `social/` (sandbox). No inbound messaging code. |
| 9.2 | Common chatbot engine (config, FAQ, intents, history, channel adapters, handover, usage, consent, audit) | **EI → RM** | Pieces exist per channel; no shared engine/adapters. |

## §10 CRM and telecalling

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 10 | Lead pipeline New→Contacted→Qualified→Follow-up→Converted→Lost | **EI / RM** | `Lead.status` is a free String default `"pending"`; pipeline values not enforced. Also `crm/`, `admin-crm/`, `telecrm`. |
| 10 | Customer records, notes, tasks, reminders, call records, appointments | **EI** | `Contact`, `LeadCallLog`, `CallLog`, `VendorTask`, `Appointment` (booked/completed/cancelled/no_show). |
| 10 | Assignment, duplicate detection, export, reports | **EI** | `assignedTo` present; dedupe/export/reports not in place. (Existing BOS reports are legacy, not reusable under D1.) |
| 10 | Telecalling compliance (consent / telecom rules) | **EI + COMM** | LeadSpace compliance pack exists; legal answers pending (CA/lawyer per docs). |

## §11 Ecommerce

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 11 | Catalogue, categories, inventory, cart, checkout, orders | **EI** | `VendorProduct` universal catalogue (**migration written, not applied; cutover pending**), stock ledger (`StockMovement`, variantKey), public checkout (ORDER_REQUEST / ONLINE), `PosSale`. 3 disconnected product stores flagged in V2 audit. |
| 11 | Variants | **EI** | `variantKey` string on stock/lines; no `ProductVariants` entity. |
| 11 | Vendor-direct Razorpay (separate from platform collections) | **EI** | `VendorPaymentConfig` (AES-GCM keys); V2 flagged client-priced checkout → patched S2; **0 of 5 live vendors could take online payments** (V2 audit). |
| 11 | Coupons / discount rules (vendor-side) | **ND** | `PromoCode` exists but for *platform plan* promos only. |
| 11 | Shipping integration, tracking | **ND + CRED** | Only a `shippingPaise` amount; no carrier integration. (`Shipment` model is logistics module.) |
| 11 | Returns / refunds | **ND** | Only legacy BOS credit notes exist (out of V3 scope). A V3 customer return-request / refund workflow is new development (V3.5, Ecommerce plan). |
| 11 | Customer accounts | **EI** | `customer/` OTP portal (not a store account with order history across vendors). |
| 11 | COD | **EI** | ORDER_REQUEST mode ≈ pay-on-confirm; explicit COD not confirmed. |
| 11 | Sales analytics | **ND** | Only legacy BOS reports/Today exist. New V3 reports in V3.5. |

## §12 Communication and usage billing

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 12.1 | Resend transactional email | **EW** (static) | No bounce/complaint webhook or suppression list. |
| 12.1 | Business mailboxes (info@company) | **ND + CRED + COMM** | Out of scope of Resend per spec; no provider chosen. |
| 12.2 | SMS reseller API (OTP, alerts, promo) | **EI + CRED + APPR** | Fast2SMS; DLT sender/entity/template IDs external; falls back to MOCK log when no key. |
| 12.3 | WhatsApp Business Platform | **EI + CRED + APPR** | See §9.1C. |
| 12.4 | Included allowances per plan + prepaid packs w/ validity | **ND + COMM** | None. `WalletTransaction.expiresAt` exists — a possible hook. |
| 12.5 | Usage ledger (provider cost, selling price, status, allowance, idempotency) | **ND** | No `UsageTransaction`. Idempotency exists for payments (`razorpayId @unique`, replay guard) — pattern reusable. |

## §13 AI Creative Studio

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 13 | Copy, posters/banners, social posts | **EI + CRED** | `ai/` (OpenAI preferred, Anthropic fallback), wallet debited after success; image failures masked earlier, patched in stepnrock handover. |
| 13 | Reels / promo video / brand films | **EI → mock** | Video providers mocked when unkeyed; UI relabelled "Coming soon" in Release 1A (no wallet debit — proven by test per doc). |
| 13 | Brief→Concept→Generate→Review→Approve→Deliver→Publish workflow, credits per plan | **ND / EI** | Single-shot generation; no brief/approval pipeline; credit grants exist as one-time bonuses, not monthly plan credits. |

## §14 SEO / GEO / AEO

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 14.1 | Editable titles/meta/canonical/OG, alt text | **EW / EI** | `VendorCMS` SEO fields, favicon, ogImage. |
| 14.1 | Structured data | **EI** | JSON-LD present in site renderer (pack search type) and marketing pages. |
| 14.4 | Sitemaps | **EI** | Per-vendor host `sitemap.xml`, `sitemap-leadspace.xml`, root `sitemap.ts`. Category/location/business sitemaps + sitemap index absent (no directory). |
| 14.5 | Robots.txt for main / subdomains / custom domains | **EI** | Main + per-subdomain routes; custom domain unresolved. |
| 14.6 | RSS/Atom feeds | **ND** | No feed generation found. |
| 14.1 | Redirect management | **ND** | Not found. |
| 14.1 | Search Console / GA integration | **ND + CRED + APPR** | GA ID stored/rendered only; no Data API; no Search Console. |
| 14.7–14.8 | AI-crawler policy, link attributes (sponsored/ugc) | **ND** | No policy; N/A until directory exists. |

## §15–16 Social operations and marketing engine

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 15.2 | Central Social Manager (calendar, composer, drafts, approval, schedule, publish, results) | **EI** | `social/` module + `SocialAccount`, `SocialPost`, `PostJob`, `PromotionPlan`; encrypted tokens, caps, retries, kill switches; **SANDBOX provider only**; channels FB Page / Instagram / Telegram / GBP. Docs-only. No YouTube/LinkedIn/WhatsApp Channel. |
| 15.2 | Real publishing | **CRED + APPR** | Meta app review, business verification. |
| 15.3 | Vendor social (connect own accounts) | **EI + APPR** | No OAuth flow (V2 finding); token paste model. |
| 16 | Managed-activity entitlements per plan (1/2/3 activities, creatives, reels) | **ND + COMM** | `ManagedServiceCatalogItem`, `DomainCampaignRecord` exist; no monthly entitlement counters. "Managed promotional activity" definition is an admin-config decision (spec says so). |
| 16 | Google/Meta Ads management | **MOCK + CRED + APPR** | `google-ads`, `meta` services return mock success (V2). `AdSpendEntry` ledger exists. |
| 16 | Campaign reports | **EI** | LeadSpace + DomainCampaign reporting; no ad-platform data. |

## §17–18 Admin / employee operations

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 17 | Admin theme/website/domain/SSL/migration/health modules | **EI** | Themes, domains, customers, vendor-access exist; migration mgmt, SSL mgmt, health monitoring **ND**. |
| 17 | Record all employee changes | **EI** | `CommercialAuditLog` (commerce actions only); `SiteVersion` records site versions. No platform-wide `AuditLogs`. |
| 18 | 14 roles | **RM / ND** | `AdminRole { SUPER_ADMIN, MARKETING, OPERATIONS }` + `Role { SUPER_ADMIN, ADMIN, VENDOR }`. V2 S7 (admin sub-roles) and S8 (team-member module guards) were open. |
| 18 | 27 admin modules | **EI** | ~11 present in some form (vendor mgmt, themes, domains, plans/pricing, commerce, leads/CRM, managed services, AI studio, settings, support, utilization). Others **ND** (chatbot mgmt, enquiry hub, SEO mgr, social mgr UI, communications usage, wallet UI at admin level, reports…). |

## §19 Technical architecture

| # | Requirement | Class | Evidence / notes |
|---|---|---|---|
| 19 | Next.js + TS + Tailwind + NestJS + Postgres + Prisma | **EW** | Next 15.5 / React 19 / Tailwind 3.4; NestJS 11; Prisma 6.19.3; Supabase Postgres. (Standalone vendor sites run older Next: 13.5.1 / 14.2.35.) |
| 19 | Redis + BullMQ background jobs | **ND — approved (D4), scheduled ≈V3.6/V3.7** | Not present and **not added in Step 0**; managed Redis only when queues are needed. |
| 19 | Storage (object storage / Supabase) | **EI** | Local-disk uploads on Docker named volumes; Supabase Storage only for AI hero image. |
| 19 | Razorpay (platform) + vendor merchant integrations | **EI + CRED** | Razorpay Plans for annual tiers still to be created by KSM; keys env-only. |
| 19 | Multi-tenant context; all business data tenant-scoped | **EI** | Vendor-scoped queries; JWT carries vendor; RLS enabled via manual SQL script (`prisma/sql/enable_rls_public.sql`, must be re-run after migrations). Not enforced via a tenant guard abstraction. |
| 19 | Encrypted secrets, secure webhooks, audit | **EI** | AES at rest for platform & vendor keys (`PLATFORM_SETTINGS_KEY`); Razorpay webhook HMAC (only `payment_link.paid`); no Resend/Meta/Fast2SMS delivery webhooks. |
| 19.3 | Theme deployment separation (builds/previews/rollback) | **EI** | Server-side render of sanitised HTML (no untrusted code execution). No separate build/preview-deploy pipeline (unnecessary for HTML/CSS contract). |

## §20 Database design — entity coverage

148 `cuid()` IDs; **150 `model` + 21 `enum`** blocks; **53 migration folders** (28 core tables historically created by `prisma db push`, drift noted in V2 `MIGRATION_PLAN.md`; `20260719093736_add_leads` applied in DB with no local folder).

| Spec group | Coverage |
|---|---|
| Core (Users, Roles, Permissions, Tenants, Businesses, Branches, Employees, TenantMembers) | **RM** — `Vendor`, `AdminTeamMember`, `TeamMember` partially cover; no Permissions/Tenant/Business/Branch tables. |
| Subscription (Plans, PlanPrices, Features, PlanFeatures, Subscriptions, Entitlements, UsageRecords, Invoices, Payments, Refunds) | **ND** under D1. New V3 tables for plans, prices, features, plan features, taxes, discounts, subscription terms, entitlements, refunds, usage. The existing `Subscription`, `Invoice`, `BillingTerm`, `BillingDeal`, `PlanOverride`, `PaymentRecord`, `PromoCode` tables are **legacy (Workspace/BOS era), out of V3 scope**. Where V3 needs invoices/payments it adds V3-named tables rather than altering these. |
| Website (Websites, Domains, DomainVerifications, DNSRecords, SSLRecords, WebsitePages/Sections/Revisions/Media, ThemePackages/Versions/Deployments) | **EI** — `VendorCMS`(single row), `SiteVersion`, `MediaAsset`, `ThemePackage`(versioned), `ThemeAsset`, `ThemeEntitlement`, `WebsiteTheme`; domain fields live on `Vendor`; `DomainRegistration` exists. No Verification/DNS/SSL tables. |
| Directory | **ND** (see §7; `Category`, `CategoryPack` exist) |
| Domain | **EI** — `DomainRegistration` only. DomainTransfers / MigrationJobs / RegistrarTransactions / RenewalRecords **ND**. |
| Communication | **EI** — `VendorCommsSettings`, `WhatsappTemplate`, `WhatsappMessageLog`, `Message`, `Notification`. Email/SMS message logs, packs, usage transactions **ND**. |
| Chatbot | **EI** — `KnowledgeBaseEntry`, `WhatsappConversation`. Bots/Channels/Configurations/Handover **ND**. |
| CRM | **EI** — `Contact`, `Lead`, `LeadEvent`, `LeadCallLog`, `CallLog`, `VendorTask`, `Appointment`. |
| Social | **EI** — `SocialAccount`, `SocialPost`, `PostJob`, `PromotionPlan`. |
| Marketing | **EI** — `Campaign`, `CampaignPage`, `AdSpendEntry`, `DomainCampaignRecord`, `ManagedServiceCatalogItem`. SEOAudits/Keywords/AnalyticsReports **ND**. |
| Ecommerce | **EI** — `VendorProduct`, `StockMovement`, `PosSale`, `BosDocument*`, `Shipment`(logistics). Carts/Customers/Returns entities **ND**. |
| AI | **EI** — `AiTemplate`; wallet debit records. Briefs/Generations/Assets/Revisions **ND**. |
| Operations | **EI** — `SupportTicket`, `Notification`, `CommercialAuditLog`, `VendorTask`. OnboardingTasks, Approvals, platform `AuditLogs` **ND**. |

## §21–22 Roadmap and development rules — current compliance

| Rule | Status |
|---|---|
| 1 Inspect first | This audit. |
| 2 Traceability matrix | This file. |
| 3 Preserve functionality / data | Constraint on every V3 phase; additive-migration verify scripts exist (`verify-migrations-additive.js`). |
| 5 Secure theme uploads | Contract is script-free (EW design). |
| 6 External API honesty | Integration status tracked in `V3_INTEGRATION_STATUS.md`. |
| 7 Tenant-isolation tests | **Not met** — no test suite; ad-hoc security scripts only. |
| 8 Migrations / backups | Many migrations are "written, not applied"; ordered VM runbooks exist; backups not in repo. |
| 10 No fake functionality | Prior Release 1A removed unbuilt claims; mocks (Meta, Google Ads, video) must stay labelled. |
| 11 Tracker docs | 7 required; this phase creates 4. `V3_API_DOCUMENTATION`, `V3_TEST_REPORT`, `V3_CHANGELOG` start in V3.1. |
