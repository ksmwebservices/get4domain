# API contract, Wave 3 (for the front-end slices)

Every answer is wrapped by the common interceptor: success `{ success, statusCode, message, data, timestamp }`; an error carries `code` (and `details` where noted). Money is **integer paise**; display it in rupees, prices **before GST**, GST as its own line. Never show the words "workspace", "BOS" or "LeadSpace". There is no discount, coupon or offer field anywhere.

## Public (no login)

### GET /v3/public/pricing
`data`: `{ currency:"INR", pricesExcludeGst:true, terms:[3,6,12], gst:{name,ratePercent}|null, free:{key:"free",name,kind:"TRIAL",description,informational:true}, plans:[{ key, track, name, description, capabilities:[{key,name,description}], terms:[{ termMonths, state:"AVAILABLE"|"PRICE_PENDING", price:{priceMinor,gstMinor,totalMinor}|null, purchasable }] }], addons:[{ key,name,description,state,price|null,purchasable }] }`. A `PRICE_PENDING` entry has no number and cannot be bought. `gstMinor`/`totalMinor` are null when no GST rate is set.

### GET /v3/public/subdomain-availability?name=
`data`: `{ available, name|null, reason:"AVAILABLE"|"INVALID"|"RESERVED"|"UNAVAILABLE", message }`. Same rules as registering. Never cached.

### GET /v3/public/referral/:code
`data`: `{ valid:true, source:"<display name>" }` or `{ valid:false }`. Nothing else.

### GET /v3/public/themes?pack=KEY
`data`: `{ pack:{key,name}, matchedBy:"CATEGORY"|"TRACK"|"NONE", items:[{ id,name,tier,tracks,categories,access:"DEFAULT"|"LIBRARY" }] }`. DEFAULT is on every plan; LIBRARY needs a paid plan. 404 `THEME_PACK_NOT_FOUND`.

### POST /auth/register (additive fields)
Body adds optional `subdomain` (max 63) and `referralCode` (max 20). Errors: 400 `SUBDOMAIN_INVALID`, 400 `SUBDOMAIN_RESERVED`, 409 `HOST_UNAVAILABLE`. Registering the same email, business and password again signs in (replay). A bad referral code is ignored.

## Vendor owner

### POST /v3/me/billing/orders
Body `{ planKey, termMonths:3|6|12, idempotencyKey }` (any other field, including `promoCode`, `amountPaise`, `discount`, is 400). `data`: `{ id,status,kind,planKey,termMonths,amountPaise,currency,quote:{base,discounts:[],taxMinor,totalMinor,...},providerOrderId,keyId,gateway:"razorpay"|"cashfree",clientToken|null,expiresAt,paidAt,createdAt }`. Razorpay checkout uses `keyId` + `providerOrderId`; Cashfree uses `clientToken` (the payment session). Errors: `PAYMENTS_DISABLED`, `PAYMENTS_NOT_CONFIGURED`, `PLAN_NOT_PURCHASABLE`, `TERM_NOT_OFFERED`, `PRICE_NOT_AVAILABLE`, `IDEMPOTENCY_CONFLICT`, `PAYMENT_PROVIDER_ERROR`.

### POST /v3/me/billing/orders/:id/confirm
Razorpay body `{ paymentId, signature }` (both required). Cashfree body `{}`. `data`: the order, plus `pending:true` while the payment is in progress. Errors: `PAYMENT_SIGNATURE_INVALID`, `PAYMENT_NOT_CAPTURED`, `PAYMENT_PROVIDER_ERROR`, `ORDER_STATE_INVALID`, `ORDER_NOT_FOUND`. A payment whose amount differs from the order puts the order in `REVIEW` (held); nothing activates.

### POST /v3/me/billing/orders/:id/cancel
`data`: the order with `status:"CANCELLED"`. Only `CREATED` or `PENDING_PAYMENT`; else 409 `ORDER_STATE_INVALID`.

### GET /v3/me/billing/invoices, GET /v3/me/billing/invoices/:id/download
List items carry `invoiceNumber`, `snapshot` (now with `lines:[{key:PLAN|TAX|TOTAL,description,amountMinor}]` and `payment:{method:"GATEWAY",gateway,reference}`), `taxBreakdown`. Download is an HTML page (heading unchanged) that says how it was paid.

### GET /v3/me/site/themes
`data`: `{ selectedThemeId, library:boolean, fee:{priceStatus:"SET"|"PENDING",pricePaise|null,taxNote:"Before GST",purchasable}, items:[{ id,name,tier,tracks,access,selected,allowed,reason:null|"PLAN_REQUIRED"|"NOT_FOR_YOUR_BUSINESS" }] }`. Applying stays `PUT /v3/me/site/theme`.

### Wallet top-up (v3-wallet, changed)
`POST /v3/me/wallet/topups` and its `confirm` behave like orders above; the top-up view adds `gateway` and `clientToken`; confirm body optional for Cashfree.

### GET /auth/me
`data`: `{ id,email,name,industry,isSandbox,role, adminRole?, staffLabel?, termsAcceptanceRequired? }`. Staff and partners are not vendors: staff get `adminRole` (SALES is `MARKETING`) and `staffLabel` (`FIELD_EXECUTIVE`/`TELECALLER`); a partner gets `role:"PARTNER"`.

## Webhooks (gateways only)
`POST /v3/payments/razorpay/webhook`, `POST /v3/payments/cashfree/webhook`: raw body, signature headers; 401 on a bad signature; 200 `{received:true}` (with `duplicate:true` on a replay). Never call from a browser.

## Staff (AdminGuard; roles from the matrix)

| Route | Request | Answer | Roles |
|---|---|---|---|
| GET /v3/admin/payment-gateway | | `{gateway,mode,liveAllowedByEnvironment,configured:{razorpay:{test,live},cashfree:{test,live}}}` (booleans only) | OPERATIONS, ADMIN, SUPER_ADMIN |
| PUT /v3/admin/payment-gateway | `{gateway?,mode?}` | same | ADMIN, SUPER_ADMIN. 400 `GATEWAY_SETTING_INVALID`, 409 `GATEWAY_NOT_READY`, 409 `LIVE_NOT_ENABLED` |
| POST /v3/admin/billing/vendors/:vendorId/cash-orders | `{planKey,termMonths,idempotencyKey}` | an order with `gateway:"cash"`, `status:"PENDING_PAYMENT"` | ADMIN, SUPER_ADMIN |
| POST /v3/admin/billing/orders/:id/mark-paid | `{method:"CASH",reference,receivedOn:"YYYY-MM-DD",amountPaise,specialCase:true,reason}` | `{status,outcome,invoice:{number,reference}|null}` | ADMIN, SUPER_ADMIN. 400 `CASH_ONLY`, 400 `CASH_DETAILS_INVALID` (`details.fields`), 409 `OFFLINE_AMOUNT_MISMATCH`, 409 `CASH_ORDER_INVALID` |
| GET /v3/admin/partners | `?status&type&page&pageSize` | `{items:[{id,type,name,email,phone,status,staffUserId}],page,pageSize,total}` | OPERATIONS, ADMIN, SUPER_ADMIN |
| POST /v3/admin/partners, PUT /v3/admin/partners/:id | `{type:FREELANCER|SALES_TEAM|ADMIN_TEAM,name,email,phone?,status?,staffUserId?}` | the partner. 400 `PARTNER_INVALID` (`details.fields`), 409 `PARTNER_EMAIL_TAKEN`, `PARTNER_STAFF_LINK_INVALID` | ADMIN, SUPER_ADMIN |
| GET /v3/admin/partners/:id/links | | `[{id,code,active,...}]` | read roles |
| POST /v3/admin/partners/:id/links | | the new link `{id,code,...}` | ADMIN, SUPER_ADMIN |
| POST /v3/admin/referral-links/:id/disable | | the link | ADMIN, SUPER_ADMIN |
| GET /v3/admin/commission/slabs | | `[{id,minVendors,maxVendors|null,amountPerVendorMinor,effectiveFrom}]` (empty until entered) | read roles |
| POST, PUT /v3/admin/commission/slabs(/:id) | `{minVendors,maxVendors|null,amountPerVendorMinor,effectiveFrom}` | the row. 400 `COMMISSION_SLAB_INVALID` (`details.problems`) | ADMIN, SUPER_ADMIN |
| POST /v3/admin/commission/months/:month/close | month `2026-11` | `{month,noSlabs,approved,partners:[{partnerId,count,perVendorMinor,totalMinor}]}`; safe to repeat | ADMIN, SUPER_ADMIN |
| GET /v3/admin/commission/ledger | `?month&partnerId&status&page&pageSize` | lines `{id,partnerId,vendorId,month,orderId,status:ACCRUED|APPROVED|PAID|REVERSED,amountMinor|null,flagged,flagReason}` | read roles |
| GET /v3/admin/commission/ledger/export.csv | same filters | CSV | read roles |
| POST /v3/admin/commission/payouts | `{partnerId,month,reference}` | the payout. 409 `COMMISSION_MONTH_NOT_CLOSED`, `COMMISSION_NOTHING_TO_PAY`, `COMMISSION_PAYOUT_EXISTS`; 400 `COMMISSION_PAYOUT_INVALID` | ADMIN, SUPER_ADMIN |
| GET /v3/admin/commission/payouts | `?partnerId&month` | paged payouts | read roles |
| GET /v3/admin/vendors/:id/referral | | `{referral:{partner:{id,name,type},source,code,setAt,reason}|null}` | OPERATIONS, ADMIN, SUPER_ADMIN |
| PUT /v3/admin/vendors/:id/referral | `{partnerId,reason?}` | the attribution; first touch only, else 409 `REFERRAL_ATTRIBUTION_EXISTS`; 409 `REFERRAL_SELF_REFERRAL` | ADMIN, SUPER_ADMIN |
| POST /v3/admin/vendors/:id/referral/change | `{partnerId,reason}` (reason 3+ chars) | the attribution | SUPER_ADMIN only |

"read roles" = OPERATIONS, ADMIN, SUPER_ADMIN. SALES, SUPPORT, FIELD_EXECUTIVE and TELECALLER are refused on all of the above. `POST /v3/admin/seeded-sites/:id/go-live` is now also open to SALES and its labels.

## Referral partner (`/v3/partner/*` only; every other route answers 403 `PARTNER_SCOPE_REFUSED`)

| Route | Answer |
|---|---|
| GET /v3/partner/me | `{id,name,type,status}`; 404 `PARTNER_NOT_FOUND` when the login is not linked to an active partner |
| GET /v3/partner/link | `{codes:[{code,issuedAt}]}` |
| GET /v3/partner/vendors | paged `{businessName,state|null,referredAt}` (no email, phone or id) |
| GET /v3/partner/commission | paged `{month,businessName,status,amountMinor|null,flagged}` |
| GET /v3/partner/payouts | paged `{month,totalMinor,status,reference,paidAt}` |

A vendor, team member or staff member calling these gets 403 `PARTNER_ONLY`.
