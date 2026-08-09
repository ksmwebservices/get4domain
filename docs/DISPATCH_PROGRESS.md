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

### Batch 1 (B2): Travel, Restaurant, Clinic, Hotel, Salon
- [ ] B2.1 Travel dashboard pages (Bookings, Fleet, Drivers, Trip Sheets)
- [ ] B2.2 Restaurant dashboard pages (Orders, Tables, Menu, Kitchen Display)
- [ ] B2.3 Clinic dashboard pages (Appointments, Patients, Doctors, Prescriptions)
- [ ] B2.4 Hotel dashboard pages (Reservations, Rooms, Housekeeping)
- [ ] B2.5 Salon dashboard pages (Appointments, Services, Stylists)
- [ ] B2.6 npm run build 0 errors, commit, push

### Batch 2 (B3): Gym, Real Estate, Education, Retail, Construction
- [ ] B3.1-B3.5 (same pattern per industry)
- [ ] B3.6 npm run build 0 errors, commit, push

### Batch 3 (B4): Events, Finance, Automobile, Logistics, Diagnostics
- [ ] B4.1-B4.5 (same pattern per industry)
- [ ] B4.6 npm run build 0 errors, commit, push

### Batch 4 (B5): Photography, Professional, Agriculture, Coaching, Technology
- [ ] B5.1-B5.5 (same pattern per industry)
- [ ] B5.6 npm run build 0 errors, commit, push

## STAGE 4 — UNIVERSAL MODULES (Dispatch C, D, E)

### Dispatch C — TeleCRM + AI Studio
- [ ] C1. TeleCRM 3-panel layout (Queue/Detail/Activity)
- [ ] C2. Call flow modal + voice-note AI summary wiring
- [ ] C3. Pipeline Kanban view
- [ ] C4. AI Studio content-type grid + generation flow
- [ ] C5. AI Studio Library tab
- [ ] C6. npm run build 0 errors, commit, push

### Dispatch D — Growth Hub (refactor existing Campaign module)
- [ ] D1. Rename/restructure Campaign → Growth Hub in UI
- [ ] D2. Direct social publish flow (mock Meta service layer)
- [ ] D3. Paid ads request flow (mock Meta/Google Ads service layer)
- [ ] D4. npm run build 0 errors, commit, push

### Dispatch E — Customer Hub + Communication Hub (mock layer)
- [ ] E1. Customer Portal (OTP login, Records, Invoices, Support)
- [ ] E2. Customer Hub vendor-side settings tab
- [ ] E3. Communication Hub unified inbox UI
- [ ] E4. Mock service layer: whatsapp.service.ts, meta.service.ts, google-ads.service.ts, sms.service.ts (real gateway swap-ready)
- [ ] E5. npm run build 0 errors, commit, push

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
