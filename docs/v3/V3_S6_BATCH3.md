# V3 Stage 6, Batch 3: Free versus Pro rules, lifecycle, listing-only render, canonical rule, directory visits, seeded sites, requests and orders bridge, terms

Branch `v3-b3` (worktree `C:\Get4Domain\get4domain-b3`), from `origin/v3-b2` `3f9b169`. Dispatch: `docs/v3/stages/V3_DISPATCH/STAGE_06_FREE_PRO_RULES_BATCH_3.md`. The owner rules this batch implements are in `docs/v3/V3_BRIDGE_MODEL.md`. The working log with every test count, gate result and decision is `docs/v3/B3_LOG.md`; this file is the reference for what was built.

Status of everything below: **built and unit-tested; NOT run against staging** (no `.env.staging` in the build environment). The staging integration suites are written and type-checked; the owner runs them (`B3_LOG.md`, "Owner commands").

## 0. Conventions used by every slice

- **Pure core, port, Prisma store, in-memory twin.** Rules live in functions that take the clock and randomness from their caller. Each slice has an abstract store (the port), a Prisma implementation and a twin used by the unit tests. A static test (`b3-isolation.spec.ts`) checks that the cores are pure, that no module reads legacy billing, BOS, commercial, domain-campaign, vendor-payments or menu-gating tables, that no module uses Redis or BullMQ, and that no old product name or rupee price appears in generated text.
- **Queue before transaction.** Every multi-row write waits in a `KeyedQueue` (per vendor or per key) BEFORE `$transaction` opens, so a burst of requests cannot hold every pooled connection. The advisory lock stays as the cross-process guard.
- **Errors.** Every Batch 3 error carries a stable `code` (list in `src/b3-settings/b3-errors.ts`). The exception filter now passes these codes through (it did not before; see 7.3). Body shape:

```json
{ "success": false, "statusCode": 403, "message": "Please accept the current terms to continue.",
  "code": "TERMS_ACCEPTANCE_REQUIRED", "outstanding": [{ "kind": "VENDOR_TERMS", "version": 1 }], "data": null, "timestamp": "2026-11-05T09:00:00.000Z" }
```

- **Success shape** is the platform envelope: `{ "success": true, "statusCode": 200, "message": "Success", "data": { ... }, "timestamp": "..." }`. Examples below show `data` only.
- **Settings.** Texts, limits and timers are editable settings with documented defaults (`src/b3-settings`, registered in the existing settings API). Customer-facing lines are DRAFT defaults, not legal text. No rupee price, no tax rate and no old product name is hard-coded.
- **Role names.** OPS = OPERATIONS and SUPER_ADMIN; SUPER = SUPER_ADMIN only; MARKETING is refused on anything with personal data. "Owner" = the vendor owner (a team member is refused). "Area" = a vendor route behind the `website` area permission.

Migration folders, in order (all additive, RLS on, no policy): `20261110100000_v3_site_removals`, `20261111100000_v3_lifecycle`, `20261112100000_v3_canonical`, `20261113100000_v3_directory_visits`, `20261114100000_v3_seeded_sites`, `20261115100000_v3_requests_orders`, `20261116100000_v3_terms`. Slice 5.1c has no migration (seed only).

---

## 1. Slice 5.1c: Free versus Pro entitlement matrix

**What changed.** Seed `backend-api/prisma/seed/v3-plans.seed.json` only: 26 features and 156 cells became 32 features and 192 cells. 12 existing cells changed, 36 added, no price, tax, discount or plan row touched (digests pinned in `test/free-pro-matrix.spec.ts`).

**Rule (owner rule 5).** Free is an informational listing: no forms, booking, quote, cart, call or WhatsApp button, no leads, no requests. Free sees every Pro capability as `LOCKED_PREVIEW` (an upsell), never `ACTIVE`.

**New feature keys.** `site.cta`, `requests.inbox`, `payments.vendor_methods`, `offers.banners`, `promotion.subdomain` (Pro ACTIVE, Free LOCKED_PREVIEW) and `promotion.custom_domain_addon` (HIDDEN in every plan; granted only by an override with an end date).

**The 12 changed cells (before to after).**

| Plan | Feature | Before | After |
|---|---|---|---|
| handyman_free, professional_free | site.booking | HIDDEN | LOCKED_PREVIEW |
| ecommerce_free | shop.cart | HIDDEN | LOCKED_PREVIEW |
| all three Free plans | leads.platform | LIMITED 50 | LOCKED_PREVIEW |
| all three Free plans | reports.basic | ACTIVE | LOCKED_PREVIEW |
| all three Free plans | ai.credits_included | LIMITED 20 | LOCKED_PREVIEW |

**Decision log.** `shop.products` stays LIMITED 12 on Free ecommerce (a product list without a cart is informational, like the services list). Messaging, TeleCRM and Accounts have no key (gated modules; each adds its key when it arrives). `ecommerce` has no booking at all, so `site.booking` stays HIDDEN on both ecommerce levels.

**Differences from the dispatch / OPEN QUESTIONS.** Free loses 20 AI credits and the basic reports. The dispatch list implies it; the owner should confirm that is wanted.

**Loading it.** `node scripts/seed-v3-plans.js` (dry run by default, `--apply`, staging guard). The seed dry run was NOT RUN; the diff was computed offline.

---

## 2. Slice 5.1d: plan expiry, suspension and deletion (owner rule 9)

### Data dictionary
- `g4d_site_removals` (B3.0b): `vendorId` (PK, FK Vendor), `kind` (`VENDOR_REQUEST`, `STAFF_EMPTY_LISTING`, `SEEDED_REMOVAL`), `reason`, `phoneHash` (keyed), `requestedBy`, `removedAt`. The permanent record that a business is removed; the by-host read looks at it on every request.
- `g4d_account_deletion_requests`: `vendorId`, `status` (`PENDING`, `EXECUTED`; enum `V3DeletionRequestStatus`), `pendingVendorId` (unique, so one open request per vendor), `requestedById`, `verifiedAt`, `executedAt`, `executedById`, `note`.
- `g4d_dnc_register`: `phoneHash` (unique), `reason`, `source`, `at`. **Append-only**: a static test finds no update or delete of it anywhere in `src`.

### Rules
- **Never hide, hold or delete a business.** Only a REMOVED business is hidden (by-host: the uniform 404; directory: 410). A suspended, pending or expired vendor stays live as a Free listing-only site.
- **Effective plan** (pure, in the entitlement engine): ACTIVE gives its plan; GRACE keeps the plan with `graceWarning`; after grace or when cancelled the track's Free plan (unless `downgradeBehaviour` is KEEP_UNTIL_REPLACED for expiry); a SUSPENDED vendor always gets Free and **overrides are ignored while suspended**.
- **A suspended vendor cannot sign in (owner decision, 5 November 2026; existing Batch 2 behaviour, deliberate).** Every vendor route answers 401 while the vendor is SUSPENDED, including with a token issued earlier. The public site is still served and listed, as a Free listing-only site. Staff see the Free state through `GET /v3/admin/vendors/:id/entitlements`. Reinstating makes the same token work again and restores Pro with no re-purchase. The app must not be changed to allow sign-in; `lifecycle.int.spec.ts` asserts all of this and reinstates in a `finally` plus an `afterEach` so a failed assertion cannot leave the vendor suspended.
- Nothing stored is deleted; a renewal restores Pro at once.
- **Two deletion paths only:** (a) the owner's request with a fresh one-time code and a confirmation; (b) staff deletion of an EMPTY listing (no phone, no address detail, no description, no services, no media) while no paid plan runs.
- **Retained after a removal:** plan invoices and payment records, terms acceptances, audit rows, the removal record, the hashed phone. Personal-data erasure beyond this is not built.

### API contract
| Route | Who | Notes |
|---|---|---|
| `GET /v3/admin/vendors/:id/lifecycle` | OPS | status, plan, grace, removed |
| `POST /v3/admin/vendors/:id/lifecycle/convert-to-free` | OPS | body `{ "reason": "..." }` (5 to 300 chars) |
| `POST .../restore-pro` | OPS | `{ reason, planKey?, termMonths? }` |
| `POST .../extend-grace` | OPS | `{ reason, days }` (1 to `graceExtendMaxDays`, default 30) |
| `POST .../suspend`, `POST .../reinstate` | OPS | `{ reason }`; writes only `Vendor.status` |
| `POST .../delete-empty-listing` | OPS | 409 `LIFECYCLE_NOT_EMPTY` lists what exists |
| `GET /v3/admin/account-deletions`, `GET .../:id`, `POST .../:id/execute` | OPS | the queue and the permanent execution |
| `POST /v3/me/account/deletion-request` | Owner, 10 per hour | three steps below |

Deletion request, three calls to the same route:
1. `{}` sends a 6-digit code (sandbox SMS) and returns `{ "step": "CODE_SENT", "warning": "...", "maskedPhone": "******3210", "expiresInMinutes": 10 }`.
2. `{ "code": "123456" }` without `confirm` is refused: 400 `DELETION_CONFIRM_REQUIRED` with the warning again.
3. `{ "code": "123456", "confirm": true }` creates one open request: `{ "step": "REQUESTED", "warning": "...", "requestId": "...", "status": "PENDING" }`. Asking again while a request is open returns that same request. Every wrong, expired, used or locked code is the same `DELETION_CODE_INVALID`.

### Decision log
5 November 2026 (owner): suspension blocks sign-in; the site stays served and listed as Free listing-only; reinstating restores Pro without a re-purchase. Do not allow sign-in for a suspended vendor.
`chooseEffectivePlan` was extracted from `resolveEntitlements` and reuses the slice 5.1 grace arithmetic. Suspend was added although the dispatch did not name it (5.14 report handling needs it). Restore and convert go through the existing `SubscriptionsService.assignPlan` so the ledger records them. The settings registry (`b3-settings`) was created here.

### OPEN QUESTIONS
- **Account-deletion request by a suspended vendor.** Because a suspended vendor cannot sign in, they cannot reach `POST /v3/me/account/deletion-request`. Proposed: a support route (the vendor writes to support, staff verify identity and create the request on their behalf). Whether this is allowed, and what identity check it needs, is for counsel to decide. Nothing is built for it.

### Differences from the dispatch
The do-not-contact register is created here, one slice earlier than 5.13a lists it, because a removal writes to it; 5.13a reuses it. Added: deletion of an empty listing is refused while a paid Pro plan runs.

---

## 3. Slice 5.4b: listing-only render and CTA gating

### Rules
- `RenderEntitlements.callsToAction = site.cta ACTIVE`. When false the renderer draws none of the call-to-action slots (action, bottom-nav, enquiry-form, whatsapp-float, booking, cart, search, share-qr). The phone number is plain text; no `tel:`, no `wa.me`, no form, no button, no e-mail address.
- `stripCtas` runs after a listing-only render as defence in depth (also for a custom theme template).
- **Platform lines** come from settings, the renderer invents none: "Listed on Get4Domain" (`listedOnLineText`), the footer bridge line (`siteFooterBridgeText`), the seeded notice (`seededNoticeText`, owner wording, with working `/claim` and `/remove` links) on SEEDED and INVITED sites, and the customer disclosure inside any form or cart (`customerDisclosureText`).
- **Serve time.** A stored Pro page is served stripped (same bytes otherwise, new ETag) while `site.cta` is not ACTIVE (lapsed, expired or suspended vendor); when Pro returns the original bytes are served again. The stored publication is never modified.
- **Seeded SEO.** A seeded site is noindex unless `seededSiteIndexingMode` is `QUALITY` and the quality check passes (default `OFF`).

### API contract
No route is added. Behaviour change on `GET /v3/public/site/by-host` (HTML pages): see the rules above. Kit change in `themes/lib/render.mjs`, `vocabulary.mjs`, `lint.mjs`, `fixtures`, and `BOLT_BRIEF.md` (regenerated).

### Decision log / differences
One entitlement resolve per HTML page request (engine cache 30 s, dropped on every write). The Dockerfile build context is unchanged (it cannot see `../themes`); `Dockerfile.with-themes` (context = repository root) is the one to use for an image that renders. Legacy mode (`siteDraftBuilderMode` legacy) does not reach this code.

**OPEN QUESTION (Bolt Amendment 02).** The five Standard themes place CTA slots inside sections; on a listing the slot draws nothing, so a section can keep its heading with an empty body. Guarding those sections with `data-g4d-if="entitlements.callsToAction"` is a theme change and is Bolt's.

---

## 4. Slice 5.6b: canonical rule and the custom-domain promotion add-on (owner rule 4)

### Data dictionary
`g4d_site_settings.canonicalHost` (nullable TEXT): the host the published pages were built for. Chosen over a new table because that table already has one row per vendor. Site events: type `CANONICAL_SWITCHED` (the event type is a free string; no enum change).

### Rules
- The subdomain is canonical by default. An ACTIVE verified custom domain serves the same site (no redirect) and declares the subdomain canonical.
- Only while the add-on is active (entitlement `promotion.custom_domain_addon`, granted only by an override with an end date) AND a custom domain is ACTIVE is the custom domain canonical and the subdomain 301s to it. The directory still links the subdomain.
- A plan change never stops a custom domain from serving.
- Only canonical URLs appear in the sitemap.
- **Controlled switch** (`CanonicalSwitchService.switchFor`, idempotent): rebuilds and republishes first (only if the vendor already has a published site), then records the change (before, after, reason `ADDON_STARTED` / `ADDON_ENDED` / `DOMAIN_CHANGED`) as a site event plus an audit row in one transaction. A failed rebuild records nothing; the next call retries. A 10-minute cron (`canonicalSwitchTickEnabled`, default false) re-checks vendors with a stored canonical host.

### API contract
| Route | Who | Notes |
|---|---|---|
| `GET /v3/admin/vendors/:id/canonical` | OPS | canonical host, kind, serve hosts, reason, add-on state |
| `POST /v3/admin/vendors/:id/custom-domain-addon` | OPS | `{ "reason": "...", "endsAt": "2027-02-01T00:00:00.000Z" }` (end date must be in the future); goes through the existing override service, then switches |
| `POST /v3/admin/vendors/:id/custom-domain-addon/end` | OPS | `{ "reason": "..." }` |

Public by-host: the page carries `canonicalHost`; the response sets `X-Canonical-Host`; a redirect is the existing 301 with `Location`.

### Differences from the dispatch
Thin routes over the existing override service instead of loosening the SUPER_ADMIN-only override route. Eight Batch 2 tests that encoded "an ACTIVE custom domain is primary whenever the plan allows it" were rewritten, not weakened (listed in `B3_LOG.md`).

---

## 5. Slice 5.7b: the directory as a search engine

### Data dictionary
- `g4d_directory_visit_daily`: per business per UTC day, `count`, `searchCount`.
- `g4d_directory_visit_refs`: SHA-256 of a 24-byte reference, `businessId`, `expiresAt`, `usedAt`. The reference itself is never stored.

### Rules
- The directory has NO form, callback or lead endpoint; its only action is Visit site. Static tests keep it that way.
- Every business returns `siteUrl` (its SUBDOMAIN address, never the custom domain), `siteState` (`SEEDED`, `CLAIMED_FREE`, `PRO`) and `badges` (`VERIFIED` only for a claimed Pro business). Sponsored items stay labelled; organic order is unchanged.
- The beacon counts with ONE atomic `INSERT ... ON CONFLICT DO UPDATE`; a repeat from the same network inside `directoryVisitDedupeSeconds` (default 30) is not counted twice (keyed hash held in memory only).
- The visit reference expires after `directoryVisitRefExpiryMinutes` (default 120) and attributes ONE later request, only for its own business; unknown, expired, used, foreign and malformed are the same `false`. Slice 5.14 calls `DirectoryVisitService.attribute`.

### API contract
| Route | Who | Notes |
|---|---|---|
| `POST /v3/directory/businesses/:slug/visit` | public, 60 per minute per IP | body `{ "fromSearch": true }` (optional) |
| `GET /v3/me/directory/stats?days=30` | Owner, any plan | 1 to 90 days, zero-filled |
| `GET /v3/admin/directory/visits?from&to&vendorId&page` | OPS | per business totals |

```json
POST /v3/directory/businesses/asha-plumbing/visit   { "fromSearch": true }
-> data: { "ref": "mX3...", "expiresAt": "2026-11-05T11:00:00.000Z", "url": "https://asha-plumbing.get4domain.com?src=dir&ref=mX3..." }
```
`Cache-Control: no-store`, no cookie. A business with no vendor or no subdomain gets the uniform 404.

### Differences / OPEN QUESTIONS
A directory business with no vendor or no subdomain has `siteUrl: null` (rows made by staff before 5.13a). The directory moderation status `SUSPENDED` (a Batch 2 staff action) still hides a listing; it is outside rule 9's two paths and was left alone.

---

## 6. Slice 5.13a: seeded sites

### Data dictionary
`g4d_seeded_sites` (`vendorId` unique, `directoryBusinessId` unique, `lifecycle` SEEDED / INVITED / CLAIMED_FREE / PRO / REMOVED, `sourceKind`, `sourceNote`, `publicFactsConfirmed`, `phoneHash`, `emailHash`, `nameKey`, outreach fields, consent `ownerAgreedToContact` / `At` / `By`, `batchId`, `removedAt`), `g4d_seeded_batches`, `g4d_seeded_outreach_log`; reuses `g4d_dnc_register`.

### Rules
- A seeded vendor is a normal shell with the placeholder login `site+seed-<24hex>@sites.get4domain.invalid` and an unusable password. No Vendor column was added.
- The slice 5.3 runner has a SEEDED mode (4 steps, no claim link, no invite). The 198 existing provisioning tests pass unchanged.
- Every create needs a category known to the theme kit, a public phone, a source and the staff checkbox `publicFactsOnly`. Duplicates (phone hash, e-mail hash, name plus city; including removed sites and earlier rows of the same batch) are refused and cannot be overridden. A phone on the register is refused (`SEEDED_DNC`); only SUPER_ADMIN with a reason may override that, audited.
- Dry run creates nothing (only a `DRY_RUN` batch record); apply creates the rows that passed; a re-run creates nothing.
- Claim link: needs recorded consent and a phone not on the register; handed to staff ONCE in the response, never emailed, logged or audited. Lifecycle after that is DERIVED from the directory profile and the running paid plan.
- Removal ("do not contact" or explicit, reason required) runs the same permanent removal as 5.1d, adds the phone to the register, keeps every row, and is final.
- `seededSiteIndexingMode` changes only through its own SUPER_ADMIN route with a reason.

### API contract (15 staff routes under `/v3/admin/seeded-sites`)
| Route | Who |
|---|---|
| `GET /`, `GET /:id` | OPS and MARKETING (non-personal fields only) |
| `POST /` | OPS |
| `POST /batches/dry-run`, `POST /batches/apply` | OPS |
| `GET /register`, `POST /register` | OPS |
| `PUT /:id/outreach`, `POST /:id/calls`, `PUT /:id/consent` | OPS |
| `POST /:id/claim-link`, `POST /:id/claim-link/revoke` | OPS |
| `POST /:id/removal` | OPS |
| `GET /indexing-mode` | OPS |
| `PUT /indexing-mode` | SUPER, `{ "mode": "QUALITY", "reason": "..." }` |

```json
POST /v3/admin/seeded-sites
{ "businessName": "Asha Plumbing", "category": "plumber", "city": "Chennai", "area": "Adyar", "phone": "9876543210", "sourceKind": "PUBLIC_LISTING", "publicFactsOnly": true }
-> data: { "id": "...", "vendorId": "...", "lifecycle": "SEEDED", "outreachStatus": "NOT_CONTACTED" }
```
CSV batch body: `{ "csv": "businessName,category,city,area,phone,sourceKind,publicFactsOnly\n...", "fileName": "list.csv" }`; header names match ignoring case and spaces; 1 MB and `seededBatchMaxRows` (200) caps. No public route is added.

### Decision log
Extra columns `phoneHash`, `emailHash`, `nameKey`, `removedAt` for duplicate detection and removal. The staging cleanup cannot find seeded vendors by e-mail, so the integration suite removes its own `V3TEST` vendors; register rows are never deleted.

---

## 7. Slice 5.14: requests and orders bridge (Pro sites only)

### 7.1 Data dictionary (17 tables, 16 enums, migration `20261115100000_v3_requests_orders`)
| Table | Purpose |
|---|---|
| `g4d_requests` | one row per visitor request or order request: kind (`ENQUIRY`, `APPOINTMENT`, `QUOTE`, `PRODUCT_ENQUIRY`, `ORDER_REQUEST`, `ORDER`), status (`RECEIVED`, `DELIVERED`, `SEEN`, `RESPONDED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CLOSED`, `EXPIRED`, `SPAM`), customer name, phone, optional e-mail, validated payload, source, utm, idempotency key, spam score, first-seen and first-response times, expiry, links |
| `g4d_request_events` | append-only history (type, actor CUSTOMER / VENDOR / STAFF / SYSTEM, channel, delivery result, meta) |
| `g4d_request_consents` | text version, text hash, address hash, the three consent booleans |
| `g4d_request_tracking` | `tokenHash` (unique per request), `expiresAt`; the token is never stored |
| `g4d_vendor_payment_methods` | kind (`OWN_GATEWAY`, `UPI`, `PAY_ON_DELIVERY`, `PAY_AT_VISIT`, `BANK_TRANSFER`), label, sealed config and webhook secret (cipher, iv, tag), `last4`, status (`UNVERIFIED`, `ACTIVE`, `DISABLED`), `verifiedAt` |
| `g4d_orders`, `g4d_order_items` | gap-free `orderNo` per vendor, status, payment mode (`ONLINE`, `COD`, `AT_VISIT`, `MANUAL`), amount in paise, shipping and tracking JSON; items snapshot name, qty, unit price, tax |
| `g4d_vendor_payment_events` | webhook inbox, unique per vendor and provider event id, signature result, REDACTED payload, result; append-only |
| `g4d_vendor_invoices` | gap-free series per vendor, snapshot of the vendor's legal name, GSTIN, address and tax lines, `ISSUED` or `VOID`; no PDF |
| `g4d_vendor_counters` | the per-vendor, per-kind counter behind both series |
| `g4d_stock_levels`, `g4d_stock_reservations` | on-hand and reserved; timed reservations |
| `g4d_offers` | banner or coupon, percent or flat, minimum, window, usage limit |
| `g4d_message_outbox` | sandbox outbox: channel, template, hashed and masked recipient, sender route, status |
| `g4d_message_suppressions` | STOP and unsubscribe (hash, channel) |
| `g4d_reports`, `g4d_blocklist` | reports about sites; keyed-hash block entries |

### 7.2 Rules
- **We pass requests to the vendor; we never receive or hold a customer's money.** Online payment goes only to the vendor's own gateway or UPI. Nothing calls a real gateway, SMS, WhatsApp or e-mail provider (fake gateway port; sandbox adapters only).
- **`paymentReadiness`** (owner rule 7): an ACTIVE verified own gateway or UPI gives `FULL_CHECKOUT`; only cash-style methods give `ORDER_REQUEST_ONLY`; none gives `ENQUIRY_ONLY`.
- **Public surface.** The site must be Pro with `site.cta` and `requests.inbox` ACTIVE and the vendor not suspended or removed; otherwise ONE uniform 404 (Free, seeded, unknown, suspended, removed). Consent for the CURRENT text version is required. Rate limited per IP, idempotent by key, `no-store`, no cookie.
- **Spam.** Score from blocklist, honeypot, duplicate (window `requestDuplicateWindowMinutes`), phone rate, IP rate, links. At or above `spamScoreOtpThreshold` (50) a phone code is asked (slice 5.7 OTP core); at or above `spamScoreBlockThreshold` (90) the request is stored as SPAM and nothing is delivered.
- **Tracking token.** 32 random bytes, hash stored, expires after `trackingTokenExpiryDays` (60). A wrong, malformed and expired token are the same 404.
- **State machine.** `RECEIVED` / `DELIVERED` / `EXPIRED` are set by the system only. First fetch by the vendor marks `SEEN`. Unanswered requests expire after `requestExpiryDays` (30); a responded request does not expire.
- **Webhook.** HMAC-SHA256 hex of the RAW body with that vendor's own webhook secret in `x-g4d-signature`. Duplicate event id answers 200 `duplicate: true`. A mismatch of amount or currency never marks an order PAID (review flag). Exactly one PAID, one stock commit and one invoice under double delivery.
- **Stock.** Orders reserve for `stockReservationMinutes` (15); the cron releases expired reservations.
- **Secrets** are sealed with the platform key, write-only, never returned, never logged, and are on the redaction list.
- **Messaging** is sandbox only (`messagingMode` accepts only `sandbox`). Every message names the business and, where required, carries the bridge line. Routing falls back WhatsApp, SMS, e-mail, dashboard, honouring suppressions.

### 7.3 API contract (33 routes)
**Public (5)**
| Route | Notes |
|---|---|
| `POST /v3/public/sites/:host/requests` | kinds ENQUIRY, APPOINTMENT, QUOTE, PRODUCT_ENQUIRY |
| `POST /v3/public/sites/:host/orders` | cart to order; the answer says which payment step applies |
| `GET /v3/public/requests/track/:token` | status, the business's replies, the bridge statement |
| `POST /v3/public/reports` | always the same 202 |
| `POST /v3/payments/vendor/:vendorId/:methodId` | vendor-gateway webhook; plain 401 on a bad signature |

```json
POST /v3/public/sites/asha.get4domain.com/requests
{ "kind": "ENQUIRY", "name": "Meena R", "phone": "98765 43210", "payload": { "message": "Do you fix geysers?" },
  "consent": { "contactByBusiness": true, "contactByPlatform": false, "marketing": false, "textVersion": 1 },
  "idempotencyKey": "k-9f3c0a7e-2b1d-4c55" }
-> data: { "accepted": true, "status": "DELIVERED", "reference": "...", "trackingUrl": ".../track/<token>" }

POST /v3/public/sites/asha.get4domain.com/orders   { ...same customer and consent..., "items": [{ "productRef": "sku-1", "qty": 1 }], "shipping": { "address": "12 Main Road", "city": "Chennai", "pincode": "600001" }, "couponCode": "TEN10", "payWith": "COD" }
-> data: { "orderNo": 1, "totalPaise": 150000, "paymentMode": "COD", "readiness": "ORDER_REQUEST_ONLY", "paymentStep": { "step": "PAY_ON_DELIVERY" }, ... }
```
(`payWith` is `ONLINE`, `COD`, `AT_VISIT` or `MANUAL`. `paymentStep.step` is `PAY_ONLINE_WITH_VENDOR_GATEWAY` (with the vendor's gateway reference data in `checkout`), `PAY_ON_DELIVERY`, `PAY_AT_THE_VISIT` or `PAY_AS_THE_BUSINESS_ARRANGES`.)

**Vendor, area `website` (owner and permitted team) (11)**: `GET /v3/me/requests` (filters `status`, `kind`, `q`, dates, paging), `GET /v3/me/requests/:id`, `POST /v3/me/requests/:id/respond` (`{ "message": "...", "status": "RESPONDED" }`), `POST /v3/me/requests/:id/link` (records ids only; CRM and booking arrive later), `GET /v3/me/orders`, `GET /v3/me/orders/:id`, `PUT /v3/me/orders/:id/status` (packed, shipped with tracking, delivered, cancelled), `PUT /v3/me/stock/:productRef`, `GET /v3/me/offers`, `POST /v3/me/offers`, `PUT /v3/me/offers/:id`.

**Vendor, OWNER ONLY (9)**: `GET /v3/me/payment-methods`, `POST`, `PUT /:id`, `DELETE /:id`, `POST /:id/test`; `POST /v3/me/orders/:id/refund` (a recorded fact, no provider call); `POST /v3/me/orders/:id/invoice`; `GET /v3/me/invoices`; `POST /v3/me/invoices/:id/void`.

```json
POST /v3/me/payment-methods   { "kind": "OWN_GATEWAY", "label": "My gateway", "details": "rzp_vendor_key_1234", "webhookSecret": "..." }
-> data: { "id": "...", "kind": "OWN_GATEWAY", "label": "My gateway", "status": "UNVERIFIED", "last4": "1234", "hasGatewayDetails": true }
```
A Free vendor gets `403 FEATURE_LOCKED` (with `feature` and `upsellText`) on every vendor route here.

**Staff (8, OPS; MARKETING refused)**: `GET /v3/admin/requests`, `GET .../:id`, `GET /v3/admin/message-outbox`, `GET /v3/admin/reports`, `POST .../reports/:id/handle` (`{ "status": "ACTIONED", "suspendVendorId": "...", "reason": "..." }` suspends the vendor and stops their public forms and checkout at once), `GET /v3/admin/blocklist`, `POST /v3/admin/blocklist` (`{ "kind": "PHONE", "value": "...", "reason": "..." }`), `DELETE /v3/admin/blocklist/:id`.

Error codes: `REQUEST_INVALID` (400, with `errors`), `REQUEST_NOT_FOUND`, `REQUEST_STATE_INVALID`, `PAYMENT_METHOD_INVALID`, `ORDER_INVALID`, `STOCK_UNAVAILABLE`, `OFFER_INVALID`.

### 7.4 Decision log
Extra tables beyond the dispatch list: counters, stock levels and reservations, suppressions, reports, blocklist. A 5-minute cron expires requests, releases reservations and (only when `requestNudgeEnabled`, default false) queues a nudge. Settings added: `customerConsentText`, `customerConsentVersion`, `vendorInvoicePrefix` (`INV-`), `requestDuplicateWindowMinutes`.

**Bug found and fixed.** The exception filter forwarded only a fixed list of codes and no Batch 3 code was on it, so no client would have seen `code` on any Batch 3 error. `B3_ERROR_CODES` is on the list now, and plain-string `errors` and `{ kind, version }` `outstanding` pairs pass through.

### 7.5 Differences from the dispatch / OPEN QUESTIONS
1. The catalogue holds no tax rate per item, so an order line carries `taxPercent 0` and the invoice snapshot takes the tax lines from the vendor profile. **Which rate applies to a product is the owner's decision.**
2. The 10 new vendor-carrying models are classified platform-only in `tenant-model-registry.spec.ts`: every store call carries the vendor id in its WHERE (tested cross-tenant), and public routes find the vendor from the host where no tenant exists. Moving them to the tenant-scoped client is an owner decision.
3. The gateway is a fake. No live mode is wired.
4. Gap-free numbering, stock concurrency and the webhook happy path are tested on the in-memory twin only; `requests.int.spec.ts` covers intake, isolation, role refusals, secrets and webhook authentication on staging (NOT RUN).

---

## 8. Slice 5.15: terms documents and acceptances

### 8.1 Data dictionary (migration `20261116100000_v3_terms`)
- `g4d_terms_documents`: `kind` (`VENDOR_TERMS`, `ACCEPTABLE_USE`, `DATA_PROCESSING`, `REFUND_POLICY_TEMPLATE`, `GRIEVANCE`, `PRIVACY`, `COOKIE`, `CUSTOMER_TERMS`), `version` (unique with kind), `title`, `status` (`DRAFT`, `PUBLISHED`, `RETIRED`), `bodyMarkdown`, `changeNote`, `publishedAt`, `publishedBy`, `createdBy`.
- `g4d_terms_acceptances`: `vendorId` or `customerRequestId` (a CHECK requires exactly one), `userId`, `documentId` (FK, restrict), `kind`, `version`, `acceptedAt`, `ipHash`, `userAgentHash` (keyed hashes, never raw). Unique per vendor and document.
- **Immutable.** A `BEFORE UPDATE OR DELETE` trigger refuses every update and every delete, except the cascade of a tenant row that is already gone (a hard-deleted staging test vendor). The port and service have no update or delete of an acceptance (tested by listing the methods and grepping the source).

### 8.2 Rules
- **Seed.** `node scripts/seed-v3-terms.js` (dry run by default, `--apply`, staging guard): one DRAFT version 1 per kind that has no row, body "To be supplied by counsel". It cannot publish and never touches an existing row.
- **Publishing.** SUPER_ADMIN only, audited, a change note of 5 or more characters, only a DRAFT. A body that is the placeholder (in any dress: heading, list mark, case, spacing) or empty is refused with 422 `TERMS_PLACEHOLDER`. Publishing retires the previous published version of that kind in the same transaction.
- **The guard** `requireAcceptance(vendorId, kinds)`: the latest PUBLISHED version of each kind must be accepted, otherwise 403 `TERMS_ACCEPTANCE_REQUIRED` naming what waits. **A kind with nothing published asks for nothing.** A new published version makes acceptance required again.
- **Where it applies.** (a) `PublishService.publish` when `site.cta` is ACTIVE, for VENDOR_TERMS, ACCEPTABLE_USE and DATA_PROCESSING; (b) setting a payment method ACTIVE (same three); (c) `AccountSetupGrantService.consume` for VENDOR_TERMS, before the grant is spent (`acceptTerms: true` records it; otherwise 403 and the grant stays usable). Each is an optional injection: without the module nothing is checked.
- **Session flag.** `termsAcceptanceRequired` (boolean) on the sign-in `user` object and on `GET /me` for vendor and vendor-team sessions, not for staff; a failure of the flag never blocks a sign-in.

### 8.3 API contract (9 routes)
| Route | Who |
|---|---|
| `GET /v3/public/terms/:kind` | public, latest PUBLISHED, `Cache-Control: public, max-age=300`; a draft or unknown kind is the same 404 |
| `GET /v3/public/terms/:kind/versions` | public; published and retired, no text |
| `GET /v3/me/terms` | Owner |
| `POST /v3/me/terms/accept` | Owner |
| `GET /v3/admin/terms?kind&status`, `GET /v3/admin/terms/:id` | SUPER |
| `POST /v3/admin/terms/kinds/:kind/drafts`, `PUT /v3/admin/terms/:id`, `POST /v3/admin/terms/:id/publish` | SUPER |

```json
GET /v3/me/terms
-> data: { "acceptanceRequired": true,
     "documents": [{ "kind": "VENDOR_TERMS", "version": 2, "title": "Vendor terms", "published": true, "accepted": false }, ...],
     "outstanding": [{ "kind": "VENDOR_TERMS", "version": 2 }] }

POST /v3/me/terms/accept   { "documents": [{ "kind": "VENDOR_TERMS", "version": 2 }] }
-> data: { "accepted": 1, "acceptanceRequired": false }       (a stale version is 409 TERMS_STATE_INVALID; nothing is recorded)

POST /v3/admin/terms/<id>/publish   { "changeNote": "Added the data processor list" }
-> data: { "id": "...", "kind": "DATA_PROCESSING", "version": 2, "status": "PUBLISHED", "placeholder": false, ... }
```
Error codes: `TERMS_NOT_FOUND` (404), `TERMS_PLACEHOLDER` (422), `TERMS_STATE_INVALID` (409 / 400), `TERMS_ACCEPTANCE_REQUIRED` (403).

### 8.4 Decision log
No delete route for documents. The audit row records kind, version and change note, never the legal text. `OtpPepper` keys the address and agent hashes. The three guard points were wired as optional injections so existing flows and tests are unchanged.

### 8.5 Differences from the dispatch / OPEN QUESTIONS
1. **Guard (c).** The set-password endpoint does not exist yet (slice 5.7 returns the grant and says the endpoint is later). The claim guard is built into `AccountSetupGrantService.consume`, which that endpoint must call with `acceptTerms`; nothing calls it today.
2. Nothing published asks for nothing. That is deliberate (the platform must not lock itself behind text counsel has not supplied) but it also means the guards do nothing until staff publish; the owner should confirm.
3. Customer acceptances (`customerRequestId`) are supported by the schema and trigger, but no route writes them; 5.14's consent record is its own table.
4. The immutability trigger could not be executed in the build environment; `terms.int.spec.ts` checks it on staging (NOT RUN). If the trigger SQL were wrong, the failure direction is safe: deletes would be blocked, never allowed.

---

## 9. Gated work that was NOT started

5.5 Website Manager APIs, 5.8 SEO Manager and SEO Tasks, 5.9 Connections and Google sync, 5.10 Reports, 5.12 Social publishing, the rest of 5.13 (act on behalf, onboarding queue), CRM, TeleCRM, booking calendars, Accounts, live messaging, live gateways, registrar and certificate automation, the Pro theme importer, the pricing scheme change. No price row was changed.
