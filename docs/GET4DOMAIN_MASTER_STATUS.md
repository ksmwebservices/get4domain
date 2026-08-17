# Get4Domain v2.0 — Master Project Status
*Last updated: 17 Aug 2026. This is the canonical reference — read this top-to-bottom before dispatching any new work, and update it after every completed dispatch.*

---

## 1. What Get4Domain Is

"Your Online Identity Partner" — a SaaS platform for Indian SMBs across 20 industries. One plan, **₹999/month** (single product, no annual tier — locked Aug 2026): industry-specific website, mini business workspace (incl. accounts/GST prep + stationery), CRM (TeleCRM), AI content studio, campaign management, communication tools, plus **₹499 AI Studio credit** included. Wallet top-up min **₹499**. Industry keys standardized to the backend set (clinic/salon/gym).

**Company:** KSM Quantum Technologies (ksmwebtech)
**Repo:** ksmwebservices/get4domain, branch `get4domain-site`
**VM:** ksmwebtechservices@34.14.130.68

---

## 2. Architecture & Rules (never break these)

- Frontend + backend run as **Docker containers**, not PM2/systemd: `get4domain_frontend` (3006), `get4domain_backend` (3008)
- Prisma pinned at 6.19.3, never upgrade
- Supabase pooler URL only (port 6543)
- **Never touch ports 3000/3001 or `mr-travels-001`** — legacy app, off-limits
- All new tables use `g4d_` prefix; `npm run build` must show 0 errors before every commit
- All queries filter by `vendorId` (multi-tenant)
- Never auto-post to social media without vendor approval
- **Deploy pattern** (backend or frontend): `git pull origin get4domain-site` → `docker compose build <service>` → `docker compose up -d --force-recreate <service>` → check `RestartCount=0`. Run `npx prisma db push` inside the backend container whenever a migration lands.
- **API keys** go in Admin → Integrations (encrypted DB, takes priority over `.env.local` fallback) — *except* `NEXT_PUBLIC_*` frontend keys (e.g. Razorpay's key_id), which are Next.js build-time values and must go in the frontend's `.env.local` + rebuild.

---

## 3. Feature Status

### Aug 2026 run — shipped (code + committed; VM deploy per `docs/VM_DEPLOY_RUNBOOK.md`)
- **Phase 1 (pricing/keys):** ₹999/month single plan sweep; wallet min ₹499; industry keys → clinic/salon/gym (frontend, with alias bridge for legacy `/demo/healthcare` + stored values); logo/favicon fixed. **Phase 1B Decision 1:** AI free credit ₹999→₹499 (forward-only).
- **Vendor CMS editor:** rich per-category `my-products` + banner/logo in `my-website` + **live `/site/[subdomain]`** renderer (`VendorProduct.customFields`, `VendorCMS.banner`).
- **Track A:** industry skins (config-derived); **AI template library** (`g4d_ai_templates`, admin Content Library + AI-Studio picker); **website theme system** (`g4d_website_themes`, CSS-var, `VendorCMS.themeId`, vendor picker); native share on AI Studio; animated industry mockups.
- **Track B:** vendor KPI cards; **auto-bot support** (bot-first, escalation-only tickets); **accounting** (`g4d_expenses`, **GST-exclusive**, P&L + GST statement + voucher); **stationery** (`g4d_stationery`); **tool-utilization analytics** (derived, no new table); admin **escalation queue + cross-vendor utilization + aggregate-only accounting**; mini-BOS marketing copy.
- **Track C:** **real customer portal** (stateless JWT sessions, customer-specific secret; data already tenant-scoped); **embeddable widget + lead API** (`Vendor.widgetKey`, reuses the bot, leads → CRM); admin **per-vendor override** (`Vendor.configOverride`, `/industries/me` merges live); **department team invites** (`TeamMember.department`).
- **Home overview business-module cards:** the vendor home is now the product map — one card per module (TeleCRM/Growth Hub/AI Studio/Accounts/Communication/Website), each a real stat + "Open" (reuses Track B KPIs + `/analytics/usage`).
- **TeleCRM redesign (Superfone-style):** list/dialer is now the DEFAULT — search, Today's Tasks (Overdue/Today), Recent Calls (`/crm/telecrm/recent-calls`), flat contact list; add + CSV import into the vendor's own call list (consent boundary labeled in-UI: call list ≠ campaign list); professional empty states throughout; **Kanban demoted to a secondary "Pipeline" tab (kept, not removed)**; industry-aware contact fields (`CampaignLead.customFields`, from `recordCustomFields`).

**PARKED (await KSM, do not build until they answer):**
- **3E real AI-provider wiring** — Stability (images) + Kling/HeyGen/Runway (video). Config scaffolding + key slots shipped; real calls blocked on *which provider accounts are funded* (Stop 4). Neither Claude nor a dispatch can answer this — it's real account info only KSM has.
- **Phase 1B Decision 2 — Razorpay auto-recurring subscriptions.** Current checkout is a one-time ₹999 order (no subscription object). Needs a Razorpay `plan_id` + mandate confirmation from KSM before any code.



### ✅ Book-Demo Funnel (Phases 1–6) — COMPLETE, tested end-to-end
Cold visitor → industry select → OTP verify (Fast2SMS Quick SMS route) → creates TeleCRM lead (safety net) → sandboxed vendor provisioned + seeded → unified tour (single entry, floating switcher between Website/Dashboard/Customer, no re-auth) → "Go live" → Razorpay checkout (₹6,999/yr) → same vendor row converts atomically, real login, invoice auto-generates, Pro credit granted. **Razorpay confirmed working in test mode.** Live keys not yet switched — deliberate future step.

### ✅ TeleCRM — working (redesigned 17 Aug 2026)
**List/dialer is the default view** (reverses the earlier Kanban-only decision): always-visible search (name/number), Today's Tasks (Overdue/Today from follow-up reminders), Recent Calls (call-log history), flat contact list (status badge + last-called). Add a contact or CSV-import a call list — the consent boundary is labeled in-UI ("your call list, NOT a campaign list; uploading here does not grant bulk-messaging consent"). Professional empty states on every section. **Kanban preserved as a secondary "Pipeline" tab.** Industry-aware contact fields from the industry config. Per-lead summary panel (no AI — real recorded notes/history only), non-AI follow-up reminders with due badges, demo leads confirmed syncing correctly. Same shared board powers both vendor + admin (admin adapter omits the vendor-only add/import/recent extras).

### ✅ AI Studio — text generation confirmed working
Root-cause fixed: key resolution now reads from Admin → Integrations (was hardcoded to env-only before). Social Post generation confirmed producing real, high-quality output. Image generation (poster/letterhead/visiting card AI backgrounds) gracefully falls back to clean templates until a real `OPENAI_API_KEY` is added. Video generation (Runway/HeyGen) still mock — no key configured.

### 🟡 Communication Hub — inbox built, campaigns NOT built
Real 3-panel inbox UI with persisted message history (was ephemeral before, now a real `g4d_messages` store). **Gap: inbound message capture (webhooks) not built** — can send and see sent history, can't yet auto-receive customer replies. **Gap: no campaign feature** — no way to send segmented SMS/WhatsApp/Email to lead lists yet (see Pending, below).

### ✅ Invoices — working
Branded PDF (KSM logo, GSTIN, line items, discounts, renewal note), auto-generated on signup + top-up, WhatsApp + Email share buttons, reachable from vendor nav (was previously just not linked).

### ✅ Wallet & Pricing — working
Trial/Pro credit tiers editable in Pricing Manager and now actually granted on signup (was editable-only before). Pro-tier credit-on-upgrade wired into the Phase 5 conversion.

### ✅ Demo Sites (`/demo/[industry]`) — all 20 live, but content is generic
Multi-section (hero/catalog/team/booking/reviews/about/contact), real images/banners, own nav (not the app's borrowed bottom-nav). **Known gap:** sections show generic service-card content, not real per-industry schemas (e.g. Real Estate shows generic packages instead of actual property listings). User is managing this as ongoing work this week — see Website CMS below for the real fix.

---

## 4. Comms Providers — current setup vs. what's needed for campaigns

| Channel | What's live today | What promotional/campaign use requires |
|---|---|---|
| **SMS** (Fast2SMS) | Quick SMS route (`route=q`) — no DLT needed, but ~₹5/SMS, and this route is meant for transactional/OTP use | **Full DLT registration** (Entity + Sender ID + "Service Explicit" template) for real promotional SMS — cheaper per-SMS but only sendable to non-DND numbers, 10AM–9PM only |
| **WhatsApp** (Fast2SMS API) | One-off outreach messages | **Marketing-category template**, Meta-approved, requires: Business Verification + privacy policy URL (mandatory since Jan 2026), **explicit opt-in per recipient**, opt-out handling (STOP). Highest per-conversation cost of any WhatsApp category. Messages outside the 24hr customer-service window always need an approved template |
| **Email** (Resend) | Transactional (invoices, welcome, notifications) | Resend can send marketing email too, but needs verified domain + proper unsubscribe + list hygiene — worth confirming Resend's current bulk-send policy in their dashboard before running real campaigns |

**Meta/Google Ad spend** is not a fixed cost — both run real-time auctions. For the managed-service model: the **vendor sets a budget**, Get4Domain's team runs campaigns within it via Business Manager Partner Access / Google Ads MCC, vendor pays actual ad spend (to Meta/Google) + Get4Domain's management fee on top (flat retainer, per-post fee, or % of spend — model not yet finalized).

---

## 5. Pending — organized by what's actually needed

### Needs your action, not code
- GST-inclusive vs. exclusive decision (affects every invoice)
- OpenAI API key → Admin → Integrations (unlocks AI image generation)
- Video generation key (Runway or HeyGen)
- WhatsApp Template/Message ID setup (needs clarifying what this field expects)
- Meta App Review + Google Ads developer token applications (2–4 weeks each, needed for self-serve social auto-posting — not started)

### Major initiatives — not started, each needs its own proper scoping
1. **Website CMS** — real per-industry data schemas (property listings, menus, service catalogs), vendor-facing content editor, template library (AI-tool-assisted design variety stored in-platform), SEO/AEO per site, deploy options (subdomain live day-1, custom domain, self-export)
2. **Managed Social Media** — Meta Business Manager Partner Access onboarding, Google Business Profile creation/claiming + monthly update workflow, ad campaign execution process
3. **Communication Hub Campaigns** — segmented SMS/WhatsApp/Email sends through lead/contact lists (not bulk blasting), respecting each channel's compliance rules above
4. **Inbound message capture** for Communication Hub (webhooks from Fast2SMS/Resend)

### Smaller, deferred
- Vendor dashboard UI polish — waiting on user screenshots of specific spots
- Fully-managed social posting (non-ad, organic) — lower priority than the ad-running managed service

---

## 6. Launch Planning

Target mentioned: 13 Aug 2026. Real blockers for a **full public launch with live payments**: Razorpay still test-mode, GST decision undecided, demo content depth gap. Recommended alternative discussed: a narrower **soft launch** — share with real prospects, close deals via sales-assisted TeleCRM with human-collected payment, while the automated self-serve path keeps hardening in parallel.

---

## 7. Schedule / Roadmap
*Discipline: one major initiative fully deployed and tested before starting the next. Update this document after every completed dispatch — this is the canonical plan, not chat history.*

### Immediate — next session
- Deploy tonight's two dispatches (site architecture rebuild + content-depth pass)
- Personally click-test 3+ category booking/enquiry flows (the one thing tonight's build couldn't self-verify)
- Confirm no regressions before building anything further on top

### This week — decisions only, not code (fast, unblocks other things)
- GST inclusive vs. exclusive — pin down, been open too long
- Video generation key (Runway or HeyGen) — sign up, paste into Admin → Integrations
- WhatsApp Template/Message ID — clarify what the field actually expects, then set it
- Varied image pool per category — small, already agreed, quick dispatch

### This week — launch
- Aim for a **soft launch** around 13 Aug: share with real prospects, close via sales-assisted TeleCRM with human-collected payment
- **Full public launch (live Razorpay keys) waits** until soft-launch feedback comes in and more real-world testing happens — don't rush live payment switching to hit a date

### Next — major initiatives, sequenced, one at a time
1. **Bespoke subcategory content** — smaller, natural next increment on tonight's work
2. **Website CMS vendor-facing editor** — the actual tool for a real vendor to manage their own live site content. Not built yet — tonight built the site structure, not the editing tool
3. **Communication Hub provider swap** — proper two-way WhatsApp BSP + inbound email, only if live two-way messaging becomes a real priority (real ongoing cost)
4. **Managed Social Media** — Meta/Google ad execution service, Google Business Profile management
5. **Communication Hub Campaigns** — segmented SMS/WhatsApp/Email sends to lead lists

### Parallel, doesn't block anything else — start whenever
- Submit Meta App Review + Google Ads developer token applications now if self-serve social ads is ever wanted — external 2–4 week clock, free to start early, no reason to wait
