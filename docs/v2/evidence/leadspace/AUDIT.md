# LeadSpace Phase 0 audit: reuse first (2026-10-10)

Method: read the code that exists today (backend `src/`, frontend `src/app`, `schema.prisma`, nginx config). Nothing was changed while auditing. Decision per area: **reuse** (used as it is), **wrap** (kept, called through new code), **replace** (superseded by LeadSpace).

| Area | What exists | Decision | Why |
|---|---|---|---|
| Growth Hub (`growth-hub/`) | `POST /growth-hub/publish` (mock Meta layer) and paid-ad requests stored as Pending Review, admin "launch" is a mock | **Replace** (publishing) / **keep read-only** (old ad requests) | the mock layer never publishes; the new shared social publisher replaces it. Old ad-request rows stay readable |
| Campaigns (`campaigns/`, `g4d_campaigns`) | vendor campaign with channel list and AI content, wallet charge per channel (`CHANNEL_COSTS_PAISE`), admin approval, analytics JSON | **Replace** with LeadSpace promotion; data **migrated** (Phase 7) | LeadSpace is run by Get4Domain, not self-served by the vendor; the existing rows become draft promotion plans, nothing is deleted |
| DomainCampaign (`domain-campaign/`, `g4d_domain_campaign_records`) | monthly managed-ads fee brackets, manually recorded ad spend per vendor-month, invoice per month | **Replace** (UI, routes, fee brackets) / **migrate** spend rows to `AdSpendEntry` | LeadSpace measures cost per verified lead instead of a bracket fee. Records are copied, not deleted |
| Campaign pages (`campaign-pages/`, `go.controller.ts`, `CampaignPage`, `CampaignLead`, frontend `/go/[slug]`) | the closest thing to a landing page: slug, headline, benefits, CTA, public lead form, view counter. Leads wallet-charged as AI/campaign spend | **Wrap**: public `/go/<slug>` keeps working (redirected to the new page); page rows migrate into LeadSpace pages and leads into `LeadEvent` (unverified, not charged) | existing links must not break |
| Public widget lead endpoint (`widget/`) | `POST /widget/lead` writes a `CampaignLead` with source `widget` | **Wrap**: unchanged; new LeadSpace capture is a separate verified endpoint. Widget leads are shown read-only in Leads as "unverified" | the widget has no OTP and no price; it must not be silently charged |
| Public checkout (`engine/public-checkout.service.ts`) | cart to order request (`PosSale` type `web`), vendor's own Razorpay or order request, stock reserve, CRM lead | **Reuse the order-request path idea; do not reuse the service** | LeadSpace cart order is "order request, no payment, no stock" and must end in a verified event. A LeadSpace order is a `LeadEvent` of type CART_ORDER; the vendor confirms or declines |
| Bookings / appointments (`Appointment`, industry engines, `realestate.site_visit` action) | per-industry booking records for BOS vendors | **Reuse for BOS vendors** (they keep them); LeadSpace booking is a `LeadEvent` with date/time payload | LeadSpace-only vendors have no appointment module; a booking is just a verified event |
| Wallet and ledger (`wallet/`, `Wallet`, `WalletTransaction`) | one AI/messaging balance, bonus on top-up, 90-day expiry, Razorpay verify, `BillingGateService` blocks LAPSED vendors from spending | **Keep unchanged for AI**; **add** a typed LEADS purse beside it | the AI credit behaviour must not change. LEADS purse = new tables with running balance and idempotency keys; the AI purse stays the legacy wallet (documented) |
| AI Studio (`ai/ai.service.ts`) | `generateContent(vendorId, dto, internal)`: caption, hashtags, image prompt; `internal=true` skips the vendor wallet | **Reuse** for the promotion calendar (platform-funded, `internal=true`) with per-category guardrail text added to the prompt | already provider-switching and error-classified |
| Landing templates and subdomain router (`app/site/[subdomain]`, `engine/industries`, nginx `*.get4domain.com` to the Next app) | full multi-page vendor sites per industry; the wildcard subdomain reaches the Next app but there is no host rewrite in `middleware.ts` | **Reuse the engine's data feed** (`/cms/site/<sub>`) for existing-page mode; **new** single-page templates (`/ls/<slug>`) | the engine renders whole sites; LeadSpace needs one goal-driven page. Host rewrite for `<slug>.<base domain>` is added behind an environment switch so nothing existing changes |
| Domain handling (`domains/`) | search, register request, connect; custom-domain CORS | **Reuse** | LeadSpace pages use the same custom-domain mapping |
| Social code (`meta/meta.service.ts`) | **mock only**: `publishPost` logs and returns a fake id; no Telegram, no Google Business Profile, no scheduling, no retries | **Replace** with a real shared publisher service (Dispatch A section 6 interface, built here because it does not exist) | |
| OTP (`otp/otp.service.ts`) | phone OTP over Fast2SMS SMS, **in-memory code store**, once-a-day verified record in the database | **Do not reuse for LeadSpace** | in-memory codes are lost on restart and are not shared across instances; LeadSpace needs hashed DB-backed codes, per-phone/device/hour limits, a blocklist, WhatsApp delivery |
| WhatsApp (`whatsapp/`, `notifications/whatsapp.service.ts`) | Fast2SMS WhatsApp sender per template | **Wrap** as one provider behind a new WhatsApp provider abstraction (Dispatch A section 6 interface, built here) with a sandbox provider and a Cloud API provider | |
| Notifications / push / e-mail (`notifications/`, `email/`) | `notifyVendor`, web push, Resend e-mail | **Reuse** for vendor alerts | |
| Commercial Invoice engine (`invoices/`, `Invoice`, `createPaidInvoice`) | GST tax invoice, PDF/e-mail, platform income row; works GST-inclusive from the amount paid | **Reuse** for the "LeadSpace wallet refill" invoice | |
| Payments verification (`payments/payment-verification.ts`) | captured-payment check, signature, per-payment lock | **Reuse** for the refill | |
| Plan access / registry | `PlanKey` is WORKSPACE or BOS; features carry `minPlan` | **Extend** with LEADSPACE as the free base tier | |

## Every place a vendor wallet balance can pause something

| Place | Effect of a low or zero balance | LeadSpace impact |
|---|---|---|
| `CampaignsService` / `CampaignPagesService.submitLead` (wallet deduct) | the campaign run or lead capture can fail with insufficient balance | replaced; the new capture never reads the AI wallet |
| `AiService.generateContent`, images, reels, video | `INSUFFICIENT_WALLET_BALANCE`, nothing generated | unchanged; promotion content uses `internal=true` (platform-funded) |
| `CommunicationService` (SMS/WhatsApp/e-mail sends), `WhatsAppBotService`, `DomainsService` | send refused | unchanged |
| `BillingGateService` | a LAPSED billing term blocks wallet spending | does not apply to the LEADS purse (no term needed for the free base tier) |
| Site rendering (`/cms/site/<sub>`, `/site/<sub>`, `/go/<slug>`) | **none found**: no read of the wallet balance anywhere on the public render path | LeadSpace keeps it that way and a test proves a zero balance never takes a page down (Phase 8 guard) |

## Summary

Reused: AI generation, notifications, Invoice engine, payment verification, domains, existing campaign-page links. Wrapped: Fast2SMS WhatsApp (as one provider), widget leads, public pages. Replaced: Growth Hub mock publishing, Campaigns, DomainCampaign, the in-memory OTP path for LeadSpace. Built new because it does not exist: the social publisher service and the WhatsApp provider abstraction (Dispatch A section 6 interfaces).
