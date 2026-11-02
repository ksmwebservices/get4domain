# V3 Implementation Plan (Phase V3.0 output)

> Derived from `V3_REQUIREMENTS_MATRIX.md`. Audit-only: nothing here has been started. Each phase below needs **explicit approval** before it begins (spec Rule 9; CLAUDE.md "never auto-advance").

## 0. Decisions needed before V3.1 (blocking)

| # | Decision | Why it blocks | Recommendation |
|---|---|---|---|
| D1 | **Plan model**: keep Workspace/BOS (annual-only, ₹11,988/₹23,988) or adopt spec's Handyman/Professional/Ecommerce with Q/H/A billing and spec prices | Entitlements, billing engine, registry, pricing pages, Razorpay Plans all hang off it. KSM retired quarterly on 2026-10-01; spec re-introduces it. Live vendors (stepnrock etc.) are on current terms | Keep the existing engine (it already supports `HALF_YEARLY`, `ANNUAL`, `MONTHLY`, `CUSTOM_MONTHS`); make plans **data-driven** and map spec tiers onto it. Do **not** re-price existing vendors; grandfather. KSM confirms the three tiers + whether quarterly returns |
| D2 | **Tenant model**: introduce `Tenant` entity or keep `Vendor` as tenant | Affects every later migration and §20 "Core" | Keep `Vendor` as the tenant (no ID rewrite). Add only what is missing (see migration plan: roles/permissions, branches later) |
| D3 | **Theme format**: HTML/CSS contract (shipped) vs Next.js packages (spec §5.3) | Scope of V3.3 | Keep HTML/CSS as the supported format; record Next.js package support as a later, sandboxed, separate-build-service phase |
| D4 | **Queue infra**: add Redis + BullMQ | Needed for scheduled social posts, usage metering retries, domain polling, email/SMS dispatch at scale | Add in V3.1/V3.7 behind an interface; keep `@nestjs/schedule` for light cron |
| D5 | **Directory ownership**: new `DirectoryListing` vs reuse `Listing` | `Listing` is the real-estate module's table | New table(s); do not reuse |
| D6 | Pending-deploy backlog (see §2) is applied/deployed **before** V3 migrations are layered on | Stacking V3 migrations on an unreconciled production history is the biggest operational risk | Reconcile first, in V3.1 step 0 |

## 1. Phase plan

Effort is in rough engineer-weeks for one engineer and is an **estimate, not a commitment**. "Reuse" names existing code to extend rather than duplicate (Rule 3/4).

### V3.1 — SaaS Foundation (est. 3–4 wks)
- **Step 0 — Stabilise baseline:** reconcile migration state with production (read-only check first), confirm which security fixes (S1–S6) are deployed, close S7–S15 that remain open, add a `/health` endpoint, introduce CI that runs build + existing `verify:*` scripts. Introduce a real test runner (Jest for Nest, Vitest or Jest for pure logic).
- **Plans/entitlements as data:** `Plan`, `PlanPrice`, `Feature`, `PlanFeature` tables seeded from today's constants and `registry/`. Keep `plan-pricing.constants.ts` as a read-only fallback until cutover. *Reuse:* Commercial Engine (`BillingTerm`, `BillingDeal`, `PlanOverride`), `registry/` feature registry, `provisionModules`.
- **Tenant guard abstraction:** one decorator/guard resolving `vendorId` from JWT/host, used everywhere; start the cross-tenant test suite (Rule 7).
- **Staff roles:** extend `AdminRole` to the 14 spec roles via a role→permission table rather than a larger enum. *Reuse:* `AdminTeamMember`, admin-team module, permissions doc `docs/v2/PERMISSIONS.md`.
- **Audit log:** platform-wide `AuditLog` (generalise `CommercialAuditLog`).
- **Vendor registration + employee-assisted registration:** reuse auth/vendors, add "registered by employee" provenance.

### V3.2 — Directory and Free Website (est. 4–5 wks)
- **New:** Location engine (state/district/city), Category tree (reconcile with `Category`/`CategoryPack`/vendor taxonomy), `DirectoryListing` + service/product/media/placement tables, public routes `/businesses/...` and `/business/<slug>`, directory sitemaps + sitemap index, listing enquiry form → existing Lead pipeline.
- **Reuse:** category packs and `starter.service` for the instant free one-page site; `/site/<sub>` renderer; LeadSpace free page; SEO routes.
- **Rules to build in:** sponsored labelling; organic relevance not purely price-ranked; avoid thin location pages (noindex until threshold).
- **Free-plan restrictions** enforced server-side through the V3.1 entitlements.

### V3.3 — Theme Marketplace and Website Manager (est. 3–5 wks, mostly hardening)
- **Mostly exists** (round 2, undeployed). Work: confirm/ship the deployed state, map eligibility to V3 plans, ensure five themes cover the named verticals, add **schedule publication** and **employee/vendor approval** states, decide pages/sections relational model vs `VendorCMS` JSON (recommend keeping the JSON document model and adding a read-only projection if §20 tables are wanted for reporting).
- **Defer:** Next.js theme packages (D3).

### V3.4 — Domain Services (est. 5–7 wks; heavily credential-gated)
- **First:** validate ResellerClub on the OT&E sandbox (never run live). Registrar adapter interface so a second registrar can be swapped in.
- **New:** DNS record manager, nameserver manager, domain-ownership verification (TXT token), automated TLS for custom domains (decision: Cloudflare for SaaS / Caddy on-demand TLS / certbot — current setup is manual per-domain nginx + Cloudflare), custom-domain tenant resolution in middleware + canonical redirect, transfer workflow with encrypted auth-code handling, renewal/expiry reminders and cron, migration-history records.
- **Never** mark a transfer complete until the registrar confirms (spec §4.2).

### V3.5 — Paid Webapps and CRM (est. 5–7 wks)
- **Reuse heavily:** 20 industry operation modules, BOS spine, Counter billing, CRM, telecrm, Appointment.
- **Modify:** enforce the six-stage pipeline, duplicate detection, export; vendor-side coupons/discounts; variants entity; shipping adapter (carrier choice = commercial decision) and returns request flow; finish **Universal Catalogue** cutover (migration is written, not applied) so web, POS and BOS read one catalogue.

### V3.6 — Central Enquiry Hub and Chatbots (est. 5–6 wks; approval-gated)
- **New:** unified `Enquiry` entity + router + attribution report over existing Lead/LeadEvent; central inbox model; common chatbot engine (config, knowledge source, intents, history, channel adapters, handover, consent, usage); adapters for Website widget (exists), WhatsApp (two providers → consolidate behind one interface), Messenger, Instagram.
- **Gate:** Meta app review + Page/Instagram permissions + WhatsApp number approval. Build behind adapters with sandbox providers; label "Pending approval".

### V3.7 — Communication and Billing (est. 4–5 wks)
- **New:** `UsageTransaction` ledger (idempotency key = provider message id or request id), per-plan monthly allowances with reset policy, prepaid packs with validity, provider cost vs selling price, failed-message charging rules per provider, reports. Resend webhooks for bounce/complaint + suppression list. SMS DLT mapping.
- **Reuse:** wallet (`Wallet`, `WalletTransaction.expiresAt`), payment idempotency patterns (`razorpayId @unique`, advisory locks via `advisoryXactLock`).
- **Gate:** provider contracts, DLT registration, provider cost sheet (spec's allowance numbers are "subject to provider cost validation").

### V3.8 — Social and Marketing Operations (est. 4–5 wks; approval-gated)
- **Reuse:** `social/` publisher (sandbox providers, caps, retries, kill switches). Add content calendar UI, approval flow, platform formatting, YouTube/LinkedIn/WhatsApp Channel only if APIs permit; OAuth flows for vendor accounts (currently token paste). Marketing request workflow + monthly entitlement counters. Manual publishing fallback first.
- **Gate:** Meta/Google/LinkedIn/YouTube reviews.

### V3.9 — SEO, GEO, AEO (est. 3–4 wks)
- RSS/Atom, redirect manager, sitemap index + category/location/business sitemaps (after V3.2), structured data per entity, technical SEO audit job, Search Console + GA4 Data API (OAuth), robots policy for custom domains, thin-content guards.

### V3.10 — Production Testing (est. 3–4 wks)
- Tenant isolation suite on every API, security review (re-run `security-verify`, S1–S15 closure), integration tests behind sandbox flags, E2E (browser), load/perf, backup + restore drill, migration rehearsal on a production copy, blue/green or rollback procedure, Node base image upgrade (Node 20 is EOL), upgrade standalone sites' Next versions.

**Total (single engineer, sequential): ≈ 40–50 weeks** before external approvals/credentials, which can add calendar time independent of effort. Treat as order-of-magnitude.

## 2. Pending production backlog to reconcile in V3.1 Step 0

(From V2 docs; **production state unverified by me** — the first action is a read-only check of `_prisma_migrations` and deployed commit.)

- Migrations documented as "written, not applied" at various dates: `domain_campaign_custom_fee`, `payment_idempotency`, `universal_catalogue_columns`, `stepnrock_handover`, `special_arrangements`, `bos_spine`, `leadspace` (+ `page_stats`, `followups`), `website_manager`, `industry_designs`, `theme_packages`, `existing_clients`, `ai_credit_per_term`. Several were later noted as applied; the latest authoritative statement must be re-verified.
- Razorpay Plans (annual Workspace/BOS) to be created by KSM; Payee & QR configuration; stepnrock activation.
- RLS script must be re-run after every migration that adds tables.
- Decisions awaiting KSM listed in `docs/v2/STATUS.md`.

## 3. Cross-cutting engineering rules for every V3 phase

1. **Additive migrations only**; `verify-migrations-additive.js` + `verify-migrations.js` must pass; back up before applying; never `db push` against production.
2. **Feature flags per vendor** (existing pattern: `nav_v2`, `site_doc_v2`) so a phase can ship dark and be switched on vendor by vendor.
3. **No fake functionality** — a UI action must have a working backend or be shown "Coming soon"/"Pending approval". Mock providers remain labelled.
4. **Integrations behind adapters** with `sandbox | live` mode and status values from Rule 6.
5. **CLAUDE.md conflicts** (for a decision, not for me to resolve): the platform CLAUDE.md says UUID IDs, soft delete (`deletedAt`), refresh tokens, shadcn, lint/tests required. Actual code: `cuid()`, no soft delete on most models, bearer JWT, no shadcn, no tests. V3 plan follows *reality* and does not mass-rewrite IDs; new tables may adopt `deletedAt` where the spec's retention rules need it.
6. Each phase ends with the Rule 9 report (objective, reuse, files, DB changes, routes, frontend, tests, results, outstanding) and updates this tracker set.

## 4. Proposed first slice after approval (V3.1 Step 0 only)

Read-only production reconciliation → CI + test runner + `/health` → tenant-guard + first cross-tenant tests → S7–S15 closure list. No new product features until that baseline is green.
