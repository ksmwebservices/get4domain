# GET4DOMAIN v2.0 — CLAUDE MEMORY (MASTER)
# Read this FIRST in every Claude Code session.
# This supersedes the v1.0 CLAUDE_MEMORY.md for architecture decisions.
# Infrastructure/credentials/hard-rules sections still apply unchanged.

---

## PROJECT IDENTITY

Name: Get4Domain
Tagline: "Your Online Identity Partner"
Company: KSM Quantum Technologies
Owner: ksmwebtech
Domain: get4domain.com
Admin: admin@get4domain.com / ChangeMe123!
Address: Tidel Park, 1st Floor D Block, Tharamani, Chennai - 600113
Phone: +917550047567

---

## WHAT GET4DOMAIN IS (v2.0 POSITIONING)

Get4Domain is NOT a web hosting company, domain registrar, 
website builder, digital marketing agency, or CRM software company.

Get4Domain IS a complete online identity platform: build, manage, 
connect, promote, communicate, automate and grow a business's 
entire online identity from one platform.

UI/UX INSPIRATION: Stripe, Linear, Notion, HubSpot, Vercel, Framer.
Modern, minimal, premium, mobile-first, fast, simple, beautiful.
NOT ERP-style. NOT cluttered. NOT generic-looking.

---

## THE 10 MODULES

```
1. DomainApp          Industry-specific business workspace
2. Growth Hub          Campaigns, landing pages, social media
3. TeleCRM             Calls, leads, follow-ups
4. AI Studio           AI content generation (text + image)
5. Communication Hub   WhatsApp, SMS, Email — unified inbox
6. Website Manager     CMS engine + industry design templates
7. Customer Hub        Customer-facing portal
8. Analytics Hub       Cross-module reporting
9. Wallet & Billing    Payments, subscriptions, usage
10. Admin Platform     Get4Domain internal operations
```

---

## CRITICAL ARCHITECTURE PRINCIPLE (READ CAREFULLY)

```
BACKEND: Shared, generic, common engine
  ONE set of database tables (Contact, CatalogItem, Record, 
  Invoice) stores data for ALL 20 industries. This is an 
  engineering efficiency decision — invisible to the user.

FRONTEND: Industry-specific, NOT generic
  Each industry gets its OWN dashboard experience — own tab 
  set, own field set, own icons, own page flow, own wording.
  
  WRONG approach (do not do this):
    One <RecordsTable config={industryConfig}> component 
    reused everywhere with just labels swapped. This looks 
    cheap and generic to the end user.
  
  CORRECT approach:
    src/domainapp/travel/BookingsPage.tsx — travel-specific 
      layout, cards, flow, fields
    src/domainapp/restaurant/OrdersPage.tsx — restaurant- 
      specific layout, cards, flow, fields
    src/domainapp/clinic/AppointmentsPage.tsx — clinic-specific
    
    Each page composition is purpose-built per industry, but 
    all pull from the SAME shared UI component library (buttons, 
    cards, modals, inputs) for speed and consistency — and all 
    call the SAME backend endpoints (/domainapp/records, 
    /domainapp/contacts, /domainapp/catalog).

  ANALOGY: Shopify's admin looks/feels different for a 
  clothing store vs. a digital-downloads store. Same Shopify 
  engine underneath, tailored experience on top. That's the 
  target model here.

TAB COUNT AND NAMES GENUINELY DIFFER PER INDUSTRY:
  Travel dashboard: Bookings, Fleet, Drivers, Trip Sheets
  Restaurant dashboard: Orders, Tables, Menu, Kitchen Display
  Clinic dashboard: Appointments, Patients, Doctors, Prescriptions
  
  Fleet/Drivers don't exist for restaurant. Tables/Menu don't 
  exist for travel. Not just relabeled — genuinely different 
  tab sets, because that's what each business actually needs.

UNIVERSAL MODULES (same frontend for every industry, no variation):
  Growth Hub, TeleCRM, AI Studio, Communication Hub, 
  Website Manager (engine same, templates vary), Customer Hub, 
  Analytics Hub, Wallet & Billing — these work identically 
  regardless of industry, so build once, use everywhere.
```

---

## DOMAINAPP CORE DATA MODEL (shared backend)

```
Contact       — generic person/entity (Passenger/Patient/Guest/
                Customer/Student/Member — label varies by industry
                config, but same table)
CatalogItem   — generic sellable item (Package/Menu Item/Service/
                Product/Course/Room Type)
Record        — generic transaction/engagement (Booking/Order/
                Appointment/Enrollment/Reservation)
Invoice       — same structure for everyone, GST compliant

Basic Accounts (Income/Expenses/P&L/GST) — same for everyone.

DomainApp CORE is intentionally LIGHTWEIGHT:
  Just Contacts + Catalog + Records + Invoicing + Basic Accounts.
  NOT a full ERP. NOT fleet management. NOT HR. NOT payroll.
  Those are ADDONS (see below) — optional, billable, per-vendor.
```

---

## ADDON SYSTEM (custom per-client extensions)

```
Addons = optional modules a vendor can enable on top of core 
DomainApp. Billed separately. Toggle-able per vendor by admin.

Examples:
  fleet, driver, driver_outsourcing, hr_payroll, 
  table_management, appointment_scheduling, 
  inventory_management, batch_management, room_management,
  project_management, document_management

RULE: An addon adds extra tables + extra UI tab. It links to 
core Contacts/Catalog/Records — it NEVER duplicates core structure.

Example: Allwin Tours = Core DomainApp (travel industry) + 
Fleet addon + Driver Outsourcing addon (NOT a copy of MR 
Travels' full legacy system).
```

---

## MODULE TOGGLE SYSTEM

```
Just like addons, the 10 main modules (Growth Hub, TeleCRM, 
AI Studio, etc.) are toggle-able per vendor based on their plan:
  DomainCampaign plan → Growth Hub + TeleCRM + AI Studio active,
                         DomainApp core LOCKED
  DomainApp plan → DomainApp core + addons active,
                    Growth Hub/TeleCRM LOCKED
  Combo → everything active

ALL TABS ALWAYS VISIBLE IN SIDEBAR. Locked tabs show 🔒 icon,
clicking opens an upgrade modal instead of navigating. Never 
hide tabs — showing them (locked) drives upsell awareness.
```

---

## INDUSTRY CONFIG SYSTEM

```
Location: backend-api/src/config/industries/[key].ts
Registry: backend-api/src/config/industries/index.ts

Each industry = one config object defining:
  entities (contact/catalogItem/record labels)
  recordStatuses (workflow stages, with colors)
  recordCustomFields (extra fields specific to that industry)
  catalogCustomFields
  defaultAddons / availableAddons
  websiteTemplate key (for Website Manager)

ALL 20 INDUSTRIES (launch scope):
  travel, restaurant, clinic, hotel, salon, gym, realestate, 
  education, retail, construction, events, finance, automobile, 
  logistics, diagnostics, photography, professional, agriculture, 
  coaching, technology
  + general (fallback/default)

Adding a new industry = new config file (~30 min) + one new 
industry-specific frontend page set. NO new database tables, 
NO new generic API routes needed.
```

---

## RESELLER / BSP BUSINESS MODEL (Communication + Ads)

```
Get4Domain acts as the technical + billing intermediary for 
ALL communication and advertising channels. Vendors never 
directly manage Meta Business, Google Ads, WhatsApp BSP, SMS 
gateway, or email service accounts.

WhatsApp: Get4Domain is BSP via a partner (Interakt/AiSensy/
  Gupshup — confirmed: using a BSP partner, not direct Meta 
  BSP application). Vendor gets a sub-account, own number/
  display name shows to their customers.

SMS: Get4Domain has master MSG91/Kaleyra account. Vendor's 
  DLT-registered sender ID used per vendor.

Email: Get4Domain has master Resend account. Vendor gets 
  verified subdomain.

Social Media Posting: DIRECT API PUBLISHING (not manual 
  download/upload). Vendor connects FB/IG page once via OAuth 
  (Meta Developer App owned by Get4Domain). AI generates → 
  vendor approves → Get4Domain backend posts via Graph API 
  directly to vendor's page.

Paid Ads: Get4Domain runs campaigns from Get4Domain's own 
  Meta Business Manager / Google Ads MCC account. Get4Domain 
  pays Meta/Google upfront, then INVOICES vendor (ad spend + 
  15-20% management fee). Vendor's card is NEVER linked 
  directly to the ad platform.

BUILD STRATEGY — MOCK-FIRST (confirmed):
  Build full UI + database schema + wallet deduction logic NOW.
  Provider layer (whatsapp.service.ts, meta.service.ts, 
  google-ads.service.ts) starts as STUB/MOCK implementations.
  Swap to real API calls once BSP partnership + Meta App 
  Review + Google Ads API access are approved (external, 
  parallel-track business registrations — not blocking dev).

ADMIN CONFIGURATION: All API keys (Razorpay, Claude, OpenAI, 
  WhatsApp BSP, SMS gateway, Resend, Meta, Google Ads, VAPID) 
  are entered and stored via Admin Platform → Settings → 
  Integrations UI, encrypted at rest in g4d_platform_settings 
  table (AES-256-GCM), NOT hardcoded in .env only. Falls back 
  to .env if DB setting not yet configured (migration safety).
```

---

## MR TRAVELS — LEGACY STATUS (UPDATED 17 AUG 2026 — "never touch" REVOKED by KSM)

```
REVERSAL (17 Aug 2026, confirmed by KSM via LEGACY_MIGRATION dispatch):
The old "NEVER TOUCH MR Travels / ports 3000/3001" rule is REVOKED. MR Travels
is being migrated onto the new Get4Domain multi-tenant platform as a real vendor.
Safe because MR Travels was never launched to real customers (only test data).

STATUS: website content migrated onto the existing Get4Domain vendor
(admin@mrtravels.com, subdomain "mrtravels", owner Jayachandran) — VendorCMS +
7 VendorProducts + custom "Heritage Gold" travel theme. Live IN PARALLEL at
get4domain.com/site/mrtravels. See scripts/migrate-mrtravels.ts (idempotent) +
docs/LEGACY_MIGRATION_MRTRAVELS_CONTENT.md.

STILL GATED (hard stops until KSM approves after looking at the new site):
  • DNS/traffic cutover of mrtravels.get4domain.com off port 3000.
  • Deleting/stopping the legacy MR Travels or Allwin Tours containers/data.
The legacy operational BOS (bookings/fleet/quotations/invoicing/portals) does
NOT map to Get4Domain's lightweight core — cutover means losing it unless built
as addons. KSM decision. Reading the legacy DB directly is blocked by a Supabase
IP allow-list (VM-only) — migration content was read from the live public site.

All NEW clients still use the v2.0 DomainApp model, not a copy of MR Travels.
```

---

## WALLET & BILLING — TWO PAYMENT RAILS

```
RAIL 1 — WALLET (small, frequent, prepaid)
  Content generation, messaging (WhatsApp/SMS/Email), 
  publishing. Minimum top-up ₹999, 90-day validity.

RAIL 2 — INVOICE (large, periodic)
  DomainApp subscription (core + addons), ad spend + 
  management fee, setup fees. Razorpay invoice link, GST 
  invoice auto-generated.

Wallet rate card reflects REAL gateway costs + margin (not 
just content-creation cost) since Get4Domain resells 
WhatsApp/SMS/Email at scale.
```

---

## MODULE-BY-MODULE SPEC SUMMARY

### TeleCRM
3-panel layout (Queue / Lead Detail / Activity Timeline), 
Linear-style. Tap-to-call, voice-note → Claude auto-transcribe 
+ summarize (₹3/summary), Kanban pipeline view (New→Contacted→
Qualified→Quoted→Won/Lost), AI priority scoring, AI-drafted 
follow-up messages.

### AI Studio
Grid of content-type cards (Social Post, Reel Script, Blog, 
Festival Poster, Ad Creative, Email, WhatsApp Msg, SMS) → 
generation flow (form → wallet-cost preview → generate → 
edit/regenerate → save/download/publish) → searchable Library tab.

### Customer Hub
Part A: Customer Portal (external) — phone+OTP login, no 
password, mobile bottom nav (Home/Records/Invoices/Support), 
reuses Record/Invoice/Contact tables, labels auto-adapt per 
vendor's industry config.
Part B: Customer Hub settings (vendor-side) — portal on/off, 
send portal invites, customization.

### Analytics Hub
Cross-module reporting: revenue, leads funnel, campaign 
performance, wallet usage — pulled from existing tables, no 
industry variation.

### Website Manager
CMS engine (same for everyone) + visual design templates that 
vary per industry (websiteTemplate key in industry config). 
Vendor edits content; Get4Domain-designed templates handle layout.

---

## FRONTEND TOOLING DECISION

```
Claude Code handles BOTH backend AND frontend, end-to-end, 
in one continuous context. NOT using Bolt/v0 for this project 
— they generate isolated sandboxed output disconnected from 
the existing 79-page codebase, existing auth, existing API 
client, existing component library. Every industry page would 
need manual merge work, contradicting the "reuse, don't 
rebuild" principle. Bolt/v0 optional only for quick visual 
mockup exploration, never for production code in this repo.
```

---

## AUTONOMOUS EXECUTION MODE (how dispatches run)

```
Dispatches are written for continuous, unattended execution 
across multiple Claude Code sessions (2-4 hr session limits).

Every dispatch instructs Claude Code to:
1. Check docs/DISPATCH_PROGRESS.md before each task — skip 
   if already marked [x] DONE (verify via git log)
2. Complete task → run build check → commit → push → update 
   ledger → move to next task WITHOUT pausing for approval
3. If blocked on one task: mark [!] BLOCKED with reason, skip 
   to next independent task, keep working
4. Only fully stop when all tasks are DONE or BLOCKED
5. Summarize blockers at the end for human review

On session expiry: resume via `claude --resume <id>` OR fresh 
session + "read docs/DISPATCH_PROGRESS.md and continue from 
the first unchecked task."

Human review happens AFTER a dispatch phase completes (not 
mid-file) — test on VM, give feedback, approve next phase.
```

---

## HARD RULES (unchanged from v1.0, still absolute)

```
1. MR Travels migration is UNDERWAY (17 Aug 2026 — "never touch 3000/3001" revoked
   by KSM). Building in parallel is allowed; DNS cutover + deleting legacy
   containers/data remain HARD STOPS until KSM approves. See the MR Travels section above.
2. Prisma stays 6.19.3 — never upgrade
3. Supabase POOLER URL only (port 6543, not 5432 direct)
4. Backend Docker CMD: node dist/src/main
5. Never push .env.local to GitHub
6. Never put secret keys in NEXT_PUBLIC_* vars
7. All new tables use g4d_ prefix
8. /go/[slug] public campaign pages work WITHOUT auth
9. npm run build → 0 errors before every commit, no exceptions
10. Test MR Travels (curl localhost:3000) after every VM deployment
11. Never auto-post to social media without vendor approval first
12. Never hardcode vendor-specific data in shared/addon code — 
    always read from vendor config, industry config, or database
13. All data queries MUST filter by vendorId — no exceptions, 
    this is a multi-tenant platform
```

---

## LIVE INFRASTRUCTURE (reference)

```
VM: Google Cloud asia-south1-c, IP 34.14.130.68
SSH: ksmwebtechservices@34.14.130.68
GitHub: github.com/ksmwebservices/get4domain, branch get4domain-site
Frontend: port 3006 → get4domain.com
Backend: port 3008 → gapi.get4domain.com
Allwin Tours: port 3010 → allwintours.get4domain.com
MR Travels: ports 3000/3001 → mrtravels.get4domain.com (LEGACY)
Database: Supabase "get4domain" project, g4d_ prefix tables
```

---

## WHAT EXISTS TODAY (v1.0 foundation, before v2.0 dispatches run)

```
✓ get4domain.com marketing site (79 pages)
✓ Auth (JWT, roles), Vendor CRUD
✓ Wallet module (balance, topup, transactions, deduct)
✓ Campaign Pages module (generate, CRUD, public /go/:slug, leads)
✓ Basic Campaigns module, basic CRM/TeleCRM, Team module
✓ Notifications (Web Push/VAPID — real, working)
✓ AI module (Claude content gen, page gen, call summary — backend ready)
✓ Payments (Razorpay create/verify/webhook — working)
✓ Support tickets (with notifications)
✓ Admin dashboard (real data overview, vendor mgmt, API settings shell)
✓ Vendor dashboard (mobile bottom nav, wallet, CRM, campaigns wizard)
✓ Allwin Tours website (separate app, port 3010, 5 pages, logo, chatbot)
✓ MR Travels BOS — complete, legacy, untouched
✓ SEO (sitemap, robots, metadata, JSON-LD)

NONE of the v2.0 architecture (DomainApp core, industry configs, 
addon system, industry-specific dashboards, 10-module structure) 
has been built yet. Dispatch A is written and ready but not run.
```
