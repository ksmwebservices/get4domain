# GET4DOMAIN — PRD vs Current Codebase Audit
**Date:** 06 Sep 2026 · **Mode:** Phase 1 — AUDIT + PLAN ONLY (no code changes)
**PRD:** `docs/reference/PRD_FULL_PLATFORM_VISION.md` (read verbatim)
**Branch:** get4domain-site · **Method:** read of real files + live-tested behaviour this session (not past "complete" claims)

**Legend:** ✅ Implemented · ⚠️ Partial · ❌ Missing · Gap class: **MODIFY** (adjust existing) / **ENHANCE** (add capability to existing) / **BUILD NEW**

---

## 0. Architecture map (what actually exists)
- **Public web:** `get4domain_mvp/src/app/(marketing)/*` (marketing), `/site/[subdomain]` (live vendor sites), `/demo/[category]` (gated demo), `/register` `/login` `/visit-demo` `/book-demo`.
- **Industry Website Engine:** `src/engine/` — `registry.ts` (20 industries), section-kit (`kit/`), per-industry themes + hero/showcase variants, `real-estate/` bespoke, data-driven templates (`kit/template.ts` + `WebsiteTheme.layout`).
- **Vendor app:** `src/app/dashboard/*` + `layout.tsx` grouped nav; industry operations via `dashboard/domain-app/[tab]` + `src/domainapp/tab-registry` (`resolveView`) + per-vendor addon gating.
- **Client app:** `src/app/customer/page.tsx` — single page, industry-shaped tabs (home/records/catalog/invoices/support) + mobile bottom nav.
- **Backend (NestJS):** `backend-api/src/` — engine (Action Registry public dispatch), crm, telecrm, wallet, payments, vendor-payments, whatsapp/sms/email/notifications, ai, website-themes, cms, industry config (`src/config/industries`), demo/sandbox.
- **PWA:** `src/app/manifest.ts`, `public/sw.js`, layout manifest link.
- **Multi-tenancy/security:** vendorId scoping throughout; Supabase RLS enabled on all public tables; secrets encrypted server-side (`platform-settings/crypto.util`), never in client.

---

## 1. PRIORITY AUDIT — PUBLIC WEB (§4, §29, §30–32, §40)

| PRD requirement | Status | Evidence / Gap |
|---|---|---|
| Home, product, feature, industry, pricing, resources, marketing, signup, login (§4) | ✅ | `(marketing)/`: home, features, pricing, industries, industries/[id], products, how-it-works, digital-growth, about, contact, templates + `/login` `/register`. **MODIFY:** "Resources" not a distinct hub. |
| Vendor onboarding on public web (§4) | ⚠️ | `/register` (self-service) + `/book-demo` exist; no guided *industry→category→configure* onboarding wizard (§45). **ENHANCE.** |
| Per-vendor public presence: subdomain, hosting, CDN, SSL, enquiry, WhatsApp CTA, call CTA (§4, §29) | ✅ | `/site/[subdomain]` via engine; enquiry (`engine.enquiry`→CRM), WhatsApp CTA present. Subdomain served (mrtravels/allwintours live). **MODIFY:** signup lands on `/site/<sub>` path; true `<sub>.get4domain.com` for new vendors needs host-rewrite + wildcard infra. |
| Public site generated from industry+category+model+services+ops+brand (§29) | ✅ | Engine builds per-industry site from CMS/products; not a recoloured template. |
| Each industry has its OWN design language — layout/typography/IA/hero/sections/CTA (§30) | ✅ | 20 per-industry themes + hero variants (overlay/split/panel) + section orders; RE bespoke. Root cause of earlier "unprofessional" look was a Tailwind scan bug (now fixed). |
| Industry category registry (§31) — 12 groups, extensible, each defining model/ops/modules/pages/CTA/pipeline/AI templates/mobile nav | ⚠️ | Registry exists (`engine/registry.ts` + backend industry config) with 20 industries (superset of the 12). But a single registry entry does **not** yet declare the FULL §31 schema (recommended modules, client features, pipeline, AI templates, notifications, automation, mobile-nav priorities) in one place. **ENHANCE** → unify into the §31/§32 config shape. |
| Design quality bar — avoid generic AI look, excessive rounded/gradient/glass/3-card/generic hero (§40) | ⚠️ | Engine sites are industry-themed (good). Marketing pages lean on gradient/glass/3-card patterns in places. **MODIFY** (design pass). |
| Responsive + app-like mobile (§3, §7, §39) | ✅ | Engine `EngineBottomNav` (industry label sets), responsive verified. Marketing responsive. |

**Public Web verdict:** mostly ✅ with **MODIFY/ENHANCE** items — no rebuild.

---

## 2. PRIORITY AUDIT — VENDOR WEBAPP (§5, §7, §24, §27–28)

PRD §5 default nav vs current (`dashboard/layout.tsx`):

| PRD §5 item | Status | Current location |
|---|---|---|
| Dashboard | ✅ | `/dashboard` (Overview) |
| Customer Hub | ✅ | `/dashboard/customer-hub` |
| TeleCRM | ✅ | `/dashboard/telecrm` (+ `/crm`) |
| Growth Hub | ✅ | `/dashboard/campaigns` (labelled "Growth Hub") + `landing-page` |
| AI Studio | ✅ | `/dashboard/ai-studio` |
| Communication Hub | ✅ | `/dashboard/communication` (+ `whatsapp-bot`) |
| Website Manager | ✅ | `/dashboard/my-website` (+ `website-engine`, `embed`) |
| Analytics | ✅ | `/dashboard/reports` (labelled "Analytics Hub") |
| Wallet | ✅ | `/dashboard/wallet` |
| Subscription | ⚠️ | split across `go-live` / `billing` / `my-services` — no single "Subscription" module. **MODIFY.** |
| Profile | ⚠️ | folded into `settings` — no distinct Profile. **MODIFY.** |
| Settings | ✅ | `/dashboard/settings` |
| Support | ✅ | `/dashboard/support` |
| Industry-specific modules surfaced by the engine (§5, §24) | ✅ | `domain-app/[tab]` config-driven tabs + addon gating (Restaurant POS/Orders/Tables/Kitchen; Clinic Appointments/Doctors/Patients; RE Leads/Site-Visits/Properties; etc.). Strong match to §24. |
| Mobile nav prioritizes business-critical actions, not full desktop nav (§7) | ⚠️ | Dashboard has a mobile bottom bar but it's a fixed subset, **not industry/role-configurable** per §7. **ENHANCE.** |
| CRM pipeline configurable by industry (§27) | ⚠️ | CRM/leads exist; per-industry **pipeline stages** (RE: Lead→Site Visit→…; Education: Enquiry→Counselling→…) not clearly config-driven. **ENHANCE** (verify + drive from industry config). |
| Growth Hub connects CRM+Comm+AI+Analytics; branded campaign pages (§28) | ⚠️ | Campaign pages + CRM lead capture exist; explicit wiring to Comm Hub/AI/Analytics partial. **ENHANCE.** |

**Vendor verdict:** all core modules exist (✅); gaps are **MODIFY** (surface Subscription + Profile as first-class; nav grouping to PRD's flat list) and **ENHANCE** (industry-configurable mobile nav; per-industry CRM pipeline). No rebuild.

---

## 3. PRIORITY AUDIT — CLIENT WEBAPP (§6, §7)

| PRD §6 client modules | Status | Evidence / Gap |
|---|---|---|
| Home, Products/Services, Booking, Appointment, Site Visit, Cart, Orders, Quote, Enquiry, Application, Membership, Subscription, Payments, Messages, Notifications, Order/Booking history, Profile | ⚠️ **(biggest gap)** | `src/app/customer/page.tsx` is a **single page** with industry-shaped tabs: **home, records, catalog, invoices, support**. It shows records/catalog/invoices and supports contact — but does **not** expose the operational client actions (Book Appointment / Site Visit / Cart / Order / Quote / Application / Membership / Payments / Messages / Notifications / history / Profile) as first-class flows. Public-site enquiry/checkout exists, but the **logged-in client app** is thin. |
| Industry-shaped client modules (§6, §32 clientModules) | ⚠️ | Tabs come from backend per industry (portal.tabs) — the shaping mechanism exists ✅, but the module *set* is limited (5 tabs), not the PRD's operational list. **ENHANCE** the tab/module vocabulary + drive from industry config. |
| App-style mobile nav prioritizing customer actions (§7) | ✅ | Customer portal has a per-industry mobile bottom nav (`portal.tabs`). |
| PWA-ready (§6, §39) | ✅ (shell) | `manifest.ts` + `public/sw.js` present; needs per-app verification. |
| Client performs the relevant business action → pay → notifications → history (§45 acceptance) | ⚠️ | Payment happens on the **public** site (engine checkout); the **client-app** action→pay→history loop is not unified. **ENHANCE/BUILD** the client operational modules. |

**Client verdict:** the industry-shaping + mobile-nav + PWA scaffolding exist (reuse them), but the **module set is the largest gap vs PRD**. Classification: **ENHANCE** the existing `/customer` portal (add operation modules driven by the industry Operation Engine) — **not** a rebuild.

---

## 4. SECONDARY FLAGS (brief — no deep plan yet)

| PRD area | Status | Note |
|---|---|---|
| Communication Hub provider abstraction (§12–16) | ⚠️ | `whatsapp/`, `sms/`, `email/`, `notifications/` services exist (Fast2SMS + Resend, keys via secure settings). **No formal `WhatsAppProviderInterface`/adapter** — single provider per channel. Unified Inbox (§16) not evident. **ENHANCE.** |
| AI provider abstraction (§17–23) | ⚠️ | `ai/ai.service.ts` supports OpenAI + Claude (by configured key) + DALL·E images; wallet-charged. **No `AITextProvider/AIVideoProvider` interface**; Runway/Kling video **parked** (keys in settings, not wired). Async job model (§21) not built. **ENHANCE/BUILD (video).** |
| CRM + TeleCRM (§27) | ✅/⚠️ | CRM leads + TeleCRM modules exist; configurable **pipeline stages per industry** = ⚠️ (see §2). |
| Payments / Wallet (§23, §25) | ✅ | Razorpay (platform + vendor-direct checkout), GST invoicing, wallet with auditable deduct/getRate. Provider is Razorpay-specific (⚠️ abstraction), but functional + secure. |
| Automation engine (§26, §33) | ❌ | No general event-driven automation engine / `/automations`. Ad-hoc triggers only (lead routing, notification sends). **BUILD NEW.** |
| Notifications (§26) | ⚠️ | `notifications/` + push VAPID keys; event taxonomy + industry-driven event selection partial. **ENHANCE.** |
| Webhooks (§34) | ⚠️ | Razorpay signature verify exists; a general secure webhook framework (idempotency, logging, retry) not centralised. **ENHANCE.** |
| Multi-tenancy + Security (§36–38) | ✅ | vendorId isolation, RLS on all public tables, encrypted secrets server-side, JWT/RBAC, input validation (class-validator). Strong. |
| API domains (§35) | ⚠️ | Most domains exist (`/auth /vendors /cms /crm /telecrm /payments /wallet /ai /website-themes /engine …`). Missing/renamed: **`/clients`** (client app uses `/customer`), `/automations`, `/bookings /appointments /quotes` as first-class (handled inside industry/engine today). **MODIFY/ENHANCE.** |

---

## 5. PHASED EXECUTION PLAN (priority areas)

### Phase A — Public Web + Marketing + Industry Landing (§4, §30, §39–40)
Reuse: engine section-kit, industry themes, `(marketing)`.
1. **Design-quality pass** on marketing pages to §40 (reduce gradient/glass/3-card; premium/industry feel). — MODIFY — ~2–3 dev-days — risk: low (visual only).
2. **Subdomain presentation** — signup/links use `<sub>.get4domain.com`; add Next host→path rewrite. — MODIFY — ~1 day + **infra dependency** (wildcard DNS/nginx/SSL, KSM). Risk: infra.
3. **Resources hub** + tighten industry landing (`industries/[id]`) to the §31 recommended-pages/sections shape. — ENHANCE — ~2 days.
_Deps:_ none blocking (infra for #2). _Total:_ ~1 dispatch.

### Phase B — Vendor WebApp nav/modules to PRD (§5, §7, §24, §27–28)
Reuse: `dashboard/layout.tsx`, `domainapp/tab-registry`, industry config.
1. **Nav alignment** — surface **Subscription** + **Profile** as first-class; regroup to PRD §5 list; keep engine-driven industry tabs. — MODIFY — ~1–2 days — risk: low (routing/labels).
2. **Industry/role-configurable mobile bottom nav** (§7) — drive the vendor mobile bar from industry config. — ENHANCE — ~2 days — risk: med (touches layout).
3. **Per-industry CRM pipeline stages** (§27) — move stages into industry config; render pipeline per config. — ENHANCE — ~2–3 days — risk: med (CRM data/UI).
4. **Growth Hub wiring** to Comm/AI/Analytics (§28). — ENHANCE — ~2 days.
_Deps:_ industry-config schema (§31) should be firmed first. _Total:_ ~1–2 dispatches.

### Phase C — Client WebApp modules (§6–7)
Reuse: `/customer` portal shell, `portal.tabs`, Operation Engine (engine actions), mobile bottom nav, PWA shell.
1. **Expand the client module vocabulary** beyond home/records/catalog/invoices/support → add operation modules per industry (Book Appointment, Site Visit, Cart/Orders, Quote, Application, Payments, Messages, Notifications, History, Profile), driven by the industry Operation Engine. — ENHANCE (+ some BUILD NEW for messages/notifications/history) — ~5–8 dev-days — risk: med (new client flows; must stay per-industry, not generic).
2. **Unify action→pay→history** so a logged-in client can perform the primary operation and pay in-app (reuse engine checkout + PosSale/CRM). — ENHANCE — ~3 days.
3. **Client Profile + auth polish** + PWA verification. — ENHANCE — ~2 days.
_Deps:_ Operation Engine mapping per industry (§10–11); Phase B industry-config schema. _Total:_ ~2 dispatches.

_Later, unscheduled:_ Communication Hub provider abstraction + Unified Inbox (§12–16); AI provider interface + Reel/video async jobs (§17–23); Automation Engine (§33); Webhook framework (§34); Notification event taxonomy (§26).

---

## 6. STATUS CHECKLIST

| Audit area | Status |
|---|---|
| STEP 1 — PRD saved verbatim (`docs/reference/PRD_FULL_PLATFORM_VISION.md`) | ✅ complete |
| STEP 2 — Public Web audit (§4,29,30–32,40) | ✅ complete |
| STEP 2 — Vendor WebApp audit (§5,7,24,27–28) | ✅ complete |
| STEP 2 — Client WebApp audit (§6–7) | ✅ complete |
| STEP 2 — Secondary flags (§12–38) | ✅ complete (brief) |
| STEP 3 — Gap classification (priority 3) | ✅ complete |
| STEP 4 — Phased plan A/B/C | ✅ complete |
| STEP 5 — Output file | ✅ this document |
| Code changes | ⛔ none (audit only, as required) |

## 7. HEADLINE FINDINGS
1. **The engine/architecture already matches the PRD's core principle** (common engine + per-industry config/design + Action Registry operation engine). Most gaps are **MODIFY/ENHANCE**, not rebuilds — as intended.
2. **Biggest structural gap: the Client WebApp (§6–7)** — a single 5-tab portal vs the PRD's operational client app. Recommend ENHANCE via the existing Operation Engine + portal shell (Phase C).
3. **Vendor app is ~90% aligned** — mainly nav MODIFY (Subscription/Profile) + industry-configurable mobile nav + per-industry CRM pipeline.
4. **Public web is strong**; needs a §40 design-quality pass + true subdomain presentation (infra).
5. **Genuinely missing (BUILD NEW):** a general **Automation Engine (§33)** and formal **provider-abstraction interfaces** for Comm (§12–16) and AI (§18) + async **video** jobs (§21).
6. **Security/multi-tenancy (§36–38) is a strength** — isolation, RLS, server-side secrets all in place.
