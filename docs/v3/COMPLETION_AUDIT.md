# V3 COMPLETION AUDIT (Dispatch F1, read-only)

Method: every claim cites a file read in this session. UNVERIFIED = not confirmed from code. No app, database, server or network was used. Paths are relative to `get4domain-w2/backend-api` unless stated.

---

## 1. Backend inventory (F0)

### 1.1 Totals

Source: `test/baselines/route-classification.json` summary: **1439 routes** (131 public, 542 admin, 766 authenticated). About 130 Nest modules are registered in `src/app.module.ts` (lines 140-304). Counted by script over the baseline, grouped by the controller's top-level `src/` folder:

| Class | Routes |
|---|---|
| V3 modules | 663 |
| Legacy: 21 per-industry modules (retired for V3 vendors) | 222 |
| Legacy: Workspace/BOS, commercial, marketing, CRM and other V2 | 421 |
| Shared / carried over | 133 |

### 1.2 V3 modules (the product being launched)

Columns: routes, then public/admin/authenticated. Routes sit under `/v3/...` unless noted.

| Module folder | Routes | P/A/U | Purpose |
|---|---|---|---|
| plans | 37 | 2/32/3 | plans as data, entitlements, admin plan editing |
| plan-billing | 22 | 2/14/6 | Razorpay/Cashfree plan checkout, invoices, gateway settings |
| provisioning | 13 | 4/9/0 | create vendor on behalf, invites, claim, job runner |
| claim-setup | 2 | 1/0/1 | account setup after the claim |
| v3-trial | 1 | 1/0/0 | self-service Free trial signup |
| site-publish | 15 | 1/8/6 | renderer, publish, public site read |
| v3-website | 49 | 0/19/30 | website manager (sections, fields, act on behalf) |
| site-domains | 17 | 0/10/7 | subdomain, custom domain, canonical |
| v3-domain-automation | 13 | 0/4/9 | custom hostname connection watcher |
| v3-registrar | 31 | 0/14/17 | domain sales through a ResellerClub port |
| v3-theme-catalog | 2 | 1/0/1 | theme catalogue per pack |
| v3-theme-switch | 7 | 0/3/4 | theme switch service |
| v3-packs | 25 | 2/18/5 | industry pack engine |
| v3-pack-records | 9 | 0/2/7 | per-pack working records |
| v3-profile-fields | 9 | 0/6/3 | pack profile fields |
| directory | 32 | 9/20/3 | public directory, claims, OTP |
| seo-directory | 37 | 11/25/1 | directory pages, sitemap, click-out |
| seeded-sites | 17 | 0/17/0 | seeded (unclaimed) sites |
| v3-listing-import | 3 | 0/3/0 | listing import |
| requests-orders | 35 | 5/9/21 | enquiries, orders, vendor payment methods, invoices, offers |
| v3-payments | 15 | 3/0/12 | pay requests and pay links |
| v3-wallet | 17 | 0/8/9 | wallet, top-up, receipts |
| v3-services | 20 | 1/16/3 | service catalogue, price book, add-on packs |
| v3-service-requests | 16 | 0/10/6 | requests to our team |
| v3-partners | 5 | 0/4/1 | referral partners and portal |
| v3-referrals | 21 | 1/16/4 | links, attribution, commission, payouts |
| v3-customers | 7 | 0/0/7 | vendor customer list |
| v3-accounts | 13 | 0/0/13 | vendor money in/out |
| v3-jobs | 16 | 0/0/16 | jobs and quotes |
| v3-appointments | 19 | 0/0/19 | appointments |
| v3-store | 17 | 0/0/17 | vendor shop/catalogue |
| v3-media-upload | 12 | 0/8/4 | media upload |
| v3-mail | 7 | 1/2/4 | mail inbox, forwarding, identity OTP |
| v3-support | 10 | 1/5/4 | support tickets |
| v3-admin-actions | 10 | 0/10/0 | admin actions |
| v3-admin-gaps | 5 | 0/5/0 | admin gap routes |
| v3-vendor-gaps | 13 | 0/0/13 | vendor gap routes |
| v3-activity | 8 | 0/7/1 | activity log and alerts |
| v3-trust | 18 | 1/14/3 | trust and safety, takedowns |
| v3-firm | 3 | 1/2/0 | firm profile |
| vendor-lifecycle | 11 | 0/10/1 | suspend, delete, grace |
| terms | 9 | 2/5/2 | terms acceptance |
| account-security | 10 | 8/0/2 | login/password security |
| v3-storage, b3-settings | 0 | - | settings services only, no controller |
| v3-retire | 0 | - | global guard that 404s retired industry routes for V3 vendors |

### 1.3 Shared or carried over (133 routes)

health 2, otp 2, uploads 1, messaging 2, ai-studio 11, ai 6, ai-templates 5, support 6 (V2 tickets; V3 uses v3-support), notifications 5, widget 5, analytics 3, demo 6, industries 5, themes 10, website-themes 9, site-doc 23, cms 16, engine 7, platform-settings 5 (encrypted keys and pricing), auth 4.

### 1.4 Legacy (V2, out of V3 scope)

Source: `docs/v3/V3_REQUIREMENTS_MATRIX.md` lines 47-72 and the retire list `src/v3-retire/core/retire-core.ts` lines 6-9.

- **222 routes** in 21 per-industry modules (agriculture, automobile, clinic, coaching, construction, diagnostics, education, events, finance, gym, hotel, logistics, photography, professional, realestate, restaurant, retail, salon, stationery, technology, travel). `RetiredModuleGuard` answers 404 to a V3 vendor (`src/v3-retire/retired-module.guard.ts`, registered at `app.module.ts:295`). Data is kept.
- **421 routes**: bos 78, commercial 53, leadspace 93, domainapp 23, travel-style legacy apps, accounting 11, domains 10, domain-campaign 9, quotes 9, invoices 8, addons 8, vendors 7, social 7, subscriptions 5, crm 10, campaign-pages 10, team 6, admin-team 6, campaigns 6, registry 6, wallet 5 (legacy wallet; V3 uses v3-wallet), managed-services 5, whatsapp-bot 5, customer 9, and smaller ones.
- LeadSpace is named in several V3 contract docs but is not a V3 requirement: status **UNVERIFIED, owner to confirm**.

### 1.5 Switches OFF by default and what each blocks

"setting" = row in `g4d_plan_settings`, edited by staff in the admin dashboard through the plan-settings API. "ENV" = server environment variable (owner sets it; not coding work).

| Switch | Kind | Default | What it blocks | Evidence |
|---|---|---|---|---|
| `paymentsMode` | setting | `off` | all online plan payments: orders refused (PAYMENTS_DISABLED), webhooks ignored. `test` uses test keys. `live` also needs ENV `PLAN_PAYMENTS_LIVE_ENABLED=true` and live keys | `src/plan-billing/settings/billing-settings.ts:23`, `src/plan-billing/razorpay/payments-gate.ts:37-93` |
| `paymentGateway` | setting | `razorpay` | choice of Razorpay or Cashfree | `gateway-settings.service.ts:21-62` |
| `PLAN_PAYMENTS_LIVE_ENABLED` | ENV | unset | live mode refused | `payments-gate.ts:47,92` |
| `RAZORPAY_LIVE_KEY_ID/SECRET/WEBHOOK_SECRET`, `CASHFREE_LIVE_APP_ID/SECRET_KEY` | ENV or stored keys | unset | no live adapter can be built | `payments-gate.ts` buildGateway; `src/platform-settings/platform-settings.constants.ts` |
| `renewalRemindersEnabled` | setting | false | renewal reminder job | `billing-settings.ts:23` |
| `provisioningRunnerEnabled` | setting | false | the 30-second runner: vendors created on behalf stay queued and no site is built | `src/provisioning/settings/provisioning-settings.ts:24`; cron `src/provisioning/runner/provisioning-cron.ts:17` |
| `inviteAdapterMode` | setting | `sandbox` | invite really sent (needs `live`) | `provisioning-settings.ts:28` |
| `siteDraftBuilderMode` | setting | `legacy` | `renderer` also builds the site settings and a DRAFT_PREVIEW | `provisioning-settings.ts:30` |
| `provisioningDirectoryProfileEnabled` | setting | false | extra step CREATE_DIRECTORY_PROFILE | `provisioning-settings.ts:31` |
| `seededSiteIndexingMode` | setting | `OFF` | seeded sites stay noindex; `QUALITY` allows indexing (SUPER_ADMIN only) | `src/b3-settings/b3-settings.ts:69` |
| `directoryPagesIndexable`, `directoryIndexUnclaimed` | setting | false | directory pages and unclaimed listings stay noindex | `src/directory/settings/directory-settings.ts:37,39` |
| `smsAdapterMode` | setting | `sandbox` | live SMS for directory/claim OTP. Also needs ENV `SMS_LIVE_ENABLED=true`; comment says no provider adapter ships | `directory-settings.ts:46`; `src/directory/sms/sms-adapter.ts:6,23` |
| `messagingMode` | setting | `sandbox` (only value accepted) | live WhatsApp/SMS/e-mail for requests | `b3-settings.ts:97`; `src/requests-orders/messaging.service.ts:8-15` |
| `MESSAGING_LIVE_ENABLED` | ENV | unset | if `true`, a send is marked FAILED because no live adapter exists | `messaging.service.ts:15`; `src/v3-payments/documents.ports.ts:15` |
| `requestNudgeEnabled` | setting | false | unanswered-request reminder to the vendor (job every 5 min) | `b3-settings.ts:77`; `src/requests-orders/requests.cron.ts:20` |
| `canonicalSwitchTickEnabled` | setting | false | canonical host switch-back when the custom-domain add-on ends | `b3-settings.ts:70`; `src/site-domains/canonical-switch.service.ts:83` |
| `domainDnsLiveChecks` | setting | false | real DNS checks for custom domains | `src/site-domains/settings/domain-settings.ts:46` |
| `connectionWatcherEnabled` | setting | false | custom hostname connection watcher | `src/v3-domain-automation/settings/automation-settings.ts:15` |
| `EMAIL_LIVE_SEND` | ENV | off | system mail: claim OTP, identity OTP and plan receipts are not sent. The claim challenge is revoked; routes answer MAIL_DISABLED | `src/v3-mail/core/mail-core.ts:32-33`; `src/v3-mail/mail-enabled.ts:5`; `src/provisioning/claims/claim-otp.service.ts:37`; `src/plan-billing/invoice-delivery.service.ts:11` |
| `EMAIL_FORWARD_LIVE` | ENV | off | mail sent to a business's mailbox address is not forwarded | `mail-core.ts:32-33`; `src/v3-mail/inbox.service.ts:23` |
| `heldEnquiriesEnabled` | setting | false | holding mail for a business whose plan is inactive | `src/v3-mail/settings/mail-settings.ts:23`; `inbox.service.ts:47` |
| `SMS_LIVE_SEND` | ENV | off | V3 SMS port; no provider chosen, `UnboundSmsTransport` refuses | `src/v3-mail/core/sms-core.ts:46`; `src/v3-mail/sms.port.ts:10` |
| `walletExpiryTickEnabled` | setting | false | wallet credit expiry job | `src/v3-wallet/settings/wallet-settings.ts:33` |
| `serviceAutoApproveEnabled` | setting | false | auto-approval of delivered service requests | `wallet-settings.ts:34` |
| `REGISTRAR_LIVE_SEARCH`, `REGISTRAR_LIVE_PURCHASE` | ENV | off | domain search / buying through ResellerClub | `src/v3-registrar/core/registrar-core.ts:85`; `registrar.port.ts:47` |
| `registrarReconcileEnabled` | setting | false | daily registrar reconcile | `src/v3-registrar/settings/registrar-settings.ts:33` |
| other registrar settings | setting | null | nameservers, minimum balance, OTP limits, document size: purchases refused until staff set them | `registrar-settings.ts:31-33` |
| `aiLiveCalls` | setting | false | real OpenAI/Anthropic calls from AI Studio (keys `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) | `src/ai-studio/settings/ai-settings.ts:19` |
| `VENDOR_GATEWAY_LIVE_ENABLED`, `VENDOR_GATEWAY_WEBHOOK_ENABLED` | ENV | off | a vendor's own gateway: no adapter in this build; vendors are paid by UPI and confirm by hand | `src/requests-orders/requests-ports.ts:24-32`; `vendor-webhook.service.ts:18-23` |
| `V3_LIVE` | ENV | unset | with NODE_ENV=production, the startup check refuses a missing or placeholder variable | `src/common/startup-check.ts:5,86` |
| `THROTTLE_DISABLED`, `OTP_DEV_ECHO`, `EMAIL_MODE=test` | ENV | off | test conveniences; startup check refuses them in production | `startup-check.ts:121` |
| plan features `site.cta`, `requests.inbox` | plan data | per plan | public enquiry form and vendor inbox | `src/requests-orders/public-requests.service.ts:77` |
| Regulated packs | - | - | no code switch found; pack `reviewStatus` is `DRAFT` for each pack (`src/v3-packs/core/pack-core.ts:15,98,237`). How regulated packs are gated is **UNVERIFIED** until section 2 | |
| Mailbox reseller | - | - | **not in code**: `src/v3-mail` holds inbox, forwarding and rules only | grep `mailbox` in `src` |

Scheduled jobs found (`@Cron` grep): provisioning runner 30 s, plan billing hourly, requests every 5 min, canonical switch 10 min, v3-payments 5 min, admin actions 5 min, host visits 30 s, domain automation 5 min, wallet hourly, service requests hourly, act-on-behalf every minute, registrar (10 min, hourly, 03:00, 04:00, 06:00), plus legacy commercial renewal, theme expiry, social, LeadSpace and travel jobs. Which V3 jobs do nothing when their feature is off is **UNVERIFIED** per job.

### 1.6 Effect of each switch on a visitor enquiry reaching a vendor

Path, read in `src/requests-orders/public-requests.service.ts`: `POST /v3/public/sites/:host/requests` (`api/public-requests.controller.ts:21`) -> `gate()` (lines 69-79) -> `prepare()` (validation, consent, spam) -> row stored as RECEIVED -> `deliver()` (lines 135-141) sends two messages through `MessagingService` and moves the row to DELIVERED.

1. **Gate (visitor gets "not found"):** unknown host; vendor SUSPENDED or removed; legal takedown; plan features `site.cta` or `requests.inbox` not ACTIVE. A plan without those features cannot receive enquiries.
2. **Spam:** a blocked phone, network or e-mail is stored as SPAM and looks accepted; nothing is delivered (line 174). A high score asks for a phone code first (lines 106-124); with `smsAdapterMode` at `sandbox` the code is stored in the database only (lines 121-123), so on live a visitor with a high spam score cannot verify.
3. **Delivery to the vendor:** all three adapters only record `SENT_SANDBOX` (`messaging.service.ts:8-15,54`); `messagingMode` accepts only `sandbox`; `MESSAGING_LIVE_ENABLED=true` makes sends FAILED, then a DASHBOARD row is the fallback (lines 48, 58). **Result: the enquiry is stored and the vendor can read it in the dashboard inbox, but no SMS, WhatsApp or e-mail alert reaches the vendor or the visitor, whatever flag the owner sets. This is a code gap, not an owner switch.**
4. `EMAIL_FORWARD_LIVE` and `heldEnquiriesEnabled` concern the mailbox inbox (`v3-mail`), not the website form.
5. `requestNudgeEnabled` adds a reminder through the same sandbox messaging.
6. Payments, indexing, registrar and AI flags do not change whether an enquiry arrives. `provisioningRunnerEnabled` decides whether a created vendor has a site at all (section 6, journeys 1 and 7).

---

## 2. Industry packs (F1)

Sources read: `backend-api/prisma/seed/pack-engine/PACK_SUMMARY_V1.csv` (16 packs), `pack-engine-settings.json` (packMeta, 14 capabilities, 4 add-on packs), `src/v3-pack-records/seed/tab-field-seed.ts`, `src/v3-pack-records/api/pack-records.controller.ts:24` (`/v3/me/packs/:packKey/tabs/:tabKey/...`), `src/v3-packs/core/nav-core.ts:79`, `src/directory/core/listable-categories.ts:16-18` (`PACK_KIT_FALLBACK`), vendor app `apps/vendor/src/pages/business/packs/PackScreen.tsx` (typed client `packRecords`), `themes/library/*`.

### 2.1 How a pack works in code (applies to all 16)

- **Backend:** one generic engine, not 16 modules. Pack, tab, capability, tier-matrix and category tables are loaded from the CSV/JSON by `scripts/seed-v3-pack-engine.js` (idempotent). Each tab is a list of field definitions (`tab-field-seed.ts`, loaded by `scripts/seed-v3-pack-tab-fields.js`); a vendor's record is validated JSON (text, money in paise, date, select, status). All 16 packs have every tab listed in `PACK_SUMMARY_V1.csv` backed by a field set in the seed (script check: 16 of 16 packs, every tab key has a field entry; the slug rule that turns a tab label into a key was inferred, so treat as **UNVERIFIED** for the exact key).
- **Vendor screen:** the server sends the vendor's tabs (`GET /v3/me/navigation`), and every pack tab opens the **one generic `PackScreen`** (`apps/vendor/src/pages/bodies.ts:15`, `TabPage.tsx:58-90`), which lists, adds, edits, archives and restores records through the real client. So every pack tab is a **generic record list**, not a pack-specific screen (no batch-expiry board, no case timeline, no job-card board).
- **Site:** the public site of any pack is drawn by one of five Standard themes through a kit category. `PACK_KIT_FALLBACK` (`listable-categories.ts:16-18`) names the kit category each pack falls back to.
- **Gating:** `packGatedPacksOpen` (default off) hides the tabs of CLINIC, LAB, PHARMACY and PRACTICE_LEGAL_FINANCE (`packMeta.counselGated` in the settings JSON; `nav-core.ts:79` answers HIDDEN/GATED_PACK). `packOnlineMedicineCheckout` is off (`docs/v3/V3_PACK_ENGINE.md` section 9). These are owner switches, listed in section 8.
- **Tests:** pack engine, records, nav, tab fields and HTTP are covered generically (`test/pack-core.spec.ts`, `pack-engine-service.spec.ts`, `pack-nav-core.spec.ts`, `pack-records-core.spec.ts`, `pack-records-http.spec.ts`, `wave2-pack-tab-fields.spec.ts`, `pack-part-b*.spec.ts`). A grep of the keys finds a pack-specific test only for the gated and shop packs (CLINIC, PHARMACY, RETAIL, FIELD_SERVICE); VEHICLE_SERVICE, LOGISTICS, MEMBERSHIP_WELLNESS, EDUCATION, AGENCY_CONSULTING, HOSPITALITY_EVENTS and RENTAL_FLEET are named in no spec file (the LAB hit count is noise from an unrelated word).

### 2.2 The 16 packs

Vendor screen legend: REAL = opens a screen wired to the real API (here always the generic record screen); LOCKED = tabs hidden until the owner switch; MOCK-ONLY = fixtures only; MISSING = nothing.
"Specific working module" lists V3 backend modules that exist beyond the generic records and are relevant to the pack; whether the vendor app uses them is stated in section 3.

| Pack | Backend (tabs from CSV; backend categories in the catalogue) | Vendor screens | Site rendering (fallback kit category -> theme) | Tests | Notes |
|---|---|---|---|---|---|
| PROPERTY | 5 tabs (listings, projects and units, site visits, owners and tenants, rent roll) with typed fields; 3 catalogue categories; specific: `v3-store`, requests inbox | REAL generic records | `real-estate-agent` -> `free-hospitality` (has `properties.html`) | generic + `pack-engine-service.spec.ts` | RERA field and map filters named in the CSV site sections: renderer support UNVERIFIED |
| CLINIC | 6 tabs (patients, appointments, visit notes, prescriptions, billing, follow-ups); 11 categories; specific: `v3-appointments` (19 routes) | LOCKED (counsel switch) then generic records | `doctor-clinic` -> `free-practice` (has `doctors.html`) | pack-core, nav-core, engine specs | health disclaimer fixed text (disclaimerKey `health`) |
| LAB | 4 tabs (test catalogue, orders, sample tracking, reports); 1 category | LOCKED then generic | `diagnostics-lab` -> `free-practice` | gated-pack specs | sample tracking is a plain status field, no workflow |
| PHARMACY | 4 tabs (stock with batches and expiry, prescriptions, billing, refills); 2 categories; online checkout OFF | LOCKED then generic | `grocery-kirana` -> `free-shop-lite` (a grocery design; no pharmacy sections) | gated-pack specs | batch expiry and drug licence flags exist in the settings (`hasBatchExpiry`, `drugLicenceRequired`); no screen or job acts on them (UNVERIFIED beyond the flag) |
| RETAIL | 5 tabs (products, stock, cart and orders, returns, offers); 41 categories; specific: `v3-store` (17), orders and offers in `requests-orders` | REAL generic; the shop screens (Orders, Stock) are MOCK-ONLY (section 3) | `electronics-mobile` -> `free-shop-lite` | engine, nav specs | best-covered pack in the backend; vendor Stock/Orders screens not wired |
| FOOD_SERVICE | 4 tabs (menu, orders, kitchen status, delivery); 6 categories | REAL generic | `restaurant-cafe` -> `free-hospitality` (has `menu.html`) | pack-core only | table booking and catering enquiry: only as enquiry kinds (`ENQUIRY`, `APPOINTMENT`, `QUOTE`, `PRODUCT_ENQUIRY`) |
| FIELD_SERVICE | 5 tabs (jobs, dispatch, quotes, AMC, service history); 44 categories; specific: `v3-jobs` (16), quotes | REAL generic; Jobs and Quotes screens MOCK-ONLY | `plumber` -> `free-service-pro` | engine, tab-fields, import specs | biggest category count in the catalogue |
| VEHICLE_SERVICE | 5 tabs (job cards, vehicle records, service history, reminders, parts); 8 categories | REAL generic | `auto-mechanic` -> `free-service-pro` | none named | reminders are fields only, no sender |
| LOGISTICS | 6 tabs (shipments, trips, vehicles, drivers, tracking, POD); 10 categories | REAL generic | `packers-movers` -> `free-service-pro` | none named | public "track shipment" page in the CSV: no tracking route found (UNVERIFIED) |
| MEMBERSHIP_WELLNESS | 5 tabs (members, plans and renewals, attendance, appointments, product sales); 11 categories; specific: `v3-appointments` | REAL generic | `salon-spa` -> `free-studio` | none named | kit has `gym-yoga` and `salon-spa` designs, but those two ids are not in the 196-category catalogue (see 9.5) |
| EDUCATION | 6 tabs (courses, batches, admissions, fees, attendance, results); 12 categories | REAL generic | `coaching-centre` -> `free-studio` (has `courses.html`) | none named | fee reminders not automated |
| PRACTICE_LEGAL_FINANCE | 5 tabs; 8 categories; `hasCases` flag | LOCKED then generic | `ca-tax-consultant` -> `free-practice` | pack-core only | disclaimerKey `legal_finance` |
| AGENCY_CONSULTING | 5 tabs; 16 categories | REAL generic | `it-consultant` -> `free-practice` | none named | |
| HOSPITALITY_EVENTS | 4 tabs; 13 categories | REAL generic | `hotel-homestay` -> `free-hospitality` (has `packages.html`) | none named | |
| RENTAL_FLEET | 5 tabs; 2 categories | REAL generic | `travel-agency` -> `free-hospitality` | none named | |
| B2B_DEALER | 5 tabs; 8 categories; enquiry only (no cart) | REAL generic | `it-consultant` -> `free-practice` (a consulting design) | catalogue spec only | no dealer-specific theme |

### 2.3 Add-on packs

Four add-on packs are defined (`pack-engine-settings.json` addonPacks): SHOP, ONLINE_ORDERING_DELIVERY, PHARMACY_COUNTER, HOME_SAMPLE_COLLECTION, with 14 capabilities (SERVICES, APPOINTMENTS, MEMBERSHIPS, LISTINGS, BROKERAGE, RENTALS, MADE_TO_ORDER, DISPATCH, DELIVERY, PHARMACY, LAB, FOOD_SERVICE, VEHICLE_RENTAL, STORE). Backend: add-on tabs seeded (`addonTabRecords`), eligibility table (`src/v3-packs/core/addon-eligibility-core.ts`), purchase from wallet (`/v3/me/packs`, 9 routes under `v3-services`). Vendor: **Add-on packs screen REAL** (`money/packs`, `apps/vendor/src/pages/money/PacksScreen.tsx`, route `/v3/me/packs`, `money-data.ts`). Add-on tabs open the same generic record screen. Price and bundle discount are `PENDING` until staff set them (`pack-core.ts:107`). Add-on goods-pack list awaits the owner (memory note, UNVERIFIED in code). No add-on has its own theme section.

### 2.4 Verdict, counts

- Counting a pack REAL only when its working areas run end to end (backend rules, a pack-specific screen, a fitting theme section, own tests): **0 REAL**.
- **16 PARTIAL**: all have working generic backend records, a real generic vendor screen and a themed site; none has pack-specific logic or screens.
- **0 MISSING.**
- Weakest: PHARMACY, B2B_DEALER, RENTAL_FLEET, LOGISTICS, VEHICLE_SERVICE (no dedicated design, no own tests, workflow-heavy needs expressed only as record fields). Strongest: RETAIL, FIELD_SERVICE, CLINIC (backend modules for store, jobs, appointments exist; the vendor screens for them are not wired, section 3).

---

## 3. Vendor app, tab by tab (F2)

Sources: `get4domain-ui/apps/vendor/src/config/nav.ts` (tab definitions), `pages/bodies.ts` (route to screen; `REAL_SCREENS` list at line 108), `pages/TabPage.tsx`, each screen's `*-data.ts`, `packages/api/src/wave2|wave3` (typed client). Routes follow `/app/{group}/{item}`.

Rule from `bodies.ts:99-105`: a screen not in `REAL_SCREENS` is **sample-only**: in real mode it shows "not available yet" (`UnavailableState`), in sample/demo mode it shows fixtures. A nav item with no entry in `BODIES` shows a placeholder.

| Route | Screen | State | Real route(s) / evidence |
|---|---|---|---|
| home/overview | `HomePage` / `OverviewPage` | MOCK-ONLY (`home-data.ts`, `data/mock`) | no typed client import |
| business/enquiries | `InboxScreen` | **REAL** | `/v3/me/inbox`, `/inbox/waiting`, `/inbox/:id`, `/inbox/:id/state` (`inbox-data.ts`) |
| business/customers | `CustomersScreen` | **REAL** | `/v3/me/customers`, `/summary`, `/:id/archive|restore` (`customers-data.ts`) |
| business/jobs | `JobsPage` | MOCK-ONLY | backend `/v3/me/jobs` (9 routes) exists, not called |
| business/quotes | `QuotesPage` | MOCK-ONLY | backend `/v3/me/quotes` (7) exists, not called |
| business/work | `WorkPage` | MOCK-ONLY | backend `/v3/me/appointments` (19) exists, not called |
| business/deals | `DealsPage` | MOCK-ONLY | no matching V3 route found (UNVERIFIED) |
| business/orders | `OrdersPage` | MOCK-ONLY | backend `/v3/me/orders` (5) exists, not called |
| business/stock | `StockPage` | MOCK-ONLY | backend `/v3/me/store`, `/items`, `/stock` exist, not called |
| business/tasks | `TasksPage` | MOCK-ONLY | no V3 tasks route found (UNVERIFIED) |
| business/segments | `SegmentsPage` | MOCK-ONLY | no segments route found |
| business/import | `ImportPage` | MOCK-ONLY | no import route for customers found (`/v3/me/migration-requests` is a site migration) |
| business/offerings | `OfferingsPage` | MOCK-ONLY | `/v3/me/items` exists, not called |
| pack tabs (`/app/{group}/pack/{key}`) | `PackScreen` | **REAL** | `packRecords` client -> `/v3/me/packs/:packKey/tabs/:tabKey/records`, schema; `/v3/me/pack/capabilities` (`pack-data.ts`) |
| grow/website (pages, content, theme, brand, gallery, SEO, directory, revisions) | `WebsiteScreen`, `ThemePanel`, `MediaPanels` | **REAL** | `/v3/me/site`, `/site/draft`, `/draft/field`, `/draft/preview`, `/draft/publish`, `/site/revisions`, `/site/submissions`, `/site/editor/map`, `/site/theme`; theme switch client (`themeSwitch.preview/switch/history`); media client (`media.upload/list/remove`) |
| grow/domain | `DomainScreen` | **REAL** | `/v3/me/domains`, `/subdomain`, `/custom`, `/:id/verify`, `/:id/primary` (`domain-data.ts`) |
| grow/promotion, grow/social | `DraftsScreen` | **REAL** (drafts client) | `/v3/me/promotion`, `/v3/me/social` (3 routes each). These are drafts for the team, not publishing |
| grow/telecrm | `TeleCrmPage` | MOCK-ONLY | no V3 route (legacy CRM only) |
| grow/messages | `MessagesPage` | MOCK-ONLY | no V3 campaign route found (UNVERIFIED) |
| grow/marketplace | `MarketplacePage` | MOCK-ONLY | `/v3/me/service-requests` (6) and `/v3/me/services` exist, not called |
| grow/reviews, grow/chat | `ReviewsPage`, `ChatPage` | MOCK-ONLY | no V3 route found |
| grow/offers | `OffersPage` | MOCK-ONLY | `/v3/me/offers` (3) exists, not called |
| grow/ai-studio | none (nav item without a `BODIES` entry) | PLACEHOLDER | `/v3/me/ai` (2 routes) exists |
| grow/reports | `ReportsPage` | MOCK-ONLY | no V3 route found |
| money/sell | `SellPage` | MOCK-ONLY | no V3 counter-sale route found |
| money/invoices | `InvoicesScreen` | **REAL** | `/v3/me/documents`, `/:id/resend`, `/:id/download` (`money-data.ts`). Vendor's own invoices (`/v3/me/invoices`, 2) are not the documents list: UNVERIFIED which |
| money/payments | `PaymentsScreen` | **REAL** | `/v3/me/payment-requests`, `/:id/mark-paid`, `/:id/cancel` |
| money/accounting | `AccountingPage` | MOCK-ONLY | `/v3/me/accounts` (8) exists, not called |
| money/analytics | `AnalyticsPage` | MOCK-ONLY | none |
| money/invoice-settings | `InvoiceSettingsPage` | MOCK-ONLY | none found |
| money/payment-setup, more/payment-methods | `PaymentSetupPage` | MOCK-ONLY (no data import at all) | `/v3/me/payment-methods` (6) exists, not called |
| money/wallet | `WalletScreen`, `TopUp` | **REAL** | `/v3/me/wallet`, `/wallet/ledger`, top-up through the checkout client |
| money/packs | `PacksScreen` | **REAL** | `/v3/me/packs`, `/packs/:key/purchase` |
| more/plan | `PlanScreen`, `PlanCheckout` | **REAL** | `/v3/me/subscription`, `/v3/me/billing/invoices`, checkout client (wave3 `checkout.ts`, `billing.ts`) |
| more/profile | `ProfileScreen` | **REAL but narrow** | `/v3/me/tax-profile` only; business profile fields (`/v3/me/profile`, `/profile-schema`) not used here |
| more/team | `TeamScreen` | **REAL** | team client: list, invite, change, deactivate, reactivate (`/v3/me/team`) |
| more/help | `SupportScreen` | **REAL** | `/v3/me/tickets`, `/:id`, `/:id/messages` |
| more/notifications | `NotificationsPage` (`settings/TeamPages`) | MOCK-ONLY | none |
| more/legal | `LegalPage` | MOCK-ONLY | `/v3/me/terms` (2) exists |
| more/account | `AccountPanel` | local only (no data import): sign-in, colour, accent | auth routes not called here |
| more/activity | `ActivityPage` | MOCK-ONLY | `/v3/me/activity` (1) exists, not called |

**Counts:** 41 route entries in `BODIES`; 14 keys in `REAL_SCREENS` plus pack tabs (generic) and the theme panel = **16 real screens**, **25 MOCK-ONLY**, 1 placeholder (AI studio), 1 local-only (account). Of the 25 mock-only screens, at least 13 already have V3 backend routes (jobs, quotes, work, orders, stock, offerings, offers, marketplace, accounting, payment methods, legal, activity, AI studio) so the work is wiring, not backend.

Also in the vendor folder (not routed in V3): `pages/customers/*`, `pages/requests/*`, `pages/revenue/*` (`SellPage`, `AccountingPage` etc. are imported from `revenue`), `pages/inventory/*`, `pages/settings/*` older variants. Those with `mock` imports and no route are dead or re-homed code (UNVERIFIED which are unreachable).
