# LeadSpace (Dispatch B, 2026-10-10)

A free landing page for every vendor, customer requests verified on WhatsApp, and a prepaid wallet charged only for a verified customer. Campaigns, landing pages and DomainCampaign were merged into it. This file is the design and the operating manual; progress is in `LEADSPACE_PROGRESS.md`, compliance in `LEADSPACE_COMPLIANCE.md`, the pilot runbook in `LEADSPACE_PILOT.md`, the audit of what was reused in `evidence/leadspace/AUDIT.md`.

## The idea in one paragraph

A vendor gives a trade and a city; we write the page. A visitor fills a short form (one goal: enquiry, booking, appointment, site visit or cart order), receives a code on WhatsApp from the common Get4Domain number, and confirms. In one database transaction the event is stored and the vendor's LEADS purse is debited the price quoted at that moment. If the wallet is short the event is **held** (the customer sees the same thank-you; the vendor sees a count and a masked number) and the next refill releases the oldest first. The page never depends on the wallet. Get4Domain also promotes verified pages on its own themed Facebook, Instagram and Telegram pages, through a shared publisher, with an approval queue.

## Where things live

| Area | Code |
|---|---|
| Data model (22 tables, additive) | `backend-api/prisma/schema.prisma`, migrations `20261010100000_leadspace`, `20261010110000_leadspace_page_stats` |
| Purse and ledger (atomic debit, idempotent) | `src/leadspace/purse.service.ts` |
| Capture engine (OTP, dedupe, charge, hold, release) | `otp.service.ts`, `capture.service.ts`, `goals.ts` (goal flows, consent text) |
| Price rules (versioned) and all rules as settings | `pricing.service.ts`, `settings.service.ts` |
| Invalid-lead credits, disputes, refunds, expiry | `credits.service.ts` |
| Pages: templates, builder, abuse rules, SEO, feed | `templates.ts`, `page-builder.ts`, `abuse.ts`, `profile.service.ts` |
| Wallet refill and tax invoice | `refill.service.ts`, `wallet.controllers.ts`, existing `InvoicesService.createPaidInvoice` |
| Promotion (plan, calendar, guardrails, approval, manual tasks) | `promotion.service.ts`, `guardrails.ts` |
| Shared WhatsApp provider layer (sandbox, Cloud API, gateway rules, webhook) | `src/messaging/whatsapp/*` |
| Shared social publisher (accounts, encrypted tokens, caps, retries, log) | `src/social/*` |
| Reports (cost per verified lead, funnel, UTM sheet) | `reports.service.ts` |
| Campaign merge | `legacy-import.service.ts`, `scripts/leadspace-migrate-campaigns.js` |
| Privacy (erasure, retention) | `privacy.service.ts` |
| Public page `/ls/<slug>`, embed script, sitemap | `get4domain_mvp/src/app/ls`, `public/ls-embed.js`, `app/sitemap-leadspace.xml` |
| Vendor app (five tabs) | `get4domain_mvp/src/leadspace/*` |
| Admin console | `get4domain_mvp/src/leadspace-admin/*`, `/admin/leadspace` |
| Registry | feature `marketing.leadspace`, plan key `LEADSPACE` (free base tier), add-ons `leadspace` and `leadspace_only` |

Dispatch A's shared services (social publisher, WhatsApp provider abstraction) did **not** exist, so they were built here to the interfaces in Dispatch A section 6: `WhatsappProvider` (`sendTemplate`, `parseWebhook`, `verifySignature`, `verifyHandshake`) with a sandbox and a Cloud API implementation, and `SocialProvider` (`publish`, `test`, `results`) per channel with a sandbox. Another feature can use them as they are.

## The rules that are enforced in code (and tested)

- **Charge**: debit and event in one transaction; the debit is a conditional update (`balance >= amount`), so two events racing for the last rupees cannot both win; key `lead:<eventId>`; ledger rows are append-only with running balance.
- **Price**: fixed per event type; most specific rule wins (city + trade, trade, global); rules are never edited (a change ends the old row and adds a new one); the price is quoted at capture and a held lead is debited at that quoted price on release.
- **Hold and release**: strict oldest first; the run stops at the first lead the wallet cannot pay; a vendor can instead choose "polite message" (REJECT), nothing is stored then.
- **Repeats**: same customer, same request inside 12 h is one lead (no second charge); a repeat inside 48 h is captured, not charged, with an automatic credit record; the vendor's own number is never charged. All windows are settings.
- **Consent and codes**: no code without the tick (recorded with the text version); hash-only codes; limits per phone, device and network per hour; blocked numbers never receive a code; a vendor-verification code can never create a customer lead.
- **Common number**: authentication and utility templates only, no free text, no bulk, promotional wording refused, at most 12 a day per number, live templates need Meta's approval, inbound messages are dropped, every send logged against its vendor with the number masked. Status reads **Awaiting approval** until the credentials are set and `leadspace_otp` is Approved.
- **Pages**: the vendor's phone is never published (leads come through the form, so a lead cannot bypass the charge); unverified pages are noindex and never promoted; regulated trades stay noindex until reviewed; blocked words and trade claims are refused; report link on every page; admin suspend.
- **Money routes** are behind `CommercialAdminGuard` (MARKETING gets 403). Page review, promotion queue and the social admin use the staff guard (MARKETING allowed). Guarded by `scripts/leadspace-guard.mjs`.

## Vendor app (five tabs)

Home (wallet, new and held leads, today's bookings and orders, promotion status, one next action, the offer to move up), Leads (chips by kind, status, notes, call and WhatsApp buttons, CSV, held leads masked, dispute), Page (goal, services and prices, offer, FAQs, verify phone, publish, embed code for an existing website, Merchant Centre feed, domain and Website Manager links), Promote (on/off, places, posts a week, schedule, posts and results read-only, request a change), Wallet (refill packs and custom amount through Get4Domain's Razorpay, price list, ledger, tax invoices, low-balance choice, refund request, dispute help). A **LeadSpace-only** vendor (signup at `/register?product=leadspace`, mode add-on `leadspace_only`) sees only this app on a phone-first shell; buying a plan switches the mode off and LeadSpace stays under Marketing and Growth. No invoices, stock, accounts or TeleCRM in LeadSpace-only; the Home and Leads tabs offer the entry paid plan when a vendor has at least `upgradeLeadThreshold` leads in 30 days.

## Admin console (`/admin/leadspace`)

Vendors (queue, page review, regulated review with the promotion switch, suspend, reports from the public, release held), Promotion (approval queue with edit, manual tasks with copy to paste, plans, per-vendor and global kill switches, Get4Domain's own social accounts with encrypted tokens, caps, post log, sitemap task), Prices and rules (price table with history, every rule as a setting, blocked words), Credits (disputes, refunds, packs, refills, reconcile a captured-but-unconfirmed payment, expiry sweep, do-not-contact numbers), Cost per lead (margin alerts against the floor, ad spend entry), WhatsApp number (live status, templates and approval, test-mode outbox, log).

## Settings (all in `g4d_leadspace_settings`, edited in the admin; defaults in `settings.service.ts`)

`dedupeWindowHours` 12, `autoCreditWindowHours` 48, `disputeWindowHours` 48, `otpTtlMinutes` 5, `otpMaxAttempts` 5, `otpPerPhonePerHour` 3, `otpPerDevicePerHour` 8, `otpPerIpPerHour` 20, `lowBalanceThresholdsPaise` [50000, 20000], `marginFloorPercent` 50, `gstPercent` 18, `refundWindowMonths` 12, `expiryMonths` 24, `globalKillSwitch` off, `pagesPerIpPerDay` 5, `blocklistWords`, `channelDailyCaps`, `manualApprovalDays` 14, `vendorSpamOtpPerDay` 60, `refillCustomMinPaise` 99900, `refillCustomMaxPaise` 5000000, `customCreditPercent` 100, `customGstMode` INCLUSIVE, `upgradeLeadThreshold` 10, `retentionMonths` 24. **There are no starting prices in code:** KSM sets them in Prices and rules; until a price exists for an event type the event is delivered free.

## Environment (backend, set on the VM; none is stored in the repo)

`WHATSAPP_PROVIDER=cloud`, `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (until set: test mode, status Awaiting approval); `LEADSPACE_HASH_SALT` (set once and never change: it keys every stored phone hash; falls back to `PLATFORM_SETTINGS_KEY`); `PUBLIC_APP_URL` (page addresses, sitemap, alerts), `PUBLIC_API_URL`; `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (refills; add `https://<api>/leadspace/refill/webhook` as a second webhook for `payment.captured`); `LEADSPACE_SCHEDULER=off` to stop the two-minute publisher and ten-minute promotion sync on a node. Frontend: `NEXT_PUBLIC_API_URL`, `INTERNAL_API_URL` (server-side page fetch), optional `LEADSPACE_BASE_DOMAIN` (e.g. `<slug>.example.page`; needs wildcard DNS and an nginx block; off by default, pages are at `/ls/<slug>`). Social tokens are saved in the admin screen, encrypted with `PLATFORM_SETTINGS_KEY`.

## Decisions taken without asking KSM

See `LEADSPACE_PROGRESS.md` (numbered list) and the final report. Highlights: LEADS purse is a new pair of tables and the AI wallet is untouched; phase 3 was built before phase 2 (capture needs no page); the 12 trades and their templates are data in `templates.ts`; `/ls/<slug>` first, host rewrite behind a switch; the old campaign page keeps serving at `/go/<slug>` until the vendor publishes the migrated LeadSpace page; the 301 redirects are Next.js permanent redirects (HTTP 308, same effect for browsers and search engines) kept in code, so they last until removed; API paths (`/campaigns`, `/domain-campaign`) were not renamed, only what people see and the page and dashboard addresses.

## Known limits (stated, not hidden)

- Customer codes go to real customers only after Meta approves the common number and templates; until then the system is in test mode and the admin sees the codes in the test outbox.
- Social posting to Facebook, Instagram, Telegram and Google Business Profile works through their APIs once KSM connects each account (tokens, page ids) and presses Test connection; none is connected yet. Posting is verified against the providers in tests with stand-ins, not against the live networks. Facebook Groups are manual tasks by design.
- Google Business Profile for a vendor needs the vendor's OAuth grant; the grant screen is not built, so those posts are guided tasks until an admin saves a token for that vendor.
- Results (views, taps) are pulled hourly where an API allows (Facebook Page insights); Instagram, Telegram and Google return none.
- Razorpay refill, webhook and reconcile are verified with a stand-in for Razorpay; the first real payment is part of KSM's VM test (`LEADSPACE_PILOT.md`).
- GST treatment, expiry and refund wording are pending the CA (see compliance pack); they are settings.
- The embed script is tested for syntax and its server calls; a real third-party page was not used.
- Phone numbers are Indian mobiles only.
