# V3 Integration Status (Phase V3.0 output)

> Uses the spec Rule 6 vocabulary: **Production-ready · Sandbox · Pending credentials · Pending approval · Mock only**.
> **Nothing below was exercised live by me.** Status is from code + the V2 `INTEGRATIONS.md` baseline (2026-10-02) + later dispatch docs. No credentials were read; env-var *names* only. Rule 6 says an integration is not "complete" until credentials, permissions, working API calls, verified webhooks, error handling and integration tests all exist — **no integration below meets that bar with evidence I could verify**, so none is marked Production-ready. "Likely working" means the code path looks sound and V2 rated it WORKING statically.

| # | Integration | Spec use | Current status (Rule 6) | Evidence / what exists | Missing to be "complete" | Credential / env names | External dependency |
|---|---|---|---|---|---|---|---|
| 1 | **Razorpay — Get4Domain subscriptions** | Plans, orders, payment links (V3: Handyman/Professional/Ecommerce Q/H/A; the legacy Workspace/BOS Razorpay Plans are out of V3 scope) | **Pending credentials** (V3 plans not created) / likely working for one-off orders | `razorpay` SDK; verification patched (S1–S6, commit 6cf999b); webhook HMAC only for `payment_link.paid`; keys **env-only** | Razorpay *Plan* objects (annual Workspace/BOS) not created; refunds/settlement flows; webhooks for other events; deploy confirmation of the patch | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | KSM creates Plans; KYC/live keys |
| 2 | **Razorpay — vendor-direct (ecommerce)** | Vendor merchant accounts | **Sandbox-grade; unproven live** | `VendorPaymentConfig`, AES-GCM key storage, server-priced checkout + replay guard; V2: 0 of 5 live vendors could take online payments | Per-vendor webhook, refunds, reconciliation, live vendor onboarding | per-vendor keys (encrypted), `PLATFORM_SETTINGS_KEY` | Each vendor's own Razorpay KYC |
| 3 | **Resend** | Transactional email | **Likely working** (static) | `email.service.ts`; key from env only (admin setting ignored) | Bounce/complaint webhooks, suppression list, sender-domain verification proof, marketing-email compliance flow | `RESEND_API_KEY`, `COMPANY_EMAIL`, `ADMIN_EMAIL` | SPF/DKIM DNS verification |
| 4 | **Business mailbox hosting** | info@company.com | **Not started** | No provider selected | Provider/reseller choice, provisioning API, IMAP/SMTP, billing | — | Commercial decision + provider |
| 5 | **Fast2SMS (SMS/OTP/WhatsApp)** | SMS reseller | **Pending credentials + approval** | `sms.service.ts`, `otp/`; falls back to **mock log** when no key; inbound webhook secret key was undefined in settings constants (fail-open → patched fail-closed) | DLT sender/entity/template IDs; delivery webhooks; billing/usage metering | `FAST2SMS_API_KEY`, `_SENDER_ID`, `_ENTITY_ID`, `_SMS_MESSAGE_ID`, `_WA_MESSAGE_ID`, webhook secret | TRAI DLT registration; Fast2SMS WA approval |
| 6 | **MSG91** | Legacy WA alerts | **Legacy / redundant** | env-only; charge-before-send bug noted in V2 | Retire or consolidate into one comms adapter | `MSG91_AUTH_KEY`, `MSG91_WHATSAPP_NUMBER` | Template approvals |
| 7 | **WhatsApp Business Platform (Meta Cloud API)** | Central + vendor bots, templates | **Sandbox; Pending approval** | `messaging/whatsapp/{whatsapp-provider,cloud-api.provider}.ts` with sandbox + Cloud API; LeadSpace "common number" status reads **Awaiting approval** | Meta business verification, number + template approval, embedded signup for vendor numbers, webhook verification, inbound handling | `WHATSAPP_BSP_*` (settings fallback) | **Meta approval** |
| 8 | **Messenger / Instagram messaging** | Inbound bots | **Not started** | Only *publish* side exists (`social/`) | Webhooks, page tokens, App Review (`pages_messaging`, `instagram_manage_messages`), 24-hour-window rules | `META_APP_ID`, `META_APP_SECRET` | **Meta App Review**, professional-account eligibility |
| 9 | **Facebook Lead Ads** | Lead capture | **Not started** | — | Lead Retrieval permission, webhook | Meta app creds | Meta approval |
| 10 | **Meta publishing (FB Page / IG)** | Social posts | **Sandbox in `social/`; legacy `meta.service.ts` = Mock only (always reports published)** | `SocialProvider` interface, sandbox + Graph-API-shaped providers, encrypted tokens, caps/retries/kill switches (docs-only) | Real OAuth, App Review (`pages_manage_posts`, `instagram_content_publish`), remove/retire the misleading legacy mock | `META_*` | **Meta App Review + business verification** |
| 11 | **Google Ads** | Campaign mgmt | **Mock only** | `google-ads.service.ts` stub returns success (V2) | Developer token, OAuth, MCC, real create/report calls | `GOOGLE_ADS_DEVELOPER_TOKEN/CLIENT_ID/CLIENT_SECRET` | **Google developer-token approval** |
| 12 | **Google Business Profile** | Posts/reviews | **Not started** | `GOOGLE_BUSINESS` channel enum exists in `social/` only | API access request, OAuth | — | Google approval |
| 13 | **Google Search Console / GA4** | SEO reports | **Not started** (GA: ID stored/script rendered only) | — | OAuth, verification, Data API | — | Google OAuth verification |
| 14 | **YouTube / LinkedIn** | Social channels | **Not started** | — | Upload/post APIs, app review | — | Platform audits |
| 15 | **ResellerClub (domains)** | Register/renew/transfer/DNS | **Pending credentials — never run live** | `resellerclub.service.ts` (235 LOC): availability, register, signupCustomer, addContact; wallet-debit-first with refund | OT&E sandbox run, transfer, renew, DNS-record, nameserver, contact-management calls; pricing per TLD/term; webhooks/polling | `RESELLERCLUB_API_KEY`, `_RESELLER_ID`, `_CUSTOMER_ID`, `_CONTACT_ID`, `_NS1/2`, `_REG_*`, `RESELLERCLUB_API_BASE` | Reseller account funding/approval |
| 16 | **SSL / TLS automation** | Custom-domain certificates | **Manual only** | Cloudflare Flexible for `get4domain.com` zone; certbot per domain per runbook; warning that certbot on CF-proxied hosts causes loops | Automated issuance + renewal for arbitrary customer domains | Cloudflare / ACME creds | Architecture decision (Cloudflare for SaaS vs on-demand TLS) |
| 17 | **OpenAI** | AI Studio | **Likely working if key+credit** | `ai.service.ts`; wallet debited after success; error classification; `scripts/ai-health.js` | Rate limits/cost caps, streaming, durable image storage everywhere (temp URLs earlier), usage metering | `OPENAI_API_KEY` | Funded account |
| 18 | **Anthropic** | Text fallback / chat | **Likely working if key** | Fallback in AI service; model id in code predates current family — review at V3.7 | Model id refresh, cost caps | `CLAUDE_API_KEY` | — |
| 19 | **Video (Runway/HeyGen/Kling)** | Reels, promo video | **Mock only (UI "Coming soon")** | `video.service.ts` mock clip when unkeyed; Kling selected but never called | Real provider, job queue, failure refund | `RUNWAY/HEYGEN/KLING_API_KEY` | Paid credit |
| 20 | **Remotion (local render)** | Photo reels | **Pending credentials/licence** | child-process render; disk-ephemeral | Company licence (>3 staff), FFmpeg+Chrome on VM, queue, durable output | none | Licence |
| 21 | **Supabase Storage** | Durable media | **Partial** | Used only for AI hero; vendor uploads on local Docker volume | Move media to object storage + CDN; deletion/retention | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Project/bucket setup |
| 22 | **Supabase Postgres** | Primary DB | **Working** (static) | Pooled+direct URLs, RLS by manual script | Staging DB, backups verification, reproducible migrations | `DATABASE_URL`, `DIRECT_URL` | — |
| 23 | **Web Push (VAPID)** | Notifications | **Likely working** | `web-push` | Keys on VM, FE/BE public key match | `VAPID_*`, `NEXT_PUBLIC_VAPID_KEY` | — |
| 24 | **Shipping carrier** (Shiprocket etc.) | Shipments, tracking | **Not started** | Only `shippingPaise` amount | Carrier choice, adapter, webhooks | TBD | Commercial decision |
| 25 | **Redis / BullMQ** | Background jobs | **Not present** | No dependency | Provision Redis (VM or managed), queue adapter | `REDIS_URL` (new) | Infra |
| 26 | **Cloudflare / nginx / VM** | Hosting | **Working, manual** | Per-app Docker Compose on one VM; wildcard nginx; no API nginx config in repo; no HEALTHCHECK, no CI/CD, no monitoring | CI/CD, health checks, monitoring/alerting, backup policy, Node 20 → 22/24, secrets management | — | Infra |
| 27 | **api.qrserver.com** | QR images | **Third-party dependency (privacy)** | Used for QR; leaks page URL | Replace with local `qrcode` (already a dependency) | — | — |

## Webhook inventory

| Webhook | Verified signature? | Notes |
|---|---|---|
| Razorpay `payment_link.paid` | Yes (HMAC) | Other events (refund, failed, subscription) not handled |
| Fast2SMS WhatsApp inbound | Fail-closed since patch (bot offline until secret set) | Secret must be added to the settings constants/UI |
| Resend, Meta, Fast2SMS delivery, ResellerClub | **None exist** | Required by V3.4/3.6/3.7 |

## Rules to carry into V3 (Rule 6 / Rule 10)

1. Every integration gets a `mode` (`sandbox | live`) and a status badge in admin; UI never says "published/sent" for a mock.
2. Credentials live in `PlatformSetting` (encrypted) with env fallback — standardise so admin entry actually works for Razorpay and Resend (currently env-only).
3. Retire redundant providers (MSG91, legacy `meta.service.ts`, `google-ads.service.ts` mock) behind the adapter layer rather than extending them.
4. Approval-gated items (7–14) are built against sandbox providers first; calendar risk is external and should be started by KSM **now** (Meta business verification, WhatsApp number, DLT, Google developer token) because lead times are weeks.
