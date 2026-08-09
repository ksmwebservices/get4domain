# GET4DOMAIN v2.0 — DISPATCH PROGRESS LEDGER
# Claude Code updates this file after EVERY task.
# On session resume, read this FIRST to know exactly where to continue.

Legend: [ ] not started · [~] in progress · [x] done · [!] blocked

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
- [ ] C1. TeleCRM 3-panel layout (Queue/Detail/Activity) — NOT STARTED (existing /dashboard/telecrm + /crm remain as-is; refactor pending)
- [ ] C2. Call flow modal + voice-note AI summary wiring — NOT STARTED (backend /ai/call-summary + /crm/leads/:id/call already exist)
- [ ] C3. Pipeline Kanban view — NOT STARTED
- [x] C4. AI Studio content-type grid + generation flow — efef5eb
- [x] C5. AI Studio Library tab (localStorage-backed) — efef5eb
- [x] C6. build 0 errors, committed, pushed (AI Studio portion)

### Dispatch D — Growth Hub (refactor existing Campaign module)
- [~] D1. Naming done in shell (Growth Hub → /dashboard/campaigns). Page-level restructure of existing campaigns UI still pending.
- [x] D2. Backend publish flow (mock Meta) — POST /growth-hub/publish (3278e8a) + API client method (8247ed4). Frontend publish button in campaign approval step: PENDING.
- [x] D3. Backend paid-ads flow (mock Meta/Google Ads) — POST /growth-hub/ads, GET /growth-hub/ads, admin launch (3278e8a) + API methods (8247ed4). Frontend Ads tab UI: PENDING.
- [x] D4. backend build 0 errors, committed, pushed

### Dispatch E — Customer Hub + Communication Hub (mock layer)
- [ ] E1. Customer Portal (OTP login, Records, Invoices, Support) — NOT STARTED
- [ ] E2. Customer Hub vendor-side settings tab — NOT STARTED
- [ ] E3. Communication Hub unified inbox UI — NOT STARTED (shell links to /dashboard/communication)
- [x] E4. Mock service layer: whatsapp/sms/meta/google-ads services (real-gateway swap-ready, read keys via platform-settings) — 3278e8a
- [x] E5. backend build 0 errors, committed, pushed (E4 portion)

## STAGE 5 — PLATFORM POLISH (Dispatch F, G)

### Dispatch F — Analytics Hub + Website Manager
- [ ] F1. Analytics Hub (revenue, leads funnel, campaign performance, wallet usage)
- [ ] F2. Website Manager CMS engine
- [ ] F3. Industry design template mapping
- [ ] F4. npm run build 0 errors, commit, push

### Dispatch G — Admin Platform rebuild
- [ ] G1. Settings → Integrations UI (all API keys, encrypted, test-connection)
- [ ] G2. Module/Addon toggle UI per vendor
- [ ] G3. Vendor onboarding flow (industry pick, module/addon assignment)
- [ ] G4. npm run build 0 errors, commit, push

## STAGE 6 — MOBILE/PWA POLISH (Dispatch H)

- [ ] H1. PWA manifest audit across all apps
- [ ] H2. Offline support basics
- [ ] H3. Install prompts
- [ ] H4. Push notification wiring verification (all modules)
- [ ] H5. npm run build 0 errors, commit, push

## STAGE 7 — INTEGRATION & DEPLOY (Dispatch I)

- [ ] I1. Full VM deployment (all stages)
- [ ] I2. Migration run (backend-api)
- [ ] I3. Smoke test: auth, wallet, one industry dashboard end-to-end
- [ ] I4. Verify MR Travels still healthy (port 3000/3001)
- [ ] I5. Verify Allwin Tours still healthy (port 3010)
- [ ] I6. Cloudflare cache purge
- [ ] I7. Final report to human

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
