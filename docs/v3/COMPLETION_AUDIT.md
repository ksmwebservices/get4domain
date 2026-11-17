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

---

## 4. Admin app and the routes with no screen (F3)

Sources: `get4domain-ui/apps/admin/src/access/screens.ts` (the screens), `pages/registry.tsx`, each page's `*-data.ts`, and the baseline `backend-api/test/baselines/route-classification.json`.

**Method for "has a screen":** a script collected every path written in `apps/admin/src` and `packages/api/src` (not tests, not fakes), turned `${id}` and `:id` into one placeholder, and compared with the 542 admin routes of the baseline. A route counts as screened when its path appears in that code. This is a **string match**, not proof the screen calls it (a path in a list of documented routes also matches), so the screened number is an upper bound. UNVERIFIED per route.

### 4.1 The 11 admin screens

| Screen | Path | Real? | Main routes |
|---|---|---|---|
| Catalog (packs, tab fields, add-on eligibility) | `/catalog` | REAL | `/v3/admin/pack-engine/*` (18 of 18 routes) |
| Vendors (list, detail, subscription, site, domains, activity, plan pause/resume) | `/vendors` | REAL | `/v3/admin/vendors`, `/vendors/:id/*`, `/v3/admin/pack-engine/vendors/:id/*` |
| Invoices (plan orders, cash, settle) | `/invoices` | REAL | `/v3/admin/billing/orders`, `/orders/:id/mark-paid`, `/vendors/:vendorId/cash-orders` |
| Payments (gateway, held payments) | `/payments` | REAL | `/v3/admin/payment-gateway`, `/credentials`, `/billing/held-payments` |
| Partners (partners, slabs, commission, payouts) | `/partners` | REAL | `/v3/admin/partners`, `/commission/*` (v3-referrals 16 of 16) |
| Domains | `/domains` | REAL | `/v3/admin/domains`, connection retry, logs |
| On behalf (create listing, bulk import, claim links, pictures, profile fields) | `/create` | REAL | `/v3/admin/seeded-sites*` (16 of 17), `/claim-link*`, listing import, media |
| Tickets | `/tickets` | REAL | `/v3/admin/tickets*` (v3-support 5 of 5) |
| Staff | `/staff` | REAL | `/admin-team/members*` |
| Company profile | `/company` | REAL (SUPER_ADMIN) | `/v3/admin/firm-profile` |
| Settings (plan settings, GST, TDS, gateway keys) | `/settings` | REAL (SUPER_ADMIN) | `/v3/admin/plan-settings`, `PUT /v3/admin/gst-rate`, `/payment-gateway/credentials/:gateway/:mode` |

### 4.2 Routes with no screen

Totals: **542 admin routes; 148 screened; 394 not**. Split by what the route belongs to: V3 modules 337 routes (128 screened, **209 not**), legacy V2 modules 157 (20 screened, 137 not), shared 48 (0 screened, 48 not).

**V3 admin routes with no screen, by module (count not screened / total):**

| Module | Not screened | What it is |
|---|---|---|
| plans | 26 / 32 | plan, feature, price, tax-rate, override and audit-log editing (`/v3/admin/plans*`, `/features*`, `/prices*`, `/tax-rates*`, `/vendors/:id/overrides`, `/audit-logs`) |
| directory | 20 / 20 | directory businesses, categories, locations, placements, removal requests, visits, claim phone override, moderation |
| seo-directory | 17 / 25 | SEO pages and directory settings |
| v3-website | 16 / 19 | content reviews, act-on-behalf sessions, banner library, onboarding queue, per-vendor site banners/media/seo/testimonials |
| v3-services | 16 / 16 | the price book: services, add-on packs and their prices (create, approve, retire) |
| v3-trust | 14 / 14 | business proofs, business reports, prohibited terms, takedowns, trust blocklist |
| v3-registrar | 14 / 14 | domain margins, domain orders, identity checks, registrar runs, register for a vendor |
| vendor-lifecycle | 9 / 10 | suspend, reinstate, convert to free, restore pro, extend grace, account deletions |
| v3-admin-actions | 9 / 10 | listing merges, plan changes, business-name change, visits |
| v3-service-requests | 10 / 10 | requests to our team: assign, deliver, reject, SLA sweep |
| requests-orders | 9 / 9 | enquiry list, reports, blocklist, message outbox, vendor payment methods |
| v3-wallet | 8 / 8 | wallets, ledger, reconcile, adjustments, freeze, expiry run |
| provisioning | 6 / 9 | provisioning jobs (list, run, retry, cancel), invites, claim-link revoke |
| site-publish | 5 / 8 | build, publish, rollback, noindex, theme for a vendor |
| v3-activity | 6 / 7 | alerts and alert rules, attention list |
| v3-profile-fields | 5 / 6 | category profile field editing |
| site-domains | 3 / 10 | canonical, custom-domain add-on, domain state |
| v3-theme-switch | 3 / 3 | staff theme switch, history, recover |
| terms | 5 / 5 | terms and policy text (draft, edit, publish) |
| v3-mail | 2 / 2 | mail settings and rules admin |
| plan-billing | 1 / 14 | refund of a plan order |
| seeded-sites | 1 / 17 | claim link on a seeded site (UNVERIFIED) |

**Shared (all 48 unscreened):** `platform-settings` 4 (encrypted keys and pricing values: key entry for SMS, ResellerClub, OpenAI), ai-studio 9, themes 7, site-doc 8, website-themes 5, ai-templates 4, registry 5 (V2 registry), others small.
**Legacy with no screen (137, not needed for V3):** leadspace 50, commercial 30, bos 4, social 7, domain-campaign 7, quotes 7, admin-crm 4, managed-services 4, addons 4, domains 4, subscriptions 4, and others.

### 4.3 What the team needs for the business day (ranked)

| Rank | Day-to-day need | Routes with no screen | Verdict |
|---|---|---|---|
| 1 | **Enter plan prices, features and GST** (owner said this is done in the admin dashboard) | plans (26): no screen edits plan prices, features or tax rates; only the key/value plan-settings screen, GST rate and TDS exist | **NEEDED, missing.** The `plans` and `v3-services` price book have no screen; a PENDING price shows as "not set" for theme switch, add-on packs, services and domain margins |
| 2 | **Vendor go-live and creation** | provisioning jobs (6), site-publish build/publish/rollback (5), act-on-behalf (v3-website) | Partly covered: the On behalf screen creates and takes live a seeded listing; running a provisioning job, rollback and staff publish have no screen |
| 3 | **Support** | none (tickets screened) | OK |
| 4 | **Invoices and cash** | plan-billing refund (1) | Almost complete; refund missing |
| 5 | **Partners and commission** | none | OK |
| 6 | **Directory claims and listings** | directory (20), seo-directory (17): moderation, removal requests, claim phone override, placements | **NEEDED, missing.** Removal requests and moderation are legally time-bound; no screen |
| 7 | **Content moderation and trust** | v3-trust (14), v3-website content reviews (3), requests-orders reports/blocklist (9) | **NEEDED, missing.** Takedowns and abuse reports cannot be handled without a screen |
| 8 | **Account lifecycle** (suspend, reinstate, grace, deletion requests) | vendor-lifecycle (9), v3-admin-actions plan-change (9) | **NEEDED, missing** (deletion requests have a legal clock) |
| 9 | **Settings** (terms and policy text, mail rules, alerts) | terms (5), v3-activity (6), platform-settings keys (4) | terms text and keys **NEEDED**; alert rules rare |
| 10 | Rarely | v3-wallet adjustments and reconcile (8), v3-registrar (14, until domain sales are live), v3-service-requests (10, until the service desk runs), listing merges, theme switch staff tools (3), profile-field editing (5), seo settings | Later |

---

## 5. Public site and partner portal (F4)

Sources: `get4domain-pub/get4domain_mvp/src/app` (Next.js routes), `src/lib/v3-public/*`, `get4domain-pub/docs/v3/PUBLIC_GAPS.md`, `get4domain-ui/apps/partner/src`, `apps/site/src`, `get4domain-ui/docs/FRONTEND_GAPS.md`.

### 5.1 Switches that decide whether any of it is real

| Switch | Default | Effect | Evidence |
|---|---|---|---|
| `V3_PUBLIC_ENABLED` | off | every new V3 public route answers 404, nothing existing changes | `src/lib/v3-public/flag.ts:8-9` |
| `V3_PUBLIC_USE_MOCKS` | **on** (unless exactly `false`) | the typed client returns fixtures and never calls the API | `flag.ts:13-14` |
| `V3_REGULATED_PACKS_PUBLIC` | off | CLINIC, LAB, PHARMACY, PRACTICE_LEGAL_FINANCE landing pages 404 | PUBLIC_GAPS G34 |
| `MAIN_HOST`, `NEXT_PUBLIC_VENDOR_APP_URL`, `V3_PUBLIC_SUPPORT_*`, `V3_PUBLIC_GRIEVANCE_OFFICER_*` | unset | commercial pages replace the live pages only when set; vendor hand-off and legal contact blocks need them | G32, G38, G44 |
| `VITE_USE_MOCKS` (vendor, admin, partner apps) | per build | sample data instead of the API | `apps/*/src/data-layer` |

### 5.2 Public Next.js site routes (`get4domain_mvp/src/app`)

| Route | Real or mock | Notes |
|---|---|---|
| `/directory`, `/directory-pages/[...path]`, `/sitemaps/[file]`, `/directory-robots` | real when flag on and mocks off | directory pages from `/v3/directory/*`, `/v3/seo-directory`; indexable only when `directoryPagesIndexable` |
| `/claim`, `/claim/[token]`, `/claim/start/[slug]`, `/claim/live`, `/claim/screens` | real (needs `POST /v3/claim/start`, OTP routes) | claim OTP by e-mail needs `EMAIL_LIVE_SEND`; `/claim/live` is only a notice page, the approval itself is in the vendor app (journey 8) |
| `/account/login`, `/register`, `/forgot-password`, `/reset-password` | real; proxies `/directory-api/auth`, `/register` | reset mail needs `EMAIL_LIVE_SEND` (G12, G14) |
| `/legal`, `/legal/[doc]` and main-host `/terms`, `/privacy-policy`, `/refund-policy` | real pages with owner-default drafts (G18, G40-G42) | text awaits owner/lawyer |
| `(v3site)/v3-site/*`: home, about, contact, features, how-it-works, industries, pricing, register, `r/[code]`, referral-link | real; pricing from `GET /v3/public/pricing` | commercial pages; replace live pages when the flag and `MAIN_HOST` are on (G32) |
| `/vendor-site/[[...path]]` | real; relays the backend's stored page for a vendor host | **GET and HEAD only** (`vendor-site/[[...path]]/route.ts:33-34`); middleware ignores POST (`src/middleware.ts:78`) |
| `/directory-go/[id]` | real click-out | G3: id format |
| `/site/[subdomain]/*`, `/demo/*`, `/go/[slug]`, `/ls/[slug]`, `/admin/*`, `/dashboard/*`, `/login`, `/register` (old), `/engine` | **V2 (legacy)**, unchanged | V2 renderer and dashboards; not V3 |

No placeholder pages were found in the V3 public routes. The separate Vite marketing app `get4domain-ui/apps/site/src` has a `PlaceholderPage` used by `App.tsx:54,94` for paths without content and for the 404, plus blog, guides, themes gallery, tour: marketing content, no API calls (no `/v3` path in its source). Whether it is deployed is **UNVERIFIED**.

### 5.3 Partner portal (`get4domain-ui/apps/partner/src/pages`)

| Page | Real route | State |
|---|---|---|
| LoginPage | auth login | REAL (typed client) |
| LinkPage | `GET /v3/partner/link` | REAL; in sample mode a base address is faked |
| BusinessesPage | `GET /v3/partner/vendors` | REAL |
| CommissionPage | `GET /v3/partner/commission` | REAL |
| PayoutsPage | `GET /v3/partner/payouts` | REAL |
| (profile) | `GET /v3/partner/me` | REAL |

Five of five data routes are wired. A partner cannot be created in the portal; admin creates partners (admin Partners screen, REAL). The partner host/deploy is open per FRONTEND_GAPS "Still open" (slice 8, UNVERIFIED).

### 5.4 Open gaps (still open or relevant)

| Gap | State | Detail |
|---|---|---|
| **G2** handoff answer shape | STILL ASSUMED. The public site calls `POST /v3/auth/handoff` and redirects with `#handoff=<code>`; vendor app redeems through `POST /v3/auth/handoff/redeem` (code `ho_` + 43 characters). If the route fails the visitor goes to the vendor login (FRONTEND_GAPS "SLICE 5 FOLLOW-UP", H3/H4). Works, with a login fallback; `/auth/me` role/name shape H4 unconfirmed |
| **G31** packs list | OPEN. No public route lists the 16 packs with what each gives, or add-on packs with price status; the site keeps a copy in `lib/v3-public/packs.ts` |
| **G37** vendor theme rendering | BLOCKED-BY-GAP. The public app cannot render the chosen theme; it relays the finished page the backend stored |
| **termsAcceptanceRequired** | The backend sets it on the login answer (`src/auth/auth.service.ts`; `docs/API_CONTRACT_SLICE1.md:19`). A first registration answer lacks it; the terms screen must call `/auth/me`. **No vendor-app screen accepts terms**: grep of `apps/vendor` and `packages/api` finds the field only in `session.ts:27`; `POST /v3/me/terms/accept` (`src/terms`) is not called. A new terms version then blocks publishing a Pro site (`publish.service.ts:71`) with no way to accept |
| G1 | CLOSED on the backend (`POST /v3/claim/start` in the baseline); the site forwards to it |
| G12/G14 | e-mail switched off screens built; registered code `MAIL_DISABLED` unconfirmed |
| G22/G23 | by-host route relays text only; binary assets (fonts, images) UNVERIFIED |
| G24/G25/G26 | nginx order, reserved lists, directory host origin: owner/backend items; G26 is marked blocking for the directory host |
| G32-G44 | owner decisions: page replacement at go-live, support e-mail and grievance officer, lawyer review of policy texts, billing-term wording (quarterly vs annual, G43) |
| S4 (FRONTEND_GAPS) | only 37 of 196 category keys passed the seeded-site category check on staging; later closed by `kitCategoryFor` fallback in `listable-categories.ts` (code present); live re-check UNVERIFIED |
| S5/S6 | profile-field loader and upload settings not applied on staging (data, not code) |
| S7 | **no enquiry could be created in the smoke run** (see journey 3: the route exists but nothing calls it) |

---

## 6. Launch-critical journeys (F5)

States: PASS = the whole chain exists in code; PARTIAL = chain exists but a code gap or an owner switch stands in the way; BROKEN = a link in the chain is missing in code. "Live data" claims are UNVERIFIED because nothing was run.

| # | Journey | State | Trace and exact break |
|---|---|---|---|
| 1 | Visitor registers and gets a Free trial subdomain site live | **PARTIAL** | Public `/register` -> `/directory-api/register` -> `POST /auth/register` (public) -> `RegistrationHook` -> `ModuleTrialSite.createLiveTrialSite` builds and publishes the draft synchronously (`src/v3-trial/module-trial-site.ts:19-27`), subdomain from `TrialSignupPolicy`. Subdomain check `GET /v3/public/subdomain-availability`. Breaks only on switches/infra: `V3_PUBLIC_ENABLED` on and `V3_PUBLIC_USE_MOCKS=false`, wildcard DNS and host routing (E1 deploy plan), and the site is `noindex` until claimed (`indexing-rule.ts`). No terms-acceptance screen (section 5.4) |
| 2 | Vendor edits content and the public site shows it | **PASS** | Vendor `grow/website` REAL: `PUT /v3/me/site/draft/field`, `/draft/publish` (`website-data.ts`); backend rebuilds the stored page; `vendor-site` route is `force-dynamic` and relays it by host. Pro-only fields are refused on Free (`website.service.ts:177`). Publishing a CTA site needs current terms accepted (see journey 1 note) |
| 3 | Visitor sends an enquiry on the vendor site and the vendor sees it | **BROKEN** | Three breaks. (a) The theme's enquiry form posts `method=post action="/enquire"` (`themes/lib/render.mjs:389`) on the vendor host, but the public app's vendor-site handler exports only GET and HEAD (`route.ts:33-34`) and the middleware returns early for non-GET (`middleware.ts:78`), so the POST gets no handler (405, UNVERIFIED at nginx). (b) Even if forwarded, the backend route `POST /v3/public/sites/:host/requests` needs JSON with an `idempotencyKey`, a `consent` object (`contactByBusiness`, `contactByPlatform`, `marketing`) and a `kind` (`public-requests.service.ts:68-74`); the form sends `name, phone, message, consent=on, source` only. No code in `get4domain_mvp`, `get4domain-ui`, or `themes` calls that route. (c) The vendor Enquiries screen reads `GET /v3/me/inbox` (the **mail inbox**, `inbox-data.ts`), not `GET /v3/me/requests` (the requests inbox the public route writes to; `me-requests.controller.ts`), so a stored request would not appear. Also no SMS/WhatsApp/e-mail alert is ever sent (section 1.6). FRONTEND_GAPS S7 saw the same (no enquiry could be created) |
| 4 | Vendor pays through the gateway, plan activates, invoice appears | **PARTIAL** | Chain exists: vendor `more/plan` REAL (`PlanCheckout`) -> `POST /v3/me/billing/orders` -> gateway order -> webhooks `POST /v3/payments/razorpay/webhook` / `cashfree/webhook` or `POST /v3/me/billing/orders/:id/confirm` -> `PaymentSettlementService` activates the plan and calls `PlanPaidHook` (`settlement.service.ts:63`) -> invoice at `GET /v3/me/billing/invoices` (REAL). Blocked until the owner sets `paymentsMode` to `test`/`live`, keys, and for live `PLAN_PAYMENTS_LIVE_ENABLED=true` (`payments-gate.ts:37-93`). Invoice e-mail needs `EMAIL_LIVE_SEND`. FRONTEND_GAPS S8: never exercised against a gateway; `GET /v3/me/billing/orders/:id` missing (status falls back to confirm) |
| 5 | Cash confirmed by admin activates the plan | **PASS** | Admin Invoices screen REAL with `CashDialogs`: `POST /v3/admin/billing/vendors/:vendorId/cash-orders`, `/orders/:id/mark-paid` (settles through the same settlement service). Needs no gateway |
| 6 | Partner link brings a vendor and commission accrues | **PASS** (needs owner data) | `/v3-site/r/[code]` reads `GET /v3/public/referral/:code`, sets a cookie; register takes `referralCode` (`auth.service.ts:51` `ReferralAttributionPort`); on payment `ReferralsService.onPlanPaid` accrues (`referrals.service.ts:133`); partner portal and admin Partners/slabs/payouts screens REAL. Commission rates, slabs and TDS must be entered by the owner or no commission is created (UNVERIFIED default) |
| 7 | Team creates a vendor on behalf and makes the site live | **PARTIAL** | Admin On behalf REAL creates a seeded, **unclaimed** listing, issues a claim link, and has go-live (`POST /v3/admin/seeded-sites/:id/go-live`, `/claim-link`). A full vendor with a login and a plan is only created by the provisioning job (`POST /v3/admin/provisioning/jobs`, no screen) and the runner is off (`provisioningRunnerEnabled=false`); the invite is sandbox unless `inviteAdapterMode=live`. So "on behalf" works for listings, not for paying vendors |
| 8 | Business owner claims a directory listing | **BROKEN** | Public `/claim/start/[slug]` -> `POST /v3/claim/start` -> OTP `POST /v3/claim/:token/otp/request|verify` (e-mail needs `EMAIL_LIVE_SEND`; phone sandbox) -> `POST /v3/claim/setup` (password, acceptTerms) -> the owner must **approve** with `POST /v3/me/claim/approve` for the site to be built and published (`claim-setup.controller.ts:35-45`). The typed client has `claim.approve` (`packages/api/src/wave2/vendor.ts:207-211`) but **no vendor-app screen calls it**, so the site never goes live after a claim. Also unverified: the OTP delivery with all channels off |
| 9 | Theme switch with the wallet fee | **PARTIAL** | Vendor Theme panel REAL (`themeSwitch.preview/switch/history`, `/v3/me/site/theme/*`); first switch included. A later switch charges the price-book entry `THEME_SWITCH`; the fee is PENDING (a price is not set) and there is **no admin screen to set it** (v3-services price book, 16 routes unscreened), so later switches are refused as "price not set" until a coder or direct API call sets it. Preview is a server build (`previewUrl` / `previewHtml` shape assumed, FRONTEND_GAPS item 1) |
| 10 | Admin enters gateway keys, GST and TDS, checkout uses them | **PASS** (UNVERIFIED live) | Admin Settings REAL: `PUT /v3/admin/payment-gateway/credentials/:gateway/:mode`, `PUT /v3/admin/gst-rate`, TDS via `PUT /v3/admin/plan-settings/tdsPercent`; `PaymentsGate` reads stored keys first (`payments-gate.ts` buildGateway with credential service) and checkout reads the GST rate. Live additionally needs ENV `PLAN_PAYMENTS_LIVE_ENABLED`. Answer shapes marked `[W4?]` in the client |
| 11 | Support ticket from the vendor reaches the admin | **PASS** | Vendor Help REAL `POST /v3/me/tickets`, `/:id/messages`; admin Tickets REAL (`/v3/admin/tickets*`, 5 of 5). No e-mail notification either way (flags off); staff see it in the screen |
| 12 | Plan expiry and renewal | **PARTIAL** | Expiry is computed at read time: ACTIVE, GRACE, then the track's Free plan and listing-only pages (`entitlement-engine.ts:75-102`, `site-public.service.ts:73`), no job needed. Renewal: `PlanCheckout` and `POST /v3/me/plan/renew-with-wallet` are REAL. The reminder is off (`renewalRemindersEnabled=false`) and cannot reach the vendor anyway until e-mail/SMS are live. Staff lifecycle actions (extend grace, convert to free) have no screen |

**Count: PASS 5 (journeys 2, 5, 6, 10, 11); PARTIAL 5 (1, 4, 7, 9, 12); BROKEN 2 (3, 8).** Of the launch set (journeys 1 to 7 and 10): PASS 4 (2, 5, 6, 10), PARTIAL 3 (1, 4, 7), BROKEN 1 (3).

---

## 7. Completion queue (F6)

Repos: **BE** = `get4domain-w2` (backend in `backend-api`, theme kit in `themes/`, same git repo), **UI** = `get4domain-ui` (vendor, admin, partner, site apps, `packages/api`), **PUB** = `get4domain-pub/get4domain_mvp`. Sizes: S under half a day of agent time, M about a day, L several days. "Staging" = needs the staging database or server (integration tests or a smoke run). Tiers: **LAUNCH** = needed for journeys 1 to 7 and 10 with real data; **OPS** = needed to run the business day once live; **COMPLETE** = finishes V3 but does not block launch. Theme jobs (T-) come from section 9.

### 7.1 Ranked jobs

| Id | What | Why (journey or pack) | Repo | Size | Depends on | Staging | Tier |
|---|---|---|---|---|---|---|---|
| Q1 | **Enquiry form post, backend half.** New public route `POST /v3/public/sites/:host/enquire` that accepts the theme form's fields (`name`, `phone`, `message`, `consent`, `source`), builds the request body the existing `PublicRequestsService.submit` needs (kind ENQUIRY, server-made idempotency key, consent object at the current `customerConsentVersion`), and answers a 303 redirect or a small JSON. Keeps the spam, block, takedown and plan gates | Journey 3 (a, b) | BE | M | none | yes (integration test) | LAUNCH |
| Q2 | **Enquiry form post, public half.** Add POST to `vendor-site/[[...path]]/route.ts`, let `/enquire` POST pass the middleware, forward the visitor address in `X-Forwarded-For`, show a plain thank-you page; test with mocks off | Journey 3 (a) | PUB | S | Q1 contract (route name and answer are fixed above, so it can run in parallel) | no | LAUNCH |
| Q3 | **Vendor Enquiries reads the requests inbox.** Add `GET /v3/me/requests`, `/requests/:id`, `respond` to the typed client; Enquiries screen lists requests and mail messages together, with respond and status (the screen today reads only `/v3/me/inbox`) | Journey 3 (c) | UI | M | Q1 | no | LAUNCH |
| Q4 | **Real vendor alert on a new enquiry.** Make the messaging service's e-mail adapter send through the existing mail service when `EMAIL_LIVE_SEND` is on (it records SENT_SANDBOX only today), keeping the dashboard row as the fallback; WhatsApp/SMS stay sandbox until a provider exists (Q20) | Journey 3; vendor never knows an enquiry arrived | BE | M | Q1 | yes | LAUNCH |
| Q5 | **Admin plan, price, feature and tax-rate editor, and the price book.** Screens for `/v3/admin/plans*`, `/features*`, `/prices*`, `/tax-rates*`, `/vendors/:id/overrides`, audit log, plus `v3-services` (services, add-on packs, price approve/retire, the THEME_SWITCH fee). Prices stay owner data | Journeys 4, 9, 10 (prices are PENDING with no way to set them); add-on packs | UI | L | none | no | LAUNCH |
| Q6 | **Terms acceptance screen in the vendor app.** Call `POST /v3/me/terms/accept` when the login answer says `termsAcceptanceRequired`, and read `/auth/me` after a first registration; show current policy text on `more/legal` from `/v3/me/terms` | Journeys 1, 2 (publishing a CTA site requires accepted terms, `publish.service.ts:71`) | UI | S | none | no | LAUNCH |
| Q7 | **Create a full vendor on behalf.** Admin screens for provisioning jobs (create, list, run, retry, cancel), invites, claim-link revoke; staff site build, publish, rollback and noindex per vendor. Owner switch `provisioningRunnerEnabled` then makes it live | Journey 7 | UI | M | none | no | LAUNCH |
| Q8 | **Pilot the checkout against the gateway test mode** (smoke run, no code unless it fails): order, webhook, invoice, referral commission, wallet top-up, theme switch fee. Fix what it finds. Add `GET /v3/me/billing/orders/:id` | Journeys 4, 6, 9 never exercised (S8) | BE + UI | M | Q5 for prices | yes | LAUNCH |
| Q9 | **Claim approval step in the vendor app.** After claim setup and sign-in call `claim.approve` (already in `packages/api`) and follow `redirectTo`; show the go-live result | Journey 8 | UI | S | none | no | OPS (journey 8 is outside the launch set but the claim button is public) |
| Q10 | **Admin operations screens: directory.** Businesses, categories, locations, placements, removal requests (approve, execute, reject), moderate, claim phone override, visits | Directory claims; legal removal clock | UI | L | none | no | OPS |
| Q11 | **Admin operations screens: trust, reports and moderation.** Business proofs, business reports, prohibited terms, takedowns, trust blocklist, request reports and blocklist, content reviews, act-on-behalf sessions | Content moderation | UI | L | none | no | OPS |
| Q12 | **Admin operations screens: vendor lifecycle.** Suspend, reinstate, convert to free, restore Pro, extend grace, account deletions, plan changes, business-name change, listing merges, plan-order refund, staff theme switch and recover | Journey 12; legal deletion clock | UI | M | none | no | OPS |
| Q13 | **Admin settings screens: terms and policy text, alerts and alert rules, platform keys (`platform-settings`), mail rules.** | Settings | UI | M | none | no | OPS |
| Q14 | **Vendor screens wired to existing V3 routes.** Group A: Jobs, Quotes, Work (appointments), Orders, Stock, Offerings, Offers. Group B: Accounting, Payment setup and payment methods, Activity, Legal, Notifications, Profile (`/v3/me/profile`), AI studio, Marketplace (services and service requests). Each: client module, data hook, real screen, test, then add the key to `REAL_SCREENS` | 25 mock-only screens (section 3); retail, field-service and clinic packs | UI | L (two M jobs: Q14a, Q14b) | none | no | COMPLETE |
| Q15 | **Pack-specific working screens.** P1 shop and pharmacy (stock with batches and expiry, prescription requests, refills), P2 jobs (job cards, dispatch, quotes, AMC), P3 appointments and members (clinic visit notes, memberships, attendance), P4 logistics and rentals (shipments, trips, POD, fleet), P5 property, education, food, B2B dealer. Backend rules where the field set is not enough | Section 2 (16 packs PARTIAL) | BE + UI | L each | Q14 | yes | COMPLETE |
| Q16 | **Per-pack tests.** One spec per pack covering seed, tabs, record validation, nav and site rendering for the seven packs with no named test (VEHICLE_SERVICE, LOGISTICS, MEMBERSHIP_WELLNESS, EDUCATION, AGENCY_CONSULTING, HOSPITALITY_EVENTS, RENTAL_FLEET) | Section 2 | BE | S | none | no | COMPLETE |
| Q17 | **G31 public packs route.** `GET /v3/public/packs` listing the 16 packs, tabs, add-on packs and their price status; the public site reads it instead of its own copy | G31 | BE then PUB (one job each, in order) | S + S | none | no | COMPLETE |
| Q18 | **G3 and G22/G23/G26.** Document or change the `go` click-out id, confirm by-host rate limiting per visitor, return bytes for binary assets, directory host origin and sitemaps (`HOSTNAMES_PLAN.md`) | PUBLIC_GAPS | BE + PUB | M | none | yes | COMPLETE (G26 blocks the directory host going live: treat as LAUNCH for the directory) |
| Q19 | **Partner portal deploy and host**, and the `[W4?]` answer shapes confirmed against a staging run (theme preview, billing order status, held payment business name, `Content-Disposition` exposure) | Journey 6 on a real host; FRONTEND_GAPS S9, S10 | UI + BE | M | Q8 | yes | LAUNCH for the partner link host |
| Q20 | **Real SMS and WhatsApp transport** behind the existing ports once the owner picks a provider (`UnboundSmsTransport`, `smsAdapterMode`, `messagingMode`) | claim OTP by phone, enquiry alerts, visitor OTP when spam score is high | BE | M | owner picks provider | yes | OPS |
| Q21 | **Directory category alignment.** Make the 196 catalogue categories and the 41 kit categories one list (add `gym-yoga`, `salon-spa`, `tutor`, `auto-mechanic` to the catalogue or map them), so MEMBERSHIP_WELLNESS has category-matched themes | Section 9 | BE | S | none | no | COMPLETE |
| T1 | **Missing themes for packs with no dedicated design.** Pharmacy (licence field, upload prescription, order request), B2B dealer (enquiry-only catalogue, specifications), Rental fleet (vehicles with rates, booking enquiry), and a Membership and wellness design (plans, timings, trainers); each with category presets, lint and screenshots | Section 9.4 | BE (`themes/`) | L | Q21 | no | COMPLETE |
| T2 | **Premium tier themes and prices.** Today every theme is tier `Standard`; build a first set of `Premium` themes per track (T5 brief `docs/v3/themes-brief/T5_PRO_MOTION_AND_INDUSTRY_VARIANTS.md`), and a price entry per tier in the price book | Section 9.2 (no paid theme exists) | BE (`themes/`) | L | Q5 | no | COMPLETE |
| T3 | **Theme previews.** A public gallery with a rendered preview per theme per category (`GET /v3/public/themes` plus a preview page or stored thumbnails) and thumbnails in the vendor Theme panel and the admin; screenshots are only produced by a local tool today | Section 9.6 | BE + UI + PUB | M | none | yes | COMPLETE |
| T4 | **Theme render checks in CI.** Run the kit lint and the 41-category coverage in the V3 workflow and record the result (the theme tests are not shown in this audit as run) | Section 9.5 | BE | S | none | no | COMPLETE |
| T5 | **V2 theme store retirement decision and code.** `themes`, `website-themes`, `ThemePackage` and `theme-uploads/` are legacy; remove them from the V3 vendor Marketplace or map them | Section 9.7 | BE + UI | S | owner | no | COMPLETE |

### 7.2 Parallel lanes (at most two windows, one window per repo folder)

| Lane | Window 1 | Window 2 | Runs |
|---|---|---|---|
| **A (first)** | BE: Q1, then Q4, then Q16, Q17a | UI: Q6, Q7, then Q9 | start now: no shared file |
| **B** | BE: Q8 smoke and fixes (needs the owner's test-mode keys entered through the admin Settings screen; list in section 8) | UI: Q3 (after Q1 is merged), then Q5 | after A |
| **C** | PUB: Q2 (can start with Lane A, in place of the UI window, because the Q1 contract is fixed in 7.1), then Q17b, Q18 | UI: Q10, Q11, Q12, Q13 | after B |
| **D** | BE: Q20, Q21, T1, T2, T4 | UI: Q14a, Q14b, T3, Q15 | complete |

Lane A can run first. Q1 and Q2 together close journey 3; Q5 is the largest launch item and has no dependency, so it can also start in Lane A instead of Q6 if the owner prefers.

### 7.3 Launch set versus complete set

- **LAUNCH:** Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8, Q19 (journeys 1 to 7 and 10 with real data). Today four of the eight launch journeys pass (2, 5, 6, 10); with these jobs the other four (1, 3, 4, 7) become PASS or depend only on owner switches.
- **OPS (needed to run the business day):** Q9 to Q13, Q20.
- **COMPLETE:** Q14 to Q18, Q21, T1 to T5.
- Rough size: 26 jobs (Q1 to Q21 with Q14 counted once, plus T1 to T5), mostly M and L. The launch set (9 jobs) is about 2 S, 5 M and 2 L (Q5 and Q8 are the large ones).

### 7.4 Ready-to-use job lists (turn each block into a dispatch file)

**Dispatch G1-BE (backend, Lane A window 1):** Q1 enquiry form route; Q4 e-mail alert on enquiry; Q16 per-pack specs; Q17a public packs route. Hard rules as in this audit: path-only commits, no push, staging only for integration tests.
**Dispatch G1-UI (Lane A window 2):** Q6 terms screen; Q7 provisioning and staff publish screens; Q9 claim approve step.
**Dispatch G2-PUB:** Q2 vendor-site POST and thank-you; Q17b read packs route; Q18 public gaps.
**Dispatch G2-UI:** Q3 Enquiries on requests; Q5 plan, price and price-book editor.
**Dispatch G3-SMOKE (BE + UI):** Q8 test-mode checkout smoke with fixes; Q19 partner host and shape confirmations.
**Dispatch G4-OPS-UI:** Q10 directory, Q11 trust and moderation, Q12 lifecycle, Q13 settings screens.
**Dispatch G5-COMPLETE-UI:** Q14a, Q14b, T3 (UI part), Q15 UI parts.
**Dispatch G5-COMPLETE-BE:** Q15 backend rules, Q20, Q21, T1, T2, T4, T5.

---

## 8. Owner-only switches (flags and settings)

Everything below is entered by the owner (admin Settings screen for settings, server environment for ENV), not coding work. "Visitor" means a person using a vendor site, the directory or the public site.

| Switch (exact name) | Where | Default | What it does | What changes for a visitor when it is turned on |
|---|---|---|---|---|
| `V3_PUBLIC_ENABLED` | PUB env | off | switches on the V3 public routes (directory, claim, account, commercial pages, vendor-site relay) | new pages exist instead of 404 |
| `V3_PUBLIC_USE_MOCKS` | PUB env | on (mock) | `false` makes the public site call the real API | real directory data, real registration, real vendor sites instead of fixtures |
| `MAIN_HOST`, `NEXT_PUBLIC_VENDOR_APP_URL`, `V3_PUBLIC_SUPPORT_EMAIL/PHONE`, `V3_PUBLIC_GRIEVANCE_OFFICER_NAME/EMAIL` | PUB env | unset | main host, vendor-app hand-off, contact and grievance blocks | the commercial and policy pages replace the live ones; a grievance block with timelines shows |
| `V3_REGULATED_PACKS_PUBLIC` | PUB env | off | publishes landing pages of CLINIC, LAB, PHARMACY, PRACTICE_LEGAL_FINANCE | those industry pages appear and registration accepts them |
| `packGatedPacksOpen` | setting | off | opens the tabs of the four counsel-gated packs for vendors | vendors of those packs see their working tabs |
| `packOnlineMedicineCheckout` | setting | off | online medicine checkout of the pharmacy pack (no screen builds it yet) | none until built |
| `paymentsMode` (`off`, `test`, `live`) | setting | `off` | online plan payments | vendors can pay online; `live` also needs `PLAN_PAYMENTS_LIVE_ENABLED=true` and the live keys |
| `paymentGateway` | setting | `razorpay` | Razorpay or Cashfree | which payment window the vendor sees |
| `PLAN_PAYMENTS_LIVE_ENABLED` | API env | unset | lets live mode run | real money moves |
| gateway keys (`PUT /v3/admin/payment-gateway/credentials/...`), GST rate (`gst-rate`), TDS (`tdsPercent`) | admin Settings | unset | keys, tax | invoices show GST; commission shows TDS |
| `EMAIL_LIVE_SEND` | API env | off | system mail lane | claim code, identity code, password reset and plan receipts are actually e-mailed; claim and reset screens stop saying "e-mail is off" |
| `EMAIL_FORWARD_LIVE` | API env | off | forwards mailbox mail | business mail reaches the owner's own address |
| `heldEnquiriesEnabled` | setting | false | holds mail for businesses with an inactive plan | an inactive business's enquirers get held instead of refused |
| `smsAdapterMode` + `SMS_LIVE_ENABLED`, `SMS_LIVE_SEND` | setting + API env | sandbox / off | live SMS (a provider is still to be chosen and bound, Q20) | visitor phone codes and claim codes by SMS |
| `messagingMode`, `MESSAGING_LIVE_ENABLED` | setting + API env | sandbox only | live WhatsApp/SMS/e-mail for requests (not built; `true` makes sends FAILED) | nothing until Q4 and Q20 are built |
| `requestNudgeEnabled` | setting | false | reminders to vendors about unanswered requests | vendor gets reminders (through the same channels) |
| `provisioningRunnerEnabled` | setting | false | runs provisioning jobs every 30 s | vendors created on behalf get their draft site |
| `inviteAdapterMode` | setting | sandbox | `live` sends the claim invite | the business receives the invite message |
| `siteDraftBuilderMode` | setting | legacy | `renderer` builds the draft site and a preview | drafts look like the themed site |
| `provisioningDirectoryProfileEnabled` | setting | false | adds the directory profile step | a listing appears in the directory on creation |
| `directoryPagesIndexable`, `directoryIndexUnclaimed` | setting | false | allow search engines on directory pages and unclaimed listings | pages become indexable |
| `seededSiteIndexingMode` | setting | `OFF` (`QUALITY`) | allow indexing of seeded sites that pass the quality check | those sites become indexable |
| `canonicalSwitchTickEnabled`, `domainDnsLiveChecks`, `connectionWatcherEnabled` | settings | false | custom-domain jobs and real DNS checks | custom domains connect and switch automatically |
| `REGISTRAR_LIVE_SEARCH`, `REGISTRAR_LIVE_PURCHASE`, `registrarReconcileEnabled` and the null registrar settings (name servers, minimum balance, OTP limits, document size) | API env + settings | off / null | domain search and purchase through ResellerClub | vendors can search and buy domains |
| `renewalRemindersEnabled` | setting | false | renewal reminder job | vendors are reminded before expiry (needs e-mail or SMS live) |
| `walletExpiryTickEnabled`, `serviceAutoApproveEnabled` | settings | false | wallet credit expiry, auto-approval of service deliveries | credit expires; deliveries close themselves |
| `aiLiveCalls` and `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | setting + key | false | real AI calls | AI studio produces text and images |
| `VENDOR_GATEWAY_LIVE_ENABLED`, `VENDOR_GATEWAY_WEBHOOK_ENABLED` | API env | off | vendor's own gateway (no adapter exists, vendors confirm UPI by hand) | nothing until an adapter is built |
| `V3_LIVE` | API env | unset | strict startup check for the live container | the API refuses to start with a placeholder value |
| Plan features `site.cta`, `requests.inbox`, `site.themes` | plan data (admin, needs Q5) | per plan | enquiry form, inbox, theme library | a Free site is informational only; a paid plan can take enquiries and switch themes |
| Prices: plans, add-on packs, services, THEME_SWITCH fee, domain margins | admin (needs Q5) | PENDING | the numbers | prices appear on the pricing page and in checkout |
| Policy and consent texts (`customerConsentText`, `customerConsentVersion`, `seededNoticeText`, `customerDisclosureText`, terms kinds) | settings / admin (terms screen needs Q13) | draft wording | the legal text | visitors see and agree to the new text |

---

## 9. Theme inventory

Sources (read only): `themes/library/*/theme.json`, `themes/library/*/presets`, `themes/library/*/templates`, `themes/library/*/css`, `themes/data/category-map.json`, `themes/CONTRACT.md`, `docs/v3/THEMES_KIT_HANDOVER.md`, `backend-api/scripts/build-renderer.js`, `backend-api/src/site-publish/renderer/theme-render.service.ts`, `src/v3-theme-catalog/*`, `src/directory/core/listable-categories.ts`, `backend-api/prisma/seed/pack-engine/CATEGORY_TO_PACK_MAP_V1.csv`, vendor `grow/website/ThemePanel.tsx`. Nothing was run, so the lint, build and test results are **UNVERIFIED** as current.

### 9.1 What the catalogue is

The V3 catalogue is the folder `themes/library`. The backend serves exactly the themes found there that are not marked internal and that pass validation at start (`theme-render.service.ts` init and `listThemes`; `build-renderer.js` copies `library` and `data` to `dist/renderer`). That gives **5 served themes** plus 1 internal reference theme (`_starter`, `internal: true`, not served). `themes/reference/` holds two older reference themes (`clinic-calm`, `restaurant-hearth`) that are not part of the kit and not served. The V2 theme store (`ThemePackage`, `WebsiteTheme`, `themes` and `website-themes` modules, `theme-uploads/`) is a separate legacy world (section 9.7).

### 9.2 Every served theme

"Free or paid": every theme's manifest tier is `Standard`. The contract says tier is a price class and not a plan (`THEMES_KIT_HANDOVER.md` decision 5): a **Free-plan vendor gets the one Standard theme assigned to its category (access DEFAULT)**; a **paid plan** has the theme library (plan feature `site.themes` = `library`, `v3-plans.seed.json:18`) and may choose any theme of its track; the first switch is included and each later switch costs the price-book fee `THEME_SWITCH` (PENDING, no price set). No theme has its own price and **no `Premium` theme exists** (no manifest says Premium).

| Key | Name | Tier | Track | Families | Categories it was designed for (the preset list) | Presets | Page templates | CSS |
|---|---|---|---|---|---|---|---|---|
| `free-service-pro` | Service Pro | Standard | handyman | home-services, auto-services | plumber, electrician, carpenter, painter, ac-appliance-repair, pest-control, home-cleaning, locksmith, packers-movers, mason-contractor, cctv-security-installer, auto-mechanic, car-wash-detailing | 13 | about, contact, gallery, home, item, page, services | tokens, base, motion, print (about 36.7 KB) |
| `free-practice` | Practice | Standard | professional | healthcare, legal-finance, creative-consulting | doctor-clinic, dentist, physiotherapy, diagnostics-lab, lawyer, ca-tax-consultant, insurance-advisor, photographer, interior-designer-architect, event-planner, it-consultant | 11 | about, contact, doctors, gallery, home, item, page, services | same 4 files (36.3 KB) |
| `free-studio` | Studio | Standard | professional | education, wellness-beauty | coaching-centre, tutor, music-dance-school, salon-spa, gym-yoga | 5 | about, contact, courses, gallery, home, item, page, services | same (35.7 KB) |
| `free-hospitality` | Hospitality and Property | Standard | professional | hospitality-property | restaurant-cafe, hotel-homestay, travel-agency, real-estate-agent | 4 | about, contact, gallery, home, item, menu, packages, page, properties, services | same (35.9 KB) |
| `free-shop-lite` | Shop Lite | Standard | ecommerce | fashion-lifestyle, food-grocery, electronics-home, gifts-books | fashion-apparel, jewellery, grocery-kirana, bakery-sweets, electronics-mobile, home-furniture, gifts-handicrafts, books-stationery | 8 | about, contact, gallery, home, item, page, services | same (35.4 KB) |
| `kit-starter` (folder `_starter`) | Kit starter (internal) | Standard | all three | all 12 | all 41 | none | 7 | internal, **not served** |

All manifests: version 1, motion default Low, 5 to 12 approved fonts each (self-hosted by the platform). The 5 served themes list **disjoint** categories that together cover **41 kit categories** (13 + 11 + 5 + 4 + 8 = 41), which is how `defaultThemeFor(category)` picks the one assigned theme (`theme-render.service.ts`: "five themes list disjoint categories covering all 41").

### 9.3 Themes per pack

The pack view (`GET /v3/public/themes?pack=KEY`, `v3-theme-catalog/theme-catalog.service.ts` `forPack`, core `themesForPack`) matches themes whose categories overlap the pack's catalogue categories; if none overlap it falls back to themes of the same track. Counts below come from `CATEGORY_TO_PACK_MAP_V1.csv` (196 catalogue categories) against the manifests. No theme is named for a pack: themes are by family.

| Pack | Catalogue categories | Categories with a designed preset | Themes found by category | Themes by track fallback (if none) | Dedicated theme? |
|---|---|---|---|---|---|
| PROPERTY | 3 | 1 | free-hospitality (1) | - | yes (properties page) |
| CLINIC | 11 | 3 | free-practice (1) | - | yes |
| LAB | 1 | 1 | free-practice (1) | - | yes |
| PHARMACY | 2 | 0 | 0 | up to 4 (shop-lite plus the 3 professional themes), track values UNVERIFIED | **NO** |
| RETAIL | 41 | 8 | free-shop-lite (1) | - | yes |
| FOOD_SERVICE | 6 | 1 | free-hospitality (1) | - | yes (menu page) |
| FIELD_SERVICE | 44 | 10 | free-service-pro (1) | - | yes |
| VEHICLE_SERVICE | 8 | 1 | free-service-pro (1) | - | yes (one category only) |
| LOGISTICS | 10 | 1 | free-service-pro (1) | - | yes (one category only) |
| MEMBERSHIP_WELLNESS | 11 | 0 | 0 | 3 (hospitality, practice, studio) | **NO** (see 9.5) |
| EDUCATION | 12 | 2 | free-studio (1) | - | yes (courses page) |
| PRACTICE_LEGAL_FINANCE | 8 | 3 | free-practice (1) | - | yes |
| AGENCY_CONSULTING | 16 | 3 | free-practice (1) | - | yes |
| HOSPITALITY_EVENTS | 13 | 3 | free-practice, free-hospitality (2) | - | yes |
| RENTAL_FLEET | 2 | 0 | 0 | 3 (hospitality, practice, studio) | **NO** |
| B2B_DEALER | 8 | 0 | 0 | 1 (shop-lite) | **NO** |

Count per pack, by the rule above: 11 packs have 1 theme by category, HOSPITALITY_EVENTS has 2, B2B_DEALER gets 1 by track fallback, MEMBERSHIP_WELLNESS and RENTAL_FLEET fall back to 3, PHARMACY to up to 4. **Packs with no dedicated theme: PHARMACY, B2B_DEALER, RENTAL_FLEET, MEMBERSHIP_WELLNESS** (4 of 16). A pack still renders: `PACK_KIT_FALLBACK` (`listable-categories.ts:16-18`) sends it to one kit category and so to a theme (section 2.2). The four add-on packs have no theme of their own.

### 9.4 Is it a real template and styles or only a name

**Real for all 5 served themes.** Each folder has HTML page templates (7 to 10), four CSS files of about 35 KB, and a preset JSON per category (41 in total); `renderPage()` in `themes/lib/render.mjs` renders them and the backend serves them after validation (`theme-render.service.ts`, `renderer-loader.ts`; `site-theme-render.spec.ts`, `wave3-themes.spec.ts`, `themes/test/standard-themes.test.mjs` exist). The handover states that all five pass the whole lint, including the real-browser check at six widths (`THEMES_KIT_HANDOVER.md`, "Standard themes"): that is a past claim, **UNVERIFIED now**. A theme that fails validation is logged and not served, so a name cannot appear in the list without a template. Gaps in what the templates cover: 41 of the 196 catalogue categories have a designed preset; the other 155 render through the pack's fallback category and its preset, i.e. the look of a neighbouring business type. `free-hospitality` has the most page types (menu, packages, properties); `free-shop-lite` has no dedicated product or cart page beyond the shared `item` and `services` templates (the cart slot is renderer-provided), UNVERIFIED in a browser.

### 9.5 Category ids that do not line up

Four kit category ids are not in the 196-category catalogue: **`auto-mechanic`, `tutor`, `salon-spa`, `gym-yoga`** (script comparison of the manifests and `CATEGORY_TO_PACK_MAP_V1.csv`: 37 of 41 kit ids appear in the catalogue). Effects: MEMBERSHIP_WELLNESS (gyms, salons) gets no category match in the pack view although the kit has designs for them; a vendor whose industry is the catalogue id reaches them only through `PACK_KIT_FALLBACK` (`MEMBERSHIP_WELLNESS: 'salon-spa'`, `VEHICLE_SERVICE: 'auto-mechanic'`). The handover also says the category-to-legacy-pack map is an inference (`themes/data/category-map.json`, `status: "inference"`). Job Q21.

### 9.6 Previews

| Preview | Exists? | Evidence |
|---|---|---|
| Owner's own site preview (server builds the whole site with the chosen theme, shown in the vendor app) | **Yes** | `POST /v3/me/site/draft/preview`, `/v3/me/site/theme/preview` (`me-site.controller.ts:44`, `ThemePanel.tsx:159`); the answer shape (`previewUrl` or `previewHtml`) is assumed (FRONTEND_GAPS "Still assumed" item 1) |
| Preview per theme per category before choosing, for visitors or in a gallery | **No** | `GET /v3/public/themes?pack=` returns id, name, tier, tracks, access and categories only, no image or link (`v3-theme-catalog/theme-catalog.service.ts`) |
| Thumbnails or screenshots stored with a theme | **No** | no image in `themes/library/*`; `themes/.shots/` is git-ignored and absent in this checkout |
| Local review harness (coverage grid, motion lab, contrast, variant picker) | Yes, 127.0.0.1 only, for the team | `themes/lib/preview.mjs`, `themes/README.md` |
| Vendor theme gallery screen | Placeholder: `ThemeGallery.tsx` is not routed (`bodies.ts` has no entry); the Theme panel inside Website manager is the real one | `apps/vendor/src/pages/grow/ThemeGallery.tsx`, `bodies.ts` |
| Public site render of the chosen theme | Relays the backend's stored page; the public app cannot render a theme itself (G37) | `PUBLIC_GAPS.md` G37 |

### 9.7 Legacy theme world (not V3)

`src/themes` (10 routes), `src/website-themes` (9), models `ThemePackage`, `ThemeAsset`, `ThemeEntitlement`, `WebsiteTheme` (`prisma/schema.prisma:437-489, 1283`), the old marketplace and sample themes (`theme-sample.ts`), per-industry designs in `scripts/industry-designs`, and the raw HTML site `theme-uploads/clinic-demo` (a physiotherapy site, not converted to the kit format). These were not counted as catalogue themes. How many themes the V2 store holds in the database is **UNVERIFIED** (no database access).

### 9.8 Theme gaps (all in the queue)

1. No dedicated theme for PHARMACY, B2B_DEALER, RENTAL_FLEET, MEMBERSHIP_WELLNESS: **T1**, **Q21**.
2. No Premium tier or paid theme; the library is "any Standard theme of your track" on a paid plan: **T2**.
3. 155 of 196 catalogue categories have no designed preset: **T1** (expand presets) and **Q21**.
4. No preview per theme (gallery, thumbnails) and an unrouted placeholder gallery: **T3**.
5. Four kit ids not in the catalogue: **Q21**.
6. Theme switch fee has no price and no admin screen: **Q5**.
7. Lint and coverage not run in CI as recorded here: **T4**.
8. V2 theme store still present: **T5**.
