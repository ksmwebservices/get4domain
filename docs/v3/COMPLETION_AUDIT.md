# V3 COMPLETION AUDIT (Dispatch F1, read-only)

Method: every claim cites a file read in this session. UNVERIFIED = not confirmed from code. No app, database, server or network was used. Paths are relative to `get4domain-w2/backend-api` unless stated.

---

## 1. Backend inventory (F0)

### 1.1 Totals

Source: `test/baselines/route-classification.json` summary: **1439 routes** (131 public, 542 admin, 766 authenticated). About 130 Nest modules are registered in `src/app.module.ts` (lines 140-304). Counted by script over the baseline, grouped by the controller's top-level `src/` folder:

| Class | Routes |
|---|---|
| V3 modules | 663 |
| Legacy: 21 per-industry modules (retired for V3 vendors) | 222 |
| Legacy: Workspace/BOS, commercial, marketing, CRM and other V2 | 421 |
| Shared / carried over | 133 |

### 1.2 V3 modules (the product being launched)

Columns: routes, then public/admin/authenticated. Routes sit under `/v3/...` unless noted.

| Module folder | Routes | P/A/U | Purpose |
|---|---|---|---|
| plans | 37 | 2/32/3 | plans as data, entitlements, admin plan editing |
| plan-billing | 22 | 2/14/6 | Razorpay/Cashfree plan checkout, invoices, gateway settings |
| provisioning | 13 | 4/9/0 | create vendor on behalf, invites, claim, job runner |
| claim-setup | 2 | 1/0/1 | account setup after the claim |
| v3-trial | 1 | 1/0/0 | self-service Free trial signup |
| site-publish | 15 | 1/8/6 | renderer, publish, public site read |
| v3-website | 49 | 0/19/30 | website manager (sections, fields, act on behalf) |
| site-domains | 17 | 0/10/7 | subdomain, custom domain, canonical |
| v3-domain-automation | 13 | 0/4/9 | custom hostname connection watcher |
| v3-registrar | 31 | 0/14/17 | domain sales through a ResellerClub port |
| v3-theme-catalog | 2 | 1/0/1 | theme catalogue per pack |
| v3-theme-switch | 7 | 0/3/4 | theme switch service |
| v3-packs | 25 | 2/18/5 | industry pack engine |
| v3-pack-records | 9 | 0/2/7 | per-pack working records |
| v3-profile-fields | 9 | 0/6/3 | pack profile fields |
| directory | 32 | 9/20/3 | public directory, claims, OTP |
| seo-directory | 37 | 11/25/1 | directory pages, sitemap, click-out |
| seeded-sites | 17 | 0/17/0 | seeded (unclaimed) sites |
| v3-listing-import | 3 | 0/3/0 | listing import |
| requests-orders | 35 | 5/9/21 | enquiries, orders, vendor payment methods, invoices, offers |
| v3-payments | 15 | 3/0/12 | pay requests and pay links |
| v3-wallet | 17 | 0/8/9 | wallet, top-up, receipts |
| v3-services | 20 | 1/16/3 | service catalogue, price book, add-on packs |
| v3-service-requests | 16 | 0/10/6 | requests to our team |
| v3-partners | 5 | 0/4/1 | referral partners and portal |
| v3-referrals | 21 | 1/16/4 | links, attribution, commission, payouts |
| v3-customers | 7 | 0/0/7 | vendor customer list |
| v3-accounts | 13 | 0/0/13 | vendor money in/out |
| v3-jobs | 16 | 0/0/16 | jobs and quotes |
| v3-appointments | 19 | 0/0/19 | appointments |
| v3-store | 17 | 0/0/17 | vendor shop/catalogue |
| v3-media-upload | 12 | 0/8/4 | media upload |
| v3-mail | 7 | 1/2/4 | mail inbox, forwarding, identity OTP |
| v3-support | 10 | 1/5/4 | support tickets |
| v3-admin-actions | 10 | 0/10/0 | admin actions |
| v3-admin-gaps | 5 | 0/5/0 | admin gap routes |
| v3-vendor-gaps | 13 | 0/0/13 | vendor gap routes |
| v3-activity | 8 | 0/7/1 | activity log and alerts |
| v3-trust | 18 | 1/14/3 | trust and safety, takedowns |
| v3-firm | 3 | 1/2/0 | firm profile |
| vendor-lifecycle | 11 | 0/10/1 | suspend, delete, grace |
| terms | 9 | 2/5/2 | terms acceptance |
| account-security | 10 | 8/0/2 | login/password security |
| v3-storage, b3-settings | 0 | - | settings services only, no controller |
| v3-retire | 0 | - | global guard that 404s retired industry routes for V3 vendors |

### 1.3 Shared or carried over (133 routes)

health 2, otp 2, uploads 1, messaging 2, ai-studio 11, ai 6, ai-templates 5, support 6 (V2 tickets; V3 uses v3-support), notifications 5, widget 5, analytics 3, demo 6, industries 5, themes 10, website-themes 9, site-doc 23, cms 16, engine 7, platform-settings 5 (encrypted keys and pricing), auth 4.

### 1.4 Legacy (V2, out of V3 scope)

Source: `docs/v3/V3_REQUIREMENTS_MATRIX.md` lines 47-72 and the retire list `src/v3-retire/core/retire-core.ts` lines 6-9.

- **222 routes** in 21 per-industry modules (agriculture, automobile, clinic, coaching, construction, diagnostics, education, events, finance, gym, hotel, logistics, photography, professional, realestate, restaurant, retail, salon, stationery, technology, travel). `RetiredModuleGuard` answers 404 to a V3 vendor (`src/v3-retire/retired-module.guard.ts`, registered at `app.module.ts:295`). Data is kept.
- **421 routes**: bos 78, commercial 53, leadspace 93, domainapp 23, travel-style legacy apps, accounting 11, domains 10, domain-campaign 9, quotes 9, invoices 8, addons 8, vendors 7, social 7, subscriptions 5, crm 10, campaign-pages 10, team 6, admin-team 6, campaigns 6, registry 6, wallet 5 (legacy wallet; V3 uses v3-wallet), managed-services 5, whatsapp-bot 5, customer 9, and smaller ones.
- LeadSpace is named in several V3 contract docs but is not a V3 requirement: status **UNVERIFIED, owner to confirm**.

### 1.5 Switches OFF by default and what each blocks

"setting" = row in `g4d_plan_settings`, edited by staff in the admin dashboard through the plan-settings API. "ENV" = server environment variable (owner sets it; not coding work).

| Switch | Kind | Default | What it blocks | Evidence |
|---|---|---|---|---|
| `paymentsMode` | setting | `off` | all online plan payments: orders refused (PAYMENTS_DISABLED), webhooks ignored. `test` uses test keys. `live` also needs ENV `PLAN_PAYMENTS_LIVE_ENABLED=true` and live keys | `src/plan-billing/settings/billing-settings.ts:23`, `src/plan-billing/razorpay/payments-gate.ts:37-93` |
| `paymentGateway` | setting | `razorpay` | choice of Razorpay or Cashfree | `gateway-settings.service.ts:21-62` |
| `PLAN_PAYMENTS_LIVE_ENABLED` | ENV | unset | live mode refused | `payments-gate.ts:47,92` |
| `RAZORPAY_LIVE_KEY_ID/SECRET/WEBHOOK_SECRET`, `CASHFREE_LIVE_APP_ID/SECRET_KEY` | ENV or stored keys | unset | no live adapter can be built | `payments-gate.ts` buildGateway; `src/platform-settings/platform-settings.constants.ts` |
| `renewalRemindersEnabled` | setting | false | renewal reminder job | `billing-settings.ts:23` |
| `provisioningRunnerEnabled` | setting | false | the 30-second runner: vendors created on behalf stay queued and no site is built | `src/provisioning/settings/provisioning-settings.ts:24`; cron `src/provisioning/runner/provisioning-cron.ts:17` |
| `inviteAdapterMode` | setting | `sandbox` | invite really sent (needs `live`) | `provisioning-settings.ts:28` |
| `siteDraftBuilderMode` | setting | `legacy` | `renderer` also builds the site settings and a DRAFT_PREVIEW | `provisioning-settings.ts:30` |
| `provisioningDirectoryProfileEnabled` | setting | false | extra step CREATE_DIRECTORY_PROFILE | `provisioning-settings.ts:31` |
| `seededSiteIndexingMode` | setting | `OFF` | seeded sites stay noindex; `QUALITY` allows indexing (SUPER_ADMIN only) | `src/b3-settings/b3-settings.ts:69` |
| `directoryPagesIndexable`, `directoryIndexUnclaimed` | setting | false | directory pages and unclaimed listings stay noindex | `src/directory/settings/directory-settings.ts:37,39` |
| `smsAdapterMode` | setting | `sandbox` | live SMS for directory/claim OTP. Also needs ENV `SMS_LIVE_ENABLED=true`; comment says no provider adapter ships | `directory-settings.ts:46`; `src/directory/sms/sms-adapter.ts:6,23` |
| `messagingMode` | setting | `sandbox` (only value accepted) | live WhatsApp/SMS/e-mail for requests | `b3-settings.ts:97`; `src/requests-orders/messaging.service.ts:8-15` |
| `MESSAGING_LIVE_ENABLED` | ENV | unset | if `true`, a send is marked FAILED because no live adapter exists | `messaging.service.ts:15`; `src/v3-payments/documents.ports.ts:15` |
| `requestNudgeEnabled` | setting | false | unanswered-request reminder to the vendor (job every 5 min) | `b3-settings.ts:77`; `src/requests-orders/requests.cron.ts:20` |
| `canonicalSwitchTickEnabled` | setting | false | canonical host switch-back when the custom-domain add-on ends | `b3-settings.ts:70`; `src/site-domains/canonical-switch.service.ts:83` |
| `domainDnsLiveChecks` | setting | false | real DNS checks for custom domains | `src/site-domains/settings/domain-settings.ts:46` |
| `connectionWatcherEnabled` | setting | false | custom hostname connection watcher | `src/v3-domain-automation/settings/automation-settings.ts:15` |
| `EMAIL_LIVE_SEND` | ENV | off | system mail: claim OTP, identity OTP and plan receipts are not sent. The claim challenge is revoked; routes answer MAIL_DISABLED | `src/v3-mail/core/mail-core.ts:32-33`; `src/v3-mail/mail-enabled.ts:5`; `src/provisioning/claims/claim-otp.service.ts:37`; `src/plan-billing/invoice-delivery.service.ts:11` |
| `EMAIL_FORWARD_LIVE` | ENV | off | mail sent to a business's mailbox address is not forwarded | `mail-core.ts:32-33`; `src/v3-mail/inbox.service.ts:23` |
| `heldEnquiriesEnabled` | setting | false | holding mail for a business whose plan is inactive | `src/v3-mail/settings/mail-settings.ts:23`; `inbox.service.ts:47` |
| `SMS_LIVE_SEND` | ENV | off | V3 SMS port; no provider chosen, `UnboundSmsTransport` refuses | `src/v3-mail/core/sms-core.ts:46`; `src/v3-mail/sms.port.ts:10` |
| `walletExpiryTickEnabled` | setting | false | wallet credit expiry job | `src/v3-wallet/settings/wallet-settings.ts:33` |
| `serviceAutoApproveEnabled` | setting | false | auto-approval of delivered service requests | `wallet-settings.ts:34` |
| `REGISTRAR_LIVE_SEARCH`, `REGISTRAR_LIVE_PURCHASE` | ENV | off | domain search / buying through ResellerClub | `src/v3-registrar/core/registrar-core.ts:85`; `registrar.port.ts:47` |
| `registrarReconcileEnabled` | setting | false | daily registrar reconcile | `src/v3-registrar/settings/registrar-settings.ts:33` |
| other registrar settings | setting | null | nameservers, minimum balance, OTP limits, document size: purchases refused until staff set them | `registrar-settings.ts:31-33` |
| `aiLiveCalls` | setting | false | real OpenAI/Anthropic calls from AI Studio (keys `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) | `src/ai-studio/settings/ai-settings.ts:19` |
| `VENDOR_GATEWAY_LIVE_ENABLED`, `VENDOR_GATEWAY_WEBHOOK_ENABLED` | ENV | off | a vendor's own gateway: no adapter in this build; vendors are paid by UPI and confirm by hand | `src/requests-orders/requests-ports.ts:24-32`; `vendor-webhook.service.ts:18-23` |
| `V3_LIVE` | ENV | unset | with NODE_ENV=production, the startup check refuses a missing or placeholder variable | `src/common/startup-check.ts:5,86` |
| `THROTTLE_DISABLED`, `OTP_DEV_ECHO`, `EMAIL_MODE=test` | ENV | off | test conveniences; startup check refuses them in production | `startup-check.ts:121` |
| plan features `site.cta`, `requests.inbox` | plan data | per plan | public enquiry form and vendor inbox | `src/requests-orders/public-requests.service.ts:77` |
| Regulated packs | - | - | no code switch found; pack `reviewStatus` is `DRAFT` for each pack (`src/v3-packs/core/pack-core.ts:15,98,237`). How regulated packs are gated is **UNVERIFIED** until section 2 | |
| Mailbox reseller | - | - | **not in code**: `src/v3-mail` holds inbox, forwarding and rules only | grep `mailbox` in `src` |

Scheduled jobs found (`@Cron` grep): provisioning runner 30 s, plan billing hourly, requests every 5 min, canonical switch 10 min, v3-payments 5 min, admin actions 5 min, host visits 30 s, domain automation 5 min, wallet hourly, service requests hourly, act-on-behalf every minute, registrar (10 min, hourly, 03:00, 04:00, 06:00), plus legacy commercial renewal, theme expiry, social, LeadSpace and travel jobs. Which V3 jobs do nothing when their feature is off is **UNVERIFIED** per job.

### 1.6 Effect of each switch on a visitor enquiry reaching a vendor

Path, read in `src/requests-orders/public-requests.service.ts`: `POST /v3/public/sites/:host/requests` (`api/public-requests.controller.ts:21`) -> `gate()` (lines 69-79) -> `prepare()` (validation, consent, spam) -> row stored as RECEIVED -> `deliver()` (lines 135-141) sends two messages through `MessagingService` and moves the row to DELIVERED.

1. **Gate (visitor gets "not found"):** unknown host; vendor SUSPENDED or removed; legal takedown; plan features `site.cta` or `requests.inbox` not ACTIVE. A plan without those features cannot receive enquiries.
2. **Spam:** a blocked phone, network or e-mail is stored as SPAM and looks accepted; nothing is delivered (line 174). A high score asks for a phone code first (lines 106-124); with `smsAdapterMode` at `sandbox` the code is stored in the database only (lines 121-123), so on live a visitor with a high spam score cannot verify.
3. **Delivery to the vendor:** all three adapters only record `SENT_SANDBOX` (`messaging.service.ts:8-15,54`); `messagingMode` accepts only `sandbox`; `MESSAGING_LIVE_ENABLED=true` makes sends FAILED, then a DASHBOARD row is the fallback (lines 48, 58). **Result: the enquiry is stored and the vendor can read it in the dashboard inbox, but no SMS, WhatsApp or e-mail alert reaches the vendor or the visitor, whatever flag the owner sets. This is a code gap, not an owner switch.**
4. `EMAIL_FORWARD_LIVE` and `heldEnquiriesEnabled` concern the mailbox inbox (`v3-mail`), not the website form.
5. `requestNudgeEnabled` adds a reminder through the same sandbox messaging.
6. Payments, indexing, registrar and AI flags do not change whether an enquiry arrives. `provisioningRunnerEnabled` decides whether a created vendor has a site at all (section 6, journeys 1 and 7).
