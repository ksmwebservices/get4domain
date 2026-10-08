# Vendor Dashboard & Platform Feature Audit — 2026-10-08

> **Docs-only, read-only audit** requested by KSM after reports that the vendor dashboard is confusing and partly broken. No application code, migration or deployment was changed. Companion documents: [DASHBOARD_IA_PROPOSAL.md](DASHBOARD_IA_PROPOSAL.md) (new navigation + business-model profiles), [FEATURE_REGISTRY_DESIGN.md](FEATURE_REGISTRY_DESIGN.md) (one source of truth + CI guard), [CLAIMS_VS_REALITY.md](CLAIMS_VS_REALITY.md) (every public claim vs the truth).
> Baseline it updates: [FEATURE_MATRIX.md](FEATURE_MATRIX.md) (2026-10-02, static-verified only). **This audit executed things**; where it confirms or contradicts the baseline it says so (§4.3).

## 0. How the evidence was gathered (and what was created / deleted)

| Source | What was done | Writes? |
|---|---|---|
| **Code** | Read the dashboard (`get4domain_mvp/src/app/dashboard/**`, `layout.tsx`, `lib/dashboard-config.ts`, `domainapp/**`), the standalone vendor apps (`stepnrock/`, `deebiphotography/`), and the backend modules behind each screen. Anchors are `file:line`. | none |
| **Production database** | **SELECT-only**, through a runner that refuses anything that is not a single `SELECT`/`WITH` ([evidence/dashboard-audit/q.js](evidence/dashboard-audit/q.js)). Counts, flags and shapes only — no passwords, tokens, keys, wallet secrets or customer personal data were read or printed. | **none** |
| **Execution tests** | The *real compiled backend* (`dist/`, real Nest DI, real Prisma) was run against an **isolated in-memory PostgreSQL** (PGlite served over TCP on 127.0.0.1) loaded with the current `schema.prisma`. Sandbox vendors were created with the existing demo mechanism (`DemoService.provisionSandbox`). Razorpay, email, SMS and WhatsApp were stubbed. | **only in the throw-away database** |
| **AI providers** | **One** real text-generation call (Claude, the only key present locally). OpenAI, DALL-E, Stability, video and reel providers were traced in code only (no local keys). | n/a |

**Created / deleted.** Because the tests ran in an isolated database that is discarded when its process stops, **nothing was created in or deleted from production** (no sandbox vendors, no rows, no files). The throw-away database held a handful of sandbox vendors from the demo mechanism (created by the three trace scripts and a few aborted runs); the server process was stopped at the end. The existing production cleanup was deliberately *not* used — see finding 10 for why it could not have worked.

Scripts and raw outputs are kept in [evidence/dashboard-audit/](evidence/dashboard-audit/) (`commerce-trace`, `journeys-trace`, `ai-trace`, `inventory.json`, `prod-readonly-queries.md`).

## 1. The ten findings KSM must know

1. **There are three separate product stores and nothing connects them.** *My Products* (website) writes `VendorProduct`; the industry *Products/Catalog/Menu* tabs write `CatalogItem`; Retail's *Products / Inventory / Orders(POS)* tabs write `RetailProduct`. Stepnrock's 14 products exist **only** in `VendorProduct`, so its Inventory, Products and POS screens are empty. (Prod: VendorProduct 28 rows, CatalogItem 120 — all in demo sandboxes, RetailProduct 0.)
2. **Stock does not work for website sales.** Checkout never checks or reduces `VendorProduct` stock; no screen or API can set `CatalogItem.stock` (0 of 120 rows have it; the create form is rejected by validation if you send it); there is no "out of stock" state — hiding a product is the only switch; the storefront defaults every dashboard-added product to "10 in stock". Stepnrock's 12 `stockQty` values are read by **nothing** on the server. *(Executed: sold 2 of a product with stock 5 → stock stayed 5; ordered 50 → accepted.)*
3. **Where stock does work it can go negative, and money can be taken for goods that are gone.** Two simultaneous sales of 2 against stock 3 left **−1** (website catalogue checkout *and* in-store POS). If an item sells out between "pay" and "confirm", the customer is charged and the order is rejected — nothing refunds them. No low-stock alert exists anywhere (only a count); web orders have no cancel/restore path and checkout collects **no shipping address**.
4. **No vendor can take an online payment today.** 0 of 5 live vendors have Razorpay keys saved, so public checkout is disabled for all of them (prod: 0 web orders ever, 0 POS sales). Separately, *customer invoices* (vendor → their customer) create payment links with the **platform's** Razorpay account, and no webhook ever marks them paid.
5. **The Website Manager does not control the vendor sites that matter.** 3 of the 5 live vendors run standalone apps (stepnrock, deebiphotography, allwin). Stepnrock ignores every CMS text, SEO and contact field (its phone number is hard-coded); deebiphotography reads only the portfolio. Only products flow through. There is **no "add a page"**, **no GEO/AEO** (only title/description/keywords text boxes; the Google Analytics ID is stored and never injected).
6. **The plan you buy does not decide what you can use.** Workspace-vs-BOS entitlements are defined but consumed by nothing. Menu items are unlocked only by per-vendor admin switches that **default OFF** (Growth Hub, TeleCRM, Communication Hub, Website Manager/My Products, Customer Hub, Analytics) — 4 of 5 live vendors were switched on by hand. A newly paying vendor sees a locked sidebar. BOS-only items (Accounts, HRM) are visible to everyone.
7. **The menu is 25 fixed entries plus 4–7 industry tabs over 31 screens, with 12 duplicated purposes, 3 fakes/placeholders and a missing door.** *Settings* is a fake save; *Notifications* shows hard-coded **mrtravels demo notifications to every vendor**; *HRM* is a placeholder; the new **Billing page (plan, invoices, Pay, UPI) is not in the menu at all** — a vendor with a payment due cannot find the Pay button (stepnrock's is due 2026-10-10).
8. **AI Studio's failures are hidden, not absent.** Text generation prefers the OpenAI key and **never falls back** to Claude; any provider error becomes the same vague "temporarily unavailable". Both keys exist in the production settings (so the likely cause is an invalid/uncredited key — the VM log shows which). With an empty wallet the provider is called *first* and the debit fails after. Images are DALL-E temporary links; reels cannot render inside the container; video is a mock sample clip. *(Executed: the only local Claude key returns HTTP 401.)*
9. **Several headline claims are not built.** Social "posting" is a mock that reports *published*; there is no scheduling job; GEO/AEO, backlinks, Google Business/Search Console connections, HRM and task management (outside Technology) have no software behind them; the WhatsApp bot has no vendor credentials. See [CLAIMS_VS_REALITY.md](CLAIMS_VS_REALITY.md): of 45 claims: 13 SAFE, 23 REWORD, 9 REMOVE-UNTIL-BUILT.
10. **The platform is barely exercised and does not clean up.** 39 expired demo vendors from as far back as 2026-08-13 are still in the database: the only cleanup is a manual endpoint, it is not scheduled (only 2 cron jobs exist), and it would fail anyway because it never deletes the wallet row the demo gave them. Live usage across the 5 real vendors: 5 leads, 0 expenses, 0 customer invoices, 0 team members, 0 AI generations, 0 domains.

## 2. Ground truth (production, SELECT-only counts, 2026-10-08)

| Fact | Value |
|---|---|
| Vendors | 46 = 5 live + 40 sandbox + 1 admin; **39 of the 40 sandboxes are past expiry** (oldest expiry 2026-08-13) |
| Live vendors | `stepnrock` (retail, standalone app), `ksm-webtech-services` (retail), `mrtravels` (travel), `allwintours` (travel), `deebiphotography` (photography, standalone app) |
| Product rows | `VendorProduct` 28 (stepnrock 14, mrtravels 7, deebi 7) · `CatalogItem` 120 (live vendors: 0; **with stock set: 0**) · `RetailProduct` 0 · `PosSale` 0 (web 0) |
| `VendorProduct` universal columns (`stockQty`, `sku`, `status`…) | **exist in the live schema**, but no backend code reads or writes `stockQty`, `sku`, `status` or `reorderLevel` on this table |
| Online payments | `VendorPaymentConfig` enabled for **0/5** live vendors |
| Modules | `VendorModule` rows exist for 4/5 live vendors (all 6 optional modules ON, set by an admin); modules default OFF in code (`addons.constants.ts:20-32`) |
| Feature usage by live vendors | leads 5 (deebiphotography), campaigns 1 + landing page 1 (allwintours), CMS rows 3, expenses 0, contacts 0, customer invoices 0, team 0, domains 0, AI generations 0, WhatsApp conversations 0 |
| Themes | 2 (1 premium, 0 flagged default, 0 with raw multi-page HTML) |
| Provider settings present | AI: `anthropic_api_key`, `openai_api_key` (both set 2026-08-11) · Fast2SMS `api_key` · Razorpay platform key id + secret · ResellerClub `api_key`, `reseller_id` (**no customer/contact/nameserver ids**) · video providers: **none** · WhatsApp BSP: **none** |
| Stepnrock now | billing term `ACTIVE_PAYMENT_DUE` (Workspace half-yearly), AI credit ₹250 granted once, wallet ₹250, payment due 2026-10-10 |

## 3. Task 1 — Menu inventory

Generated from the route tree and import graph by [evidence/dashboard-audit/inv.js](evidence/dashboard-audit/inv.js); menu placement and gating are exactly as coded in `layout.tsx:96-159` and `dashboard-config.ts:74-88`. The endpoint scan is static (it follows imports three levels deep); verbs are omitted because the scan cannot always tell them apart — see `inventory.json` for the raw data.

### 3.1 Every vendor dashboard route

| Route | Menu label | Menu section | Gating (from `layout.tsx` / `dashboard-config.ts`) | Lines (page / incl. imports) | Last changed | Backend endpoints called (static scan) | Tables touched |
|---|---|---|---|---:|---|---|---|
| `/dashboard` | Overview | Home | always | 302/467 | 2026-10-03 | `/crm/leads${params `, `/crm/telecrm/followups`, `/wallet/balance`, `/domainapp/invoices:id`, `/analytics/usage:id` +6 more | CampaignLead, CallLog, Wallet, WalletTransaction, GenericInvoice, usage aggregates |
| `/dashboard/accounts` | Accounts | Account | always (not plan-gated) | 877/877 | 2026-08-28 | `/accounting/summary:id`, `/accounting/expenses:id`, `/accounting/payments:id`, `/accounting/gst-filings`, `/accounting/travel-summary` +25 more | Expense, PaymentRecord, GstFiling, RetailProduct, PosSale (type retail) |
| `/dashboard/go-live` | Subscription | Account | always | 176/176 | 2026-10-01 | `/demo/buy/order`, `/demo/buy/confirm` | Vendor, Subscription, Invoice, Wallet |
| `/dashboard/hrm` | HRM | Account | always (not plan-gated) | 31/31 | 2026-10-03 | — | — |
| `/dashboard/invoices` | Invoices | Account | always | 162/162 | 2026-08-11 | `/invoices/vendor/:id`, `/invoices/:id/pdf`, `/invoices/:id/email` | Invoice (platform → vendor) |
| `/dashboard/payments` | Payments | Account | always | 109/109 | 2026-09-06 | `/vendor-payments` | VendorPaymentConfig |
| `/dashboard/settings` | Profile + Settings (two entries, one page) | Account | always | 83/83 | 2026-08-28 | — | — |
| `/dashboard/stationery` | Stationery | Account | always | 84/84 | 2026-08-28 | `/stationery`, `/stationery/:id` | StationeryOrder |
| `/dashboard/support` | Support | Account | always | 174/174 | 2026-08-28 | `/ai/chat`, `/support/tickets` | Wallet, WalletTransaction (+ provider APIs), SupportTicket |
| `/dashboard/team` | Team | Account | owner only | 218/218 | 2026-08-28 | `/team/members`, `/team/invite`, `/team/members/:id` | TeamMember |
| `/dashboard/wallet` | Wallet & Billing | Account | always | 236/236 | 2026-08-15 | `/wallet/balance`, `/wallet/transactions`, `/wallet/topup`, `/wallet/topup/verify` | Wallet, WalletTransaction |
| `/dashboard/ai-studio` | AI Studio | Grow | wallet-gated (never locked) | 669/669 | 2026-08-28 | `/ai/costs`, `/design/templates`, `/ai-templates:id`, `/business-documents/templates`, `/business-documents/render` +8 more | Wallet, WalletTransaction (+ provider APIs), WalletTransaction |
| `/dashboard/campaigns` | Growth Hub | Grow | module growth_hub | 418/418 | 2026-08-28 | `/campaign-pages`, `/campaign-pages/:id/analytics`, `/campaign-pages/generate` | CampaignPage, Campaign |
| `/dashboard/communication` | Communication Hub | Grow | module communication_hub | 345/345 | 2026-08-28 | `/communication/threads`, `/communication/history`, `/communication/send`, `/vendor-comms` | comm threads, VendorCommsSettings |
| `/dashboard/telecrm` | TeleCRM | Grow | module telecrm | 40/964 | 2026-08-27 | `/crm/leads${params `, `/crm/leads/:id`, `/crm/leads/:id/call`, `/crm/leads`, `/crm/leads/import` +5 more | CampaignLead, CallLog, industry config (code), VendorModule, VendorAddon |
| `/dashboard/whatsapp-bot` | WhatsApp Bot | Grow | module communication_hub | 158/158 | 2026-08-28 | `/whatsapp-bot/kb`, `/whatsapp-bot/kb/:id` | WhatsApp KB / conversations |
| `/dashboard/domain-app/[tab]` | <industry tabs> (3–7 per industry) | Industry | module domainapp + addon per tab | 264/7686 | 2026-08-28 | `/industries/me`, `/industries/:id`, `/modules/vendor`, `/addons/vendor`, `/domainapp/summary` +118 more | industry config (code), VendorModule, VendorAddon, Record, Contact, CatalogItem |
| `/dashboard/customer-hub` | Customer Hub | Manage | module customer_hub | 110/138 | 2026-08-27 | `/domainapp/contacts:id`, `/customer/invite` | Contact, customer portal |
| `/dashboard/domain-management` | Domain | Manage | always | 244/296 | 2026-09-07 | `/domains/mine`, `/domains/config`, `/domains/search`, `/domains/register`, `/domains/connect` +1 more | DomainRegistration (+ ResellerClub) |
| `/dashboard/embed` | Embed / Widget | Manage | module website_manager | 61/61 | 2026-08-17 | `/widget/my-key` | widget key |
| `/dashboard/my-products` | My Products | Manage | module website_manager | 369/535 | 2026-10-01 | `(unmapped)`, `/cms/vendor/:id/products`, `/cms/products/:id` | VendorProduct, Category |
| `/dashboard/my-website` | Website Manager | Manage | module website_manager | 453/670 | 2026-10-01 | `/website-themes/mine:id`, `/website-themes/:id/unlock/order`, `/website-themes/:id/unlock/confirm`, `(unmapped)`, `/cms/vendor/:id` +4 more | WebsiteTheme, VendorTemplateUnlock, Subscription (theme counter), VendorCMS, industry config (code), VendorModule |
| `/dashboard/orders` | Website Orders | Manage | module website_manager | 80/80 | 2026-09-06 | `/engine/orders` | PosSale (type web), engine actions |
| `/dashboard/reports` | Analytics Hub | Manage | module analytics_hub | 184/184 | 2026-08-17 | `/crm/leads${params `, `/campaigns`, `/domainapp/invoices:id`, `/wallet/transactions`, `/domainapp/summary` +1 more | CampaignLead, CallLog, CampaignPage, Campaign, GenericInvoice, Wallet |
| `/dashboard/website-engine` | Website Engine | Manage | module website_manager | 217/2221 | 2026-09-07 | `/cms/vendor/:id`, `/cms/vendor/:id/products`, `/engine/actions` | VendorCMS, VendorProduct, Category, PosSale (type web), engine actions |
| `/dashboard/billing` | (not in menu) | — | — | 330/1204 | 2026-10-07 | `/invoices/vendor/:id`, `/subscriptions/vendor/:id`, `/payments/create-order`, `/payments/verify`, `billingApi.me` +10 more | Invoice (platform → vendor), Subscription, Invoice, Payment (platform Razorpay), BillingTerm, ManualPaymentSubmission |
| `/dashboard/crm` | (not in menu) | — | — | 254/514 | 2026-09-07 | `/crm/leads${params `, `/crm/leads`, `/crm/leads/:id` | CampaignLead, CallLog |
| `/dashboard/domain-app` | (not in menu) | — | — | 94/94 | 2026-07-18 | — | — |
| `/dashboard/landing-page` | (not in menu) | — | — | 303/303 | 2026-08-28 | `/campaign-pages`, `/campaign-pages/:id/analytics`, `/campaign-pages/generate`, `/campaign-pages/:id` | CampaignPage, Campaign |
| `/dashboard/my-services` | (not in menu) | — | — | 261/261 | 2026-10-02 | `/domain-campaign/clients/me`, `/invoices/vendor/:id`, `/support/tickets` | DomainCampaign records, Invoice (platform → vendor), SupportTicket |
| `/dashboard/notifications` | (not in menu) | — | — | 48/48 | 2026-07-18 | — | — |

*Notes:* `/dashboard/billing` includes admin-client code only because `lib/commerce.ts` exports both admin and vendor clients; the page itself calls `/billing/*`, `/invoices/vendor`, `/subscriptions`, `/payments/*`. Routes marked "(not in menu)" are reachable only by URL or an in-page link.

### 3.2 Grouping by the vendor's job (today)

| Job | Where it lives today | What is wrong |
|---|---|---|
| **Sell** (products, stock, orders) | Industry tabs (`products`/`catalog`/`menu`, `inventory`, `orders`), *My Products*, *Website Orders*, *Payments* | Three product stores; orders split across POS / website orders / generic "orders" records; payments setup under "Account" |
| **Website** (content, theme, pages, domain, SEO) | *Website Manager*, *Website Engine*, *Embed/Widget*, *Domain*, *Landing page* (not in menu) | Four screens for one job; SEO is a tab inside Website Manager; no pages; engine page is a diagnostic, not a manager |
| **Grow** (leads, campaigns, AI, messaging) | *Growth Hub*, *TeleCRM*, *AI Studio*, *Communication Hub*, *WhatsApp Bot*, *Customer Hub*, CRM (not in menu) | Leads in 2 tables' worth of screens; campaigns vs landing pages share APIs |
| **Money** | *Wallet & Billing*, *Payments*, *Invoices*, *Accounts*, *Subscription*, Billing (not in menu) | Five names for "billing"; vendor→platform invoices, vendor→customer invoices and expenses are all "invoices/accounts" |
| **Operate** | industry tabs (bookings, fleet, rooms…), *Team*, *HRM*, *Stationery* | Fine per industry; HRM placeholder |
| **Settings** | *Profile* and *Settings* (same fake page), *Support*, *Notifications* (fake) | Two entries, one fake page |

### 3.3 Industry tabs (menu section named after the industry)

All 20 industries plus the `general` fallback, from `backend-api/src/config/industries/*.ts` and the dispatcher in `domain-app/[tab]/page.tsx:120-262`. "Catalog" means the shared `CatalogView` over **`CatalogItem`**.

| Industry | Tabs → view |
|---|---|
| travel | bookings → records · trip-sheets → Trips · visa → Visa · fleet/drivers/contracts → dedicated (addon-gated) · invoicing → Invoicing |
| salon | appointments → Schedule · services → Catalog · stylists → Stylists · billing |
| gym | members → Memberships · classes → Classes · plans → Catalog · **attendance → "Coming soon" stub** · billing |
| hotel | reservations · rooms · housekeeping (addon-gated) · billing |
| realestate | enquiries → Deals · properties → Listings · visits · clients → Contacts · **documents → "Coming soon" stub** |
| education | students → Enrollments · courses → Catalog · batches · fees → Invoicing |
| coaching | students · courses → Catalog · batches · fees |
| professional | engagements · clients → Contacts · documents · billing |
| construction | projects · clients · materials (addon) · billing |
| events | bookings · packages → Catalog · vendors (addon) · billing |
| finance | cases · clients · documents · billing |
| automobile | jobs · customers → Contacts · inventory → **PartStock** · billing |
| logistics | shipments · fleet · drivers · billing |
| diagnostics | bookings → TestOrders · tests → Catalog · patients → Contacts · reports |
| photography | bookings → Shoots · packages → Catalog · gallery → Delivery · billing |
| agriculture | orders → ProduceOrders · produce → Catalog · buyers → Contacts · inventory → **ProduceStock** |
| technology | projects · clients · tasks → TechTasks (ProjectTask) · billing |
| clinic | appointments · patients → Contacts · doctors · prescriptions · billing |
| restaurant | orders → Restaurant orders · tables · menu → Catalog · kitchen · billing |
| **retail** | **orders → POS (`RetailProduct`, type "retail")** · **products → `RetailProduct`** · customers → Contacts · **inventory → `RetailProduct`** |
| general | transactions → records · customers · catalog → Catalog · billing |

Two combinations still render the customer-facing "Coming soon … workspace is being finished" stub (`ComingSoon.tsx`, `page.tsx:259`): **gym/attendance** and **realestate/documents**. The wording breaks KSM's "no coming soon" rule and should become an availability/upgrade card.

### 3.4 Duplicated purposes (same job, endpoint or table behind different menus)

| # | Purpose | Duplicates | Evidence |
|---|---|---|---|
| D1 | Products / catalogue | My Products (`VendorProduct`) · industry Catalog/Menu/Packages tabs (`CatalogItem`) · Retail Products (`RetailProduct`) | `my-products` → `/cms/vendor/:id/products`; `CatalogView` → `/domainapp/catalog`; `ProductsView` → `/retail/products` |
| D2 | Stock | `RetailProduct.stockQty` (Retail Inventory) · `CatalogItem.stock` (unsettable) · `VendorProduct.stockQty` (unused) · `customFields.stockQty` (what stepnrock's site reads) · `PartStock` · `ProduceStock` | §5 |
| D3 | Orders | Website Orders (`PosSale` type "web") · Retail "Orders" tab (= POS, type "retail") · generic "orders" `Record`s · restaurant orders | `orders/page.tsx:25`; `domain-app/[tab]/page.tsx:125` |
| D4 | Customers | Customer Hub (`Contact`) · industry customers/clients/patients tabs (`Contact`) · CRM and TeleCRM (`CampaignLead`) | executed: a captured lead creates **no** customer record |
| D5 | CRM | `/dashboard/crm` (not in menu) · TeleCRM board (same table) | `crm/page.tsx`, `telecrm/page.tsx` |
| D6 | Billing | Wallet & Billing · Subscription (go-live) · Invoices (vendor→platform) · **Billing (not in menu)** · industry Billing/Invoicing tab (vendor→customer, `GenericInvoice`) · Accounts | layout `:147-150`; billing page orphaned |
| D7 | Profile | Profile and Settings → the **same** route, a fake page | `layout.tsx:146,155`; `settings/page.tsx:8-14` |
| D8 | Website | Website Manager · Website Engine (readiness diagnostic) · Embed/Widget · Landing page (not in menu) vs Growth Hub (same 4 endpoints) | `landing-page` and `campaigns` both call `/campaign-pages*` |
| D9 | Notifications | `/dashboard/notifications` (static array) vs the real notifications API used by the Overview | `notifications/page.tsx:3-8` |
| D10 | Messaging | Communication Hub · WhatsApp Bot · Growth Hub campaigns · TeleCRM calls | — |
| D11 | Payments naming | "Payments" (vendor's **own** Razorpay keys) vs "Wallet & Billing" (the **platform** wallet) | `payments/page.tsx` → `/vendor-payments` |
| D12 | Subscription | Subscription (go-live purchase), My Services (not in menu), Billing page plan card, Overview CTA | — |

### 3.5 Fakes, placeholders and orphans

* **Fake save:** *Settings/Profile* — `settings/page.tsx:8-14` runs a `setTimeout`, calls no API.
* **Fake content:** *Notifications* — `notifications/page.tsx:3-8` ships four hard-coded notifications about `mrtravels.get4domain.com` and invoices INV-001/002 to **every** vendor.
* **Placeholder:** *HRM* — `hrm/page.tsx:1-31` ("Setting up your account — available shortly").
* **Orphans (no menu entry):** `/dashboard/billing`, `/dashboard/crm`, `/dashboard/landing-page`, `/dashboard/my-services`, `/dashboard/domain-app` (old index, last changed 2026-07-18).

## 4. Task 2 — Feature truth table

Scope: every feature in the public Workspace/BOS lists (`lib/pricing.ts:35-80`, `data/platform-features.ts:25-125`) and the PRD feature groups they derive from. **WORKING** = a write persists *and* the read reflects it, shown by an executed trace or production data. **PARTIAL** = real but limited/unreachable for some vendors. **BROKEN** = exists but fails or misleads. **MISSING** = no software behind it. Items that are staff-delivered services are tagged **SERVICE**.

### 4.1 Table

| # | Public claim | Plan | UI (today) | Endpoint → table | Persist + read reflects? | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Industry website, hosting & SSL | WS/BOS | `/site/[subdomain]` (platform renderer) or a standalone app | `GET /cms/site/:sub` → VendorCMS, VendorProduct | Yes for platform-rendered; **standalone apps ignore CMS text** | PARTIAL | trace J1; `stepnrock/lib/site-data.ts`; hard-coded phone `CartView.tsx:326`, `contact/page.tsx:72` |
| 2 | Theme & website customization (2 / 4 per year) | WS/BOS | Website Manager ▸ Template | `PUT /cms/vendor/:id` → VendorCMS.themeId, Subscription counter | Counter enforced `cms.service.ts:117-148`; **counter shown only on the orphaned Billing page**; only 2 themes exist | PARTIAL | prod: 2 themes; `billing/page.tsx:239-265` |
| 3 | PWA — installable | WS/BOS | `manifest.ts`, install prompt | — | static | WORKING | `app/manifest.ts`, `InstallPrompt.tsx` |
| 4 | Live in 24 hours | WS/BOS | — | staff process | n/a | SERVICE | demo → go-live is manual |
| 5 | CRM & lead capture | WS/BOS | TeleCRM board; CRM (orphan) | `/crm/leads` → CampaignLead | Yes; web enquiry → CRM; one table for CRM+TeleCRM | WORKING | trace J8; prod: deebiphotography 5 leads |
| 6 | TeleCRM — call queue & follow-ups | WS/BOS | `/dashboard/telecrm` | `/crm/telecrm/*` → CampaignLead, CallLog | Yes | WORKING | trace J8 (`telecrmQueue`) |
| 7 | Website auto-bot reply | WS/BOS | Embed/Widget; stepnrock has its own scripted bot | `/widget/*` | Widget needs a working AI key; standalone sites do not embed it | PARTIAL | `embed/page.tsx`; AI trace |
| 8 | WhatsApp bot reply | BOS | WhatsApp Bot (KB editor) | `/whatsapp-bot/kb`, AI reply | KB persists; **no WhatsApp BSP credentials anywhere**; 0 conversations | PARTIAL (blocked on keys) | prod: no WA settings; `wa_conversations` 0 |
| 9 | Communication Hub — WhatsApp, SMS, email | WS/BOS | `/dashboard/communication` | `/communication/*` | SMS key present; email key present; WhatsApp mock without BSP | PARTIAL | prod settings flags |
| 10 | GST invoicing | WS/BOS | industry Billing tab | `/domainapp/invoices` → GenericInvoice | Persists with GST; **pay link uses platform Razorpay, never marked paid; number = count+1 (race)** | PARTIAL | trace J9; `invoices.service.ts:16,30,115-143`; `payments.service.ts:231` |
| 11 | Expense tracking with GST | WS/BOS | Accounts ▸ Expenses | `/accounting/expenses` → Expense | Yes; shows in P&L summary | WORKING | trace J10 |
| 12 | Accounting — P&L and **GSTR filing** | BOS | Accounts | `/accounting/summary`, `/gst-filings` | P&L works; GSTR is a **status tracker**, not a filing | PARTIAL → reword | trace J10; `upsertGstFiling` |
| 13 | HRM — staff, attendance, payroll | BOS | `/dashboard/hrm` | none | placeholder | **MISSING** | `hrm/page.tsx:1-31` |
| 14 | Inventory management | BOS (but Workspace shows it) | Retail ▸ Inventory; PartStock; ProduceStock | `/retail/products/*/restock` → RetailProduct | Only for RetailProduct vendors; website sales never touch it | PARTIAL | §5 |
| 15 | Task management & assigning | BOS | none (Technology industry has TechTasks) | `VendorTask` model, **no controller** | — | **MISSING** (outside Technology) | `schema.prisma` `VendorTask`; FEATURE_MATRIX row 65 |
| 16 | Team access with roles | WS/BOS | Team | `/team/*` → TeamMember | Yes: role/department/modules persist and list | WORKING | trace J11 |
| 17 | AI Studio — content, images, blog | WS/BOS | AI Studio | `/ai/generate-content` → Wallet | Code path complete; **provider call not verified live**; masked failures; see §6.2 | PARTIAL / unverified | AI trace |
| 18 | Social media management & **posting / scheduling** | WS/BOS | Growth Hub | `meta.service.ts` | **Mock**: fake id, status "published" | **BROKEN (misleading)** | `meta.service.ts:24-41`; no scheduler cron |
| 19 | 3 / 6 SEO keywords + meta optimization | WS/BOS | Website Manager ▸ SEO | `PUT /cms/vendor/:id` → seoTitle/Desc/Keywords | Saved and rendered **on platform-rendered sites only**; cap only for vendors with a billing term; "optimization" is manual typing | PARTIAL | trace J1/J6; stepnrock/deebi ignore |
| 20 | GEO & AEO | WS/BOS | none | none | Only a generic LocalBusiness JSON-LD on platform-rendered sites | **MISSING** | `app/site/.../page.tsx:158-165`; no vendor llms.txt/sitemap |
| 21 | Google Business Profile listing | WS/BOS | none | none | staff setup | SERVICE (no software) | no GBP code |
| 22 | Google Analytics & Search Console | WS/BOS | Website Manager ▸ SEO (GA ID box) | `googleAnalyticsId` | stored, **never injected** | PARTIAL / UI-only | FEATURE_MATRIX row 42; no `gtag` in app |
| 23 | Backlinks (20) & off-page SEO | WS/BOS | none | none | staff delivery, nothing tracked | SERVICE (no software) | — |
| 24 | Analytics & reporting | WS/BOS | Analytics Hub | `/analytics/usage`, CRM, wallet | Aggregates platform data; no website traffic | PARTIAL | `reports/page.tsx` |
| 25 | Free subdomain & hosting | WS/BOS | — | — | platform renderer, or a per-vendor app with its own nginx config | WORKING | 5 live vendors with subdomains; `nginx-*.conf` per app |
| 26 | Connect a custom domain | WS/BOS | Domain | `/domains/*` → DomainRegistration | DNS check only; serving needs manual nginx/SSL; **ResellerClub customer/contact/NS ids not configured** | PARTIAL | `domains.service.ts:162-163,200,264-310`; prod settings |
| 27 | Customer portal / client app | WS/BOS | `/customer` | `/customer/*` | OTP portal exists; per-industry depth varies | PARTIAL | FEATURE_MATRIX Part 3 |
| 28 | Online ordering / cart / payments on the vendor's site | (industry promise) | storefront | `engine.checkout.*` | Works only if the vendor saved Razorpay keys (**0/5 did**); no stock, no address | PARTIAL | §5 |

### 4.2 Totals
WORKING 6 · PARTIAL 15 · BROKEN 1 · MISSING 3 · SERVICE 3 (of 28 rows). Compare to the baseline's ≈15% fully working: the *core operating loop* (lead → CRM, expense, customer invoice record, team) works; the *commerce, website-control, SEO/GEO/AEO, social, HR/task* promises do not.

### 4.3 What changed since FEATURE_MATRIX (2026-10-02)

| Topic | 2026-10-02 (static) | Now (executed) |
|---|---|---|
| Stock after a sale | row 74: "race: negative stock" (retail) | **Confirmed −1**, and the same race exists in website checkout; VendorProduct stock is not touched at all |
| CatalogItem stock | row 69: "stock unsettable" | **Confirmed**: 0/120 rows; DTO rejects it |
| Social publish | row 4: MOCKED | Unchanged; also no scheduler cron |
| Settings page | MOCKED | Unchanged |
| HRM | MISSING | Now a placeholder page (by design, 2026-10-03) |
| Universal catalogue | planned | **Schema columns are live on `VendorProduct` but unread/unwritten by any code** — a half-applied cutover |
| Billing/pay | — | Commercial Engine added a full Billing page — **not linked from the menu** |
| GA ID | UI-ONLY | Unchanged |
| Web checkout | not in matrix | `engine.checkout` exists and is hardened (security patch), but disabled for every vendor |
| AI | PARTIAL | Unchanged; failure masking and no-fallback now evidenced |

## 5. Task 3 — Commerce deep-dive (priority 1)

### 5.1 Method
Isolated real-Postgres run of the actual services ([evidence/dashboard-audit/commerce-trace.js](evidence/dashboard-audit/commerce-trace.js), output in `commerce-trace.out.txt`): demo sandbox vendor → made "live" locally → product CRUD through `CmsService` (what *My Products* calls) → public site API → vendor Razorpay keys saved → `PublicCheckoutService` order + confirm with a stub Razorpay → catalogue and retail stock tests.

### 5.2 Results, step by step

| Step asked | Result | Root cause (file:line) |
|---|---|---|
| Create a product with category, price, stock, variants | Category + price + image + description work; **stock, SKU, status, reorder level and variants cannot be sent** — the API rejects them (`forbidNonWhitelisted`); only a free-form `customFields` blob is accepted | `cms/dto/create-product.dto.ts` (6 fields); `main.ts:32-38` |
| Same category typed twice | One category row reused | `cms.service.ts:181-193` |
| Edit | Reflected in `GET /cms/site/:sub` immediately | `cms.service.ts:212-229`, `:231-270` |
| Dashboard list ↔ public storefront | Same table (`VendorProduct`, active only); dashboard list uses `/cms/vendor/:id/products` | — |
| **Why the stepnrock site feels "not dynamic"** | (a) server pages revalidate every **60 s** (`revalidate: 60`), (b) client pages first paint the **hard-coded showcase catalogue** then swap, (c) with zero live products the site shows the showcase again, (d) stock/colours/sizes come from `customFields` or fixed defaults | `stepnrock/lib/site-data.ts:38,56,115`; `lib/use-products.ts:12-27`; `resolveProducts` |
| Mark out of stock | **No way.** `active=false` hides the product; `status="out_of_stock"` exists in the schema but nothing sets or reads it | schema `VendorProduct.status`; no backend reference |
| Place an order (public checkout) | Server prices from `VendorProduct.price` (a *string*; stepnrock's are `"89.99"`, `"119.99"`… i.e. currently ₹89.99-style prices) and creates a Razorpay order **only if the vendor saved Razorpay keys** | `public-checkout.service.ts:51-93,100-120`; prod: 0/5 vendors have keys |
| Stock auto-deducts? | **No for VendorProduct** (executed: stock 5 stays 5; 50 pcs accepted). Only `CatalogItem` lines with a non-null `stock` are decremented | `public-checkout.service.ts:84,89,164-170` |
| Atomic / never negative? | **No.** Check happens in `priceCart` *before* the transaction, decrement is unguarded. Executed: two orders of 2 against stock 3 → **−1** (CatalogItem) and **−1** (POS) | `public-checkout.service.ts:84,164-170`; `retail.service.ts:59-79` |
| Variants (size/colour) and address | Stepnrock's checkout form asks only **name + mobile**; the cart sends size/colour as a name suffix that the server strips (`baseProductName`), so variants are never stocked or recorded and no delivery address exists anywhere | `stepnrock/components/cart/CartView.tsx:66-74`; `checkout-pricing.ts` |
| Order appears in the dashboard | Yes in *Website Orders* (items, total, status) — **no buyer, no address, no status workflow, no detail page** | `orders/page.tsx`; `CheckoutOrderInput` has no address field (`engine.dto.ts:80-88`) |
| Cancel / failure restores stock | **No path exists** for web orders. POS refund restores stock (executed OK, +2). A sold-out race *after* payment capture rejects the order but keeps the money | `retail.service.ts:83-95`; `public-checkout.service.ts:130-131` |
| Low-stock alert | **None.** Retail summary returns a count; nothing notifies | `retail.service.ts:96-112` |

### 5.3 Which table each screen reads and writes

| Screen / surface | Reads | Writes |
|---|---|---|
| Dashboard ▸ My Products | `VendorProduct` | `VendorProduct`, `Category` |
| Public site API (`/cms/site/:sub`) and standalone storefronts | `VendorProduct` (+`VendorCMS`) | — |
| Public checkout (price) | `VendorProduct.price` **and** `CatalogItem.price/stock` | `PosSale` (web), `CatalogItem.stock`, CRM lead |
| Industry ▸ Catalog / Menu / Packages / Services | `CatalogItem` | `CatalogItem` (no stock field) |
| Retail ▸ Products / Inventory | `RetailProduct` | `RetailProduct` |
| Retail ▸ Orders (POS) | `RetailProduct` | `RetailProduct.stockQty`, `PosSale` (retail) |
| Website Orders | `PosSale` type "web" | — |
| Universal catalogue (`VendorProduct.stockQty/sku/status`) | nothing | nothing |

### 5.4 Stepnrock's 14 `VendorProduct` rows (read-only shape)
All 14 have name, description, price (string, e.g. `"89.99"`; one `"650"`), image URL and category (+ `categoryId`). 13 have `customFields` (`colors`, `sizes`, `gallery`, `stock`, `rating`, `reviews`, `brand`, `features`, `isNew`, `isBestSeller`, `originalPrice`, `stockQty`). 12 have the **column** `stockQty` (12–50); **0** have `sku`, `unit`, `reorderLevel`; 13 have `priceAmount`; status is "active" for all. 13 prices look like showcase (USD-style) values and one (₹650, "Rockman") is real — the storefront would charge ₹89.99 for an "Aero Flight Sneakers" if checkout were enabled.

## 6. Task 4 — Vendor journeys

Clicks are counted from the dashboard Overview on desktop (menu item, tab, field edit, save/confirm each count as one).

### 6.1 Journey table

| # | Journey | Clicks | Works? | Where it breaks | Evidence |
|---|---|---:|---|---|---|
| 1 | Change homepage text | 3 (Manage ▸ Website Manager ▸ Basic/About ▸ Save) | **Yes** for platform-rendered sites · **No effect** on standalone sites | stepnrock/deebi never read CMS text | trace J1; grep of both apps |
| 2 | Add a page | — | **Impossible** | pages exist only inside a theme definition | trace J2; `WebsiteTheme.pages` (0 of 2 themes use it) |
| 3 | Change theme (+ counter) | 3 | Works; counter enforced | counter is visible only on the orphaned Billing page; 2 themes; premium unlock charges the platform Razorpay | `cms.service.ts:117-148`; `my-website/page.tsx:57-90` |
| 4 | Connect a domain | 4–5 | DNS **check** only | no host routing/SSL automation in the app; registration needs ResellerClub customer/contact/NS ids that are not configured | `domains.service.ts:162-200,264-310`; no host logic in `middleware.ts` |
| 5 | Add a product or service | 3–4 | Yes (reflects on the site within 60 s) | no stock/SKU/variants; products added under the *industry* tab go to a different table | trace §2; §5.3 |
| 6 | SEO keywords, meta, GEO, AEO — and see results | 3 | Keywords/title/description **save**; **no GEO/AEO**; **no results view**; cap 3/6 applies only to vendors with a billing term; GA ID never injected | `cms.service.ts:91-98`; trace J6 |
| 7 | AI Studio: image, blog, caption + wallet debit | 3–4 | Code path complete, **provider unverified** (see 6.2) | 6.2 | AI trace |
| 8 | Capture a lead → CRM and TeleCRM | 0 for the vendor, 2 to view | **Yes**; the visitor does not become a "customer" | Customer Hub reads a different table | trace J8 |
| 9 | Send an invoice | ≈6 (industry Billing tab ▸ New ▸ contact ▸ lines ▸ Save ▸ Send) | Persists; "send" creates a payment link on the **platform** Razorpay; not auto-marked paid; numbering `count+1` can duplicate | `invoices.service.ts:16,30,115-143` | trace J9 |
| 10 | Record an expense | 4 | **Yes**, appears in list and P&L | — | trace J10 |
| 11 | Add a staff member with a role | 4 | **Yes** (invite persists; role is free text + modules) | email/WhatsApp invite stubbed in the test | trace J11 |

### 6.2 AI Studio — exact reasons it fails

Evidence order: what is **proven**, what is **inferred**, what **only the VM log** can show.

**Proven (executed or production data)**
1. *Provider selection has no fallback.* `generateText` uses the OpenAI key when one exists and otherwise Claude (`ai.service.ts:176-189`); when OpenAI fails the request ends in `ServiceUnavailableException('AI content generation is temporarily unavailable')` (`:196`, `:218`) — **Claude is never tried**. Executed with a stubbed invalid OpenAI key while a Claude key was available: only `api.openai.com` was called (no Claude attempt) and the user got the generic 503.
2. *Both keys exist in production settings* (`ai/openai_api_key`, `ai/anthropic_api_key`, set 2026-08-11) — so "keys not set" is **not** the cause; invalid, expired, rate-limited or uncredited keys are.
3. *The only local key is dead.* The local `CLAUDE_API_KEY` returns **HTTP 401 `invalid x-api-key`** from Anthropic (the single real call made).
4. *Errors are masked for the vendor.* The real provider status is only logged; the UI maps unknown errors to "Could not generate right now: AI content generation is temporarily unavailable" and only strings containing "not configured / api key / gateway / unauthor" produce the admin message (`ai-studio/page.tsx:289-292`).
5. *Empty-wallet ordering.* `generateContent` calls the provider first and debits afterwards (`ai.service.ts:395-411`); with ₹0 the provider cost is incurred and the vendor sees an insufficient-balance error. Executed: provider called once, then `INSUFFICIENT_WALLET_BALANCE`.
6. *Stepnrock is not wallet-blocked now:* wallet ₹250 (the nav item is never locked — `layout.tsx:164`).
7. *Images* are DALL-E links that expire (~1 h) and are not stored for AI Studio output (`ai.service.ts:290-325`), and use the same OpenAI key. *Reels* cannot render in the API container: `reels.service.ts:33` needs `remotion/render.mjs` + its `node_modules`, and the runner image never copies `remotion/` (`Dockerfile:16-19`). *Video* runs in **mock mode** (a Google sample clip) because no `video` provider key exists (`video.service.ts:10-12`, prod settings).

**Inferred:** the production symptom is a 4xx/5xx from OpenAI (key invalid or no billing credit), because OpenAI is preferred and masks the error.

**Needs the VM log (KSM runs):**
```bash
docker logs get4domain_backend --since 48h 2>&1 | grep -E "OpenAI text error|Anthropic API error|DALL-E error|AiService"
```
Look for the HTTP status after "error": `401` (bad key), `429`/`insufficient_quota` (no credit), `404` (model name), `400` (billing). That one line decides the fix.

### 6.3 Journey-specific note: standalone vendors
Journeys 1, 3 and 6 are **decorative** for stepnrock, deebiphotography and allwintours: the dashboard edits rows their sites do not read. This is the largest source of "partly broken" for exactly the vendors KSM talks to.

## 7. Task 9 — Prioritised backlog

Sizes: S ≤ 1 day · M 2–5 days · L 1–3 weeks. **KSM** = needs KSM's accounts, keys or a decision. IDs are mirrored in `TASKS.md` (V-xxx).

### Phase 0 — do now (hours)
| ID | Item | Size | Risk | Proof | KSM |
|---|---|---|---|---|---|
| V-001 | Put **Billing** in the menu and a "payment due" banner on Overview (stepnrock due 2026-10-10) | S | low | nav test: route registered; screenshot | — |
| V-002 | Stop shipping fake data: Notifications reads the real API; Settings saves for real or is hidden | S | low | Playwright/route test | — |
| V-003 | Reword/remove the 32 claims (23 REWORD + 9 REMOVE) in CLAIMS_VS_REALITY (REWORD/REMOVE) | S | low | claims-lint test | decision on wording |
| V-004 | Read the AI error line from the VM log (command in §6.2) | S | none | log line | KSM runs it; may need OpenAI/Anthropic keys or credit |

### Phase 1 — commerce core
| ID | Item | Size | Dep | Risk | Proof | KSM |
|---|---|---|---|---|---|---|
| V-010 | **One product store**: finish the Universal Catalogue cutover — *My Products* gains price (number), SKU, stock, reorder level, status, variants; POS, Inventory and Catalog tabs read `VendorProduct`; checkout reads only it | L | migration script exists | high (touches money paths) | extend `verify-checkout.js` + flows; E2E trace re-run | approve prod run of the data migration (live vendors: CatalogItem 0, RetailProduct 0 → safe) |
| V-011 | **Atomic stock service**: guarded `UPDATE … WHERE stock >= qty` in the sale transaction; reserve at order creation; `CHECK (stock >= 0)` | M | V-010 | medium | concurrency test (the −1 case becomes a 409) | — |
| V-012 | Out-of-stock end-to-end: auto status at 0, `inStock` in the public API, storefront badge/disabled button | S | V-010/011 | low | trace step "mark out of stock" | — |
| V-013 | Failure/cancel/refund restore stock; **auto-refund via vendor Razorpay** if a captured payment cannot become an order | M | V-011 | medium | test: sold-out-after-capture → refund created | — |
| V-014 | Checkout captures **shipping address**; order statuses (new/packed/shipped/delivered/cancelled); order detail page with buyer | M | — | low | flow test | — |
| V-015 | Low-stock alert (notification + Overview widget, `reorderLevel`) | S | V-010 | low | notification created test | — |
| V-016 | Vendor Razorpay onboarding in Payments (test-mode check; storefront cart enabled only when verified) | M | — | low | trace: `paymentsEnabled` flips | vendors' own keys |
| V-017 | Customer-invoice pay links on the **vendor's** keys + webhook marks `GenericInvoice` paid; sequence-based numbering | M | V-016 | medium | webhook test | confirm intended money flow |

### Phase 2 — navigation restructure + registry
| ID | Item | Size | Dep | Risk | Proof |
|---|---|---|---|---|---|
| V-020 | Feature registry + generators + CI guard ([FEATURE_REGISTRY_DESIGN.md](FEATURE_REGISTRY_DESIGN.md)) | M | — | low | the guard itself fails on seeded violations |
| V-021 | New nav (Home/Sell/Website/Grow/Money/Operate/Settings) behind a flag, then flip ([DASHBOARD_IA_PROPOSAL.md](DASHBOARD_IA_PROPOSAL.md)) | M | V-020 | medium | route-coverage test |
| V-022 | **Plan → modules/addons automation**: activation/renewal/override set modules from `planKey`; locked items become upgrade cards | M | KSM map | medium | flow test: new BOS vendor sees BOS modules | **KSM decision**: Workspace vs BOS module map |
| V-023 | Remove duplicates/orphans per the IA map; replace `ComingSoon` with availability/upgrade cards | S | V-021 | low | registry guard |

### Phase 3 — website manager + SEO/GEO/AEO home
| ID | Item | Size | Dep | Risk | Proof | KSM |
|---|---|---|---|---|---|---|
| V-030 | **Website hub** (Content · Pages · Products link · Theme · Domain · SEO) in one place | L | V-021 | medium | journey test 1–6 | — |
| V-031 | **Site-data contract for standalone apps**: shared `useSiteData` kit so stepnrock/deebi/allwin consume CMS text, contact, SEO, social | M | — | medium | stepnrock renders an edited tagline | — |
| V-032 | SEO/GEO/AEO: per-page meta, Product/FAQ/LocalBusiness JSON-LD, per-vendor sitemap/robots/llms.txt, GA injection, score | M | V-031 | low | crawler test on a sandbox site | — |
| V-033 | Add-a-page (simple section builder) for platform-rendered sites | L | V-030 | medium | journey 2 | — |
| V-034 | Domain: automate vhost/SSL, finish ResellerClub config | M | infra | medium | connect test | ResellerClub customer/contact/NS ids |

### Phase 4 — AI Studio
| ID | Item | Size | Risk | Proof | KSM |
|---|---|---|---|---|---|
| V-040 | Real error surfacing (admin log + vendor-safe message), **OpenAI→Claude fallback**, balance pre-check before the provider call | S | low | AI trace A/B/C flip to PASS | valid, funded keys |
| V-041 | Persist generated images to storage; server-side library (not `localStorage`) | M | low | image URL survives 24 h | Supabase storage config |
| V-042 | Reels rendering in the container (copy `remotion/` or a worker); video provider | M | medium | render test | video provider key |

### Phase 5 — connectors
| ID | Item | Size | KSM |
|---|---|---|---|
| V-050 | Social OAuth (Meta/Google/LinkedIn) + real publish + scheduler job | L | developer apps / app review |
| V-051 | WhatsApp BSP per vendor; website bot embed for standalone sites | M | BSP account |
| V-052 | Google Business / Analytics / Search Console connectors — or reword as a setup service | M | Google OAuth app |

### Phase 6 — BOS modules
| ID | Item | Size |
|---|---|---|
| V-060 | HRM: staff, attendance, payroll | L |
| V-061 | Task board UI + API on the existing `VendorTask` model | M |
| V-062 | Accounting depth: GSTR export, stock ledger | M |

### Hygiene (any time)
| ID | Item | Size |
|---|---|---|
| V-070 | Fix and schedule sandbox cleanup (delete wallet rows; daily cron); remove the 39 expired demos | S |

## 8. Evidence index

* [evidence/dashboard-audit/inv.js](evidence/dashboard-audit/inv.js) + `inventory.json` — route/import/endpoint scan.
* [evidence/dashboard-audit/commerce-trace.js](evidence/dashboard-audit/commerce-trace.js) + `commerce-trace.out.txt`.
* [evidence/dashboard-audit/journeys-trace.js](evidence/dashboard-audit/journeys-trace.js) + `journeys-trace.out.txt`.
* [evidence/dashboard-audit/ai-trace.js](evidence/dashboard-audit/ai-trace.js) + `ai-trace.out.txt`.
* [evidence/dashboard-audit/prod-readonly-queries.md](evidence/dashboard-audit/prod-readonly-queries.md) — every production query run, with results (counts/flags only).
