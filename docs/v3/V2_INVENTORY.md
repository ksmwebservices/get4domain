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
| business-documents | Printable business documents: letterhead, visiting card, ID card templates rendered to HTML | - | login only | code only, no deploy mention | 5/263/2/0 |
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
| customer | Customer portal: end-customer OTP login (mock OTP outside production), session profile, vendor-sent portal invites (mock) | CatalogItem, Contact, GenericInvoice, Record, Vendor, VendorCMS | public routes | named in deploy/status docs | 3/337/9/0 |
| demo | Demo-catalogue visits, demo booking leads, OTP-gated demo, sample data | CatalogItem, Contact, GenericInvoice, Lead, Record, Subscription +2 | staff, public routes | core path | 5/921/6/0 |
| design | Built-in sample Fabric.js design templates (scene JSON with prefill fields) for the poster/design editor | - | login only | named in deploy/status docs | 4/130/1/0 |
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
| growth-hub | Publish approved content to Facebook/Instagram and submit paid-ad requests, through MOCK Meta and ads layers | Campaign | area campaigns, staff | stub / thin | 4/179/4/0 |
| gym | Industry module: classes and memberships | GymClass, Membership | login only | code only, no deploy mention | 4/152/9/0 |
| health | Liveness and readiness endpoints | - | public routes | V3 staging only | 2/73/2/1 |
| hotel | Industry module: rooms and room bookings | Room, RoomBooking | login only | code only, no deploy mention | 4/161/9/0 |
| industries | Industry list and per-industry configuration read | Vendor | staff, public routes | named in deploy/status docs | 4/159/5/0 |
| invoices | Platform invoices to vendors: create, PDF, email, payment link, mark paid | Invoice, PlatformIncome | staff | core path | 5/537/8/4 |
| leads | Marketing website lead capture (g4d_leads), status updates | Lead | staff, public routes | core path | 7/357/5/1 |
| leadspace | LeadSpace: free vendor page, OTP-verified enquiries, prepaid lead wallet (purse), pricing rules, disputes, refunds, promotion/social posts, abuse reports, daily stats | AdSpendEntry, BillingTerm, Campaign, CampaignLead, CampaignPage, CommercialAuditLog +25 | area campaigns/wallet/website, owner-only parts, public routes | named in deploy/status docs | 29/3896/93/1 |
| logistics | Industry module: shipments | Shipment | login only | code only, no deploy mention | 4/133/5/0 |
| managed-services | Public "Get a Custom Quote" enquiry for managed services, plus the admin catalogue of service lines and default rates | Lead, ManagedServiceCatalogItem | staff, public routes | named in deploy/status docs | 5/210/5/0 |
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
| widget | Embeddable widget with per-vendor key: public config, lead submit into the CRM pipeline, chat to the Claude assistant | CampaignLead, Vendor | public routes | named in deploy/status docs | 4/177/5/0 |

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

## INV-3. Accounts, billing and wallet

There are **four separate invoice engines** in V2, plus the V3 one. They share no number series, no tax table and no tables.

| # | Engine | Who bills whom | Tables | Numbering | Tax | Module |
|---|---|---|---|---|---|---|
| 1 | Platform invoices (original) | Get4Domain to vendor | `Invoice`, `PlatformIncome` | `INV-<year>-<n>`, last row plus one (no lock, can collide under concurrency) | 18% fixed on the amount (`gstAmount` column) | `invoices`, `payments` |
| 2 | Commercial Engine | Get4Domain to vendor (terms, deals, renewals, special arrangements) | `Invoice` (extended), `BillingTerm`, `BillingDeal`, `PlanChangeRequest`, `PromoCode`, `ManualPaymentSubmission`, `PayeeSettings`, `CommercialAuditLog` | prefix plus last number plus one (`invoice-builder.service.ts` `nextNumber`, line 61) | `GST_PERCENT = 18` constant, `EXCLUSIVE` or `INCLUSIVE` per invoice, GST can be forgone on a special arrangement | `commercial` |
| 3 | Vendor invoices (Domain App) | vendor to customer | `GenericInvoice` | per vendor, computed in the service (`domainapp/invoices.service.ts` `nextInvoiceNumber`, line 28) | amount fields, no state logic | `domainapp` |
| 4 | Business Operating System | vendor to customer | `BosDocument`, `BosDocumentLine`, `BosDocSeries`, `BosPayment`, `BosAllocation`, `BosJournalEntry/Line`, `BosAccount`, `BosExpense`, `BosRecurring`, `BosStockLocation`, `BosSettings` | gapless per vendor, document type and financial year, assigned on issue inside one transaction (`bos/core.services.ts` line 84) | `bos/gst.ts`: pure integer-paise math, CGST+SGST or IGST by buyer state, EXCLUSIVE or INCLUSIVE, bill of supply (`NONE`), round-off line, discount shared across lines | `bos` |
| V3 | Plan invoices | Get4Domain to vendor | `V3PlanInvoice`, `V3PlanOrder`, `V3PaymentEvent`, `V3TaxRate`, `V3InvoiceCounter` | `formatInvoiceNumber(prefix, financialYear, n)` (`plan-billing/core/amounts.ts`), counter table | rate from the `V3TaxRate` table (`selectTaxRate`), effective dated | `plan-billing`, `plans` |

**Shared with V3 plan payments today: nothing.** V3 code is forbidden to read legacy billing tables (decision D1, stop-line 5). What V3 can reuse is code, not data: `bos/gst.ts` (pure, tested, vendor-side GST) is the right base for the vendor's own receipts (rule 12), and its state rule (intra-state versus IGST) is the same rule V3 needs for Get4Domain's own invoices. The V3 tax table already exists (`V3TaxRate`) and does not yet carry the IGST versus CGST+SGST decision by state; that is open (INV-7 question 5).

### 3.1 Feature list

| Area | Status | What exists | Proof |
|---|---|---|---|
| Vendor invoices, quotes, credit notes | working | Draft, issue (gapless number, stock out, journal posted), cancel, convert quote to invoice, credit note, share link, email, public pay page, PDF/HTML | `bos/bos.controller.ts` (documents, lines 62-138); `scripts/bos/verify-bos-pure.js` |
| Counter (POS) billing | working | One-step sale with payment | `bos.controller.ts` `counter/sale` (line 160) |
| GST (vendor side) | working | Intra/inter state split, bill of supply, inclusive/exclusive, HSN and rate per item, GST summary and HSN summary reports | `bos/gst.ts`; `bos/reports.service.ts`; capability `bos.gst-reports` |
| GST filing records | stub | `GstFiling` rows the vendor types in; no return preparation or filing | `accounting/accounting.controller.ts` (`gst-filings`) |
| Books | working | Trial balance, P&L, balance sheet, ledger, day book, item profit, purchase register; double entry from posting rules | `bos/posting-rules.ts`, `bos/chart.ts`; `bos/books` routes (lines 389-410); capability `bos.books` (plan BOS) |
| CA pack | working | Excel workbook of all registers | `bos/export/ca-pack.service.ts`; `bos.ca-pack` |
| Period lock | working | Closed months cannot change | `bos` settings lock (line 49); capability `bos.period-lock` |
| Expenses | working (two systems) | Simple `Expense` rows (`accounting`) and `BosExpense` with heads and journal posting | `accounting.controller.ts` (line 18); `bos.controller.ts` (line 268) |
| Items and services | working | Item = `VendorProduct` (the website product); HSN, GST rate, purchase price, variants, stock locations; `CatalogItem` is the older Domain App catalogue | `bos/bos-stock.service.ts`; `domainapp/catalog.service.ts`; `docs/v2/UNIVERSAL_CATALOGUE_MODEL.md` (migration written, cutover pending) |
| Payments (money in / out) | working | Payment records, allocation to documents, partials, overpayment, cancel; legacy `PaymentRecord` also exists | `bos/payments.service.ts`; `accounting.controller.ts` (`payments`) |
| Customer ledger and statement | working | Party statement (JSON and HTML), outstanding list, reminder text; `Contact.openingBalancePaise` | `bos.controller.ts` (`parties/:id/statement`, `outstanding`, `reminder`) |
| Purchases and suppliers | working | Purchase bills, stock in, cost update, cancel with reversal | `bos.controller.ts` (`bos/purchases`, line 319) |
| Recurring invoices | working | Monthly/quarterly/yearly schedule, daily 06:30 job | `bos/more.services.ts` (`@Cron('30 6 * * *')`, line 338) |
| Reports | partial | BOS summary, today, sales register, books above. `analytics` gives dashboard counts; no scheduled weekly or monthly report | `bos/reports.service.ts`; `analytics/analytics.controller.ts` |
| Plan gating of the above | working | Capture is never gated; Pro (`BOS` plan) switches views and exports; downgrade deletes nothing | `registry/capabilities.ts`; `docs/v2/FULL_BOS.md` |
| Collect payments with the vendor's own gateway | working | Vendor stores own Razorpay keys (encrypted); public document page creates an order on the vendor's keys; platform never holds the money | `vendor-payments` (3 routes); `bos` `public/bos/doc/:token/pay-order` (line 473) |
| Travel/agency books | partial | `accounting/travel-summary` for the travel module | `accounting.controller.ts` (line 48) |

### 3.2 Legacy wallet and its hardened debits

| Item | Status | Detail |
|---|---|---|
| Balance and transactions | working | `Wallet` (balance, totalCredited, totalDebited) and `WalletTransaction` per vendor; `balance` and `transactions` routes behind the `wallet` area flag | `wallet/wallet.controller.ts` |
| Top-up | working | Razorpay order and verify, owner-only (S8-B); credit is idempotent per Razorpay payment (advisory lock plus unique index) | `wallet.service.ts` lines 110-126, 320 |
| Debits | hardened | One atomic check-and-decrement inside a transaction (`debitIn`), idempotency key, `TX_OPTIONS = { maxWait: 15000, timeout: 30000 }`, pool starvation and every Prisma error classified at the wallet boundary (CI-FIX-2, WALLET_BUSY 503) | `wallet.service.ts` lines 212, 232; `test/wallet-*.spec.ts` |
| Admin deduct | working | `POST wallet/deduct` for staff | `wallet.controller.ts` (line 54) |
| Spend points | working | Per-message rates (`sms_message` 50, `whatsapp_message` 100, `email_message` 20 paise as fallbacks in code), AI Studio, reels/video (coming soon, no debit), domain registration, LeadSpace refills (a separate purse) | `communication.service.ts` (lines 12-16); `domains.service.ts` |
| Refunds | present in legacy | LeadSpace has refund requests and disputes; the main wallet has no refund route | `LeadRefundRequest`; rule 7 forbids refunds in V3 |
| Validity / expiry of credit | absent | No expiry on credit; rule 7 needs one year from top-up | `Wallet` has no lot or expiry columns |

**For V3.** Rule 7 describes a different wallet (V3's own, active after the first Pro payment, no cash-out, no refunds, one-year validity per top-up, used for services, packs, messages and renewals). The legacy `Wallet` has no lots, no expiry, and mixes into LeadSpace and domain spend. D1 forbids V3 code from reading it. Verdict in INV-7: build the V3 wallet new (Batch 4), reuse the debit pattern (atomic update, idempotency key, KeyedQueue), leave the legacy wallet running for legacy vendors.

### 3.3 How Razorpay is used today

| Use | Where | Keys | Mode |
|---|---|---|---|
| Vendor pays Get4Domain invoice | `payments` (create-order, verify, webhook), `commercial/pay.service.ts`, `invoices` payment link | platform key from environment (`RAZORPAY_KEY_ID`) | live-capable |
| Wallet top-up | `wallet.service.ts` | platform key | live-capable |
| Special arrangements and manual pay | `commercial` UPI/QR proof submission, staff confirms | none | manual |
| Vendor collects from own customer (BOS public document, engine checkout) | `bos` `public/bos`, `engine/public-checkout.service.ts` | the vendor's own keys from `VendorPaymentConfig` (encrypted) | vendor-direct (rule 4 compliant) |
| Vendor invoice payment link (Domain App `GenericInvoice`) | `domainapp/invoices.service.ts` (lines 15-18, 122) | **platform key from the environment**, not the vendor's | **conflicts with rule 4**: the customer's money lands in Get4Domain's Razorpay account; the earlier audit finding S9 (never reconciled) is the same defect. Retire or rewire to `VendorPaymentsService.getKeys` before any V3 vendor can use it |
| LeadSpace refill | `leadspace/credits.service.ts` | platform key | live-capable |
| V3 plan purchase | `plan-billing` | `RAZORPAY_TEST_KEY_ID` must start `rzp_test_`; live keys are refused in code; `paymentsMode` default `off` | TEST only |
| Domain registration | `domains` debits the wallet, then calls ResellerClub | none for Razorpay | wallet |

Open item for V3: platform Razorpay keys for legacy flows live in the environment; V3 keys are separate and test-only until the owner enables live mode.

## INV-4. Messaging

Two completely separate stacks exist. Neither has consent, opt-out or a Do-not-contact register that fits rules 9 and 10.

| Stack | Purpose | Modules | Provider | Mode |
|---|---|---|---|---|
| A. Vendor messaging (V2) | A vendor sends email, SMS or WhatsApp to a contact; the vendor's wallet pays per message | `communication`, `vendor-comms`, `whatsapp`, `sms`, `email`, `campaigns`, `whatsapp-bot`, `growth-hub` | Resend (email, real), Fast2SMS (SMS and WhatsApp via approved template id), one central account set in Admin > Integrations (`platform-settings`) | email real; SMS and WhatsApp mock until the Fast2SMS key resolves |
| B. Common WhatsApp number (LeadSpace) | Get4Domain sends transactional notices (OTP, new lead, low balance, receipt) to customers and vendors from one number | `messaging/whatsapp` (gateway, Cloud API provider, sandbox provider, webhook), `leadspace` | WhatsApp Cloud API (Meta), selected by `WHATSAPP_PROVIDER=cloud`; default sandbox | sandbox; Meta approval pending |

### 4.1 Component list

| Component | Status | What exists | Proof |
|---|---|---|---|
| Email (Resend) | working | Welcome, password reset and change, invoice, receipt, support reply, team and admin invites, generic send with from-name and reply-to; test mode skips the client | `email/email.service.ts` (methods lines 32-217) |
| SMS (Fast2SMS) | working, mock-first | `bulkV2` endpoint, key from encrypted platform settings; returns `mock` when no key; failures reported as `failed` | `sms/sms.service.ts` (lines 25-69) |
| WhatsApp via Fast2SMS | working, mock-first | Template and session endpoints; template ids per vendor in `VendorCommsSettings` | `whatsapp/whatsapp.service.ts` (lines 13-42) |
| WhatsApp Cloud API | working in sandbox | Gateway with 7 rules in code: only AUTHENTICATION and UTILITY templates, no free text, no bulk method, promotional wording refused, unapproved templates refused live, 12 messages per phone per day, inbound dropped, every send logged with masked number | `messaging/whatsapp/whatsapp-gateway.service.ts` (lines 13-90); `cloud-api.provider.ts`; `sandbox.provider.ts` |
| Webhook | working | GET handshake, POST status with signature check, throttled; inbound messages dropped | `whatsapp-webhook.controller.ts` |
| Templates | partial | Five LeadSpace templates in code (`leadspace_otp`, `_new_lead`, `_held_leads`, `_low_balance`, `_refill_receipt`) mirrored in `g4d_whatsapp_templates`; approval status `SANDBOX` until Meta approves; none for V3 | `whatsapp-gateway.service.ts` `DEFAULT_TEMPLATES`; `WhatsappTemplate` |
| Logs | working | `g4d_messages` (vendor to contact, channel, status, provider id), `g4d_whatsapp_message_logs` (number masked, phone hash) | `schema.prisma`; `communication.service.ts` |
| Wallet charge per message | working | Debit only for real sends, check balance first; rates default in code (50 paise SMS, 100 WhatsApp, 20 email) and overridable through `wallet.getRate` | `communication/communication.service.ts` (lines 12-16, 55-60) |
| Campaigns | stub | A record with channels, content and an estimated cost (`CHANNEL_COSTS_PAISE` hard-coded: whatsapp 100, sms 50, email 10, facebook 1000, instagram 500, paid ads 20000 paise); approval debits the wallet in one transaction with the status change; **there is no sender**: nothing iterates a contact list and sends, so an approved campaign charges the vendor and delivers nothing | `campaigns/campaigns.service.ts` (lines 9-40) |
| Broadcast / bulk send | absent | None for vendors. The common gateway deliberately has no bulk method | `whatsapp-gateway.service.ts` rule 2 |
| Social posting | partial | Accounts with encrypted tokens, posts, jobs, caps, retries, kill switch; sandbox until Meta approval; admin-only routes | `social/` (7 routes `admin/social`); `PostJob`, `SocialAccount` |
| WhatsApp bot | partial | Inbound webhook, routes the message to a vendor, answers from `KnowledgeBaseEntry` plus vendor products and CMS through the AI service, creates a lead and contact, hands off to a human on keywords (agent, human, call me), notifies the vendor. No guardrail text in the bot for medical, legal, tax or financial advice, no payment refusal beyond the generic AI prompt | `whatsapp-bot/whatsapp-bot.service.ts` (lines 11, 55-70, 172); `knowledge-base.service.ts` |
| Web chat | partial | `components/ChatBot.tsx` and `DashboardChatBot.tsx` (marketing and in-dashboard assistants) | frontend only |
| Instagram / Facebook assistants | absent | `meta/` is 56 lines of connector placeholder; `social` publishes, it does not converse | `meta/` |
| Queue / scheduler | none for messaging | There is no outbound queue, retry or rate shaping. Scheduled jobs in the repo are `@Cron` handlers: BOS recurring (06:30), commercial renewal (06:00), LeadSpace promotion (every 10 min), V3 plan billing (hourly), V3 provisioning (every 30 s). `@nestjs/schedule` only; no Redis, no BullMQ | `grep @Cron` |
| Consent / opt-out | **absent** | No opt-in capture, no unsubscribe link, no STOP handling in stack A. `g4d_consent_records` (LeadSpace) stores a text version, purpose and phone hash for OTP capture only. `LeadBlockedPhone` blocks LeadSpace leads only | `schema.prisma`; `leadspace/goals.ts` (`CONSENT_TEXT_VERSION`) |
| Do-not-contact register | absent | none | searched |
| Quiet hours, frequency caps | partial | The common gateway caps 12 per phone per day; stack A has none | `whatsapp-gateway.service.ts` line 36 |
| Vendor identity on messages | working | Per-vendor from-name, reply-to, SMS business name, own WhatsApp number and template id | `vendor-comms/vendor-comms.service.ts` |

### 4.2 Findings against owner rules 9 and 10

1. Rule 9 (consent, unsubscribe, block list before every send, Do-not-contact for seeded businesses) has **no implementation to adapt** in stack A. The nearest asset is the Cloud API gateway: its seven rules show the right style (checks in code, not policy), and its per-send log is what an audit needs.
2. `communication.send` accepts any `to` string and any text. Nothing checks that the recipient is a contact of that vendor or has opted in. It must not be reachable by a V3 vendor until a consent gate sits in front of it.
3. Hard-coded prices: `CHANNEL_COSTS_PAISE`, `CHANNEL_RATE` fallbacks. Stop-line 6 forbids invented values in V3; V3 messaging must read rates from settings and refuse to enable a channel until staff set them.
4. The bot (rule 10) answers from stored details, which is right, and hands over on request, which is right. It lacks the explicit refusals (advice, payment) and has no hand-over record other than a lead and a notification.
5. Vendors will get website chat only (rule 10); the WhatsApp, Instagram and Facebook assistants are Get4Domain's own and do not exist yet (directory search that sends people to business sites).

## INV-5. Sites and the other areas

### 5.1 Website renderer and theme packs

**Five render paths** (all in `get4domain_mvp/src/app/site/[subdomain]/[[...rest]]/page.tsx`, checked in order):

| # | Path | Condition | Output | Notes |
|---|---|---|---|---|
| 1 | Theme package, new document | `site.docV2 && site.themeRef` | `ThemeSite` (`engine/themepack/site.tsx`) renders a stored `ThemePackage` server-side | Self-canonical; the path D3 wants for HTML themes |
| 2 | Uploaded raw HTML theme | the vendor has uploaded static pages | `RawThemeFrame` (`engine/raw-theme-frame.tsx`): the HTML inside an iframe `srcDoc` | Content inside an iframe is poor for SEO; SEO-0 item 0.11 retires it |
| 3 | Selected kit template | `site.theme` row resolves to a kit template and the page is the home page | `renderKitTemplate` | Home only |
| 4 | Document renderer without a package | `site.docV2` | `KitRenderer` with page models, `/p/<slug>` inner pages | The 13 built-in site themes (`engine/kit/site-themes.json`) |
| 5 | Legacy renderer | not `docV2` | the older section renderer | Reads `VendorCMS` fields directly |

Flag: `site_doc_v2` ("New Website Manager") is a per-vendor add-on key (`addons.constants.ts`). Vendors without it use path 5.

**What feeds the renderer.**

| Piece | Where | Detail |
|---|---|---|
| Site document | `VendorCMS` (one row per vendor: draft JSON, layout JSON, pages JSON, `siteVersion`, `siteStatus`, `packKey`, `themeId`, `designKey`) + `SiteVersion` (snapshot per publish) | module `site-doc` (23 routes), editor `my-website/SiteEditorV2.tsx` |
| Category packs | 24 pack seeds (`site-doc/seeds/part1-3`) and 8 flow families (`site-doc/families.ts`: shop, booking, enquiry, packages, menu, portfolio, listings, courses); `g4d_category_packs` rows editable in admin | `docs/v2/WEBSITE_MANAGER_PROGRESS.md` calls this 32 starter packs |
| Themes in the database | `ThemePackage` rows plus `ThemeAsset` rows holding the files as `Bytes` (path, mime, bytes, data); `ThemeEntitlement` per vendor | module `themes` (10 routes) |
| Older theme catalogue | `WebsiteTheme` and `VendorTemplateUnlock` (unlock/purchase flow) | module `website-themes` (9 routes) |
| Theme contract | `docs/v2/THEME_CONTRACT.md` (contract v1); as built `docs/v3/THEME_CONTRACT_AS_BUILT.md` | |
| V3 renderer and publish | `site-publish` (renders to a stored snapshot; tables `V3SitePublication`, `V3SitePublicationPage`, `V3SiteSettings`, `V3SiteEvent`) | 15 routes, 10 spec files, slice 5.4 |
| Theme kit | `themes/` (see INV-9) | 41 categories, one renderer `renderPage()`, lint, 5 Standard themes |

**Gaps against V3.** The 41-category list does not exist in the backend (24 pack ids, different names; the theme kit's `category-map.json` is marked `"status": "inference"`). Theme files live in database rows. Five render paths exist; D3 and SEO-0 want one server-rendered path.

### 5.2 Per-industry modules (21 backend modules, 20 UI tab folders)

Each module is a controller plus service plus DTOs on its own tables, all behind the vendor JWT. None carries an `@RequireModule` area gate, so the server lets any signed-in team member of the vendor call them; only the sidebar and registry decide who sees the tab. All 21 are **hidden, not deleted** for V3 vendors (replacement map, row "Industry-specific ops").

| Module | Tables | Routes | UI tab folder (`domainapp/`) |
|---|---|---|---|
| agriculture | ProduceOrder, ProduceStock | 9 | agriculture |
| automobile | ServiceJob, JobLine, PartStock | 13 | automobile |
| clinic | Doctor, ClinicAppointment | 9 | clinic |
| coaching | CoachingBatch, CoachingEnrollment, CoachingSession | 13 | coaching |
| construction | ConstructionProject, ProjectMilestone, ProjectMaterial | 13 | construction |
| diagnostics | TestOrder, TestOrderItem | 9 | diagnostics |
| education | Batch, StudentEnrollment | 9 | education |
| events | EventBooking, EventVendorAssignment | 10 | events |
| finance | FinanceCase, FinanceCaseDocument | 10 | finance |
| gym | GymClass, Membership | 9 | gym |
| hotel | Room, RoomBooking | 9 | hotel |
| logistics | Shipment | 5 | logistics |
| photography | PhotoShoot, ShootDeliverable | 10 | photography |
| professional | Engagement, EngagementDocument | 10 | professional |
| realestate | Listing, Deal, PropertyVisit | 13 | realestate |
| restaurant | PosTable, RestaurantOrder, RestaurantOrderItem | 15 | restaurant |
| retail | RetailProduct, PosSale | 9 | retail |
| salon | Stylist, SalonChair, SalonAppointment | 13 | salon |
| stationery | StationeryItem | 4 | (dashboard page `stationery`) |
| technology | TechProject, ProjectTask | 9 | technology |
| travel | Vehicle, Driver, Trip, VisaApplication, Contract, ContractAssignment | 21 plus 5 contracts | travel |

Related config: `OperationType` and `IndustryExperience` tables, `get4domain_mvp/src/config/industry-experience.ts` (20 industries; the memory index calls this the two-mirror config), `engine/industries` (kit, real-estate, retail website sections). The replacement map lists five of these (agriculture, diagnostics, restaurant, "BOS", "counter/POS") and calls BOS an industry module: that is wrong (see INV-6).

### 5.3 Team and roles

| Item | Detail | Proof |
|---|---|---|
| Vendor team | `TeamMember` (email, role label, `modules` JSON of area flags); invited by email; the JWT `sub` is the vendor id for members as well as owners | `team/`, `auth/auth.service.ts` |
| Areas | eight canonical areas: telecrm, campaigns, communication, accounts, wallet, website, reports, ai_studio; loose labels are normalised | `team/team-access.ts` |
| Enforcement | `ModuleGuard` restricts a team member only on routes or controllers marked `@RequireModule('<area>')`; **a route without that decorator is allowed for a team member** (header of `module.guard.ts`: "undecorated routes unaffected"). That covers all 21 industry modules and parts of `domainapp`, `bos` and `engine`. Owner-only routes (S8-A: domains, vendor-payments keys, payments, wallet top-up, theme unlock) use `VendorOwnerGuard`, listed in `test/route-classification.spec.ts` | `common/guards/module.guard.ts`, `vendor-owner.guard.ts`, `test/route-classification.spec.ts` |
| Staff roles | `AdminTeamMember.adminRole` with three values: SUPER_ADMIN, MARKETING, OPERATIONS; deny by default through a matrix, a route with no entry is SUPER_ADMIN only | `auth/guards/admin.guard.ts`, `admin-role-matrix.ts`, `test/admin-role-matrix.spec.ts` |
| Missing for V3 | the staff role set in the V3 playbook (Vendor Onboarding, Website Developer, SEO Team, Social and Marketing, Customer Support, Finance, Telecalling, Super Admin) is not in the enum; spend caps per member are only planned | `V3_REPLACEMENT_MAP` section 5 |

### 5.4 Enquiries

Covered in INV-2 (capture routes and source). Public capture exists in `engine`, `widget`, `campaign-pages`, `whatsapp-bot`, LeadSpace and the per-industry intents. Free-plan behaviour (rule 2: no forms, no call to action) is not implemented anywhere: capture is not tied to a plan.

### 5.5 AI Studio

| Part | Status | Detail |
|---|---|---|
| Text generation | working | `ai` module: OpenAI (`gpt-4o-mini`) and Anthropic keys from Admin > Integrations (`ai/openai_api_key`, `ai/anthropic_api_key`), fallback across providers and accounts, real errors never masked as "not configured", wallet debited only after real content | `ai/ai.service.ts` (lines 171-191, 252) |
| Vendor screen | working | `app/dashboard/ai-studio` (672 lines): captions, descriptions, replies | |
| Prompt templates | working | `AiTemplate` rows, admin routes | `ai-templates/` |
| Posters, reels, video | stub | `reels` (2 routes), `video` (3 routes): provider chain placeholders, marked "coming soon", no wallet debit | `reels/`, `video/`, `docs/v2/STATUS.md` |
| V3 AI Studio | V3 | provider settings, credit grants, prompts, usage; credit reservation is exactly-once under 27 parallel requests (PUSH-FIX-2) | `ai-studio/`, `test/ai-concurrency.int.spec.ts` |
| Health check | script | `scripts/ai-health.js` | |

### 5.6 Domains and the ResellerClub code

| Part | Status | Detail |
|---|---|---|
| Domain search | working code | `ResellerClubService.checkAvailability` for a base name across TLDs; retail prices **hard-coded** per TLD (`RETAIL_PRICE_PAISE`: .in 599, .com 999, .net 1,099, .shop 1,299, .store 1,499 rupees; default 1,199) | `domains/domains.service.ts` (lines 12-27) |
| Registration | working code, never run live | debits the legacy wallet, creates the ResellerClub customer and contact, calls `registerDomain`, stores `DomainRegistration`; test host `https://test.httpapi.com/api` is supported; production run status is unknown from the repo, and the memory index records the client as untested | `domains/domains.service.ts` (line 174), `resellerclub.service.ts` (lines 39-204) |
| Connect own domain | working code | returns A and CNAME targets, DNS check `verifyMapping` using Node `dns` | `domains.service.ts` (lines 264-279) |
| Vendor fields | | `Vendor.customDomain`, `resellerClubCustomerId`, `resellerClubContactId` | `schema.prisma` |
| No renewals, expiry alerts, auto DNS, invoice | absent | none of these exist | searched |
| V3 domains | V3 | `site-domains` (14 routes): subdomain rules, custom-domain records, verification, redirects, a host directory with a cache (suspended vendors refused, PUSH-FIX-1) | `site-domains/` |

### 5.7 Admin dashboard modules (`app/admin`, 35 pages)

| Group | Pages | Backend |
|---|---|---|
| Vendors and customers | customers (2), vendor-access, utilization, domains, cms, themes, category-packs | `vendors`, `addons`, `registry`, `domains`, `cms`, `themes`, `site-doc` |
| Money | commerce (8 pages: deals, invoices, payee, payments, plan-access, plan-changes, promos and the index), invoices, renewals, pricing (2), plans, accounting | `commercial`, `invoices`, `platform-settings`, `subscriptions` |
| Sales and support | leads, telecrm, send-quote, support, managed-services, library | `leads`, `admin-crm`, `quotes`, `support`, `managed-services`, `ai-templates` |
| Platform | settings, api-settings, team, ai-studio, campaigns, leadspace | `platform-settings`, `admin-team`, `ai`, `leadspace` |

### 5.8 Public website pages (`app/(marketing)`, 22 pages)

Home, about, features, pricing, how-it-works, industries and `industries/[id]`, portfolio, templates, support, contact, quote, book-demo, talk-to-sales, leadspace, managed-services, domain-app, terms, privacy-policy, refund-policy, cart, checkout. Positioning text on these pages still uses the V2 names (Workspace, BOS, LeadSpace, prices) in `data/content.ts`, `data/platform-features.ts` and `lib/pricing.ts`; SEO-0 (branch `v3-seo0`, not merged into `v3-b2`) fixes the SEO side, rule 13 requires the wording to go.

## INV-6. Replacement map verified

Source: `V3_REPLACEMENT_MAP_AND_WORK_PACKAGES.md` (repo root of the main worktree and `docs/v3/0_START_HERE/`; not tracked in git on this base). One row per line of its section 2 ("Today (verify)" column). Verdicts: **CONFIRMED**, **WRONG** (with the fix), **UNKNOWN** (the repository cannot answer). Several "Today" cells were true on the V2 base and are now stale because Batch 1 and 2 built the V3 piece; those are marked STALE (the V2 statement is still correct).

| # | Area | Claim in the map | Verdict | Evidence and fix |
|---|---|---|---|---|
| 1 | Plans | "Workspace, BOS, LeadSpace plan model, legacy prices" | **WRONG** in part | Plan keys are `WORKSPACE` and `BOS` only (`enum BillingPlanKey`); the old `Plan` enum is STARTUP/STARTER/BUSINESS/ENTERPRISE. LeadSpace is an add-on key (`leadspace`, `leadspace_only` in `addons.constants.ts`), not a plan. Fix the cell to: "Two plan keys (Workspace, BOS), an old Product x Plan subscription, LeadSpace as an add-on". The V3 entitlement table and the four states ACTIVE, LIMITED, LOCKED_PREVIEW, HIDDEN already exist (`plans/entitlements/entitlement-engine.ts`, `V3Feature`, `V3PlanFeature`, `V3EntitlementOverride`): STALE. "Map existing vendors to a track and level": no tool or script exists, still NEW |
| 2 | Wallet | "Wallet with debits (hardened by S12)"; V3: KEEP the engine, ADAPT charge rules | **CONFIRMED** for the hardening; **WRONG** for the V3 plan | Debits are atomic with idempotency keys and pool-starvation handling (`wallet.service.ts`). But owner rule 7 and decision D1 make the V3 wallet a new one (lots with one-year validity, no refunds, no cash-out, active after the first Pro payment, V3 code never reads the legacy tables). Fix: "KEEP the legacy wallet untouched for legacy vendors; NEW V3 wallet, reusing the debit pattern" |
| 3 | Team and roles | "Team members with area flags (S8-A done)"; S8-B owner-only routes; presets; spend caps later | **CONFIRMED** | Area flags in `team/team-access.ts`; `VendorOwnerGuard` on domains, vendor-payments keys, payments, wallet top-up, theme unlock (`test/route-classification.spec.ts`). Caveat: `ModuleGuard` lets a team member through any route without `@RequireModule` (all 21 industry modules). No spend caps; staff roles are 3 values (SUPER_ADMIN, MARKETING, OPERATIONS), not the 8 routines of section 5 of the map |
| 4 | Accounts and billing | "Accounting engine (invoices, GST, books)" | **CONFIRMED**, wording WRONG | The engine is the BOS (`bos/`), not `accounting` (which is a small expenses/payments/GST-filing module). There are four invoice engines, not one (INV-3). BOS plan gating uses `registry/capabilities.ts`, not V3 entitlements, so "ADAPT entitlement checks" means mapping those 9 capabilities onto V3 features |
| 5 | CRM, TeleCRM | "Present" | **CONFIRMED** | INV-2. Qualifier: TeleCRM works on `g4d_campaign_leads`; telephony is a `tel:` link; no scripts, segments or team performance |
| 6 | Enquiries | "Present"; ADAPT: store UTM and source | **CONFIRMED** | `source` is a free string; there are no UTM columns on `CampaignLead`; UTM exists only in LeadSpace promotion and reports. UTM storage is NEW, not an adaptation of a column |
| 7 | Industry-specific ops | "agriculture, diagnostics, restaurant, BOS, counter/POS" | **WRONG** | There are 21 industry modules (list in INV-5.2). BOS is the accounting engine, not an industry module. Counter billing is `bos` `counter/sale` plus `PosSale` used by retail and restaurant. The V3 "Jobs, Appointments, Store" track modules do not exist yet (NEW). Fix: replace the list with the 21 modules |
| 8 | LeadSpace | "Free page product" | **WRONG** | It is a prepaid lead product: its own purse, price rules, OTP capture with consent records, disputes, refunds, abuse reports, a 10-minute promotion cron, 93 routes, 15 models (INV-1). `docs/v2/STATUS.md` says it was built and "nothing deployed" on 10 Oct 2026; the migrations are in production (`V3_PRODUCTION_MIGRATION_STATE.md`: at head). Whether any vendor has live data: UNKNOWN until query 8 in `OWNER_READONLY_QUERIES.sql` is run. RETIRE stands, but the cell must say "hide and keep data" |
| 9 | Themes and website renderer | "24 category packs, 8 flow families, theme package contract v1, 5 render paths, assets stored in the database" | **CONFIRMED** (all five) | 24 pack seeds (`site-doc/seeds`), 8 families (`site-doc/families.ts`), `docs/v2/THEME_CONTRACT.md`, five paths in `app/site/[subdomain]/[[...rest]]/page.tsx`, `ThemeAsset.data Bytes`. Note: "41 categories" exist only in the theme kit (`themes/`), not in the backend |
| 10 | Website Manager | "Partial" | **WRONG** (understated) | `docs/v2/WEBSITE_MANAGER_PROGRESS.md` marks phases 0-8 DONE: draft, preview, publish, versions, uploads, category packs, 13 themes; module `site-doc` has 23 routes; editor `SiteEditorV2.tsx`; per-vendor flag `site_doc_v2`. What is missing for V3 is the V3 renderer path for all vendors and brand settings. Fix: "Built and flag-gated; ADAPT, not NEW" |
| 11 | Subdomains and domains | "ResellerClub integration never run live" | **UNKNOWN** | Code is complete for search, register, connect and DNS check (INV-5.6); nothing in the repo shows a live run. The memory index records the client as untested. The "Backend work" cell (custom-domain mapping, redirects, verification) is STALE: `site-domains` (slice 5.6) built it. Renewals, expiry alerts, GST invoice and refund rules for domain sales (package 9b) are absent |
| 12 | Provisioning and invites | "Partial create and email" | **CONFIRMED** for V2, STALE | V2: admin create, `StarterService.provisionSite`, welcome email carrying a plaintext password (S10). V3: the `provisioning` module (12 routes, jobs, steps, claim tokens, invites) is built (slice 5.3) |
| 13 | Directory | "None" | **CONFIRMED** for V2, STALE | The `directory` module (29 routes, slice 5.7) is built on the V3 base |
| 14 | SEO layer | "Partial per-page meta; audit lists 14 defects" | **CONFIRMED** | `docs/v3/SEO_AUDIT_AS_BUILT.md` section 7 lists 14 fixes (item 14 is the V3.2 directory). SEO-0 commits D1-D6 and A5-A11 are on this base; the rest are on branch `v3-seo0`, which is not merged into `v3-b2`. V3 sites already have `site-publish/seo/` (indexing rule, page SEO, site files) |
| 15 | SEO Manager, keyword planner, SEO tasks | "None" | **CONFIRMED** | No keyword or SEO-task code in either app |
| 16 | Connections and Google sync | "None" | **CONFIRMED** | No Google API client; only a `googleAnalyticsId` text field on `VendorCMS` and a `googleMaps` link |
| 17 | Reports and audit | "None" | **CONFIRMED** for scheduled reports and the audit crawler | Partial pieces exist: `analytics` (dashboard counts), `/dashboard/reports`, BOS reports and CA pack, LeadSpace reports. No weekly or monthly generator, no crawler |
| 18 | AI Studio | "Partial" | **CONFIRMED** | Text works; posters, reels and video are stubs (INV-5.5). The V3 provider settings, credits and usage exist (slice 5.11) |
| 19 | Social, campaigns, promotion | "Partial" | **CONFIRMED** | Social publisher with caps and kill switch (sandbox); LeadSpace promotion plans and posts; `campaigns` records only and sends nothing (INV-4). No UTM toolkit |
| 20 | Admin dashboard | "Existing admin" | **CONFIRMED** | 35 pages (INV-5.7); staff roles are 3 values |
| 21 | Public website | "Legacy positioning (Workspace, BOS, prices)" | **CONFIRMED** | `data/platform-features.ts` (36 matches), `lib/pricing.ts` (30), `data/content.ts` (3) still use the V2 names. Rule 13 requires removal |
| 22 | Demo catalogue | "Indexed demo pages" | **WRONG** on this base | The sitemap no longer lists `/demo/*` and the OTP gate redirects crawlers (SEO-0 D1-D6, commit 1073e7f). Remaining: a `noindex` header on every `/demo/*` response (commit on `v3-seo0`, not merged) |

### Other statements in the map

| Statement | Verdict | Evidence |
|---|---|---|
| Section 6.1: "Handyman 999, Professional 1,999, Ecommerce 2,999 a month excluding GST; introductory 50%" | **UNKNOWN** | No price is seeded anywhere (`prisma/seed/v3-plans.seed.json` has no amounts; prices are admin-approved rows). Rule 3 says billing terms are quarterly, half-yearly and annual only, so a monthly price conflicts. Needs the approved price book |
| Section 6.3: "Get4Domain SELLS domains through the ResellerClub API" | **UNKNOWN** | Code exists, never proved live; V2 retail prices are hard-coded (`domains.service.ts`) |
| Section 7, package 9b: "wallet debit and registrar call are one traceable job with retry and refund on failure" | **WRONG** against rule 7 | Rule 7: no refunds of any kind. A failed registration must be handled by not charging until the registrar confirms |
| Section 4, jobs: "Theme expiry and renewal check", "Domain and SSL watcher" | **PARTLY EXISTS** | `themes/theme-expiry.service.ts` exists for the V2 theme purchase; no SSL watcher |
| Section 3, package 0: S7, S8-B, S13 | **CONFIRMED done** | Route classification and role-matrix tests exist; password reset and refresh tokens exist in `account-security` |

## INV-7. Verdicts

**Meaning.** KEEP = use as is. ADAPT = same engine, V3 rules and screens. RETIRE = hide for V3 vendors, keep code and data (rule 6 and the map's method: never delete). NEW = nothing in V2 to start from. Verdicts follow the frozen owner rules. The "V3 slice" column uses the slice numbers of the dispatch files in `docs/v3/stages/V3_DISPATCH`; "built" means the V3 module already exists on the `v3-b2` base.

**Totals for the 92 backend modules:** KEEP 25, ADAPT 28, RETIRE 39. The 21 industry modules are all RETIRE. NEW applies to capabilities that have no V2 module (7.3).

### 7.1 One row per backend module

| Module | Verdict | V3 slice | Main risk |
|---|---|---|---|
| account-security | KEEP | built (S13) | Browser keeps the JWT in localStorage; token storage is a later frontend job |
| accounting | RETIRE | 5.23 (Stage 17) | Two expense systems exist (this and BOS); hide this one, archive its rows read-only; GstFiling is hand-typed |
| addons | ADAPT | 5.1d (Stage 06) | Add-on keys carry plan meaning (`workspace_menu`, `leadspace_only`); map them to entitlements without losing grants |
| admin-crm | ADAPT | 5.23, 5.18d (Stage 17, 10) | MARKETING may list prospect phone and email here while the same data under `GET /leads` is SUPER_ADMIN only; no consent or Do-not-contact check |
| admin-team | ADAPT | 5.20 (Stage 08) | Only 3 staff roles against the 8 team routines |
| agriculture | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| ai | ADAPT | 5.11b (Stage 16) | Guardrails for rule 10 are not in the prompt; model name is hard-coded |
| ai-studio | KEEP | built (5.11) | Posters, reels and video are not built |
| ai-templates | ADAPT | 5.11b (Stage 16) | None |
| analytics | ADAPT | 5.10 (Stage 14) | Counts legacy tables; V3 reports must not read them |
| auth | KEEP | built | One principal model for owner and team (`sub` is the vendor id); keep it, add the V3 tenant guard on new routes only |
| automobile | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| bos | ADAPT | 5.23 (Stage 17) | Largest legacy module (78 routes); plan keys Workspace and BOS; the name BOS may not appear in product text (rule 13); tests live in script suites, not Jest |
| business-documents | KEEP | none | Low value; keep as is, hidden unless a track needs it |
| campaign-pages | RETIRE | 5.13a, 5.7b | Public lead capture on Free sites is forbidden (rules 2, 5); old landing pages stay served for legacy vendors until moved |
| campaigns | RETIRE | 5.18c (Stage 10) | Charges the wallet and sends nothing; replace with the consent-gated V3 campaigns |
| clinic | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| cms | ADAPT | 5.5 (Stage 13) | `VendorCMS` is the single site store for V2; V3 snapshot tables sit beside it; two sources of truth during the move |
| coaching | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| commercial | RETIRE | 5.1b built; 5.17 (Stage 09) | Legacy billing is out of scope for V3 code (D1); keep running for legacy vendors; GST fixed at 18% in code; monthly and annual terms differ from rule 3 |
| common | KEEP | built | Shared guards and KeyedQueue; `ModuleGuard` is allow-by-default for undecorated routes |
| communication | ADAPT | 5.18b (Stage 10) | No consent, opt-out or block list; rates hard-coded; must sit behind a consent gate |
| config | KEEP | built | None |
| construction | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| crm | ADAPT | 5.23 (Stage 17) | Works on campaign leads, not contacts; no de-duplication; needs entitlement and consent gates (INV-7.2) |
| customer | ADAPT | 5.18a (Stage 10) | OTP login is mocked outside production; portal ties to `Contact` |
| demo | KEEP | SEO-0 | Needs a `noindex` header (on branch `v3-seo0`, not merged); the demo catalogue shows V2 products |
| design | KEEP | none | Sample Fabric.js templates; part of the poster path |
| diagnostics | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| directory | KEEP | built (5.7) | Claim and removal flows are built; seeded-site indexing stays OFF |
| domain-campaign | RETIRE | none | Folded into LeadSpace in V2; hide and keep data |
| domainapp | ADAPT | 5.23 (Stage 17) | Contacts and catalogue are the base for the customer list; Domain App invoice payment link uses the platform Razorpay key (rule 4) |
| domains | RETIRE | 5.6c, 5.6d (Stage 15) | Replace by `site-domains`; hard-coded retail prices; wallet debit before the registrar call; no live proof |
| education | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| email | KEEP | 5.18b (Stage 10) | Templates are inline; needs consent-aware send for campaigns |
| engine | ADAPT | 5.13a (Stage 06) | Public actions must switch off on Free sites (rule 2); vendor-direct checkout stays for Pro |
| events | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| finance | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| google-ads | RETIRE | 5.12b (Stage 16) | Mock; remove from navigation |
| growth-hub | RETIRE | 5.12b (Stage 16) | Mock Meta and ads layers report success they did not achieve (audit S11) |
| gym | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| health | KEEP | built | None |
| hotel | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| industries | ADAPT | 5.24 (Stage 17) | 20 industry configs vs 41 categories and three tracks |
| invoices | RETIRE | 5.17d (Stage 09) | Invoice number is last row plus one without a lock; GST fixed at 18%; replaced by V3 plan invoices |
| leads | KEEP | none | Get4Domain's own demo leads; SUPER_ADMIN only already |
| leadspace | RETIRE | 5.7b (Stage 06) | Own wallet purse, refunds and disputes; live data unknown until the owner queries run; hide and keep data |
| logistics | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| managed-services | ADAPT | 5.16b (Stage 07) | Becomes part of the service catalog and price book; V2 rates are admin data |
| messaging | ADAPT | 5.18b (Stage 10) | Best asset for rule 9 (checks in code); templates await Meta approval |
| meta | RETIRE | 5.12 (Stage 16) | Placeholder; the social publisher is the real path |
| notifications | ADAPT | 5.20 (Stage 08) | Becomes the staff alert path; web push exists |
| otp | KEEP | built (5.7) | Used by demo and public flows; V3 has its own OTP challenge table |
| payments | RETIRE | 5.17 (Stage 09) | Legacy Razorpay path with the platform key; V3 uses the gateway ports |
| photography | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| plan-billing | KEEP | built (5.1b) | Test mode only; live keys refused in code |
| plans | KEEP | built (5.1) | Existing vendors are not yet mapped to a track and level |
| platform-settings | KEEP | built | Encrypted keys; V3 settings sit in `V3PlanSetting`; two stores |
| prisma | KEEP | built | None |
| professional | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| provisioning | KEEP | built (5.3) | Bulk CSV site creation is Batch 9 |
| quotes | KEEP | none | Platform quotes to prospects; unrelated to vendor quotes in BOS |
| realestate | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| reels | RETIRE | 5.11b (Stage 16) | Stub; coming soon |
| registry | ADAPT | 5.1d (Stage 06) | Menu and plan access by Workspace and BOS; replace by entitlements, then retire |
| restaurant | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| retail | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| salon | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| site-doc | ADAPT | 5.5 (Stage 13) | Flag-gated per vendor; 23 routes to fold into the V3 website manager |
| site-domains | KEEP | built (5.6) | Automation in Batch 11 |
| site-publish | KEEP | built (5.4) | Listing-only renderer and canonical rule in Batch 3 |
| sms | KEEP | 5.18b (Stage 10) | Mock-first; DLT sender id shared |
| social | ADAPT | 5.12 (Stage 16) | Sandbox until Meta approval |
| stationery | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| stock | ADAPT | 5.24 (Stage 17) | Store track module base |
| storage | KEEP | built | None |
| subscriptions | RETIRE | 5.1d (Stage 06) | Old Product x Plan subscriptions; keep rows for history |
| support | KEEP | 5.22 (Stage 08) | Becomes part of Vendor 360 |
| team | ADAPT | 5.20 (Stage 08) | Add presets and spend caps; `ModuleGuard` default |
| technology | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| themes | ADAPT | THEMES-CC-3 (Stage 12) | Theme bytes in the database; the package format differs from the V3 theme kit |
| travel | RETIRE | 5.25 (Stage 17) | Hide for V3 vendors, keep data; first check with the owner queries whether a live client uses it |
| uploads | KEEP | none | Per-vendor quota still to confirm |
| vendor-comms | ADAPT | 5.18b (Stage 10) | Per-vendor sender identity; keep |
| vendor-payments | ADAPT | 5.17a (Stage 09) | Vendor's own keys, encrypted; the right model for rule 4 |
| vendors | ADAPT | 5.13b (Stage 13) | Staff vendor admin; needs act-on-behalf and activity log |
| video | RETIRE | 5.11b (Stage 16) | Stub; coming soon |
| wallet | RETIRE | 5.16a (Stage 07) | Legacy wallet stays for legacy vendors; V3 wallet is new (rule 7) |
| website-themes | RETIRE | THEMES-CC-3 (Stage 12) | Older catalogue and unlock flow; the V3 theme purchase replaces it |
| whatsapp | ADAPT | 5.18b (Stage 10) | Fast2SMS sender; mock-first; no consent |
| whatsapp-bot | RETIRE | 5.19 (Stage 11) | Vendors get website chat only (rule 10); the WhatsApp assistant becomes Get4Domain's own |
| widget | ADAPT | 5.19a (Stage 11) | Chat part becomes the vendor website chat; the lead-submit part must obey rule 2 |


### 7.2 The two questions

**Can the existing CRM contact table (`g4d_contacts`) become the V3 customer list (`g4d_customers`) through an adapter without duplicating data?**

Yes, if the adapter is a link and not a copy, and if two preconditions are met.

| Point | Finding |
|---|---|
| What `Contact` already holds | name, phone, email, type, tags, address, GSTIN, state, shipping address, opening balance, custom fields, portal access: every identity field V3 needs |
| Who already depends on it | BOS parties and documents, Domain App invoices, the customer portal, the WhatsApp bot, CRM convert, demo data. Replacing it would split the books from the customer list |
| What it lacks | phone in E.164 form, a unique key on (vendor, phone), source, consent per channel, unsubscribe and block state, import attestation, soft delete |
| Recommended design (for the B6.0 decision) | Keep `Contact` as the single identity record. Create `g4d_customers` as a thin row per customer: `vendorId`, `phoneE164` (unique per vendor), `source`, and a nullable unique `legacyContactId`; consent lives in `g4d_customer_consents`. The adapter reads name, email, tags and address from `Contact` through that link and never copies them. V3 customers created by a request, order or payment get a `Contact` through the adapter only once an ADAPT slice (Batch 13, 5.23) allows the write. Every legacy contact starts with consent **NONE** (not opted in); nothing is inferred |
| Precondition 1: duplicates | `Contact` has no unique phone, and import and capture never de-duplicate, so duplicates must exist. Query 9 in `OWNER_READONLY_QUERIES.sql` counts duplicate (vendor, phone) groups. The adapter must report collisions and must not merge silently |
| Precondition 2: legacy screens freeze | The old dashboard writes `Contact` directly. After a vendor moves, those screens are hidden (map, rule: "Old screens are hidden for them"), so there is one writer. Until then both exist: do not enable V3 customers for a vendor who still uses the old screens |
| Alternative | A one-time additive import at the switch (STAGE 19) with E.164 de-duplication. Cleaner for the five live clients, but BOS would then point at the old table while V3 points at the new one, which is the two-sources-of-truth problem Batch 13 forbids. Not recommended |

**Which TeleCRM features need V3 consent and entitlement gates?**

| Feature | Consent gate | Entitlement gate | Notes |
|---|---|---|---|
| Call queue, follow-ups, call records, outcomes | Calls are not messages (rule 9 speaks of messages); outbound calls to imported lists need a regulatory decision (question 4) | Pro only; Free is LOCKED_PREVIEW, and Free receives no requests (rule 2) so the queue is empty anyway | Link each call to a customer; write each call to the activity log (rule 8) |
| Import | Required: attestation of the source and right to contact (5.18a `g4d_import_batches`); imported rows get consent NONE; must not reach messaging | Pro only; row limit from the plan | Today the import skips blanks only, does not de-duplicate and does not attest |
| Convert lead to customer | Capture consent state at conversion (opt-in text and channel) | Pro | Idempotent by phone: keep, move to E.164 |
| Send from TeleCRM (WhatsApp, SMS, email buttons and `communication.send`) | Required: opted in for that channel, not on the block list, unsubscribe route present, checked before every send | Pro; wallet charge for sends (rule 7) | The V2 service has none of these checks |
| Source attribution | None | Pro | Add UTM and source columns; capture is gated by plan |
| Enquiry capture (`engine.enquiry`, `widget`, `campaign-pages`) | Consent text at capture | Free: switched off completely (no form, rule 2); Pro: full | Enforced at the action registry, not in the UI |
| AI summary and dictation | None | AI credits (wallet) | Browser dictation stays client-side |
| Export | Personal data: audit trail, owner-only | Pro | Today a client-side CSV with no audit |
| Seeded businesses (first contact) | Do-not-contact register checked; email or SMS only; WhatsApp after they reply | Staff only | Not in V2 |
| Admin TeleCRM (Get4Domain's own leads) | Same Do-not-contact check for outbound | Staff roles | MARKETING currently sees prospect contact details here (question 2) |
| Team performance, scripts, segments, tasks | None | Pro | All four are absent today (INV-2): NEW |

### 7.3 Capabilities with no V2 module (NEW)

| Capability | V3 slice | Note |
|---|---|---|
| Customer list with consent, blocks and import attestation | 5.18a (Stage 10) | see 7.2 |
| V3 wallet with lots, one-year validity, no refunds | 5.16a (Stage 07) | the legacy wallet is not reused |
| Service catalog, price book, service requests, theme switch service | 5.16b-d (Stage 07) | `managed-services` carries the V2 rates only |
| Activity log, staff alerts, trust and safety, Vendor 360 | 5.20-5.22 (Stage 08) | V2 has `CommercialAuditLog` for billing only |
| Payment methods, pay pages, gateway adapters, receipts in the vendor's name | 5.17a-d (Stage 09) | |
| Senders with templates, campaigns, automations, Get4Domain's own campaigns | 5.18b-d (Stage 10) | |
| Vendor website chat and the directory assistant | 5.19 (Stage 11) | |
| Theme ZIP upload and Pro theme import | THEMES-CC-3 (Stage 12) | |
| Website manager APIs on the V3 renderer, act on behalf | 5.5, 5.13b (Stage 13) | |
| SEO manager and tasks, Google connections, reports and audit crawler | 5.8-5.10 (Stage 14) | |
| Domain automation and domain sales | 5.6c-d (Stage 15) | |
| Social share, promotion toolkit | 5.12 (Stage 16) | |
| Track modules (Jobs, Appointments, Store) | 5.24 (Stage 17) | |
| Do-not-contact register, Acceptable Use terms with recorded acceptance, Legal takedown state | Batch 3 and 6 | |
| Vendor-to-track-and-level migration tool | Stage 19 | |

## INV-8. The five clients

**What the repository can and cannot say.** The repo names these sites. It cannot say which are live Pro clients, what they pay, or what data they hold; that needs production. `docs/v3/OWNER_READONLY_QUERIES.sql` (written, **not run**) lists the clients, their plans, sites, domains, payments and data volumes (queries 1 to 8) and settles which modules are used (query 9). Query 1b finds the candidates below by subdomain and name; query 1c lists every vendor with an active paid term, which is the safe way to name the five.

### 8.1 Candidates named in the repo

| Client | Where in the repo | Industry and shape | Domain (from the repo) | Plan (from the repo) | Notes |
|---|---|---|---|---|---|
| Step N Rock | `stepnrock/` (port 3015); `docs/v2/STEPNROCK_HANDOVER.md`, `STEPNROCK_TRACE.md`; `backend-api/scripts/activate-stepnrock.js`, `fix-stepnrock-term.js` | Footwear shop; own Next.js app reading the vendor's products and site document; orders are **order requests** (customer details, shop calls and collects payment) | subdomain `stepnrock` | **Workspace**, half-yearly, total 599,400 paise (5,994 rupees), GST not charged: the agreed terms in `activate-stepnrock-lib.js` (a special arrangement; a half-yearly term is allowed by rule 3) | Order requests become `g4d_pos_sales` (source web) with a stock movement and a CRM lead; no online payment |
| Deebi Photography | `deebiphotography/` (port 3016, has a Netlify file and an nginx file) | Photography studio; own Next.js app, content read from the site document | subdomain not stated in the repo | not stated | Uses the photography module tables (shoots, deliverables) only if the vendor enters them |
| Allwin Tours | `allwin-tours/` (port 3010) | Travel agency; own Next.js app; contact form posts into the CRM | subdomain `allwintours` (no hyphen, `WEBSITE_MANAGER_PROGRESS.md` decision 3) | not stated | May use the travel module (trips, vehicles, contracts) |
| Indian Ambulance | `indianambulance/` (port 3017); `docs/v2/VENDOR_SITE_indianambulance.md` | Ambulance service; a **Bolt export** run as its own app with the vendor resolved from the subdomain; no forms, every enquiry is a `tel:` or `wa.me` link | subdomain `indianambulance` | not stated | Closest to the V3 pattern (static design, content from the backend) |
| MR Travels | `CLIENT_PROJECTS/TRAVEL/CLIENTS/MR_TRAVELS_001` (separate repo); `docs/LEGACY_MIGRATION_STATUS.md`; `backend-api/scripts/migrate-mrtravels.ts`, `mrtravels-content.ts` | Travel; legacy app on its own Supabase database (ports 3000 and 3001) | `mrtravels.get4domain.com` | none | The Aug 2026 status says the legacy database held only placeholder data and **it was never launched**; a parallel vendor site was built from the public page. It may not be a live client |
| (not a client) | `ksm-quantum/` (port 3014) | The parent company's own site | | | Listed so nobody counts it |

Ports and containers: `docs/v2/DEPLOYMENT.md` (one VM, one Docker Compose per app, nginx in front, manual deploy). `scripts/existing-clients/` is not on this base (the memory of "connected mode" refers to a branch outside `v3-b2`), so how each app reads the site document is **UNKNOWN here**.

### 8.2 What each client needs to move into V3

The same list applies to each client. The column "V3 target" is where the data goes; "Source" is the V2 table. Rows marked OWNER need a decision.

| Need | Source (V2) | V3 target | Notes |
|---|---|---|---|
| Vendor identity, status, industry, subdomain | `"Vendor"` | same row; V3 adds `V3VendorFlag`, `V3SiteSettings`, `V3Domain` | Rule 1: the subdomain stays mandatory and canonical |
| Category and track | `Vendor.industry` (20 values) | one of 41 categories, then Handyman, Professional or Ecommerce | The category map in the theme kit is an inference; each client needs a manual check |
| Site content | `"VendorCMS"` (draft, pages, layout, extras, `siteVersion`), `g4d_site_versions` | V3 publication snapshot (`V3SitePublication`, `V3SitePublicationPage`) built by the renderer | Content location differs by client: the five bespoke apps read it at run time; Indian Ambulance and the Bolt-style sites embed their design |
| Site design | the bespoke app (`stepnrock/`, `deebiphotography/`, `allwin-tours/`, `indianambulance/`) or a built-in theme | a V3 Pro theme (designed in Bolt, imported as a theme package) or kept as an "own site" | **OWNER**: a bespoke app is not a V3 theme; either Bolt re-designs each (cost) or V3 keeps serving the app until it is rebuilt |
| Pictures and files | `g4d_media_assets`, files in the `/app/uploads` volume | V3 media storage | The files live on the VM volume, not in the database; copy them |
| Domain | `Vendor.customDomain`, `g4d_domain_registrations` | `V3Domain` + verification + redirect; one canonical host (rule 1) | Custom domain only on Pro; canonical is the subdomain unless the promotion add-on is active. If a client uses a custom domain today without the add-on, the canonical flips to the subdomain: **OWNER** and an SEO redirect plan |
| Plan record | `g4d_billing_terms` (WORKSPACE or BOS, cycle, status, period), `"Subscription"` | `V3PlanSubscription` (track x level, term quarterly, half-yearly or annual) | Rule 3: no monthly term; consent and notice before any price change; prices from the approved book (none seeded). **OWNER**: which V3 level each client gets, and at what price |
| Payment records | `"Invoice"` (kind, status, paid), `g4d_platform_income`, `g4d_manual_payment_submissions` | stay as history in the legacy tables (read-only); V3 invoices start from the first V3 payment | D1: V3 never reads legacy billing; the history is kept, not migrated |
| Wallet balance | `g4d_wallets`, `g4d_wallet_transactions` | the V3 wallet is new (rule 7: no cash-out, no refunds, one-year validity) | **OWNER**: a legacy balance cannot be refunded or converted automatically; decide whether to credit it as a V3 top-up with a one-year life |
| Customers and leads | `g4d_contacts`, `g4d_campaign_leads`, `g4d_call_logs` | the customer list (INV-7.2) with consent NONE | Counts per client are in query 7; duplicates in query 10 |
| Accounts | `g4d_bos_*`, `g4d_generic_invoices`, `g4d_expenses`, `g4d_payment_records` | BOS data stays; surfaced by Batch 13 (5.23) | Hiding the old dashboard must not hide the books of a client who uses them: check query 7 |
| Orders and stock | `g4d_pos_sales`, `g4d_stock_movements`, `"VendorProduct"` | Store track module (5.24) | Step N Rock depends on this |
| Industry data | the module tables (INV-5.2) | hidden, kept | Run query 9 for each client before hiding anything |
| Team | `g4d_team_members` | V3 team with presets | Owner-only rules apply |
| Theme purchases | `g4d_theme_entitlements`, `g4d_vendor_template_unlock` | V3 theme purchase | Keep history |
| Add-ons | `g4d_vendor_addons` (`site_doc_v2`, `site_connected`, `leadspace`, `nav_v2`, `bos_custom`) | entitlements | Query 5b |

### 8.3 What blocks a move today

1. Free versus Pro behaviour (Batch 3) and the V3 wallet (Batch 4) are not built, so a client could not yet be given a V3 level that behaves as the rules say.
2. The five apps are bespoke designs; V3 has no Pro theme yet (INV-9).
3. The legacy-to-track migration tool does not exist (it is a Stage 19 deliverable).
4. The owner decisions in the table above (design, canonical host, price, wallet balance).

