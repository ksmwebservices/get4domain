# 20. V3 Stage 2 audit: summary (A to O)

Lane: "Audit V3, Stage 2". Read-only. Date of the run: 2026-11-21. No code edited, no server or database touched, no `.env` read, no heavy test run. Static read plus `git`, `ls`, `grep` only.

## How to read this

**Three code lines make up V3. Nothing is merged to one trunk.** Every claim below names the folder it was read in:

| Short name | Folder | Branch (head) | What it holds |
|---|---|---|---|
| **BE** | `C:\Get4Domain\get4domain-w2\backend-api\src` | `v3-lane-e1` (`d74c9c0`, 20 Nov 2026) | The whole V3 backend. It already contains b2, b3, b4, b4b, b5, b9, b11, b13, p0, s51/53/54, seo1, w2/w3/w4. It does NOT contain `v3-inv` (9 commits, V2 inventory docs), `v3-seo0` (4) and `v3-themes` (1). |
| **UI** | `C:\Get4Domain\get4domain-ui` (its own git repo) | `v3-ui-s17` (`725c8d0`, 19 Nov 2026) | Vendor, admin, partner and marketing Vite apps, plus `packages/api` (typed client). |
| **PUB** | `C:\Get4Domain\get4domain-pub\get4domain_mvp\src` | `v3-pub-a1` (`aa0d08d`) | The Next.js public site: main site, directory, vendor-host renderer, portal. 109 commits ahead of `v3-lane-e1`, all in `get4domain_mvp/` and `docs/v3/` (git diff stat: 436 files, `get4domain_mvp/src` 263). Its own `backend-api/` is an older copy, not the V3 backend. |

Evidence labels: `BE file:line`, `UI file:line`, `PUB file:line`. "Prior audit" = `get4domain-w2/docs/v3/COMPLETION_AUDIT.md` (dispatch F1, written before the UI got the real record screens; I re-checked each item I rely on against current code and say where it is now stale).

**Status rule (strict, as the brief asks).** PROVEN = I can point to code AND a test or a recorded run that proves the whole question end to end. PARTIAL = part is built and tested, a named part is missing or never exercised. NOT BUILT = no code for the core of the question. **Nothing in V3 has ever run against a live provider** (`V3_INTEGRATION_STATUS.md:4`, `DEPLOY_V3LIVE_PLAN.md:5` "Nothing in this plan was run"), so nothing that needs a provider can be PROVEN. Result: 0 PROVEN at letter level.

## One page table

Effort = developer days for ONE developer (coding + tests + one staging run), excluding owner waiting time (Meta, DLT, KYC).

| # | Area | Status | Strongest evidence | Main blocker | Effort (days) |
|---|---|---|---|---|---|
| A | Domain (ResellerClub, DNS, Cloudflare, nginx) | PARTIAL | `BE v3-registrar/resellerclub.adapter.ts:112-241` (search, suggest, costs, register, renew, privacy, nameservers, balance, transfer); keys: saved first, env second `:74-79`; `BE v3-registrar/api/registrar.controllers.ts:62-106` vendor routes; UI `apps/vendor/src/pages/grow/domain/BuyDomain.tsx` | Never run against ResellerClub (even OT&E); no DNS-record API (only nameservers); no admin screen to store the key (backend route exists, UI none); `CloudflarePort` has no real adapter (`BE v3-domain-automation/cloudflare.port.ts:23`) | 9 |
| B | Payments and plan flow | PARTIAL | `BE plan-billing/api/me-billing.controller.ts:22-52` order/confirm/invoices; webhook `payments-webhook.controller.ts:14-41`; settlement `plan-billing/settlement.service.ts:~100-120`; terms 3/6/12 `plan-billing/api/dto/billing.dto.ts:6`; cash `billing-admin.controller.ts:48-52` | Gateway never exercised even in test mode; prices are owner data and unset (PENDING); invoice is HTML, not PDF (`me-billing.controller.ts:51`); cash invoices cannot be back-dated or carry a custom amount | 8 |
| C | Signup and bulk creation | PARTIAL | `BE v3-trial/module-trial-site.ts:19-27` self-service Free site; `BE v3-admin-vendor-site/admin-vendor-site.controller.ts:20` create vendor+site (duplicate check inside); UI `apps/admin/src/pages/vendorsite/VendorSitePage.tsx`; CSV `BE v3-listing-import/api/listing-import.controller.ts:25-35` + UI `onbehalf/BulkImport.tsx` | CSV import makes unclaimed listings, not vendors with a login; no SMS/WhatsApp delivery (`provisioning/invites/email-adapter.ts:7` sandbox default); credential is a random password inside a welcome e-mail (`admin-vendor-site.service.ts:47`) | 7 |
| D | Multi-category vendor | NOT BUILT | One value only: `Vendor.industry String?` (`BE prisma/schema.prisma:19`), `V3VendorPack.vendorId @unique` (`schema.prisma:7634`), create DTO takes one `category` (`admin-vendor-site.dto.ts:6`). Taxonomy tables exist (`schema.prisma:7526-7575`) but nothing reads them for a vendor; the "own family plus related" rule is "not enforced anywhere yet" (`E1_TAXONOMY.md`) | A schema change plus nav, site and theme merge | 14 |
| E | Themes | PARTIAL | Admin upload/validate/review/publish `BE v3-theme-market/api/theme-market.controllers.ts:53-90`; UI `apps/admin/src/pages/themes/UploadDialog.tsx`; vendor switch `BE v3-theme-switch/api/theme-switch.controllers.ts:25-42`; staff switch `:53-66`; spec `docs/v3/THEME_PACKAGE_SPEC.md` | Package targets are 16 packs and 196 catalogue categories, not family/category/service; the package may not contain any `.js` (spec section 1), so bottom nav, install button and chatbot can only come from the host; PUB has 6 render paths and only one (`SiteApp`) has the install button and shell | 12 |
| F | Website Manager | PARTIAL | `BE v3-website` 49 routes; UI `pages/grow/website` real; editable map `GET /v3/me/site/editor/map` | No landing-page renderer, menu order not drawn, hours free text (`docs/v3/V3_WEBSITE_MANAGER.md` section 11 items 1-3); staff pass-through editing incomplete (item 10); no sample-content flag found | 8 |
| G | Roles and teams | PARTIAL | Roles `BE auth/guards/admin-role-matrix.ts:21-45`; revenue by role `v3-admin-overview/overview-core.ts:3,19` + `admin-overview.service.ts:46-64`; vendor team `v3-vendor-gaps/api/vendor-gaps.controllers.ts:85-105`, areas `core/gaps-core.ts:83-93`; audit `schema.prisma:4199` | Five fixed roles in code; TELECALLER and FIELD_EXECUTIVE are labels of Sales. No SEO, design or telemarketing team, no per-team section choice by super admin (matrix is code, not data) | 8 |
| H | CRM, Tele-CRM, chatbot | PARTIAL | Enquiry intake `BE requests-orders/api/public-requests.controller.ts:34` (`/enquire`), `enquiry-form.service.ts:26`; sources `schema.prisma:5287-5291` (DIRECTORY, SITE, WHATSAPP, MANUAL); UI Enquiries real (`bodies.tsx:129`) | Tele-CRM screen is sample-only (`grow/telecrm` not in `REAL_SCREENS`, `bodies.tsx:129`); no call-intent source; no V3 chatbot, V2 widget chat is stateless (`BE widget/widget.service.ts:43-53`); no alert actually sent (`requests-orders/messaging.service.ts:8-15` sandbox) | 15 |
| I | Campaign add-on and social | PARTIAL | `BE v3-service-requests` (request, assign, deliver), `v3-services` price book, wallet funding `v3-services/core/services-core.ts:33-52`; drafts only `v3-vendor-gaps` promotion/social (`...Controller 'v3/me/promotion/drafts'`, "Nothing is posted"); AI `ai-studio/api/me-ai.controller.ts:21-31` | No campaign-request screen with a price list wired end to end; no Meta/Google code that posts (legacy `meta.service.ts` is a mock); AI Studio is text only, poster and video are mock (`V3_INTEGRATION_STATUS.md` rows 10, 17, 19) | 10 |
| J | Integrations screen | PARTIAL | Backend `BE v3-integrations/integrations.controller.ts:30-50` (list, save, test) with `PROVIDERS` `integrations-core.ts`: resellerclub, email, claude available; whatsapp and sms `available:false` | NO admin screen: no file under `UI apps` or `packages` mentions integrations (grep, 0 hits; `apps/admin/src/access/screens.ts` has 20 screens, none for it); SMS/WhatsApp cannot be stored; no usage meter | 5 |
| K | Industry pack depth | PARTIAL | 16 packs, all with typed tabs, every pack tab opens one generic record screen (`UI pages/real/real-records.ts`, prior audit section 2); 45 family `plannedPackKey` recorded (`E1_TAXONOMY.md`) | Only 16 real packs for 45 families; 29 families have no pack; no pack-specific screen; vendor dashboard top tabs come from `GET /v3/me/navigation` per pack | 20 |
| L | Install and mobile | PARTIAL | Bottom tabs: vendor `UI apps/vendor/src/components/VendorShell.tsx:70`, admin `apps/admin/src/shell/AdminShell.tsx:94`, marketing app `apps/site/src/components/layout/BottomAppBar.tsx`; PWA: `UI apps/site/public/manifest.webmanifest` + `sw.js`; PUB `app/manifest.ts`, `components/site-kit/InstallButton.tsx`, `SiteApp.tsx:53` | Vendor and admin apps have NO manifest and NO service worker (their `public/` holds only `robots.txt`, `runtime-config.js`): no install icon for the vendor dashboard or admin | 4 |
| M | V2 migration | NOT BUILT | Only a one-off MR Travels script (`BE scripts/migrate-mrtravels.ts`) and the V2 inventory docs (`get4domain-inv/docs/v3/V2_INVENTORY.md` INV-8) | No importer for V2 vendors, subscriptions, payments, invoices; V3 live DB is a NEW Supabase project (`V3_LIVE_ENVIRONMENT.md` section 1.1); wildcard still serves V2 (`deploy/v3live/nginx/WILDCARD_SWITCH_LATER.md:3`) | 12 |
| N | SEO / AEO / GEO and directory | PARTIAL | Indexing rule `BE site-publish/seo/indexing-rule.ts` (noindex until complete), sitemap `site-publish/seo/site-files.ts:6`, llms `seo/llms-txt.ts`, directory/keyword pages `seo-directory/*`, click-out `seo-directory/api/click-out.controller.ts`; head `PUB site-kit/head.ts` (A1) | GA4/Search Console are "Not started" (`V3_INTEGRATION_STATUS.md` row 13); no call/WhatsApp click tracking (only DIRECTORY/SITE/WHATSAPP source); directory pages indexable off by default (`directory-settings.ts:37`); two renderers decide the head | 6 |
| O | Test and deploy readiness | PARTIAL | Static count of `it(`/`test(`: BE 5,166 (407 spec files in `test/`), UI 1,115, PUB 577 (the A1 report states 636 pass); runbook `deploy/v3live/RUNBOOK.md`, startup check `BE common/startup-check.ts` | Live V3 DB not created; migrations: 133 folders locally vs 53 on the V2 production DB at 2026-11-02 (`V3_PRODUCTION_MIGRATION_STATE.md`); staging state of newer slices UNVERIFIED; no CI deploy; three repos to join | 9 |

**Letter-level counts: 0 PROVEN, 13 PARTIAL, 2 NOT BUILT (D, M).**
Total effort if everything above is built: about 147 developer days (sum of the column). The first paying vendor needs far less: see file 22.

## Sub-answers (every question in the brief, one line each)

Status per sub-question. "stale" marks where the prior audit is out of date.

| Id | Question | Status | Evidence and what is missing |
|---|---|---|---|
| A1 | ResellerClub client: search, price, register, renew | PARTIAL | `resellerclub.adapter.ts:112,136,165,176`; never live (`REGISTRAR_LIVE_SEARCH/PURCHASE` off, `registrar.port.ts:55`). |
| A2 | DNS records | NOT BUILT | grep "dns" in the adapter: 0 hits; only `setNameServers` `:185`. |
| A3 | Where keys are read | PROVEN (code) | `resellerclub.adapter.ts:74-79`, wiring `registrar.module.ts:66`; tests use a scripted HTTP port. Old `platform-settings.constants.ts:148-157` also lists them. |
| A4 | Admin screen can store the key | PARTIAL | `PUT /v3/admin/integrations/resellerclub` exists (`integrations.controller.ts:40`), UI screen does not. |
| A5 | Endpoints | PROVEN (code) | Public `GET v3/public/domain-availability`; vendor `v3/me/domain-sales/*` search, quote, purchase, transfer, orders, renew; admin margins, orders, recover, reconcile (`registrar.controllers.ts:14-178`). |
| A6 | What a vendor needs to buy a domain in the Pro cart | PARTIAL | Identity check first (`registrar.controllers.ts:116-135`, UI `IdentityCheck.tsx`), approved by staff; wallet balance; approved domain margin (`:154-160`, super admin); nameservers setting; the two live flags; keys. All of it is data/owner work and none ran. |
| A7 | Cloudflare/nginx automation for a new vendor subdomain | PARTIAL | After the wildcard switch no per-vendor nginx entry is needed (wildcard `*.get4domain.com`, `WILDCARD_SWITCH_LATER.md`); today the wildcard serves V2. Custom hostnames: port only, default binding refuses (`cloudflare.port.ts:23-30`). |
| B1 | Razorpay order, verify, webhook | PARTIAL | `me-billing.controller.ts:27-35`, `payments-webhook.controller.ts:19,41`; never run against a gateway (prior audit journey 4). Cashfree also supported. |
| B2 | Invoice number and PDF | PARTIAL | Number: `settlement.service.ts:118` (`formatInvoiceNumber(prefix, financial year, n)`); output HTML attachment `plan-order.service.ts:225-228`; no PDF. |
| B3 | GST fields | PARTIAL | `taxBreakdown` and `snapshot` on the invoice (`plan-billing.repository.ts:26`); GST rate setting `PUT /v3/admin/gst-rate`; vendor tax profile `V3VendorTaxProfile` (`schema.prisma:6562`). Wallet-paid plan has no GST invoice by owner rule (`settlement.service.ts` comment, 6 Nov 2026). |
| B4 | Wallet | PARTIAL | `v3-wallet` 17 routes, UI `money/wallet` real; plan renewal from wallet `POST /v3/me/plan/renew-with-wallet`. |
| B5 | Plan term prices (quarterly, half-yearly, annual) | PARTIAL | 3, 6, 12 months only: `billing.dto.ts:6`, `plan-order.service.ts:19`, `plans/admin/admin-validation.ts:7`. Monthly only if `allowMonthly` (`public-plans.shape.ts:26`). Price rows are data and not entered (PENDING). |
| B6 | Upgrade Free to Pro: site live, dashboard unlock | PARTIAL | Paid order calls `tx.assign` then `entitlements.invalidate` (`settlement.service.ts` `settleWithin`/`afterPaid`); entitlements drive site and tabs at read time (`entitlement-engine.ts:75-102`); UI shows "Open with a Pro plan" locks (`UI free-locks.test.tsx`). Proven by unit tests only. |
| B7 | Test-mode readiness | PARTIAL | `paymentsMode off|test|live` (`billing-settings.ts:23`, `payments-gate.ts:42-52`); keys through admin Payments screen. Missing: test keys entered, a recorded run. |
| B8 | Cash/manual entry with invoice (V2 migration) | PARTIAL | Admin cash order + mark-paid issue a real invoice (`billing-admin.controller.ts:42-52`). Limits: amount must equal server price (`cash-core.ts`), received date at most 366 days old (`cash-core.ts:13`), invoice `issuedAt: now` (`settlement.service.ts:118`). Historical invoices from owner data: not possible. |
| C1 | Plan-first signup | PARTIAL | `UI apps/vendor` plan chooser (A4 report) and `PUB lib/v3-public/register-plan.ts`; chain never run with real data. |
| C2 | Free trial site | PROVEN (code+test) for the build step | `module-trial-site.ts:19-27`; needs `V3_PUBLIC_ENABLED`, mocks off, wildcard. "Trial" = Free plan (assumption 1). |
| C3 | Admin "create vendor with site" screen | PROVEN (code+UI test) | `admin-vendor-site.controller.ts:20`, UI `vendorsite/VendorSitePage.tsx` + test. Roles SUPER_ADMIN, OPERATIONS, SALES. |
| C4 | Bulk import (CSV) | PARTIAL | Dry run + apply with a per-row report (`listing-import.controller.ts:32-35`), UI `BulkImport.tsx`. Creates seeded unclaimed listings, not vendor accounts. 100/day through the browser is untested. |
| C5 | Duplicate check | PROVEN (code+tests) | `v3-duplicates/duplicate-check.service.ts`, used by create-with-site (`admin-vendor-site.service.ts:24`), review screen `pages/duplicates`. |
| C6 | Login credential generation and delivery | PARTIAL | Random password `admin-vendor-site.service.ts:47`, welcome e-mail `vendors/vendors.service.ts:90`; invite adapter default sandbox (`provisioning/invites/email-adapter.ts:7`); SMS/WhatsApp not available (`integrations-core.ts`). |
| C7 | Subdomain suggestion and nginx entry | PARTIAL | Policy and availability `v3-trial/trial-signup.policy.ts`, `GET /v3/public/subdomain-availability`; nginx: wildcard, none per vendor. |
| D1 | List exactly the changes needed | see file 21, lane CAT-1 to CAT-4 | |
| E1 | Admin Themes upload screen: zip validation, preview, publish | PROVEN (code+tests) for upload/validate/review/publish | `theme-market.controllers.ts:57-90`; tests `backend-api/test/theme-package-core.spec.ts`. Targets by family/category/service: NOT BUILT (packs and 196 categories only). |
| E2 | Vendor theme selection screen | PROVEN (code+UI) | `UI pages/grow/website/ThemePanel`; first switch included, later switch needs the THEME_SWITCH fee (price now has an admin screen: `apps/admin/src/pages/prices`, stale in prior audit). |
| E3 | Admin sets a theme on any vendor | PARTIAL | `theme-switch.controllers.ts:57` + `recover :66`; UI screen not confirmed (`pages/vendorsite`, `themes` do not call it: UNVERIFIED). |
| E4 | Theme marketplace price and wallet | NOT BUILT as a price | Spec says "A theme has no price" (`THEME_PACKAGE_SPEC.md` section 2); only the wallet-paid switch fee exists. |
| E5 | Vendor with several categories chooses a theme | NOT BUILT | Depends on D. |
| E6 | Reuse of the 20 V2 engine designs and imported themes | PARTIAL | PUB renders them: `app/site/[subdomain]/[[...rest]]/page.tsx:104-231` (theme pack, kit template, engine industry, raw uploaded theme in an iframe `:150`). They work off the V2 `/cms/site/<sub>` data, not the V3 stored pages. |
| E7 | Bottom nav and install in every path | PARTIAL | Install button only in `SiteApp.tsx:53`; raw/uploaded themes run in an iframe (`RawThemeFrame`, `page.tsx:150`), Free view and engine designs have no shell. |
| E8 | Frontend structure document for designers | PARTIAL | `docs/v3/THEME_PACKAGE_SPEC.md`, `themes/CONTRACT.md`, `themes/BOLT_BRIEF.md` exist; a document covering shell, nav, install, chatbot and multi-landing for the owner's three levels does not. |
| F1 | Every editable thing | PARTIAL | Table in file 21, section F. |
| F2 | Data-entry person without a developer | PARTIAL | Staff act on behalf routes exist; pass-through of draft fields has no admin route (`V3_WEBSITE_MANAGER.md` section 11 item 10). |
| F3 | Draft/publish | PROVEN (code) | `PUT /v3/me/site/draft/field`, `/draft/preview`, `/draft/publish`; revisions; tests in `BE test`. |
| F4 | Sample content flagged | NOT BUILT | No `isSample`/"sample" flag in `v3-website` (grep 0 hits). Free seeded pages carry a visible creator line by owner rule 8 (`V3_BRIDGE_MODEL.md`), which is different. |
| G1 | Admin roles | PARTIAL | `admin-role-matrix.ts:21`. |
| G2 | Team sections | NOT BUILT | No team model with sections. |
| G3 | Per-team section selection by super admin | NOT BUILT | Matrix is code. |
| G4 | Super-admin-only revenue | PARTIAL | Revenue section role list in `overview-core.ts`. The invoices and payments screens are gated by the permission matrix (`UI packages/api admin-matrix.ts`, `apps/admin/src/access/screens.ts` reads); I did not read the matrix cell by cell, so "revenue only for super admin" is shown for the overview only. UNVERIFIED for the invoices list. |
| G5 | Vendor team invites, limited sections | PARTIAL | `gaps-core.ts:83-93` departments and areas; UI TeamScreen real; enforcement of areas by server on each route UNVERIFIED. |
| G6 | Audit trail | PROVEN (code) | `V3AuditLog` (`schema.prisma:4199`), billing audit calls (`settlement.service.ts`), admin actions. |
| H1 | Lead sources with tags (call, WhatsApp, form, chatbot) | PARTIAL | `V3RequestSource` has SITE, DIRECTORY, WHATSAPP, MANUAL only (`schema.prisma:5287`). No CALL, no CHATBOT. |
| H2 | Tele-CRM queue, call outcome notes | NOT BUILT (V3) | UI page is sample-only; no V3 route. V2 `crm` module is legacy. |
| H3 | Chatbot exists | NOT BUILT (V3) | V2 `widget/chat` stateless; PUB has `ChatBot.tsx`/`ChatWidget.tsx` for the marketing site. |
| H4 | Conversation storage, hand-over to WhatsApp, analytics per vendor | NOT BUILT | |
| I1 | Campaign request in dashboard, price list, wallet or pay-first | PARTIAL | Service requests + price book + wallet funding exist in the backend; vendor Marketplace screen real (`REAL_SCREENS`). Campaign-specific catalogue entries are data. |
| I2 | Meta app status in code | NOT BUILT (as expected) | `social/` sandbox providers only; `meta.service.ts` is a mock. |
| I3 | AI Studio status | PARTIAL | Text generation only, `aiLiveCalls` off; poster and video not real. |
| J1 | Provider keys stored where | PARTIAL | Resend/ResellerClub/Claude in `PlatformSetting` category `v3_integrations` (`integrations-core.ts`); Razorpay/Cashfree in `payment-gateway/credentials`; SMS and WhatsApp env-only (`FAST2SMS_*`, `WHATSAPP_BSP_*`). |
| J2 | Test buttons, sandbox/live switch, usage meter | PARTIAL | Test `POST :provider/test` backend; mode field for ResellerClub; no usage meter anywhere; no UI. |
| K1 | Per-pack tabs, forms, services, sample data, bottom nav | PARTIAL | `PACK_SUMMARY_V1.csv` (16 packs), `tab-field-seed.ts`; table in file 21 section K. |
| K2 | Families without a pack | NOT BUILT | 29 of 45 (16 existing packs vs 45 `plannedPackKey`; the existing pack keys are not the planned keys: UNVERIFIED mapping, assumption 4). |
| K3 | Vendor dashboard top tabs by industry | PROVEN (code) | `GET /v3/me/navigation` from pack (`v3-packs/core/nav-core.ts:79`), UI `navigation/server-source.ts`. |
| L1 | PWA manifest, service worker, install | PARTIAL | Marketing app and PUB yes; vendor and admin no. |
| L2 | Bottom navigation | PARTIAL | Vendor, admin, marketing app yes; PUB portal `components/portal/MobileNav.tsx`; vendor sites only in `SiteApp`. |
| L3 | Anything not responsive | UNVERIFIED | `p10-shots`/`p11-shots` screenshots at 375/768/1280 exist for PUB (`docs/v3`); no equivalent run for vendor/admin in this audit. |
| M1 | What exists to import V2 vendors, subscriptions, payments | NOT BUILT | |
| M2 | What must be written, risks | see file 21 lane MIG, risks section | |
| N1 | Head identity, canonical | PROVEN (code+tests) | `PUB site-kit/head.ts` (`buildHead`), `a1.test.ts` (28 tests per `DISPATCH_REPORT_A1.md`). Canonical host is always the subdomain; backend does not send custom-domain field. |
| N2 | Sitemap per vendor | PROVEN (code) | `BE site-publish/seo/site-files.ts:6`; `PUB app/site/[subdomain]/sitemap.xml`. |
| N3 | noindex until complete | PROVEN (code+tests) | `BE site-publish/seo/indexing-rule.ts`; `forceNoindex` `schema.prisma:4411`. |
| N4 | Directory pages and keyword sub pages | PARTIAL | `seo-directory` (37 routes); indexable only when the switch is on. |
| N5 | Directory links to vendor subdomains | PROVEN (code) | `click-out.controller.ts`; PUB `app/(directory)` click-out. |
| N6 | GA4, Search Console hooks | NOT BUILT | Only a `GoogleAnalytics.tsx` for the marketing site; per-vendor GA id stored/rendered in V2 `cms` only. |
| N7 | Call/WhatsApp source tracking | NOT BUILT | See H1. |
| O1 | Number of tests | PARTIAL | see row O. |
| O2 | Weakened checks p8-p11, A1 | PROVEN (checked) | See file 21, section O. |
| O3 | Migrations pending on staging and live | UNVERIFIED | Live: no V3 DB exists yet; staging: not checkable read-only. |
| O4 | Deploy runbook gaps, nginx automation gap | PARTIAL | See file 21 section O. |

(Sub-answer tally is in the last line of this file.)

## Assumptions made (no questions asked during the run)

1. "Free trial" = the **Free plan**: a live, informational site on the subdomain, editable, Pro-only fields locked with an upgrade prompt (`BE website.service.ts:177` per prior audit; bridge model rule 5). No time-limited Pro trial exists in V3 and none was assumed.
2. The target is the **V3 live container** (`DEPLOY_V3LIVE_PLAN.md`): new database, three repos cloned by deploy key.
3. "Service" (third level of the taxonomy) is lane E4 and is not built (`E1_TAXONOMY.md` line 3), so every statement about services below means pack starter services, not the new third level.
4. The 16 pack keys (PROPERTY, CLINIC ...) and the 45 `plannedPackKey` values (family slug in upper snake case, `E1_TAXONOMY.md`) are different lists; I did not find a mapping table between them.
5. The prior audit's numbers for BE routes (1,439) and admin routes (542) were not re-counted.

---
**Sub-answer tally** (counted with `grep` over the table above, 69 rows): **15 PROVEN, 36 PARTIAL, 14 NOT BUILT, 2 UNVERIFIED, 2 pointers to file 21** (D1, M2).
At sub-answer level "PROVEN (code)" means the question is only about what the code does (where a key is read, which routes exist, what a rule is) and the code or a cited test shows it. It never means "worked against a real provider": nothing did.
