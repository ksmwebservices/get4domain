# Communication Matrix (PRD §92.5) + Communication stack findings

> Part of the Get4Domain V2 audit baseline (2026-10-02, audit-only; no code changed by this work). Statuses use the PRD §64.2 vocabulary. **Static-verified only** — nothing here was executed against a running system. Source evidence: `evidence/comms.md`. Summary and verdict: [AUDIT_REPORT.md](AUDIT_REPORT.md).

## 8. PRD §92.5 Communication Matrix (as implemented)

Columns: Channel | Use case | Template or consent requirement | Trigger | Provider | Status | Audit (is it logged?)

| Channel | Use case | Template / consent requirement | Trigger | Provider | Status | Audit |
|---|---|---|---|---|---|---|
| Email | Vendor to contact, manual send in the Hub | None enforced; no consent, no unsubscribe | Manual | Resend | WORKING (happy path; status not provider-verified) | `Message` row (best-effort) plus a wallet row |
| Email | Platform transactional (welcome, invoice, payment, support, invite) | N/A (transactional) | Event hooks (§6) | Resend | PARTIAL (the `error` return is ignored) | Server logs only on a throw |
| Email | Marketing campaigns, bounce and unsubscribe handling | Required by the PRD | n/a | n/a | MISSING | None |
| SMS | Customer OTP (demo funnel) | Platform OTP on the quick route, not DLT | Public API | Fast2SMS | BLOCKED-EXTERNAL | Logged (the code is logged in mock mode). No DB audit except `OtpDailyVerification`. |
| SMS | Customer portal OTP | None | Public API | Fast2SMS | PARTIAL (no throttle, OTP logged) | Log only |
| SMS | Vendor to customer, manual | Single DLT template id for everything; no consent | Manual (backend only; UI blocked) | Fast2SMS | BACKEND-ONLY | `Message` plus wallet |
| SMS | Booking reminder, order update, campaigns | DLT templates plus consent | n/a | n/a | MISSING | None |
| WhatsApp | Inbound, bot, KB first, AI fallback | 24h session window; no opt-in captured | Inbound webhook (unauthenticated, see 1.7) | Fast2SMS | PARTIAL / BLOCKED-EXTERNAL | `Message` (in and out) and `WhatsappConversation`; not viewable |
| WhatsApp | Vendor to customer template send | Single template id; no per-use template; no consent | Manual (backend only) | Fast2SMS | BACKEND-ONLY | `Message` plus wallet |
| WhatsApp | Platform to vendor or admin alerts (support, payments, invites, lead alert) | Hard-coded MSG91 template names (`team_invite`, `new_lead_alert`, `payment_received`, `new_support_ticket`, `support_reply`), approval not tracked | Event hooks | MSG91 | BLOCKED-EXTERNAL (returns false silently when unconfigured) | Logger only; no DB record |
| WhatsApp | Broadcast, order updates, abandoned cart, price drop, catalogue | Template plus opt-in | n/a | n/a | MISSING | None |
| WhatsApp | Human handoff | n/a | Keyword regex | n/a | PARTIAL (one-way; no reply UI; never un-muted) | State on `WhatsappConversation` |
| WhatsApp | Click-to-chat from TeleCRM | n/a | Manual `wa.me` link | None (the user's own WhatsApp) | WORKING (a deep link only, `FE components/telecrm/TeleCrmBoard.tsx:602`) | None |
| In-app | Vendor and admin event notices | n/a | Event hooks | DB | WORKING (backend); vendor UI MOCKED (5.2) | `g4d_notifications` rows |
| Web Push | Vendor and admin alerts | Browser permission | Same as in-app | VAPID web-push | BLOCKED-EXTERNAL (keys needed); subscription trust flaw (5.7) | Subscriptions only; no send log |
| Voice | TeleCRM calls | n/a | Manual `tel:` link and manual call log | None (the device dialer) | WORKING as a logger (the CRM stores call logs) | `CallLog` |

---


---
# Detail by channel

## 0. Architecture facts

| Fact | Evidence |
|---|---|
| There are TWO parallel provider stacks. The new stack (Communication Hub, WhatsApp bot, OTP) uses Fast2SMS through PlatformSettings. The legacy stack uses MSG91 straight from `process.env`. | New: `BE/sms/sms.service.ts:5`, `BE/whatsapp/whatsapp.service.ts:13-14`. Legacy: `BE/notifications/sms.service.ts:6-7`, `BE/notifications/whatsapp.service.ts:6-7,21` |
| The legacy MSG91 `SmsService` is registered and exported but has no consumer anywhere. It is dead code. | `BE/notifications/notifications.module.ts:9-11`. A grep of `SmsService` shows every consumer imports `../sms/sms.service` (the Fast2SMS one). |
| The legacy MSG91 `WhatsAppService.sendTemplate` is used only for platform-to-admin and platform-to-vendor system alerts: support tickets, payment_received, team invites, and campaign-page new_lead_alert. | `BE/support/support.service.ts:40,120`, `BE/payments/payments.service.ts:266`, `BE/team/team.service.ts:39`, `BE/admin-team/admin-team.service.ts:46`, `BE/campaign-pages/campaign-pages.service.ts:146` |
| WhatsApp is NOT Meta Cloud API direct. It goes through a central Get4Domain Fast2SMS account (GET `https://www.fast2sms.com/dev/whatsapp` for templates, POST `/dev/whatsapp-session` for free text). The legacy path goes through MSG91. | `BE/whatsapp/whatsapp.service.ts:13-14,52-61,93-97` |
| The admin Integrations UI lists a "WhatsApp (BSP)" category (`bsp_provider`, `bsp_api_key`, `bsp_account_id`). No code reads it. | `BE/platform-settings/platform-settings.constants.ts:67-74`. A grep for `bsp_` finds nothing outside the constants file. |
| The admin Integrations UI lists "Web Push (VAPID)" keys and an "Email (Resend)" API key. `PushService` and `EmailService` read ONLY `process.env.VAPID_*` and `process.env.RESEND_API_KEY`. The DB-configured values are ignored. | `BE/notifications/push.service.ts:18-20`, `BE/email/email.service.ts:17`, constants `:98-131` |
| `testSetting` does not call any provider. It only checks that a value exists ("basic check — live provider ping pending"). | `BE/platform-settings/platform-settings.service.ts:100-115` |

---

## 1. WhatsApp

| # | Capability | Status | Evidence |
|---|---|---|---|
| 1.1 | Provider is Fast2SMS WhatsApp (central account), not the vendor's own Meta WABA | PARTIAL | `whatsapp.service.ts:16-22,42-43`. The key comes from `fast2sms/api_key`. The vendor's own number is only a `phone_number_id` string passed to Fast2SMS (`:59`). |
| 1.2 | Outbound template send (real HTTP call) | BLOCKED-EXTERNAL | `whatsapp.service.ts:41-74`. A real `fetch` to Fast2SMS is made when the key and template id exist. With no key or template it logs `[MOCK]` and returns `status:'mock'` (`:46-49`). Failures return `status:'failed'` with no retry. The endpoint contract is not verified at runtime. Needs the Fast2SMS key, an approved template, and the `fast2sms/wa_message_id` setting. |
| 1.3 | Outbound free-form session send (bot replies) | BLOCKED-EXTERNAL | `whatsapp.service.ts:83-110`. Same mock-first pattern. |
| 1.4 | Send template or session from the Communication Hub UI | BACKEND-ONLY | The backend `POST /communication/send` works (`communication.service.ts:74-84`). The UI hard-codes `NEEDS_SETUP = {whatsapp:true, sms:true}` (`FE/app/dashboard/communication/page.tsx:51`), so the WhatsApp and SMS tabs always show the "Configure in Settings" card (`:104-115`). The compose box is only rendered for email (`:116-188`). |
| 1.5 | Template lifecycle storage (name, language, category, provider id, approval state, last sync) | MISSING | There is no template model in `prisma/schema.prisma`. `VendorCommsSettings.waTemplateId` is one free-text string (schema `:1308-1340`). `AiTemplate` (`:831`) is for AI content, not WhatsApp. There is no template list, create or sync, and no approval-state tracking. `sendMessage` passes the template id as `message_id` and the whole message as `variables_values`, so there is no per-use-case template. |
| 1.6 | Inbound webhook receiver exists | PARTIAL | `whatsapp-bot/whatsapp-bot.controller.ts:54-84`. `@Public()` `POST /whatsapp-bot/webhook`. Only `incoming_message` of type `text` is processed (`:74-75`). Images, documents, location, buttons and reactions are ignored. |
| 1.7 | Webhook signature or secret verification | BROKEN | The controller compares the header to `getWebhookSecret()` (`:65-71`), which calls `getResolvedValue('fast2sms','webhook_secret_key')` (`whatsapp.service.ts:113-115`). `getResolvedValue` returns `null` when `findSetting()` finds no definition (`platform-settings.service.ts:121-123`). `webhook_secret_key` is NOT defined in the fast2sms category (`constants:87-97` has api_key, sender_id, dlt_entity_id, sms_message_id and wa_message_id only). The secret is therefore always null, the `if (expected)` guard never fires, and the endpoint is effectively unauthenticated. An admin also cannot set the key through the UI, because `testSetting` and the setter reject unknown keys. This is a security defect: anyone can POST a forged payload. |
| 1.8 | Idempotency or dedupe of inbound messages | MISSING | `message_id` is stored as `providerMessageId` (`whatsapp-bot.service.ts:53,139-142`). There is no unique constraint and no lookup (schema `Message :556-571`), so a provider retry creates duplicate messages and duplicate bot replies. |
| 1.9 | Conversation history persisted | PARTIAL | Persisted: `Message` (in and out, `whatsapp-bot.service.ts:139-143`) and `WhatsappConversation` (state, window, lead link). The write is best-effort, and a failure is swallowed (`.catch(()=>null)`). It is NOT viewable in any UI: the WhatsApp tab in the hub is hard-blocked (1.4), TeleCRM has no transcript view, and `commHistory` is only called from the hub. The copy "Incoming messages are still saved" (`communication/page.tsx:110`) is true for storage but not for visibility. |
| 1.10 | Delivery, read and failure status stored | MISSING | The webhook ignores every `webhook_type` except `incoming_message` (`controller:74`). `Message.status` only ever holds `sent`, `mock`, `failed` or `received` (schema `:556-571`), taken at send time. There are no delivered or read states. |
| 1.11 | Human handoff | PARTIAL | A regex (`whatsapp-bot.service.ts:11`) sets `convo.state='agent'` (`:65-70`), creates a lead, and sends the vendor an in-app and push notification. After that the bot goes silent (`:56`). There is no code path to reset the state to `active` (grep: only `state:'active'` in the name-capture branch `:77`). A vendor has no WhatsApp reply UI (1.4). So the "human" can only reply from outside the product, and the conversation stays muted forever. |
| 1.12 | AI or auto replies (bot) | PARTIAL | Flow: tenant routing, then KB keyword match (`knowledge-base.service.ts:77-94`), then an AI fallback (`whatsapp-bot.service.ts:169-178`). `AiService.whatsappBotReply` (`ai/ai.service.ts:223-237`) calls OpenAI `gpt-4o-mini` first, else Claude, via `generateText` (`:146-160`). The prompt is grounded in that vendor's KB, CMS profile and products (`knowledge-base.service.ts:101-120`). It is isolated per vendor because the context is built with `vendorId`. If the AI throws, it falls back to a canned greeting (`:173-177`). Real code, but it depends on the Fast2SMS key and an AI key. Prompt-injection hardening is minimal (the customer message is interpolated raw). |
| 1.13 | Keyword and KB CRUD (vendor-managed auto replies) | WORKING | UI `FE/app/dashboard/whatsapp-bot/page.tsx:24-157` calls `api.get/create/update/deleteKbEntry` (`FE/lib/api.ts:127-132`). BE `whatsapp-bot.controller.ts:24-50`. `knowledge-base.service.ts:23-48` takes `vendorId` from the JWT, with `updateMany`/`deleteMany` scoped to `{id,vendorId}`. Full UI to API to DB path. The `catch(() => {})` in the page (`:56-66`) hides edit and delete errors. Static-verified. |
| 1.14 | Bot charges the wallet | PARTIAL | `reply()` bills `whatsapp_session` once per 24h window, only when `res.status==='sent'` (`:156-166`). The balance check happens after the reply has already gone out (`:151-163`). If the balance is insufficient, the reply is still sent for free and the window is still opened (`:165`). `deduct` can throw after the send, and the webhook then returns a 500. AI cost is not billed separately. |
| 1.15 | Per-vendor isolation of the bot | PARTIAL | KB, conversation and contact are all scoped by `vendorId` resolved from `phone_number_id` (`:111-120`). **Risk:** when `phone_number_id` is missing or unmatched, `resolveVendor` falls back to `whatsappConversation.findFirst({where:{phone}})`, which picks an arbitrary vendor's conversation with that phone (`:116-118`). A customer who messaged several vendors can be routed to the wrong tenant. Combined with the open webhook (1.7), an attacker can choose the tenant. |
| 1.16 | Consent, opt-in and opt-out (WhatsApp) | MISSING | There is no consent field on `Contact` (schema `:528-554`). A grep for `unsubscribe`, `opt.out`, `optOut` and `STOP` in `src` hits only `crm/*`, where it is a UI comment that CSV import does not grant consent. The bot and Hub send to any number and handle no STOP keyword. |
| 1.17 | Vendor's own authorised WABA (PRD §11: "official Meta authorization") | MISSING | There is no Meta embedded signup, OAuth, token storage, WABA id or business verification. The vendor pastes a Fast2SMS `phone_number_id` (`FE communication/page.tsx:279-281`). An admin marks it `verified` by hand (`vendor-comms.service.ts:89-97`), and the number has to be provisioned inside Get4Domain's own Fast2SMS account out of band. Outbound uses the vendor id only when `waStatus==='verified'` (`:208`). The claim and verify steps are real code, but they are a manual routing map, not vendor-authorised WABA architecture. |
| 1.18 | Broadcasts or campaigns over WhatsApp | MISSING | There is no bulk-send engine. `CampaignsService.approve` only debits the wallet and notifies the admin to run it manually (`campaigns/campaigns.service.ts:48-72`). |
| 1.19 | Webhook and number health, catalogue sync, order updates, abandoned cart, price drop | MISSING | No code for any of them. |
| 1.20 | Vendor comms settings (number, template, greeting, enable flag, verification) | PARTIAL | `vendor-comms.service.ts` plus controllers, with real DB upserts (`:180-185`). Tenant comes from the JWT (`vendor-comms.controller.ts:24,29`). Claim conflict handling is real (`:112-156`). The admin override page exists (`FE admin/vendor-access/page.tsx:54,159`). It configures routing metadata only. Nothing here talks to any provider, and `waEnabled` defaults to `true` (`:210`). |

---

## 2. SMS

| # | Capability | Status | Evidence |
|---|---|---|---|
| 2.1 | Provider abstraction | MISSING | Single hard-wired Fast2SMS class (`sms/sms.service.ts`). There is no interface, no provider registry, and no use of the BSP and SMS settings categories. The legacy MSG91 class is unused. |
| 2.2 | Transactional SMS send (real HTTP) | BLOCKED-EXTERNAL | `sms.service.ts:36-71` calls Fast2SMS `bulkV2` (GET, with the API key in the query string). It returns `mock` when there is no key (`:42-45`) and `failed` with an error on a non-OK response. Needs the Fast2SMS key and DLT setup. |
| 2.3 | DLT config | PARTIAL | Settings fields exist: `sender_id`, `dlt_entity_id`, `sms_message_id` (`constants:87-97`). Used at `sms.service.ts:89-103`. ONE template id is applied to every generic SMS (OTP, invite, quote, welcome) with `variables_values = "brand|message"`. That cannot match multiple differently worded DLT-approved templates, and TRAI scrubbing would reject the mismatches. With no template id it falls back to the Quick route `q` (`:106`), a non-DLT route that is a compliance risk in India. OTP always uses `route:'q'` (`:116-119`). |
| 2.4 | SMS templates | MISSING | Not in the schema. No per-template storage or approval tracking. |
| 2.5 | Delivery report (DLR) storage | MISSING | There is no DLR webhook. `Message.status` is captured at send time only. |
| 2.6 | OTP flow, Book-Demo (public) | PARTIAL | `otp/otp.service.ts` generates a 6-digit code with `Math.random` (not a CSPRNG, `:81`). The code store is an in-memory `Map` (`:36`). It is lost on restart and not shared across instances, which the file itself admits (`:20-27`). There is a 30s per-number cooldown (`:73-76`), a 5 minute TTL, and 5 attempts per code. A DB-backed "verified today" record exists (`OtpDailyVerification`, schema `:2323`). `/otp/request` and `/otp/verify` are `@Public` with no IP or global throttle (`otp.controller.ts:13-25`). An attacker can fan out to many numbers and burn about ₹5 per SMS of platform money. Real send when keyed, otherwise `mock`, and an optional `devCode` echo when `OTP_DEV_ECHO=true` and mock (`:92-95`). |
| 2.7 | OTP flow, Customer portal login | PARTIAL | `customer/customer.service.ts:51-65`. In-memory `Map`. **No cooldown, no attempt limit, no throttle** on request or verify (`:68-78`). The contact lookup `findFirst({where:{phone}})` ignores which vendor (`:52`). The OTP is logged with `[MOCK] OTP for ...` at `:60`, even when SMS is real. `devOtp` is returned in the API response whenever `NODE_ENV!=='production'` (`:62-63`), and the UI renders it (`FE app/customer/page.tsx:134,231`). Unbounded brute force of a 6-digit code within 5 minutes is possible. |
| 2.8 | Usage and cost tracking | PARTIAL | Hub sends are debited to the wallet (`communication.service.ts:91-93`, see §7). There is no usage report, per-channel counters, or provider-cost reconciliation. Platform-paid SMS (OTP, customer invite, customer OTP, demo enquiry) has no usage record at all. |
| 2.9 | Failure and retry | MISSING | `status:'failed'` is returned and (for the hub) stored. There is no retry, no queue and no backoff. |
| 2.10 | Opt-out (SMS) | MISSING | None. |

---

## 3. Email

| # | Capability | Status | Evidence |
|---|---|---|---|
| 3.1 | Provider is Resend (real SDK) | BLOCKED-EXTERNAL | `email/email.service.ts:16-21,172-185`. Needs `RESEND_API_KEY` and a verified sending domain. The DB-configured `email/resend_api_key` in the admin UI is NOT used (`:17`). `new Resend(undefined)` is constructed at boot. |
| 3.2 | Transactional emails (welcome, invoice, payment confirmation, support, team invite, admin alerts) | PARTIAL | Real calls at `invoices.service.ts:115,167,206`, `payments.service.ts:254-255`, `support.service.ts:26-29,106`, `team.service.ts:37`, `vendors.service.ts:69`. **Fake-success risk:** `send()` wraps `resend.emails.send` in try/catch and ignores the return value (`:174-180`). In resend@4.8.0 the typed result is `{data, error}` (`node_modules/resend/dist/index.d.ts:56-80`). API-level rejections (unverified domain, invalid recipient, 4xx) come back in `error`, do not throw, and so go undetected. The system believes the email was delivered. `support.service.ts:26-29` has no try/catch around the email, so a real throw makes ticket creation return 500 after the row was saved. |
| 3.3 | Welcome email contains the vendor's plaintext password | BROKEN | `email.service.ts:23-40`, called at `vendors.service.ts:69` with `dto.password`. Credentials are sent in clear text through a third-party provider. A security and compliance defect. |
| 3.4 | Vendor to customer email via the Hub (UI) | WORKING | The only Hub channel with a live UI (`NEEDS_SETUP.email=false`, `communication/page.tsx:51`). Path: UI, `POST /communication/send`, `CommunicationService.send` (vendorId from the JWT, `controller:23-24`), Resend, `Message` row. Branding via `resolveBranding` (from-name and reply-to, `vendor-comms.service.ts:193-213`). **Qualifiers:** (a) the status is hard-coded `'sent'` and `mock:false` regardless of the provider result (`communication.service.ts:73`); (b) the body is `<p>${message}</p>`, unescaped HTML from the vendor (`:70`), so HTML or markup injection into the platform's verified domain is possible; (c) there is no provider message id; (d) there is no per-vendor domain, so the sender is the platform address. Graded WORKING only on the happy path with a valid key, but the status integrity flaw in 3.2 applies. |
| 3.5 | Email campaigns | MISSING | No bulk sender. `CHANNEL_COSTS_PAISE.email=10` (`campaigns.service.ts:9-16`) is a price estimate only, and it disagrees with the Hub rate of 20 paise (`communication.service.ts:16`). |
| 3.6 | Email templates | MISSING | Hard-coded HTML strings in `email.service.ts`. There is no user-editable template model. |
| 3.7 | Bounce and complaint handling | MISSING | No Resend webhook, no suppression list. |
| 3.8 | Unsubscribe | MISSING | No link, no list. |
| 3.9 | Delivery state | MISSING | There is no `delivered/opened/bounced` state, and no `providerMessageId` is captured for email. |
| 3.10 | Inbound email, reply threading | MISSING | Replies go to the vendor's own inbox through Reply-To. The platform ingests nothing. |

---

## 4. Communication Hub as a unified module

What `vendor-comms` does: it is a per-vendor settings and branding resolver (`resolveBranding`) plus a WhatsApp `phone_number_id` claim and verify workflow. It contains no messaging, queue or inbox logic.
What `communication` does: it provides `send` (one channel, synchronous), `threads` and `history` (`communication.service.ts`).

| # | Capability (PRD §10) | Status | Evidence |
|---|---|---|---|
| 4.1 | Unified send (email, WhatsApp, SMS) | PARTIAL | `communication.service.ts:44-112`. It is a synchronous pass-through to the three providers. The UI exposes only email (1.4). |
| 4.2 | Unified inbox | PARTIAL | `threads()` is the vendor's first 50 CONTACTS ordered by `updatedAt`, with the latest message from the last 300 messages (`:128-144`). It is not a conversation or thread model: there is no `Thread` table, no unread count, no assignment, no per-channel thread, and it only knows contacts. Inbound WhatsApp is persisted but not shown (1.9). There is no inbound SMS or email. |
| 4.3 | Internal notes in the inbox | MISSING | No such field. |
| 4.4 | Templates (lead response, order, booking, payment, shipping, campaign, follow-up) | MISSING | No template model or UI. |
| 4.5 | Message queue and retry policy | MISSING | No queue (no bull, no pg-boss). The only cron in the repo is contract billing (`travel/contracts.service.ts:137`). `ScheduleModule` is loaded (`app.module.ts:85`) but nothing messaging-related is scheduled. |
| 4.6 | Consent and opt-out | MISSING | See 1.16. |
| 4.7 | Usage tracking | PARTIAL | Only via `WalletTransaction` rows (`service='comm_<channel>'`, `communication.service.ts:92`). |
| 4.8 | History persistence | PARTIAL | `Message` is written best-effort after the send, and errors are swallowed (`:96-109`). If `deduct` throws after a successful send (`:91-93`), the message is sent but not recorded. |
| 4.9 | Tenant isolation | PARTIAL | `vendorId` is always taken from the JWT (`communication.controller.ts:18,24,29`), which is good. But `contactId` from the client is written onto `Message` without an ownership check (`communication.service.ts:100`), and `history` filters by vendorId, so there is no read leak. |
| 4.10 | Admin quote sending via the Hub | BROKEN | `QuotesController.create` passes `user.email` as `sentBy` (`quotes/quotes.controller.ts:23`). `quotes.service.ts:53` then calls `communication.send(sentBy, ...)` with that email as `vendorId`. `send` calls `wallet.hasSufficientBalance(vendorId)`, which runs `getOrCreateWallet` (`wallet.service.ts:34-38,169-172`), and that tries to `create({vendorId: <email>})`. `Wallet.vendorId` has a foreign key to `Vendor` (schema `:338-349`), so Prisma throws and the send 500s. The `Quote` row was already created with `status:'sent'` (`quotes.service.ts:36-50`), so the record claims it was sent when it was not. This only works if the channel rate is 0. Static analysis only. It should be confirmed in a staging run. |
| 4.11 | Customer portal invite | MOCKED | `customer/customer.service.ts:200-212`. It sends WhatsApp and SMS through the platform account (no wallet debit, no consent) and returns `{sent:true, mock: wa.mock}`. It always returns `sent:true` regardless of provider failure (`:211`) and does not check the SMS result. |

---

## 5. Notifications

| # | Capability | Status | Evidence |
|---|---|---|---|
| 5.1 | In-app notification persistence | WORKING (backend) | `notifications.service.ts:21-41` writes `g4d_notifications`. `GET /notifications` is scoped by recipient (`controller:19-24`). Written from the engine, support, campaigns and the WhatsApp bot (§6). |
| 5.2 | In-app notification UI for vendors | MOCKED | `FE app/dashboard/notifications/page.tsx:3-8` renders a hard-coded array: "mrtravels.get4domain.com live", "Invoice INV-001 paid ₹29,499", and so on. It never calls `api.getNotifications`. The bell shows an always-on red dot (`FE app/dashboard/layout.tsx:357-360`). There is no unread count, and `markRead` and `markAllRead` are wired in `api.ts:517-520` but never used by a page. |
| 5.3 | Overview "recent activity" from notifications | PARTIAL | `FE app/dashboard/page.tsx:66-76,123` really fetches `/notifications`. It maps `n.body`, but the backend field is `message` (`notifications.service.ts:30`), so the subtitle is always empty. |
| 5.4 | Admin unread badge | WORKING | `FE app/admin/layout.tsx:147-160` polls every 30s and counts unread. The bell links to `/admin/support`. |
| 5.5 | Mark-read ownership check | BROKEN | `PUT /notifications/:id/read` calls `markRead(id)` with no check that the notification belongs to the caller (`controller:26-30`, `service:63-65`). Any authenticated user can mark any notification read (IDOR). Low impact but a real gap. |
| 5.6 | Web Push (VAPID) | BLOCKED-EXTERNAL | Real `web-push` library (`push.service.ts:34-48`). Subscribe stores the endpoint and keys (`notifications.service.ts:76-89`). The FE registers `/sw.js`, asks for permission and subscribes (`FE lib/push-notifications.ts`, `dashboard/layout.tsx:90-100`). Expired endpoints are pruned on 404 or 410 (`service:105-108`). Needs VAPID keys (BE env) and `NEXT_PUBLIC_VAPID_KEY` (FE env); without them it silently no-ops (`push.service.ts:34-37`). Not verified end-to-end. |
| 5.7 | Push subscription trust boundary | BROKEN | `userType` is taken from the request body (`subscribe.dto.ts:30-32`), while `userId` is `user.sub` for non-admins (`controller:42-50`). A vendor who posts `userType:'ADMIN'` gets a row that `pushToRecipient` selects for every admin notification (`service:92-95`: `userType==='ADMIN'` with no userId filter). A vendor can therefore receive admin pushes (support tickets, payments, callback requests). Static analysis only. |
| 5.8 | Push payload and click-through | PARTIAL | `pushToRecipient` sends only `{title, body}` (`service:100`, `push.service.ts:42`). `sw.js:20` reads `data.url`, but the notification's `data.link` is never pushed, so a click always opens `/dashboard`. |
| 5.9 | Notification preferences, mute, digest | MISSING | No model or UI. |

---

## 6. Automation engine (Trigger, Conditions, Action)

**Verdict: no generic engine exists. MISSING.** There is no rule model, trigger registry, condition evaluator, scheduler or action runner. The schema has no Automation, Workflow, Rule or Trigger model (grep of the models returned none). The `engine/` directory is the Industry Website Engine (a public action dispatcher), not an automation engine. The only generic-looking pieces are `ActionRegistry`, which maps public website intents to handlers and is not user-configurable, and `ScheduleModule`, which has one unrelated cron.

Every place an automatic message or task is created from a business event (hard-coded hooks):

| Event | Automatic action | Real or stub | Evidence |
|---|---|---|---|
| Public website enquiry (engine action) | In-app and push notification to the vendor (`routeLead`) | Real (in-app); no customer confirmation | `engine/action-registry.ts:67,130,146,195,202-213` |
| Real-estate site visit or token payment (engine) | In-app notification, and a CRM Deal is created | Real | `engine/action-registry.ts:146-199` |
| Campaign page lead submitted | Create `CampaignLead`, in-app notification, then a MSG91 WhatsApp "new_lead_alert" to the page's number. The wallet is debited BEFORE the send, and a failed or unconfigured send is never refunded. | Partial. Defect: `sendTemplate` returns false (not configured or error) after `deduct` has run (`campaign-pages.service.ts:142-147`). The vendor pays with nothing sent. | `campaign-pages/campaign-pages.service.ts:116-148` |
| WhatsApp bot: inbound interest, handoff or name captured | Creates a `CampaignLead` (CRM), updates the lead, notifies the vendor | Real | `whatsapp-bot.service.ts:65-100,189-216` |
| Support ticket created | Email to the vendor and admin, in-app notification to the admin, MSG91 WhatsApp to the admin | Real when keyed; the email path ignores Resend `error` | `support/support.service.ts:20-44` |
| Support reply | Email, in-app, MSG91 WhatsApp to the vendor | Same | `support.service.ts:99-124` |
| Public callback request | Creates a `Lead`, emails and notifies the admin | Real; public with no throttle | `support.service.ts:51-79` |
| Demo-site enquiry (public) | Creates a `Lead`, sends a Fast2SMS WhatsApp confirmation to an arbitrary submitted phone number | Real when keyed. Public with no throttle or consent, so a platform-paid spam vector. | `demo/demo.service.ts:343-364`, `demo.controller.ts:21-26` |
| Demo-to-live conversion | SMS "Your Get4Domain account is live" | Real when keyed, best-effort | `demo.service.ts:138` |
| Vendor creation | Welcome email with a plaintext password, trial wallet credit | Real when keyed | `vendors.service.ts:57-70` |
| Invoice created or paid, wallet top-up | Email with invoice and GST confirmation | Real when keyed | `invoices.service.ts:115,167,206`, `payments.service.ts:254-255` |
| Team invite (vendor) and admin-team invite | Email and MSG91 WhatsApp | Real when keyed | `team.service.ts:37-39`, `admin-team.service.ts:46` |
| Campaign approved | Wallet debit plus an admin notification to run it manually | Real, but manual execution (no sender) | `campaigns.service.ts:48-72` |
| Managed-services and domain-campaign leads | Email and notification to the admin | Real | `managed-services.service.ts:55-59`, `domain-campaign.service.ts:66-70` |
| Admin-sent quote | Hub send | BROKEN (§4.10) | `quotes.service.ts:53` |
| Travel recurring contract billing (daily 06:00 cron) | Generates invoices. No customer message found. | Real | `travel/contracts.service.ts:137-153` |
| Not found anywhere | Order placed/confirmed/shipped/delivered, booking reminder, abandoned cart or enquiry, price drop, inactive customer, review request, follow-up due reminders (follow-up dates are only flagged on the TeleCRM board, with no notification), payment reminders | MISSING | grep of `src` found no such triggers |

---

## 7. Wallet and usage billing for messages

| # | Capability | Status | Evidence |
|---|---|---|---|
| 7.1 | Top-up: Razorpay order, HMAC verify, credit with bonus, ledger row, GST invoice | WORKING (static) | `wallet.service.ts:71-130`. Signature check at `:86-93`. Credit and ledger in one `$transaction` (`:101-123`). The order amount is fetched from Razorpay (`:95-96`), so it is not client-trusted. **Gap:** there is no idempotency on `razorpayPaymentId`, so replaying a valid verify call credits again (no unique constraint on `WalletTransaction.razorpayId`, schema `:351-366`). |
| 7.2 | Debit is a real ledger write inside a DB transaction | PARTIAL | `deduct` (`:141-167`) writes `Wallet.balance` and `WalletTransaction` atomically. **But** it reads the balance with `findUnique` then `decrement`s, with no row lock or conditional update. Under READ COMMITTED, two concurrent debits can both pass the check and drive the balance negative. There is no `balance >= amount` guard in the SQL. Not atomic against concurrency. |
| 7.3 | Pre-check, send, then debit sequencing | PARTIAL | `communication.service.ts:56-93`. There is no reservation. Concurrent sends can overspend. If the debit fails after a successful send, the user sees an error and the message is not recorded. Mock and failed sends are not charged (good, `:91`). Email is always charged because its status is hard-coded `sent` (3.4), even when Resend rejected it. |
| 7.4 | Charge-before-send in campaign-page alerts | BROKEN | `campaign-pages.service.ts:142-147`. Debit first, no refund on failure or when MSG91 is unconfigured (7.1 in §6). |
| 7.5 | Campaign approval can be debited repeatedly | BROKEN | `campaigns.service.ts:48-72`. `approve` does not check that `status==='pending_approval'`, so repeated calls debit again, and the debit happens before the status update (non-atomic). Static analysis only. |
| 7.6 | Rates admin-configurable | WORKING | `wallet.getRate` reads the pricing settings with a fallback (`wallet.service.ts:179-193`). The keys exist in the Pricing Manager (`constants:177-180`). The hard-coded fallbacks differ between modules (Hub: sms 50, wa 100, email 20 paise; campaigns: email 10 paise, `campaigns.service.ts:9-16`). |
| 7.7 | Wallet UI | WORKING (partial) | `FE dashboard/wallet/page.tsx` calls the real balance, transactions, topup and verify APIs (`:80,104,120`). Not exercised. |
| 7.8 | Platform-paid sends are not metered | MISSING | OTP, demo enquiry, portal invite and customer OTP SMS cost the platform money with no ledger or cap. |
| 7.9 | Direct admin deduct endpoint | WORKING | `POST /wallet/deduct`, AdminGuard (`wallet.controller.ts:45-50`). |

---


## 12. Status counts (all numbered rows in sections 1 to 7; section 11 excluded as duplicative)

| Status | Count |
|---|---|
| WORKING (incl. "(static)" and "(backend)" qualifiers) | 8 |
| PARTIAL | 29 |
| UI-ONLY | 0 |
| BACKEND-ONLY | 2 |
| MOCKED | 2 |
| BROKEN | 7 |
| MISSING | 28 |
| BLOCKED-EXTERNAL | 7 |
| DEFERRED-APPROVED | 0 |

(Counts are by primary status per row. Counting is approximate where a row carries two statuses; see the rows for qualifiers.)

---

## 13. Top security and correctness findings, ranked

1. **WhatsApp inbound webhook is unauthenticated.** The `webhook_secret_key` setting is undefined, so the "signature check" never runs (1.7). A forged POST can create contacts and leads, trigger AI spend, and make the platform send WhatsApp messages to arbitrary numbers and bill vendors' wallets (1.14, 1.15).
2. **Quote send to a customer is probably broken.** An admin email is passed as `vendorId`, which causes a wallet foreign-key failure, and the quote is already marked `sent` (4.10).
3. **Email delivery status is not trustworthy.** The Resend `{data,error}` return is ignored, so rejected emails are logged as sent and charged (3.2, 3.4, F4).
4. **No automation engine, templates, consent or opt-out, queue, DLR, or delivery and read status.** Most of PRD §10 to §13 beyond basic sending is MISSING.
5. **Wallet debit is not concurrency-safe.** It uses read-then-decrement with no conditional update. Top-up has no replay protection. Campaign approve can be debited repeatedly. Campaign-page alerts debit before the send and never refund (7.2 to 7.5).
6. **Push trust boundary.** A vendor can subscribe as `ADMIN` and receive admin notifications (5.7). Mark-read has no ownership check (5.5).
7. **The vendor Notifications page and bell are fake**, and the Hub WhatsApp and SMS tabs are locked in the UI, so users cannot see or use the WhatsApp features that exist in the backend.
8. **Customer portal OTP has no throttling, and the OTP is logged and echoed** outside production (2.7). The Book-Demo OTP is public with no IP throttle and costs about ₹5 per SMS.
9. **Welcome email contains the vendor's plaintext password** (3.3).
10. **Better than expected:** vendor tenancy in the Hub, vendor-comms, the KB, the wallet, vendor-payments and CRM comes from the JWT everywhere checked. The bot's KB and AI context is vendor-scoped. Wallet debits are real ledger writes. Pricing is admin-configurable. Mock mode is clearly labelled and never charges. The WhatsApp number claim and verify workflow, including the churn reassignment, is thoughtfully built. `vendor-payments` encrypts secrets and never returns them.
