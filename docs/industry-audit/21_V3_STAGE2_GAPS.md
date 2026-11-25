# 21. V3 Stage 2: full gap list, proposed lanes, dependencies, order

Read with file 20 (evidence labels BE, UI, PUB are explained there). Lane ids are proposals only; the owner or the lead names the real ones. Effort = one developer, days, coding + tests + one staging run.

## 0. The structural gaps that come before any feature

| Id | Gap | Evidence | Why it matters |
|---|---|---|---|
| S-1 | **Three code lines, no trunk.** BE `v3-lane-e1` (409 commits ahead of PUB's base), UI `v3-ui-s17` (separate git repo), PUB `v3-pub-a1` (109 commits ahead of BE). No `main` ref exists in this repository (`git rev-list main` fails). `v3-inv` (9), `v3-seo0` (4), `v3-themes` (1) are not in BE. | `git rev-list --count` in `get4domain-w2` and `get4domain-pub` | A deploy needs one tag per repo (`DEPLOY_V3LIVE_PLAN.md` section 2). Nothing is pushed (memory: V3 batches "NOT pushed"). One disk failure loses weeks. |
| S-2 | **Two vendor-site renderers.** Vendor hosts are rewritten to `/site/<name>` which reads the V2 CMS route `/cms/site/<sub>` (`PUB middleware.ts:49-60`, `app/site/[subdomain]/[[...rest]]/page.tsx:61,104-231`). The V3 backend stores finished pages and serves them by host (`PUB lib/v3-public/vendor-site.ts:36-37`, route `app/(directory)/vendor-site/[[...path]]/route.ts`). | Both exist and both have tests | Free/Pro rules, noindex, takedown, theme switch and the editor all live in the backend pages. The `/site/<sub>` renderer applies its own copies (P8 `isFreeSite`, A1 `buildHead`). Two truths will drift. Decision needed (file 23, Q-ENG note). |
| S-3 | **V3 live does not exist yet.** New Supabase DB, container `v3live`, "Nothing in this plan was run". Wildcard `*.get4domain.com` still serves V2 and switching it is a manual procedure. | `DEPLOY_V3LIVE_PLAN.md:5`; `deploy/v3live/nginx/WILDCARD_SWITCH_LATER.md:3` | Every "PARTIAL" in file 20 is blocked on this. |
| S-4 | **The owner's three levels (Family 45, Category 1,213, Service) are a taxonomy only.** Tables and loader exist; the product still runs on 196 catalogue categories and 16 packs. | `BE prisma/schema.prisma:7526-7575` vs `V3PackCategory` (`:7495`); `E1_TAXONOMY.md` ("no foreign key", 110 of 196 unmatched) | Registration, packs, themes and directory all key on the old list. D, E, K depend on this. |

## 1. Gap list by area

Priority: P1 = needed for the first paying Pro vendor, P2 = needed for the 100-a-day bulk phase, P3 = after.

### A Domain

| Lane | Gap | Dependencies | Effort | Pri |
|---|---|---|---|---|
| DOM-1 | Admin **Integrations screen** in UI (list, save write-only, test, mode, last saved) over `BE v3-integrations/integrations.controller.ts:30-50`. Add SMS and WhatsApp providers to `PROVIDERS` (`integrations-core.ts`, both `available:false` today). | none for UI; SMS/WhatsApp need owner provider (Q-1) | 4 | P1 (keys can only be entered through the API today) |
| DOM-2 | **ResellerClub OT&E run** (`demo` mode uses `test.httpapi.com`, `resellerclub.adapter.ts:21`): search, price, register, renew, nameservers, balance; record results; fix the "TO VERIFY" paths listed in memory note "V3 Batch 11". `scripts/live/registrar-check.js` exists for one read. | DOM-1 or env keys; owner ResellerClub account + whitelisted IP (`integrations-core.ts` note: ResellerClub only answers from whitelisted addresses) | 3 | P2 |
| DOM-3 | **DNS record API** (A, CNAME, TXT) for domains bought through us; today only `setNameServers` (`resellerclub.adapter.ts:185`). Needed so a bought domain points at the vendor site. | DOM-2 | 3 | P2 |
| DOM-4 | **Custom-hostname automation**: real `CloudflarePort` adapter (Cloudflare for SaaS custom hostnames) or the manual certbot path; today only `UnavailableCloudflarePort` (`cloudflare.port.ts:23`). Cloudflare Flexible plus manual certbot per domain is the documented manual path (`V3_INTEGRATION_STATUS.md` row 16). | Owner decision (Q-6) | 5 (adapter) or 1 (document manual runbook) | P3 |
| DOM-5 | Wildcard switch to V3 (nginx `*.get4domain.com` to the V3 site container, TLS via Cloudflare). No per-vendor nginx entry afterwards. | S-3; owner window | 1 | P1 |

### B Payments

| Lane | Gap | Dependencies | Effort | Pri |
|---|---|---|---|---|
| PAY-1 | **Prices entered** through UI `pages/prices` (stale in prior audit: screen exists now) for Pro plans x terms 3/6/12, plus GST rate and TDS in Settings. Owner data, not code. | Q-2 | 0.5 | P1 |
| PAY-2 | **Test-mode pilot**: Razorpay test order, webhook, settle, invoice, referral commission, wallet top-up, theme-switch fee; add `GET /v3/me/billing/orders/:id` if missing (`me-billing.controller.ts:42` now has it; prior audit S8 was stale on this). | S-3, DOM-1 not needed (gateway keys have their own screen `pages/settings/CredentialsPanel.tsx`) | 3 | P1 |
| PAY-3 | **Invoice as PDF** (today an HTML attachment, `plan-order.service.ts:225-228`). Needed only if the owner wants PDF; HTML print works week one. | none | 2 | P3 |
| PAY-4 | **Invoice e-mail** really sent: needs `EMAIL_LIVE_SEND` and a Resend domain (`invoice-delivery.service.ts:11,28`). | Resend sender verified | 0.5 | P1 |
| PAY-5 | **Historical cash invoices (V2 migration)**: back-dated invoice date, custom amount, legacy number series, from an owner sheet. Not possible today (`cash-core.ts:13,37-42`; `settlement.service.ts:118` `issuedAt: now`). | Q-5 (CA sign-off) | 4 | P2 |
| PAY-6 | Refund screen (`POST /v3/admin/billing/orders/:id/refund` exists, no UI per prior audit; UNVERIFIED now). | none | 1 | P3 |

### C Signup and bulk creation

| Lane | Gap | Dependencies | Effort | Pri |
|---|---|---|---|---|
| SIGN-1 | **Bulk create vendors with login from CSV.** Today the CSV import creates unclaimed seeded listings (`listing-import.controller.ts:25-35`) and the single-vendor screen creates one at a time (`admin-vendor-site.controller.ts:20`). Needed: one row creates vendor + Free plan + live site + credential + message, with a per-row report, resumable, throttled to the delivery limits. | CAT-1 if multi-category; SIGN-2 | 4 | P2 |
| SIGN-2 | **Credential delivery**: an e-mail with a one-time set-password or claim link (not the clear password now inside the welcome e-mail, `vendors.service.ts:90`), then SMS and WhatsApp through real providers behind the existing ports (`UnboundSmsTransport`, `messagingMode` only `sandbox`: `messaging.service.ts:8-15`). | Q-1 (provider, DLT, opt-in rule), DOM-1 | 5 | P2 (e-mail P1) |
| SIGN-3 | Subdomain suggestion in the admin form (public availability endpoint exists, `v3-trial/trial-signup.policy.ts`; admin DTO takes a name). | none | 0.5 | P2 |
| SIGN-4 | Provisioning runner (`provisioningRunnerEnabled` off, `provisioning-settings.ts:24`) is only needed for the seeded/invite path; create-with-site is synchronous. | none | 0 | skip |

### D Multi-category vendor: the exact changes

Today: `Vendor.industry` one string (`schema.prisma:19`), `V3VendorPack.vendorId @unique` (`:7634`) holding one `packKey`+`categoryKey`, the create DTO takes one `category` (`admin-vendor-site.dto.ts:6`), `V3SiteSettings.variant` and the renderer derive one category (`schema.prisma:4411`), 57 non-test source lines read `.industry` (grep).

| Lane | Change | Effort |
|---|---|---|
| CAT-1 | Schema: `V3VendorCategory(vendorId, taxonomyCategoryId, isPrimary, sortOrder)` with `@@unique([vendorId, taxonomyCategoryId])`, a limit setting (default 3, plan-driven), migration + RLS + loader that fills it from `Vendor.industry` via `g4d_taxonomy_legacy_map`. Keep `Vendor.industry` as the primary for old code. | 3 |
| CAT-2 | Rule engine: allowed picks = own family + related families (`g4d_taxonomy_related_families`, 114 pairs proposed in `data/category-master-45-related.json`); server validation on registration and on edit; admin override. | 2 |
| CAT-3 | `V3VendorPack` to many: one row per (vendor, pack); nav core merges the tabs of all packs (`v3-packs/core/nav-core.ts:79`), dedupes shared tabs, orders them; capabilities union. Pack to category mapping for the 45 families (S-4) needed first. | 4 |
| CAT-4 | Site: renderer merges services, sections and starter services from all picked categories, page set = union, one theme (see E); landing page per category. Registration and admin screens get a multi-select picker (admin `GET /v3/admin/categories/tree` exists, `admin-vendor-site.controller.ts:15`). Directory: list under every picked category with one canonical subdomain. | 5 |
| | **Total D** | 14 |

### E Themes

Built: upload/validate/review/publish (`theme-market.controllers.ts:53-90`), public and vendor listing (`theme-marketplace.controllers.ts:33,58`), vendor switch with fee (`theme-switch.controllers.ts:25-42`), staff switch (`:53-66`), admin UI (`apps/admin/src/pages/themes/*`), spec (`THEME_PACKAGE_SPEC.md`), kit `themes/` with 5 Standard themes (`free-hospitality`, `free-practice`, `free-service-pro`, `free-shop-lite`, `free-studio`), all tier Standard (prior audit section 9). Marketplace sources of V2: `themes`, `website-themes`, `theme-uploads/` are legacy.

| Lane | Gap | Dependencies | Effort | Pri |
|---|---|---|---|---|
| THM-1 | **Targets**: let a package declare families (45) and categories (1,213) from the taxonomy, not only 16 packs and 196 categories (`THEME_PACKAGE_SPEC.md` section 2 `marketplace.packs`, `catalogueCategories`). Admin publish sets targets; vendor list filters by all picked categories. | S-4, CAT-1 | 3 | P3 |
| THM-2 | **Shell owned by the host, not the theme.** The package may not contain scripts (spec section 1), so bottom navigation, hero banner slots, multi landing pages, install button, chatbot and WhatsApp must be injected by the renderer around any theme. Today only the generic kit `SiteApp` has it (`PUB components/site-kit/SiteApp.tsx:53`); engine designs, theme packs and uploaded static themes (iframe, `page.tsx:150`) do not. | S-2 | 6 | P1 for Free/Pro kit path, P2 for the rest |
| THM-3 | Preview before publish exists for admin (`theme-market.controllers.ts:73`); a public gallery with a preview per theme per category is not wired (prior audit T3). | none | 3 | P3 |
| THM-4 | **Frontend structure document for designers** (the owner and Bolt): the shell contract (header, bottom nav items by pack, install, chatbot slot, WhatsApp button), the section ids (`data-g4d-section`), multi landing pages (service 1, 2, 3), banner and hero slots, the three taxonomy levels, forbidden items. Compile from `THEME_PACKAGE_SPEC.md`, `themes/CONTRACT.md`, `themes/BOLT_BRIEF.md`, `V3_WEBSITE_MANAGER.md` section 6. | THM-2 decisions | 1.5 | P1 (owner uploads themes himself) |
| THM-5 | Theme price and marketplace: the spec forbids a price on a theme; owner context says owner uploads and we do not sell themes. **Skip.** Keep the switch fee only. | Q-3 only if reversed | 0 | skip |
| THM-6 | V2 designs reuse: the 20 V2 engine designs render through `engineIndustry.render` (`page.tsx:212`) and need V2 data; not reachable from a V3-stored page. Reuse only by porting each to a kit theme. | S-2 | 2 per design | P3 |
| THM-7 | Admin set theme on any vendor: backend yes; confirm a UI entry exists (`pages/vendorsite` and `themes` do not call it, UNVERIFIED). | none | 1 | P2 |

### F Website Manager: editable things

| Thing | State | Evidence |
|---|---|---|
| Logo, brand, favicon | BUILT (favicon is the logo via `/app-icon`) | `PUB app/site/[subdomain]/app-icon`, A1 report; UI `grow/website` brand |
| Banners, hero | BUILT | banner library (`v3-website`), `hero.image` fallback (`V3_WEBSITE_MANAGER.md` item 9) |
| Services, products, images | BUILT | pack records, `v3-store`, `MediaPanels`, media upload |
| Menus / navigation labels | PARTIAL: stored and validated, not drawn | `V3_WEBSITE_MANAGER.md` item 2 |
| Tabs (dashboard) | server-driven per pack | `GET /v3/me/navigation` |
| Landing pages (service 1,2,3) | NOT BUILT: no renderer template, API stores no text | item 1 |
| SEO fields | BUILT (`v3-website/seo`), own `seoTitle` no longer used by the head (A1 decision) | `DISPATCH_REPORT_A1.md` |
| Languages | PARTIAL: `en`, `ta`, or both (`schema.prisma:4411` `language`) | |
| Opening hours | free text only | item 3 |
| Draft / publish / revisions / rollback | BUILT | `grow/website`; staff rollback has no screen (prior audit section 4) |
| Sample content flagged | NOT BUILT | |
| Data-entry person without a developer | PARTIAL: staff "act on behalf" sessions exist; draft-field pass-through routes for staff do not (item 10) | |

| Lane | Gap | Effort | Pri |
|---|---|---|---|
| WM-1 | Landing page templates + storage + editor (service pages, area pages), plus kit templates | 6 | P2 |
| WM-2 | Draw the stored navigation; opening hours as rows | 2 | P3 |
| WM-3 | Admin pass-through routes + screen so staff edit a vendor's draft fields | 3 | P2 |
| WM-4 | `isSample` flag on starter content, shown in the editor and blocking publish until replaced (owner wants sample flagged) | 2 | P2 |

### G Roles and teams

| Lane | Gap | Effort | Pri |
|---|---|---|---|
| ROLE-1 | Team model as data: teams (marketing, sales, SEO, design, operations, telemarketing) each with a section list chosen by the super admin; sections = the 20 admin screens in `screens.ts` plus overview blocks. Replace the code matrix lookups by a data lookup with the matrix as defaults. Keep the label approach used for TELECALLER (`admin-role-matrix.ts:33-36`) so no right can be held by a label. | 6 | P3 (week one: use the 5 roles as is) |
| ROLE-2 | Revenue only for the super admin: verify every revenue-bearing route (overview done; invoices, payments, partners payouts, wallet) in the matrix and add tests. | 1 | P1 |
| ROLE-3 | Vendor team: server enforcement of `areas` on each tab route (UNVERIFIED today); invite delivery is a "record" (`vendor-gaps.controllers.ts:92`: "Record an invite for a person") not a sent message. | 3 | P3 |

### H CRM, Tele-CRM, chatbot

| Lane | Gap | Effort | Pri |
|---|---|---|---|
| CRM-1 | **Real alert on a new enquiry**: e-mail adapter through the mail service when `EMAIL_LIVE_SEND` is on (`messaging.service.ts:8-15` records `SENT_SANDBOX` only). Prior audit Q4. | 2 | P1 |
| CRM-2 | Source tags: add CALL and CHATBOT (and WHATSAPP_INTENT) to `V3RequestSource` (`schema.prisma:5287`); the vendor site records a click intent (tel:/wa.me) through a beacon route; Free sites show the number as plain text by owner rule 5 so call intent applies to Pro; free and pro tags per `plan`. | 4 | P2 |
| CRM-3 | Tele-CRM on V3: queue, call outcome notes, follow-ups on `requests` records; staff view in admin. UI page is sample-only. | 8 | P2 |
| BOT-1 | Chatbot service: per-vendor knowledge from the site content and pack records, Claude API through the existing `claude` integration (`integrations-core.ts`, monthly cap), conversation store (new tables, RLS), lead capture to requests with source CHATBOT, hand-over to WhatsApp link, Pro only. V2 `widget/chat` is stateless and uses the V2 AI service (`widget.service.ts:43-53`). | 8 | P3 |
| BOT-2 | Chat widget injected by the host shell on every vendor site (see THM-2); central conversation list in vendor CRM and Tele-CRM and in admin; analytics per vendor. | 5 | P3 |

### I Campaign add-on and social

| Lane | Gap | Effort | Pri |
|---|---|---|---|
| CAMP-1 | Campaign request flow: vendor request form with price list from the price book (entries are data), wallet or pay-first (`services-core.ts:33-52` funding kinds exist), task to team (`v3-service-requests` assign/deliver), approval, status. Wire UI marketplace/service-requests screen to a campaign category. | 6 | P3 (manual first: use support tickets and the service desk) |
| SOC-1 | Social: our team posts on Get4Domain pages tagging the vendor, with vendor approval: needs an approval record on `v3/me/social/drafts` (drafts exist: "Nothing is posted"), a staff queue, a "posted" mark with link. No API posting. | 4 | P3 |
| SOC-2 | Meta app, App Review, Google Ads: owner-side lead time of weeks; code only after approval. Retire the mock `meta.service.ts` (it "always reports published", `V3_INTEGRATION_STATUS.md` row 10). | 3 + external | P3 |
| AI-1 | AI Studio poster (image) and video: poster via OpenAI image, video not real (mock). | 5 | P3 |

### J Integrations

| Provider | Where the key lives | Admin screen | Test | Live switch | Usage meter |
|---|---|---|---|---|---|
| ResellerClub | `PlatformSetting` category `v3_integrations` (write-only) else env `RESELLERCLUB_*` | API yes, UI no | backend `:provider/test` | mode demo/live + env flags | none |
| Resend e-mail | same category; older env `RESEND_API_KEY` | API yes, UI no | yes | `EMAIL_LIVE_SEND` env | none |
| Claude | same category + monthly cap | API yes, UI no | yes | per use | cap only, no meter |
| Razorpay/Cashfree | `payment-gateway/credentials/:gateway/:mode`, UI `CredentialsPanel.tsx` real | YES | none seen | `paymentsMode` off/test/live + `PLAN_PAYMENTS_LIVE_ENABLED` | none |
| SMS (Fast2SMS), WhatsApp | env only (`FAST2SMS_*`, `WHATSAPP_BSP_*`) | no (`available:false`) | none | `SMS_LIVE_SEND`, `MESSAGING_LIVE_ENABLED` env | none |
| OpenAI | env | no | `scripts/ai-health.js` | `aiLiveCalls` setting | credits in `v3/me/ai/usage` |
| Cloudflare | none | no | none | none | none |
| Storage (S3 compatible / Supabase) | `v3-storage/settings`, `s3.adapters.ts` | none seen | none | `STORAGE_NOT_CONFIGURED` | none |

Lane INT-1 = DOM-1 plus usage meter (counts per provider per month, 3 days), P3.

### K Industry pack depth

Sixteen packs. Tabs from `PACK_SUMMARY_V1.csv` as quoted in the prior audit section 2.2 (BE seed `prisma/seed/pack-engine`). Forms = typed field sets per tab (`tab-field-seed.ts`). Services = `starterServices` per category (`V3PackCategory`, `schema.prisma:7495`). Sample data: `scripts/build-pack-demo-content.js`. Vendor bottom navigation: the five shell tabs `overview, business, site, promotion, more` (`VendorShell.tsx:70`) for every pack; the pack decides which items appear under `business`.

| Pack | Tabs (count and examples) | Site theme (fallback) | Depth |
|---|---|---|---|
| PROPERTY | 5: listings, projects and units, site visits, owners and tenants, rent roll | free-hospitality | generic records |
| CLINIC | 6: patients, appointments, visit notes, prescriptions, billing, follow-ups (gated) | free-practice | generic; `v3-appointments` backend |
| LAB | 4: test catalogue, orders, sample tracking, reports (gated) | free-practice | generic |
| PHARMACY | 4: stock with batches and expiry, prescriptions, billing, refills (gated) | free-shop-lite (no pharmacy sections) | generic; weakest |
| RETAIL | 5: products, stock, cart and orders, returns, offers | free-shop-lite | best covered (`v3-store`) |
| FOOD_SERVICE | 4: menu, orders, kitchen status, delivery | free-hospitality | generic |
| FIELD_SERVICE | 5: jobs, dispatch, quotes, AMC, service history | free-service-pro | `v3-jobs`; vendor Jobs/Quotes now real (`real-records.ts:133-143`) |
| VEHICLE_SERVICE | 5: job cards, vehicle records, service history, reminders, parts | free-service-pro | no tests named, reminders not sent |
| LOGISTICS | 6: shipments, trips, vehicles, drivers, tracking, POD | free-service-pro | public tracking page not found |
| MEMBERSHIP_WELLNESS | 5: members, plans and renewals, attendance, appointments, product sales | free-studio | generic |
| EDUCATION | 6: courses, batches, admissions, fees, attendance, results | free-studio | fee reminders not automated |
| PRACTICE_LEGAL_FINANCE | 5 (gated) | free-practice | generic |
| AGENCY_CONSULTING | 5 | free-practice | generic |
| HOSPITALITY_EVENTS | 4 | free-hospitality | generic |
| RENTAL_FLEET | 5 | free-hospitality | no dedicated design |
| B2B_DEALER | 5 | free-practice | no dealer theme |

Stale items in the prior audit that the current UI fixes: Jobs, Quotes, Work, Orders, Stock, Offerings, Offers, Accounting, Payment setup and methods, Activity, AI studio and Legal are now `SPECS` in `UI apps/vendor/src/pages/real/real-records.ts:133-219` (generic record lists on real routes), and `business/import`, `grow/marketplace` are real (`bodies.tsx:129`). Still sample-only: home/overview, `grow/telecrm`, messages, reviews, chat, reports, sell, analytics, notifications (UNVERIFIED which of these were wired after the F1 audit; checked only telecrm).

**Families with no pack:** 45 families vs 16 packs. The planned pack key of each family is the upper-snake family slug (`E1_TAXONOMY.md`), a record with no foreign key; the 16 current pack keys are a different list. I found no table that says which of the 16 packs serves which of the 45 families, so up to 29 families have no pack and the mapping itself is a gap (lane PACK-1, 2 days to draft the mapping, owner reviews). For the 110 of 196 existing categories that matched no family (list in `E1_TAXONOMY.md`) the owner decides alias, family or new item.

| Lane | Gap | Effort | Pri |
|---|---|---|---|
| PACK-1 | Family to pack mapping table (data) + loader; flag families without pack; fallback pack `GENERAL_BUSINESS` so every family can start | 3 | P2 |
| PACK-2 | New packs for the biggest unserved families (owner ranks them; Q-4) | 5 per pack | P3 |
| PACK-3 | Pack-specific screens (shop and pharmacy stock with expiry, job cards, clinic visit notes, ...) | 10+ | P3 |

### L Install and mobile

| Lane | Gap | Effort | Pri |
|---|---|---|---|
| PWA-1 | `manifest.webmanifest`, icons, service worker with offline page, install button for vendor and admin apps (copy the pattern in `UI apps/site/public`). | 3 | P2 |
| PWA-2 | Install button in every vendor-site render path (see THM-2); install for the portal exists (`PUB components/marketing/InstallPwaButton.tsx`). | in THM-2 | P1 |
| PWA-3 | Responsive review of vendor and admin at 375 px with screenshots (PUB has `p10-shots`/`p11-shots`; vendor/admin none found). | 1 | P2 |

### M V2 migration

Nothing imports V2 data. Evidence: `BE scripts/` has only `migrate-mrtravels.ts`, leadspace and stepnrock one-offs; V3 live is a new DB (`V3_LIVE_ENVIRONMENT.md` section 1.1); V2 production DB is at 53 migrations and 150 tables (`V3_PRODUCTION_MIGRATION_STATE.md`); five named client candidates (`V2_INVENTORY.md` INV-8): Step N Rock, Deebi Photography, Allwin Tours, Indian Ambulance, MR Travels; four of them run as their own Next.js apps.

| Lane | What must be written | Effort | Pri |
|---|---|---|---|
| MIG-1 | Read-only extractor of V2 vendors (`Vendor`, `VendorCMS`, domains) to a reviewed CSV/JSON (the owner's SQL queries are written, not run: `OWNER_READONLY_QUERIES.sql`) | 2 | P2 |
| MIG-2 | Importer into V3: vendor (keeping id or e-mail), category map (V2 20 industries to taxonomy), Free or Pro subscription with end date, site content to V3 draft, subdomain kept | 5 | P2 |
| MIG-3 | Payments and invoices: map V2 payments to V3 orders and invoices (PAY-5) | in PAY-5 | P2 |
| MIG-4 | Per-client cut-over: DNS and nginx per client (explicit rules in `deploy/v3live/nginx/*.conf` keep V2 clients on V2 after the wildcard moves) | 1 per client | P3 |

Risks: (1) wildcard cut-over breaks V2 sites that have no explicit nginx rule (`WILDCARD_SWITCH_LATER.md`); (2) password hashes: same bcrypt? UNVERIFIED, otherwise forced reset by e-mail that is off by default (`EMAIL_LIVE_SEND`); (3) cash-paid vendors without invoice need a tax decision before any back-dated invoice (Q-5); (4) three client sites use bespoke apps outside V3 (`stepnrock/`, `allwin-tours/`, `indianambulance/`, `deebiphotography/`); (5) `Vendor.industry` has 20 V2 values, the kit map is "an inference; each client needs a manual check" (`V2_INVENTORY.md` section 8.2); (6) a restored Free or Pro state must not delete anything (owner rule 9, `V3_BRIDGE_MODEL.md`); (7) the V3 retire guard 404s V2 industry module routes for V3 vendors (`BE v3-retire`, `app.module.ts:295`), so a V2 client that still uses a module loses it on import.

### N SEO / AEO / GEO and directory

| Lane | Gap | Effort | Pri |
|---|---|---|---|
| SEO-A | Decide the one head builder (S-2): backend stored pages versus PUB `buildHead`. Today root layout still adds Get4Domain marketing keywords and site-wide JSON-LD on vendor pages (`DISPATCH_REPORT_A1.md` caveats). | 2 | P1 |
| SEO-B | GA4 and Search Console: per-vendor GA id field, script on Pro sites, Search Console verification tag and sitemap submission per vendor (none exists in V3; V2 `cms/dto/update-vendor-cms.dto.ts` has a GA id). | 3 | P3 |
| SEO-C | Source tracking beacon for call and WhatsApp clicks (= CRM-2). | in CRM-2 | P2 |
| SEO-D | Directory: `directoryPagesIndexable`, `directoryIndexUnclaimed` off by default (`directory-settings.ts:37,39`); owner switches. | 0.5 | P2 |
| SEO-E | Per-vendor canonical for custom domain: backend sends no field (A1 caveat). | 1 | P3 |

### O Test and deploy readiness

**Counts (static, one grep pattern `^\s*(it|test)\(`):** BE 5,166 in `backend-api/test` and `src` spec files (407 spec files in `test/`); UI 1,115 in `apps` and `packages` test files; PUB 577 in `src` `.test.ts` (the A1 report says 636 pass; the difference is subtests and generated cases). I ran none of them.

**Weakened checks (p8 to p11, A1).** Commit `aa0d08d` edited four older PUB tests: `p8.test.ts` (2 lines), `p9.test.ts` (3), `p10.test.ts` (19), `p11.test.ts` (5), and added `a1.test.ts` (277 lines). What changed:
- `p10.test.ts`: two tests that proved "a vendor's own `/site/<name>/...` passes through" and "another vendor's `/site/<name>` is 404" were replaced by two tests for the new rule (301 to the vendor host; 404 if the vendor does not exist). This is a rule reversal made on purpose (owner: no `/site/<name>` address), not a loosening. Behaviour proof moved to `a1.test.ts`.
- `p8`, `p9`, `p11`: assertions are regular expressions over the SOURCE TEXT of `page.tsx` (for example `assert.match(page, /buildHead\(\{ site, subdomain/)`, `body.indexOf('if (isFreeSite(site))') < body.indexOf('themePages(site.theme)')`). They were edited to follow a refactor (the head moved to `site-kit/head.ts`). They prove the code is written a certain way, not what a browser gets. Verdict: not weakened in strength, but a refactor can silently pass them; the behavioural proof is the real-HTTP step of `p11-shots.mjs` (A1 report: ALL PASSED at 375/768/1280). Recommend: replace the four regex checks by one request-level test (lane TEST-2, 1 day).
- No `skip`/`only`/`todo` search was run in BE or UI (UNVERIFIED).

**Migrations.** BE has 133 migration folders (`ls prisma/migrations | wc -l` minus the lock file); the V2 production DB had 53 applied at 2026-11-02 and is "at head" for V2 (`V3_PRODUCTION_MIGRATION_STATE.md`). V3 live is a NEW database built from a staging dump plus "mark applied", not by replaying history, because the early history is not replayable (`V3_LIVE_ENVIRONMENT.md` section 1.1). Staging state of slices after 5.20 UNVERIFIED (memory notes say "NOT run on staging" for b3, b4b, b11, w2 H). Drift risk: any migration written after the staging dump must be applied on both; `scripts/live/migrate-live.js drift` exists to check.

**Deploy runbook gaps.** `deploy/v3live/RUNBOOK.md` (36+ numbered steps, "Not run" list at `:661`), nginx explicit host files for admin, api, app, directory, partner and two V2 clients, no per-vendor files (wildcard). Gaps: (1) nothing run; (2) wildcard switch is a separate manual procedure; (3) no CI deploy (builds by hand on the container); (4) custom domain TLS manual; (5) the three repos need tags; (6) Redis/queue absent so bulk sends run inside the API cron (`V3_INTEGRATION_STATUS.md` row 25); (7) `provisioningRunnerEnabled`, `EMAIL_LIVE_SEND`, `V3_PUBLIC_ENABLED`, `V3_PUBLIC_USE_MOCKS=false` and 20 other switches default off (prior audit section 1.5 and `GO_LIVE_PUBLIC.md`).

| Lane | Gap | Effort | Pri |
|---|---|---|---|
| DEP-1 | Consolidate: push the three lines, merge `v3-inv`, `v3-seo0`, `v3-themes` into BE, one release branch per repo, tag. Owner approves each push (push triggers a Vercel preview, memory note). | 2 | P1 |
| DEP-2 | Execute RUNBOOK on a staging container, then live: build, baseline, seeds (plans, taxonomy, packs, terms, services), bootstrap super admin, flags. | 4 | P1 |
| DEP-3 | Smoke script across all four apps through nginx and Cloudflare (`RUNBOOK.md` step 36 has the health part). | 1 | P1 |
| TEST-1 | CI: kit lint, route baseline and unit suites on push (prior audit T4); jest int-project only through `npm run test:int` (memory note). | 2 | P2 |
| TEST-2 | Request-level replacements for the p8 to p11 regex tests. | 1 | P2 |

## 2. Order of work (dependencies)

1. DEP-1 (S-1), then SEO-A / S-2 decision (renderer), DEP-2, DEP-5 (wildcard), PAY-1.
2. In parallel: DOM-1 (Integrations screen), CRM-1, THM-2 (shell on the kit path), PAY-4.
3. PAY-2 pilot, then cash path rehearsal.
4. THM-4 document, ROLE-2.
5. P2 block: SIGN-1/2, CRM-2/3, PWA-1, WM-1/3/4, PACK-1, MIG-1/2/PAY-5, DOM-2/3.
6. P3 block: CAT-1..4 + THM-1 (multi-category; this is the largest single change and touches schema, nav, site and themes, so schedule it after the first paying vendors, not before), BOT-1/2, CAMP-1, SOC-1, ROLE-1, GA4/GSC, packs, Cloudflare for SaaS.

Effort totals by priority (summed by hand from the rows above, rows split across two priorities counted in the part that is needed): P1 about 27 developer days, P2 about 63, P3 open-ended (at least 80, not counting THM-6 at 2 days per V2 design, PACK-2 at 5 per pack and PACK-3). File 20's 147-day total is the sum of the per-letter estimates and uses a narrower scope for P3 items; treat both as plus or minus 30 percent.
