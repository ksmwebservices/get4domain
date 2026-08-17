# GET4DOMAIN v2.0 — DISPATCH PROGRESS LEDGER
# Claude Code updates this file after EVERY task.
# On session resume, read this FIRST to know exactly where to continue.

Legend: [ ] not started · [~] in progress · [x] done · [!] blocked

═══════════════════════════════════════════════════════════════════════════════
## AUG 2026 CONTINUOUS RUN — COMPLETE (bar 2 parked items). Deploy: docs/VM_DEPLOY_RUNBOOK.md
Done end-to-end: Phase 1 + 1B/Decision 1 · Vendor CMS editor · Track A (2.1-2.5) ·
Track B (2A-2G) · Track C 3A/3B/3C/3D. Every unit built + committed with 0-error builds;
full-tree rebuild + prisma validate re-verified at run end (both apps clean, 345 FE pages).
PARKED until KSM answers directly (do NOT build):
  • 3E real AI-provider wiring — needs the funded-provider list (Stop 4). Scaffolding shipped.
  • Decision 2 Razorpay subscriptions — needs a plan_id + mandate. Checkout stays one-time ₹999.
NEXT ACTION FOR KSM: run docs/VM_DEPLOY_RUNBOOK.md (one clean deploy — all schema additive),
then the 2 blocked verifications (real image-gen; funded-provider confirmation).
Latest commit at run end: 2de3729 (+ this docs commit).
═══════════════════════════════════════════════════════════════════════════════

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

#### OTP flow fixes — round 2 (live-testing findings)
- [x] Fix 1 — DTO validation rejected formatted numbers. RequestOtpDto/VerifyOtpDto/
  VerifyDemoLeadDto/DemoEnquiryDto now @Transform(phone → last-10-digits) BEFORE
  @Matches(/^\d{10}$/) (global ValidationPipe transform:true). "+91 98765 43210",
  spaces, dashes, leading 0 all pass; the DB/SmsService receive a clean 10-digit.
- [x] Fix 2 — `mock:true` even with a configured key. ROOT CAUSE: the SMS error/
  exception branches all returned mock:true, masking real API failures as "mock"
  (OTP has NO DLT gate — sendOtp never checks sender/entity/template, so that
  wasn't it). Now: mock ONLY when the api_key doesn't resolve (with a warn log
  naming PLATFORM_SETTINGS_KEY); a real attempt that errors returns status
  'failed' + the Fast2SMS message (mock:false), logged with the masked URL + raw
  body. ProviderResult gained 'failed' + error. sendOtp tries /dev/bulk then falls
  back to /dev/bulkV2 route=otp. OtpService.request surfaces sent/mock/error.
  CommunicationService now debits the wallet only on status==='sent' (never on a
  failed send).
- [x] Verified: DTO transform+regex across 7 formats; backend builds 0 errors.
- [!] After deploy, `curl .../otp/request -d '{"phone":"7550010567"}'` returns:
  {sent:true,mock:false} = real SMS sent · {mock:true} = key not resolving (check
  PLATFORM_SETTINGS_KEY / Admin key) · {sent:false,mock:false,error:"…"} = Fast2SMS
  rejected it (error text says why). No longer masked as mock either way.

#### OTP flow fixes — round 3 (working route confirmed)
- [x] This account's working route is Quick SMS (route=q), NOT route=otp. sendOtp
  now sends route=q on /dev/bulkV2 with a PLAIN message ("Your Get4Domain OTP is
  {code}. Valid for 5 minutes.") + numbers=<10-digit>. Removed the /dev/bulk
  endpoint + route=otp variables_values + the fallback. Request now matches the
  dashboard-confirmed shape (verified URL build). No DLT / no verification.
- [x] Known tradeoff: Quick SMS ≈ ₹5/SMS. TODO(cost): move to a cheaper DLT
  template route (needs Sender ID + DLT template) as a later optimisation.
- [x] backend builds 0 errors.

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

## DISPATCH — GET4DOMAIN_PHASE4_DISPATCH_11AUG2026 (in progress)

### Pre-work — CTA bug fix
- [x] Post-OTP-verify "Explore Industries" loop already fixed last session (5e741ab);
  now points to /demo/[industry]. Re-confirmed + folded into the canonical fix below.

### Category-list audit (investigate + fix canonical list)
- [x] AUDIT — all three lists cover the SAME 20 industries; only 3 slugs differed:
    | industry | marketing (/industries, industry-content) | backend config (/demo) |
    | clinic   | healthcare | clinic |
    | salon    | beauty     | salon  |
    | gym      | fitness    | gym    |
  Effect: /demo/healthcare|beauty|fitness fell back to `general`. Book-Demo dropdown
  also used its own 21 ad-hoc labels + a local key map (independent of both lists).
- [x] FIX — canonical id = the marketing slug (SEO routes already indexed). Backend
  getIndustryConfig now resolves aliases (healthcare→clinic, beauty→salon,
  fitness→gym) via INDUSTRY_ALIASES + resolveIndustryKey — no risky config rename.
  Book-Demo dropdown now imports the shared INDUSTRIES list (data/industries-list),
  option value = canonical id, so it feeds /demo/[id] + seedVendor directly; dropped
  the ad-hoc labels + local map + the "Other" option (not a real category). Lead now
  stores the canonical id. All three lists (dropdown, /industries, /demo configs)
  are now the same 20 canonical ids. Both apps build 0 errors.

### Phase 2 enhancement (multi-section demo sites, all categories) — DONE
- [x] /demo/[industry] rebuilt as a navigable multi-section site: sticky header nav
  + hero + sections (catalog, team, booking, reviews, about, contact) per industry.
  Config-driven single renderer (not 20 files). Sections come from SECTION_META
  (per-industry labels: Menu/Tour Packages/Doctors/Appointments/…) + demo content;
  team + booking records derive from the SAME NAME_POOL + services that seedVendor
  writes, so the public site and the seeded DB share one source. Covers all 20 via
  canonical aliases + general fallback. Reuses ChatBot + MarketingBottomNav +
  Fast2SMS enquiry. Both apps build 0 errors. (Backend-data-driven → build-verified;
  render needs the API running.)

### Phase 4 (interactive tour) — CORE DONE
Confirmed: (1) short-lived sandbox JWT; (2) per-lead sandbox Vendor + expiry;
(3) [Phase 2] static per-section shared samples — done above.
- [x] Vendor.isSandbox (Boolean) + expiresAt (DateTime?) columns — schema updated
  (VM `prisma db push` required, folds in with the other pending Lead columns).
- [x] Provisioning: verifyDemoLead (OTP verify) now calls DemoService.provisionSandbox
  — creates a per-lead sandbox Vendor (isSandbox, expiresAt +48h, synthetic email,
  unusable password), seeds it via seedVendor(), mints a scoped sandbox JWT
  (AuthService.mintSandboxToken, kind:'sandbox', exp 48h), returns { lead, sandbox }.
  Best-effort — a provisioning failure never fails the verified lead.
- [x] Auth: jwt.strategy validates a sandbox vendor like a normal vendor (real row,
  sub=vendorId → all vendorId-scoped endpoints work) AND rejects it once
  expiresAt passes, even with an unexpired token.
- [x] Tour launch (frontend): "Start Demo Tour" seats the sandbox session
  (g4d_token + g4d_user) and opens /dashboard — the seeded sandbox data renders via
  normal vendorId scoping (shared components, no parallel versions). "Explore Your
  Demo Site" → /demo/[industry] (Phase 2).
- [x] Cleanup: DemoService.cleanupExpiredSandboxes() deletes expired sandbox vendors
  + their seeded rows; admin POST /demo/cleanup-sandboxes. Admin vendor list
  (VendorsService.findAll) now excludes isSandbox vendors. Both apps build 0 errors.
- [x] Vendor-dashboard leg CONFIRMED WORKING on the live VM (sandbox JWT +
  provisioning solid).
- [x] Customer-portal leg — CustomerService.createSandboxSession(vendorId) mints an
  opaque customer-portal session (same in-memory session as verify()) for a seeded
  contact of the sandbox vendor; verifyDemoLead returns it as sandbox.customerToken.
  Frontend "Or see the customer portal side →" seats g4d_customer_token + opens
  /customer, which auto-loads the sandbox contact's records/invoices (vendorId +
  contactId scoped). Both apps build 0 errors.
  NOTE: customer sessions are IN-MEMORY (like the existing portal) — a backend
  restart between provisioning and the click drops the session (portal then shows
  its login). Session TTL 24h vs sandbox 48h — fine for a demo.
- [~] REMAINING (next pass): a scheduled cron for cleanup (currently manual admin
  endpoint /demo/cleanup-sandboxes + JWT-expiry guard + admin-list filter; a cron
  needs @nestjs/schedule). Not blocking.
- Phases 5–6 (Razorpay checkout, auto-activation) remain OUT OF SCOPE.

### VM MIGRATION for this dispatch
`prisma db push` now also adds Vendor.isSandbox + Vendor.expiresAt (alongside the
still-pending Lead.preferredDate/preferredSlot/source). One db push applies all.

---

## DISPATCH — GET4DOMAIN_BUGFIX_DISPATCH_11AUG2026 (in progress)

- [x] A1. Admin "Recent Bookings → View all" crash ("Something went wrong"). Root
  cause: /admin/leads did `statusConfig[lead.status].color` but a verified demo lead
  has status 'verified' (not in the pending/called/converted map) → threw. Fixed:
  statusConfig is now Record<string> with verified/new entries + a safe `statusOf()`
  fallback; added a "verified" filter tab.
- [x] A2. Demo leads missing from TeleCRM. Root cause: admin-crm.toCrmLead only
  mapped pending→new; a 'verified' demo lead matched no Kanban stage → invisible.
  Fixed: any status outside the pipeline set now buckets to 'new' (Krisha & all
  verified demo leads now appear). SAFETY-NET pipeline for Phase 5–6 restored.
- [x] A3. TeleCRM Kanban UX rework (shared board, admin + vendor). Removed the fixed
  bottom-16 stage quick-nav bar (the "duplicate nav mid-screen" bug). Board is now
  gesture-native: snap-x snap-mandatory horizontal swipe, hidden scrollbar
  ([scrollbar-width:none] + [&::-webkit-scrollbar]:hidden), mobile columns ~86vw so
  one stage fills the screen and you swipe between stages; desktop shows several.
- [x] A4. TeleCRM "Summary" — owner clarified: a PER-LEAD summary panel, NO AI.
  Added a lead-summary drawer (tap any Kanban card): brief (business/industry/
  interest/follow-up/notes) + full call history (outcome/date/duration/notes) +
  Call & WhatsApp. All pulled directly from the lead's logged data (adapter.getLead).
  REFINEMENT: removed AI entirely from this view — deleted the "Summarize" AI
  call-summary button + the aiSummary state/handler + the aiSummary display in both
  the feedback sheet and the panel; removed aiSummary from the TeleCrmAdapter
  interface + both page adapters. Nothing here is AI-generated or AI-rewritten.
  (Backend /ai/call-summary + api.generateAiCallSummary remain in the codebase but
  are no longer wired to TeleCRM.)
- [x] B5. "Post creation not available." Root cause: GenerateContentDto validated
  @IsIn(['facebook','instagram','reel','poster','blog']) but AI Studio sends its
  content-type keys (social_post, festival_poster, …) → 400, never generated. Fixed:
  CONTENT_CHANNELS + cost/pricing/image maps now include all AI Studio content-type
  keys (social_post/reel_script/blog_post/festival_poster/ad_creative/email/whatsapp/
  sms) plus the legacy Growth Hub channels. All content types generate now.
- [x] B6. Letterhead/Visiting/ID card — owner chose HYBRID (AI design + real text).
  New backend POST /ai/generate-image → design-ONLY DALL-E background (prompt says
  "no text"), wallet-charged ('document' rate, free for internal, graceful null when
  unkeyed). Frontend doc generator: "Generate AI design" button overlays that image
  behind the doc with an 85% white wash so the REAL business/contact text stays
  crisp; print-to-PDF unchanged. Falls back to the clean CSS design when no image.
- [x] B7. Wallet credit tiers configurable in Pricing Manager. Added trial_free_credit
  + pro_free_credit to the pricing settings category + the admin Pricing Manager
  groups (editable, stored in g4d_platform_settings "pricing"). NOTE: granting these
  on signup is Phase 5–6 wiring; this dispatch makes the amounts admin-editable.
- [ ] B8. Template library (admin-curated pre-made templates) — LOGGED as a planned
  v2 feature, NOT built this dispatch (per instruction).
- [x] C9. Invoice PDF redesigned into a proper branded bill: blue brand band with
  KSM logo (logo_url) / initial, meta strip with PAID/PENDING badge, From/Bill-To,
  dark-header line-items table (description/price/discount/amount), right-aligned
  totals box with emphasized Grand Total, payment method, renewal note strip, T&C +
  footer. Config-driven company (GSTIN/PAN/address from Admin → Integrations).
- [x] C10. Invoice share — vendor Invoices tab now has Download + Email (backend
  POST /invoices/:id/email → Resend) + WhatsApp (wa.me prefilled summary) per invoice.
- [x] D11. Demo-lead WhatsApp outreach — admin leads WhatsApp button now opens a real
  industry-aware outreach template (intro Get4Domain, reference their industry,
  invite to the demo site, offer a proposal + ₹6,999/yr), not an empty chat.
- [x] backend + frontend build 0 errors. Build-verified (no VM/live here).

---

## DISPATCH — GET4DOMAIN_POLISH_DISPATCH_11AUG2026 (in progress)

- [x] 1. Demo site real images. /demo/[industry] hero now uses the industry's real
  banner (industry-content.coverImage, pexels, keyed by the same marketing id the
  route uses) with a dark gradient overlay for readable text; team members show real
  avatar photos (pravatar). Raw <img> (no next/image domain config needed).
- [x] 2. Demo site mobile nav bug. Removed <MarketingBottomNav/> (the app nav the
  demo site was borrowing). The demo site now has its OWN lightweight nav: desktop
  inline section links + a mobile scrollable pill row of in-page section anchors
  (Home + each section). ChatBot floating widget kept. Dropped the pb-20 that was
  clearing the old bottom nav.
- [x] 3. Invoice visibility — ROOT CAUSE: the branded Invoices page (/dashboard/
  invoices, with download + Email + WhatsApp) had NO nav link in the vendor shell —
  unreachable. Added "Invoices" to the Account nav section. Generation/download path
  itself is correct: a platform Invoice is created on wallet top-up
  (createPaidTopupInvoice) or subscription payment; it then lists here with a working
  print-to-PDF download. NOTE: needs a real top-up/payment to produce one (sandbox
  seeds DomainApp GenericInvoices, not platform Invoices); COMPANY_LOGO_URL sets the
  logo (else the company initial).
- [x] 5. TeleCRM follow-up scheduling (NO AI). Per-lead summary panel now has a
  "Follow-up reminder" — Tomorrow / In 2 days / Next week / custom date — persisted
  to the lead's followUpDate via adapter.updateLead. Surfaced back on the board:
  each card shows a follow-up badge when due (red=overdue, amber=today, else the
  date), so the team sees who to call the next day. Pure scheduling, no AI.
- [x] 7. Audit — all 20 industry demo sites resolve to REAL content (not fallback):
  programmatic cross-check confirms every marketing id (incl. healthcare/beauty/
  fitness via alias) maps to a DEMO_CONTENT entry + SECTION_META + a hero coverImage.
  So every /demo/[industry] renders real multi-section content and its sandbox
  provisioning uses a valid config → reaches the vendor dashboard. (Data/code-level
  verified; full 20-way live click-through needs the VM — recommend a smoke test.)
- [~] 6. Vendor dashboard UI polish — DEFERRED to a live visual pass (with reason).
  Checked what's objectively verifiable: dashboard page titles are already consistent
  (25/26 text-xl; the one text-lg is a legitimate inbox channel sub-heading, not a
  title). The rest of item 6 (color/spacing consistency across Overview/TeleCRM/AI
  Studio/Business/More) is subjective and needs eyes-on rendering — the authed
  dashboard can't be rendered from Claude Code (login against the live backend), so
  blind CSS changes risk hurting consistency rather than helping. Best done as a
  focused pass with screenshots or a logged-in preview. Dispatch itself marked this
  lower-priority ("after the functional items").
- [x] 4. Trial/Pro free credit now actually GRANTED (was only editable). New
  WalletService.grantCredit (free credit, 90-day validity, logged). vendors.service
  .create grants trial_free_credit (Pricing Manager, ₹100 fallback) on signup;
  demo.provisionSandbox grants it too so the tour's AI Studio works. Best-effort
  (never fails signup). NOTE: Pro-tier credit on plan UPGRADE is a follow-up — needs
  the subscription/plan-assignment hook; this covers signup + sandbox.

---

## DISPATCH — GET4DOMAIN_PHASE5_6_DISPATCH_11AUG2026 (Book-Demo buy-now conversion)

Build against Razorpay TEST-MODE keys; live keys are a separate explicit step (not
this dispatch's completion criteria). Build-verified here (0 errors) — the money flow
must be tested in test mode on the VM.

### Phase 5 — Buy-now conversion
- [x] Entry points: "Go live" banner on the vendor dashboard Overview (shown only for
  sandbox sessions, user.plan==='Demo Sandbox') + a full /dashboard/go-live page.
  Reachable any time during the tour, not just the end.
- [x] Full profile + REAL email + password collected at buy-now (not before) —
  go-live form (businessName/email/password/name/phone), prefilled from the sandbox
  session where possible.
- [x] Razorpay checkout for ₹6,999/yr: POST /demo/buy/order creates the order (amount
  from Pricing Manager domainapp_annual, ₹6,999 fallback) via the existing
  PaymentsService; frontend opens Razorpay (NEXT_PUBLIC_RAZORPAY_KEY_ID), same pattern
  as wallet top-up.
- [x] On payment success → POST /demo/buy/confirm: verifies the signature
  (PaymentsService.verifySignature) BEFORE any change, then CONVERTS THE SAME Vendor
  row (no delete/recreate): isSandbox→false, expiresAt→null, real businessName/email/
  name/phone/password (hashed). Seeded demo data survives (same vendorId). Bad
  signature throws first → sandbox untouched (still expires normally).
- [x] Real credentials: reuses the existing pattern — the lead sets a password;
  EmailService.sendWelcomeEmail delivers it. Returns a real vendor JWT
  (AuthService.mintVendorToken) so they're logged straight in.

### Phase 6 — Automation on payment success (fully automatic, no admin step)
- [x] Invoice: REUSES the existing paid-invoice automation — refactored
  createPaidTopupInvoice into a shared createPaidInvoice; the ₹6,999 signup calls the
  SAME path (GST-inclusive back-calc, PAID invoice, platformIncome, branded PDF via
  Resend). No second invoice path.
- [x] Pro-tier ₹999 AI Studio credit granted at conversion via WalletService.grantCredit
  (pro_free_credit from Pricing Manager, ₹999 fallback) — the upgrade hook the polish
  dispatch flagged as missing.
- [x] Notify: welcome email (credentials) + Fast2SMS Quick SMS "your account is live".
- [x] Subscription created (DOMAIN_APP / STARTUP / ACTIVE, +1yr) linked to the invoice.
- [x] Sales-assisted TeleCRM fallback for unconverted verified leads is UNCHANGED.
- [x] backend + frontend build 0 errors; no new DB migration (uses existing Vendor/
  Subscription/Invoice/Wallet tables + the Phase 4 isSandbox/expiresAt columns).
- NOTE (profile scope): Vendor has no address/GSTIN columns, so those aren't collected/
  stored (would need a migration) — captured businessName/email/name/phone/password.
- [!] VM TEST (test mode): sandbox lead → Go live → Razorpay TEST payment → confirm the
  SAME row converts (not new), real login works, invoice PDF generates + email sends,
  ₹999 credit appears; confirm an abandoned payment leaves the sandbox intact.

---

## DISPATCH — TOUR + AI-KEY + COMM-HUB (12 Aug 2026)

### Item 2 — AI Studio "needs to be configured" gate
- [x] ROOT CAUSE (separate from the B5 DTO fix): AiService read the Claude key ONLY
  from process.env.CLAUDE_API_KEY (and OpenAI from process.env.OPENAI_API_KEY) — it
  never read the key admin saves in Admin → Integrations (ai/anthropic_api_key). So a
  DB-configured key was ignored and, if the env var wasn't set, every generation threw
  "not configured" → the frontend's "contact your administrator" message.
  FIX: callClaude + chat now resolve via settings.getResolvedValue('ai',
  'anthropic_api_key') and generateImage via ('ai','openai_api_key') — DB value first,
  env fallback (envFallback already CLAUDE_API_KEY/OPENAI_API_KEY). AiModule imports
  PlatformSettingsModule. Now a saved admin key works without an env var.

### Item 3 — Communication Hub audit + build
- [x] AUDIT: the inbox UI WAS built (real 3-panel: channel switcher, contact/thread
  list, thread view + compose/send; email real via Resend, WA/SMS via Fast2SMS/mock
  with wallet debit). The GAP was NO persistence — sent messages lived only in React
  state (lost on reload), each "thread" was a contact with its notes as one bubble,
  no inbound capture.
- [x] BUILT message persistence → a real inbox: new Message model (g4d_messages:
  vendorId/contactId/channel/direction/subject/body/status/providerMessageId). send()
  persists each outbound message (best-effort); threads() shows each contact's latest
  real message; new GET /communication/history?contactId&channel returns the persisted
  thread. Frontend loads real history on open (direction-aware bubbles + timestamps +
  status), send passes contactId + reloads. Inbound (provider webhooks) noted as future.
- [!] VM MIGRATION: new g4d_messages table — `prisma db push` (folds in with prior
  pending columns). Build-verified; not live-tested.
### Item 1 — Tour consolidation + unified switcher + View Website
- [x] Single entry: the book-demo success screen now shows ONE "Start Interactive
  Tour" button (replaces Explore Demo Site / Start Demo Tour / Customer Portal). It
  seats the sandbox session + a tour context (g4d_tour = {industry, customerToken})
  and enters the tour on the demo website. Falls back to a plain "Explore Demo Site"
  link if provisioning failed.
- [x] In-context switcher: new <TourNav/> floating nav (Website / Dashboard /
  Customer + Go live + Exit), mounted on the demo site, the vendor dashboard, and the
  customer portal. Renders only when a tour is active (g4d_tour present), so it's safe
  everywhere. Switches within the SAME session — website is public, dashboard uses the
  seated sandbox JWT, and the Customer tab seats the pre-minted customer-portal token
  (g4d_customer_token) before navigating, BRIDGING the portal's separate auth to the
  same sandbox session — no OTP re-login to switch.
- [x] Persistent "View Website" link in the vendor dashboard sidebar (opens
  /demo/[industry] in a new tab) — available from the dashboard for every vendor, plus
  the TourNav Website tab from inside the tour. Not a one-way entry.
- [x] frontend builds 0 errors. NOTE: customer-portal sessions are in-memory (Phase 4
  limitation) — a backend restart drops them and the Customer tab falls back to the
  portal login. Build-verified; live click-through needs the VM.

---

## FIX — OpenAI image "not configured" masking (12 Aug 2026)
- INVESTIGATION 1 (naming): NO mismatch. generateImage resolves
  getResolvedValue('ai','openai_api_key') — the SAME 'ai' category as Claude's
  'anthropic_api_key'. The key resolves fine if present (DB or OPENAI_API_KEY env).
- INVESTIGATION 2 (the real bug): generateImage returned `null` for BOTH "no key"
  AND any real OpenAI API error (invalid/expired key, quota, no DALL-E access), and
  the doc-design frontend rendered any null as "isn't configured". So a resolving-but-
  rejected key showed "not configured", masking the true cause (same class of bug as
  the Fast2SMS mock:true masking).
- FIX: generateImage now returns { url, status: 'ok'|'not_configured'|'failed', error }
  and parses the real OpenAI error message from the response. generateDesignImage
  surfaces status+error; the AI Studio doc generator shows the REAL error ("AI image
  failed: <openai message>") vs. a true "not configured — add an OpenAI key" only when
  the key genuinely doesn't resolve. Content-gen image add-on reads .url (image
  failure still never fails the text). Both apps build 0 errors.
  → Owner: retry now; the surfaced message will say exactly what OpenAI rejected
  (most likely an invalid/expired key or missing image/billing access on the account).

## FEATURE — Image upload (local VM disk storage) (12 Aug 2026)

Shared storage: uploaded images are written to `<cwd>/uploads` on the VM disk and
served by the backend at `/uploads/*` (main.ts app.useStaticAssets). New authed
endpoint POST /uploads (UploadsModule) — in-memory FileInterceptor (5MB, image
mimetypes only), writes the buffer with a unique name + real extension, returns an
absolute URL (PUBLIC_API_URL or the request host). No @types/multer / cloud storage
needed. Frontend api.uploadImage(file) posts multipart with the auth token.

- [x] Item 1 — AI Studio content generation: for image-relevant types (Social Post,
  Festival Poster, Ad Creative) the generation modal now has an "Your own image
  (optional)" uploader — use a real product/property photo or logo. When an image is
  uploaded, generateContent is called with skipImage:true (no AI image cost) and the
  result shows the vendor's image + the AI caption; otherwise the AI image is shown.
  (Content-gen previously didn't display any image at all — now it does.)
- [x] Item 2 — Admin → Integrations → Company Logo: the logo_url text field is
  replaced with a file-upload widget (preview + Replace). Upload stores the file on
  our server and sets company/logo_url to the returned URL automatically — no external
  hosting required. Invoices then render the real KSM logo.
- [x] backend + frontend build 0 errors.
- [!] VM DEPLOY NOTES:
  * Persist the uploads folder — mount `<backend>/uploads` (or /app/uploads in Docker)
    as a VOLUME so uploaded files survive container restarts/redeploys.
  * Set PUBLIC_API_URL=https://gapi.get4domain.com so returned URLs are https behind
    the nginx proxy (otherwise they inherit the proxied req protocol).

## DISPATCH — DEMO SITE ARCHITECTURE + 2 ADDITIONS (12 Aug 2026)

### Addition 1 — catalog item image upload (DONE)
- [x] DomainApp CatalogView: item form now has a "Photo" uploader (reuses
  api.uploadImage → CatalogItem.image; backend DTO already accepted `image`).
  Preview + Change/Remove; the photo shows on catalog cards. Same pattern as the
  logo upload. Frontend build 0 errors; no backend change needed.

### Addition 2 — inbound message capture INVESTIGATION (report only, no code)
FINDINGS (grounded in the codebase + provider APIs):
- Resend = OUTBOUND ONLY in our use (resend.emails.send). Resend is a transactional
  SEND API; it does NOT provide inbound email parsing/receiving. Capturing replies
  needs an inbound-parse provider (SendGrid Inbound Parse / Mailgun Routes / Postmark
  inbound / Cloudflare Email Workers) or MX-based receiving — not Resend.
- Fast2SMS WhatsApp = OUTBOUND ONLY (/dev/whatsapp template send). Fast2SMS is a
  bulk WhatsApp/SMS SENDER, not a two-way BSP; it does NOT expose inbound WhatsApp
  webhooks for capturing replies. Real two-way WhatsApp needs a WhatsApp Business
  API/BSP (Meta Cloud API directly, or Interakt / AiSensy / Gupshup / Wati) with a
  configured webhook.
- Fast2SMS SMS = OUTBOUND ONLY (DLT-gated bulk). Inbound SMS needs a two-way virtual
  long/short-code provider with delivery webhooks — not in the Fast2SMS bulk API.
- Only webhook in the app today = Razorpay (payments).
VERDICT: inbound capture is NOT buildable with the current providers — the persisted
inbox we built stores OUTBOUND history only. To add true inbound (two-way), swap in:
WhatsApp → a BSP/Meta Cloud API; Email → an inbound-parse provider. The mock-first
provider layer is already swap-ready for this. NO webhook code written (per the
"investigate first" instruction).
CONSEQUENCE for dispatch item 3.5 (WhatsApp auto-reply on demo sites): a TRUE
inbound-triggered auto-reply is NOT possible with Fast2SMS. Feasible instead: the
site's WhatsApp CTA opens wa.me with an industry-aware prefilled message, and the
Enquire form already sends an outbound WhatsApp confirmation (Fast2SMS) — that is the
closest "automated first response" our providers allow. Implemented that way.

### Demo Site Architecture (main dispatch) — DONE
- [x] 0.5 Category→Subcategory model: new src/data/demo-site.ts layered over the 20
  industries (industry-content.ts). Categories = the 20; SUBCATEGORIES curated for a
  few (healthcare→dental/physiotherapy/general-physician/hospital; realestate,
  restaurant, beauty, fitness, education) + a "general" fallback for the rest.
  Unknown subcategory → category baseline (additive, no migration). Sections derived
  from each category's "Website Pages" (websitePages) + a type classifier.
- [x] 1. Real multi-page routes (not anchors): app/demo/[category]/[[...rest]]/page.tsx
  — one optional catch-all server component handling /demo/[category] (home),
  /demo/[category]/[subcategory] (home), /demo/[category]/[section], and
  /demo/[category]/[subcategory]/[section]. Removed the old single-page
  app/demo/[industry]/page.tsx. Build prerenders 340 pages (was ~92) — real separate
  URLs per section. Verified /demo/restaurant/menu, /demo/healthcare/dental/* live.
- [x] 2. SEO/AEO per page: generateMetadata gives section-specific title + meta
  (root template adds "| Get4Domain") + OpenGraph + Twitter card (coverImage), and a
  LocalBusiness JSON-LD block per page.
- [x] 3. Mobile-native nav: new DemoSiteNav — desktop top links + a FIXED mobile
  bottom nav (icon+label tabs, the app's bottom-nav pattern) with the site's real
  section routes (Home + sections + Contact). Not Get4Domain's app nav.
- [x] 3.5 Banner image per page (reuses the per-industry coverImage) + WhatsApp: given
  the addition-2 finding (Fast2SMS has NO inbound webhook), a true inbound auto-reply
  isn't possible — implemented the feasible version: the Contact/Booking section's
  WhatsApp CTA opens wa.me with an industry-aware prefilled message, and the Enquire
  form sends an outbound WhatsApp confirmation via Fast2SMS (closest automated first
  response). DemoContactSection component.
- [x] 4. sitemap.xml extended (allDemoPaths → every category/subcategory/section URL,
  one unified sitemap); robots.ts already allows /demo/* (indexable).
- [x] frontend build 0 errors; 340 static pages. Existing links (/demo/[id] from the
  tour/book-demo/dashboard) still resolve — the id IS the category. TourNav + ChatBot
  still mounted on the new pages.
- NOTE (scope): content SUBSTANCE (real prices/listings/team) is the separate,
  still-pending item — tonight was STRUCTURE. Section content reuses industry-content
  sampleContent (services/hero/about) + generated team/gallery.

### DISPATCH — GET4DOMAIN_CONTENT_DEPTH_FULL_11AUG2026 — DONE
Fills the content-substance gap above: every category/subcategory now shows real,
industry-specific listings with real fields, a native business flow, and lead capture
— not the generic "Enquire / ₹4,999" card.
- [x] Data: new src/data/demo-catalog.ts — rich DEMO_CATALOG for ALL 20 categories.
  Each item has real fields per the dispatch table (price + category-specific fields:
  realestate area/config/type, restaurant course/serves + veg tags, healthcare
  duration/department, hotel occupancy/amenities, fitness duration/includes, education
  duration/seats, diagnostics report-time/sample, etc.), description and tags. Team
  arrays (doctors/agents/faculty/stylists/vehicles/advisors) for the categories with a
  team page. NOT a new model — reuses the generic CatalogItem concept; per-listing
  photos fall back to the category coverImage (real vendors upload via the image infra).
- [x] Flows (browse → native action): per-category DemoFlow + CTA label —
  realestate Book Site Visit · restaurant Reserve a Table · healthcare Book Appointment ·
  beauty Book a Slot · fitness/coaching Enquire/Join · hotel Check Availability ·
  retail Enquire/Order · education Enquire/Enroll · automobile Book Service ·
  diagnostics Book Test · photography Book a Shoot · travel Book Package ·
  finance/professional Book Consultation · construction/logistics/technology Get a Quote ·
  events Check Date & Enquire · agriculture Enquire. Date/slot picker shown for the
  dated flows (DATED_FLOWS).
- [x] Subcategory overrides (medically/structurally distinct): healthcare→dental,
  physiotherapy, hospital; realestate→commercial, rental; restaurant→cafe, bakery;
  beauty→spa; fitness→yoga. All other subcategories inherit the category catalog (still
  real content, never generic). resolveCatalog(cat, sub) merges override over base.
- [x] Consistent UI: single shared client component DemoCatalogGrid (card grid + a
  flow-aware booking/enquiry modal). Same visual language across all 20 — only data,
  fields and CTA label differ.
- [x] Lead capture throughout: every card's CTA opens the modal → api.demoEnquiry
  (name, phone, optional date/slot, and a summary line "CTA: item (price)…"). Modal also
  has an "Ask on WhatsApp" wa.me deep link. No dead ends.
- [x] WhatsApp from home level: prominent "Chat on WhatsApp" button in the banner on
  EVERY page (incl. category/subcategory home), beside a "Browse {noun}" button.
- [x] Page wiring: demo page home shows a "Popular {noun}" preview (3 items) + View all;
  catalog sections render the full grid; team sections use catalog.team when present.
- [x] frontend build 0 errors; 340 static pages; console clean. Verified live:
  realestate/properties-buy (sqft/config/For-Sale · Book Site Visit), hotel/rooms
  (occupancy/amenities · Check Availability), healthcare/dental/services (RCT/whitening ·
  Book Appointment override), restaurant home (Popular dishes preview + banner WhatsApp).
- Category status: all 20 have real category-level content. Curated subcategory-specific
  content: healthcare (dental/physio/hospital), realestate (commercial/rental),
  restaurant (cafe/bakery), beauty (spa), fitness (yoga). Remaining subcategories
  (general-physician, residential, cloud-kitchen, nails, crossfit, education subs, etc.)
  inherit their category's real catalog — real, not generic — pending bespoke overrides.

### DISPATCH — GET4DOMAIN_SUBCATEGORY_COMPLETION_11AUG2026 — DONE
Extends content depth to EVERY curated subcategory (was ~9, now all 16) + gives each its
own banner image. Uncurated categories have only a "general" subcategory (== the category
itself, already real), so no work needed there.
- [x] 7 NEW bespoke subcategory overrides added to demo-catalog.ts, each with real
  subcategory-specific fields + its OWN banner image (verified pexels URL) + a flow that
  fits: healthcare→general-physician (fever/diabetes/vaccination/fitness-cert · Book
  Appointment · img 5407206); realestate→residential (homes for sale, sqft/config · Book
  Site Visit · img 1396122); restaurant→cloud-kitchen (delivery-only combos · flow
  changed to enquire-order → "Order Now" · img 4252137); beauty→nails (mani/gel/nail-art ·
  Book a Slot · img 704815); fitness→crossfit (drop-in/WOD/foundations · Enquire/Join ·
  img 2261485); education→coaching (JEE/NEET/foundation · Enquire/Enroll · img 5905445);
  education→college (B.E./B.Com/BBA/MBA/Diploma, fee-per-year/seats · Enquire/Enroll ·
  img 1454360). Teams added for general-physician, crossfit, coaching, college.
- [x] Own banner image for the 9 PRE-EXISTING curated subs too (req #2): coverImage added
  to dental (3845810), physiotherapy (4506109), hospital (1692693), commercial (380769),
  rental (1571460), cafe (302899), bakery (291528), spa (3757952), yoga (3822622). All 16
  curated subs now have a distinct banner, not the parent category cover.
- [x] Data model: CategoryCatalog gained optional coverImage; resolveCatalog merges it.
  Page computes coverImage = catalog?.coverImage ?? cat.coverImage and uses it for the
  banner, gallery, JSON-LD image and the card fallback; generateMetadata resolves the same
  for OG/Twitter images. All 20 image IDs curl-verified (200 image/jpeg) before use.
- [x] Reuses DemoCatalogGrid (no parallel components); same demoEnquiry + WhatsApp lead
  capture; subcategory routes render with the parent page structure. Build 0 errors, 340
  static pages, console clean. Verified live: cloud-kitchen (Order Now + own banner
  4252137), college (degree programs), general-physician (distinct from dental).
- Subcategory-by-subcategory status: BESPOKE now — healthcare: dental, physiotherapy,
  hospital, general-physician (general=Clinic baseline). realestate: commercial, rental,
  residential (general=baseline). restaurant: cafe, bakery, cloud-kitchen (general=
  baseline). beauty: spa, nails (general=Salon baseline). fitness: yoga, crossfit
  (general=Gym baseline). education: coaching, college (general=School baseline). The 14
  categories without curated subs have only "general" = their category content (real).
  NOTHING now falls back to inherited content across the curated set — full coverage.

### DISPATCH — GET4DOMAIN_CMS_EDITOR_DISPATCH — Vendor-facing website CMS (code DONE; VM steps pending)
Step 1 — AUDIT (reported to user before building):
- Website Manager exists: dashboard/my-website (Basic/About+Social/Services/SEO/Template)
  + dashboard/my-products (full CRUD + image URL + per-industry LABELS but GENERIC fields).
  Both edit the VendorProduct model via /cms. The my-website Services tab is a simple
  name+price add/delete.
- Rich per-category fields already existed but only on the DomainApp CatalogView →
  CatalogItem (g4d_catalog_items, ops app), NOT the website's VendorProduct.
- Business profile: my-website edits VendorCMS (name/tagline/about/phone/socials/SEO).
  VendorCMS had logo+favicon but NO banner, and no logo/banner uploader in the vendor UI.
- CRITICAL: no live vendor site rendered ANYWHERE — no [subdomain] route/middleware/rewrite.
  Only /demo/[category] (sample data) rendered. So Step 3 = build the live renderer new.
User decisions (AskUserQuestion): (1) source of truth = extend VendorProduct; (2) routing =
path route /site/[subdomain] now.
Step 2/3/4 — BUILD:
- [x] Schema (additive, nullable): VendorProduct.customFields Json?, VendorCMS.banner String?.
- [x] Backend: create-product.dto customFields (IsObject); update-vendor-cms.dto banner;
  cms.service add/updateProduct persist customFields (Prisma.InputJsonValue) + NEW public
  getSiteBySubdomain (404s on missing OR isSandbox); cms.controller GET /cms/site/:subdomain
  (@Public). Backend build 0 errors.
- [x] listing-fields.ts: per-category input schema aligned to demo-catalog fields
  (realestate area/config/type, restaurant course/diet/serves, healthcare duration/dept,
  hotel occupancy/amenities, …; GENERIC fallback).
- [x] my-products editor: rich per-category fields + tags + PHOTO UPLOAD (api.uploadImage,
  preview/change/remove/paste-URL) + "Preview my site" → /site/[subdomain]. Sends customFields.
- [x] my-website: new "Logo & Banner" tab — banner + logo upload (reuses upload infra);
  header "Preview my site" → /site/[subdomain]. VendorCms interface gained logo+banner.
- [x] LIVE SITE (Step 3): app/site/[subdomain]/[[...rest]]/page.tsx (force-dynamic) — fetches
  /cms/site/:subdomain, maps real VendorProduct → the SAME DemoCatalogGrid the demo uses
  (flow/ctaLabel from resolveCatalog(industry), fields from customFields via listing-fields,
  tags, price ₹-normalised), real banner/logo/about/contact, LocalBusiness JSON-LD, ChatBot,
  DemoContactSection lead capture (demoEnquiry) + wa.me. Home/listings/contact pages. Sandbox
  vendors 404 (backend guard) — demo (/demo) path untouched, no data crossover.
- [x] Step 4 preview button in both editors → opens the live /site/[subdomain] in a new tab.
- [x] Frontend build 0 errors, 340 static pages; live route dynamic. Safe runtime check:
  /site/__nope__ → app 404 "Page Not Found" + "Site not found" title (graceful; sandbox/
  unknown handled), /demo/restaurant unaffected.
- [!] VM STEPS (human, cannot run from Claude Code): (a) `prisma db push` for
  VendorProduct.customFields + VendorCMS.banner; (b) deploy backend (new /cms/site endpoint +
  DTO changes); (c) map {subdomain}.get4domain.com → /site/[subdomain] via nginx rewrite when
  ready. Dev frontend targets PROD api (gapi.get4domain.com) and there is no local backend/DB.
- [!] END-TO-END TEST DEFERRED (autonomy: pause before touching real vendor data): adding a
  listing as a real test vendor + confirming it renders on the live site writes real data to
  the (as-yet-unmigrated) prod DB — NOT done here. Do after the VM steps, ideally with a
  dedicated test vendor. Sandbox-unaffected + image-upload-both-places to be confirmed then.

### DISPATCH — GET4DOMAIN_DISPATCH_15AUG2026 — PHASE 1 (code done; VM steps pending)
Locked Phase 0 model: single product DomainApp ₹999/month ONLY (no annual), wallet min ₹499,
industry keys standardized to backend set (clinic/salon/gym), hybrid frontend architecture.
- [x] 1.1 Pricing sweep → ₹999/month everywhere (removed all ₹6,999/₹583/annual + tier UIs):
  marketing (home, pricing, domain-app, domain-campaign, industries/[id], about, refund-policy),
  root layout (title/desc + SoftwareApplication JSON-LD offer 999), admin (leads WA template,
  plans → single plan, pricing DEFAULTS domainapp_annual→domainapp_monthly '999', send-quote,
  invoices examples), dashboard (go-live checkout desc + summary, page sandbox banner,
  domain-campaign reframed "included in DomainApp", my-services collapsed to single plan +
  REMOVED the 6-Months/Yearly toggle), api.ts comment, orphaned ProductsOverview. Wallet min:
  added ₹499 tier (frontend TOPUPS + wallet TOPUP_TIERS). Backend: platform-settings key
  domainapp_annual→domainapp_monthly (label + PRICE_DOMAINAPP_MONTHLY env), demo.service buy
  flow amount 699900→99900 + endDate +1yr→+1mo + invoice desc monthly, demo.controller summary,
  ai.service assistant pricing context, invoices.service comment, invoice/quote DTO examples.
  KEPT (correctly): domain-registration ₹599/₹999-per-year prices; demo-content/demo-catalog
  sample service prices (a ₹6,999 hotel suite etc. are vendor demo data, not the plan).
  RAZORPAY: flow is a ONE-TIME order (no subscription object) — amount changed to ₹999, period
  to monthly (one-time charge, manual renewal). A true auto-recurring Razorpay Subscription/
  autopay mandate was NOT built (that's the paused checkout-flow change) — awaiting KSM decision.
- [x] 1.2 Broken CTA: no `href="\..."` backslash exists anywhere in the repo (pricing line 95
  already uses `/book-demo`). Verified via repo-wide grep. Nothing to fix.
- [x] 1.3 Industry-key migration (frontend → backend keys, backend UNtouched): renamed
  healthcare→clinic, beauty→salon, fitness→gym across industry-content ids, content.ts
  (id + industryId), industries-list, demo-site SUBCATEGORIES, demo-catalog DEMO_CATALOG +
  DEMO_SUBCATALOG, listing-fields FIELDS, sitemap industries[], my-products labels,
  admin/customers select, marketing industry-card hrefs. Added a frontend alias bridge
  (canonicalIndustryId in demo-site + CATALOG_ALIASES + FIELD_ALIASES) mirroring the backend's
  existing INDUSTRY_ALIASES, so legacy /demo/healthcare URLs and any stored vendor.industry=
  'healthcare' still resolve. Verified live: /demo/clinic, /demo/clinic/dental, /demo/salon,
  /demo/gym render; /demo/healthcare renders Clinic via alias; /industries/clinic renders;
  retired /industries/healthcare → not-found (canonical is /clinic). Frontend fetches dashboard
  config from backend (getIndustryConfig, alias-aware) so stored values resolve there too.
- [!] 1.4 Schema sync — VM ONLY (cannot run from Claude Code, no SSH): `npx prisma db push`
  inside the backend container for VendorProduct.customFields + VendorCMS.banner (already in
  schema from the CMS-editor dispatch, still pending on prod). PAUSE per instruction: confirm no
  data loss on tables with existing rows before running --accept-data-loss against production.
- [!] 1.5 AI Studio smoke test — VM ONLY: run a real text + image generation as a test vendor.
  If image still fails after key resolution, likely cause = OpenAI account lacks billing
  (DALL-E needs a funded account) — check platform.openai.com, report rather than debug code.
- Build: frontend 0 errors (340 static pages), backend 0 errors, console clean. NOT deployed to
  VM (deploy/db push/docker ps require SSH — human step). Existing vendor.industry='healthcare'
  rows keep working via aliases; an optional DB normalization to 'clinic' touches live data → deferred.

### DISPATCH — GET4DOMAIN_DISPATCH_15AUG2026_PHASE1B — DECISION 1 (free credit ₹999→₹499) DONE
Decision 2 (Razorpay Subscriptions) NOT started — awaiting KSM go-ahead (plan_id + mandate
capability, per Phase1B 2.1). Phase 2/3 of the original dispatch also not started.
- [x] Free-credit value: backend demo.service pro_free_credit default 99900→49900 (₹499);
  admin/pricing DEFAULTS pro_free_credit '999'→'499'; platform-settings comment ₹999→₹499.
  FORWARD-ONLY: the value is read at sandbox→live conversion time (grantCredit), so only NEW
  signups get ₹499 — already-granted wallet credit (stored txns) is untouched. No retroactive
  change made (respects the pause rule).
- [x] Copy echoing the old ₹999 free credit → ₹499: marketing home (feature list + FAQ),
  pricing (meta desc, AI-Studio include, 2 FAQs, wallet section), domain-app (meta + summary),
  domain-campaign (wallet note), refund-policy (non-refundable line), dashboard/go-live (2:
  included-list + success message).
- [x] PRESERVED (correctly NOT changed): the ₹999/month PRICE everywhere, the ₹999 wallet
  TOP-UP tier (→₹1,100), topup_999_credits key, my-services/ProductsOverview price, and the
  "What happens after I pay ₹999?" FAQ question (that ₹999 is the price; only its answer's
  credit figure changed). trial_free_credit (₹100) unchanged.
- Build: frontend 0 errors (340 pages), backend 0 errors, console clean. Verified live: pricing
  shows ₹999/month price + ₹499 free credit. NOT deployed (VM steps below still pending).
- Admin note: on prod, if a `pro_free_credit` setting row already exists at 99900 it will
  OVERRIDE the new code default — set it to 49900 (₹499) in Admin → Pricing after deploy.

### DISPATCH — GET4DOMAIN_DISPATCH_COMPLETE_15AUG2026 — continuous run (in progress)
GATE (self-verified against prod DB, session of this entry):
- [x] #1 Free credit: NO pro_free_credit override row in prod → code default 49900 paise
  (₹499) applies. RESOLVED, nothing written. (Units note: setting stores RUPEES, so a real
  value is "499", never 49900 — 49900 would be ₹49,900.)
- [!] #2 AI image gen: OpenAI+Anthropic keys CONFIGURED on prod (DB). Real end-to-end call
  BLOCKED by the harness auto-mode classifier (tried minting a sandbox-vendor JWT → live
  /ai/generate-image). NOT self-verifiable here — needs KSM (logged in) or a VM run.
- [x] #3 Razorpay: live key encrypted in prod, PLATFORM_SETTINGS_KEY absent locally → can't
  call Razorpay API. Checked authoritative payment records instead: 0 paid invoices, 0
  razorpayPaymentId, 0 subscriptions → NO real transactions. Clean, no Stop-1 trigger.
- PROD FACTS: 3 real (non-sandbox) vendors + 9 sandbox; 0 payments/subscriptions. So Stops
  2 & 5 are live; new tables are additive (non-destructive) so creating them is fine, but
  db push is still a VM step.
DECISION 2 (Razorpay subscriptions): SKIPPED — no plan_id provided.

TRACK A:
- [x] 2.1 Industry skins — IndustrySkin (accent pair, welcome, quick actions) derived from
  each industry config (deriveSkin/getIndustryConfigWithSkin); industries API returns skin;
  findOne now resolves aliases; vendor dashboard overview renders the industry banner.
  Commit 867c8a7. (shared components untouched — layer on top, hybrid architecture.)
- [x] 2.2 AI template library (backend) — g4d_ai_templates + full module (vendor list /
  admin CRUD). 2.3 Website theme system (backend) — g4d_website_themes (CSS-var driven) +
  module (@Public list / admin CRUD) + VendorCMS.themeId. api.ts client methods added.
  Commit 5d6e0d6. PENDING: admin management UI + vendor browse/select UI (next increment).
- [ ] 2.4 Native share (navigator.share on AI Studio results) — not started.
- [ ] 2.5 Animated marketing mockups — not started.
TRACK A — COMPLETE:
- [x] 2.1 skins (867c8a7) · 2.2/2.3 backend (5d6e0d6) · 2.2/2.3 UI — admin Content Library
  + AI Studio template picker + my-website theme picker (369a89f) · 2.4 native share
  (navigator.share on AI Studio results) + 2.5 animated industry mockups (68f9c2f).
TRACK B — 2A–2D done, 2E–2G pending:
- [x] 2A vendor KPI cards on overview (real, vendorId-scoped) — 8398527.
- [x] 2B auto-bot support (bot-first via /ai/chat; escalation → category='Escalation'
  ticket for the admin queue; direct-ticket form kept) — 0165dd1.
- [x] 2C accounting — g4d_expenses + accounting module (GST EXCLUSIVE, matches
  invoices.service GST_RATE 0.18 + GenericInvoice); vendor Accounts page: P&L cards, GST
  statement, expense CRUD + branded voucher print, online/offline split — 4e7867d.
- [x] 2D office/stationery tracker — g4d_stationery + module + vendor page (qty +/-,
  reorder-level low-stock flag) — ddd671c.
- [x] 2E tool-utilization analytics — DERIVED from existing tables (no usage-events table;
  wiring verified: AI=WalletTransaction service~'ai_', comms=Message out, campaigns=
  CampaignPage, leads=CampaignLead, calls=CallLog, listings=VendorProduct). /analytics/usage
  (vendor) + /analytics/usage/all (admin). Vendor: Analytics Hub 'usage this month'. c63ad15.
- [x] 2F admin — escalation queue (admin Support All/Escalations filter on category=
  'Escalation'), cross-vendor utilization (/admin/utilization uses usage/all), aggregate
  accounting (/analytics/platform-accounting — totals only, NO vendor private expenses). 97c6dac.
- [x] 2G marketing copy — mini-BOS positioning (accounts/GST, stationery, AI support) +
  existing-website FAQ; truthful, only shipped features. 74d213f. TRACK B COMPLETE.
TRACK C — 3D done; 3A/3B/3C/3E pending:
- [x] 3D department-based team invites — additive TeamMember.department + invite Department
  picker (Sales/Support/Accounts/Marketing) prefilling default module access. 3e4176b.
- [x] 3C admin per-vendor override (Vendor.configOverride; /industries/me merges skin +
  override live; admin vendor-access panel: accent/welcome/template). 025d734.
- [x] 3A real customer portal — was already real (OTP+SMS, tenant-scoped Record/GenericInvoice);
  closed the one flagged gap: in-memory sessions → stateless JWT with a customer-specific
  secret (can't be replayed on vendor routes). 6f3e11e.
- [x] 3B embeddable widget + API — Vendor.widgetKey (public, unique); /widget config/lead/
  chat/embed.js (reuses 2B AiService; leads → CampaignLead source='widget'); vendor Embed
  page; CORS→origin:true (safe, Bearer-authed). embed.js node --check-verified. b1da62c.
- [~] 3E provider config scaffolding (credit-agnostic): ai/stability_api_key +
  video/kling_api_key settings, video chain runway→heygen→kling→none. 8b3a014.
  ⏸ STOP 4 — real Stability image call + real Kling/HeyGen/Runway video integrations NOT
  written (unverifiable/harness-blocked; don't assume funded credit). AWAITING KSM: which
  providers have funded working accounts.
TRACK C: 3A/3B/3C/3D DONE; 3E scaffolded + paused at Stop 4.
VM STEPS PENDING (all additive/non-destructive): `prisma db push` for: Phase-1
(VendorProduct.customFields, VendorCMS.banner); Track-A (g4d_ai_templates,
g4d_website_themes, VendorCMS.themeId); Track-B (g4d_expenses, g4d_stationery); Track-C
(TeamMember.department). Deploy + the 2 blocked verifications (image-gen, AI-provider
funded-credit for 3E) are on KSM's side. Decision 2 (Razorpay subscriptions) still SKIPPED
(no plan_id).

### DISPATCH — GET4DOMAIN_DISPATCH_TELECRM_REDESIGN_17AUG2026 — COMPLETE
Reverses the earlier "TeleCRM Kanban-only" decision: list/dialer as the DEFAULT, Kanban
demoted to a secondary "Pipeline" tab (kept, not removed).
- [x] A — vendor home business-module cards (TeleCRM/Growth Hub/AI Studio/Accounts/Comms/
  Website, one real stat + Open, reuses 2A + /analytics/usage). d015030.
- [x] B backend — CampaignLead.customFields (additive); POST /crm/leads/import (call-list
  import, CRM-only, NOT messaging consent); GET /crm/telecrm/recent-calls; api methods. 7c4edd7.
- [x] B frontend — TeleCrmBoard redesign (40f4525): List is now the DEFAULT view —
  always-visible search (name/number), Today's Tasks (Overdue/Today from follow-up
  reminders), Recent Calls (call-log history via /crm/telecrm/recent-calls), and a flat
  contact list (status badge + last-called). Add/CSV-import modal writes to the vendor's
  OWN call list with the consent boundary labeled in-UI ("your call list, NOT a campaign
  list — no bulk-messaging consent"). Professional empty states (branded icon tile + line
  + action) on every section. Kanban preserved as a secondary "Pipeline" tab. Industry-aware:
  contactFields from recordCustomFields + contactNoun from the industry contact label
  (reuses useDashboardConfig; all 20 industries via config, no per-industry files).
  admin/telecrm unaffected (optional adapter methods absent → add/import/recent auto-hide).
- Both apps build 0 errors. Behind auth → build-verified, not click-tested from Claude Code.
VM: db push adds CampaignLead.customFields (additive) — folds into the single pending push
in docs/VM_DEPLOY_RUNBOOK.md. No other new migration.

### DISPATCH — GET4DOMAIN_DISPATCH_LEGACY_MIGRATION_17AUG2026 — MR TRAVELS DONE (parallel), cutover GATED
"Never touch MR Travels/3000/3001" REVOKED by KSM; CLAUDE_MEMORY_V2.md updated to match.
- [x] Read legacy content first. Legacy Supabase DB unreachable from dev (IP allow-list, VM-only);
  content read from the live public site + repo BRAND. Legacy DB holds only placeholder catalog
  (1 test package, 1 test vehicle) — never launched. Inventory: LEGACY_MIGRATION_MRTRAVELS_CONTENT.md.
- [x] Content Library multi-theme-per-industry ALREADY existed end-to-end; only gap was preview
  thumbnails → wired admin form/list + vendor picker to WebsiteTheme.preview. 25618e1.
- [x] MR Travels vendor already existed (admin@mrtravels.com, subdomain mrtravels, owner
  Jayachandran, non-sandbox) but EMPTY. Migrated content onto it (NO account creation):
  VendorCMS + 7 VendorProducts + custom "Heritage Gold" travel theme. Idempotent, additive.
  scripts/migrate-mrtravels.ts + scripts/mrtravels-content.ts. 0d81ea1.
- [x] VERIFIED LIVE (parallel, NO cutover): get4domain.com/site/mrtravels — hero+tagline+WhatsApp,
  full About, 7 packages (incl. Munnar ₹8,000 3D/2N on /listings), contact page. Builds 0 errors.
- [!] HARD STOPS (await KSM): DNS/traffic cutover; deleting legacy MR Travels/Allwin containers/data.
- [!] KSM decisions: operational-BOS gap (new site is marketing+lightweight core, NOT the full ERP —
  cutover loses bookings/fleet/quotations/invoicing/portals unless built as addons); real GSTIN;
  re-upload logo. See docs/LEGACY_MIGRATION_STATUS.md.
- [ ] Allwin Tours (3010): vendor "allwintours" exists but empty — same content-migration step
  pending (not started). Its DB likely IP-blocked too; read from its public site.

### DISPATCH — GET4DOMAIN_DISPATCH_AI_STUDIO_REDESIGN_17AUG2026 — A + B DONE (Canva scaffolded, gated)
Depends on Canva Integration (gated on KSM prereqs) + Template-Driven CMS (not built). Verified
both greenfield: g4d_ai_templates had no source/canvaTemplateId; no cmsSchema; no Canva code.
- [x] Backend (f74e933): AiTemplate additive source('prompt'|'canva'|'document')/canvaTemplateId/
  fields; list ?source filter. New business-documents module — coded letterhead/visiting-card/
  id-card templates reusing the invoice HTML→print-to-PDF mechanism; GET /business-documents/
  templates + POST /render (stateless, no vendor/payment data). Additive schema → VM db push.
- [x] Section A (2a14089): vendor AI Studio (admin mount re-exports it) split into 3 modes chosen
  up front — AI Generate (existing, picker now source=prompt), Business Documents (field-def
  forms prefilled from profile, live preview + Download/Print via the render endpoint; dropped the
  old AI-image-background docHtml), Canva Templates (thumbnail picker + data-fill form; honest
  "not set up yet" + disabled generate since Canva is gated), + Library.
- [x] Section B (6f82d7a): admin Content Library Templates tab = one list filterable by type
  (All/AI Prompt/Canva/Business Document). Prompt+Canva = DB rows w/ source badge; Business
  Documents = coded built-ins shown read-only ("Built-in" lock). Themes stay a separate tab.
- [x] Both apps build 0 errors. FieldDef form shape = the future cmsSchema shape (no rewrite later).
- [!] Canva Templates real autofill/export/OAuth = the Canva Integration dispatch, GATED on KSM's
  4 prereqs (Enterprise account, private integration, ≥1 Brand Template published, creds in Admin →
  Integrations). Not built — UI scaffolding only. Template-Driven CMS cmsSchema also not built
  (used fixed field lists now, structured to adopt it later).
- [x] KSM feedback correction (5399d1b): reduced to TWO creation modes — "AI Generate" +
  "AI Template" (Business Documents folded into AI Template as entries, not a 3rd mode). Removed
  ALL user-facing "Canva" wording (provider-agnostic copy); internal source='canva'/canvaTemplateId
  unchanged. Admin Content Library filters now All/AI Prompt/AI Template; business docs folded in.
- [x] Showcases (0137333): both modes are showcase/browse entry points showing pricing up front.
  New GET /ai/costs resolves per-use content pricing from the SAME rate table + key map the
  deduction uses (one source of truth) — frontend no longer hardcodes a 2nd price copy. AI Template
  = category grid (Business Card/Letterhead/ID Card/Poster/Flyer/Brochure/Social Graphic) w/ pricing
  → gallery (synced-by-category + staged placeholders; swap-in = data change). Business docs Free.
- [!] QUALITY GAP (flag for KSM): the coded business-document PDFs are functional but NOT yet
  visually polished. Real fix needs better-designed coded templates OR the design-provider
  integration once connected — not a relabel.
- [x] Both apps build 0 errors throughout.
VM: db push adds AiTemplate.source/canvaTemplateId/fields (additive) — in VM_DEPLOY_RUNBOOK.

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
