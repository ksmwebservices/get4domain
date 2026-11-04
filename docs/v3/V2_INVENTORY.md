# Get4Domain Version 2 inventory and parity audit (STAGE 02, Run 0)

Read-only audit. Branch `v3-inv`, worktree `C:\Get4Domain\get4domain-inv`, based on `v3-b2` (3f9b169). Only `docs/v3` changed. No code, no migrations, no seeds, no production access, no `.env` reading, no network calls. Everything below comes from the repository at that commit.

**How to read the evidence.** The repository cannot say what is used live. Where this document says "core path", the platform cannot run without the module. "Named in deploy/status docs" means a V2 runbook, status or handover file mentions it. "Code only" means nothing outside the code mentions a deployment. Real usage is settled by `docs/v3/OWNER_READONLY_QUERIES.sql` (section 9 has the row counts); the owner runs it, not Claude.

## 0. Owner rules this run touches (frozen 4 November 2026)

This run changes no behaviour, so no rule is implemented here. These rules decide the verdicts in INV-7:

| Rule | What it means for the audit |
|---|---|
| 1 | Subdomain mandatory; custom domain Pro only; one canonical host. Decides the verdict for `domains`, `site-domains`, `domainapp` host logic. |
| 2 | Free sites are informational listings with no call to action; Pro locked in preview. Decides what happens to enquiry capture, `widget`, `campaign-pages`, `engine` actions on Free. |
| 3 | Tiers Handyman, Professional, Ecommerce, each Free and Pro; terms quarterly, half-yearly, annual only; prices from the approved price book. Decides `commercial`, `subscriptions`, BillingTerm. |
| 4 | Bridge model; we never hold customer payments. Decides `payments`, `vendor-payments`, `engine` checkout. |
| 5 | Directory has no forms or lead delivery. Decides `leadspace`, `leads`. |
| 6 | Never hide or delete a site for expiry or suspension. Decides the V2 expiry and suspension behaviour (`Vendor.expiresAt`, `siteStatus`). |
| 7 | Self-service free; team work is paid on request; the wallet is V3's own, no refunds, one-year validity. Decides the legacy `wallet` module: it is not reused (D1). |
| 9 | Messaging consent, opt-in, unsubscribe, block list, Do-not-contact register. Decides `communication`, `messaging`, `whatsapp`, `sms`, `crm` import. |
| 10 | Bots answer from stored details, never advise, offer hand-over, never take payment. Decides `whatsapp-bot`, `ai`. |
| 12 | Tax from tables; IGST versus CGST plus SGST by state. Decides `bos/gst.ts` and `commercial/pricing-math.ts`. |
| 13 | No timeframes; the words Workspace, BOS, LeadSpace never appear in generated product text. Decides `registry`, `leadspace`, plan names in copy. |

## INV-1. Module map

### 1.1 Size of the codebase

| Part | Files | Lines | Routes | Tests |
|---|---|---|---|---|
| backend-api `src` (92 module folders, non-spec) | 736 | 53,942 | 904 route decorators | 106 files in `test/` (29 are `.int.spec.ts` staging suites) plus script suites `scripts/bos`, `scripts/commercial-verify`, `scripts/security-verify` |
| get4domain_mvp `src` | 432 | 57,986 (ts, tsx, css) | 109 `page.tsx` | none (no runner; SEO-0 plans Vitest) |
| Prisma schema | 194 models, 58 enums | | | 62 migration folders |

The test column below counts spec files under `backend-api/test` that import the module. A zero for a legacy module does not mean untested: BOS, commercial, LeadSpace and the industry modules are covered by the script suites (`npm run bos:verify`, `commercial-verify`, `security-verify`), which run against an in-memory or PGlite database and are not in Jest.

### 1.2 Backend modules (all 92 folders in `backend-api/src`)

Columns: module, what it does, tables it touches through Prisma (the first six), gating, repo evidence, and size as files/lines/routes/test specs.

"Gating" means: `area X` = `@RequireModule('X')` menu-area gate (team-member area flags); `staff` = AdminGuard; `owner-only parts` = VendorOwnerGuard on some routes; `tenant guard` = the V3 tenant guard; `login only` = any signed-in principal. Plan gating (Workspace versus BOS) is not in the controllers: it lives in `registry/` capabilities and in `BillingGateService`.

| Module | What it does | Tables touched | Gating | Repo evidence | Size f/l/r/t |
|---|---|---|---|---|---|
| account-security | Password reset by emailed token, password change, refresh tokens, session cut-off (S13) | AccountPasswordReset, AdminTeamMember, AuthRefreshToken, TeamMember, Vendor | public routes | core path | 9/622/6/2 |
| accounting | Simple vendor books: expenses, payments in and out, GST filing records, travel summary | Expense, GenericInvoice, GstFiling, PaymentRecord, Trip, Vendor | area accounts | named in deploy/status docs | 6/423/11/0 |
| addons | Add-on and module switches per vendor (grant and revoke); the list of sellable modules | Vendor, VendorAddon, VendorModule | staff | named in deploy/status docs | 6/263/8/1 |
| admin-crm | Staff TeleCRM over website demo-booking leads (g4d_leads) with call log | Lead, LeadCallLog | staff | code only, no deploy mention | 5/216/4/0 |
| admin-team | Staff accounts, roles (adminRole) and invites for the Get4Domain team | AdminTeamMember | staff, public routes | core path | 6/221/6/0 |
| agriculture | Industry module: produce orders and stock | ProduceOrder, ProduceStock | login only | code only, no deploy mention | 4/182/9/0 |
| ai | Text generation with a provider chain (fallback across accounts), used by AI Studio, bot and summaries | - | public routes | code only, no deploy mention | 10/814/6/8 |
| ai-studio | V3 AI Studio: provider settings, credits, prompts, usage, concurrency-safe credit reservation | V3AiCreditGrant, V3AiPrompt, V3AiProvider, V3AiUsage, V3PlanSetting | area website, staff, tenant guard | V3 staging only | 19/869/11/6 |
| ai-templates | Admin-managed AI prompt templates | AiTemplate | staff | code only, no deploy mention | 4/180/5/0 |
| analytics | Read-only dashboard numbers (calls, leads, invoices, wallet) for the reports area | CallLog, CampaignLead, CampaignPage, GenericInvoice, Message, Vendor +2 | area reports, staff | named in deploy/status docs | 3/135/3/0 |
| auth | Login for vendors, team members and staff; JWT; guards | AdminTeamMember, TeamMember, Vendor, VendorAddon | staff, public routes | core path | 10/716/4/7 |
| automobile | Industry module: service jobs, job lines, part stock | JobLine, PartStock, ServiceJob | login only | code only, no deploy mention | 4/210/13/0 |
| bos | Business Operating System: numbered invoices, quotes, credit notes, counter billing, parties, payments and allocations, purchases, stock ledger, double-entry books, GST/HSN reports, CA pack, recurring invoices, public pay page | BillingTerm, BosAccount, BosAllocation, BosDocSeries, BosDocument, BosDocumentLine +17 | area accounts/website, public routes | code only, no deploy mention | 18/3325/78/0 |
| business-documents | Business document templates and rendering | - | login only | code only, no deploy mention | 5/263/2/0 |
| campaign-pages | Per-vendor landing pages (LeadSpace/old Campaigns) with lead capture and /go/ public route | CampaignLead, CampaignPage | public routes | code only, no deploy mention | 8/412/10/1 |
| campaigns | Vendor campaign records (draft, approve, wallet cost) | Campaign | area campaigns, staff | named in deploy/status docs | 4/197/6/1 |
| clinic | Industry module: doctors and appointments | ClinicAppointment, Doctor | login only | named in deploy/status docs | 4/188/9/0 |
| cms | Vendor site content (VendorCMS): business details, pages, banners, SEO, hours, social links, publish | BillingTerm, Category, PlatformCMS, Subscription, Vendor, VendorAddon +5 | area website, staff, public routes | core path | 7/896/16/1 |
| coaching | Industry module: batches, enrolments, sessions | CoachingBatch, CoachingEnrollment, CoachingSession | login only | code only, no deploy mention | 4/232/13/0 |
| commercial | Commercial Engine: billing terms (annual/half-yearly), deals, special arrangements, invoices, Razorpay/UPI/manual pay, promo codes, plan-change requests, renewals, platform income | BillingDeal, BillingTerm, CommercialAuditLog, Invoice, ManualPaymentSubmission, PayeeSettings +9 | owner-only parts, public routes | core path | 25/3749/53/2 |
| common | Shared guards (ModuleGuard, VendorOwnerGuard, TenantGuard), filters, KeyedQueue, advisory lock, utilities | Contact | owner-only parts, tenant guard, public routes | core path | 22/882/0/32 |
| communication | Unified send (email, WhatsApp, SMS) with per-message wallet debit, message log per contact | Contact, Message | area communication | named in deploy/status docs | 4/226/3/0 |
| config | Environment/config loading and validation | - | n/a | core path | 23/1114/0/0 |
| construction | Industry module: projects, milestones, materials | ConstructionProject, ProjectMaterial, ProjectMilestone | login only | code only, no deploy mention | 4/229/13/0 |
| crm | Vendor CRM and TeleCRM: leads (g4d_campaign_leads), call log, queue, follow-ups, CSV import, convert to contact | CallLog, CampaignLead, Contact | area telecrm | core path | 6/371/10/0 |
| customer | Customer portal (end customers of a vendor): view records and invoices | CatalogItem, Contact, GenericInvoice, Record, Vendor, VendorCMS | public routes | named in deploy/status docs | 3/337/9/0 |
| demo | Demo-catalogue visits, demo booking leads, OTP-gated demo, sample data | CatalogItem, Contact, GenericInvoice, Lead, Record, Subscription +2 | staff, public routes | core path | 5/921/6/0 |
| design | Design vocabulary endpoint for the site editor | - | login only | named in deploy/status docs | 4/130/1/0 |
| diagnostics | Industry module: test orders and items | TestOrder, TestOrderItem | login only | named in deploy/status docs | 4/188/9/0 |
| directory | V3 directory: categories, locations, businesses, claim by OTP, removal, placements, public search | V3AccountSetupGrant, V3DirectoryBusiness, V3DirectoryBusinessMedia, V3DirectoryBusinessService, V3DirectoryCategory, V3DirectoryClaimOverride +6 | staff, owner-only parts, tenant guard, public routes | V3 staging only | 29/1697/29/10 |
| domain-campaign | Old DomainCampaign product (fee brackets, invoices) now folded into LeadSpace | Lead, Subscription | staff, public routes | named in deploy/status docs | 7/403/9/0 |
| domainapp | "Domain App" vendor tabs: catalogue items, contacts, records, invoices, per-industry tab views | CatalogItem, Contact, GenericInvoice, Record | login only | core path | 17/1123/23/0 |
| domains | Legacy domain search/registration/connect with ResellerClub client and DNS mapping check | DomainRegistration, Vendor | staff, owner-only parts | stub / thin | 9/742/10/0 |
| education | Industry module: batches, student enrolments | Batch, StudentEnrollment | login only | code only, no deploy mention | 4/162/9/0 |
| email | Resend email: welcome, reset, invoice, receipts, invites, generic | - | n/a | core path | 2/246/0/3 |
| engine | Industry Website Engine public Action Registry: enquiry, booking, checkout dispatch (vendor resolved from subdomain) | CatalogItem, PosSale, VendorCMS, VendorPaymentConfig, VendorProduct | area website, public routes | core path | 8/1101/7/0 |
| events | Industry module: event bookings and vendor assignments | EventBooking, EventVendorAssignment | login only | code only, no deploy mention | 4/184/10/0 |
| finance | Industry module: finance cases and documents | FinanceCase, FinanceCaseDocument | login only | named in deploy/status docs | 4/201/10/0 |
| google-ads | Google Ads connector placeholder (mock) | - | n/a | stub / thin | 2/53/0/0 |
| growth-hub | Growth hub suggestions and campaign shortcuts (mock-first) | Campaign | area campaigns, staff | stub / thin | 4/179/4/0 |
| gym | Industry module: classes and memberships | GymClass, Membership | login only | code only, no deploy mention | 4/152/9/0 |
| health | Liveness and readiness endpoints | - | public routes | V3 staging only | 2/73/2/1 |
| hotel | Industry module: rooms and room bookings | Room, RoomBooking | login only | code only, no deploy mention | 4/161/9/0 |
| industries | Industry list and per-industry configuration read | Vendor | staff, public routes | named in deploy/status docs | 4/159/5/0 |
| invoices | Platform invoices to vendors: create, PDF, email, payment link, mark paid | Invoice, PlatformIncome | staff | core path | 5/537/8/4 |
| leads | Marketing website lead capture (g4d_leads), status updates | Lead | staff, public routes | core path | 7/357/5/1 |
| leadspace | LeadSpace: free vendor page, OTP-verified enquiries, prepaid lead wallet (purse), pricing rules, disputes, refunds, promotion/social posts, abuse reports, daily stats | AdSpendEntry, BillingTerm, Campaign, CampaignLead, CampaignPage, CommercialAuditLog +25 | area campaigns/wallet/website, owner-only parts, public routes | named in deploy/status docs | 29/3896/93/1 |
| logistics | Industry module: shipments | Shipment | login only | code only, no deploy mention | 4/133/5/0 |
| managed-services | Catalogue and requests for done-for-you services sold by the team | Lead, ManagedServiceCatalogItem | staff, public routes | named in deploy/status docs | 5/210/5/0 |
| messaging | WhatsApp gateway: Cloud API and sandbox providers, templates, send log, webhook | WhatsappMessageLog, WhatsappTemplate | public routes | named in deploy/status docs | 6/312/2/0 |
| meta | Meta (Facebook/Instagram) connector placeholder | - | n/a | stub / thin | 2/56/0/0 |
| notifications | In-app notifications and web-push subscriptions | Notification, PushSubscription | staff | core path | 8/402/5/2 |
| otp | Daily OTP verification for demo and public flows (SMS) | OtpDailyVerification | public routes | core path | 4/196/2/0 |
| payments | Razorpay create-order, verify and webhook for platform invoices and wallet top-up | Invoice, PlatformIncome, Subscription, WalletTransaction | owner-only parts, public routes | core path | 8/754/3/1 |
| photography | Industry module: shoots and deliverables | PhotoShoot, ShootDeliverable | login only | named in deploy/status docs | 4/211/10/0 |
| plan-billing | V3 plan purchase: price book orders, Razorpay (test), webhook confirm, invoices, renewal reminders, settlement | V3DiscountRule, V3PaymentEvent, V3Plan, V3PlanInvoice, V3PlanOrder, V3PlanPrice +5 | staff, owner-only parts, tenant guard, public routes | V3 staging only | 20/1065/9/7 |
| plans | V3 plans, tracks, features, prices, discount rules, entitlements and overrides, audit | V3AuditLog, V3DiscountRule, V3EntitlementOverride, V3Feature, V3Plan, V3PlanFeature +7 | staff, owner-only parts, tenant guard, public routes | V3 staging only | 31/2276/38/38 |
| platform-settings | Encrypted platform settings and integration keys (Admin > Integrations), pricing settings | PlatformSetting | public routes | core path | 7/525/5/0 |
| prisma | Prisma client service | - | n/a | core path | 2/24/0/16 |
| professional | Industry module: engagements and documents | Engagement, EngagementDocument | login only | code only, no deploy mention | 4/242/10/0 |
| provisioning | V3 provisioning engine: invites, jobs and steps, claim tokens, bulk free sites | CategoryPack, V3ClaimToken, V3Invite, V3PlanSetting, V3ProvisioningJob, V3ProvisioningStep +2 | staff, public routes | V3 staging only | 37/2005/12/16 |
| quotes | Platform quotes to prospective vendors (admin) with public accept page | Quote, Vendor | staff, public routes | named in deploy/status docs | 8/514/9/0 |
| realestate | Industry module: listings, deals, property visits | Deal, Listing, PropertyVisit | login only | code only, no deploy mention | 4/191/13/0 |
| reels | Reel generation endpoints (coming soon, no debit) | - | login only | stub / thin | 5/212/2/0 |
| registry | Dashboard feature registry: plan access, menu gating, admin Plan access overrides | BillingTerm, Campaign, CampaignLead, CommercialAuditLog, Invoice, PosSale +6 | login only | core path | 7/1680/6/0 |
| restaurant | Industry module: tables, orders, order items, kitchen counts | PosTable, RestaurantOrder, RestaurantOrderItem | login only | named in deploy/status docs | 4/297/15/0 |
| retail | Industry module: retail products and POS sales | PosSale, RetailProduct | login only | named in deploy/status docs | 4/197/9/0 |
| salon | Industry module: stylists, chairs, appointments | SalonAppointment, SalonChair, Stylist | login only | code only, no deploy mention | 4/202/13/0 |
| site-doc | Website Manager: draft/publish site document, versions, category packs, themes per vendor, starter provisioning, media | BillingTerm, CategoryPack, MediaAsset, SiteVersion, ThemePackage, Vendor +3 | area website, owner-only parts | core path | 22/2197/23/3 |
| site-domains | V3 domains: subdomain rules, custom domain mapping, verification, redirects, host directory | V3Domain, V3DomainVerification, V3PlanSetting, V3Redirect, Vendor | staff, owner-only parts, tenant guard | V3 staging only | 17/1062/14/6 |
| site-publish | V3 renderer/publish: snapshots, publication pages, SEO, site settings, public site read, claim tokens | V3ClaimToken, V3SiteEvent, V3SitePublication, V3SitePublicationPage, V3SiteSettings, Vendor +2 | area website, staff, owner-only parts, tenant guard, public routes | V3 staging only | 28/1665/15/10 |
| sms | Fast2SMS sender (mock until key set) | - | n/a | core path | 2/132/0/0 |
| social | Social accounts and posts (admin), publisher with caps (sandbox until Meta approval) | SocialAccount, SocialPost | login only | named in deploy/status docs | 6/474/7/0 |
| stationery | Industry module: stationery items | StationeryItem | login only | code only, no deploy mention | 4/64/4/0 |
| stock | Stock movements and product stock for vendor products | StockMovement, VendorProduct | area website | code only, no deploy mention | 5/456/3/1 |
| storage | Supabase/local file storage adapter | - | n/a | core path | 2/125/0/0 |
| subscriptions | Legacy subscriptions (Product x Plan) admin | Subscription | staff | core path | 4/149/5/1 |
| support | Support tickets and replies | Lead, SupportTicket | staff, public routes | core path | 6/264/6/1 |
| team | Vendor team members with area flags and invites | TeamMember, Vendor | owner-only parts, public routes | core path | 7/299/6/0 |
| technology | Industry module: tech projects and tasks | ProjectTask, TechProject | login only | named in deploy/status docs | 4/185/9/0 |
| themes | Theme packages: upload, entitlement, purchase, expiry, sample (HTML themes stored in the database) | CategoryPack, ThemeAsset, ThemeEntitlement, ThemePackage, Vendor | public routes | core path | 14/1381/10/0 |
| travel | Industry module: trips, drivers, vehicles, contracts, visas (MR Travels pattern) | Contact, Contract, ContractAssignment, Driver, Trip, Vehicle +1 | login only | named in deploy/status docs | 10/788/21/0 |
| uploads | Image/media upload with content checks and quota | BillingTerm, MediaAsset | login only | core path | 5/229/1/0 |
| vendor-comms | Per-vendor messaging identity: email from name, reply-to, SMS name, WhatsApp number | Vendor, VendorCommsSettings | area communication, staff | code only, no deploy mention | 5/391/4/0 |
| vendor-payments | Vendor’s own Razorpay/UPI keys (encrypted) for collecting from their customers | VendorPaymentConfig | area accounts, owner-only parts | code only, no deploy mention | 4/186/3/0 |
| vendors | Vendor accounts admin: list, create, update, suspend, CMS seed | Vendor, VendorCMS | staff | core path | 5/271/7/0 |
| video | Video generation endpoints (provider chain, coming soon) | - | login only | stub / thin | 4/247/3/0 |
| wallet | Legacy vendor wallet: balance, top-up (Razorpay), hardened debits, transactions, admin deduct | PlatformSetting, Wallet, WalletTransaction | area wallet, staff, owner-only parts | core path | 7/562/5/4 |
| website-themes | Legacy website theme catalogue and per-vendor unlock/purchase | Vendor, VendorTemplateUnlock, WebsiteTheme | area website, staff, owner-only parts, public routes | code only, no deploy mention | 4/326/9/1 |
| whatsapp | Fast2SMS-based WhatsApp sender (mock until configured) | - | n/a | core path | 2/128/0/0 |
| whatsapp-bot | Vendor WhatsApp/web assistant answering from knowledge base entries | CampaignLead, Contact, KnowledgeBaseEntry, Message, Vendor, VendorCMS +2 | public routes | code only, no deploy mention | 6/543/5/0 |
| widget | Embeddable enquiry widget with per-vendor key | CampaignLead, Vendor | public routes | named in deploy/status docs | 4/177/5/0 |

### 1.3 Controller groups (route prefixes)

| Group | Prefixes | Routes |
|---|---|---|
| Vendor identity and access | `auth`, `team`, `vendors`, `addons`, `modules`, `admin-team`, `registry plan-access` | about 45 |
| Vendor site and content | `cms`, `site-doc/me`, `admin/category-packs`, `themes`, `website-themes`, `uploads`, `engine`, `widget`, `go` | about 95 |
| Money (legacy) | `commercial` (53), `admin/commerce`, `invoices`, `payments`, `wallet`, `subscriptions`, `vendor-payments`, `accounting` | about 110 |
| Business Operating System | `bos`, `bos/purchases`, `bos/stock`, `bos/books`, `public/bos`, `admin/bos` | 78 |
| CRM and enquiries | `crm`, `admin/crm`, `leads`, `quotes`, `customer`, `domainapp/contacts` | about 45 |
| Messaging | `communication`, `vendor-comms`, `messaging/whatsapp`, `whatsapp-bot`, `campaigns`, `admin/social` | about 25 |
| LeadSpace | `leadspace`, `leadspace/public`, `admin/leadspace`, `campaign-pages` | 93 plus 10 |
| Industry modules (21) | one prefix each: `travel`, `restaurant`, `retail`, `salon`, `clinic`, `hotel`, `realestate`, ... | about 215 |
| V3 | `v3/admin/*`, `v3/me/*`, `v3/public/*`, `v3/directory`, `v3/claim` | about 120 |

### 1.4 Prisma model groups (194 models)

| Group | Count | Models (table names carry the `g4d_` prefix except the oldest) |
|---|---|---|
| V3 | 42 | Plan, PlanPrice, Feature, PlanFeature, TaxRate, DiscountRule, PlanSetting, PlanSubscription, SubscriptionEvent, EntitlementOverride, AuditLog, VendorFlag, ProvisioningJob/Step, ClaimToken, Invite, SiteSettings, SitePublication(+Page), SiteEvent, Domain, DomainVerification, Redirect, Directory* (7), OtpChallenge, AccountSetupGrant, PlanOrder, PaymentEvent, PlanInvoice, InvoiceCounter, ReminderLog, Ai* (4) |
| Core vendor and access | 12 | Vendor, TeamMember, AdminTeamMember, AccountPasswordReset, AuthRefreshToken, VendorAddon, VendorModule, PlanOverride, PlatformSetting, OtpDailyVerification, Notification, PushSubscription |
| Site and content | 12 | VendorCMS, SiteVersion, MediaAsset, CategoryPack, ThemePackage, ThemeAsset, ThemeEntitlement, WebsiteTheme, VendorTemplateUnlock, PlatformCMS, Category, DomainRegistration |
| Legacy billing and wallet | 15 | Subscription, Invoice, PlatformIncome, BillingTerm, BillingDeal, ManualPaymentSubmission, PromoCode, PromoRedemption, PlanChangeRequest, CommercialAuditLog, SpecialArrangement, PayeeSettings, Wallet, WalletTransaction, DomainCampaignRecord |
| Accounts | 17 | GenericInvoice, Expense, PaymentRecord, GstFiling, StockMovement and the 12 `Bos*` models (Settings, DocSeries, Document, DocumentLine, Payment, Allocation, Expense, Account, JournalEntry, JournalLine, StockLocation, Recurring) |
| CRM and support | 10 | Contact, Lead, LeadCallLog, CampaignLead, CallLog, Message, Quote, SupportTicket, VendorTask, Appointment |
| Catalogue and commerce | 8 | VendorProduct, CatalogItem, Record, PosTable, PosSale, RetailProduct, StationeryItem, KitchenTicket |
| Messaging and promotion | 12 | WhatsappConversation, WhatsappTemplate, WhatsappMessageLog, VendorCommsSettings, KnowledgeBaseEntry, SocialAccount, SocialPost, PostJob, PromotionPlan, AdSpendEntry, Campaign, CampaignPage |
| LeadSpace | 15 | LeadspaceProfile, LeadEvent, LeadPriceRule, LeadPurse, LeadPurseEntry, ConsentRecord, InvalidLeadCredit, LeadDispute, LeadOtp, LeadBlockedPhone, LeadRefillPack, LeadRefundRequest, LeadspaceSetting, LeadspaceAbuseReport, LeadspaceDailyStat |
| Industry modules | about 51 | Vehicle, Driver, Trip, VisaApplication, Contract(+Assignment), Stylist, SalonChair, SalonAppointment, GymClass, Membership, Room, RoomBooking, Listing, Deal, PropertyVisit, Batch, StudentEnrollment, Engagement(+Document), ConstructionProject, ProjectMilestone, ProjectMaterial, EventBooking, EventVendorAssignment, FinanceCase(+Document), ServiceJob, JobLine, PartStock, Shipment, TestOrder(+Item), PhotoShoot, ShootDeliverable, ProduceOrder, ProduceStock, Coaching*(3), TechProject, ProjectTask, Doctor, ClinicAppointment, RestaurantOrder(+Item), and the registry tables OperationType, IndustryExperience |
| Admin content | 4 | ManagedServiceCatalogItem, AiTemplate, VendorPaymentConfig, plus PlatformCMS counted above |

Models with no service code touching them: VendorTask, KitchenTicket, Appointment, OperationType, IndustryExperience (config tables read as data), and V3InvoiceCounter (reserved for a later slice).

### 1.5 UI page groups (`get4domain_mvp/src`, 432 files, 109 pages)

| Group | Pages / files | What it is | Gating |
|---|---|---|---|
| Marketing site `app/(marketing)` | 22 pages, 2,664 lines | home, about, features, pricing, how-it-works, industries (2), portfolio, templates, support, contact, quote, book-demo, talk-to-sales, leadspace, managed-services, domain-app, legal (terms, privacy, refund), cart, checkout | public |
| Vendor dashboard `app/dashboard` | 35 pages, 7,956 lines | accounts (877), my-website (1,274 over 4 files), ai-studio, billing, crm, telecrm, customer-hub, communication, wallet, my-products, my-services, orders, stock, reports, team, domain-management, website-engine, whatsapp-bot, support, settings, notifications, embed, go-live, hrm, stationery, `[dept]` hub | JWT; sidebar from the registry (plan and area flags); `dashboard-v2` shell behind the per-vendor `nav_v2` switch |
| Admin dashboard `app/admin` | 35 pages, 6,100 lines | vendors and customers, leads, telecrm, invoices, commerce (8 pages), accounting, plans, pricing, renewals, library, managed-services, send-quote, support, team, themes, category-packs, cms, domains, api-settings, vendor-access, utilization | staff login; staff roles (`adminRole`) |
| Sign-in `login`, `register`, `admin-team` (invite accept), `offline` | 4 pages | | public |
| Customer portal `app/customer` | 1 page (561) | end-customer view of a vendor's records | customer token |
| Vendor public sites `app/site/[subdomain]`, `app/engine`, `app/go`, `app/d`, `app/pay`, `app/order-success` | 6 pages | the rendered vendor website (several render paths), campaign page, public invoice and payment, order success | public |
| LeadSpace `app/ls`, `leadspace/`, `leadspace-admin/` | 1 page + 18 files | public capture page, vendor and admin consoles | public / vendor / staff |
| Demo `app/demo`, `app/visit-demo`, `app/theme-*` | 5 pages | OTP-gated demo catalogue, theme preview and tests | OTP cookie |
| Shared libraries | `components` 77 files, `domainapp` 56 files (per-industry tab views), `engine` 65 files (industry website engine), `bos` 15 files, `data` 8 files (4,291 lines), `lib` 24 files | | |
| Other sibling apps | `allwin-tours`, `deebiphotography`, `indianambulance`, `stepnrock`, `ksm-quantum` (own Next.js apps, one VM container each) | client sites and the parent company site | their own |

## INV-2. TeleCRM and CRM in detail

**Shape of the data.** There are three separate lists that people call "CRM":

| List | Table | Written by | Read by |
|---|---|---|---|
| Vendor call list and pipeline ("leads") | `g4d_campaign_leads` (CampaignLead) + `g4d_call_logs` | `crm` (manual, CSV import), `engine` actions (website enquiry), `widget`, `campaign-pages`, `whatsapp-bot`, LeadSpace capture | `/dashboard/crm` and `/dashboard/telecrm` |
| Customer / party list ("contacts") | `g4d_contacts` (Contact) | `domainapp/contacts`, `crm` convert, `bos` (new party), `demo`, `whatsapp-bot`, `communication` | Accounts, BOS, invoices, messaging, customer portal |
| Get4Domain's own sales leads | `g4d_leads` + `g4d_lead_call_logs` | marketing site (book-demo, talk-to-sales), `demo` visits | `/admin/telecrm`, `/admin/leads` |

`CampaignLead` is not linked by a unique key to `Contact`: `convertToCustomer` looks up `Contact` by (vendorId, phone) with `findFirst` and writes the contact id into the lead's `customFields` and `contactId`. `Contact` has **no unique index on (vendorId, phone)**, no consent field, no opt-in record, no unsubscribe flag. The only consent table (`g4d_consent_records`) belongs to LeadSpace and holds a phone hash, text version and purpose.

**TeleCRM telephony.** There is no dialer or telephony integration. "Dialer" in `TeleCrmBoard.tsx` means `window.open('tel:' + phone)` (line 246), then a feedback sheet when the vendor returns to the tab. No Exotel, Twilio, Knowlarity, click-to-call, recording or call-event webhook exists anywhere in `backend-api/src` or `get4domain_mvp/src` (searched).

### 2.1 Feature list

Status: **working** = code path complete and exercised by tests or the script suites; **partial** = works with a stated gap; **stub** = placeholder or mock; **absent** = nothing in the repo.

| Feature | Status | What exists | Proof |
|---|---|---|---|
| Call queue | working | Leads with status `new` first, then those whose follow-up is due; oldest first | `crm/crm.service.ts` `telecrmQueue` (line 144); `GET crm/telecrm/queue` |
| Follow-ups | working | `followUpDate` on the lead; a call log can set it; upcoming list; the board groups Overdue, Today, Upcoming | `crm.service.ts` `telecrmFollowups`; `TeleCrmBoard.tsx` `dayBucket`, `followUpIso` |
| Reminders | partial | The follow-up is a date only; nothing sends a reminder to the caller (no cron, no push for follow-ups) | no `@Cron` in `crm/`; `notifications` has no follow-up trigger |
| Call records | working | Outcome, duration, notes, AI summary text, next follow-up; sets the lead status from the outcome (won, lost, else contacted) | `crm.service.ts` `logCall`; `CallLog` model |
| Call outcomes | working | Interested, Not interested, Callback, Won, No answer, mapped to stages | `TeleCrmBoard.tsx` `OUTCOMES` (line 70) |
| Pipeline stages | partial | Six fixed stages: new, contacted, interested, quoted, won, lost; Kanban with drag and drop. Stages are hard-coded in the UI; the backend accepts any status string | `TeleCrmBoard.tsx` `PIPELINE` (line 61); `UpdateCrmLeadDto` |
| Scripts (call scripts) | absent | No script or template field for callers | searched `crm/`, `TeleCrmBoard.tsx` |
| Dictation / AI summary | partial | Browser speech recognition fills the notes; `aiSummary` is stored when the client sends it. No server-side AI call is made for the summary | `TeleCrmBoard.tsx` (lines 252-259); `LogCallDto.aiSummary` |
| Team performance | absent | No per-caller counts, talk time or conversion report; `assignedTo` exists but only on the lead | `crm.service.ts` has no aggregate; `analytics` module counts calls in total only |
| Callers and roles | partial | `assignedTo` string per lead; `calledBy` per call log (the principal id). Team members reach TeleCRM through the `telecrm` area flag. There is no caller role, no queue per caller and no manager view | `crm.controller.ts` `@RequireModule('telecrm')`; `team/team-access.ts` |
| Import | working | Paste `name,phone` lines; creates call-list leads with source `import`; skips blank rows; **does not de-duplicate** and grants no messaging consent | `crm.service.ts` `importLeads` (line 49); `TeleCrmBoard.tsx` (line 317) |
| Export | partial | Browser-side CSV of the loaded lead list; no server export, no export of call logs | `app/dashboard/crm/page.tsx` `exportCsv` (line 138) |
| Tags | partial | `Contact.tags` JSON exists and is saved through `domainapp/contacts`; no tag filter or tag UI in the lead list; `CampaignLead` has no tags | `domainapp/contacts.service.ts` (lines 29, 81) |
| Segments | absent | No saved filters or lists | searched |
| Tasks | stub | `VendorTask` model exists and no service touches it | `schema.prisma`; no references in `src` |
| Enquiry capture | working | Public website enquiry creates a lead (`engine.enquiry`), plus `widget`, `campaign-pages`, WhatsApp bot, LeadSpace OTP capture, real-estate and other per-industry intents. Each also notifies the vendor | `engine/action-registry.ts` (line 59); `widget.service.ts` (line 36); `campaign-pages.service.ts` (line 117); `whatsapp-bot.service.ts` (line 196) |
| Source tracking | partial | `source` is a free string (`manual`, `import`, `website_enquiry`, ...). No UTM columns, no referrer, no landing page, no campaign link for site enquiries. UTM exists only inside LeadSpace promotion and reports | `CampaignLead` model; `leadspace/promotion.service.ts` |
| Convert lead to customer | working | One click; idempotent by (vendor, phone); marks the lead won | `crm.service.ts` `convertToCustomer` (line 103) |
| Lead detail with call history | working | Lead plus call logs, newest first | `crm.service.ts` `findOne` (line 79) |
| Recent calls | working | Last 15 calls across all leads | `crm.service.ts` `recentCalls` (line 66) |
| Per-industry contact fields | working | `customFields` JSON, form fields from the industry config | `telecrm/page.tsx` (lines 24-30) |
| Admin TeleCRM for Get4Domain's own leads | working | Same board over `g4d_leads`; call log, status, notes, follow-up. No create, import or convert-to-vendor action | `admin-crm/admin-crm.controller.ts` (4 routes); `app/admin/telecrm/page.tsx` |
| Dialer / telephony | absent | `tel:` link only | see above |
| Call recording / call events | absent | none | searched |
| Duplicate detection | absent | none on import, create or capture; the only check is convert-to-customer | `crm.service.ts` |
| Consent and opt-in on contacts | absent | none on `Contact` or `CampaignLead` | `schema.prisma` |
| Do-not-contact / block list | partial | `g4d_lead_blocked_phones` exists for LeadSpace only | `schema.prisma` `LeadBlockedPhone` |
| Tenant isolation | working | Every query filters by `vendorId`; `findOne` checks the owner; covered by the route-classification and the cross-tenant suites | `crm.service.ts`; `test/route-classification.spec.ts`, `test/tenant-isolation.int.spec.ts` |

### 2.2 What the Contact table lacks for V3

`g4d_contacts` has: id, vendorId, name, phone, email, type (default `customer`; also supplier and others), address, portalAccess, customFields, tags, notes, gstin, state, shippingAddress, openingBalancePaise. It lacks: phone normalisation, a unique key, consent and opt-in with source and time, unsubscribe and block state, language, a link to the V3 vendor site, soft delete. See INV-7 for the adapter decision.

