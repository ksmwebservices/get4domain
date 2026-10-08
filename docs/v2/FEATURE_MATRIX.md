# Master Feature Matrix (PRD §92.1)

> Part of the Get4Domain V2 audit baseline (2026-10-02, audit-only; no code changed by this work). Statuses use the PRD §64.2 vocabulary. **Static-verified only** — nothing here was executed against a running system. Source evidence: `evidence/*.md`. Summary and verdict: [AUDIT_REPORT.md](AUDIT_REPORT.md).

## Consolidated tally

Rows assessed across the five area matrices below (some capabilities appear in more than one area, e.g. payment verification, so totals slightly over-count distinct features):

| Status | BOS core | Growth/Social/AI | Client WebApp | Communication | Platform/Security | **Total** |
|---|---:|---:|---:|---:|---:|---:|
| WORKING | 10 | 7 | 16 | 8 | 15 | **56** |
| PARTIAL | 36 | 19 | 14 | 29 | 24 | **122** |
| UI-ONLY | 1 | 3 | 1 | 0 | 3 | **8** |
| BACKEND-ONLY | 1 | 2 | 0 | 2 | 0 | **5** |
| MOCKED | 2 | 4 | 0 | 2 | 4 | **12** |
| BROKEN | 7 | 2 | 2 | 7 | 7 | **25** |
| MISSING | 35 | 22 | 15 | 28 | 17 | **117** |
| BLOCKED-EXTERNAL | 1 | 4 | 2 | 7 | 3 | **17** |
| DEFERRED-APPROVED | 0 | 0 | 0 | 0 | 0 | **0** |
| **Rows** | 93 | 63 | 50 | 83 | 73 | **362** |

**About 15% of assessed rows are fully WORKING; about a third are PARTIAL; about a third are MISSING; 25 are BROKEN.** Column-level layers (Backend / DB / Permission / Tests) are given per row in each matrix; the Tests layer is "none" for every row because the repository contains zero automated tests.

The Communication and Platform areas are tabulated by numbered item rather than a single table — see `COMMUNICATION_MATRIX.md` and `INTEGRATIONS.md` / `PERMISSIONS.md`.

---

# PART 1 — BOS core (Business setup, roles, HR, CRM, tasks, products, inventory, POS, quotes, billing, GST, accounting, orders, audit, reports)

Columns: Area | Feature | Existing Route/Code | Status | Backend | DB | Permission | Tests | Notes. Tests = "none" for all rows (no test files exist).

| Area | Feature | Existing Route/Code | Status | Backend | DB | Permission | Tests | Notes |
|---|---|---|---|---|---|---|---|---|
| Business Setup | Business profile (name/contact/hours/social) | `cms/cms.controller.ts:57-66`; VendorCMS | PARTIAL | Yes | VendorCMS | owner/admin (+team 'website') | none | Marketing profile only |
| Business Setup | Legal name / GSTIN / PAN / tax / currency / TZ | - | MISSING | No | No | - | none | Only platform-company GSTIN in settings |
| Business Setup | Invoice prefix / numbering / FY | `domainapp/invoices.service.ts:28-31` | MISSING | hard-coded | - | - | none | Not configurable |
| Business Setup | Bank/UPI, T&C, signature, footer | - | MISSING | No | No | - | none | |
| Business Setup | Branches (+warehouse/POS/series) | - | MISSING | No | No | - | none | |
| Business Setup | Business Setup Wizard | - | MISSING | No | No | - | none | go-live is plan purchase |
| Business Setup | Account Settings page | `dashboard/settings/page.tsx:11-14` | MOCKED | No | No | - | none | setTimeout fake save, hard-coded "Muthukumar R" |
| Business Setup | Vendor Razorpay key config | `vendor-payments.controller.ts:18` | PARTIAL | Yes | VendorPaymentConfig (encrypted) | none (any member) | none | Team member can swap payout keys |
| Roles | Team invite/accept/login/remove | `team/*`, `auth.service.ts:148-190` | WORKING | Yes | TeamMember | owner-only on mutate | none | Invite send not try/caught |
| Roles | Module-level permission enforcement | `module.guard.ts`, `team-access.ts` | PARTIAL | 8 controllers only | TeamMember.modules | partial | none | Section 0/14 #7 |
| Roles | Configurable roles | `TeamMember.role` string | MISSING | No | free text | - | none | |
| Roles | Granular permissions (CRUD/approve/export...) | - | MISSING | No | No | - | none | |
| Roles | Departments | `dashboard/team/page.tsx:21-26` | PARTIAL | label only | TeamMember.department | - | none | 4 presets |
| Roles | Team list exposes hash/invite token | `team.service.ts:45` | BROKEN | Yes | TeamMember | any member | none | Data exposure |
| Roles | Platform staff roles | `admin.guard.ts` | PARTIAL | Yes | AdminTeamMember | SuperAdmin vs all-admin | none | MARKETING==OPERATIONS in API |
| HR | Employee master | - | MISSING | No | No | - | none | |
| HR | Attendance | gym `attendance` tab | UI-ONLY | No | No | - | none | ComingSoon stub |
| HR | Leave / payroll / payslip / shifts | - | MISSING | No | No | - | none | |
| CRM | Vendor lead CRUD + status + follow-up | `crm.controller.ts:17-63` | WORKING | Yes | CampaignLead | RequireModule telecrm | none | |
| CRM | Notes / activity timeline | `crm.service.ts:92` | PARTIAL | overwrite | CampaignLead.notes | telecrm | none | Only call logs retained |
| CRM | Call log + queue + follow-ups | `crm.service.ts:64-150`, TeleCrmBoard | WORKING | Yes | CallLog | telecrm | none | Browser timer duration |
| CRM | Click-to-call | `TeleCrmBoard.tsx:246` | PARTIAL | tel: link | - | - | none | No telephony |
| CRM | Lead assignment (field) | `crm.service.ts:93` | BACKEND-ONLY | Yes | assignedTo | telecrm | none | No UI |
| CRM | Round-robin / assignment rules | - | MISSING | No | No | - | none | |
| CRM | Score / tags / deal value | - | MISSING | No | No | - | none | |
| CRM | Pipeline per industry | `industry-experience.ts`, `crm/page.tsx:45` | PARTIAL | config static | free-text status | telecrm | none | Not editable; no validation |
| CRM | Lead -> customer conversion | - | MISSING | No | No | - | none | |
| CRM | CSV import / export | `crm.service.ts:51`, `crm/page.tsx:122` | PARTIAL | import yes / export client | CampaignLead | telecrm | none | No dedupe |
| CRM | CRM reporting | `reports/page.tsx`, TeleCRM | PARTIAL | Yes | derived | reports | none | |
| CRM | Platform lead TeleCRM (g4d_leads) | `admin-crm/*` | WORKING | Yes | Lead, LeadCallLog | AdminGuard | none | Platform scope |
| CRM | Public enquiry -> lead | `action-registry.ts:55-71` | PARTIAL | Yes | CampaignLead | public | none | No throttle/dedupe |
| Tasks | VendorTask engine | schema.prisma:1040 | MISSING | No code | model only | - | none | Orphan model |
| Tasks | Technology task board | `technology/*`, TasksView | PARTIAL | Yes | ProjectTask | none | none | 3 states, tech only |
| Tasks | Task automation (lead/quote/invoice triggers) | - | MISSING | No | No | - | none | |
| Product | Website products/services CRUD | `cms.service.ts:184-263` | WORKING | Yes | VendorProduct, Category | owner/admin | none | price is String |
| Product | DomainApp catalogue CRUD | `domainapp/catalog.*` | PARTIAL | Yes | CatalogItem | none | none | stock unsettable; no delete UI |
| Product | Retail products (SKU/price/stock) | `retail.service.ts:15-40` | PARTIAL | Yes | RetailProduct | none | none | hard delete |
| Product | Variants / HSN / GST rate / MRP / cost | - | MISSING | No | No | - | none | |
| Product | Barcode | - | MISSING | No | No | - | none | |
| Product | Bulk edit / CSV import-export | - | MISSING | No | No | - | none | |
| Inventory | Retail stock decrement | `retail.service.ts:49-80` | PARTIAL | Yes | RetailProduct | none | none | Race: negative stock |
| Inventory | Stock adjust | `retail.service.ts:37` | PARTIAL | Yes | RetailProduct | none | none | No reason/ledger |
| Inventory | Stock ledger / movements | - | MISSING | No | No | - | none | |
| Inventory | Warehouses / transfers | - | MISSING | No | No | - | none | |
| Inventory | Reorder alerts | `retail.service.ts:93` | PARTIAL | count only | RetailProduct | none | none | No notification |
| Inventory | Stationery tracker | `stationery/*` | WORKING | Yes | StationeryItem | none | none | Office list |
| Purchase | Supplier / PO / GRN / purchase invoice | - | MISSING | No | No | - | none | |
| POS | Retail POS sale | `retail.service.ts:49-80`, PosView | PARTIAL | Yes | PosSale | none | none | Tax client-supplied; no barcode/hold/split/print |
| POS | Refund/return | `retail.service.ts:84-96` | PARTIAL | full only | PosSale | none | none | Not atomic; no credit note |
| POS | POS -> accounting | `accounting.service.ts:106` | BROKEN | summary ignores PosSale | - | - | none | Revenue missing from P&L |
| POS | Restaurant tables/orders/kitchen/bill | `restaurant/*` | PARTIAL | Yes | RestaurantOrder(+Item), PosTable | none | none | Client price; no bill->sale |
| POS | KitchenTicket / Appointment models | schema.prisma:1077,1116 | MISSING | No code | orphan | - | none | |
| Quotes | Vendor quotation engine | - | MISSING | No | No | - | none | |
| Quotes | Admin proposal/quote (platform) | `quotes/*` | PARTIAL | Yes | Quote | AdminGuard | none | Not vendor-facing |
| Quotes | Versioning / quote->invoice | - | MISSING | No | No | - | none | |
| Billing | Vendor invoice create | `domainapp/invoices.service.ts:35-67` | PARTIAL | Yes | GenericInvoice | none | none | Deterministic totals; weak numbering |
| Billing | Invoice numbering safety | `invoices.service.ts:28-31` | BROKEN | race + global unique | invoiceNumber @unique | - | none | Collision/500 risk |
| Billing | CGST/SGST/IGST, place of supply, HSN | - | MISSING | No | No | - | none | |
| Billing | Vendor invoice PDF | `generic-invoice.template.ts` | PARTIAL | HTML | - | none | none | Unescaped; no GSTIN |
| Billing | Payment link | `invoices.service.ts:115-142` | BROKEN | platform keys; no webhook | razorpayLinkId | none | none | Never reconciles |
| Billing | Mark paid | `invoices.service.ts:144-150` | PARTIAL | Yes | GenericInvoice | none | none | Re-callable; no PaymentRecord |
| Billing | Partial payments / credit-debit notes / cancel | - | MISSING | No | No | - | none | |
| Billing | Recurring invoices | `travel/contracts.service.ts:137-190` | PARTIAL | cron, travel only | Contract | none | none | Idempotent |
| Billing | Overdue automation / reminders | - | MISSING | No | No | - | none | |
| Billing | Vendor invoice email/WhatsApp | - | MISSING | No | - | - | none | |
| Billing | Platform subscription invoice | `invoices/*` | PARTIAL | Yes | Invoice | AdminGuard / owner | none | Number race; swallow-all errors |
| Billing | Platform payment verify | `payments.service.ts:79-98` | BROKEN | Yes | Invoice | any user | none | IDOR + no amount check |
| Billing | Go-live plan purchase | `demo.service.ts:64-135` | BROKEN | Yes | Subscription | sandbox | none | Amount not verified |
| Billing | Public web checkout | `public-checkout.service.ts` | BROKEN | Yes | PosSale | public | none | Client price, replay |
| GST | Filing-status tracker | `accounting.service.ts` upsert; accounts GST tab | WORKING | Yes | GstFiling | accounts | none | Manual status |
| GST | GST summary (out/in) | `accounting.service.ts:106-130` | PARTIAL | Yes | derived | accounts | none | Excludes POS/ITC rules |
| GST | GSTR-1/3B/2B generation, ITC, e-invoice | - | MISSING | No | No | - | none | |
| Accounting | Expenses | `accounting.service.ts:37-101` | PARTIAL | Yes | Expense | accounts | none | No edit; hard delete |
| Accounting | Payments ledger | `accounting.service.ts:~170-190` | PARTIAL | Yes | PaymentRecord | accounts | none | Unlinked; hard delete |
| Accounting | P&L (vendor) | `accounting.service.ts:106-130` | PARTIAL | Yes | derived | accounts | none | Cash basis |
| Accounting | Receivables aging / payables | `summary.service.ts` | PARTIAL | totals only | derived | none | none | |
| Accounting | Ledgers / double-entry / TB / BS | - | MISSING | No | No | - | none | |
| Accounting | Admin accounting expenses | `admin/accounting/page.tsx:29-76` | MOCKED | No | localStorage | - | none | Not persisted server-side |
| Accounting | Travel accounts summary | `accounting.service.ts` travelSummary | WORKING | Yes | Trip, PaymentRecord | accounts | none | |
| Orders | Per-industry operation modules (22) | section 12 | PARTIAL | Yes | per-industry | none (not team-guarded) | none | No state machine/conflicts |
| Orders | Generic Record bookings/orders | `domainapp/records.*` | PARTIAL | Yes | Record | none | none | Free-text status |
| Orders | Unified Case/Job engine | - | MISSING | No | No | - | none | |
| Orders | Website orders list | `dashboard/orders/page.tsx` | PARTIAL | Yes | PosSale type web | none | none | Read-only |
| Audit | Audit log / soft delete / locking | - | MISSING | No | No | - | none | |
| Reports | Vendor Analytics Hub | `dashboard/reports/page.tsx` | PARTIAL | Yes | derived | reports | none | limit=100 truncation |
| Reports | Role dashboards (owner/sales/ops/finance/HR/inventory) | - | MISSING | No | No | - | none | |
| Reports | Per-industry summaries | `*/summary` + accounts overview | WORKING | Yes | derived | accounts (page) | none | |
| Documents | Letterhead/visiting/ID card | `business-documents/*` | WORKING | Yes | stateless | none | none | |
| Documents | Quotation/receipt/PO/DN/payslip | - | MISSING | No | No | - | none | |
| Import/Export | Customers/products/invoices/stock CSV | - | MISSING | No | No | - | none | |
| Customer portal | OTP login + records/invoices/catalog | `customer/*` | PARTIAL | Yes | Contact etc. | public | none | Section 14 #8 |
| Customer portal | Invite (WhatsApp+SMS) | `customer.service.ts:~205` | BLOCKED-EXTERNAL | mock until Fast2SMS key | portalAccess | none | none | UI alerts "mock" |
| Entitlements | Server-side plan/BOS gating | - | MISSING | No | No | - | none | Client-only gating |

---

# PART 2 — Growth / Social / Marketing / Content / AI (includes Domain Campaign)

> Domain Campaign row(s): fee logic updated post-audit to PRD §88 brackets — see STATUS.md.

## 9. MASTER FEATURE MATRIX

Columns: Area | Feature | Existing route/code | Status | Backend | DB | Permission | Tests | Notes
(Tests = **None** for every row: no `*.spec.*`/`*.test.*` files in either app and no `test` script in `backend-api/package.json` scripts (`:5-17`) or `get4domain_mvp/package.json`. Confirmed.)

| # | Area | Feature | Existing route/code | Status | Backend | DB | Permission | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Growth | Growth Overview (scores, visitors, orders, revenue, recs) | none | MISSING | none | none | - | None | Analytics Hub is the nearest (row 33) |
| 2 | Growth | "Growth Hub" nav entry | `dashboard/layout.tsx:120` -> /dashboard/campaigns | PARTIAL | campaign-pages | CampaignPage | frontend module flag only | None | Is Campaign Pages, not the PRD Growth nav (Growth Overview/SEO/Studio/Social/Offers/Loyalty/Referral/Search Insights/Share Links/Sales Channels/Growth Analytics = 11 items; none built except Campaigns) |
| 3 | Social | Connected Accounts (OAuth FB/IG/YT/LI/GBP) | none | MISSING | none | none | - | None | PRD §20 |
| 4 | Social | Publish to FB/IG | `POST /growth-hub/publish` | MOCKED | `meta/meta.service.ts:28-42` | none | any logged-in | None | no FE caller; fake id/URL; `status:'published'` if token set |
| 5 | Social | Publication history / external id / retry | none | MISSING | none | none | - | None | |
| 6 | Social | Content calendar / scheduling | none (localStorage reminder `campaigns/page.tsx:303`) | MISSING | none | none | - | None | marketing claims "Scheduling" |
| 7 | Social | LinkedIn / YouTube / GBP / X publishing | none | MISSING | none | none | - | None | |
| 8 | Ads | Ad request (`POST /growth-hub/ads`) | `growth-hub.service.ts:21-37` | BACKEND-ONLY | yes | Campaign | RequireModule (team only) | None | no UI |
| 9 | Ads | Admin launch ad (Google/Meta) | `POST /growth-hub/ads/:id/launch` | MOCKED | `google-ads.service.ts` stub | Campaign.status=active | AdminGuard | None | sets active with fake `mock_gads_` id |
| 10 | Campaigns | Legacy create/approve (wallet debit) | `campaigns/*` | BACKEND-ONLY | debits wallet, no execution | Campaign | RequireModule | None | vendor self-approves; nothing delivered |
| 11 | Campaigns | Campaign Pages create/edit/list/delete | `campaign-pages/*`, FE campaigns+landing-page | WORKING (static-verified) | yes | CampaignPage | owner check | None | |
| 12 | Campaigns | Public /go/:slug + lead -> CRM | `go.controller.ts`, `app/go/[slug]` | WORKING (static-verified) | yes | CampaignLead (=CRM leads) | public | None | no rate limit/CAPTCHA |
| 13 | Campaigns | WhatsApp lead alert to vendor | `campaign-pages.service.ts:139-152` | PARTIAL | MSG91 template via env only | WalletTransaction | - | None | Rs1 charged before send; false return ignored |
| 14 | Campaigns | Free-1 page limit + Rs20 extra page charge | none | MISSING | none | none | - | None | price key is display-only |
| 15 | Campaigns | Page analytics (views/leads/conv) | `GET /campaign-pages/:id/analytics` | PARTIAL | real counts | CampaignPage.views | owner | None | naive view counter; no UTM/source |
| 16 | Campaigns | QR / share | `landing-page/page.tsx:218` | PARTIAL | none | none | - | None | third-party qrserver.com image; untracked |
| 17 | Content | AI text generation (8 types) | `POST /ai/generate-content` | PARTIAL | OpenAI/Anthropic real | WalletTransaction | any auth; internal free | None | needs key; no vendor-master context; blog/reel_script = 500-token caption JSON |
| 18 | Content | AI image (poster/ad/social) | `ai.service.ts:264-299` | PARTIAL | DALL-E 3 real | none | - | None | temp URL (1h), not stored; Stability not wired |
| 19 | Content | AI site hero -> Supabase -> cms.banner | `ai.service.ts:312-349`, `vendors.service.ts:90` | BLOCKED-EXTERNAL | OpenAI + Supabase REST | Cms.banner | system | None | needs creds |
| 20 | Content | AI library (saved content) | `ai-studio/page.tsx:296-300` | UI-ONLY (browser localStorage) | none | none | - | None | lost on device change; text only |
| 21 | Content | Landing-page copy generation | `/ai/generate-page`, `/campaign-pages/generate` | PARTIAL | real LLM | none | any auth | None | unmetered (no wallet) |
| 22 | Content | Public AI chat (marketing/dashboard) | `POST /ai/chat` @Public | PARTIAL | real LLM | none | **public** | None | unmetered; no rate limit |
| 23 | Studio | Fabric design editor (poster/card) | `design/*`, `FabricEditor.tsx` | PARTIAL | static 2 templates | AiTemplate (admin) | auth | None | client-side PNG/PDF; no save in vendor mode |
| 24 | Studio | Social creative size presets (IG story, FB cover, LinkedIn, YT thumb, WA status, GBP) | none | MISSING | none | none | - | None | only 1080x1080 poster + card built in |
| 25 | Studio | Business docs: letterhead/visiting card/ID card | `business-documents/*` | PARTIAL | stateless HTML | none | auth | None | print-to-PDF; vendor retypes; 3 of ~16 |
| 26 | Studio | Invoice/quotation/receipt/PO/delivery note/etc. via Studio | invoices/quotes modules (outside area) | PARTIAL | separate modules | various | - | None | not part of Studio doc engine |
| 27 | Studio | Payslip, certificate, appointment/thank-you/membership card, agreement | none | MISSING | none | none | - | None | |
| 28 | Studio | Document engine (variables, numbering, versions, history, audit) | none | MISSING | none | none | - | None | PRD §84 |
| 29 | Studio | Data-aware generation from Business Master | none | MISSING | none | none | - | None | PRD §19 |
| 30 | Studio | Template library CRUD (prompt/design/document) | `ai-templates/*`, FE admin/library | WORKING (static-verified) | yes | AiTemplate | AdminGuard | None | reel/canva rows have no consumer |
| 31 | Studio | Canva integration | none | MISSING | none | `canvaTemplateId` col only | - | None | |
| 32 | Reels | AI video (no key) | `video.service.ts:53-57,80-81` | MOCKED | stock Google sample MP4 | none | auth | None | looks like a real result |
| 33 | Reels | AI video Runway / HeyGen | `video.service.ts:94-160` | BLOCKED-EXTERNAL | real fetch, unverified | none | auth | None | text-only Runway likely rejected; HeyGen default ids |
| 34 | Reels | AI video Kling | `video.service.ts:36-42,66,84` | BROKEN | routes to HeyGen | none | - | None | |
| 35 | Reels | Photo Reel (Remotion) | `reels/*`, `remotion/` | BLOCKED-EXTERNAL | child-process render | none (disk file) | auth | None | node_modules/FFmpeg/Chrome + licence; ephemeral disk |
| 36 | Reels | "Coming Soon" honest labelling | `ai-studio/page.tsx:438-439`, marketing pages | BROKEN vs PRD | - | - | - | None | PRD §18/§39 require Coming Soon |
| 37 | SEO | SEO Manager (score/issues/fix) | none | MISSING | none | none | - | None | |
| 38 | SEO | Manual meta title/desc/keywords/OG | `my-website`, `app/site/.../page.tsx:92-104` | PARTIAL | cms | Cms.seo* | vendor | None | works; no suggestions |
| 39 | SEO | JSON-LD on vendor sites | `app/site/.../page.tsx:159-168` | PARTIAL | n/a | Cms | - | None | generic branch only |
| 40 | SEO | Sitemap/robots (platform) | `app/sitemap.ts`, `app/robots.ts` | WORKING (static-verified) | n/a | none | - | None | marketing+demo only |
| 41 | SEO | Sitemap/robots (vendor sites) | none | MISSING | - | - | - | None | |
| 42 | SEO | Google Analytics ID | `my-website/page.tsx:357` | UI-ONLY | stored only | Cms.googleAnalyticsId | vendor | None | never injected |
| 43 | SEO | Search Console / GBP / GA integrations | none | MISSING | none | none | - | None | |
| 44 | Insights | Search Insights | none | MISSING | none | none | - | None | |
| 45 | Links | Share Links UTM/QR tracking | none | MISSING | none | none | - | None | |
| 46 | Analytics | Analytics Hub (reports page) | `dashboard/reports/page.tsx`, `analytics/*` | PARTIAL | real DB aggregates | Lead/Invoice/Wallet/etc | RequireModule('reports') | None | no visitors/orders/channels; campaigns card reads legacy model |
| 47 | Offers | Coupons / cashback / flash deals | none | MISSING | none | none | - | None | |
| 48 | Offers | Loyalty / referral / affiliate / promoter | none | MISSING | none | none | - | None | |
| 49 | Channels | Sales channels, Google Shopping, Meta/WA catalogue, marketplace framework | none | MISSING | none | none | - | None | |
| 50 | Channels | Shipping/delivery connectors | none | MISSING | none | none | - | None | |
| 51 | Widget | Embed chat + lead widget | `widget/*`, `dashboard/embed/page.tsx` | WORKING (static-verified) | yes | Vendor.widgetKey, CampaignLead | public key | None | chat unmetered; no rate limit; sandbox vendors blocked |
| 52 | Platform | Module/addon toggles (growth_hub, ai_studio…) | `addons/*` | PARTIAL | CRUD only | VendorModule/VendorAddon | admin | None | **no backend route reads these flags** (grep: only addons/ reads them); gating is FE nav only |
| 53 | Platform | Supabase storage service | `storage/storage.service.ts` | BLOCKED-EXTERNAL | real REST | none | - | None | used only for AI hero; user uploads go to local disk |
| 54 | Platform | Image uploads | `uploads/uploads.controller.ts` | PARTIAL | local disk | none | auth | None | no tenant scoping/record; SVG allowed |
| 55 | Platform | Admin integration "Test" button | `platform-settings.service.ts:105-117` | MOCKED | only checks a value exists | PlatformSetting | admin | None | returns "ok" for any non-empty string |
| 56 | Admin | Admin campaigns tool (ideas + post log) | `app/admin/campaigns/page.tsx` | PARTIAL | ideas via /ai/chat real | none | admin | None | post log is React state only (`:66-69`), lost on refresh |
| 57 | Domain Campaign | Public enquiry -> Lead + admin notify | `domain-campaign/*` | WORKING (static-verified) | yes | Lead | public | None | caller-supplied vendorId |
| 58 | Domain Campaign | Client onboarding (Subscription) | `service.ts:90-98` | WORKING (static-verified) | yes | Subscription | AdminGuard | None | nominal amount Rs9,999 |
| 59 | Domain Campaign | Spend record + fee calc + invoice | `service.ts:112-181` | PARTIAL | raw SQL | g4d_domain_campaign_records | AdminGuard | None | migration pending on VM; duplicate invoice risk; **fee logic != PRD §88** |
| 60 | Domain Campaign | Live Meta/Google ad management/reporting | none | MISSING | none | none | - | None | manual spend only |
| 61 | Customer Hub | Portal on/off toggle | `customer-hub/page.tsx:17,61` | UI-ONLY | none | none | - | None | local React state; does not disable anything |
| 62 | Customer Hub | Portal invite | `customer-hub/page.tsx:34-45` | PARTIAL | backend returns `mock` flag | Contact | - | None | alert says "mock — gateway pending" |
| 63 | Pricing | "We post on your page" Rs10 | `pricing/page.tsx:52,78` | MISSING | none | key only | - | None | priced service with no implementation |


---

# PART 3 — Client WebApp engine

## 9. MASTER FEATURE MATRIX — CLIENT WEBAPP

| ID | Feature | Route / code | Status | Notes |
|---|---|---|---|---|
| F01 | Live vendor site by subdomain (path form) | app/site/[subdomain]/[[...rest]]; GET /cms/site/:subdomain | WORKING | Sandbox vendors 404; force-dynamic; static-verified |
| F02 | Host-based subdomain routing (sub.get4domain.com) | middleware.ts (matcher /demo only) | MISSING | Infra doc says not implemented |
| F03 | Wildcard DNS + TLS + nginx for *.get4domain.com | nginx-get4domain.conf (HTTP :80 block only) | BLOCKED-EXTERNAL | Needs KSM infra |
| F04 | Domain search + register (ResellerClub) with wallet debit/refund | backend domains module; dashboard/domain-management | BLOCKED-EXTERNAL | Code real; creds + live test missing |
| F05 | Connect external domain + DNS verify | domains.service verifyMapping | PARTIAL | Real DNS lookup; status only |
| F06 | Custom domain serving + SSL | none | MISSING | No Host lookup anywhere |
| F07 | Engine registry renders 20 industries (live/demo/preview) | engine/registry.ts | WORKING | Static-verified |
| F08 | Live sites show only vendor data (no fabricated fallback) | kit builders, real-estate model | BROKEN | R3 |
| F09 | Real Estate bespoke site | engine/industries/real-estate | PARTIAL | Seed props fallback; token payment broken |
| F10 | Retail bespoke grid / PDP / category chips | engine/industries/retail | WORKING | UI; no search/sort/URLs |
| F11 | engine.enquiry -> CRM lead + notification | action-registry.ts | WORKING | No rate-limit/CAPTCHA |
| F12 | Public appointment/booking/quote (18 kit industries) | KitEnquiry.tsx | PARTIAL | Lead with text only |
| F13 | RE site-visit booking -> PropertyVisit | realestate.site_visit | WORKING | + vendor notification |
| F14 | RE booking-token payment | realestate.payment_cta | BROKEN | R2 |
| F15 | Cart/checkout self-hide unless live+paymentsEnabled | KitRenderer/RetailSite/EngineCart | WORKING | Verified |
| F16 | Retail cart -> Razorpay (vendor keys) -> PosSale 'web' | CartDrawer + public-checkout.service | PARTIAL | D1-D5 |
| F17 | Kit cart ('cards' variant only) | EngineCart.tsx | PARTIAL | In-memory cart; display-string pricing |
| F18 | Restaurant menu -> cart -> order type -> payment | kit 'menu' variant, enquiry tab | UI-ONLY | No cart on menu; lead only |
| F19 | Order lifecycle, fulfilment, tracking, buyer order history | none | MISSING | PosSale.status always completed |
| F20 | Enable commerce on business site (63D) | VendorPaymentConfig.enabled | PARTIAL | Cart pill only; no Shop nav/pages |
| F21 | Three distinct modes: Business / E-commerce / Restaurant (63A/B/F/G) | engine | PARTIAL | Distinct looks; restaurant flow not real |
| F22 | Customer OTP login | customer.service | PARTIAL | R4 |
| F23 | Customer portal records/catalogue/invoices/contact | /customer | PARTIAL | Generic Record only; read-only |
| F24 | Customer portal enquiry action | customer/actions/engine.enquiry | WORKING | Lead only |
| F25 | Customer pays invoice/order online in portal | none | MISSING | UI text says future work |
| F26 | Customer wallet / loyalty / offers / referrals | none | MISSING | Only marketing copy |
| F27 | Customer notifications / push | none | MISSING | Push subs are vendor-only |
| F28 | Platform PWA (manifest, SW, offline page, install, push) | manifest.ts, public/sw.js | WORKING | Platform brand only |
| F29 | Per-vendor branded installable PWA | none | MISSING | |
| F30 | Per-industry public bottom nav | EngineBottomNav + builders | WORKING | Anchor scroll-spy, 20 industries |
| F31 | Per-industry vendor mobile nav / module list from registry | industry-experience vendorMobileNav/vendorModules | MISSING | Config with no consumer |
| F32 | CMS fields, logo/banner upload, products, categories | my-website; /cms/* | WORKING | Static-verified |
| F33 | CMS pages/sections/menus/blog/forms builder | none | MISSING | |
| F34 | Theme marketplace (list, unlock w/ Razorpay+GST invoice, apply gate, admin CRUD) | website-themes, cms.service | PARTIAL | R5 |
| F35 | Raw-HTML multi-page theme in isolated iframe | raw-theme-frame, raw-html-site | WORKING | Static; admin-trusted JS |
| F36 | Per-site title/description/OG | generateMetadata | WORKING | |
| F37 | JSON-LD on vendor sites | classic fallback only | PARTIAL | Missing on engine sites |
| F38 | Per-vendor sitemap / robots / canonical | none | MISSING | |
| F39 | Google Analytics injection | googleAnalyticsId stored only | MISSING | |
| F40 | AEO/GEO for client sites (llms.txt, FAQ/Product schema) | none | MISSING | |
| F41 | Demo OTP gate (server middleware) | middleware.ts | WORKING | Signed cookie, category-scoped |
| F42 | Demo content library (30 categories / 76 subs) | data/demo-site.ts etc. | WORKING | Static TS |
| F43 | Demo operational data depth (PRD 51) | demo.service seedVendor | PARTIAL | Generic tables only |
| F44 | Demo vs production separation | isSandbox, cms.service | WORKING | |
| F45 | Operation Registry (17 ops) | config/operations.ts + OperationType | PARTIAL | Labels; DB unused |
| F46 | IndustryExperience registry (20) | config/industry-experience.ts + table | PARTIAL | Only crmPipeline/primaryOp consumed |
| F47 | IndustryConfig (terminology, statuses, fields, tabs, portal shape) | backend config/industries | WORKING | |
| F48 | Server-side industry/addon/module enforcement | none | MISSING | |
| F49 | Automated tests (unit/integration/e2e) | none found | MISSING | |
| F50 | Scheduled automation/reminders (appointments, renewals, follow-ups) | only travel contract @Cron | MISSING | |

Counts: WORKING 16, PARTIAL 14, UI-ONLY 1, BROKEN 2, MISSING 15, BLOCKED-EXTERNAL 2.

---------------------------------------------------------------------

## Update 2026-10-09 (Release 1A)

The dashboard's feature list now lives in `registry/features.ts` (55 features, each with a status and evidence); this table is the 2026-10-02 baseline and is not regenerated. Where they differ, the registry wins. Changes of status since the baseline:

| Feature | Was | Now |
|---|---|---|
| AI Studio reels and video | mock / not renderable | Coming soon; endpoints answer "coming soon" and never debit the wallet |
| CRM board lead list | listed nothing (`source=undefined`) | working (fixed 2026-10-09) |
| Lead to customer | missing | one click, one customer per phone per vendor |
| Plan names in the dashboard | Workspace / BOS | Essentials / Pro (internal keys unchanged) |
| Half-year plan, manual QR payment, GST not charged | open to any deal | only through an active special arrangement |
| Reports, Campaigns, Quotes, Collect payments, HR, Connections | shown as stubs | Coming soon in the menu (UNTESTED / NOT_BUILT) |
