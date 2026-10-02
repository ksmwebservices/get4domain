# Integration Matrix (PRD §92.3, §89)

> Part of the Get4Domain V2 audit baseline (2026-10-02, audit-only). Statuses use the PRD §64.2 vocabulary. **Static-verified only.** Source evidence: `evidence/platform.md §12, evidence/growth.md §11, evidence/comms.md §9`. Verdict: [AUDIT_REPORT.md](AUDIT_REPORT.md).

## A. Platform integrations (payments, email, SMS/WhatsApp, storage, registrar, AI, ads)


| Provider | Capability | Connection | Permission / approval | Current status | Error handling | Production ready |
|----------|-----------|-----------|----------------------|----------------|----------------|------------------|
| Razorpay (platform) | Orders, checkout signature, payment links, webhook | SDK `razorpay` 2.9.5, keys from process.env only | Account KYC/live keys (external) | PARTIAL - flows exist but verification is replayable/unbound (C1-C3); only payment_link.paid webhook; no refunds/settlements | `toPaymentGatewayError` maps SDK errors (payments.service.ts:154-164); unconfigured guard for links only | NO |
| Razorpay (vendor-direct) | Per-vendor keys, public checkout | vendor keys encrypted (AES-GCM) | Vendor's own Razorpay account | BROKEN (client price trust, replay, no webhook) | generic 400s | NO |
| Resend | Transactional email | SDK, `RESEND_API_KEY` env only (admin setting ignored) | Domain/sender verification (external) | WORKING (static) | logs + rethrow (email.service.ts:173-182); callers often swallow; no bounce/complaint webhook, no suppression | PARTIAL |
| Fast2SMS | SMS, OTP, WhatsApp template/session | plain fetch to `fast2sms.com/dev/bulkV2` via settings key/env | DLT sender/entity/template ids; WhatsApp template approval (external) | PARTIAL / BLOCKED-EXTERNAL (falls back to MOCK log when key absent: sms.service.ts:40-44; whatsapp.service.ts:47) | returns `{status:'failed', error}` honestly | NO until DLT + keys confirmed; not verifiable statically |
| MSG91 | legacy WhatsApp template | env-only, fetch | template approval | PARTIAL (legacy duplicate) | returns false + log | NO (redundant) |
| WhatsApp BSP | inbound bot + outbound | Fast2SMS WhatsApp only; no Meta Cloud API/other BSP | per-vendor number verification field `waStatus`; BSP approval | PARTIAL (bot reads settings webhook secret; fail-open when unset) | swallow-and-log | NO |
| Supabase Storage | AI hero image rehosting | REST fetch with service key via settings | project/bucket set-up (external) | PARTIAL (only AI hero; vendor uploads on local disk) | returns `not_configured/failed` gracefully (storage.service.ts:20-26,63-70) | PARTIAL |
| Supabase Postgres | primary DB | Prisma pooled+direct URLs | RLS enabled via manual SQL script | WORKING (static); migrations not reproducible | n/a | PARTIAL |
| ResellerClub | Domain search/register | httpapi.com via settings key + reseller id | reseller account funding/approval (external) | BLOCKED-EXTERNAL (code present; "NOT verified against a live account", resellerclub.service.ts:33-38; project memory says creds still needed) | wallet-debit-first with failure refund (domains.service.ts:233-241) | NO |
| OpenAI | Text (gpt-4o-mini), images (dall-e-3) | fetch with settings key | billing | WORKING (static); no key in local env | HTTP errors logged -> ServiceUnavailable | PARTIAL (unmetered public chat) |
| Anthropic | Text (claude-haiku-4-5-20251001), allwin chat | fetch / SDK | billing | WORKING (static) | same | PARTIAL |
| Stability AI | primary images | settings entry only | - | MISSING (no code: grep = constants only) | - | NO |
| Video (Runway/HeyGen/Kling) | video gen | settings keys, provider abstraction | API access | MOCKED when unkeyed (video.service.ts:10-24); real calls "unverified" | mock clip URL | NO |
| Meta (FB/IG) | Publish posts | settings token | Meta App Review (external) | MOCKED - always returns fake post id, even when a token exists it reports `status:'published', mock:true` (meta.service.ts:31-42) | none | NO (misleading success) |
| Google Ads | Launch campaign | settings dev token | Developer-token approval (external) | MOCKED (google-ads.service.ts:31-41) | none | NO |
| Web Push (VAPID) | notifications | web-push lib, env/settings | - | WORKING (static) | | PARTIAL |

Platform-settings categories (platform-settings.constants.ts:21-200): company, payment, ai, storage, whatsapp, sms, fast2sms, email, meta, google_ads, push, video, domain, pricing (14 categories; secrets flagged `secret:true` are encrypted; pricing is non-secret rate card).

---------------------------------------------------------------------------------------------------


## B. Growth / Social / AI / Video integrations

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


## C. Communication providers — dependencies and env vars


| Provider | Needed | Where read | Notes |
|---|---|---|---|
| Fast2SMS (SMS, OTP, WhatsApp) | `fast2sms/api_key` (env `FAST2SMS_API_KEY`), `sender_id` (`FAST2SMS_SENDER_ID`), `dlt_entity_id` (`FAST2SMS_ENTITY_ID`), `sms_message_id` (`FAST2SMS_SMS_MESSAGE_ID`), `wa_message_id` (`FAST2SMS_WA_MESSAGE_ID`). The legacy fallback key is `sms/sms_api_key` (`MSG91_AUTH_KEY`), which is wrongly used as a Fast2SMS key. | `sms.service.ts:25-34,90-92`, `whatsapp.service.ts:42-43`, `constants:76-97` |
| Fast2SMS webhook secret | `webhook_secret_key`. It is NOT defined in the constants, so it cannot be configured (see 1.7). | `whatsapp.service.ts:114` | Needs an inbound URL registered in the Fast2SMS panel. Fast2SMS WhatsApp account approval and templates are external. |
| MSG91 (legacy WhatsApp alerts) | `MSG91_AUTH_KEY`, `MSG91_WHATSAPP_NUMBER`. `MSG91_SENDER_ID` is only used by the dead SMS class. | `notifications/whatsapp.service.ts:6-7` | MSG91 WhatsApp templates (`team_invite`, `new_lead_alert`, `payment_received`, `new_support_ticket`, `support_reply`) must exist and be approved. |
| Resend | `RESEND_API_KEY` (env only), `COMPANY_EMAIL` (from address), `ADMIN_EMAIL`, `FRONTEND_URL`. Domain DNS verification (SPF and DKIM) is external. | `email.service.ts:17-20` | The DB setting `email/resend_api_key` is ignored. |
| Web Push | BE `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. FE `NEXT_PUBLIC_VAPID_KEY`. | `push.service.ts:18-20`, `FE lib/push-notifications.ts:1` | The DB "push" settings are ignored. The BE and FE public keys must match. |
| AI for the bot | `ai/openai_api_key` (`OPENAI_API_KEY`) preferred, else `ai/anthropic_api_key` (`CLAUDE_API_KEY`) | `ai/ai.service.ts:146-160` | |
| Razorpay (wallet top-up) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (read straight from `process.env`, not PlatformSettings) | `wallet.service.ts:29-30,87` | |
| Other | `OTP_DEV_ECHO`, `ADMIN_WHATSAPP_NUMBER`, `COMPANY_PHONE`, `NODE_ENV`, `PLATFORM_SETTINGS_KEY` (the encryption key for stored settings), and the pricing keys `PRICE_WHATSAPP`, `PRICE_WHATSAPP_SESSION`, `PRICE_SMS`, `PRICE_EMAIL` | | |
| Vendor-own payments | None for messaging. `VendorPaymentConfig` stores the vendor's Razorpay keys encrypted (`vendor-payments.service.ts:35-45`). The secret is never returned. This module is real but unrelated to comms. | `vendor-payments/*` | Status WORKING (static). `getKeys` is server-only. Tenant comes from the JWT (`controller:15-22`). |

---


## D. Environment variable inventory (names only; values never read)


Backend (`process.env.*` in backend-api/src, plus Prisma datasource):

| Variable | Used by | Required? |
|----------|---------|-----------|
| DATABASE_URL, DIRECT_URL | prisma/schema.prisma:6-8 | REQUIRED |
| JWT_SECRET | auth.module.ts, jwt.strategy.ts:22, customer.module.ts:17 | REQUIRED (no boot check; customer falls back to 'dev-secret') |
| PORT | main.ts | optional (3008) |
| PLATFORM_SETTINGS_KEY | platform-settings/crypto.util.ts | REQUIRED for any stored secret (vendor payment keys, integrations); absent in local .env.local |
| RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET | payments, wallet, domainapp, engine | REQUIRED for money flows (env only, NOT settings-driven) |
| RAZORPAY_WEBHOOK_SECRET | payments (falls back to KEY_SECRET) | recommended |
| RESEND_API_KEY | email.service.ts:17 | REQUIRED for email (env only) |
| FRONTEND_URL | customer, email, payments | optional (defaults https://get4domain.com) |
| PUBLIC_API_URL | uploads, widget, reels | recommended (https links behind proxy) |
| COMPANY_NAME/GST/PAN/ADDRESS/PHONE/EMAIL/LOGO_URL | invoices & quotes templates, support, payments (fallback of settings `company`) | optional |
| ADMIN_EMAIL, ADMIN_PASSWORD | email, prisma/seed.ts | seed only |
| ADMIN_WHATSAPP_NUMBER | payments, support | optional |
| MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_WHATSAPP_NUMBER | notifications/whatsapp.service.ts (legacy) | optional |
| VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT | notifications (web push) | optional (push disabled otherwise) |
| SERVER_IP | domains (DNS verification; hard-coded fallback) | recommended |
| RESELLERCLUB_API_BASE | domains (defaults prod endpoint) | optional |
| OTP_DEV_ECHO | otp.service.ts:95 | MUST be unset in prod |
| NODE_ENV | customer.service.ts:62 | set to production by Dockerfile |
| Via PlatformSettings `envFallback` (platform-settings.constants.ts) | CLAUDE_API_KEY, OPENAI_API_KEY, STABILITY_API_KEY, SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_STORAGE_BUCKET, WHATSAPP_BSP_*, FAST2SMS_API_KEY/SENDER_ID/ENTITY_ID/SMS_MESSAGE_ID/WA_MESSAGE_ID, META_APP_ID/SECRET/ACCESS_TOKEN, GOOGLE_ADS_DEVELOPER_TOKEN/CLIENT_ID/CLIENT_SECRET, RUNWAY/HEYGEN/KLING_API_KEY, RESELLERCLUB_API_KEY/RESELLER_ID/CUSTOMER_ID/CONTACT_ID/NS1/NS2/REG_*, PRICE_* (pricing rate card), MSG91_AUTH_KEY/SENDER_ID | optional (DB value wins, env fallback) |
| Scripts only | MRTRAVELS_VENDOR_EMAIL/SUBDOMAIN/PASSWORD (scripts/migrate-mrtravels.ts) | n/a |

Locally present in backend-api/.env.local (names): PORT FRONTEND_URL DATABASE_URL DIRECT_URL JWT_SECRET RESEND_API_KEY RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET CLAUDE_API_KEY VAPID_* COMPANY_* ADMIN_EMAIL (no PLATFORM_SETTINGS_KEY, no OPENAI/Supabase/Fast2SMS/ResellerClub in the local copy; production env not inspectable).

Frontend (get4domain_mvp): NEXT_PUBLIC_API_URL (15 uses), NEXT_PUBLIC_RAZORPAY_KEY_ID (4), NEXT_PUBLIC_VAPID_KEY, NEXT_PUBLIC_SITE_URL/PHONE/EMAIL/WHATSAPP (in .env.local.example), DEMO_ACCESS_SECRET (fallback to a known string), NODE_ENV. stepnrock: NEXT_PUBLIC_API_URL. allwin-tours: CLAUDE_API_KEY.


## E. PRD §89 external-integration rule — compliance

| Rule | Status | Note |
|---|---|---|
| Official API/provider identified per integration | PARTIAL | Razorpay, Resend, Fast2SMS, ResellerClub, OpenAI/Anthropic identified. Meta/Google/LinkedIn/YouTube publishing: only a mock exists. |
| OAuth / scopes / token lifecycle | MISSING | No OAuth flow, no per-vendor token store, no encrypted OAuth tokens anywhere. |
| Webhooks with signature verification | PARTIAL | Razorpay webhook HMAC OK (only `payment_link.paid`). WhatsApp inbound webhook is **fail-open** (secret key undefined in settings). No Meta/Resend/Fast2SMS delivery webhooks. |
| Provider approval / app-review dependencies tracked | PARTIAL | Documented in docs/memory; not represented in-product as "Approval Required" states. |
| Never simulate production success | **VIOLATED** | `meta.service.ts` returns `status:'published'` with a fabricated post id; Google Ads launch is a mock; Growth Hub marks a mock-launched ad "active"; AI video returns a stock Google sample MP4 as the vendor's video when no key is set; integration "Test connection" only checks a value is present. |
| Real "Not Connected / Configuration Required" states | PARTIAL | SMS/WhatsApp mock mode is labelled; storage/registrar degrade gracefully; Meta/Google do not. |
