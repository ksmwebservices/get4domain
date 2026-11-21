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

# Dispatch A4 additions (branch `v3-smoke2`; no new migration)

## A4-1. Held payments: business name, and the role rule pinned

Every row of `GET /v3/admin/billing/held-payments` and the answer of `GET /v3/admin/billing/held-payments/:id` now carry **`businessName`**: the business name on the vendor's profile, or `null` when it is blank or the vendor can no longer be read. Additive; nothing else changed. Show `businessName ?? vendorId`.

Who may call these routes did not change and is now pinned by tests through the real guard stack: **ADMIN and SUPER_ADMIN only**. Every other staff role (OPERATIONS, SALES and its labels, SUPPORT), a referral partner and a vendor get **403** on the list, the detail and the resolve route, for any id (real, unknown, malformed), before any lookup. No token, a bad token or a tampered token gets **401**. A token cannot claim a staff role: the role is read from the database row, never from the token. For ADMIN and SUPER_ADMIN, an unknown id (or an order that is not held) is **404 `HELD_PAYMENT_NOT_FOUND`**.

## A4-2. Theme routes, complete

All money is in paise, before GST unless a field says otherwise. Errors have the shape `{ success:false, statusCode, message, code, ... }`; switch on `code`.

### Themes list (three views of the same library)
| Route | Roles | Answer |
|---|---|---|
| `GET /v3/public/themes?pack=KEY` | public (no login), cacheable | `{ pack:{key,name}, matchedBy:"CATEGORY"\|"TRACK"\|"NONE", items:[{ id, name, tier, tracks[], access:"DEFAULT"\|"LIBRARY", categories[] }] }`. No price, no personal data. Unknown or disabled pack: 404 `THEME_PACK_NOT_FOUND`. |
| `GET /v3/me/site/themes` | vendor OWNER | `{ selectedThemeId, library:boolean, fee:{ priceStatus:"SET"\|"PENDING", pricePaise:number\|null, taxNote:"Before GST", purchasable:boolean }, items:[{ id, name, tier, tracks[], access, selected, allowed:boolean, reason:null\|"PLAN_REQUIRED"\|"NOT_FOR_YOUR_BUSINESS" }] }`. |
| `GET /website-themes`, `GET /website-themes/mine` | public / vendor | the older theme catalogue (marketplace themes); not the pack library above. |

### `POST /v3/me/site/theme/preview` (vendor OWNER; free; stores nothing)
Request `{ "themeId": "<theme id, 2..81 chars>" }`. Response 200:
`{ themeId, current, alreadyActive, previewRef, expiresAt, html, css, warnings[], hiddenFields[], fee }`. `html` and `css` are the finished home page drawn with the vendor's own content. `fee` is the quote of what a switch would cost now:
- the included switch: `{ kind, free:true, amountPaise:0 }`
- a paid switch with an approved price: `{ kind, free:false, price:{ amountPaise, taxInclusive }, tax:{ taxPaise, totalPaise, lines[] }, amountPaise:<total incl. GST>, funding:{ kind:"WALLET", amountPaise } }` or `funding:{ kind:"NONE", reason:"WALLET_NOT_ACTIVE"|"WALLET_FROZEN"|"TAX_NOT_SET"|"INSUFFICIENT_WALLET", shortfallPaise? }`
- no approved price: `{ kind, free:false, priceNote:"Price not set", funding:{ kind:"NONE", reason:"PRICE_NOT_SET" } }` (no number).
Errors: 400 `THEME_SWITCH_INVALID` (bad id), 409 `THEME_NOT_ALLOWED` (`reason` says why).

### `POST /v3/me/site/theme/switch` (vendor OWNER; idempotent)
Request `{ "themeId": "<id>", "idempotencyKey": "<8..80 of letters, digits, - : _>" }`. Response 200:
`{ id, from, to, kind:"INCLUDED"|"PAID"|"COMPLIMENTARY_STAFF"|"RESTORE", status:"APPLIED", by:"YOU"|"OUR_TEAM"|"SYSTEM", amountPaise:number|null, viaRequest:boolean, reason:null|string, note:null|string, publicationId, hiddenFields[], at, replay:boolean }`. `amountPaise` is the amount charged including GST (null for an included or gifted switch). The same key with the same theme again answers the same switch with `replay:true` and charges once. The first switch is included in a paid plan; each later one is charged to the wallet.
Errors (409 unless noted):
| code | when |
|---|---|
| `THEME_SWITCH_INVALID` (400) | bad key or theme id |
| `THEME_SWITCH_PLAN_STATE` | the plan is not a paid plan in force or in grace (a **Free** vendor is refused here) |
| `THEME_ALREADY_ACTIVE` | that theme is already the vendor's theme |
| `THEME_NOT_ALLOWED` (+`reason`) | the plan or the business kind does not allow that theme |
| `THEME_SWITCH_FEE_PENDING` | a paid switch while the THEME_SWITCH price is not approved; nothing charged |
| `INSUFFICIENT_WALLET` (+`shortfallPaise`) | the wallet cannot cover the fee including GST; nothing charged |
| `WALLET_NOT_ACTIVE` (403), `WALLET_FROZEN` (403) | wallet state, checked before the price |
| `TAX_NOT_CONFIGURED` | no GST rate in force |
| `WALLET_IDEMPOTENCY_CONFLICT` | the key was used for a different theme |
| `THEME_SWITCH_RETRY` | the site changed while preparing; nothing charged; try again |
| `THEME_SWITCH_FAILED` | applying failed; the theme is put back and any charge reversed |

### `GET /v3/me/site/theme/fee` (vendor OWNER)
`{ pricePaise:number|null, priceStatus:"SET"|"PENDING", taxNote:"Before GST", priceNote?:"Price not set" }`. PENDING always has `pricePaise:null`.

### `GET /v3/me/site/theme/history?page&pageSize` (vendor OWNER; pageSize up to 100)
`{ items:[ same shape as a switch answer, without replay ], page, pageSize, total }`, newest first.

### Staff
- `POST /v3/admin/vendors/:vendorId/site/theme/switch` body `{ themeId, idempotencyKey, funding:"WALLET"|"COMPLIMENTARY"|"SERVICE_REQUEST", reason:<5..300 chars>, serviceRequestId? }`; `GET /v3/admin/vendors/:vendorId/site/theme/history` (adds `performedById, ledgerEntryId, serviceRequestId, idempotencyKey, failureReason, reasonRaw`); `POST /v3/admin/theme-switches/recover` `{ olderThanMinutes:1..10080 }` answers `{ applied, reversed }`. Roles per the matrix (OPERATIONS, ADMIN, SUPER_ADMIN). Extra code: `THEME_SWITCH_FREE_USE_DIRECT` (a request cannot carry the included switch).

### How the THEME_SWITCH price is set
No new route is needed; the price book already does it, **SUPER_ADMIN only** at each step. The seed leaves one PROPOSED row (29,900 paise, before GST, the owner-approved figure); it is not in force and the fee shows PENDING until approved.
1. `GET /v3/admin/services/THEME_SWITCH` -> find the row in `prices` (status PROPOSED).
2. (optional) `POST /v3/admin/services/THEME_SWITCH/prices` `{ amountPaise, taxCategory?, taxInclusive?, note? }` to propose a different amount, or `PUT /v3/admin/services/prices/:id` to edit a PROPOSED row.
3. `POST /v3/admin/services/prices/:id/approve` `{ "effectiveFrom": "<ISO 8601 date>" }` (not in the past; later than the price in force). From that date `GET fee` shows `SET` and a paid switch can be bought.
`POST .../prices/:id/retire` takes a price out. OPERATIONS and ADMIN cannot do any of these (matrix and ADMIN extension). No price is ever set by code.

## A4-3. `POST /v3/admin/tax-rates` is never back-dated

SUPER_ADMIN only, as before. Body unchanged (`name`, `ratePercent`, optional `appliesTo`, `active`, `validFrom`). New rule, the same one the GST rate setting uses: **`validFrom` on an earlier India-time day than today is refused, 409 `TAX_RATE_IN_FORCE`** (the same code the generic PUT uses for a start in the past; nothing is created and nothing is audited). A start later today or on a later day is kept exactly as sent. A start earlier today, or no `validFrom`, means "from now" (the start is the moment of creation, never an earlier time). Existing rows are not changed. To change the GST rate, `PUT /v3/admin/gst-rate` is still the route that takes a plain day.

## A4-4. The public vendor-site answer is a finished page (theme rendering, backend side)

`GET /v3/public/site/by-host?host&path&lang` (public, internal use by the site app and the host mapper) answers **the finished HTML page** of the published site for that host, already drawn from the vendor's chosen theme at build time, with `ETag` (the page's sha256), `Content-Language`, `Cache-Control`, and `X-Robots-Tag` / `X-Canonical-Host` where they apply. It is not a data model, there is no theme to apply on the way out, and **no theme key is needed to draw it**: the site app and the relay pass the stored page through unchanged (status, headers and body). A theme switch makes a new publication; the next request for that host returns the new pages (new `ETag`), and the previous publication stays available for rollback.

Two honest notes for whoever renders it:
1. The page is served byte for byte, except one rule that never needs a theme key: when the vendor's plan can no longer carry calls to action (lapsed or suspended), the same stored page is served as a listing (calls to action removed, with a "listed on" line) and its `ETag` changes with it; when the plan is active again the stored page is served untouched.
2. Every miss, a bad host, a path that does not exist, or a preview-only site is the same plain `404 Not found`; a takedown is `451`. Nothing says which hosts exist.

**No `themeKey` was added to this answer.** The answer is HTML plus headers, not a JSON site model, so a field would mean a new response header and a change to the type the host mapper reads, for a value no screen needs (the chosen theme is already `themeId` in `GET /v3/me/site` and `GET /v3/admin/vendors/:id/site`, and `selectedThemeId` in `GET /v3/me/site/themes`). Documented only.

# TM1 additions (branch `v3-theme-mp`; additive; no new migration so far)

## TM1-1. `GET /v3/me/overview` (the vendor Home screen, one read)

Signed-in business (owner or team member). Read only, own vendor only (the vendor is always the verified principal's). It is **additive**: `GET /v3/me/app-shell` is unchanged and is returned whole inside `shell`.

`data`: `{ actor:"OWNER"|"TEAM_MEMBER", parts:string[], shell:<the app-shell answer>, business, site, orders, customers }` where
- `business`: `{ name, subdomain:string|null, customDomain:string|null, industry:string|null }`
- `site`: `{ published:boolean, version:number|null, publishedAt:ISO|null, themeId:string|null }`
- `orders`: `{ locked:boolean, open:number|null, total:number|null }` (`open` = every order not yet delivered, cancelled or returned)
- `customers`: `{ locked:boolean, total:number|null }` (archived customers are not counted)

`locked:true` means the plan does not include the feature behind the matching list screen (`requests.inbox` for orders, `crm.customers` for customers): the numbers are `null`, show the locked state, never a zero. Counts are row counts of the business's own records; there is no price, money amount, sender, subject or customer detail anywhere in the answer.

**Role matrix (data, `src/v3-packs/core/overview-access.ts`).** `parts` lists what this caller was given; a part not given is `null` in its field.

| part | owner | team member |
|---|---|---|
| `business` | yes | yes |
| `site` | yes | needs the `website` area |
| `orders` | yes | needs the `website` area (same as `GET /v3/me/orders`) |
| `customers` | yes | never (same as `GET /v3/me/customers`, owner only) |

The `shell` field keeps its own matrix (`sections`). A signed-out caller is 401; a staff principal is 403. Throttling is the global default. The route is classified "authenticated, reads the principal" in the route baseline (1448 to 1449 routes).

## TM1-2. `POST /v3/me/terms/accept` (the body, confirmed against the code)

Owner only (a team member is 403). The body is **`{ "documents": [ { "kind": string, "version": integer >= 1 } ] }`**, 1 to 8 items, nothing else (no `acceptTerms` flag: that flag belongs to the claim flow only).

Rules, from `acceptanceMatches` in `src/terms/core/terms-core.ts`:
1. Send **every** document that `GET /v3/me/terms` lists under `outstanding` (`{ kind, version }` each), with exactly the version shown. The request is checked as a whole: a missing waiting document, a stale version, a repeated kind, or a kind that is not waiting is refused.
2. Refusals: an empty or malformed list or a non-integer version is 400 (validation); everything else above is 409 `TERMS_STATE_INVALID` with the reason in `message`.
3. Success is HTTP 200: `data: { accepted:number, acceptanceRequired:boolean }`. `acceptanceRequired:false` means nothing is waiting any more. Calling it again with nothing waiting is not an error: `{ accepted:0, acceptanceRequired:false }` (idempotent).
4. Every acceptance is audited (`terms.accept`); the IP and user agent are stored only as keyed hashes.

Typical flow: `GET /v3/me/terms` then, if `acceptanceRequired` is true, `POST /v3/me/terms/accept` with `documents` taken straight from `outstanding`.

## TM1-3. The theme marketplace (16 routes added; one migration, applied to staging)

Package format and rules: `docs/v3/THEME_PACKAGE_SPEC.md`. A theme package is a zip (`theme.json`, `templates/`, `css/`, `presets/`, `assets/`) with an optional `marketplace` block in `theme.json`; it is **required** to upload to the marketplace. A theme has no price of its own; choosing one is the existing `POST /v3/me/site/theme/switch` (wallet-paid fee, a Free plan refused with `FEATURE_LOCKED`). Nothing in any answer below is a count, a rating, a ranking or a popularity: lists are sorted by name.

**Table (new, additive):** `g4d_theme_market_packages` (row level security on, no policy). One row per `(key, version)`; the zip is stored in the row; rows are never deleted. `status` is `DRAFT`, `REVIEW`, `PUBLISHED` or `ARCHIVED`; `visibility` is `PUBLIC` or `PRIVATE` (one business, `privateVendorId`). The database also holds the rules: a private theme names its business, a public one names none, and a theme made for a customer cannot be `PUBLISHED` publicly without the recorded consent.

### Admin routes (`/v3/admin/theme-market`)

Roles (data in `admin-role-matrix.ts`, `THEME_MARKET_READS` and `THEME_MARKET_ADMIN_WRITES`): reading, the dry run and the preview are **OPERATIONS, ADMIN, SUPER_ADMIN**; upload, submit, return, publish, publish-to-marketplace and archive are **ADMIN and SUPER_ADMIN**. SALES, SUPPORT, the labels, vendors and partners are refused (403). Every change writes an audit row in the same transaction (`theme.upload`, `theme.submit`, `theme.return`, `theme.publish`, `theme.publish_to_marketplace`, `theme.archive`).

| Route | What |
|---|---|
| `POST /v3/admin/theme-market/validate` | multipart, field `file` (the zip), optional `vendorId`. Dry run: **200** `{ ok, problemCount, problems:[{file,rule,message,source}], manifest:{key,version,name,tier,tracks,marketplace}\|null, sizeBytes, contentHash }`. Stores nothing. Throttled 10 a minute |
| `POST /v3/admin/theme-market/themes` | multipart, field `file`, optional field `vendorId` (a business id). Without `vendorId` the theme is for the marketplace (`PUBLIC`); with it the theme is **private to that one business** and its manifest `sourceVendorId` must be empty or the same id. **200** `{ theme, replayed }`; status `DRAFT`. The same bytes sent again answer `replayed:true` and store nothing. Throttled 10 a minute |
| `GET /v3/admin/theme-market/themes` | query `status, visibility, pack, addon, capability, tag, category, tier, key, vendorId, q, starter(true\|false), page, pageSize(<=100)`; newest versions first by name. `{ items:[theme], total, page, pageSize }`. An unrecognised value is 400 `THEME_FILTER_INVALID` |
| `GET /v3/admin/theme-market/themes/:id` | one theme (no file bytes): `{ id, key, version, name, description, tier, premium, starter, licence, status, visibility, privateVendorId, sourceVendorId, tracks, packs, addons, capabilities, tags, catalogueCategories, kitCategories, contentHash, sizeBytes, fileCount, consent:{obtained,note,at,byId}, reviewNote, createdAt, updatedAt, submittedAt, publishedAt, archivedAt }`. 404 `THEME_NOT_FOUND` |
| `GET /v3/admin/theme-market/themes/:id/preview?pack=&page=` | **any stored version, a draft included**, drawn by the real renderer with the sample business of a pack (default: the theme's first pack; page `home about services gallery contact item ...` as the theme has them). Answers HTML with the preview headers below |
| `POST /v3/admin/theme-market/themes/:id/submit` | `DRAFT` to `REVIEW` |
| `POST /v3/admin/theme-market/themes/:id/return` | body `{ note }` (3 to 300 characters); `REVIEW` to `DRAFT`, the note is kept as `reviewNote` |
| `POST /v3/admin/theme-market/themes/:id/publish` | `REVIEW` to `PUBLISHED`. The stored package is **checked again** with every rule; if it fails: 409 `THEME_PUBLISH_BLOCKED` with `problems`. Publishing a newer version archives the older published version of the same key. The renderer serves it at once (no rebuild, no restart) |
| `POST /v3/admin/theme-market/themes/:id/publish-to-marketplace` | for a theme that is **private and published**: body `{ consentObtained: boolean, consentNote?: string }`. Needs `consentObtained:true` and a note of 3 to 500 characters (both audited), else 409 `THEME_CONSENT_REQUIRED`. The package must carry nothing of the business (its name, web addresses, phone in any spacing, e-mail, or any of its own media files by hash), else 409 `THEME_PRIVATE_CONTENT` with `problems` naming each file. On success `visibility` becomes `PUBLIC`, `privateVendorId` empties, the key and version stay, and every business may now choose it. `sourceVendorId` stays on the row for the audit trail and is returned by **no** vendor or public route |
| `POST /v3/admin/theme-market/themes/:id/archive` | `DRAFT`, `REVIEW` or `PUBLISHED` to `ARCHIVED`: no longer offered or choosable; a business already using it keeps it until it switches |

**A refused package** is **422 `THEME_PACKAGE_INVALID`** with `problems:[{ file, rule, message, source }]` (up to 100, `problemCount` is the real number) and nothing is stored. `source` is `package` (the kit validator: `path-traversal`, `executable-file`, `unknown-file`, `missing-file`, `manifest-invalid`, `hash-mismatch`, `asset-type-mismatch`, `unsafe-asset`, `too-many-files`, `file-too-large`, ...), `lint` (the kit lint: `no-script-tag`, `no-inline-handler`, `no-external-request`, `approved-fonts`, `contrast-tokens`, `slots-required`, ...), `marketplace` (`marketplace-required`, `marketplace-pack-unknown`, `marketplace-addon-unknown`, `marketplace-capability-unknown`, `marketplace-tag-unknown`, `marketplace-tag-incoherent`, `marketplace-category-unknown`, `marketplace-category-pack`, `marketplace-pack-track`, `marketplace-preview-missing`, `marketplace-source-vendor`, `marketplace-licence-missing`, `key-reserved`) or `content` (`content-email`, `content-phone`, `content-outside-address`, `content-vendor-detail`, `content-vendor-media`). A message never repeats file content.

**Other error codes:** 400 `THEME_PACKAGE_MISSING` (no `file`), 413 `THEME_PACKAGE_TOO_LARGE` (over 5 MB), 404 `THEME_VENDOR_NOT_FOUND`, 409 `THEME_KEY_RESERVED` (a built-in library key, or a key that belongs to one business or to the marketplace), 409 `THEME_VERSION_EXISTS` (the same version with other content, or a version not higher than the newest stored), 409 `THEME_STATE_INVALID` (a move the status does not allow; carries `status`), 404 `THEME_NOT_FOUND`, 400 `THEME_FILTER_INVALID`, 404 `THEME_NOT_AVAILABLE`, 422 `THEME_PREVIEW_FAILED`. All are registered in `BUSINESS_ERROR_CODES`.

### Marketplace for a business and for the public

Filters (the same on both): `pack` (one of the 16 pack keys), `category` (a **catalogue** id of the 196), `addon` (`SHOP`, `ONLINE_ORDERING_DELIVERY`, `PHARMACY_COUNTER`, `HOME_SAMPLE_COLLECTION`), `capability`, `tag` (a combination tag: `service-plus-shop`, `handyman-plus-shop`, `vehicle-service-plus-shop`, `cloud-kitchen-plus-delivery`, `restaurant-plus-delivery`, `shop-plus-delivery`, `clinic-plus-pharmacy`, `clinic-plus-lab`, `clinic-pharmacy-lab-home-sample`, `lab-plus-home-sample`, `pharmacy-plus-delivery`, `wellness-plus-shop`, `education-plus-shop`, `hospitality-plus-shop`), `tier` (`Standard`, `Premium`), `starter` (`true`/`false`), `q` (name), `page`, `pageSize` (up to 100). A value that is not real is 400 `THEME_FILTER_INVALID`. A library theme is listed under the packs it was designed for (read from its kit categories) and claims no add-on or tag.

| Route | Who | Answer |
|---|---|---|
| `GET /v3/public/theme-market/themes` | anyone (`@Public`, cacheable 60 s) | `{ items:[{ id, name, description, tier, premium, starter, source:"LIBRARY"\|"MARKETPLACE", version, tracks, packs, addons, capabilities, tags, catalogueCategories, preview:{kind:"GENERATED",path} }], total, page, pageSize }` for the library and the **published public** themes only. No vendor, no price, no count |
| `GET /v3/public/theme-market/themes/:key` | anyone | the item plus `pages:[...]` and `previews:[{pack,path}]`. A private, draft, archived or unknown theme is 404 `THEME_NOT_AVAILABLE` |
| `GET /v3/public/theme-market/themes/:key/preview?pack=&page=` | anyone | the preview page (headers below) |
| `GET /v3/me/theme-market/themes` | vendor **OWNER** (a team member is 403; it shows the switch fee) | `{ selectedThemeId, library:boolean, fee:{priceStatus,pricePaise,taxNote:"Before GST",purchasable}, items:[...item, allowed:boolean, reason:null\|"PLAN_REQUIRED"\|"NOT_FOR_YOUR_BUSINESS", selected:boolean, access:"DEFAULT"\|"LIBRARY"], total, page, pageSize }`: the themes designed for **my kind of business**, my own private themes included, never another business's. It is the same answer as `GET /v3/me/site/themes` (the plan gate and entitlement checks are the switch route's own rules), joined with the marketplace metadata. A Free business sees every non-default theme locked with `PLAN_REQUIRED` |
| `GET /v3/me/theme-market/themes/:key` | vendor OWNER | the item as above plus `fee`, `pages`, `previews`. 404 `THEME_NOT_AVAILABLE` for a theme I may not see |
| `GET /v3/me/theme-market/themes/:key/preview?pack=&page=` | vendor OWNER | the preview page for a theme I may see |

**Choosing a theme** is not a new route: `POST /v3/me/site/theme/switch` (A4-2) with the theme `id` from these lists (the marketplace key is the theme id). It refuses a Free plan (`FEATURE_LOCKED`), a theme not designed for the business (`THEME_LOCKED`), an archived or another business's private theme (`THEME_INVALID`), and charges the wallet fee from the price book (`THEME_SWITCH_FEE_PENDING` while unset).

**Preview headers (every preview route).** Body: a complete HTML page drawn by the real renderer with the invented sample business of the pack; every price emptied, no offer, no review, no invented number, no script. Headers: `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; sandbox`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store`, `Cross-Origin-Resource-Policy: same-site`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`; **no `Set-Cookie`**. Show it in an `<iframe sandbox>`. An unknown pack, page or theme is 404 `THEME_NOT_AVAILABLE`; a theme that cannot be drawn is 422 `THEME_PREVIEW_FAILED` (never a stack trace). Throttled 60 a minute.

### What changes for the rest of the platform

- **No restart, no rebuild.** The renderer reads `PUBLISHED` themes from the database at run time (cache dropped on publish and archive, read again at least every 30 s, so another server follows within 30 s). The library default of a category is **never** a marketplace theme, so Free sites keep the default.
- **A theme that fails while drawing** never produces an error page or a failed publish: the build repeats with the business's previous theme, then the library default, and records the note `theme-render-fallback`. When the content did not change, the previous build is simply reused.
- **Starter themes:** 32 themes built by the Get4Domain team (`themes/starter/recipes.json`, `node themes/cli.mjs starter`), at least 4 for every pack, marked `starter:true` and described as such. They are uploaded through the route above like any other package.
- **`GET /v3/public/themes?pack=` and `GET /v3/me/site/themes`** now also include published marketplace themes (the vendor one only the business's own private ones); their answer shape is unchanged.

Route baseline: 1448 to 1465 (17 added: this section's 16 and `GET /v3/me/overview`).
