> **Evidence file — static audit, 2026-10-02.** Produced by read-only code inspection (no runtime, no DB writes, no provider calls). Every status is "static-verified only" unless stated. This is raw supporting evidence for [AUDIT_REPORT.md](../AUDIT_REPORT.md); where it disagrees with AUDIT_REPORT.md or STATUS.md on post-audit changes, those win.

# Get4Domain Frontend Audit (V2 PRD 92.2 Dashboard/UI Action Matrix)

Scope: `C:\Get4Domain\get4domain-site\get4domain_mvp` (Next.js 15 App Router). Method: static inspection only (Read/Grep + three throw-away node scripts in the scratchpad that parse api.ts and the backend controllers). Nothing was built, run or edited. **Every status below is "static-verified only"** (code read, never executed).

Scripts used (scratchpad): `api_audit.js` (api method usage), `routes_check2.js` (api.ts path vs backend `*.controller.ts` route match), `page_stats.js`, `state_cov.js`.

---------------------------------------------------------------------------
## 0. Headline numbers

| Metric | Value |
|---|---|
| `page.tsx` routes | **89** (+3 `route.ts` API handlers, `manifest.ts`, `robots.ts`, `sitemap.ts`) |
| Vendor dashboard pages | 30 (dynamic `[tab]` fans out to 51 per-industry view components) |
| Admin pages | 22 |
| `api.*` methods in api.ts | **453** |
| api methods never called anywhere in src (dead client code) | **46 (10.2%)** |
| api paths NOT found in backend controllers | **0 of 453** (446 auto-matched, 7 hand-verified). Method+path only; DTO shape/guards not checked |
| Backend-generated frontend link with NO frontend route | **1 (BROKEN)**: vendor team invite -> `/team/accept-invite` |
| Dashboard+admin pages that are fully data-backed (a) | **41 / 52 = 79%** |
| ...mixed (d) | 6 / 52 = 12% |
| ...static / UI-only (b) | 5 / 52 = 10% (vendor: notifications, settings, domain-app index; admin: plans, settings) |
| Data-fetching pages/views with loading + shown-error + empty state | 27 / 97 = **28%** (pages 59%, domainapp views **0%** error display) |
| `console.log` in src | 0 (2 `console.error`) |
| `: any` annotations | 121 (0 `as any`, 0 `@ts-ignore`) |
| Frontend automated tests | **0** (no test files, no jest/vitest/playwright, no test script) |
| ESLint config / dependency | **none** (`next lint` script exists, no `.eslintrc*`, no eslint in devDependencies) |

---------------------------------------------------------------------------
## 1. Route inventory (89 page.tsx)

### 1a. Marketing / public (24 in `(marketing)` + 3 public utility = 27)
`/` (root `(marketing)/page`), `/about`, `/book-demo`, `/cart`, `/checkout`, `/contact`, `/digital-growth`, `/domain-app`, `/domain-campaign`, `/features`, `/how-it-works`, `/industries`, `/industries/[id]`, `/managed-services`, `/portfolio`, `/pricing`, `/privacy-policy`, `/products`, `/quote/[token]`, `/refund-policy`, `/support`, `/talk-to-sales`, `/templates`, `/terms` (24)
+ `/go/[slug]` (public campaign page), `/offline`, `/order-success` (3)

### 1b. Auth / register / login (3)
`/login`, `/register`, `/admin-team/accept-invite`
(NOTE: there is **no** `/team/accept-invite` - see finding F1.)

### 1c. Vendor dashboard (30)
`/dashboard`, `/dashboard/accounts`, `ai-studio`, `billing`, `campaigns`, `communication`, `crm`, `customer-hub`, `domain-app` (index), `domain-app/[tab]`, `domain-management`, `embed`, `go-live`, `invoices`, `landing-page`, `my-products`, `my-services`, `my-website`, `notifications`, `orders`, `payments`, `reports`, `settings`, `stationery`, `support`, `team`, `telecrm`, `wallet`, `website-engine`, `whatsapp-bot`

### 1d. Customer portal (1)
`/customer` (single-page, tab state; 8 `/customer/*` endpoints, all exist)

### 1e. Admin (22)
`/admin`, `accounting`, `ai-studio` (re-export of vendor AI Studio), `api-settings`, `campaigns`, `cms`, `customers`, `domains`, `invoices`, `leads`, `library`, `managed-services`, `plans`, `pricing`, `renewals`, `send-quote`, `settings`, `support`, `team`, `telecrm`, `utilization`, `vendor-access`

### 1f. Engine / site / demo (6)
`/demo/[category]/[[...rest]]`, `/engine/preview/[industry]`, `/site/[subdomain]/[[...rest]]`, `/theme-local-test/[[...slug]]`, `/theme-preview/[id]`, `/visit-demo`

### 1g. API routes (3)
`/api/demo/start`, `/api/demo/tour-pass`, `/api/demo/verify` (+ `middleware.ts`, matcher `/demo/:path*` ONLY)

Sum: 27 + 3 + 30 + 1 + 22 + 6 = 89.

**Auth boundary observation:** `middleware.ts` guards only `/demo/*`. `/dashboard` and `/admin` are protected purely client-side (`useAuth()` + `router.push('/login')` in the layouts, role from `localStorage.g4d_user`). Real security rests on backend guards (not verified here). Layouts render a spinner until the check completes, so no data leak by design, but there is no server-side route protection.

---------------------------------------------------------------------------
## 2. Per-page data-source classification (vendor dashboard + admin)

Legend: **(a)** real `api.*` calls in effect + rendered; **(b)** static/hard-coded; **(c)** localStorage only; **(d)** mix. Handlers = are there working onClick/submit handlers.

### 2a. Vendor dashboard (30)

| Page | Source | Handlers? | Static / hard-coded evidence (file:line) | Status |
|---|---|---|---|---|
| dashboard (home) | a | Links only (quick actions) | KPIs derived from 7 parallel api calls, each `.catch(() => ({data:[]}))` -> failures render as 0 (page.tsx:~66-72); stale copy "everything included for 999/month" (page.tsx:157); header bell has an always-on red dot (layout.tsx:359) | PARTIAL |
| accounts | a | Yes (expense/payment/GST CRUD, 20 industry summaries) | 24 silent catches (swallowed errors) | WORKING |
| ai-studio | a + c | Yes | Generated-content "library" lives only in `localStorage g4d_ai_library_<user>` (ai-studio:258,299) - not server persisted; video cost label "Free (mock)" when provider none (:633) | PARTIAL |
| billing | a | Yes (Razorpay pay pending invoice) | Plan tier label inferred from hard-coded paise amounts 1198800/2398800 (billing:36-39) and hard-coded price prose (:290); page reachable only via invoices/domain-app index links (not in nav) | PARTIAL |
| campaigns (Growth) | a + c | Yes (create page w/ AI, list, analytics) | "Schedule reminder" written to `localStorage` and **never read** (campaigns:303, grep shows 1 hit) ; `MoreVertical` icon decorative (:169); `SITE_URL` hard-coded (:15); Growth-Hub publish/ads endpoints have no UI | PARTIAL |
| communication | a | Yes (threads, send, settings) | `NEEDS_SETUP = {whatsapp:true, email:false, sms:true}` is a **constant** (communication:49): WhatsApp/SMS inbox is permanently replaced by "Setup" screen even after the vendor verifies their number; `alert()` for errors (:77,:84) | PARTIAL |
| crm | a | Yes (add, status, note, CSV export, tel:/wa.me) | none | WORKING |
| customer-hub | a + local | Invite = api; portal toggle is local | `portalOn` toggle never persisted (customer-hub:17,62); invite result says "mock - gateway pending" (:38) | PARTIAL |
| domain-app (index) | **b** | Visit-site links only | Entire page hard-coded to "mrtravels.get4domain.com", "Enterprise plan - Renews 15 Jan 2027", 5 "Active" modules (domain-app/page.tsx:5-11,22). No api calls. **Orphan** (no nav/link to it) | MOCKED |
| domain-app/[tab] | a (dispatcher) | n/a | 51 views all api-backed; 2 tabs fall to `ComingSoon` stub: gym/attendance, realestate/documents (tab-registry STUB/addon rule) | WORKING (2 tabs MISSING) |
| domain-management | a | Yes (search, register, connect, verify) | fallback `aRecordIp: '34.14.130.68'` hard-coded (:~55,:~58); TLD price prose "599/year .in" (:181); registrar `alert()` (:78) | PARTIAL (registrar creds external) |
| embed | a | Copy snippet/curl | none | WORKING |
| go-live | a (+Razorpay) | Yes | Plan totals/included-feature lists hard-coded (go-live:31-56) not from `/pricing` API | PARTIAL |
| invoices | a | Download(PDF html window), email, WhatsApp share | no "create invoice" UI (vendor); `api.getInvoice` unused | PARTIAL |
| landing-page | a | Yes (generate, create, update) | QR image from third-party `api.qrserver.com` (:218) | WORKING |
| my-products | a | Yes (CRUD + upload) | none | WORKING |
| my-services | d | Request = support ticket | Hard-coded 8-item ADDONS price list (my-services:15-24) + `PLAN = {monthly: 999}` (:13); **orphan** (no link anywhere); pricing contradicts current Workspace/BOS annual tiers | MOCKED |
| my-website (CMS editor) | a | Yes (save CMS, portfolio autosave, theme unlock/pay) | image upload failures swallowed `catch { /* optional */ }` (:~92,:~149) | WORKING |
| notifications | **b** | none | 4 hard-coded notifications for "MR Travels", "INV-001 Rs 29,499" (notifications/page.tsx:3-8). The real `/notifications` API + `markNotificationRead` exist but are unused here | MOCKED |
| orders | a | List only | none | WORKING |
| payments | a | Yes (save own Razorpay creds, toggle) | none | WORKING |
| reports (Analytics Hub) | a | Display | **Unit bug**: wallet amounts are paise (wallet page divides by 100) but reports prints them as rupees: "Wallet Spent" and per-service bars are 100x overstated (reports:58,90,~150) | BROKEN (display) |
| settings (Profile) | **b** | Fake save | `defaultValue="Muthukumar R"`, "info@mrtravels.com", "+91 98765 43210", "MR Travels" (settings:32-46); `handleSave` = `setTimeout(...setSaved(true))`, **no API call** (settings:11-15). Password fields unused. Linked twice in nav ("Profile" and "Settings") | MOCKED |
| stationery | a | Yes | silent `.catch(() => {})` on writes | PARTIAL |
| support | a | Yes (AI chat -> escalate -> ticket) | categories array static (fine) | WORKING |
| team | a | Yes (invite/edit/remove) | Invite email links to a non-existent route (F1) | BROKEN (accept flow) |
| telecrm | a | Yes (TeleCrmBoard 758 lines) | `generateAiCallSummary` never called, `aiSummary` never produced | PARTIAL |
| wallet | a | Yes (Razorpay topup) | `TOPUP_TIERS` + credit bonus labels hard-coded (wallet:48-53) while admin Pricing Manager has editable `topup_*_credits` keys -> UI can drift from backend | PARTIAL |
| website-engine | a | Preview/launch links | read-only readiness/action list, no editing | PARTIAL |
| whatsapp-bot | a | Yes (KB CRUD) | write failures swallowed `.catch(() => {})` (:55,61,66) | PARTIAL |

### 2b. Admin (22)

| Page | Source | Handlers? | Static / hard-coded evidence | Status |
|---|---|---|---|---|
| admin (overview) | a | Links/tel/wa.me | 4 `.catch(() => ({data:[]}))` fallbacks | WORKING |
| accounting | d + **c** | Yes | Expenses stored in **browser localStorage** `g4d_expenses` (accounting:27,36,55); net profit / ITC (hard-coded 18%, :~100) mix server revenue with per-browser expenses. Not shared across admins/devices | MOCKED (expenses) / PARTIAL |
| ai-studio | a | re-export of vendor page | n/a | WORKING |
| api-settings | a | Yes (save/test integration secrets) | none | WORKING |
| campaigns | d | "Generate ideas" = `api.chat`; **Log post = React state only**; "Upload Report" `disabled` | `postLog` in `useState` (campaigns:65-69) lost on refresh; Upload button permanently disabled with title "storage not yet connected" (:98) | PARTIAL (UI-ONLY for logging) |
| cms | a | Yes | none | WORKING |
| customers (Vendors) | a | Yes (create/suspend/activate) | none | WORKING |
| domains | a | Yes (admin register/verify) | none | WORKING |
| invoices | a | Create, send link, mark paid | "View Invoice" -> `window.open('https://gapi.get4domain.com/invoices/<id>/pdf')` (invoices:228): hard-coded host, JWT-guarded endpoint that returns `{html}` JSON, opened with no Authorization header | BROKEN |
| leads (Demo bookings) | a | Status update | WhatsApp template text still says "just 999/month" (leads:47) | PARTIAL |
| library | a | Create/delete AI templates, themes | `updateAiTemplate`/`updateWebsiteTheme` unused -> no edit | PARTIAL |
| managed-services | a | Yes (19 api calls: catalog, proposals, share) | `alert()` for share link (:87) | WORKING |
| plans | **b** | none | Static 2-plan array (plans:4-7), claims to mirror Pricing Manager; not in nav | MOCKED |
| pricing | a | Yes (per-key save) | local `DEFAULTS` fallback (pricing:10-17) | WORKING |
| renewals | a | Email/WhatsApp are `mailto:`/`wa.me` deep-links; create renewal invoice | "invoiced" tracked in React state only -> after refresh the same renewal can be invoiced twice (renewals:41,~63) | PARTIAL |
| send-quote | a | Yes (`createQuote` + channel) | none | WORKING |
| settings | **b** | Fake save | Hard-coded "+91 98765 43210", "support@get4domain.com", "Chennai..." as `defaultValue`; `handleSave` only toggles "Saved" (settings:10-13); not in nav | MOCKED |
| support | a | Reply/resolve | none | WORKING |
| team | a | Invite/role/remove | `confirm()` delete | WORKING |
| telecrm | a | Yes | same AI-summary gap as vendor | PARTIAL |
| utilization | a | Display | no error state | WORKING |
| vendor-access | a | Yes (module/addon toggles, overrides, comms override; 17 api calls) | none | WORKING |

### 2c. Domain-app view components (51 files in `src/domainapp`, dispatched by `dashboard/domain-app/[tab]`)
All 51 are (a): loading flag + empty state + CRUD via `api.*` (453-method client has per-industry summary/CRUD for 20 industries). Common defects: **0/51 display load or write errors** - 46 use `.catch(() => setRows([]))` so a backend failure looks like "No X yet"; `save()` has `try/finally` with no `catch` (unhandled rejection, no user message); `remove()` is `confirm()` then await with no catch. Status: WORKING (happy path), PARTIAL (error handling).

---------------------------------------------------------------------------
## 3. API client audit

### 3a. Counts
- `api.*` methods: **453** (`export const api = {...}`, 840 lines). Plus `apiCall` + exported `VendorCommsSettings` types.
- Dead (never referenced in any other src file): **46**.
- Direct `fetch()` outside api.ts: 15 files (customer portal, site renderer, auth.ts, pricing.ts, InvoicingView, demo route handlers). All targets verified to exist in backend (`/customer/*` x8, `/pricing`, `/auth/login|register|refresh|me`, `/cms/site/:sub`, `/domainapp/invoices/:id/pdf`, `/engine/public/:sub/actions/*`, `/leads/demo/visit`).

### 3b. Dead API methods (46) and what they mean
| Group | Methods | Interpretation |
|---|---|---|
| Growth Hub (Meta/Ads mock layer) | growthPublish, growthRequestAd, growthListAds, growthLaunchAd | BACKEND-ONLY: backend `growth-hub` module exists, **no UI** calls it |
| Campaign approval flow | createCampaign, getCampaign, approveCampaign, getCampaignAnalytics, getCampaignPage, deleteCampaignPage | BACKEND-ONLY: UI uses only campaign-**pages** (landing pages); wallet-billed "campaign request/approve" flow has no screen; vendors cannot delete a campaign page |
| Notifications | markNotificationRead, markAllNotificationsRead | Vendor notifications page is static (F4); read-state never written |
| Team | acceptTeamInvite, getTeamActivity, adminTeamMe | accept page missing (F1); team activity log has no UI |
| TeleCRM | getTelecrmQueue, generateAiCallSummary | AI summary never generated (UI), queue computed client-side |
| DomainApp core detail/delete | daGetContact, daDeleteContact, daGetCatalogItem, daDeleteCatalogItem, daGetRecord, daDeleteRecord, daGetInvoice, daInvoicePdfUrl | No delete for contacts/catalog/records in shared views (MISSING delete) |
| Vendors/Subscriptions | getVendor, updateVendor, createSubscription, activateSubscription, getInvoice | admin cannot edit a vendor or manually activate a subscription from UI |
| Templates/Themes | updateAiTemplate, updateWebsiteTheme | admin Library has create+delete but no edit |
| Misc | getSite, getVendorTickets, getDemoSite, recordDemoVisit (called from route handler server-side, not api.ts), getQuote, getDomainCampaignRecords, generateDesignImage, getModules, getAddons, engineListPublicActions, engineDispatch, updateJobLine, updateTestOrderItem, addRestaurantItem | not needed, superseded, or UI missing (e.g. restaurant add item / auto line editing) |

### 3c. Frontend -> backend path cross-check
Automated: for every `apiCall('<path>')` in api.ts (447 literal paths) the method+path was matched against 483 `@Get/@Post/@Put/@Patch/@Delete` routes in 75 `*.controller.ts` (controller prefix + method path, `:param` wildcard). **446 matched; the 1 miss was a parser artifact** (`getCrmLeads` template `${params ? ...}` - `GET /crm/leads` exists, crm.controller.ts:17). The 6 methods without a literal `apiCall` string were checked by hand: `login` (POST /auth/login), `uploadImage` (POST /uploads), `daInvoicePdfUrl` (GET /domainapp/invoices/:id/pdf), `setVendorModule`/`setVendorAddon` (POST /modules|addons/vendor/:key/enable|disable), `getManagedServicesCatalog`, `getIndustries`: all exist.
**Result: 0 path mismatches out of 453 (>> the required 40).** Caveats: (1) routes only - payload/DTO fields and role guards were not compared; (2) matching proves the route exists, not that it returns what the page expects.

Cross-boundary link mismatch found separately (backend -> frontend): `email.service.ts:103` emails `${frontendUrl}/team/accept-invite?token=` for vendor team invites; **no such page exists** (BROKEN, F1). `/admin-team/accept-invite` does exist.

Other API-client observations:
- `apiCall` always does `response.json()` - a non-JSON 502/HTML throws an opaque parse error.
- 401 handler wipes `g4d_token`/`g4d_user` and hard-redirects. **No refresh-token use anywhere in the frontend** (CLAUDE.md stack says JWT + Refresh Token). Session = one access token in localStorage (XSS-exposed).
- `admin/invoices/page.tsx:228` bypasses api.ts with a hard-coded host.

---------------------------------------------------------------------------
## 4. Dashboard / UI Action Matrix (static-verified only)

Columns: # | Screen | Action/Button | Expected | Current behaviour (from handler) | API/Service | Status | Fix

| # | Screen | Action | Expected | Current behaviour | API | Status | Fix |
|---|---|---|---|---|---|---|---|
| 1 | Dashboard home | Load KPIs/alerts | Real vendor metrics, visible error on failure | 7 parallel calls; each `.catch` returns empty data so an outage shows zeros and a false "Low wallet balance" alert (balance fallback 0) | getCrmLeads, getTelecrmFollowups, getWalletBalance, daGetInvoices, getUsage, getRecentCalls, getNotifications | PARTIAL | Surface per-widget error state; do not fabricate 0 |
| 2 | Dashboard header | Bell icon | Unread-count badge | Red dot always rendered (layout.tsx:359), count never fetched for vendors (admin layout polls 30s, vendor does not) | none | UI-ONLY | Fetch unread count, render conditionally |
| 3 | Notifications | View list | Vendor's real notifications | Renders 4 hard-coded MR Travels items | none (api.getNotifications unused here) | MOCKED | Fetch `/notifications`, add mark-read |
| 4 | Dashboard home | Quick action "New Invoice" | Open create-invoice | Links to `/dashboard/invoices`, which has no create form | none | PARTIAL | Add vendor invoice create or link to DomainApp billing tab |
| 5 | Dashboard home | Sandbox banner "Go live" | Navigate to go-live with current price | Navigates; copy says "999/month" (stale vs annual tiers) | none | PARTIAL | Pull copy from `/pricing` |
| 6 | Sidebar | "View Website" | Open vendor's live/demo site | `openMyWebsite(user)` -> `/api/demo/tour-pass` for sandbox, subdomain for live | /api/demo/tour-pass | WORKING | - |
| 7 | Header avatar | Sign out | End session | Clears localStorage client-side; no server revoke | none | PARTIAL | Call logout/revoke endpoint |
| 8 | Sidebar | Locked nav item | Upgrade path | Opens UpgradeModal -> links wallet / `/#contact` / pricing | none | WORKING | - |
| 9 | CRM | Add Lead | Create lead | `api.createCrmLead`, refresh list | POST /crm/leads | WORKING | - |
| 10 | CRM | Status dropdown | Update stage | `api.updateCrmLead(status)` | PUT /crm/leads/:id | WORKING | - |
| 11 | CRM | Add Note | Save note | `updateCrmLead({notes})` | PUT /crm/leads/:id | WORKING | - |
| 12 | CRM | Export CSV | Download CSV | Client-side `exportCsv` | none (client) | WORKING | - |
| 13 | CRM | Call / WhatsApp icons | Contact lead | `tel:` and `wa.me` deep links (no call logged) | none | PARTIAL | Log outbound action to CRM |
| 14 | TeleCRM | Call + feedback save | Log outcome, schedule follow-up, next lead | `logCall` then `updateLead`, auto-advance | POST /crm/leads/:id/call | WORKING | - |
| 15 | TeleCRM | Import call list | Bulk import | `adapter.importLeads` -> api.importCrmLeads | POST /crm/leads/import | WORKING | - |
| 16 | TeleCRM | AI call summary | Summarise notes with AI | Never invoked; `aiSummary` column stays null | POST /ai/call-summary (unused) | BACKEND-ONLY | Call `generateAiCallSummary` on save |
| 17 | TeleCRM | Voice notes | Dictate notes | Browser SpeechRecognition; error text if unsupported | none | PARTIAL | Chrome-only; document |
| 18 | Growth Hub (campaigns) | New Campaign wizard | Create shareable page | `generateCampaignPage` then `createCampaignPage` | POST /campaign-pages(/generate) | WORKING | - |
| 19 | Growth Hub | "Schedule reminder" | Remind vendor on date | Stored in localStorage key never read | none | UI-ONLY | Persist + notify, or remove |
| 20 | Growth Hub | Row "..." (MoreVertical) | Row menu (pause/delete) | Decorative icon, no handler; no delete/pause UI (`deleteCampaignPage` unused) | none | UI-ONLY | Add menu or remove icon |
| 21 | Growth Hub | Publish to Facebook/Instagram, request ads | Meta/Ads publish | No screen; backend `growth-hub` (mock Meta layer) unused | /growth-hub/* | BACKEND-ONLY | Build UI or mark deferred |
| 22 | Growth Hub | Open page / Copy link | Open /go/slug | anchor + clipboard | none | WORKING | - |
| 23 | AI Studio | Generate content | Wallet-billed AI text/poster | `generateAiContent`, cost from `/ai/costs` | POST /ai/generate-content | WORKING (creds external) | - |
| 24 | AI Studio | Save to library / history | Persisted library | localStorage per user only; lost on other device/browser | none | PARTIAL | Persist server-side |
| 25 | AI Studio | Reel / video | Render reel, async video | `renderReel`, `generateVideo`+poll status; "Free (mock)" when provider none | /reels/render, /video/* | BLOCKED-EXTERNAL | Needs provider keys |
| 26 | AI Studio | Business document render | Letterhead/ID/visiting card | `renderBusinessDocument`, preview via `dangerouslySetInnerHTML` | POST /business-documents/render | WORKING | Sanitize HTML |
| 27 | Communication | Inbox -> Email send | Send email to contact | `commSend` email; `alert()` on failure | POST /communication/send | WORKING | Replace alert |
| 28 | Communication | WhatsApp / SMS tab | Send via vendor's configured channel | Hard-coded `NEEDS_SETUP` shows "Setup" screen always | none until configured | PARTIAL | Drive from `getMyCommsSettings().waStatus` |
| 29 | Communication | Settings -> save WhatsApp/SMS/email identity | Persist | `updateMyCommsSettings` PATCH | PATCH /vendor-comms | WORKING (WhatsApp verification external) | - |
| 30 | WhatsApp Bot | Add / edit / toggle / delete Q&A | KB CRUD | api calls; failures swallowed with `.catch(() => {})` | /whatsapp-bot/kb | PARTIAL | Show errors |
| 31 | Wallet | Top up (4 tiers) | Razorpay checkout, credit wallet | `createWalletTopup` + checkout + `verifyWalletTopup`; error if `NEXT_PUBLIC_RAZORPAY_KEY_ID` missing; tier credit labels hard-coded | POST /wallet/topup(/verify) | PARTIAL | Read tiers/bonus from `/pricing` |
| 32 | Wallet | Transaction history | Ledger | `getWalletTransactions` | GET /wallet/transactions | WORKING | - |
| 33 | Billing | Pay pending invoice | Razorpay | order + verify; not in nav | POST /payments/create-order,/verify | WORKING | Add to nav |
| 34 | Invoices (vendor) | Download | PDF/print | Fetch HTML via api, open in new window | GET /invoices/:id/pdf | WORKING | - |
| 35 | Invoices (vendor) | Email invoice / WhatsApp share | Send | `emailInvoice`; WhatsApp = `wa.me` text | POST /invoices/:id/email | WORKING | - |
| 36 | My Products | Add/edit/delete + image upload | Catalog CRUD | `addProduct/updateProduct/deleteProduct/uploadImage` | /cms/vendor/:id/products | WORKING | - |
| 37 | Website Manager (my-website) | Save CMS content | Persist site content | `updateVendorCMS`; portfolio autosaves each change | PUT /cms/vendor/:id | WORKING | Surface upload errors (currently swallowed) |
| 38 | Website Manager | Unlock premium theme | Razorpay one-time unlock | `unlockThemeOrder` -> checkout -> `unlockThemeConfirm` | /website-themes/:id/unlock/* | WORKING | - |
| 39 | Website Engine | Preview demo / View live site | Launch preview | `/api/demo/start` route + links; read-only action list | /engine/actions | PARTIAL | - |
| 40 | Embed | Copy widget snippet / lead API curl | Provide key | `getWidgetKey`, clipboard | GET /widget/my-key | WORKING | - |
| 41 | Website Orders | List web orders | Orders from public checkout | `engineWebOrders` list-only (no status update / fulfil) | GET /engine/orders | PARTIAL | Add status actions |
| 42 | Payments | Save own Razorpay keys + enable toggle | Vendor-direct payments | `updateVendorPayment` | PUT /vendor-payments | WORKING | - |
| 43 | Domain | Search/Buy domain | Wallet-billed registration | `domainSearch`/`domainRegister`; `alert()` on success; "being enabled" message if registrar not configured | /domains/* | BLOCKED-EXTERNAL | ResellerClub creds |
| 44 | Domain | Connect + Verify DNS | Check propagation | `domainConnect`+`domainVerify`; hard-coded fallback A-record IP when config call fails | POST /domains/connect,/verify | PARTIAL | Remove hard-coded IP |
| 45 | Team (vendor) | Invite member | Email invite -> member sets password | `inviteTeamMember` OK; email link `/team/accept-invite` has **no page** | POST /team/invite | BROKEN | Add `/team/accept-invite` page using `acceptTeamInvite` |
| 46 | Team (vendor) | Edit role/modules, Remove | Manage access | `updateTeamMember`, `removeTeamMember` w/ `confirm()` | PUT/DELETE /team/members/:id | WORKING | - |
| 47 | Accounts | Add/delete expense, payment, GST filing | Vendor accounting | api CRUD; 24 swallowed errors | /accounting/* | WORKING | - |
| 48 | Accounts | Per-industry summary cards | KPIs per industry | 20 `*Summary` calls | /{industry}/summary | WORKING | - |
| 49 | Analytics Hub | Wallet Spent / usage bars | Rupee spend | Prints raw paise as rupees (x100) | getWalletTransactions | BROKEN | Divide by 100 |
| 50 | Customer Hub | Portal on/off toggle | Enable/disable portal | Local state only | none | UI-ONLY | Persist or remove |
| 51 | Customer Hub | Invite contact to portal | Send OTP-portal invite | `customerInvite`; alert says "mock - gateway pending" | POST /customer/invite | BLOCKED-EXTERNAL | WhatsApp/SMS gateway |
| 52 | Support | Ask AI then "get team to call me" | Chat + escalate | `api.chat` then `createTicket` | /ai/chat, /support/tickets | WORKING | - |
| 53 | Settings/Profile | Save Changes | Update vendor profile/password | `setTimeout` fake success; inputs hard-coded to "Muthukumar R / MR Travels"; password inputs ignored | none | MOCKED | Wire to vendor update/change-password endpoint |
| 54 | My Services (orphan) | Request add-on | Add-on request | Creates support ticket with hard-coded prices | POST /support/tickets | MOCKED | Remove page or drive from pricing |
| 55 | Go Live | Pay and convert sandbox | Razorpay -> real account | `demoBuyOrder`/`demoBuyConfirm`; stores new token | POST /demo/buy/* | WORKING | Prices hard-coded in UI |
| 56 | Domain-app tab (gym/attendance, realestate/documents) | Open tab | Working module | `ComingSoon` stub "being finished" | none | MISSING | Build or hide tab |
| 57 | Domain-app tab (all other 49 views) | CRUD records | Industry operations | api CRUD, loading+empty; errors swallowed | /{industry}/* | WORKING | Add error display |
| 58 | DomainApp invoicing | View PDF / send payment link / mark paid | Invoices | fetch+blob; `prompt()` to show link | /domainapp/invoices/* | WORKING | Replace `prompt()` |
| 59 | Customer portal | OTP login + records/invoices/contact | Customer self-service | Real `/customer/*` calls; token in localStorage | /customer/* | WORKING | - |
| 60 | Customer portal | Primary action (enquiry/appointment) | Create request | `/customer/actions/engine.enquiry` | POST /customer/actions/:intent | WORKING | - |
| 61 | Admin overview | KPIs | Platform metrics | 4 calls w/ silent fallback | /vendors,/invoices,/support/tickets,/leads | WORKING | - |
| 62 | Admin Leads | Update status | Lead pipeline | `updateLeadStatus` | PUT /leads/:id/status | WORKING | - |
| 63 | Admin Send Quote | Create+send quote on channel | Email/WA/SMS | `createQuote` -> communication.send | POST /admin/quotes | WORKING (WA/SMS providers external) | - |
| 64 | Admin Managed Services | Catalog edit, proposal create, share link | Quoting tool | 19 api calls; `alert()` for link | /admin/managed-services/*, /admin/quotes/* | WORKING | - |
| 65 | Admin Pricing | Edit each rate | Persist pricing | `setPlatformSetting('pricing', key)` | PUT /platform-settings/:cat/:key | WORKING | - |
| 66 | Admin Plans | View plans | Reflect Pricing Manager | Static 2-item array | none | MOCKED | Read from `/pricing`; add to nav or delete |
| 67 | Admin Campaigns | Generate ideas | AI ideas per vendor | `api.chat`, shown in modal | POST /ai/chat | WORKING | - |
| 68 | Admin Campaigns | Log post | Persist posting log | React state only | none | UI-ONLY | Add backend table |
| 69 | Admin Campaigns | Upload Report | Upload vendor report | Permanently `disabled` | none | MISSING | Wire storage upload |
| 70 | Admin Accounting | Add/remove expense | Platform P&L | localStorage `g4d_expenses` only | none (revenue from /invoices) | MOCKED | Persist expenses server-side |
| 71 | Admin Invoices | Create / send payment link / mark paid | Platform billing | api calls | /invoices/* | WORKING | - |
| 72 | Admin Invoices | "View Invoice" | Open invoice | `window.open` hard-coded host, no auth header, JSON `{html}` body | GET /invoices/:id/pdf | BROKEN | Use `api.getInvoicePdf` + blob like vendor page |
| 73 | Admin Renewals | Create Renewal Invoice | One invoice per renewal | Local "invoiced" flag; duplicates possible after reload | POST /invoices | PARTIAL | Idempotency key / server check |
| 74 | Admin Renewals | Email / WhatsApp | Notify vendor | `mailto:` and `wa.me` (not sent by platform, no audit) | none | PARTIAL | Use communication service |
| 75 | Admin Vendors | Create / suspend / activate | Vendor lifecycle | api calls | POST /vendors, POST /vendors/:id/suspend and /activate | WORKING | No edit-vendor UI (`updateVendor` unused) |
| 76 | Admin Vendor Access | Toggle module/addon, overrides, comms override | Entitlements | 17 api calls | /modules/*, /addons/*, /industries/vendor/* | WORKING | - |
| 77 | Admin Domains | Register/verify on behalf | Admin assist | api calls | /admin/domains/* | WORKING (registrar external) | - |
| 78 | Admin Library | Create/delete templates & themes | Content library | create+delete only | /ai-templates, /website-themes | PARTIAL | Add edit |
| 79 | Admin Support | Reply / resolve ticket | Support desk | `replyTicket`, `resolveTicket` | PUT /support/tickets/:id/* | WORKING | - |
| 80 | Admin Team | Invite / role / remove staff | Staff mgmt | api; `/admin-team/accept-invite` page exists | /admin-team/* | WORKING | - |
| 81 | Admin Settings | Save Changes | Persist contact details | Fake "Saved", values hard-coded; not in nav | none | MOCKED | Delete or wire to platform-settings |
| 82 | Admin Utilization | Usage + accounting view | Platform usage | `getAllUsage` + `getPlatformAccounting` | /analytics/* | WORKING | - |
| 83 | Admin TeleCRM | Call demo leads | Admin CRM | adapter -> /admin/crm/leads | /admin/crm/* | WORKING (AI summary gap) | - |
| 84 | Marketing pricing | "HRM / Office management - coming soon" | Roadmap items | labelled "coming soon" in BOS tier list and FAQ | none | DEFERRED-APPROVED (if PRD confirms) | Confirm in PRD |

Total rows: 84.

Tally (84 actions, counted by script from the table): WORKING 46 (55%), PARTIAL 16, UI-ONLY 5, MOCKED 6, BROKEN 3, BACKEND-ONLY 2, BLOCKED-EXTERNAL 3, MISSING 2, DEFERRED-APPROVED 1. Only ~55% of sampled actions are cleanly WORKING; ~45% carry a defect, stub, mock, or external dependency.

---------------------------------------------------------------------------
## 5. Orphaned / dead UI and nav integrity

**Dashboard nav (`dashboard/layout.tsx`, 4 sections + industry tabs)** links to: `/dashboard`, `/dashboard/domain-app/<tab>` (config-driven), campaigns, telecrm, ai-studio, communication, whatsapp-bot, my-products, my-website, website-engine, embed, domain-management, orders, customer-hub, reports, go-live, settings (x2), wallet, payments, invoices, accounts, stationery, team, support.
- **No nav item points to a non-existent route** (every href maps to an existing page; checked all).
- Pages NOT in the sidebar:
  - `/dashboard/my-services` - **fully orphaned** (zero inbound links anywhere); also stale pricing.
  - `/dashboard/domain-app` (index) - **orphaned**, hard-coded MR Travels content.
  - `/dashboard/billing` - reachable only from a conditional link in invoices and from the orphaned domain-app index (effectively hidden; yet it is the only place to pay a pending plan invoice via Razorpay).
  - `/dashboard/landing-page` - reachable only from a campaign detail "Edit content" link.
  - `/dashboard/notifications` - reached via header bell and home "View all" (OK).
- Duplicate nav entries: "Profile" and "Settings" both -> `/dashboard/settings` (a fake page).
- Mobile bottom nav: 5 tabs (Home, industry-operation, Campaign, AI, More) + bottom sheets. Good.

**Admin nav (20 items, role-gated, SUPER_ADMIN/MARKETING/OPERATIONS)** - all hrefs exist. Admin pages NOT in nav: **`/admin/plans`, `/admin/settings`** (both static/mock, zero inbound links = dead). Header bell on admin links to `/admin/support` (real unread poll every 30 s on notifications).

**Other dead/dormant UI:** `ComingSoon` tabs (gym attendance, real-estate documents); Growth-Hub backend with no UI; 46 dead api methods.

---------------------------------------------------------------------------
## 6. Responsiveness / UX states / PWA

**State coverage (97 data-fetching files: 46 app pages + 51 domainapp views; heuristic regex, may be +/-5%)**
- Loading state: ~98%.
- Empty state: ~90% (pages 78%, domainapp 100%).
- Visible error state: pages **74%**, domainapp **0%** -> overall 35%.
- All three: pages 59% (27/46), domainapp 0%, overall **28%**.
- 69 files contain swallow patterns (`.catch(() => {})`, `.catch(() => setX([]))`) - 23 pages + 46 domainapp views. The result is "empty list" / zeros on outage - violates the PRD's no-fake-success spirit.
- Global `error.tsx`, `loading.tsx`, `not-found.tsx` exist at app root only (no per-segment error boundaries).
- Native `alert()` x14, `confirm()` x40, `window.prompt()` x5 used for feedback/confirmation (not accessible, not themed).

**Mobile:** Dashboard has proper mobile nav (hamburger -> bottom sheet, fixed 5-tab bottom nav, `pb-24` main). Admin has `BottomSheet` "work"/"more" nav. Marketing has `MarketingBottomNav`. Customer portal is mobile-first (bottom tab bar). No viewport/responsiveness execution was possible (static).

**PWA (platform):**
- `src/app/manifest.ts` present: name Get4Domain, `start_url: '/'`, standalone, 192/512 + maskable icons.
- `public/sw.js` present: web push + `offline` fallback for navigations; precache = only `/offline` + one icon (no app-shell caching).
- **Service worker is registered only inside `subscribeToPush()`** (`lib/push-notifications.ts:13`), i.e. only for a logged-in vendor/admin who grants Notification permission AND when `NEXT_PUBLIC_VAPID_KEY` is set. Anonymous/marketing visitors and customer-portal users never get a SW, so offline fallback / installability criteria are not met for them.
- Dashboard and admin layouts call `Notification.requestPermission()` on every mount without a user gesture (UX anti-pattern, browsers may auto-block).
- **No separate manifest / scope / start_url for the vendor app (`/dashboard`) or customer portal (`/customer`)**: installing from the dashboard installs the marketing root. `InstallPrompt` (dashboard) and `InstallPwaButton` (marketing) exist but all instances share one manifest. No next-pwa/workbox.

---------------------------------------------------------------------------
## 7. Accessibility / design-system notes

- Component library: custom (no shadcn/ui, no Radix/Headless UI; deps are only next, react, tailwind, lucide-react, gsap, fabric, jspdf). `src/components/ui` (12: Accordion, Badge, BottomSheet, Button, Card, Counter, DataTable, Icon, Input, LockedBadge, Modal, StatCard) and a **second parallel set** `src/components/vendor` (Avatar, Badge, EmptyState, Icon, Modal, Select, ShareSheet) -> duplicated Badge/Modal/Icon with different APIs. `Accordion` and `Counter` have 0 importers. `DataTable` 3, `StatCard` 1.
- Tailwind tokens: `tailwind.config.js` extends primary/secondary/success/(warning/error) scales + dashboard "ink/brand/gold/ruby" colours; `content` globs include `src/app`, `src/components`, `src/layouts`, **`src/engine`** but **not `src/domainapp`**, `src/config`, `src/data`, `src/lib`: any Tailwind class that appears *only* in `src/domainapp/**` would be purged. The 51 domainapp views mostly reuse classes also present elsewhere, so it works today, but any unique utility is silently dropped (regression risk; static-verified, not run).
- A11y: `aria-` 73 uses; `role=` 4; **148 `<label>` vs 0 `htmlFor`** (association relies on wrapping only; the Input component may handle it - not checked); `ui/Modal` has `role=dialog aria-modal`, `vendor/Modal` does not; focus trap not seen; 52 `<img>` (5 without `alt` on the same line), only 5 `next/image`; icon-only buttons often lack `aria-label` (e.g. MoreVertical, bell dot). Colour contrast not checked.
- Types: `: any` x121 (api.ts alone ~35 `data: any`), 41 `eslint-disable` comments, `strict: true` in tsconfig. CLAUDE.md demands "no any"; not met.
- Security-relevant: 12 `dangerouslySetInnerHTML` (ai-studio doc preview, quote public page, raw-html-site, layout JSON-LD...); `RawThemeFrame` iframe uses `sandbox="allow-scripts allow-same-origin ..."` on `srcDoc` - this combination removes the sandbox boundary (framed theme JS can read the parent origin's `localStorage`, including `g4d_token`, if opened from a logged-in origin). Medium risk (themes are admin-ingested).

---------------------------------------------------------------------------
## 8. Console / log hygiene / hard-coded config

- `console.log`: **0**. `console.error`: 2 (`push-notifications.ts`). Hygiene OK.
- Hard-coded API origin `https://gapi.get4domain.com`: **13 occurrences in 12 files** (all as `process.env.NEXT_PUBLIC_API_URL || 'https://gapi...'` fallback except `admin/invoices/page.tsx:228` which has no env var at all). Same fallback is duplicated in 11 places instead of one import of `API_BASE` from api.ts.
- `localhost`: 0 occurrences in src.
- `https://get4domain.com` literals: 31 (canonical/SEO and in-app links such as `/go/` share URL).
- Hard-coded infra IP `34.14.130.68` (domain-management) and brand/pricing strings in several screens (see 2a).

---------------------------------------------------------------------------
## 9. Top findings (ranked)

1. **F1 BROKEN - vendor team onboarding dead-ends.** Backend emails `/team/accept-invite?token=...`; no such frontend route exists (only `/admin-team/accept-invite`), and `api.acceptTeamInvite` is never called. Vendors cannot add working team members.
2. **F2 MOCKED - fake pages presented as real.** `dashboard/notifications` (hard-coded MR Travels items), `dashboard/settings` + `admin/settings` (fake `setTimeout` "Saved", values pre-filled with a real customer's name/email/phone), `dashboard/domain-app` index, `dashboard/my-services` (stale 999/month prices), `admin/plans`. Direct violation of PRD Sections 63/96 (no fake API success, no static lists posing as records). 5 pages static + 6 mixed of 52.
3. **F3 BROKEN/PARTIAL - money/accuracy defects.** Analytics Hub shows wallet spend 100x too high (paise vs rupees); admin "View Invoice" opens an auth-less hard-coded URL that returns JSON; admin Accounting keeps expenses/net-profit in browser localStorage; admin Renewals can double-invoice after a reload; vendor home shows zeros / "Low wallet balance" on API outage.
4. **F4 UI-ONLY / BACKEND-ONLY features.** Growth-Hub (Meta publish/ads) and the campaign approval flow have API+backend but zero UI; TeleCRM AI call summary never invoked; campaign "share reminder", customer-hub portal toggle, admin post-log are state-only; WhatsApp/SMS inbox permanently locked by a constant.
5. **F5 Quality gates absent.** 0 frontend tests; no ESLint config/dependency; 121 `any`; 0% of domainapp views show errors (46 swallow them as "empty"); `middleware.ts` protects only `/demo/*` so dashboard/admin auth is client-side localStorage with no refresh-token flow; PWA service worker registers only after push opt-in and there is no vendor/customer-scoped manifest.

Positive: API client is consistent - **all 453 methods resolve to real backend routes (0 path mismatches)**; 79% of dashboard/admin pages are genuinely data-backed; 51 industry views implement real CRUD; payments (Razorpay) flows are wired end-to-end; no `console.log`; mobile navigation is solid.
