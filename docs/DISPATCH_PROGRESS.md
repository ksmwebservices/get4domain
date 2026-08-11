# GET4DOMAIN v2.0 — DISPATCH PROGRESS LEDGER
# Claude Code updates this file after EVERY task.
# On session resume, read this FIRST to know exactly where to continue.

Legend: [ ] not started · [~] in progress · [x] done · [!] blocked

---

## DISPATCH — GET4DOMAIN_DISPATCH_10AUG2026 (6 items, in progress)

### Item 1 — Fast2SMS wiring + TeleCRM db push (2a)
- [x] 1.1 `fast2sms` settings category (api_key/sender_id/dlt_entity_id/sms_message_id/
  wa_message_id) in platform-settings.constants → shows in Admin → Integrations,
  encrypted at rest, env fallback. Single central Get4Domain account.
- [x] 1.2 SmsService → real Fast2SMS API (bulkV2): `sendSms` (DLT route when
  sender+template set, else quick 'q' route) + `sendOtp` (Fast2SMS OTP route).
  Mock-first: logs + returns mock when api_key absent; try/catch never throws.
- [x] 1.3 WhatsappService → real Fast2SMS WhatsApp API (/dev/whatsapp via
  message template id). Mock fallback when key/template absent.
- [x] 1.4 Communication Hub per-vendor wallet debit — CommunicationService reads
  pricing rate (sms_message/whatsapp_message/email_message; getRate + fallback
  paise), pre-checks balance (throws INSUFFICIENT_WALLET_BALANCE), deducts ONLY
  on real (non-mock) sends. WalletModule imported.
- [x] 1.5 OtpModule — OtpService (6-digit, 5-min TTL, 30s resend cooldown, 5-attempt
  cap, in-memory store) + public POST /otp/request, /otp/verify. Foundation for
  Book-Demo Phase 1. Registered in AppModule.
- [x] 1.6 backend build 0 errors.
- [!] 2a TeleCRM `prisma db push` — VM-ONLY, cannot run from Claude Code (no SSH).
  HUMAN STEP on VM: `docker exec get4domain_backend npx prisma db push`
  (applies preferredDate/preferredSlot + the fast2sms rows need no schema change).
- [!] Fast2SMS ACCOUNT + ₹10k funding + DLT registration — external/human. Once
  done, enter the API key in Admin → Integrations → Fast2SMS; code goes live with
  zero further changes (mock→real automatically).
- NOTE: dispatch specifies Fast2SMS for BOTH SMS + WhatsApp; this SUPERSEDES the
  older CLAUDE_MEMORY_V2 "WhatsApp via BSP partner (Interakt/AiSensy)" note for now.
  Not integration-tested (no VM/live key from Claude Code) — build-verified only.

### Item 2b — TeleCRM UX overhaul (shared TeleCrmBoard.tsx)
- [x] List view removed entirely; Kanban is the only + default view. Removed the
  view toggle, QueueSection/LeadCard, and orphaned relativeContact/skip/setSkipped
  + LayoutList/Columns3/SkipForward imports (0 unused → build clean).
- [x] Scroll-gesture fix on the Kanban horizontal scroll container
  (overscroll-behavior-x: contain + touch-action: pan-x) so drag-scroll no longer
  fights the PWA nav / browser back-swipe on touch.
- [x] Mobile stage quick-nav (owner chose "Add stage quick-nav bar"): fixed
  lg:hidden bar at bottom-16 (above the shell's global bottom nav) with the 6
  stage chips + counts; tap snaps the board to that column (scrollIntoView,
  scroll-ml-2). Root padded pb-14 lg:pb-0 so content clears the bar.
- [x] No re-skin — colors/theme untouched, structural only.
- [x] frontend build 0 errors. NOTE: board is behind auth; build-verified, not
  click-tested from Claude Code (no login/VM). Mobile gesture behaviour should be
  spot-checked on a real device / DevTools touch emulation after deploy.

### Item 3 — Invoice generation full automation (dispatch #5)
- [x] Enhanced PDF template (invoice.template.ts): "TAX INVOICE", logo (logo_url
  or gradient), config-driven company (name/GSTIN/PAN/address/phone/email),
  billed-to vendor, line items w/ per-item Price + Discount + Amount, Subtotal +
  Discount total (when any) + Taxable + GST(18%) + Grand Total, payment mode,
  RENEWAL REMINDER note (next renewal date), T&C footer. Stored invoice totals
  stay authoritative; lineItems are the breakdown. Backward compatible.
- [x] Config-driven company details: new 'company' settings category (Admin →
  Integrations) so GSTIN/PAN/address/logo are set without redeploy (env fallback).
  Resolved in InvoicesService + PaymentsService.
- [x] Wallet top-up auto-invoice: WalletService.verifyTopup now calls
  InvoicesService.createPaidTopupInvoice — PAID GST invoice + email via Resend +
  platformIncome row. Best-effort (never undoes the credit). GST is back-calculated
  INCLUSIVE (taxable = paid/1.18) so invoice total == amount charged.
  ⚠️ ASSUMPTION TO CONFIRM: prices (₹6,999 / ₹999 top-ups) are treated as
  GST-INCLUSIVE. If they should be GST-EXCLUSIVE (customer pays price+18%), the
  back-calc + charged amounts must change — flag for finance.
- [x] Signup invoice: subscription payment already auto-emails via
  PaymentsService.finalizePayment; now also passes company + renewal note.
  (Self-serve ₹6,999 signup that CREATES the subscription+invoice is Book-Demo
  Phase 5 / item 6 — this makes the invoice side ready.)
- [x] Vendor Invoices tab rewritten from hardcoded mock (old ₹24,999/₹29,999) to
  REAL data (getVendorInvoices) with a working Download (fetch /invoices/:id/pdf
  → print-to-PDF window). Added api.getInvoicePdf. Mobile-friendly rows.
- [x] backend + frontend build 0 errors. No new DB migration (uses existing
  Invoice + PlatformSetting tables). Not live-tested (no VM/Razorpay from Claude
  Code) — build-verified; the topup→invoice path needs a real top-up to confirm.

### Item 4 — AI Studio video/reel generation (dispatch #4)
Owner chose BOTH providers (admin-selectable). Runway ML and HeyGen keys already
existed in the `video` settings category.
- [x] Backend `video` module (mock-first, provider-abstracted): VideoService
  picks the active provider (runway if runway_api_key set, else heygen, else
  none=mock). Async model: POST /video/generate returns {jobId, provider, status,
  mock}; GET /video/status?provider&jobId polls until done/failed. GET
  /video/provider returns {provider, cost}.
- [x] Wallet: deducts `video_generation` rate (pricing category, ₹50 fallback) on
  successful submit; pre-checks balance; INTERNAL admin staff free (same
  isInternalStaff bypass as AI Studio). Mock mode charges nothing + returns a
  sample clip so the full UX is demonstrable pre-keys.
- [x] Real API calls implemented to documented shapes — Runway
  (image_to_video/tasks) + HeyGen (v2 generate / v1 video_status). ⚠️ NOT
  live-tested from Claude Code; verify request/response once real keys added.
  Everything degrades to MOCK when unkeyed (never throws).
- [x] Frontend AI Studio: new "Reel / Video" card → modal fetches active provider
  and shows the matching input (Runway=visual prompt, HeyGen=script), wallet-cost
  preview (Free for internal), Generate → polls every 4s → renders <video> +
  download. Graceful "not configured" state. Registered VideoModule in AppModule.
- [x] backend + frontend build 0 errors. No new DB migration. Behind auth →
  build-verified, not click-tested from Claude Code.
- NOTE (deduction timing): charged on submit, not on completion; a later provider
  failure won't auto-refund — acceptable for now, revisit if needed.

### Item 5 — Book-Demo Phase 1 (dispatch #3, Phase 1)
Minimal OTP-gated entry that replaces the old segmented "what matters most" form.
- [x] Backend: Lead gains `source` column (schema). New public POST /leads/demo
  (VerifyDemoLeadDto: name/phone/industry/code) → verifies OTP via OtpService
  (item 1) then create/updates a lead with source="demo", status="verified"
  (retention safety net; TeleCRM works it). LeadsModule imports OtpModule.
- [x] OTP dev affordance: OtpService.request returns `devCode` ONLY when SMS is
  unconfigured (mock) AND env OTP_DEV_ECHO=true — lets the owner test the funnel
  before Fast2SMS is live. Off by default; never echoes once a key is set.
- [x] Frontend: book-demo rewritten to Phase 1 — Industry → Name+Mobile (Send
  Code → /otp/request) → OTP verify (/leads/demo) → verified success screen with
  a "Start Demo Tour" CTA (disabled; wired in Phase 4/item 6). Stepper, mobile-
  first, resend + change-number. Shows the dev code inline when echoed.
- [x] Verified render at localhost:3020/book-demo (step 1 correct, no console
  errors). OTP send/verify needs the backend+Fast2SMS (or OTP_DEV_ECHO) to test
  end-to-end — not runnable from Claude Code (no VM/DB).
- [x] backend + frontend build 0 errors.
- [!] VM: the pending `prisma db push` now also adds Lead.source (alongside
  preferredDate/preferredSlot from the last deploy). Same single db push applies all.

#### OTP flow fixes (follow-up on item 5)
- [x] Fix 1 — SmsService.sendOtp switched from the Smart-OTP path (route=otp on
  bulkV2, which behaves like /dev/otp/send and 996s until "website verification")
  to the PLAIN OTP route on `https://www.fast2sms.com/dev/bulk` (route=otp,
  variables_values=<our generated code>). No DLT, no website verification. Generic
  SMS stays on bulkV2. `call()` now takes an endpoint param.
- [x] Fix 2 — Book-Demo phone normalization: strips +91 / leading 0 / spaces /
  dashes / brackets to a clean 10-digit number; validates EXACTLY 10 before
  allowing OTP send; the normalized number is what's sent to /otp/request and
  /leads/demo. Backend SmsService.normalize + OtpService.key already slice to the
  last 10, so both ends agree.
- [x] Verified normalization + the built OTP URL for 7 input formats (all → clean
  10-digit; short input rejected); both apps build 0 errors.
- [!] REAL SMS DELIVERY not testable from Claude Code (no Fast2SMS key, can't
  receive SMS). Owner must confirm on the VM once the key is set — see repo notes.

### Item 6 — Book-Demo Phases 2–6 (dispatch #3)
Owner decisions: sandbox = REAL Vendor with isSandbox flag (converts to live on
pay); THIS SESSION = Phase 2 + 3; Phases 5–6 DEFERRED. Phase 2 reuses existing
MarketingBottomNav + ChatBot + item 1 Fast2SMS WhatsApp (no parallel versions).

- [x] Phase 2 — Industry website SPA. Backend `demo` module: GET /demo/site/:industry
  (public) returns {label, entities, content}. Frontend /demo/[industry] renders a
  full config-driven sample business site (hero/tagline, services from demo content
  with prices, testimonials, WhatsApp enquiry) with its OWN chrome (outside the
  marketing layout). Reuses <ChatBot/> + <MarketingBottomNav/>. Public POST
  /demo/enquiry logs a lead + sends a WhatsApp confirmation via item 1's Fast2SMS
  (mock until keyed).
- [x] Phase 3 — Per-industry seed data. demo-content.ts: believable content for all
  20 industries (+ config-derived fallback). DemoService.seedVendor(vendorId,
  industry) populates a vendor with catalog items, 5 contacts, 6 records (spread
  across the industry's statuses/dates), and 2 invoices (1 paid/1 pending), in a
  transaction. Admin POST /demo/seed to run it; designed to be called by Phase 4
  sandbox provisioning.
- [x] backend + frontend build 0 errors. /demo/[industry] is backend-data-driven →
  build-verified (needs the API running to render real content).
- [ ] Phase 4 — Interactive tour + sandbox provisioning (Vendor.isSandbox + expiry,
  seed via DemoService, route lead through site→vendor dashboard→customer portal).
  NEXT SESSION.
- [~] Phases 5–6 — Buy-now (Razorpay ₹6,999 → convert sandbox to live) + auto
  activation. DEFERRED per owner (handle when live-payment testing is possible).
- NOTE (Phase 4 will need a migration): Vendor.isSandbox + expiresAt columns.

---

## STAGE 1 — BACKEND FOUNDATION (Dispatch A)

- [x] A1. DomainApp core schema (Contact, CatalogItem, Record, GenericInvoice) — 5e4852d
- [x] A2. VendorAddon + VendorModule + PlatformSetting schema — 5e4852d
- [x] A3. Industry config types + all 20 industry config files + general fallback — 7bf7b79
- [x] A4. Industry config registry + GET /industries endpoints — 7bf7b79
- [x] A5. Generic DomainApp backend module (contacts/catalog/records/invoices CRUD + summary) — d7fcc6f
- [x] A6. Addon & module toggle system + endpoints — a294222
- [x] A7. Admin encrypted platform settings module + endpoints — 9cccede
- [x] A8. npm run build (backend-api) 0 errors — verified across all commits
- [x] A9. Report: VM migration commands + new env vars — see "STAGE 1 VM REPORT" below

## STAGE 2 — FRONTEND DESIGN SYSTEM (Dispatch B1)

- [x] B1.1. Design tokens — existing tailwind tokens already match Stripe/Linear/Notion (primary #2563eb = the blue-600 option, slate neutrals, Inter, rounded-2xl cards, subtle shadows). Kept blue-600 (not indigo) to avoid a risky global swap across 79 pages; "reuse don't rebuild". — fa0cb73
- [x] B1.2. UI primitives added (reused Button/Modal): Card, StatCard, Badge, Input/Textarea/Select, DataTable, LockedBadge, Icon (dynamic lucide by name) — fa0cb73
- [x] B1.3. Config-driven dashboard shell — fetches GET /modules/vendor, /addons/vendor, /industries/:key via useDashboardConfig (session-cached); sections: Overview, industry DomainApp tabs, Grow, Manage, Account — fa0cb73
- [x] B1.4. Locked tab system + UpgradeModal (wallet vs plan CTA) — fa0cb73
- [x] B1.5. Dynamic mobile bottom nav (Home + top active modules + More) — fa0cb73
- [x] B1.6. Naming migration in shell (Growth Hub, TeleCRM, AI Studio, Communication Hub, Website Manager, Analytics Hub, Wallet & Billing). NOTE: deeper per-page label copy + admin "Admin Platform" chrome refined in later stages. — fa0cb73
- [x] B1.7. npm run build (frontend) 0 errors, commit fa0cb73, pushed

## STAGE 3 — INDUSTRY-SPECIFIC DASHBOARDS (Dispatch B2-B5, 5 industries each)

ARCHITECTURE NOTE (Stage 3): Implemented as config-driven shared views rendered
through ONE dynamic route (src/app/dashboard/domain-app/[tab]/page.tsx) instead of
90 near-duplicate per-industry files. Each industry's distinct experience (tab set,
entity labels, record statuses+colors, custom fields, icons, tailored empty states)
comes from its backend industry config — the "Shopify model" from CLAUDE_MEMORY_V2.
This satisfies the dispatch's own rule ("call the SAME endpoints — only rendered
fields/labels/icons differ") and the "reuse, don't rebuild" hard rule. Shared views
in src/domainapp/shared/: RecordsView (list + status filter + create/edit + detail
drawer + status change + generate-invoice), ContactsView, CatalogView, InvoicingView
(create/PDF/pay-link/mark-paid), ComingSoon (addon/peripheral stub). Tab→view
resolver in src/domainapp/tab-registry.ts. All 20 industries covered by this one
implementation. FOLLOW-UP (noted): addon workspaces (fleet/drivers/tables/etc.) and
peripheral tabs (doctors/stylists/kitchen/prescriptions/reports) render a Coming
Soon stub until their addon backends are built.

### Batch 1 (B2): Travel, Restaurant, Clinic, Hotel, Salon
- [x] B2.1–B2.5 covered by config-driven dynamic route (all 5 industries) — b6e2d08
- [x] B2.6 npm run build 0 errors, commit b6e2d08, pushed

### Batch 2 (B3): Gym, Real Estate, Education, Retail, Construction
- [x] B3.1–B3.5 covered by config-driven dynamic route — b6e2d08
- [x] B3.6 build 0 errors, pushed

### Batch 3 (B4): Events, Finance, Automobile, Logistics, Diagnostics
- [x] B4.1–B4.5 covered by config-driven dynamic route — b6e2d08
- [x] B4.6 build 0 errors, pushed

### Batch 4 (B5): Photography, Professional, Agriculture, Coaching, Technology
- [x] B5.1–B5.5 covered by config-driven dynamic route — b6e2d08
- [x] B5.6 build 0 errors, pushed

## STAGE 4 — UNIVERSAL MODULES (Dispatch C, D, E)

### Dispatch C — TeleCRM + AI Studio
- [x] C1. TeleCRM 3-panel layout (Queue/Detail/Activity) — 8bc8d84
- [x] C2. Call flow modal + voice-note (Web Speech API) → AI summary (/ai/call-summary, ₹3) — 8bc8d84
- [x] C3. Pipeline Kanban view (drag-drop status change) — 8bc8d84
- [x] C4. AI Studio content-type grid + generation flow — efef5eb
- [x] C5. AI Studio Library tab (localStorage-backed) — efef5eb
- [x] C6. build 0 errors, committed, pushed (AI Studio portion)

### Dispatch D — Growth Hub (refactor existing Campaign module)
- [x] D1. Growth Hub rename + Campaigns/Ads tab switcher on /dashboard/campaigns — 44e0adf
- [x] D2. Social publish buttons (Facebook/Instagram) in review step → POST /growth-hub/publish (mock Meta) — 44e0adf
- [x] D3. Paid-ads request flow (form + AI creative + submit Pending Review + list) → /growth-hub/ads — 44e0adf
- [x] D4. build 0 errors, committed, pushed

### Dispatch E — Customer Hub + Communication Hub (mock layer)
- [x] E1. Customer Portal at /customer (mock OTP login, Records, Invoices, Support, mobile bottom nav) — backend 2c62c01, frontend 2419d64
- [x] E2. Customer Hub vendor-side settings tab (/dashboard/customer-hub: portal on/off, URL copy, send invites) — 2419d64
- [x] E3. Communication Hub unified inbox (/dashboard/communication: WhatsApp/Email/SMS, threads, compose; email real via Resend) — backend 2c62c01, frontend 2419d64
- [x] E4. Mock service layer: whatsapp/sms/meta/google-ads services (real-gateway swap-ready, read keys via platform-settings) — 3278e8a
- [x] E5. build 0 errors, committed, pushed. NOTE: customer portal sessions are in-memory opaque tokens (mock); swap for persisted/JWT when going live.

## STAGE 5 — PLATFORM POLISH (Dispatch F, G)

### Dispatch F — Analytics Hub + Website Manager
- [x] F1. Analytics Hub — revenue-by-month, lead funnel, wallet-by-service, campaigns (CSS/SVG charts, no new lib) — 9aed01a
- [x] F2. Website Manager — tabbed CMS (Basic/About&Social/SEO/Services/Template) extending VendorCMS + VendorProducts — 9aed01a
- [x] F3. Industry template mapping (websiteTemplate key → preview/label; default fallback noted) — 9aed01a
- [x] F4. build 0 errors, committed, pushed. FOLLOW-UP: hero/gallery/testimonials editing needs new VendorCMS JSON fields (schema change) — deferred.

### Dispatch G — Admin Platform rebuild
- [x] G1. Integrations UI (/admin/api-settings) consuming /platform-settings — masked values, per-field save, Test button — d17ed21
- [x] G2. Vendor Access module/addon toggle UI per vendor (/admin/vendor-access) — d17ed21
- [x] G3. Vendor onboarding (industry picker from GET /industries + default addon/module seeding) — d17ed21
- [x] G4. build 0 errors, committed, pushed. Admin chrome renamed to "Admin Platform"; nav "API Settings"→"Integrations" + "Vendor Access" added.

## STAGE 6 — MOBILE/PWA POLISH (Dispatch H)

- [x] H1. PWA manifest audit — get4domain_mvp manifest.ts (name/theme #2563eb/icons/start_url) verified; allwin-tours public/manifest.json verified healthy — b3f37df
- [x] H2. Offline support — sw.js network-first navigations + /offline fallback page precached — b3f37df
- [x] H3. Install prompt (beforeinstallprompt banner) mounted in dashboard — b3f37df
- [x] H4. Push wiring — vendor dashboard now registers Web Push (VAPID, userType VENDOR), reusing existing impl (admin already did) — b3f37df
- [x] H5. build 0 errors, committed, pushed

## STAGE 7 — INTEGRATION & DEPLOY (Dispatch I)

- [x] I7. DEPLOYMENT REPORT + SMOKE TEST CHECKLIST produced — docs/DEPLOYMENT_REPORT_V2.md
- [!] I1. Full VM deployment — REQUIRES VM ACCESS (human). Steps in DEPLOYMENT_REPORT_V2.md §1-§4.
- [!] I2. Migration run — REQUIRES DB/VM ACCESS (human). Generate migration then `migrate deploy` (report §3). Claude Code has no DB access to safely generate the migration file.
- [!] I3. Smoke test end-to-end — REQUIRES running VM (human). Checklist in report.
- [!] I4. Verify MR Travels (3000/3001) — REQUIRES VM (human). curl in report §5.
- [!] I5. Verify Allwin Tours (3010) — REQUIRES VM (human). curl in report §5.
- [!] I6. Cloudflare cache purge — REQUIRES Cloudflare access (human). Report §6.
  NOTE: I1-I6 are inherently VM/DB/Cloudflare operations outside Claude Code's reach —
  this is the expected Stage 7 hand-off ("produces a DEPLOYMENT REPORT for the human to execute").

---

## POST-DEPLOY BUGFIXES (not part of the original 7 stages)

### PD-BUG-1 — Invoice "Send Payment Link" 500 (admin + vendor) — 23da856
- [x] Root cause: PaymentsService.generatePaymentLink called the Razorpay SDK
  with no error handling. The SDK rejects with a plain object
  `{ statusCode, error: { description, code } }` — NOT an Error — so
  HttpExceptionFilter's `instanceof Error` branch dropped the message + stack,
  leaving only a bare `POST /invoices/.../send-payment-link` log line and an
  opaque 500 to the client.
- [x] HttpExceptionFilter now logs full detail for any thrown value (Error,
  plain object via JSON, or primitive) and extracts a useful client message
  from SDK-style error objects.
- [x] generatePaymentLink: fail-fast when Razorpay keys missing/placeholder;
  wrap the SDK call and rethrow the real description as 502; unique reference_id
  (`${invoiceId}-${Date.now()}`) so re-sends no longer collide.
- [x] Cleared "Duplicate DTO detected: CreateInvoiceDto" warning — renamed
  domainapp `CreateInvoiceDto` → `CreateGenericInvoiceDto` (two classes shared
  a name with different schemas).
- [x] backend-api build 0 errors.

### PD-BUG-2 — Admin Platform unusable on mobile PWA — 98c9d54
- [x] Admin layout had only a header hamburger (no mobile bottom nav, no
  bottom padding), so Sign Out at the very bottom of the drawer was effectively
  unreachable on phones. Brought admin to parity with the vendor dashboard's
  mobile treatment: fixed mobile bottom nav (Overview/Bookings/Invoices + More)
  under lg, "More" opens the off-canvas drawer where Sign Out sits below the
  scroll area; `<main>` padded pb-24 on mobile to clear the nav.
- [x] frontend build 0 errors.

---

## POST-DEPLOY ADDITION — ADMIN INTERNAL-TEAM TOOLING (not part of Stages 1-7)

Turns the Admin Platform into the working tool for Get4Domain's OWN team
(SUPER_ADMIN / MARKETING / OPERATIONS), alongside the existing platform-mgmt.

- [x] Task 1 — Admin team roles + invite flow — a71f4fd
  - AdminRole enum + AdminTeamMember model (g4d_admin_team_members).
  - Internal staff authenticate as `admin_member` JWT principals; token carries
    adminRole + kind. admin@get4domain.com (Vendor SUPER_ADMIN) = SUPER_ADMIN.
  - admin-team module: invite/list/update/remove (Super Admin) + public
    accept-invite. /admin/team page + public /admin-team/accept-invite page.
- [x] Task 2 — Role-gated Admin sidebar (locked-tab pattern) — 06be4cd
  - nav items carry a `roles` set; out-of-role tabs render locked and open
    AdminAccessModal ("contact your Super Admin"); direct URLs redirect to the
    member's first allowed tab. AI Studio mounted at /admin/ai-studio (reuse).
  - Visibility: MKT→TeleCRM/AI Studio/Send Quote; OPS→Invoices/Support/Renewals/
    Website CMS; SUPER→everything else incl. Team.
- [x] Task 3 — TeleCRM for admin over g4d_leads — aefa31c
  - TeleCRM UI extracted to components/telecrm/TeleCrmBoard.tsx (adapter-driven);
    vendor page is now a thin wrapper. /admin/telecrm points the same board at
    demo-booking leads. Lead gains notes/assignedTo/followUpDate + LeadCallLog.
- [x] Task 4 — Send Quote — 3f00973
  - /admin/send-quote: vendor-or-prospect, quote type/amount/notes, optional AI
    copy, Email/WhatsApp/SMS via Communication Hub; quotes logged with status
    chip (sent→viewed→accepted). Quote model (g4d_quotes), amount in paise.
- [x] Both apps build 0 errors after every task.

### VM MIGRATION for this addition (run after merge, same flow as Stage 1)
New enum: AdminRole (SUPER_ADMIN/MARKETING/OPERATIONS)
New tables: g4d_admin_team_members, g4d_lead_call_logs, g4d_quotes
Altered table: g4d_leads (+ notes, assignedTo, followUpDate)
  cd backend-api && npx prisma migrate dev --name v2_admin_internal_team   # local/--create-only
  # commit prisma/migrations/*, then on VM:
  cd backend-api && npx prisma migrate deploy && npx prisma generate
NOTE (backend hardening follow-up): new /admin/crm and /admin/quotes endpoints
use AdminGuard (any admin principal); per-role enforcement is currently in the
UI locked-tab layer. Add a MARKETING/OPERATIONS guard on these routes when
tightening. AI quote-copy deducts the caller's wallet, so it is best-effort for
admin_member staff without a wallet (message stays hand-editable).

---

## POST-DEPLOY ADDITION — MARKETING PAGES v2.0 REDESIGN (DISPATCH_MARKETING_PAGES.md)

Complete redesign of all public marketing pages to the v2.0 product vision
(Stripe/Linear-inspired), correct pricing/products, mobile bottom nav, full SEO.

- [x] Task 1 — Design system: reused existing tailwind tokens (primary=blue-600,
  slate neutrals) + spec spacing/components; no token file needed.
- [x] Task 2 — Header (e61d657): fixed the 250px-logo bug (now h-10/h-12 w-auto),
  Products dropdown + Industries/Pricing/Contact, Login + Book a Demo; removed the
  mobile hamburger (bottom nav handles mobile). Sticky, blur, shadow-on-scroll.
- [x] Task 3 — Footer (e61d657): dark 4-column (Brand/Platform/Company/Legal),
  correct contact, "Made in India | GST Compliant" bar.
- [x] Task 4 — Mobile bottom nav: verified (Home/Products/Industries/Demo/Chat;
  Chat opens chatbot inline; floating launcher hidden on mobile, desktop unchanged).
- [x] Task 5 — Home (e61d657): full rewrite — hero + dashboard mockup, trust bar,
  10-module showcase, two-product comparison (correct pricing), industries grid,
  3-step how-it-works, testimonials, FAQ (+schema), dark CTA.
- [x] Task 6 — Pricing (6512a7a): DomainApp Startup ₹6,999/yr & Enterprise
  ₹24,999/yr; DomainCampaign wallet (top-ups, free-included, usage rates) + Combo;
  6 FAQs w/ FAQPage schema.
- [x] Task 7 — DomainApp (6512a7a): workspace framing, 20-industry strip, plans,
  addons, People-Also-Ask FAQ.
- [x] Task 8 — DomainCampaign (6512a7a): 5-step flow, channels, wallet rate card, FAQ.
- [x] Task 9 — Industries list (6512a7a): all 20 with "Records become X, Contacts
  become Y"; shared data in data/industries-list.ts.
- [x] Task 10 — Industry [id] pages (6512a7a): kept the working rich per-industry
  pages (SEO + preview + book-demo) and added a v2.0 workspace-labels strip.
- [x] Task 11 — Other pages (627b56b): book-demo options updated to wallet model
  (already POSTs to /leads); site.ts contact corrected. contact/support/about/
  login/legal already had correct v2.0 info; login already links to Book a Demo.
- [x] Task 12 — SEO (e61d657): root metadata/keywords/OG refreshed; SoftwareApplication
  JSON-LD → AggregateOffer (₹999–₹24999); robots +/customer/; reusable Faq component
  emits FAQPage schema on home/pricing/domain-app/domain-campaign (AEO); sitemap
  verified 32 URLs (12 static + 20 industries); per-page titles + canonicals set.
- [~] Task 13 — Website CMS extension (hero/testimonials/product copy editable from
  admin): FOLLOW-UP as the dispatch itself specifies. Marketing content stays
  hardcoded in the pages for now.
- [x] Task 14 — Verified: build 0 errors; robots.txt + sitemap.xml (32 URLs) correct;
  key routes (/,/pricing,/domain-app,/domain-campaign,/industries,/industries/travel,
  /book-demo,/contact,/about,/support,/login) all 200; FAQPage + AggregateOffer JSON-LD
  present; no console errors; mobile 390px shows header (no hamburger) + bottom nav +
  hidden floating chat launcher.

NOTE: old v1.0 marketing components (Hero, TrustBar, ProductsOverview, FAQ, etc.)
remain in src/components but are now unused by the rewritten pages — safe to prune
in a later cleanup.

---

## POST-DEPLOY ADDITION — UX OVERHAUL (DISPATCH_FIX_UX.md, Sections A-J)

Business model change: ONE product — DomainApp ₹6,999/year, everything included
(campaigns + AI Studio are inside it; DomainCampaign is no longer separate).

- [x] A — Single-product pricing everywhere (b976183): home one-plan card + hero
  stat "₹6,999/year"; pricing page (includes groups + wallet + custom domain +
  6 FAQs); domain-app single plan; domain-campaign reframed "Campaign Features —
  included in DomainApp"; header dropdown → feature categories; footer; root SEO
  title + Offer JSON-LD single ₹6,999.
- [x] B — TeleCRM overhaul (f1ceb4d): click-to-call (pre-call screen →
  tel:_self), Page Visibility return-feedback, bottom-sheet feedback with large
  one-tap outcomes + follow-up quick-select + AI summary, Save & Call Next
  auto-advance, List/Kanban. Shared board → vendor + admin both benefit.
- [x] C — AI Studio (5488d2d): wallet balance chip + Top Up, cost-on-button
  (already present), graceful config/low-wallet/transient states (no dead ends).
  PARTIAL: extra content-type cards (letterhead/ID card/visiting card/presentation)
  and real image/PDF rendering deferred — existing 8 text/image types retained.
- [~] D — Vendor dashboard: D3 comm-hub Coming Soon (f8b3a07) [x]; D4 BottomSheet
  component (b156246) [x] created (migrating every existing form to it is a
  follow-up). D1 overview redesign and D2 exact 5-tab bottom-sheet mobile nav
  NOT done — existing overview + dynamic bottom nav retained. [deferred]
- [~] E — Admin: E2 Pricing Manager (b156246) [x] /admin/pricing writing to new
  g4d_platform_settings "pricing" category; E3 (b156246) [x] Video (Runway/HeyGen)
  + Domain (ResellerClub) categories added to Integrations catalog. E1 admin
  overview real-data redesign NOT done — existing overview retained. [deferred]
- [x] F — Logo already h-10/h-12 (fixed earlier), marketing bottom nav + chatbot
  Chat tab verified, book-demo form POSTs /leads with 20-industry dropdown.
- [x] G — Domain Management (b156246): /dashboard/domain-management 3 tabs
  (My Domain / Buy [coming soon] / Connect w/ DNS + verify), in Manage nav.
- [x] H — Build both apps 0 errors; all routes 200 (marketing + dashboard +
  admin); pricing shows single ₹6,999 plan; robots 7-disallow + sitemap 32 URLs;
  390px mobile verified.
- [x] I — Campaign flow (703eee6): channel set + costs to single-product model;
  Coming Soon badges on unconfigured channels (social/WhatsApp/SMS).
- [x] J — Marketing audit (703eee6): about single-product; book-demo options
  Website/Campaigns/Both; refund policy "₹999 AI Studio credit non-refundable
  after use"; industry [id] pages show ₹6,999/year.

VM MIGRATION for this dispatch: none new beyond prior dispatches — the "pricing"
platform-settings category stores rows in the existing g4d_platform_settings
table (no schema change). Backend wallet-deduction reading live pricing rows
(vs. hardcoded defaults) is a noted follow-up.

DEFERRED — NOW RESOLVED (cc9d504): D1 vendor overview redesign, D2 exact 5-tab
mobile nav (vendor Home/Business/Campaign/AI/More + admin Overview/TeleCRM/AI/
Work/More with BottomSheet menus), E1 admin overview real-data redesign,
BottomSheet applied (shared Modal docks on mobile + CRM/Team/Campaign overlays),
Item 5 wallet deduction reads g4d_platform_settings "pricing" via
WalletService.getRate (fallback to defaults), Item 6 AI Studio document
generators (Letterhead/ID Card/Visiting Card via print-to-PDF). Presentation
generator noted as future follow-up. Both apps build 0 errors; routes 200.

---

## POST-DEPLOY ADDITION — BOOKING DEMO REVAMP + ADMIN AI STUDIO FREE (owner request)

Owner asks: (1) admin AI Studio must NOT require wallet/credit; (2) the demo
chat/booking wrongly showed the retired 2-product + old pricing; (3) enhance
Book-a-Demo (slot picker, multi-step wizard, industry-aware, mobile) and improve
booking UI in both admin + vendor dashboards.

- [x] Admin AI Studio free — backend skips wallet deduct for internal staff
  (AiService.generateContent/callSummary take `internal` flag; AiController
  computes it via `isInternalStaff` = has adminRole || kind==='admin_member').
  Frontend AI Studio (shared page) hides wallet chip/Top-Up/₹ costs and shows a
  "Free for internal team" badge when user.role is admin/super_admin.
- [x] Marketing chatbot pricing fixed — MARKETING_PROMPT rewritten to the single
  DomainApp ₹6,999/year (everything included) model; removed DomainCampaign +
  ₹3,999/₹13,999/₹24,999/₹29,999. ChatBot quick-reply "What is DomainCampaign?"
  → "What's included?".
- [x] Book-a-Demo redesign (marketing) — 4-step wizard (Goal+Industry → Details →
  Date/Time slot → Confirm) with stepper, industry-aware copy, mobile-first slot
  picker (next 8 working days + 6 time slots), review screen. Interest options
  reframed as goals within the ONE product (no plan/pricing framing). Success
  screen echoes the chosen slot.
- [x] Admin Demo Bookings (/admin/leads) shows the preferred date/time slot.
- [x] Vendor Records/booking view (domainapp shared RecordsView) gains a booking
  overview strip (total, top-2 status counts, pending value) via /domainapp/summary.
- [x] Both apps build 0 errors. Book-demo route compiles + renders (verified step 0
  in preview, no console errors; full click-through not done — preview pane not
  displayable this session).
- [~] TeleCRM board detail panel does NOT yet show preferredSlot (shared component;
  deferred — Demo Bookings page covers the admin need).

VM MIGRATION for this addition (Lead gains 2 columns):
  New nullable columns on g4d_leads: preferredDate (DateTime?), preferredSlot (String?)
  cd backend-api && npx prisma migrate dev --name v2_lead_preferred_slot   # --create-only
  # commit prisma/migrations/*, then on VM: npx prisma migrate deploy && npx prisma generate
  Until migrated, Book-a-Demo still submits (preferred slot is optional); the
  columns just won't persist on the old schema.

---

## BLOCKERS LOG (append here whenever [!] is used above)

- [resolved] GIT COMMIT/PUSH temporarily blocked (2026-08-09) by the auto-mode
  classifier mid-session; user adjusted permissions and all Stage 1 commits
  (A6=a294222, A7=9cccede) landed. No outstanding git blocker.

---

## STAGE 1 VM REPORT (for human to run on VM after merge)

New env var to add to backend-api/.env.local (VM):
  PLATFORM_SETTINGS_KEY=<64-char hex>   # generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

Prisma migration (run locally to generate the file, then deploy on VM):
  # local (dev machine, against a dev/staging DB or with --create-only):
  cd backend-api && npx prisma migrate dev --name v2_domainapp_core_foundation
  # commit the generated prisma/migrations/* folder, then on VM:
  cd backend-api && npx prisma migrate deploy && npx prisma generate

New tables introduced this stage (all g4d_ prefixed):
  g4d_contacts, g4d_catalog_items, g4d_records, g4d_generic_invoices,
  g4d_vendor_addons, g4d_vendor_modules, g4d_platform_settings
  (+ Vendor.industry now defaults to "general")

Rebuild/restart backend-api Docker container after migrate deploy.
Health checks unchanged: ports 3006, 3008, 3000 (MR Travels), 3010 (Allwin Tours).

---

## SESSION LOG (append briefly each session)

- 2026-08-09: Stage 1 (Backend Foundation) complete. Added DomainApp core schema
  (GenericInvoice named to avoid Invoice collision), 20 industry configs + general
  fallback with /industries endpoints, generic DomainApp CRUD (contacts/catalog/
  records/invoices/summary), addon+module toggle system, and AES-256-GCM platform
  settings. All builds 0 errors. Commits: 5e4852d, 7bf7b79, d7fcc6f, a294222,
  9cccede, c5b382e. Migration deferred to VM (see VM REPORT). Proceeding to Stage 2.
- 2026-08-09: Stage 2 (Frontend Design System & Dashboard Shell) complete. Config-
  driven shell reads industry config + module/addon toggles; locked tabs open an
  UpgradeModal; dynamic mobile nav; new reusable UI primitives; naming migration.
  Kept blue-600 primary (tokens already on-target). Commit fa0cb73. Shell links to
  Stage 3/4 routes (/dashboard/domain-app/:tab, /ai-studio, /communication,
  /customer-hub) that are built in later stages. Proceeding to Stage 3 Batch 1.
- 2026-08-10: Stage 3 (Industry-Specific Dashboards) complete for ALL 20 industries
  via config-driven shared views + one dynamic route (b6e2d08) — see Stage 3
  ARCHITECTURE NOTE above. Addon/peripheral tabs render Coming Soon stubs (follow-up).
- 2026-08-10: Stage 4 PARTIAL. Backend mock provider layers (WhatsApp/SMS/Meta/
  Google Ads, key-resolution via platform-settings) + Growth Hub publish/ads
  endpoints done (3278e8a). AI Studio frontend done (efef5eb). Growth Hub API
  client methods (8247ed4). REMAINING for next session (all builds currently green):
    * C1-C3 TeleCRM 3-panel + call flow + Kanban (frontend refactor of existing
      /dashboard/telecrm; backend /crm/* and /ai/call-summary already exist)
    * D1 restructure campaigns page UI; D2/D3 frontend publish button + Ads tab
      (backend + api client ready — wire buttons to api.growthPublish / growthRequestAd)
    * E1 Customer Portal (src/app/customer/*), E2 Customer Hub vendor settings tab,
      E3 Communication Hub inbox (email real via Resend, WhatsApp/SMS via mocks)
    * Stage 5: F Analytics Hub (use /domainapp/summary + existing tables) +
      Website Manager (extend VendorCMS); G Admin Integrations UI (consume
      /platform-settings) + module/addon toggle UI (consume /modules,/addons) +
      vendor onboarding industry picker (GET /industries)
    * Stage 6: PWA polish (H). Stage 7: VM deploy report + smoke test (I) — note
      the STAGE 1 VM REPORT already lists the migration + PLATFORM_SETTINGS_KEY.
  No blockers. Resume: read this ledger, continue from first unchecked item.
- 2026-08-10: PAUSED by owner for VM testing before continuing. Do NOT proceed to
  remaining Stage 4 items (C1-C3, D1/D2/D3 frontend, E1-E3) or Stages 5-7 until the
  owner confirms. All work committed + pushed; branch get4domain-site in sync with
  origin. Both apps build 0 errors. Last commit at pause: a49dd0d (+ this log update).
- 2026-08-10: RESUMED in full autonomous mode. Completed rest of Stage 4 (TeleCRM
  8bc8d84, Growth Hub 44e0adf, Communication+Customer backend 2c62c01, E frontend
  2419d64), Stage 5 (Analytics+Website 9aed01a, Admin Integrations+Vendor Access
  d17ed21), Stage 6 (PWA polish b3f37df), Stage 7 (DEPLOYMENT_REPORT_V2.md). Both apps
  build 0 errors throughout. ALL DISPATCH_MASTER coding work is DONE. Remaining I1-I6
  are VM/DB/Cloudflare operations for the human (see DEPLOYMENT_REPORT_V2.md). This is
  the end-of-Stage-7 stop point.
- 2026-08-10: POST-DEPLOY BUGFIXES (see section above). PD-BUG-1 (23da856):
  invoice send-payment-link 500 root-caused to Razorpay's non-Error rejection
  being swallowed by HttpExceptionFilter; fixed filter logging + hardened
  generatePaymentLink + renamed duplicate CreateInvoiceDto. PD-BUG-2 (98c9d54):
  admin mobile bottom nav + main padding for reachable Sign Out. Both apps build
  0 errors. Proceeding to post-deploy ADMIN INTERNAL-TEAM feature addition.
- 2026-08-10: POST-DEPLOY ADMIN INTERNAL-TEAM ADDITION complete (see section
  above). Task 1 roles+invite (a71f4fd), Task 2 role-gated sidebar (06be4cd),
  Task 3 admin TeleCRM over g4d_leads (aefa31c), Task 4 Send Quote (3f00973).
  Adapter-based TeleCRM reuse; locked-tab pattern reused from vendor Stage 2; AI
  Studio re-exported under /admin. New migration deferred to VM (AdminRole enum;
  tables g4d_admin_team_members / g4d_lead_call_logs / g4d_quotes; g4d_leads +3
  columns). Both apps build 0 errors throughout.
- 2026-08-10: MARKETING PAGES v2.0 REDESIGN complete (see section above) —
  DISPATCH_MARKETING_PAGES.md Tasks 1-14. Header/Footer/Home (e61d657), pricing +
  product + industries pages (6512a7a), book-demo + contact constants (627b56b).
  Correct v2.0 pricing/products, full SEO (AggregateOffer + FAQPage schema, robots,
  32-URL sitemap), mobile bottom nav. Task 13 (admin-editable marketing CMS) left as
  the dispatch-specified follow-up. Verified at 390px + all key routes 200. Frontend
  build 0 errors.
- 2026-08-10: UX OVERHAUL (DISPATCH_FIX_UX.md Sections A-J) — see section above.
  Single-product pricing (b976183), TeleCRM click-to-call overhaul (f1ceb4d),
  campaign flow + marketing audit (703eee6), admin pricing manager + domain mgmt
  + bottom sheet (b156246), AI Studio wallet/graceful (5488d2d), comm-hub
  coming-soon (f8b3a07). Both apps build 0 errors; routes 200; 390px verified.
  Deferred (honest): D1/D2/E1 dashboard-overview redesigns, form→BottomSheet
  migration, AI Studio extra document generators — best done with a logged-in
  session to test the authenticated flows.
