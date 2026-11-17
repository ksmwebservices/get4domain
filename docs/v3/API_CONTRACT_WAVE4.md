# API contract, Wave 4 (for the front-end slices)

Every answer is wrapped by the common interceptor: success `{ success, statusCode, message, data, timestamp }`; an error carries `code` (and `details` where noted). Money is **integer paise**; display prices exclude GST. Dates are ISO strings. Nothing here was applied to a database; the three new migrations are written, not applied.

Roles: "ADMIN" means the staff roles ADMIN and SUPER_ADMIN. "SUPER_ADMIN only" means ADMIN is refused too. Every other staff role, a business owner, a partner and an anonymous caller are refused (403, or 401 when not signed in).

## W1. Directory host (no new route; changed output)

With the environment value `DIRECTORY_PUBLIC_BASE_URL` set (for example `https://directory.example.com`), the directory output uses that host and **no `/directory` prefix**: the page model (`canonical`, breadcrumbs, pagination, JSON-LD urls), `GET /v3/directory/sitemaps/index.xml`, the chunks, `GET /v3/directory/robots.txt` (the `Sitemap:` line), `llms.txt`, the click-out and backlink urls and the badge embed. The brand ("Get4Domain": first breadcrumb, the home `WebSite` JSON-LD, the `publisher`, the backlink-block `brand.href`) stays on the **main** origin (`publicAppUrl`). With the value unset nothing changes: the main origin and the `/directory` prefix. `directoryPagesIndexable` is still OFF by default and still gates the sitemap and robots.

## W2. Held payments (ADMIN)

A payment the gateway reported whose amount or currency did not match its order, or that arrived for a closed order, is an order in status `REVIEW` ("held"). No refund is ever made here: refunds are done in the gateway dashboard.

### GET /v3/admin/billing/held-payments
Query: `page`, `pageSize` (max 100), `vendorId`, `gateway` (`razorpay`|`cashfree`), `from`, `to` (days, `YYYY-MM-DD`, by the day the payment was held). `data`: paged `{ items, total, page, pageSize }`, each item:
`{ id, vendorId, gateway, status:"REVIEW", heldReason:"AMOUNT_MISMATCH"|"CURRENCY_OR_LATE_PAYMENT", expectedTotalPaise, amountSeenPaise|null, currency, providerOrderId|null, gatewayPaymentId|null, heldAt, resolution:null, resolvedBy:null, resolvedAt:null, note:null }`.

### GET /v3/admin/billing/held-payments/:id
`data`: the same item. A payment already resolved stays readable (`resolution:"ACCEPTED"|"REJECTED"`, `resolvedBy`, `resolvedAt`, `note`). Any other order: 404 `HELD_PAYMENT_NOT_FOUND`.

### POST /v3/admin/billing/held-payments/:id/resolve
Body `{ action:"ACCEPT"|"REJECT", note (3 to 300 chars, required), verifiedAmountPaise (ACCEPT, whole paise), gatewayPaymentId (ACCEPT, 3 to 80 chars) }`.
- ACCEPT: allowed only when `verifiedAmountPaise` equals the order total including GST, to the paise. One transaction: plan activated, invoice made, audit row. `data`: `{ status:"PAID", outcome:"ACCEPTED", invoice:{number} }`. The same call again: `outcome:"ALREADY_ACCEPTED"`, nothing changes.
- REJECT: the order becomes `FAILED` with the note; the vendor is told through the mail port (flag OFF by default, so the message stays pending). `data`: `{ status:"FAILED", outcome:"REJECTED", invoice:null, mail:"PENDING"|"SENT"|"FAILED"|"NO_ADDRESS" }`. Again: `outcome:"ALREADY_REJECTED"`.
Errors: 400 `HELD_PAYMENT_INVALID` (`details.fields` names each bad field), 409 `HELD_AMOUNT_MISMATCH` (`details.expectedTotalPaise`), 409 `HELD_ALREADY_RESOLVED` (accepted after rejected, or the reverse), 404/409 `HELD_PAYMENT_NOT_FOUND` (not held).

## W3. Removed routes

The four discount-rule routes are **retired** (no discounts in version 3): `GET`, `POST /v3/admin/discount-rules` and `PUT`, `DELETE /v3/admin/discount-rules/:id` no longer exist (404). The tables, migrations and the seed file are untouched; no checkout reads them. The tax-rate routes are unchanged.

## W4. Commission adjustment (changed output)

A ledger line has two new fields: `kind` (`"COMMISSION"` | `"ADJUSTMENT"`) and, on an adjustment, `adjustsLineId`. When a payment is reversed after its commission line was **paid out**, the line stays `PAID` (flagged) and one separate `ADJUSTMENT` line is made: `amountMinor` negative, status `ACCRUED`, flagged. At the partner's next month close it is netted (status `APPROVED`, its `month` becomes the closing month, so that month's payout holds it); it waits (carried forward) when netting it would leave the partner with nothing above zero, or when the partner already has a payout for that month. Closing again is safe.
- `GET /v3/admin/commission/ledger` items add `kind`, `adjustsLineId`. `GET /v3/admin/commission/ledger/export.csv` has a new second column `kind`, and a negative amount reads `-1500.00`.
- `POST /v3/admin/commission/months/:month/close` (ADMIN): each `partners[]` entry adds `adjustmentMinor` (netted now, 0 or negative) and `carriedMinor` (waiting, 0 or negative).
- `GET /v3/partner/commission` items add `kind`. A partner sees an adjustment as a negative line; never the internal note.

## W5. Partner portal vendor state (changed output)

`GET /v3/partner/vendors` items: `{ businessName, state, referredAt }`. `state` is the state of the business address; when the address has none, the STATE above the business's place in the directory tree; otherwise `null`. Cleaned and at most 60 characters. No district or city is ever shown.

## W6. Gateway credentials (SUPER_ADMIN only, write-only)

The owner enters the gateway keys in the admin app. Stored encrypted at rest; **no route ever returns a value**. Checkout and the webhooks read the stored keys first and fall back to the server environment. Going live still needs the admin setting `live`, the flag `PLAN_PAYMENTS_LIVE_ENABLED=true` and a complete set of live keys. Business verification (KYC) is done on the gateways' own sites.

### GET /v3/admin/payment-gateway/credentials
`data`: four entries, one per gateway and mode: `{ gateway:"razorpay"|"cashfree", mode:"test"|"live", present:boolean, setBy:string|null, setAt:string|null, keyIdLast4:string|null }`. `keyIdLast4` is at most the last 4 characters of the key id (or app id), only when it is long enough, otherwise null. Nothing else.

### PUT /v3/admin/payment-gateway/credentials/:gateway/:mode
`:gateway` is `razorpay` or `cashfree`, `:mode` is `test` or `live`. The full set replaces the stored one.
Body, Razorpay: `{ keyId, keySecret, webhookSecret }` (the key id starts with `rzp_test_` for test and `rzp_live_` for live). Cashfree: `{ appId, secretKey }`. Each value 6 to 200 characters with no spaces or line breaks.
`data`: the status entry above (never a value). Errors: 400 `GATEWAY_CREDENTIALS_INVALID` (`details.fields` names each bad field, never a value; also for an unknown gateway or mode), 503 `GATEWAY_CREDENTIALS_UNAVAILABLE` (the server has no encryption key). Audited with the field names only.

### DELETE /v3/admin/payment-gateway/credentials/:gateway/:mode
Removes the stored set (the environment then applies, if it has keys). `data`: the status entry (`present:false`). Clearing nothing changes nothing and is not audited.

`GET`/`PUT /v3/admin/payment-gateway` (the chosen gateway and mode) now counts a stored complete set as "keys present" in `configured` and when choosing `test` or `live`.

## W7. GST rate (SUPER_ADMIN writes; OPERATIONS and ADMIN read)

The rate is the row of the tax table with the latest effective date that has started (the same selection checkout, the wallet refill and the public pricing already use). A change adds a new row; older rows are never edited or removed by this setting. An order keeps the rate in its own quote. Nothing is seeded or hard-coded in the v3 billing path: with no row, `inForce` is `null`.

### GET /v3/admin/gst-rate
`data`: `{ inForce:{ name, ratePercent, effectiveFrom }|null, upcoming:[{ id,name,ratePercent,active,effectiveFrom }], history:[same, newest first] }`.

### PUT /v3/admin/gst-rate (SUPER_ADMIN only)
Body `{ ratePercent (0 to 100, at most 3 decimals), effectiveFrom ("YYYY-MM-DD", today in India time or later; omitted means now), reason (3 to 300 chars) }`. `data`: `{ changed:boolean, inForce, upcoming, history }`. Idempotent: the same change again, or a rate already in force from that moment, gives `changed:false`. Errors: 400 `GST_RATE_INVALID` (`details.fields`), 409 `GST_RATE_EXISTS` (a different rate already starts on that day). Audited with the reason. The older generic `PUT`/`DELETE /v3/admin/tax-rates/:id` routes are unchanged.

## W8. TDS on commission payouts

### Setting `tdsPercent` (SUPER_ADMIN)
Through the existing `PUT /v3/admin/plan-settings/tdsPercent` with body `{ valueJson: 10 }`: a number from 0 to 100 with at most 2 decimals. **Empty by default, which means no TDS is applied** until the CA gives the rate; 0 also means none. The app applies the percent and computes no tax law beyond that.

### GET /v3/admin/commission/payouts/preview?partnerId=&month=2026-11 (OPERATIONS, ADMIN)
Pre-fill for the screen. `data` before recording: `{ alreadyRecorded:false, grossMinor, tdsPercentBp:number|null, tdsMinor, netMinor, lines, panOnRecord:boolean }` (`tdsMinor` is gross times the percent, rounded to the nearest paisa, half up; 0 when no percent; the PAN itself is never in this answer). After recording: `{ alreadyRecorded:true, payout }`. Errors as for recording: 400 `COMMISSION_MONTH_INVALID`, 404 `REFERRAL_LINK_NOT_FOUND`, 409 `COMMISSION_MONTH_NOT_CLOSED`, 409 `COMMISSION_NOTHING_TO_PAY`.

### POST /v3/admin/commission/payouts (ADMIN; changed)
Body adds optional `tdsMinor` (whole paise, 0 or more, below the gross) and `tdsReason` (3 to 300 chars). No `tdsMinor` means the pre-filled amount. A different amount is an edit and **requires** `tdsReason`. `data` (the payout): `{ id, partnerId, month, totalMinor, grossMinor, tdsMinor, netMinor, tdsPercentBp|null, tdsEdited, tdsReason|null, status, reference, paidById, paidAt }` with `totalMinor = grossMinor` and `netMinor = grossMinor - tdsMinor`. The percent in force is kept on the record, so a later change of the setting never rewrites a payout. Refusal: 400 `COMMISSION_PAYOUT_INVALID` with `details.fields` (`tdsMinor`, `tdsReason`, and the existing reference).

### GET /v3/admin/commission/payouts (changed)
Items add `grossMinor`, `tdsMinor`, `netMinor`, `tdsPercentBp`, `tdsEdited`, `tdsReason`.

### GET /v3/admin/commission/payouts/export.csv (ADMIN; it carries the PAN)
Query `partnerId`, `month`. Header: `month,partner,partnerId,pan,reference,grossRupees,tdsPercent,tdsRupees,netRupees,tdsChanged,tdsReason,paidAt`. A typed formula in a text cell is defused.

### GET /v3/partner/payouts (changed)
Items: `{ month, grossMinor, tdsMinor, netMinor, totalMinor, status, reference, paidAt }`. A partner never sees the reason, the percent or the PAN here.

### Partner PAN
`POST` and `PUT /v3/admin/partners` accept optional `pan` (ADMIN, staff only; `ABCDE1234F` in any case, stored upper case; empty or null clears it; anything else is 400 `PARTNER_INVALID` with `details.fields.pan`). The admin partner list and detail show `pan`. `GET /v3/partner/me` shows `panMasked` (`•••••1234F`, the first five characters hidden) or `null`. A PAN is never written to an audit row.

## Error codes added

`HELD_PAYMENT_NOT_FOUND`, `HELD_PAYMENT_INVALID`, `HELD_AMOUNT_MISMATCH`, `HELD_ALREADY_RESOLVED`, `GATEWAY_CREDENTIALS_INVALID`, `GATEWAY_CREDENTIALS_UNAVAILABLE`, `GST_RATE_INVALID`, `GST_RATE_EXISTS`. `COMMISSION_PAYOUT_INVALID` now also carries `details.fields`.

## Routes added and removed (10 added, 4 removed; the route baseline goes from 1433 to 1439)

Added: `GET /v3/admin/billing/held-payments`, `GET /v3/admin/billing/held-payments/:id`, `POST /v3/admin/billing/held-payments/:id/resolve`, `GET /v3/admin/payment-gateway/credentials`, `PUT` and `DELETE /v3/admin/payment-gateway/credentials/:gateway/:mode`, `GET /v3/admin/gst-rate`, `PUT /v3/admin/gst-rate`, `GET /v3/admin/commission/payouts/preview`, `GET /v3/admin/commission/payouts/export.csv`.
Removed: `GET`, `POST /v3/admin/discount-rules`, `PUT`, `DELETE /v3/admin/discount-rules/:id`.

---

# Dispatch A3 additions (smoke branch `v3-smoke`; no new route, no new migration)

## A3-1. `POST /auth/register` (closes gaps G2 and G28; behaviour checked on the local API against staging)

Public. Rate limited per client address (default 5 a minute; 429 beyond it).

Body (all strings; any field not listed is refused with 400): `name`, `email`, `password`, `businessName`, `industry` (all required); `phone`, `referralCode` (max 20), `subdomain` (max 63), `product` (`"leadspace"` only), `track` (`"handyman"`, `"professional"`, `"ecommerce"`) optional. `password`: at least 8 characters with one capital letter and one digit. `industry` is a free text key (it is not checked against a list here).

**Success: HTTP 201** (not 200). `data`: `{ accessToken, user:{ id, name, email, role:"VENDOR", businessName, industry, subdomain } }`, the same shape as login. `subdomain` is the one asked for, or one made from the business name. Differences from login: a fresh registration does **not** carry `termsAcceptanceRequired` (login, the replay below and `GET /auth/me` do), so call `GET /auth/me` right after registering before deciding whether to show the terms screen. The token works at once (7 days).

**Replay.** The same email, the same business name and the **right** password again signs in to the account that exists and makes nothing new; it also answers 201 and includes `termsAcceptanceRequired`. A wrong password or another business name falls through to the refusal below.

**Errors** (body is the usual `{ success:false, statusCode, message, data, timestamp }`, plus `code` where one exists):

| HTTP | `code` | When |
|---|---|---|
| 400 | none | validation: `message` is one sentence naming what to fix ("Email does not look right. ..."); `data.fields` lists the field names when they can be named (`["name","email",...]`), otherwise `data` is `null`: show `message`, do not depend on `fields`. A field the API does not know is also 400 ("Extra cannot be changed here.") |
| 400 | `SUBDOMAIN_INVALID` | not lowercase letters, digits and hyphens, too short or too long, begins or ends with a hyphen; `message` says which |
| 400 | `SUBDOMAIN_RESERVED` | a reserved name (for example `admin`) |
| 409 | `HOST_UNAVAILABLE` | the subdomain is taken or blocked ("That address is not available."); check first with `GET /v3/public/subdomain-availability?name=` |
| 409 | none | the email already has an account and the replay conditions did not hold: "A vendor with this email already exists" (no `code`; switch on the status) |
| 429 | none | too many attempts from this address |

A bad `referralCode` is **never** an error (it is ignored). The subdomain is checked before anything is created, so a refused subdomain leaves no account behind.

## A3-2. Theme switch, as built (Batch 4, slice 5.16d) and the fee-pending code

Vendor owner routes (`/v3/me/site/theme/...`, owner only): `POST preview` `{themeId}` (free, stores nothing; its `fee` says what a switch would cost), `POST switch` `{themeId, idempotencyKey}` (the key is 8 to 80 of letters, digits, `-`, `:`, `_`), `GET fee`, `GET history`. The list of themes and `selectedThemeId` stay on `GET /v3/me/site/themes`; the chosen theme is `themeId` in `GET /v3/me/site` and `GET /v3/admin/vendors/:id/site` (the published pages are drawn from it). Staff: `POST /v3/admin/vendors/:vendorId/site/theme/switch`, `GET /v3/admin/vendors/:vendorId/site/theme/history`, `POST /v3/admin/theme-switches/recover` (OPERATIONS, ADMIN, SUPER_ADMIN).

Rules: only while the plan is a paid one in force or in grace (a Free vendor gets 409 `THEME_SWITCH_PLAN_STATE`). The first switch is included; every later one is charged to the wallet in one transaction with an audit row and an idempotency key (a repeat with the same key is one switch and one charge; the same key for another theme is 409 `WALLET_IDEMPOTENCY_CONFLICT`). **The fee comes from the price book entry `THEME_SWITCH`, which only the SUPER_ADMIN sets. While it has no approved price: `GET fee` answers `{ pricePaise:null, priceStatus:"PENDING", taxNote:"Before GST", priceNote:"Price not set" }`, the preview quote has no amount, and a paid switch is refused with 409 `THEME_SWITCH_FEE_PENDING`. No number is shown or charged in its place.** The included first switch and a staff gift do not need the fee. A short wallet is 409 `INSUFFICIENT_WALLET` with `shortfallPaise`.

Theme codes: `THEME_ALREADY_ACTIVE`, `THEME_NOT_ALLOWED` (`reason` says why), `THEME_SWITCH_PLAN_STATE`, `THEME_SWITCH_FAILED`, `THEME_SWITCH_INVALID`, `THEME_SWITCH_FREE_USE_DIRECT`, `THEME_SWITCH_NOT_FOUND`, `THEME_SWITCH_RETRY`, and new: `THEME_SWITCH_FEE_PENDING` (replaces `SERVICE_PRICE_NOT_SET` on this path only).

## A3-3. The generic tax-rate routes can no longer rewrite history

`PUT /v3/admin/tax-rates/:id` and `DELETE /v3/admin/tax-rates/:id` (SUPER_ADMIN) now answer **409 `TAX_RATE_IN_FORCE`** for any rate whose start has passed (in force, superseded or switched off): it priced orders, so it is history. A rate still waiting to start can be changed or deleted as before, but cannot be moved to a start in the past (same code). To change the GST rate, add a new one that starts later with `PUT /v3/admin/gst-rate`. `POST /v3/admin/tax-rates` is unchanged. An unknown id is still 404.

## A3-4. Error codes added in A3

`THEME_SWITCH_FEE_PENDING`, `TAX_RATE_IN_FORCE`. Routes: none added or removed.
