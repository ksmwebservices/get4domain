> **Evidence file — static audit, 2026-10-02.** Produced by read-only code inspection (no runtime, no DB writes, no provider calls). Every status is "static-verified only" unless stated. This is raw supporting evidence for [AUDIT_REPORT.md](../AUDIT_REPORT.md); where it disagrees with AUDIT_REPORT.md or STATUS.md on post-audit changes, those win.

> **Post-audit corrections (2026-10-02, commit f7ad328 and DB check):** (1) The DomainCampaign fee logic described in §8/§9 as `MAX(10% of spend, ₹9,999)` has been REPLACED with the PRD §88 brackets (₹2,000 / ₹5,000 / ₹10,000, plus an admin Enterprise/Custom override) — see STATUS.md. (2) The `g4d_domain_campaign_records` migration IS applied on the live DB (verified by a read-only check of `_prisma_migrations`); only `20261002120000_domain_campaign_custom_fee` (isCustomFee) is pending. (3) The duplicate-invoice defect in `generateInvoice` (API does not check `invoiceId`; the admin UI hides the button once invoiced) is still open.

# AUDIT — GROWTH / SOCIAL / MARKETING / CONTENT / AI  (V2 PRD §14-21, 38-39, 69, 72, 84, 88)

Method: static code inspection only (Read/Grep/Glob, wc/ls). Nothing was run, built, migrated or called.
Everything below is **static-verified only** — no runtime/provider verification was possible.
Repo: C:\Get4Domain\get4domain-site  (backend-api/src, get4domain_mvp/src). Branch get4domain-site.
PRD source: docs/reference/GET4DOMAIN_V2_PRD.md (read §14-24, 38-39, 72, 84, 88, 89).

Paths below are relative to `backend-api/src` (BE) or `get4domain_mvp/src` (FE) unless stated.

---------------------------------------------------------------------------------------------------
## 0. HEADLINE ANSWER

**The Growth / Social / Marketing / Content area is NOT 100% functional against the V2 PRD.**
What genuinely works end-to-end (static-verified): Campaign Pages (landing page -> lead -> CRM/notification), the embeddable chat/lead widget, AI text generation with wallet debit (needs an OpenAI/Anthropic key), per-vendor meta-title/description on vendor sites, platform-level sitemap/robots/JSON-LD, Domain Campaign enquiry/client/manual-spend/invoice admin tool.
Everything the PRD calls "Social Publisher", "SEO Manager", "Search Insights", "Share Links/UTM", "Growth Analytics", "Offers/Loyalty/Referral", "Sales Channels/Marketplace/Shipping" **does not exist** (MISSING).
The only code that resembles social publishing is a **MOCK** Meta service that fabricates a post id and returns `status:'published'`; **no frontend screen calls it**.
There are **zero automated tests** in either app.

---------------------------------------------------------------------------------------------------
## 1. SOCIAL PUBLISHER (PRD §20, §21, §72)

| Question | Evidence | Finding |
|---|---|---|
| Any real OAuth flow for Facebook Pages / Instagram / YouTube / LinkedIn / GBP? | `grep -ri "oauth\|graph.facebook\|youtube\|linkedin\|business.google\|searchconsole"` over backend-api/src returns only: a TODO comment in `meta/meta.service.ts:13,32-33`; a `youtube?: string` social-URL text field in `cms/dto/update-vendor-cms.dto.ts:33`; a managed-services price-list string `managed-services/managed-services.service.ts:18`. No controller route for OAuth start/callback. | **MISSING** |
| Social account model / stored tokens (encrypted)? | `prisma/schema.prisma` has no model matching social/oauth/token/connection (grep of `^model` names). Only platform-wide secrets exist in `PlatformSetting` (AES-encrypted via `platform-settings/crypto.util`, `platform-settings.service.ts:89-96`) — those are Get4Domain's own keys, not per-vendor tokens. | **MISSING** (per-vendor social account entity). |
| Real publish call to Graph API / YouTube API? | `meta/meta.service.ts:28-42`: reads `meta/access_token`, then only `logger.log('[MOCK] Meta publish ...')`, builds `fakeId = mock_<platform>_<Date.now()>`, returns `postUrl: https://<platform>.com/mock/<id>`, `status: token ? 'published' : 'mock'`, `mock: true`. Real Graph call is a code comment only. | **MOCKED**. **Fake-success hazard**: with a token configured it returns `status:'published'` for a post that was never sent. |
| What does the Growth Hub "Publish" button do? | **There is no button.** `api.growthPublish` is defined at `lib/api.ts:786-787` but `grep growthPublish|growthRequestAd|growthListAds|growthLaunchAd` across get4domain_mvp/src finds **no caller outside lib/api.ts**. "Growth Hub" nav (`app/dashboard/layout.tsx:120`) points to `/dashboard/campaigns`, which is the *Campaign Pages* screen (landing-page builder), not a social screen. | **BACKEND-ONLY (mock)** for `POST /growth-hub/publish` (`growth-hub/growth-hub.controller.ts:19-23`, `growth-hub.service.ts:17-19`). UI: **MISSING**. |
| Social publication entity (Draft/Ready/Publishing/Published/Failed, external id)? | No model. `PublishResult` is a transient TS interface (`meta.service.ts:4-9`); nothing is persisted. | **MISSING** |
| Content calendar / scheduling? | No scheduler/cron code for posts. Campaign wizard step 4 "Schedule Reminder" stores a reminder in **browser localStorage** only (`app/dashboard/campaigns/page.tsx:301-304`) and says "not an auto-post". Marketing claim "Scheduling" (`app/(marketing)/features/page.tsx:32`) has no backing. | **MISSING** (claim not backed by code) |
| What do `meta` and `google-ads` modules do? | `meta` = mock publish stub (above). `google-ads/google-ads.service.ts:27-40`: reads `google_ads/developer_token`, logs `[MOCK] Google Ads launch`, returns `externalCampaignId: mock_gads_<ts>`, `status: devToken ? 'launched' : 'mock'`. **Neither reads ads reports, neither posts anything real.** Not an ads-API read — pure stubs. | **MOCKED** |
| What happens on admin "launch ad"? | `growth-hub/growth-hub.service.ts:66-74`: sets Campaign `status:'active'`, `approvedAt=now` and stores `analytics:{externalCampaignId:'mock_gads_…', mock:true}` **regardless** of mock. DB says "active" though nothing was launched. | **MOCKED + fake-success state** |
| Ad request flow | `POST /growth-hub/ads` stores a `Campaign` row `status:'pending_review'`, `walletCost:0` (`growth-hub.service.ts:21-37`). No UI calls it. | **BACKEND-ONLY** |
| Per-vendor permission | `growth-hub.controller.ts:10` `@RequireModule('campaigns')` only restricts *team members*; `common/guards/module.guard.ts:12-33` is a no-op for vendor owners. `publish` has no AdminGuard (any logged-in user). | PARTIAL |

PRD §72.1 "must not be represented by fake Publish buttons" — currently the *API* is a fake publish; the UI has none. PRD §89 "Never simulate production success" is violated by `meta.service.ts:40` and `growth-hub.service.ts:66-74`.

---------------------------------------------------------------------------------------------------
## 2. CONTENT STUDIO / MARKETING STUDIO (PRD §18, §19, §38, §84)

### 2.1 AI content generation
- Endpoint `POST /ai/generate-content` (`ai/ai.controller.ts:30-34`) -> `AiService.generateContent` (`ai/ai.service.ts:364-397`).
- **Providers (real HTTP calls, key from platform settings with env fallback):**
  - Text: OpenAI `gpt-4o-mini` if `ai/openai_api_key` set (`ai.service.ts:154-178`), else Anthropic `claude-haiku-4-5-20251001` if `ai/anthropic_api_key` (`:180-200`); else throws 503 "not configured" (`:159`) — **no canned/mock output** (good).
  - Image: OpenAI **DALL-E 3** (`:264-299`), size 1024x1024; returns OpenAI's *temporary* URL (expires ~1h).
  - **Stability AI: NOT wired.** Key field exists (`platform-settings/platform-settings.constants.ts` ai category `stability_api_key`, comment "Real call wiring is Stop-4-gated"); `grep -ri stability backend-api/src` finds only that constants entry.
  - **Runway / HeyGen / Kling**: see §7. **Canva: NOT integrated** (only an unused `canvaTemplateId` column + enum value, `ai-templates/dto/ai-template.dto.ts:27-35`; no Canva API code anywhere).
- Wallet debit happens only after a real provider response parses (`ai.service.ts:385-390`) — good failure handling; internal staff free.
- **Content types** (FE `app/dashboard/ai-studio/page.tsx:32-41`): social_post, reel_script, blog_post, festival_poster, ad_creative, email, whatsapp, sms. **All 8 share one prompt** `Write a ${channel} marketing post…` returning `{caption,hashtags,imagePrompt}` JSON with `max_tokens: 500` (`ai.service.ts:375-382`). So "Blog Post" is a ≤500-token caption-shaped JSON, not a blog; "Reel Script" is a caption, not a scene script. -> **PARTIAL** for blog/reel_script.
- **No vendor business-master data is fed to the AI.** Prompt gets only `vendorIndustry`, free-text `offerDetails`, `tone` (`ai.service.ts:375-380`; FE `ai-studio/page.tsx:281-284`). PRD §38 "AI must receive actual vendor context from structured data" -> **not met**. No Business Master/Branding/Products/Offers lookup. (The WhatsApp-bot path does ground on vendor KB, outside this area.)
- **Where generated assets are stored:** nowhere server-side. Result is returned to the browser; "Save" writes to **localStorage** (`ai-studio/page.tsx:296-300`, key `g4d_ai_library_<userId>`), library tab reads localStorage (`:256-260`). Text only; generated image URLs are not saved (and are temporary). No DB table for generated assets/content. Supabase Storage is used only for the auto-generated live-site hero (below). -> Library is **UI-ONLY / browser-local**; vendor loses it on device change/clear.
- **AI site hero (live)**: `ai.service.ts:312-349` DALL-E -> `StorageService.uploadFromUrl` -> Supabase REST (`storage/storage.service.ts:60-113`) -> permanent URL stored in `cms.banner` by `vendors/vendors.service.ts:90`. Real code, **BLOCKED-EXTERNAL** (needs OpenAI + Supabase creds; static-verified only). Skips cleanly (`not_configured`) when storage absent.
- `POST /ai/generate-page` (`ai.controller.ts:38-42`, and via campaign-pages `/generate`) has **no wallet debit** — free, unmetered AI call for any authenticated vendor.
- `POST /ai/chat` is `@Public()` (`ai.controller.ts:17-22`) and `/widget/chat` (public, `widget/widget.controller.ts:40-44`) both call the paid provider with no wallet charge and **no rate limiting anywhere** (`grep Throttler` = none) -> cost-abuse exposure.

### 2.2 Static creatives / Design editor
- `GET /design/templates` returns **2** hard-coded Fabric scenes only: "Festival Offer Poster" 1080x1080 and "Visiting Card" 1050x600 (`design/design.templates.ts:39-85`). PRD §18 lists ~13 social formats (IG story 9:16, FB cover, LinkedIn, WhatsApp status, GBP post, YouTube thumbnail…). Only admin-authored DB templates (`AiTemplate.source='design'`) could add more — their count at runtime is **unknown (not verifiable statically)**.
- FE editor `components/design/FabricEditor.tsx`: PNG/PDF export is **client-side** (`:248-252` toDataURL + jsPDF). Vendor mode has **no save** (Save only in admin mode, `:280`). No size-preset export set (1:1/9:16/…), no brand-kit fetch. Prefill only maps 3 keys: businessName / name / email (`ai-studio/page.tsx:140-149`), so phone/address are retyped.
- **Status: PARTIAL** (editor works as a client tool; no persistence; limited templates).

### 2.3 Business documents / Document Engine (PRD §18, §84)
- `business-documents` module: **3** coded types only — letterhead, visiting_card, id_card (`business-documents/business-documents.service.ts:40-62`, DTO enum `render-business-document.dto.ts:20-22`). PRD §18/§84 list ~16 (invoice, quotation, receipt, payment receipt, **payslip**, PO, delivery note, certificate, appointment card, thank-you card, membership card, agreement…).
- `render()` is **stateless**: takes posted `values`, returns HTML (`:65-68`, comment "Never reads or writes vendor/payment data"). **Does not pull vendor Business Master** — vendor retypes; only businessName/name/email prefilled in the browser. PRD §19 "vendor must NOT retype" -> **not met**.
- Export = **browser print-to-PDF via `window.open` + `window.print()`** (`ai-studio/page.tsx:170-175`); no server PDF, no PNG export, no stored history, **no numbering, no versioning, no variables engine, no audit**. PRD §84 requires "numbering, permissions, generation history and audit" -> **MISSING**.
- Other documents live in other modules (outside my area): invoices use their own coded HTML template (`invoices/templates/invoice.template.ts`), accounting has an expense voucher (`accounting/accounting.service.ts:137`), quotes module exists. **Payslip: no code anywhere** (`grep -i payslip` = none) -> MISSING.
- Template storage: `AiTemplate` table (`prisma/schema.prisma:831`) with `source` = prompt|canva|document|design|reel, `fields`, `editorJson`, `videoConfig`. CRUD real & admin-guarded (`ai-templates/ai-templates.controller.ts`). **`videoConfig`/`reel` templates are never consumed** (`grep videoConfig` outside ai-templates = none) and `canva` rows have no sync code -> storage-only.
- Logo input is a **free-text URL** field (`ai-studio/page.tsx:606`), not the vendor's stored logo.
- `uploads` (`uploads/uploads.controller.ts`): images only, 5 MB, **local VM disk** (`uploads/`), served at `/uploads/*`; no DB record, no tenant folder, SVG allowed (script-capable file served from the API origin). Not Supabase.

---------------------------------------------------------------------------------------------------
## 3. SEO MANAGER / SEARCH INSIGHTS / SHARE LINKS / GROWTH ANALYTICS (PRD §15-17, §31-33, §69)

| Item | Evidence | Status |
|---|---|---|
| SEO score, issue list, severity, "Fix Now", ALT/slug/meta suggestions | No SEO module in backend (dir list), no SEO page in FE `app/dashboard/*` (list: accounts, ai-studio, billing, campaigns, communication, crm, customer-hub, domain-app, domain-management, embed, go-live, invoices, landing-page, my-products, my-services, my-website, notifications, orders, payments, reports, settings, stationery, support, team, telecrm, wallet, website-engine, whatsapp-bot). | **MISSING** |
| Per-vendor meta title / description / keywords | Stored in `Cms` (`schema.prisma:201-203`), edited at `app/dashboard/my-website/page.tsx:352-356`, rendered by `generateMetadata` in `app/site/[subdomain]/[[...rest]]/page.tsx:92-104` (title, description, keywords, OG image). Manual entry, no suggestion/score. | **PARTIAL** (WORKING for manual meta; static-verified) |
| JSON-LD for vendor sites | Only in the **generic fallback** render (`app/site/[subdomain]/[[...rest]]/page.tsx:159-168`); the uploaded-theme, selected-template and engine-industry branches `return` earlier (`:117-141`) and emit none. | **PARTIAL** |
| Sitemap / robots | `app/sitemap.ts` + `app/robots.ts` cover **get4domain.com marketing + demo pages only** (`sitemap.ts:36-58`). No per-vendor sitemap/robots for `/site/<subdomain>` or vendor custom domains. Marketing-site JSON-LD exists in `app/layout.tsx:94-152`, `industries/[id]/page.tsx:81-105`, demo page. | Platform: **WORKING**; Vendor sites: **MISSING** |
| Google Analytics | `googleAnalyticsId` stored + form field (`my-website/page.tsx:357`, `schema.prisma:216`, DTO `update-vendor-cms.dto.ts:35`) but **never injected into any rendered page** (`grep gtag|googletagmanager|googleAnalyticsId` = only the field/DTO/schema). | **UI-ONLY** |
| Search Console / GBP / GA data integration | No code. | **MISSING** |
| Backlink tracking, AEO/GEO tooling | None (docs/GET4DOMAIN_SEO_GEO_AEO_09SEP2026.md exists as a document only; not verified as implemented). | **MISSING** |
| Search Insights (internal site-search capture) | `grep search.?term|searchInsight|search_query` in both apps -> nothing relevant. No table. | **MISSING** |
| Share Links with UTM / QR tracking | `grep utm` -> none. Only a QR image built via third-party `https://api.qrserver.com` (`app/dashboard/landing-page/page.tsx:218`); no tracked/short links, no UTM capture on leads (`campaign-pages.service.ts:113-121` stores `source:'campaign_page'` only). | **MISSING** (QR image only) |
| Growth Overview (growth score, SEO score, visitors, leads, orders, revenue, repeat, reviews, channels, recommendations) | No page. Closest = Analytics Hub `app/dashboard/reports/page.tsx` (see next row). | **MISSING** |
| Analytics Hub / Growth Analytics (visitors -> leads -> orders -> revenue) | `reports/page.tsx:32-49` loads real data (CRM leads, `/campaigns`, invoices, wallet txns, `/analytics/usage`) — computed from DB, not hardcoded. But: no visitor/traffic source, no orders, no channel attribution, no UTM. Backend `analytics/analytics.service.ts` only counts tool usage (leads/calls/AI/messages/campaign pages/listings) and platform invoice totals. "Campaigns by Status" card reads the **legacy** `/campaigns` model that no UI creates -> always empty (`reports/page.tsx:34,166-180`). Marketing page claims "website visitors … revenue" (`app/(marketing)/features/page.tsx:34`) — **no visitor tracking exists** (only `CampaignPage.views` counter). | **PARTIAL** |
| Campaign page view counting | `POST /campaign-pages/:id/view` public, increments on every page load (`campaign-pages.service.ts:96-98`, FE `app/go/[slug]/page.tsx:78`). No uniqueness, no bot filter, no rate limit, no source. | PARTIAL |

---------------------------------------------------------------------------------------------------
## 4. OFFERS ENGINE (PRD §28-30)
`grep -iE "coupon|cashback|loyalty|referral|affiliate|promo|voucher|flash"` over `prisma/schema.prisma` -> **0 hits**; over backend src -> only accounting "expense voucher" and invoice line discount. FE hits are static demo marketing copy in `engine/industries/kit/appointments.ts:89` and `retail/RetailSite.tsx:95`, not features. No coupon validation in checkout (`payments`/engine checkout).
**Coupons, cashback, flash deals, loyalty points, referrals, affiliates, promoters: MISSING.**
(Campaign "Offer" in the wizard is just a text field that seeds AI landing-page copy.)

## 5. SALES CHANNELS / MARKETPLACE / SHIPPING (PRD §22-24)
`grep -iE "shiprocket|delhivery|merchant.?center|google shopping|catalogue sync|whatsapp catalog|flipkart|amazon|courier|awb"` in backend src -> only an unrelated theme DTO. No connector abstraction, no feed export, no shipping/pincode/rate/AWB code. **MISSING** (sales channels, Google Shopping, Meta/WhatsApp catalogue, marketplace framework, shipping connectors).

---------------------------------------------------------------------------------------------------
## 6. CAMPAIGN PAGES + CAMPAIGNS

### 6.1 Campaign Pages (module `campaign-pages`)  — the one genuinely working growth feature
Path: FE wizard `app/dashboard/campaigns/page.tsx` (+ `landing-page/page.tsx`) -> `POST /campaign-pages/generate` (AI copy) -> `POST /campaign-pages` (`campaign-pages.controller.ts:23-27`, service `:40-61`) -> `CampaignPage` row (`schema.prisma:369-396`, unique slug) -> public FE `/go/[slug]` (`app/go/[slug]/page.tsx`) -> `GET /go/:slug` (public, `go.controller.ts:14-17`) -> lead form `POST /go/:slug/lead` (`:19-23`) -> `CampaignLead` row (`campaign-pages.service.ts:113-121`) -> vendor in-app notification (`:123-129`) -> shows in CRM/TeleCRM because `crm.service.ts:19-36` reads/writes the same `CampaignLead` table. Dashboard stats (views/leads/conversion) are real DB values (`:79-84`, FE `campaigns/page.tsx:188-196`). Ownership enforced (`:68-73`).
**Status: WORKING (static-verified only)** for page -> lead -> CRM. Gaps:
- **Free-1 limit + Rs20 extra-page wallet charge: NOT IMPLEMENTED.** `create()` (`campaign-pages.service.ts:40-61`) has no count check and no `walletService.deduct`. `extra_campaign_page` exists only as a *price-display* key (`platform-settings/platform-settings.constants.ts` pricing group; `platform-settings/public-pricing.controller.ts:16,48`; FE pricing page `app/(marketing)/pricing/page.tsx:53,79`). `grep -rn "extra_campaign_page"` shows no consumer. -> **MISSING (claim not backed by code)**. Vendors can create unlimited pages free.
- Same for pricing row **"We post on your page — Rs10"** (`social_post_publish`, `pricing/page.tsx:52,78`): no code charges or performs it (no publishing exists) -> **claim not backed by code** (could only be a manual service).
- Lead WhatsApp alert is **mis-ordered**: wallet debited Rs1 first (`:145`), then `whatsappService.sendTemplate` (`:146`) which *returns false* (not throws) when `MSG91_AUTH_KEY`/`MSG91_WHATSAPP_NUMBER` env is absent or the API fails (`notifications/whatsapp.service.ts:14-18,44-47`). Result: **vendor is charged although nothing was sent**; return value ignored. Also reads env only (not platform settings). -> **BUG (charge-without-delivery)**.
- Public lead + view endpoints have no CAPTCHA/rate-limit/duplicate protection; no UTM/source detail; `SubmitLeadDto` has no phone format validation (`dto/submit-lead.dto.ts`).
- Edit UI: `landing-page/page.tsx:115` calls `updateCampaignPage` — present. Soft-delete = `active:false` (`:75-77`).

### 6.2 Legacy `campaigns` module (wallet-approval model)
`campaigns/campaigns.service.ts`: `create` stores a Campaign (`pending_approval`, estimated `walletCost` from a hard-coded per-channel table `:9-16`: whatsapp 100, sms 50, email 10, facebook 1000, instagram 500, paid_ads 20000 paise). `POST /campaigns/:id/approve` (`campaigns.controller.ts:41-45`) is called by the **vendor themself** (`findOne(id, vendorId)`) and **deducts the wallet** (`service.ts:57-62`) then sets `approved` and notifies admin to "execute" manually. **No code executes/sends/posts the campaign**; `analytics` just returns an unpopulated JSON column (`:84-88`). No FE screen calls `createCampaign`/`approveCampaign`/`getCampaignAnalytics` (grep: only `api.getCampaigns()` in `reports/page.tsx:34`). -> **BACKEND-ONLY**, and charging flow with no delivery = latent fake-success/customer-harm if ever exposed in UI.

---------------------------------------------------------------------------------------------------
## 7. AI REELS / VIDEO (PRD §18 "Coming Soon", §39)

PRD says Phase 1 = "AI Reels & Video — Coming Soon", **no production implementation**. Reality: implemented and presented as live, with no "Coming Soon" label.

| Part | Evidence | Status |
|---|---|---|
| UI labelling | AI Studio shows live buttons "Reel / Video" and "Photo Reel" (`ai-studio/page.tsx:438-439`); marketing says "Reel maker" (`features/page.tsx:30`, `components/marketing/home/FeatureGrid.tsx:9`, `AIStudio.tsx:9`, a `ReelsMock` visual `:96`); pricing page "Video generation Rs50-100", "posters, reels" included (`pricing/page.tsx:26,51`). Only HRM/Office mgmt are labelled coming soon (`pricing/page.tsx:34-35`). **No honest "Coming Soon" label for reels.** | **Conflicts with PRD §18/§39** |
| `video` module — no key | `video/video.service.ts:53-57`: `provider==='none'` returns a `mock_<ts>` job; `status()` returns `done` with a **hard-coded public Google sample MP4** `MOCK_VIDEO_URL` (`:12,80-81`). UI shows cost label "Free (mock)" (`ai-studio/page.tsx:633`) but presents the sample clip under "Result" with a Download link. A vendor could mistake a stock sample for their video. | **MOCKED (fake success)** |
| Runway (`gen3a_turbo`) | Real `fetch` to `api.dev.runwayml.com/v1/image_to_video` (`video.service.ts:94-110`). Endpoint is image-to-video; UI sends **text-only prompt** (`ai-studio/page.tsx:231`) and `promptImage` is optional in DTO — Runway's image_to_video requires an image, so text-only is likely rejected (unverified, per own code comment lines 17-21 "not live-tested"). | **BLOCKED-EXTERNAL** (needs key; unverified; likely broken for text-only) |
| HeyGen | Real fetch to `api.heygen.com/v2/video/generate` with **placeholder** `avatar_id:'default'`, `voice_id:'default'` (`:135-136`) — likely invalid IDs. | **BLOCKED-EXTERNAL** (unverified; likely fails) |
| Kling | `activeProvider()` can return `'kling'` (`:36-42`) but `generate()`/`status()` route **everything non-runway to HeyGen** (`:66,84`) — Kling is never called; HeyGen is called with a missing key. | **BROKEN** |
| Billing | Wallet debited on submit (`:72-75`); a job that later fails is **not refunded**. No DB record of jobs/assets; result URL is the provider's temporary URL, not stored. | PARTIAL |
| Photo Reel (Remotion) | `reels/reels.service.ts:42-78` spawns `node render.mjs` in `backend-api/remotion/` (real Remotion composition `remotion/src/Reel.tsx`); returns `not_configured` unless `remotion/node_modules` exists (`:34-36`) — `node_modules` is **absent in the repo** (needs VM `npm install`, FFmpeg, headless Chrome; README says Remotion needs a paid licence for >3-person companies). 14 music tracks registered (`reels/reels.tracks.ts`) — licences asserted in a comment only; a duplicate `(1).mp3` file is untracked in git. MP4 written to **local VM disk** `uploads/reels/` and served from `/uploads`; no DB row; render runs in-process request (long, un-queued; no concurrency/timeout control). Wallet debit after success (good). | **BLOCKED-EXTERNAL** (environment + licence); static-verified only |
| Reel templates | `AiTemplate.videoConfig`/`source='reel'` unused. | MISSING |
| Controllers have no `@RequireModule`/addon check; `video/status` has no ownership check. | `video.controller.ts`, `reels.controller.ts` | PARTIAL |

---------------------------------------------------------------------------------------------------
## 8. DOMAIN CAMPAIGN (PRD §88)

**What exists** (`domain-campaign/*`, FE `app/(marketing)/domain-campaign/page.tsx`, admin tab in `app/admin/managed-services/page.tsx:33,102,178,280+`, dashboard CTA in `app/dashboard/my-services/page.tsx:53-62,133-145`):
1. Public enquiry `POST /domain-campaign/enquiry` -> `Lead` row (`source:'domain-campaign'`) + admin email + admin notification (`domain-campaign.service.ts:47-78`). **WORKING (static)**. Note: `@Public()` DTO accepts a caller-supplied `vendorId` (`dto/create-enquiry.dto.ts`) -> unauthenticated user can tag a lead with any vendor id (low severity spoofing).
2. Dashboard CTA `POST /domain-campaign/clients/me` re-uses the enquiry with `vendorId = user.sub` (controller `:25-30`). WORKING (static).
3. Admin: list leads, onboard client (creates `Subscription{product:'DOMAIN_CAMPAIGN', plan:'STARTUP', amount: 999900}` — nominal amount, `service.ts:90-98`), list clients, record monthly ad spend (manual), billing history, generate monthly invoice via `InvoicesService.createInvoice` (`:151-181`). AdminGuard on all admin routes.
4. Spend/fee records use **raw SQL** (`$queryRawUnsafe`, parameterised) on `g4d_domain_campaign_records` because the Prisma client lacked the model; the migration `prisma/migrations/20261001110000_add_domain_campaign_records` exists but the code comment (`service.ts:104-110`) says it is **not yet applied to the live DB** (also noted in project memory) -> admin spend/invoice tool is **BLOCKED until `prisma migrate deploy`**; unverified whether applied.
5. **No live Meta/Google Ads tracking, no campaign creation, no creative, no reporting** — spend is typed in manually (acknowledged in `dto/record-spend.dto.ts` header and `schema.prisma:750`). PRD §88 scope (strategy, creative, publishing, optimization, reporting) is a *human service*; the app only does enquiry -> client flag -> manual spend -> invoice.
6. `generateInvoice` does **not** check `record.invoiceId` — clicking twice creates duplicate invoices (`:151-181`).

**FEE CONTRADICTION (precise):**
- Code: `calculateFee(adSpendPaise) = Math.max(Math.round(adSpendPaise * 0.10), 999900)` i.e. **MAX(10% of spend, Rs9,999)** (`domain-campaign.service.ts:12-13,37-39`). Duplicated client-side `admin/managed-services/page.tsx:281-282`. Public page copy: "10% of your monthly ad spend, Rs9,999/month minimum"; FAQ example "Rs20,000 spend -> pay Rs9,999" (`app/(marketing)/domain-campaign/page.tsx:8,22,51-52,87-98`); invoice text embeds the same rule (`service.ts:158-164`). The schema comment states the same (`schema.prisma:751`).
- V2 PRD §88: <=Rs20,000 budget -> **Rs2,000/mo**; Rs20,001-1,00,000 -> **Rs5,000/mo**; >Rs1,00,000 -> **Rs10,000/mo**; enterprise custom.
- Worked divergence: Rs20,000 spend: code Rs9,999 vs PRD Rs2,000 (4.99x); Rs50,000: code Rs9,999 vs PRD Rs5,000; Rs1,00,000: code Rs10,000 vs PRD Rs5,000; Rs2,00,000: code Rs20,000 vs PRD Rs10,000. No tier table and no "enterprise/custom" path exists in code. The code also bills *percent-of-spend* where the PRD is a *fixed fee per band*. **Needs product-owner decision which is authoritative**, then change `domain-campaign.service.ts`, `admin/managed-services/page.tsx`, the public marketing page and schema comment together.
- Also stale/contradictory: AI assistant marketing prompt says "Do NOT mention a separate DomainCampaign plan … outdated" (`ai/ai.service.ts:65-67`) while a DomainCampaign product is live on the site.

---------------------------------------------------------------------------------------------------
## 9. MASTER FEATURE MATRIX

Columns: Area | Feature | Existing route/code | Status | Backend | DB | Permission | Tests | Notes
(Tests = **None** for every row: no `*.spec.*`/`*.test.*` files in either app and no `test` script in `backend-api/package.json` scripts (`:5-17`) or `get4domain_mvp/package.json`. Confirmed.)

| # | Area | Feature | Existing route/code | Status | Backend | DB | Permission | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Growth | Growth Overview (scores, visitors, orders, revenue, recs) | none | MISSING | none | none | - | None | Analytics Hub is the nearest (row 33) |
| 2 | Growth | "Growth Hub" nav entry | `dashboard/layout.tsx:120` -> /dashboard/campaigns | PARTIAL | campaign-pages | CampaignPage | frontend module flag only | None | Is Campaign Pages, not the PRD Growth nav (Growth Overview/SEO/Studio/Social/Offers/Loyalty/Referral/Search Insights/Share Links/Sales Channels/Growth Analytics = 11 items; none built except Campaigns) |
| 3 | Social | Connected Accounts (OAuth FB/IG/YT/LI/GBP) | none | MISSING | none | none | - | None | PRD §20 |
| 4 | Social | Publish to FB/IG | `POST /growth-hub/publish` | MOCKED | `meta/meta.service.ts:28-42` | none | any logged-in | None | no FE caller; fake id/URL; `status:'published'` if token set |
| 5 | Social | Publication history / external id / retry | none | MISSING | none | none | - | None | |
| 6 | Social | Content calendar / scheduling | none (localStorage reminder `campaigns/page.tsx:303`) | MISSING | none | none | - | None | marketing claims "Scheduling" |
| 7 | Social | LinkedIn / YouTube / GBP / X publishing | none | MISSING | none | none | - | None | |
| 8 | Ads | Ad request (`POST /growth-hub/ads`) | `growth-hub.service.ts:21-37` | BACKEND-ONLY | yes | Campaign | RequireModule (team only) | None | no UI |
| 9 | Ads | Admin launch ad (Google/Meta) | `POST /growth-hub/ads/:id/launch` | MOCKED | `google-ads.service.ts` stub | Campaign.status=active | AdminGuard | None | sets active with fake `mock_gads_` id |
| 10 | Campaigns | Legacy create/approve (wallet debit) | `campaigns/*` | BACKEND-ONLY | debits wallet, no execution | Campaign | RequireModule | None | vendor self-approves; nothing delivered |
| 11 | Campaigns | Campaign Pages create/edit/list/delete | `campaign-pages/*`, FE campaigns+landing-page | WORKING (static-verified) | yes | CampaignPage | owner check | None | |
| 12 | Campaigns | Public /go/:slug + lead -> CRM | `go.controller.ts`, `app/go/[slug]` | WORKING (static-verified) | yes | CampaignLead (=CRM leads) | public | None | no rate limit/CAPTCHA |
| 13 | Campaigns | WhatsApp lead alert to vendor | `campaign-pages.service.ts:139-152` | PARTIAL | MSG91 template via env only | WalletTransaction | - | None | Rs1 charged before send; false return ignored |
| 14 | Campaigns | Free-1 page limit + Rs20 extra page charge | none | MISSING | none | none | - | None | price key is display-only |
| 15 | Campaigns | Page analytics (views/leads/conv) | `GET /campaign-pages/:id/analytics` | PARTIAL | real counts | CampaignPage.views | owner | None | naive view counter; no UTM/source |
| 16 | Campaigns | QR / share | `landing-page/page.tsx:218` | PARTIAL | none | none | - | None | third-party qrserver.com image; untracked |
| 17 | Content | AI text generation (8 types) | `POST /ai/generate-content` | PARTIAL | OpenAI/Anthropic real | WalletTransaction | any auth; internal free | None | needs key; no vendor-master context; blog/reel_script = 500-token caption JSON |
| 18 | Content | AI image (poster/ad/social) | `ai.service.ts:264-299` | PARTIAL | DALL-E 3 real | none | - | None | temp URL (1h), not stored; Stability not wired |
| 19 | Content | AI site hero -> Supabase -> cms.banner | `ai.service.ts:312-349`, `vendors.service.ts:90` | BLOCKED-EXTERNAL | OpenAI + Supabase REST | Cms.banner | system | None | needs creds |
| 20 | Content | AI library (saved content) | `ai-studio/page.tsx:296-300` | UI-ONLY (browser localStorage) | none | none | - | None | lost on device change; text only |
| 21 | Content | Landing-page copy generation | `/ai/generate-page`, `/campaign-pages/generate` | PARTIAL | real LLM | none | any auth | None | unmetered (no wallet) |
| 22 | Content | Public AI chat (marketing/dashboard) | `POST /ai/chat` @Public | PARTIAL | real LLM | none | **public** | None | unmetered; no rate limit |
| 23 | Studio | Fabric design editor (poster/card) | `design/*`, `FabricEditor.tsx` | PARTIAL | static 2 templates | AiTemplate (admin) | auth | None | client-side PNG/PDF; no save in vendor mode |
| 24 | Studio | Social creative size presets (IG story, FB cover, LinkedIn, YT thumb, WA status, GBP) | none | MISSING | none | none | - | None | only 1080x1080 poster + card built in |
| 25 | Studio | Business docs: letterhead/visiting card/ID card | `business-documents/*` | PARTIAL | stateless HTML | none | auth | None | print-to-PDF; vendor retypes; 3 of ~16 |
| 26 | Studio | Invoice/quotation/receipt/PO/delivery note/etc. via Studio | invoices/quotes modules (outside area) | PARTIAL | separate modules | various | - | None | not part of Studio doc engine |
| 27 | Studio | Payslip, certificate, appointment/thank-you/membership card, agreement | none | MISSING | none | none | - | None | |
| 28 | Studio | Document engine (variables, numbering, versions, history, audit) | none | MISSING | none | none | - | None | PRD §84 |
| 29 | Studio | Data-aware generation from Business Master | none | MISSING | none | none | - | None | PRD §19 |
| 30 | Studio | Template library CRUD (prompt/design/document) | `ai-templates/*`, FE admin/library | WORKING (static-verified) | yes | AiTemplate | AdminGuard | None | reel/canva rows have no consumer |
| 31 | Studio | Canva integration | none | MISSING | none | `canvaTemplateId` col only | - | None | |
| 32 | Reels | AI video (no key) | `video.service.ts:53-57,80-81` | MOCKED | stock Google sample MP4 | none | auth | None | looks like a real result |
| 33 | Reels | AI video Runway / HeyGen | `video.service.ts:94-160` | BLOCKED-EXTERNAL | real fetch, unverified | none | auth | None | text-only Runway likely rejected; HeyGen default ids |
| 34 | Reels | AI video Kling | `video.service.ts:36-42,66,84` | BROKEN | routes to HeyGen | none | - | None | |
| 35 | Reels | Photo Reel (Remotion) | `reels/*`, `remotion/` | BLOCKED-EXTERNAL | child-process render | none (disk file) | auth | None | node_modules/FFmpeg/Chrome + licence; ephemeral disk |
| 36 | Reels | "Coming Soon" honest labelling | `ai-studio/page.tsx:438-439`, marketing pages | BROKEN vs PRD | - | - | - | None | PRD §18/§39 require Coming Soon |
| 37 | SEO | SEO Manager (score/issues/fix) | none | MISSING | none | none | - | None | |
| 38 | SEO | Manual meta title/desc/keywords/OG | `my-website`, `app/site/.../page.tsx:92-104` | PARTIAL | cms | Cms.seo* | vendor | None | works; no suggestions |
| 39 | SEO | JSON-LD on vendor sites | `app/site/.../page.tsx:159-168` | PARTIAL | n/a | Cms | - | None | generic branch only |
| 40 | SEO | Sitemap/robots (platform) | `app/sitemap.ts`, `app/robots.ts` | WORKING (static-verified) | n/a | none | - | None | marketing+demo only |
| 41 | SEO | Sitemap/robots (vendor sites) | none | MISSING | - | - | - | None | |
| 42 | SEO | Google Analytics ID | `my-website/page.tsx:357` | UI-ONLY | stored only | Cms.googleAnalyticsId | vendor | None | never injected |
| 43 | SEO | Search Console / GBP / GA integrations | none | MISSING | none | none | - | None | |
| 44 | Insights | Search Insights | none | MISSING | none | none | - | None | |
| 45 | Links | Share Links UTM/QR tracking | none | MISSING | none | none | - | None | |
| 46 | Analytics | Analytics Hub (reports page) | `dashboard/reports/page.tsx`, `analytics/*` | PARTIAL | real DB aggregates | Lead/Invoice/Wallet/etc | RequireModule('reports') | None | no visitors/orders/channels; campaigns card reads legacy model |
| 47 | Offers | Coupons / cashback / flash deals | none | MISSING | none | none | - | None | |
| 48 | Offers | Loyalty / referral / affiliate / promoter | none | MISSING | none | none | - | None | |
| 49 | Channels | Sales channels, Google Shopping, Meta/WA catalogue, marketplace framework | none | MISSING | none | none | - | None | |
| 50 | Channels | Shipping/delivery connectors | none | MISSING | none | none | - | None | |
| 51 | Widget | Embed chat + lead widget | `widget/*`, `dashboard/embed/page.tsx` | WORKING (static-verified) | yes | Vendor.widgetKey, CampaignLead | public key | None | chat unmetered; no rate limit; sandbox vendors blocked |
| 52 | Platform | Module/addon toggles (growth_hub, ai_studio…) | `addons/*` | PARTIAL | CRUD only | VendorModule/VendorAddon | admin | None | **no backend route reads these flags** (grep: only addons/ reads them); gating is FE nav only |
| 53 | Platform | Supabase storage service | `storage/storage.service.ts` | BLOCKED-EXTERNAL | real REST | none | - | None | used only for AI hero; user uploads go to local disk |
| 54 | Platform | Image uploads | `uploads/uploads.controller.ts` | PARTIAL | local disk | none | auth | None | no tenant scoping/record; SVG allowed |
| 55 | Platform | Admin integration "Test" button | `platform-settings.service.ts:105-117` | MOCKED | only checks a value exists | PlatformSetting | admin | None | returns "ok" for any non-empty string |
| 56 | Admin | Admin campaigns tool (ideas + post log) | `app/admin/campaigns/page.tsx` | PARTIAL | ideas via /ai/chat real | none | admin | None | post log is React state only (`:66-69`), lost on refresh |
| 57 | Domain Campaign | Public enquiry -> Lead + admin notify | `domain-campaign/*` | WORKING (static-verified) | yes | Lead | public | None | caller-supplied vendorId |
| 58 | Domain Campaign | Client onboarding (Subscription) | `service.ts:90-98` | WORKING (static-verified) | yes | Subscription | AdminGuard | None | nominal amount Rs9,999 |
| 59 | Domain Campaign | Spend record + fee calc + invoice | `service.ts:112-181` | PARTIAL | raw SQL | g4d_domain_campaign_records | AdminGuard | None | migration pending on VM; duplicate invoice risk; **fee logic != PRD §88** |
| 60 | Domain Campaign | Live Meta/Google ad management/reporting | none | MISSING | none | none | - | None | manual spend only |
| 61 | Customer Hub | Portal on/off toggle | `customer-hub/page.tsx:17,61` | UI-ONLY | none | none | - | None | local React state; does not disable anything |
| 62 | Customer Hub | Portal invite | `customer-hub/page.tsx:34-45` | PARTIAL | backend returns `mock` flag | Contact | - | None | alert says "mock — gateway pending" |
| 63 | Pricing | "We post on your page" Rs10 | `pricing/page.tsx:52,78` | MISSING | none | key only | - | None | priced service with no implementation |

## 10. FAKE-SUCCESS / HARD-CODED / ORPHAN PATTERNS (file:line)
1. `backend-api/src/meta/meta.service.ts:36-42` — fabricates post id/URL, `status:'published'` when a token exists, `mock:true` buried in payload.
2. `backend-api/src/growth-hub/growth-hub.service.ts:66-74` — marks Campaign `active` + `approvedAt` after a mock launch.
3. `backend-api/src/google-ads/google-ads.service.ts:35-40` — `status:'launched'` when dev token set, though only logged.
4. `backend-api/src/video/video.service.ts:12,80-81` — hard-coded Google sample MP4 returned as a finished video when no provider key.
5. `backend-api/src/video/video.service.ts:36-42,66,84` — Kling selected but HeyGen executed.
6. `backend-api/src/platform-settings/platform-settings.service.ts:105-117` — "Test" returns ok for any present value ("live provider ping pending").
7. `backend-api/src/campaign-pages/campaign-pages.service.ts:145-146` — wallet debit before WhatsApp send; failure return ignored.
8. `backend-api/src/campaigns/campaigns.service.ts:50-80` — wallet debited on vendor self-approval; nothing is executed; per-channel prices hard-coded at `:9-16`.
9. `get4domain_mvp/src/lib/api.ts:785-791` — Growth Hub API wrappers (publish/ads/launch) are **orphans** with no UI callers.
10. `get4domain_mvp/src/app/dashboard/customer-hub/page.tsx:17,61` — toggle changes local state only; `:38` alert admits mock invites.
11. `get4domain_mvp/src/app/admin/campaigns/page.tsx:66-69` — "post log" never persisted.
12. `get4domain_mvp/src/app/dashboard/ai-studio/page.tsx:296-300,256-260` — "Library" = localStorage.
13. `get4domain_mvp/src/app/dashboard/campaigns/page.tsx:301-304` — share "reminder" = localStorage (UI is honest it is not an auto-post).
14. `get4domain_mvp/src/app/dashboard/my-website/page.tsx:357` — Google Analytics ID field persists but is never used.
15. `get4domain_mvp/src/app/dashboard/reports/page.tsx:166-180` — "Campaigns by Status" reads legacy `/campaigns` (always empty in practice).
16. `get4domain_mvp/src/app/(marketing)/features/page.tsx:32,34` — claims "Audience segments", "Scheduling", "Website visitors" with no backing code.
17. `get4domain_mvp/src/app/(marketing)/pricing/page.tsx:52-53` — "We post on your page", "Extra campaign page" prices with no implementation.
18. `backend-api/src/design/design.templates.ts` — only 2 hard-coded templates.
19. Docs-vs-code: `backend-api/src/growth-hub/growth-hub.controller.ts:19-20` and `api.ts:785` honestly say "MOCK"; but `addons/addons.constants.ts:23` lists "Growth Hub — Campaigns, landing pages, social media" and the feature page lists "Campaign builder… Scheduling" — social media is not delivered. README-level claims of "Growth Hub publish flows" (`ai.service.ts:20-27` "Legacy channel keys still used by Growth Hub publish flows") refer to a flow with no UI.

Not orphan-button findings (checked OK): campaign wizard buttons, copy/open buttons, embed copy buttons, AI generate/regenerate/download/save/share all have real handlers. No `onClick={() => {}}` stubs were found in the scoped screens; `alert()` used in `customer-hub/page.tsx:38,41`.

## 11. INTEGRATION MATRIX
Columns: Provider | Capability | Connection | Permission/Approval | Current status | Error handling | Production ready | Env var / platform-setting key

| Provider | Capability | Connection | Permission/Approval | Status | Error handling | Prod ready | Keys needed |
|---|---|---|---|---|---|---|---|
| Meta (FB/IG) | Page/IG publish | none (no OAuth, no per-vendor token store); platform `access_token` read then ignored | Meta App Review, `pages_manage_posts`, `instagram_content_publish`, business verification | MOCKED | none (always "success") | No | `meta/app_id` (META_APP_ID), `meta/app_secret` (META_APP_SECRET), `meta/access_token` (META_ACCESS_TOKEN) |
| Meta Ads | ads create/report | none | Marketing API access | MISSING (only Campaign row) | - | No | same |
| Google Ads | launch/report | stub only | developer token approval, OAuth, MCC | MOCKED | none | No | `google_ads/developer_token`, `client_id`, `client_secret` (GOOGLE_ADS_*) |
| Google Business Profile | posts/reviews | none | GBP API access | MISSING | - | No | none defined |
| Google Search Console | indexing/queries | none | OAuth + verification | MISSING | - | No | none defined |
| Google Analytics | GA4 | Vendor stores ID only; no script injection, no Data API | - | UI-ONLY | - | No | none |
| YouTube | upload | none | OAuth verification/audit | MISSING | - | No | none defined |
| LinkedIn | post | none | LinkedIn app approval | MISSING | - | No | none defined |
| OpenAI | text (gpt-4o-mini), DALL-E 3 images, chat | real `fetch`, key from platform settings/env | funded account | BLOCKED-EXTERNAL (works if key+credit) | 503 on failure, wallet debited only after success; image failure non-fatal | Partial (temp image URLs, no rate limit/streaming/timeouts/cost cap) | `ai/openai_api_key` (OPENAI_API_KEY) |
| Anthropic | text fallback / chat | real `fetch`, model `claude-haiku-4-5-20251001` | key | BLOCKED-EXTERNAL | as above | Partial | `ai/anthropic_api_key` (CLAUDE_API_KEY) |
| Stability AI | images | key field only | - | MISSING (not wired) | - | No | `ai/stability_api_key` (STABILITY_API_KEY) |
| Runway | text/image->video | real fetch (unverified; text-only path doubtful) | paid credit | BLOCKED-EXTERNAL | submit errors -> 400; failed job = no refund | No | `video/runway_api_key` (RUNWAY_API_KEY) |
| HeyGen | avatar video | real fetch with placeholder avatar/voice ids | paid credit | BLOCKED-EXTERNAL | as above | No | `video/heygen_api_key` (HEYGEN_API_KEY) |
| Kling | video | selected but never called | - | BROKEN | - | No | `video/kling_api_key` (KLING_API_KEY) |
| Canva | brand templates | none (column only) | Canva Connect approval | MISSING | - | No | none defined |
| Remotion (local) | photo reel render | child process | Remotion company licence (>3 staff) | BLOCKED-EXTERNAL | returns `not_configured`/`failed` messages | No (disk-ephemeral, no queue) | none; needs FFmpeg + Chrome on VM |
| Supabase Storage | durable media | real REST upload | project + service-role key | BLOCKED-EXTERNAL | returns `not_configured`/`failed`, callers degrade | Partial (only AI hero uses it) | `storage/supabase_url` (SUPABASE_URL), `supabase_service_key` (SUPABASE_SERVICE_ROLE_KEY), `bucket` (SUPABASE_STORAGE_BUCKET) |
| MSG91 WhatsApp | campaign-page lead alert | real fetch, env only (not platform settings) | approved template `new_lead_alert` | BLOCKED-EXTERNAL | false return ignored; charge-before-send bug | No | env `MSG91_AUTH_KEY`, `MSG91_WHATSAPP_NUMBER` |
| api.qrserver.com | QR image | 3rd-party img URL | none | PARTIAL | none | No (third-party dependency, leaks page URL) | - |
| ResellerClub/Razorpay/Resend | outside this area | - | - | not assessed | - | - | - |

Encryption of Get4Domain's own provider secrets: AES at rest in `PlatformSetting` (`platform-settings.service.ts:89-96`). Per-vendor social tokens: no storage exists, so none encrypted.

## 12. COUNTS (63 matrix rows)
- Counts by exact row status (sum = 63):
  - WORKING: 11, 12, 30, 40, 51, 57, 58 = 7
  - PARTIAL: 2, 13, 15, 16, 17, 18, 21, 22, 23, 25, 26, 38, 39, 46, 52, 54, 56, 59, 62 = 19
  - UI-ONLY: 20, 42, 61 = 3
  - BACKEND-ONLY: 8, 10 = 2
  - MOCKED: 4, 9, 32, 55 = 4
  - BROKEN: 34, 36 = 2
  - BLOCKED-EXTERNAL: 19, 33, 35, 53 = 4
  - MISSING: 1, 3, 5, 6, 7, 14, 24, 27, 28, 29, 31, 37, 41, 43, 44, 45, 47, 48, 49, 50, 60, 63 = 22
  - DEFERRED-APPROVED: 0 (note: the PRD itself defers AI Reels to "Coming Soon" but the code did NOT defer it)
  - Total = 63

## 13. TOP FINDINGS (priority)
1. Social Publisher does not exist: no OAuth, no account/publication entities, no scheduling; the only code is a MOCK Meta service that fakes "published", and no UI calls it.
2. AI Reels/Video is shipped and marketed as live although PRD says "Coming Soon"; with no key it returns a stock Google MP4 as "your video"; Kling is BROKEN; Runway/HeyGen payloads are unverified/placeholder; Remotion needs VM install + licence.
3. SEO Manager, Search Insights, Share Links/UTM, Growth Analytics, Offers/Loyalty/Referral, Sales Channels/Marketplace/Shipping are entirely MISSING; Google Analytics ID is stored but never injected; vendor sites have no sitemap/robots and JSON-LD only on one render branch.
4. Domain Campaign fee logic (MAX(10%, Rs9,999)) contradicts V2 PRD §88 tier table (Rs2,000 / Rs5,000 / Rs10,000 / custom) across code, admin UI, public page and invoice text; record table migration still pending; duplicate-invoice risk.
5. Campaign Pages core (page -> lead -> CRM) works, but the "free 1 page / Rs20 extra" rule and "We post on your page Rs10" price are display-only; lead WhatsApp alert charges before sending; legacy campaigns module charges wallet without delivering; public AI chat/widget chat/generate-page are unmetered with no rate limiting anywhere.
6. Content Studio: no vendor-master data to AI/docs (vendor retypes), only 3 business doc types (print-to-PDF, no engine/versioning/history), library is localStorage, generated images are temporary URLs, 2 built-in design templates.
7. Zero automated tests (backend + frontend); everything above is static-verified only.
