# GET4DOMAIN v2.0 — AUDIT REPORT
Generated: 2026-08-15
Branch: get4domain-site · Audited against the finalized model in `docs/DISPATCH_AUDIT.md`

> **Methodology / scope of confidence.** This is a **static code audit** (read-only, as the
> dispatch requires — no code changed). Statuses reflect **code presence + wiring + known
> facts from recent sessions**, not live QA on the VM. Auth-gated dashboard/admin flows and
> provider round-trips (Razorpay/Fast2SMS/OpenAI) were **not executed** here because (a) the
> dispatch forbids changes and (b) the dev frontend points at the **production** API and there
> is no local backend/DB. Items that need a live run to confirm are tagged **[runtime-unverified]**.
> Where the two source docs disagree (see Critical Issue #1), the `DISPATCH_AUDIT.md` model is
> treated as authoritative.

---

## SUMMARY

Total features audited: **~150**
- **WORKING:** ~95
- **PARTIAL:** ~30
- **MISSING:** ~18
- **BROKEN:** 1 (+ pricing-model discrepancies counted under PARTIAL)

Overall: the platform is **substantially built** — all core DomainApp tables, 21 industry
configs, the 10-module UI surface, mock-first provider layer, wallet/billing, auth/RBAC, and
the marketing site all exist. The gaps are concentrated in **(1) two pricing-model
discrepancies**, **(2) AI Studio template library + image-reel + true video (not built)**,
**(3) Website Manager themes (no theme system/table)**, **(4) ResellerClub domain purchase
(settings slot only, no integration)**, and **(5) an architectural divergence** from
`CLAUDE_MEMORY_V2.md`'s "purpose-built per-industry pages" principle (the dashboard is
config-driven shared components instead).

---

## CRITICAL ISSUES (resolve before new development)

1. **Pricing model conflict — the site does NOT offer the ₹999/month option.** `DISPATCH_AUDIT.md`
   says "₹6,999/year **OR** ₹999/month" and "wallet refill **min ₹499**". The live site instead
   shows **₹6,999/year + "₹583/month" (annual-equivalent, not a real monthly billing option)**
   and **min wallet top-up ₹999** (`wallet.service.ts` lowest bonus tier is ₹999; TOPUPS start
   ₹999). `CLAUDE_MEMORY_V2.md` *also* says min ₹999 — so the two governing docs **contradict each
   other**. **Decision needed:** is monthly billing ₹999/mo real, and is min top-up ₹499 or ₹999?
   Nothing else can be correctly priced until this is settled.
2. **Broken CTA on /pricing.** Line 95: `href="\book-demo"` uses a **backslash** — the "Book a Free
   Demo" secondary button is a dead/incorrect link. (`get4domain_mvp/src/app/(marketing)/pricing/page.tsx:95`)
3. **AI Studio has no template library and no real image-reel/video** — the dispatch calls AI Studio
   "the core money-making feature." No `g4d_ai_templates` table, no template browse/edit-with-AI, no
   image-slider reel export, no MP4. Text + single-image generation exist; the rest is absent.
4. **Website Manager has no theme system.** No `g4d_website_themes` table; the vendor "Template" tab is
   read-only ("editing arrives with the next template release"). Theme select / AI-generate-theme /
   live preview are **MISSING**.
5. **Vendor CMS rich-listings + banner are code-complete but NOT migrated on prod.** The `/site/[subdomain]`
   renderer, `VendorProduct.customFields`, and `VendorCMS.banner` shipped in code last session but require
   `prisma db push` on the VM before they function — until then the new listing fields/banner silently no-op.

---

## SECTION 1 — MARKETING PAGES

| Page | Status | Issue |
|------|--------|-------|
| `/` | PARTIAL | Single product, ₹6,999/yr, module showcase, industry links, chatbot, favicon (fixed) all present. **But** monthly shown as "₹583/month" equivalent, not the model's **₹999/mo** option. |
| `/pricing` | **BROKEN + PARTIAL** | **Backslash link `href="\book-demo"` (line 95).** No ₹999/mo billing toggle (shows ₹583/mo equiv). Min top-up **₹999** not ₹499. "Search Domain Availability" links to `/dashboard/domain-management` (auth-gated) from a public page. No old Startup/Enterprise split (good). |
| `/domain-app` | PARTIAL | One product, no tiers (correct). Same ₹583/mo-equivalent framing, no ₹999/mo option. |
| `/domain-campaign` | WORKING | Correctly reframed as "included in DomainApp, not separate." |
| `/industries` | WORKING | 20-industry grid, links to `/industries/[id]`. |
| `/industries/[id]` | WORKING | "₹6,999/year — everything included", `Book Demo?industry=<id>` CTA. |
| `/book-demo` | WORKING [runtime-unverified] | Posts to `/leads` (`api.createLead`). Field completeness (name/phone/email/business/industry/interest/message) present in prior work. |
| `/about` | WORKING | KSM Quantum, Chennai address, contact present. |
| `/contact` | WORKING | Phone/email/address + enquiry form. |
| `/support` | WORKING | Company info present. |
| `/login` | WORKING | Clean logo (fixed), Book Demo link. |
| `/privacy-policy` | PARTIAL | Correct company name/address. **No explicit DPDP Act 2023 reference** (dispatch asks for it). |
| `/terms` | WORKING | Correct product names, no old-plan leftovers. |
| `/refund-policy` | WORKING | Wallet credits + ₹999 AI credit + setup fee all "non-refundable after use/work begins." |
| Header | WORKING | Clean logo at h-10/h-12, Products dropdown, Login, Book Demo. |
| Footer | WORKING | Company info, no old product refs. |
| Mobile bottom nav | PARTIAL | `MarketingBottomNav` = Home / Products / Industries / Demo (+Chat). Confirm the 5th "Chat" tab renders as specified. |
| Chatbot | WORKING | `ChatBot`/`ChatWidget` present (desktop floating + mobile). |
| SEO | WORKING | sitemap.xml (all pages incl. 340 demo routes), robots, JSON-LD (Organization + SoftwareApplication), OG tags → `/og-image.png`. |
| Favicon | WORKING | Proper set (favicon.ico + 16/32 + apple-touch-icon) — fixed last session. Note: dispatch text says "`/favicon.png` in metadata"; the newer set supersedes that line. |

**Minor:** legal pages use `support@get4domain.com`; identity doc uses `admin@get4domain.com` — pick one.

---

## SECTION 2 — VENDOR DASHBOARD

Sidebar defined in `dashboard/layout.tsx` with `moduleKey` lock-gating + `walletGated` flags.
All module pages exist. Statuses are code-level unless noted.

| Feature | Status | Notes |
|---------|--------|-------|
| Overview | WORKING [runtime-unverified] | `dashboard/page.tsx` — greeting/wallet/stats. |
| Mini BOS → Contacts | WORKING | `domainapp/[tab]` + `/domainapp/contacts` CRUD, industry-labeled via config. |
| Mini BOS → Catalog | WORKING | `CatalogView` full CRUD + image + per-industry custom fields. |
| Mini BOS → Records | WORKING | `/domainapp/records` CRUD + `:id/status` workflow + custom fields. |
| Mini BOS → Invoicing | WORKING | `/domainapp/invoices` create/view/`:id/pdf`/`:id/send-link`/`:id/mark-paid`. |
| Mini BOS → Accounts | PARTIAL | Income/expense + basic P&L present in UI; GST statement depth [runtime-unverified]. |
| CRM | WORKING | `/crm/leads` CRUD + status; pipeline. |
| TeleCRM | WORKING | `dashboard/telecrm` 3-panel, click-to-call, visibility-API return detection, feedback outcomes, follow-ups (built across prior dispatches). |
| AI Studio | PARTIAL | See Section 5 — text/image/documents yes; template library, image-reel, video **MISSING**. |
| Campaigns (Growth Hub) | WORKING [runtime-unverified] | Wizard, channels, `/go/[slug]` landing + lead capture, list, per-campaign analytics. |
| Communication Hub → WhatsApp | PARTIAL | Outbound template send via Fast2SMS (contact-based). **No inbound** (provider can't — documented). |
| Communication Hub → SMS | PARTIAL | Outbound DLT/quick route via Fast2SMS. No inbound. |
| Communication Hub → Email | PARTIAL | Outbound via Resend. No inbound parsing. |
| Communication Hub → Social Post | PARTIAL | Share/generate flow; native publishing is mock (Meta). |
| Website Manager → CMS | WORKING | `my-website` (Basic/Branding/About/Services/SEO) + `my-products` rich per-category listings + `/site/[subdomain]` renderer. **Needs prod `db push`** (customFields, banner). |
| Website Manager → Theme | MISSING | No theme select / AI theme / live theme preview. Template tab is read-only. |
| Website Manager → Preview | WORKING | "Preview my site" → `/site/[subdomain]`. |
| Customer Hub → Portal | WORKING [runtime-unverified] | `/customer` OTP login; Records/Invoices/Support; labels adapt per industry. |
| Customer Hub → Vendor settings | PARTIAL | Portal on/off + invite [runtime-unverified]. |
| Analytics Hub | WORKING [runtime-unverified] | `dashboard/reports` — revenue/leads/wallet from existing tables. |
| Domain Management | PARTIAL/MISSING | Current subdomain + DNS-connect instructions present; **buy-domain has no ResellerClub integration** (settings slot only) → effectively "Coming Soon." |
| Wallet & Billing | WORKING [runtime-unverified] | Balance, top-up (Razorpay), transactions, subscription/renewal. |
| Team | WORKING [runtime-unverified] | Invite, roles (owner/manager/accountant/sales), manage. |
| Support | WORKING | Create/view tickets + AI chatbot. |
| Settings | WORKING | Business info edit; logo upload (Branding tab). |
| Nav: locked tabs + upgrade modal | WORKING | `moduleKey` lock-gating with 🔒 + upgrade modal; all tabs always visible. |
| Nav: mobile bottom | PARTIAL | Sheets = business/campaign/more; confirm exact "Home/Business/Campaign/AI/More" labels against spec. |
| Logout / Help | WORKING | Header top-right + help → support. |

---

## SECTION 3 — ADMIN DASHBOARD

Role-gated sidebar (`admin/layout.tsx`, roles SUPER / SUPER_MKT / SUPER_OPS).

| Feature | Status | Notes |
|---------|--------|-------|
| Overview | WORKING [runtime-unverified] | Real-data counts. |
| TeleCRM | WORKING | Points at `g4d_leads` (demo bookings); shared 3-panel. |
| AI Studio | PARTIAL | Mounted from vendor AI Studio (same gaps as Section 5). |
| Send Quote | WORKING [runtime-unverified] | `quotes` module; picker + AI copy + channel send + status. |
| Demo Bookings | WORKING | `admin/leads` lists book-demo leads + call/WA buttons. |
| Vendors | WORKING [runtime-unverified] | `admin/customers` create/suspend + industry picker + module/addon toggles. |
| Invoices | WORKING [runtime-unverified] | Create/list/send-link/mark-paid (Razorpay). |
| Renewals | WORKING [runtime-unverified] | `admin/renewals`. |
| Accounting | WORKING [runtime-unverified] | Platform income/expense (`g4d_platform_income`). |
| Campaigns | WORKING [runtime-unverified] | Approvals/execute. |
| Support | WORKING | Vendor tickets + reply. |
| Website CMS | WORKING | `admin/cms` platform CMS fields. |
| Vendor Access | WORKING | `admin/vendor-access` module/addon toggles + industry picker. |
| Integrations | WORKING | `admin/api-settings` — all categories present (payment, ai, whatsapp, sms, email, meta, google_ads, push, video, domain, company, fast2sms); AES-256-GCM encryption; env fallback. |
| Pricing Manager | WORKING [runtime-unverified] | `admin/pricing` → `g4d_platform_settings`; wallet deduction reads rates. |
| Team | WORKING | 3 roles (SUPER_ADMIN/MARKETING/OPERATIONS); role-gated sidebar + AdminAccessModal. |
| Nav: mobile bottom / logout / help | WORKING | Overview/TeleCRM/AI/Work/More pattern. |

---

## SECTION 4 — API INTEGRATIONS

Categories live in `platform-settings.constants.ts`; encrypted in `g4d_platform_settings`, `.env` fallback.

| Service | Key slot | Mock/Real | Working | Notes |
|---------|----------|-----------|---------|-------|
| Claude (Anthropic) | ✅ `ai.anthropic_api_key` | Real | [runtime-unverified] | Text gen (`/ai/generate-content`), chat, page, call-summary. |
| OpenAI / DALL-E | ✅ `ai.openai_api_key` | Real | [runtime-unverified] | `/ai/generate-image`; honest `not_configured/failed` surfacing (fixed prior). |
| Stability AI | ❌ | Not integrated | — | Not wired; would need a new provider path. |
| Kling AI | ❌ | Not integrated | — | Not present. |
| HeyGen | ❌ | Not integrated | — | Not present. |
| Razorpay | ✅ `payment` | Real | [runtime-unverified] | create/verify/webhook; 0 mock markers. |
| Resend (email) | ✅ `email` | Real | [runtime-unverified] | 0 mock markers; invoice/support email. **Outbound only** (no inbound parse). |
| ResellerClub | ✅ slots only | Not integrated | — | `resellerclub_api_key`/`reseller_id` slots exist; **no search/register service**. |
| WhatsApp (Fast2SMS) | ✅ `whatsapp`/`fast2sms` | Mock-first (10 markers) | Partial | Real outbound template send; swap-ready; **no inbound webhook** (Fast2SMS can't). |
| SMS (Fast2SMS) | ✅ `sms`/`fast2sms` | Mock-first (10) | Partial | DLT + quick route; OTP via route=q. Note model references MSG91 — **actual is Fast2SMS**. |
| Meta Graph API | ✅ `meta` | Mock-first (9) | Partial | Swap-ready stubs; OAuth page-connect not live. |
| Google Ads API | ✅ `google_ads` | Mock-first (8) | Partial | Swap-ready stubs. |
| Video | ✅ `video` | Mock-first (11) | Partial | Stub only; no real render. |
| VAPID / Push | ✅ `push` | Real | [runtime-unverified] | Notifications module, 0 mock markers. |

**Platform settings:** categories = payment, ai, whatsapp, sms, email, meta, google_ads, push, video, domain, company, fast2sms. Services resolve DB-first → `.env` fallback via `getResolvedValue`.

---

## SECTION 5 — AI STUDIO DEEP DIVE

| Content type | Status | API | Wallet deduct |
|---|---|---|---|
| Social Post caption | WORKING [rt-unverified] | Claude | Yes (preview shown) |
| Blog article | WORKING [rt] | Claude | Yes |
| Ad creative copy | WORKING [rt] | Claude | Yes |
| Email content | WORKING [rt] | Claude | Yes |
| WhatsApp template | WORKING [rt] | Claude | Yes |
| SMS text | WORKING [rt] | Claude | Yes |
| Reel **script** | WORKING [rt] | Claude | Yes |
| Festival poster | PARTIAL | OpenAI (DALL-E) | Yes — real if key set, else honest `not_configured` |
| Social media poster | PARTIAL | OpenAI | as above |
| Letterhead / ID card / Visiting card | WORKING [rt] | HTML template | — |
| Presentation | MISSING | not built | — |

- **Template library:** **MISSING** — no `g4d_ai_templates` table, no admin upload/create, no vendor browse, no edit-template-with-AI.
- **Share flow:** PARTIAL — post-generation share/download/copy/save exist in UI; `navigator.share()` [runtime-unverified].
- **Image-slider reel (MP4):** **MISSING** — no multi-image select → slideshow → music → MP4 export. (`video` service is a mock stub.)
- **Wallet integration:** WORKING — cost preview before generation; rates from `g4d_platform_settings` (not hardcoded); insufficient-balance handling; inline top-up [runtime-unverified].

---

## SECTION 6 — DATABASE & BACKEND

| Check | Status | Detail |
|---|---|---|
| Core tables | WORKING | `g4d_contacts`, `g4d_catalog_items`, `g4d_records`, `g4d_generic_invoices` all mapped. |
| Addon/module tables | WORKING | `g4d_vendor_addons`, `g4d_vendor_modules`, `g4d_platform_settings`. |
| Admin tables | WORKING | `g4d_admin_team_members`, `g4d_quotes`, `g4d_lead_call_logs`. |
| **AI template table** | **MISSING** | `g4d_ai_templates` does not exist. |
| **Website theme table** | **MISSING** | `g4d_website_themes` does not exist. |
| Industry configs | PARTIAL | 21 files (20 + general) with entities/statuses/custom-fields/addons/websiteTemplate. **Key mismatch:** backend uses `clinic/salon/gym`; frontend content/demo uses `healthcare/beauty/fitness` — reconcile the canonical industry keys. `dashboardTabs` come via `tab-registry.ts` (shared), not per-industry files. |
| DomainApp endpoints | WORKING | contacts/catalog/records/invoices full CRUD; invoice pdf/send-link/mark-paid; record status. Summary counts present. |
| Addon endpoints | WORKING | `/addons/vendor` list + enable/disable. |
| Module endpoints | WORKING | `/modules/vendor` list + enable/disable. |
| Platform settings | WORKING | GET/PUT + AES-256-GCM crypto + `.env` fallback. |
| Wallet | PARTIAL | balance/topup/deduct/transactions + `getRate()` from DB. **Min top-up ₹999** (not ₹499) — see Critical #1. |
| Auth | WORKING [rt] | Vendor/admin/admin-team login; JWT carries role/adminRole/industry. |
| CRM | WORKING | Leads CRUD, call logs, queue, follow-ups, pipeline statuses. |
| Communication | PARTIAL | WhatsApp/SMS/Email + `g4d_messages` persisted (outbound). Mock-first, swap-ready. Inbound not possible with current providers. |
| Growth Hub | PARTIAL | `growth-hub` publish/ads endpoints are mock. |
| Customer | WORKING [rt] | OTP flow + portal data endpoints. |
| **Frontend per-industry pages** | **PARTIAL (architectural)** | `src/domainapp/` has only `shared/` + `tab-registry.ts` — **no `travel/`, `restaurant/`, `clinic/` purpose-built page sets**. This is the config-driven shared approach that `CLAUDE_MEMORY_V2.md` explicitly names the "WRONG approach." Functionally works; diverges from the stated architecture principle. **Decision needed.** |

---

## SECTION 7 — MOBILE / PWA

| Check | Status | Detail |
|---|---|---|
| Manifest | WORKING | `app/manifest.ts` → name/short_name/standalone/theme_color/icons (icon-192/512 cleaned). |
| Service worker | WORKING [rt] | `public/sw.js` registered; caches icon-192; offline page exists. Push handling [rt]. |
| Install prompt | [runtime-unverified] | Not confirmed in this static pass. |
| Bottom nav — marketing | PARTIAL | Home/Products/Industries/Demo (+Chat) — confirm 5th tab. |
| Bottom nav — vendor | PARTIAL | business/campaign/more sheets — confirm exact "Home/Business/Campaign/AI/More". |
| Bottom nav — admin | WORKING | Overview/TeleCRM/AI/Work/More. |
| Touch targets / responsive 390px | [runtime-unverified] | Not measured in this static pass. |
| BottomSheet component | WORKING | Present and used (dashboard sheets). Coverage per-form [rt]. |

---

## RECOMMENDED BUILD ORDER

1. **Resolve the pricing model (Critical #1)** — decide ₹999/mo billing (yes/no) and min top-up (₹499 vs ₹999); reconcile `DISPATCH_AUDIT.md` vs `CLAUDE_MEMORY_V2.md`. Blocks all pricing edits.
2. **Fix the `/pricing` backslash link (Critical #2)** — 1-line fix, currently a dead CTA.
3. **Run the pending prod `db push`** for `VendorProduct.customFields` + `VendorCMS.banner` so the shipped vendor-CMS/`/site` work actually functions.
4. **Reconcile industry keys** (`clinic/salon/gym` ↔ `healthcare/beauty/fitness`) — a silent mismatch that will bite config→content lookups.
5. **AI Studio template library** (`g4d_ai_templates` + admin CRUD + vendor browse/edit-with-AI) — highest-leverage money feature gap.
6. **Website Manager themes** (`g4d_website_themes` + select/AI-generate/live-preview).
7. **Image-slider reel** (multi-image → slideshow → music → MP4) — the launch stand-in for real video.
8. **ResellerClub domain search/register** (settings slot already exists).
9. **Decision on per-industry frontend pages** vs. keeping the shared/config approach (architectural).
10. **Add DPDP Act reference** to privacy policy; unify support/admin email.
11. Provider swaps (WhatsApp BSP, Meta OAuth, Google Ads, real video) — parallel/business-gated.

---

## FILES THAT NEED CHANGES

**Pricing fixes**
- `get4domain_mvp/src/app/(marketing)/pricing/page.tsx` (backslash link line 95; ₹999/mo option; min ₹499 if adopted)
- `get4domain_mvp/src/app/(marketing)/page.tsx`, `.../domain-app/page.tsx` (₹999/mo option framing)
- `backend-api/src/wallet/wallet.service.ts` (min top-up / bonus tiers if ₹499 adopted)

**Bug fixes**
- `get4domain_mvp/src/app/(marketing)/pricing/page.tsx:95` (dead CTA)
- Industry-key reconciliation: `backend-api/src/config/industries/*` ↔ `get4domain_mvp/src/data/industry-content.ts` / `demo-catalog.ts`

**Missing features**
- New: `backend-api/prisma/schema.prisma` (+`g4d_ai_templates`, `g4d_website_themes`) + modules/controllers
- AI Studio template + reel: `get4domain_mvp/src/app/dashboard/ai-studio/*`, `backend-api/src/ai/*`, `backend-api/src/video/*`
- Website themes: `get4domain_mvp/src/app/dashboard/my-website/page.tsx` (Template tab) + new theme backend
- Presentation content type: `ai-studio` + `ai` service

**API integrations**
- ResellerClub service: `backend-api/src/` (new `domains` module) + `dashboard/domain-management/page.tsx`
- Provider swaps (mock→real): `backend-api/src/{whatsapp,sms,meta,google-ads,video}/*.service.ts`

**Ops (no code — VM)**
- `prisma db push` for `VendorProduct.customFields` + `VendorCMS.banner` (already in schema, pending on prod)

---

*End of report. No code was changed in producing this audit.*
