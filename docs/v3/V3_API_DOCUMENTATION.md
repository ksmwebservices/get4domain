# V3 API documentation

Started with slice 5.1. Request and response examples for every route are in `V3_S1_PLANS_ENTITLEMENTS.md` section 7; this file is the route index and grows with each slice.

Envelope for every response: `{ "success": true, "statusCode": 200, "message": "Success", "data": ..., "timestamp": "..." }`; errors `{ "success": false, "statusCode": 4xx, "message": "...", "code": "MACHINE_CODE", "data": { ... } }`. Lists: `?page=1&pageSize=25` (max 100) returning `{ items, page, pageSize, total }`. Money is integer paise. Every admin PUT needs `expectedUpdatedAt`.

Stable error codes: FEATURE_LOCKED, LIMIT_REACHED (403, with `upsellText`), STALE_WRITE, PLAN_IN_USE, FEATURE_IN_USE (409), INVALID_AMOUNT, INVALID_TERM, FREE_PLAN_HAS_NO_PRICE, REASON_REQUIRED (400), UNKNOWN_PLAN, UNKNOWN_VENDOR (404).

## Slice 5.1: plans, tracks and entitlements

### Public
| Method and path | Who | What |
|---|---|---|
| GET /v3/plans | anyone | public plans with term prices, the feature comparison (HIDDEN left out), the sellable terms and the tax note |

### Vendor
| Method and path | Who | What |
|---|---|---|
| GET /v3/me/entitlements | owner or team member | every feature with state, limit, upsell text, and the four theme-kit booleans |
| GET /v3/me/subscription | owner only | current subscription, plan, status, dates, the price it was sold at |
| GET /v3/me/subscription/events | owner only | history of plan changes (paginated) |

### Staff (AdminGuard + role matrix): reads SUPER_ADMIN and OPERATIONS, writes SUPER_ADMIN only
| Method and path | What |
|---|---|
| GET /v3/admin/plans, GET /v3/admin/plans/:id | list; one plan with prices and feature rows |
| POST /v3/admin/plans, PUT /v3/admin/plans/:id, DELETE /v3/admin/plans/:id | create; update; delete an unused plan (409 PLAN_IN_USE otherwise) |
| GET /v3/admin/plans/:id/prices | price rows |
| POST /v3/admin/plans/:id/prices, PUT /v3/admin/prices/:priceId, DELETE /v3/admin/prices/:priceId | price rows |
| GET /v3/admin/features, POST /v3/admin/features, PUT /v3/admin/features/:key, DELETE /v3/admin/features/:key | the feature catalogue |
| GET /v3/admin/plans/:id/features, PUT /v3/admin/plans/:id/features | the plan-feature matrix (bulk save, one transaction) |
| GET/POST /v3/admin/tax-rates, PUT/DELETE /v3/admin/tax-rates/:id | tax rates |
| GET/POST /v3/admin/discount-rules, PUT/DELETE /v3/admin/discount-rules/:id | discount rules |
| GET /v3/admin/plan-settings, PUT /v3/admin/plan-settings/:key | settings |
| GET /v3/admin/audit-logs | change log (filter by entityType and entityId) |
| GET /v3/admin/vendors/:id/subscription, POST /v3/admin/vendors/:id/subscription | a vendor's subscription; staff assignment (reason required) |
| GET /v3/admin/vendors/:id/entitlements | what the vendor resolves to now, and why, per feature |
| GET/POST /v3/admin/vendors/:id/overrides, PUT/DELETE /v3/admin/overrides/:overrideId | feature overrides (DELETE expires, never erases) |
| PUT /v3/admin/vendors/:id/flags/v3_plans | switch the v3_plans flag for one vendor |

34 staff routes in all; the vendor and public routes are 4. Seed: `backend-api/prisma/seed/v3-plans.seed.json`, loaded by `node scripts/seed-v3-plans.js [--apply]` (staging only).

## Slice 5.3: provisioning, claim links, invites

Design and examples: `V3_S3_PROVISIONING.md` section 8. Extra error codes (passed through the error filter): `DUPLICATE_BUSINESS` (409, a job failure code), `JOB_NOT_FOUND` (404), `JOB_NOT_RETRYABLE` (409), `CLAIM_INVALID` (404 on the public route, 409 for staff).

### Public
| Method and path | Who | What |
|---|---|---|
| GET /v3/claim/:token/status | anyone, 20 per minute per IP | `{ valid, businessName, expiresAt }`, or the same 404 `CLAIM_INVALID` for an unknown, malformed, used, revoked or expired link |

### Staff (AdminGuard + role matrix): OPERATIONS and SUPER_ADMIN read and write; MARKETING refused
| Method and path | What |
|---|---|
| POST /v3/admin/provisioning/jobs | create a job (header `Idempotency-Key`, 8 to 100 characters); 201, or 200 with the existing job when the key repeats |
| GET /v3/admin/provisioning/jobs | list (page, pageSize up to 100, status, from, to) |
| GET /v3/admin/provisioning/jobs/:id | one job with its five steps and its sanitised error; never a token |
| POST /v3/admin/provisioning/jobs/:id/retry | FAILED job back to the queue, done steps kept |
| POST /v3/admin/provisioning/jobs/:id/cancel | remaining steps SKIPPED, done steps kept |
| POST /v3/admin/provisioning/jobs/:id/run | run this job now, in the request (production: only while the runner setting is on) |
| POST /v3/admin/vendors/:id/claim-link/reissue | revoke the old link, send a new one |
| POST /v3/admin/vendors/:id/claim-link/revoke | revoke the current link |
| GET /v3/admin/invites | invites, addresses masked; the sandbox message only outside production |

9 staff routes and 1 public route. Settings (edited through `PUT /v3/admin/plan-settings/:key`): `provisioningRunnerEnabled`, `provisioningMaxAttempts`, `provisioningBackoffSeconds`, `claimLinkExpiryDays`, `inviteAdapterMode`, `publicAppUrl`, `inviteSubjectTemplate`, `inviteBodyTemplate`.

## Slice 5.4: theme renderer, SEO layer, publish

Design and examples: `V3_S4_RENDERER_PUBLISH.md` section 8. Extra error codes (passed through the error filter): `THEME_INVALID` (400), `THEME_LOCKED` (403), `SITE_BUDGET_EXCEEDED` (422), `PUBLISH_BLOCKED` (409, with `missing: [{code, label}]`), `PUBLICATION_NOT_FOUND` (404, also for another vendor's id). A plan lock is the existing `FEATURE_LOCKED`.

### Vendor (JWT; team members need the website area; theme, publish and rollback are owner-only)
| Method and path | What |
|---|---|
| GET /v3/me/site | settings, current and newest publication, what is missing for search engines, allowed themes (no html) |
| PUT /v3/me/site/theme | `{ themeId }`, entitlement checked (owner) |
| POST /v3/me/site/build | build a preview; `{ themeId? }`; returns `{ publication, reused }` |
| POST /v3/me/site/publish | `{ publicationId }` (owner) |
| POST /v3/me/site/rollback | `{ toVersion }`, needs version history on the plan (owner); creates a new version |
| GET /v3/me/site/preview/:publicationId/:path | one stored page, path URL-encoded (`%2Fabout`); `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: no-store` |

### Staff (AdminGuard + role matrix)
| Method and path | Who | What |
|---|---|---|
| GET /v3/admin/sites | all staff | sites of all vendors, summaries only |
| GET /v3/admin/vendors/:id/site | all staff | one site's summary (no html) |
| PUT /v3/admin/vendors/:id/site/theme, POST .../site/build, POST .../site/publish, POST .../site/rollback | OPERATIONS, SUPER_ADMIN | the same actions on behalf of a vendor |
| PUT /v3/admin/vendors/:id/site/noindex | OPERATIONS, SUPER_ADMIN | `{ forceNoindex }`; a live site is rebuilt and republished at once |
| GET /v3/admin/vendors/:id/site/preview/:publicationId/:path | OPERATIONS, SUPER_ADMIN | one stored page (html); MARKETING is refused |

### Public (internal, read-only, rate limited 300 per minute per IP)
| Method and path | What |
|---|---|
| GET /v3/public/site/by-host?host=&path=&lang= | the PUBLISHED page as html with ETag (the page sha256), 304 on `If-None-Match`, cache and robots headers; one plain 404 for every miss |

15 new routes. Nothing here exposes a site on a real host.

## Batch 2 (branch v3-b2): 65 new routes, staging only, nothing exposed on a real host

Same envelope as above. Design, rules and examples: `V3_S5_BATCH2.md`. "Owner" means the vendor owner (team members are refused); "staff" means AdminGuard plus the role matrix.

### Slice 5.6 Domains (14)
| Method and path | Who | What |
|---|---|---|
| GET /v3/me/domains | owner | the vendor's hosts with state |
| PUT /v3/me/domains/subdomain | owner | `{ slug }` set or change the free subdomain (rules, change limit); 409 HOST_UNAVAILABLE for any taken, reserved or blocked name |
| POST /v3/me/domains/custom | owner | `{ hostname }` add a custom domain (plan feature `customDomain`); returns the DNS TXT instruction |
| GET /v3/me/domains/:id | owner | one host |
| POST /v3/me/domains/:id/verify | owner | DNS TXT check (DISABLED while `domainDnsLiveChecks` is off) |
| POST /v3/me/domains/:id/primary | owner | make a verified custom domain primary |
| DELETE /v3/me/domains/:id | owner | release a host (soft; a released subdomain is never reused by another vendor) |
| GET /v3/admin/domains, GET /v3/admin/domains/:id | OPERATIONS, SUPER_ADMIN | list and read |
| POST /v3/admin/domains/:id/verify, PUT .../state, POST .../primary, POST .../remove | OPERATIONS, SUPER_ADMIN | staff actions, reason required, audited |
| PUT /v3/admin/vendors/:id/domains/subdomain | OPERATIONS, SUPER_ADMIN | set a vendor's free subdomain |

### Slice 5.7 Directory, claim by OTP, removal (31)
| Method and path | Who | What |
|---|---|---|
| GET /v3/directory/locations, /categories | public | active trees |
| GET /v3/directory/businesses | public | search (`q`, `category`, `location`, `page`); sponsored items labelled, page 1 only |
| GET /v3/directory/businesses/:slug | public | profile; unclaimed shows a limited view; 410 when removed |
| GET /v3/directory/sitemap-data | public | slugs and dates of indexable profiles |
| POST /v3/directory/removal-requests | public | uniform 202 |
| GET /v3/directory/removal-requests/:token, POST .../:token/confirm | public | status and confirmation (token only) |
| POST /v3/claim/:token/otp/request, POST /v3/claim/:token/otp/verify | public | uniform answers; verify returns the single-use account-setup grant |
| GET /v3/me/directory, PUT /v3/me/directory | owner | the vendor's own profile |
| GET/POST/PUT /v3/admin/directory/locations(/:id), /categories(/:id) | staff (reads all; writes OPERATIONS, SUPER_ADMIN) | trees |
| GET/POST/PUT /v3/admin/directory/businesses(/:id) | staff (MARKETING reads without personal fields) | businesses |
| POST .../businesses/:id/moderate, .../placements, .../claim-phone-override; GET .../businesses/:id/placements; POST .../placements/:id/revoke | OPERATIONS, SUPER_ADMIN | moderation, sponsored placements, claim-phone override (reason, audited) |
| GET /v3/admin/directory/removal-requests; POST .../:id/approve, /reject, /execute | OPERATIONS, SUPER_ADMIN | removal queue (contacts masked) |

### Slice 5.1b Plan purchase (9, Razorpay TEST only)
| Method and path | Who | What |
|---|---|---|
| POST /v3/me/billing/orders | owner | `{ planId, termMonths, idempotencyKey }`; amounts in paise from the plan tables |
| POST /v3/me/billing/orders/:id/confirm | owner | signature plus provider re-check, then the single settlement |
| GET /v3/me/billing/orders, GET /v3/me/billing/invoices | owner | own orders and invoices |
| POST /v3/payments/razorpay/webhook | public (signature) | raw-body HMAC; 401 bad signature, 200 for replays |
| GET /v3/admin/billing/orders, GET .../payment-events | OPERATIONS, SUPER_ADMIN | read (payloads redacted) |
| POST /v3/admin/billing/orders/:id/mark-paid, POST .../refund | SUPER_ADMIN | recorded with a reason; same settlement path |

### Slice 5.11 AI Studio (11, mock model unless `aiLiveCalls`)
| Method and path | Who | What |
|---|---|---|
| POST /v3/me/ai/generate | owner or website-area member | `{ feature, input, idempotencyKey }`; 403 LIMIT_REACHED when credits are spent |
| GET /v3/me/ai/usage | same | credits included, granted, used, remaining, recent requests |
| GET/POST /v3/admin/ai/providers, PUT .../:id, POST .../:id/test | SUPER_ADMIN | the secret is encrypted and never returned |
| GET/POST /v3/admin/ai/prompts, POST .../prompts/:id/activate | SUPER_ADMIN | versioned instruction templates |
| POST /v3/admin/ai/credit-grants | SUPER_ADMIN | reason required, audited |
| GET /v3/admin/ai/usage | OPERATIONS, SUPER_ADMIN | usage without generated text |

Route classification baseline: 839 to 904 routes (public 92, admin 288, authenticated 524); none removed.


## Batch 3 (branch v3-b3): 74 new routes, staging only, nothing exposed on a real host

Same envelope as above. Design, rules, data dictionary and examples: `V3_S6_BATCH3.md`. "Owner" means the vendor owner (team members are refused); "area" means a vendor route behind the `website` area permission; "OPS" means OPERATIONS and SUPER_ADMIN; "SUPER" means SUPER_ADMIN only; MARKETING is refused on anything with personal data. Every Batch 3 error carries a stable `code` in the body (the exception filter now forwards them; `errors` is a list of plain strings and `outstanding` a list of `{ kind, version }`).

### Slice 5.1d Plan expiry, suspension and deletion (11)
| Method and path | Who | What |
|---|---|---|
| GET /v3/admin/vendors/:id/lifecycle | OPS | status, plan, grace, removed |
| POST /v3/admin/vendors/:id/lifecycle/convert-to-free | OPS | reason required |
| POST /v3/admin/vendors/:id/lifecycle/restore-pro | OPS | reason; optional planKey and termMonths |
| POST /v3/admin/vendors/:id/lifecycle/extend-grace | OPS | reason, days (1 to the `graceExtendMaxDays` setting) |
| POST /v3/admin/vendors/:id/lifecycle/suspend, .../reinstate | OPS | reason; the site stays live as a Free listing |
| POST /v3/admin/vendors/:id/lifecycle/delete-empty-listing | OPS | 409 LIFECYCLE_NOT_EMPTY lists what exists |
| GET /v3/admin/account-deletions, GET .../:id, POST .../:id/execute | OPS | the owner-requested deletion queue; execution is permanent |
| POST /v3/me/account/deletion-request | Owner, 10 per hour | three calls: send code, then code, then code with `confirm: true` |

### Slice 5.6b Canonical host and the custom-domain promotion add-on (3)
| Method and path | Who | What |
|---|---|---|
| GET /v3/admin/vendors/:id/canonical | OPS | canonical host and why |
| POST /v3/admin/vendors/:id/custom-domain-addon | OPS | reason, endsAt (future); goes through the override service, then switches |
| POST /v3/admin/vendors/:id/custom-domain-addon/end | OPS | reason |

By-host reads now carry `canonicalHost` and the `X-Canonical-Host` header; the subdomain redirects to the custom domain only while the add-on is active.

### Slice 5.7b Directory as a search engine (3)
| Method and path | Who | What |
|---|---|---|
| POST /v3/directory/businesses/:slug/visit | public, 60 per minute per IP | the Visit-site beacon; returns `{ ref, expiresAt, url }`; no cookie |
| GET /v3/me/directory/stats?days= | Owner, any plan | zero-filled daily visit counts |
| GET /v3/admin/directory/visits | OPS | per business totals |

Every directory business now returns `siteUrl` (its subdomain), `siteState` and `badges`. The directory has no form, callback or lead endpoint.

### Slice 5.13a Seeded sites (15, all staff)
| Method and path | Who | What |
|---|---|---|
| GET /v3/admin/seeded-sites, GET .../:id | OPS, MARKETING (non-personal fields) | list and one |
| POST /v3/admin/seeded-sites | OPS | create one; the staff checkbox `publicFactsOnly` is required |
| POST .../batches/dry-run, POST .../batches/apply | OPS | CSV; the dry run creates nothing |
| GET .../register, POST .../register | OPS | the do-not-contact register (hashed phones) |
| PUT .../:id/outreach, POST .../:id/calls, PUT .../:id/consent | OPS | outreach status, call log, the owner's agreement to be contacted |
| POST .../:id/claim-link, POST .../:id/claim-link/revoke | OPS | the link is returned once, never sent or logged |
| POST .../:id/removal | OPS | permanent; joins the register |
| GET .../indexing-mode | OPS | OFF or QUALITY |
| PUT .../indexing-mode | SUPER | reason required; audited |

### Slice 5.14 Requests and orders bridge (33)
| Method and path | Who | What |
|---|---|---|
| POST /v3/public/sites/:host/requests | public, rate limited | enquiry, appointment, quote, product enquiry; uniform 404 unless the site is Pro; consent for the current text required |
| POST /v3/public/sites/:host/orders | public, rate limited | cart to order or order request; says which payment step applies |
| GET /v3/public/requests/track/:token | public | status and the business's replies; a wrong and an expired token are the same 404 |
| POST /v3/public/reports | public | report a business; always the same 202 |
| POST /v3/payments/vendor/:vendorId/:methodId | public, signature | the vendor's own gateway event; raw-body HMAC with that vendor's secret; duplicates answer 200 |
| GET /v3/me/requests, GET .../:id, POST .../:id/respond, POST .../:id/link | area | the inbox; the first read marks it seen |
| GET /v3/me/orders, GET .../:id, PUT .../:id/status | area | orders |
| PUT /v3/me/stock/:productRef | area | on-hand quantity |
| GET /v3/me/offers, POST /v3/me/offers, PUT /v3/me/offers/:id | area | banners and coupons |
| GET/POST /v3/me/payment-methods, PUT/DELETE .../:id, POST .../:id/test | Owner | secrets are write-only; only `last4` is shown |
| POST /v3/me/orders/:id/refund | Owner | records a refund; no provider call |
| POST /v3/me/orders/:id/invoice, GET /v3/me/invoices, POST /v3/me/invoices/:id/void | Owner | the vendor's own invoice, gap-free numbers, no PDF |
| GET /v3/admin/requests, GET .../:id | OPS | no customer e-mail or phone |
| GET /v3/admin/message-outbox | OPS | sandbox outbox, recipients masked |
| GET /v3/admin/reports, POST .../reports/:id/handle | OPS | ACTIONED with `suspendVendorId` suspends the vendor |
| GET/POST /v3/admin/blocklist, DELETE .../:id | OPS | keyed hashes |

A Free vendor gets 403 FEATURE_LOCKED with an upsell on every vendor route above.

### Slice 5.15 Terms documents and acceptances (9)
| Method and path | Who | What |
|---|---|---|
| GET /v3/public/terms/:kind | public | latest PUBLISHED text; a draft or unknown kind is the same 404 |
| GET /v3/public/terms/:kind/versions | public | published and retired versions, no text |
| GET /v3/me/terms | Owner | which required documents are accepted or waiting |
| POST /v3/me/terms/accept | Owner | names each kind and version; a stale version is refused |
| GET /v3/admin/terms, GET .../:id | SUPER | all documents (the list has no text) |
| POST /v3/admin/terms/kinds/:kind/drafts, PUT .../:id | SUPER | start a version, change a draft |
| POST /v3/admin/terms/:id/publish | SUPER | change note required; the placeholder text is refused (422 TERMS_PLACEHOLDER) |

The sign-in `user` object and `GET /me` carry `termsAcceptanceRequired` for vendor sessions.

Route classification baseline: 904 to 978 routes (public 100, admin 330, authenticated 548); none removed. Role-matrix oracle: 163 to 205 entries.

## Batch 4: wallet and services

Routes added by Batch 4 (58): wallet and ledger (14), plan renewal from the wallet (`POST /v3/me/plan/renew-with-wallet`), service catalogue, price book and packs (20), service requests (17), theme switch (6). Per-route request and response examples, roles and stable error codes: `docs/v3/V3_WALLET_AND_SERVICES.md`. Summary and decisions: `docs/v3/V3_S7_BATCH4.md`.

Route classification baseline: 978 to 1036 routes; none removed. Role-matrix oracle: 205 to 242 entries.

### Owner follow-up of 5 November 2026 (slices 5.16e and 5.16f)

Two routes added, one retired (baseline 1036 to 1037); the role-matrix oracle is unchanged (all three are vendor-owner routes):

| Route | Who | What |
|---|---|---|
| `GET /v3/me/wallet/usage-statement?from&to` | owner only | the credit used (services, packs, theme switches, plan renewals, reversals), newest first, with totals; no invoice per use |
| `GET /v3/me/wallet/topups/:id/invoice` | owner only | the tax invoice of one refill |
| ~~`GET /v3/me/service-requests/invoices`~~ | retired | a deduction has no invoice |

Changed behaviour: `POST /v3/me/wallet/topups` takes the credit (amount before GST) and returns `creditPaise`, `taxPaise`, `payablePaise` and the tax lines (the provider order is for `payablePaise`); it answers `409 TAX_NOT_CONFIGURED` with a `problem` when the seller state, the vendor's billing state or the tax rows are missing. A service request's `funding` no longer carries tax fields, `approve` no longer returns an invoice, and a pack, a request hold and a theme switch cost exactly their price. Details and the money model: the follow-up section of `docs/v3/V3_WALLET_AND_SERVICES.md`.

## Batch 4B (branch v3-b4b): activity, alerts, trust and safety

Slice 5.22 was cut by the owner (Release 2). Full contract, data dictionary, decisions and open questions: `docs/v3/V3_ACTIVITY_AND_TRUST.md`.

### Slice 5.20 Activity log and alerts (8 routes, all new)

| Route | Who | What |
|---|---|---|
| `GET /v3/me/activity` | owner only | my own activity, masked, newest first, paged |
| `GET /v3/admin/alerts`, `GET .../:id` | OPERATIONS, SUPER | alerts filtered by level, status, vendor, owner; detail with the activity rows behind it |
| `PATCH /v3/admin/alerts/:id` | OPERATIONS, SUPER | status, owner, note; 409 `ALERT_STALE` if it moved |
| `GET /v3/admin/alert-rules`, `PUT /v3/admin/alert-rules` | SUPER | the rules; a rule that needs numbers cannot be switched on without them |
| `GET /v3/admin/vendors/:vendorId/activity` | OPERATIONS, SUPER | one vendor's activity |
| `GET /v3/admin/attention` | OPERATIONS, SUPER | alert counts per role and level, queues, attention items |

Every successful mutating route under `/v3/me` and `/v3/admin` is logged by a global interceptor (field names only, never values); the wallet, services, service requests and theme switch events arrive through the bus listener.

### Slice 5.21 Trust and safety (18 routes, all new)

| Route | Who |
|---|---|
| `POST /v3/public/report-business` | public, 5 per minute per address, always 202 |
| `POST /v3/me/business-proof`, `GET /v3/me/business-proofs`, `GET /v3/me/takedown` | owner only |
| `GET/PATCH /v3/admin/business-reports(/:id)`, `GET/POST/DELETE /v3/admin/trust-blocklist(/:id)`, `GET /v3/admin/business-proofs`, `PATCH /v3/admin/business-proofs/:id`, `GET /v3/admin/takedowns` | OPERATIONS, SUPER |
| `GET/POST /v3/admin/prohibited-terms`, `PUT/DELETE .../:id`, `POST /v3/admin/takedowns`, `POST /v3/admin/takedowns/:id/reverse` | SUPER only |

Changed behaviour: a suspended listing stays in the directory (search, detail, Visit link) as a Free listing-only site and stays out of the sitemap; `GET /v3/public/site/by-host` answers 451 with a plain notice for a site under a legal takedown; the public request and order gate answers its usual plain 404 for such a site.

Route classification baseline: 1037 to 1063 routes (public 102, admin 388, authenticated 573); none removed. Role-matrix oracle: 242 to 263 entries.

## Stage 9 (branch v3-b5): UPI payments, pay requests, receipts and invoices

Design and rules: `docs/v3/STAGE_9_DESIGN.md`. Vendors are paid by UPI directly; Get4Domain never holds the money. Mark as paid is the only route to Paid. Slice 5.17c is skipped. Everything is staging only; messages and PDFs go through fake ports.

Common to all owner routes below: JWT, **owner only** (a team member gets 403), plan feature `payments.vendor_methods` (a Free vendor gets 403 (`FEATURE_LOCKED`)), the vendor is always the signed-in principal's, a foreign id answers exactly like a missing one. Money is whole paise. Errors are `{ code, message }` inside the usual envelope.

### Slice 5.17a Payment methods (owner 6, staff 1)

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /v3/me/payment-methods` | none | list of `{ id, kind, label, last4, upiId, payeeName, isDefault, showToCustomers, status, verifiedAt, hasGatewayDetails, hasWebhookSecret }` (gateway rows hidden) | 403 |
| `POST /v3/me/payment-methods` | `{ kind: UPI\|PAY_ON_DELIVERY\|PAY_AT_VISIT\|BANK_TRANSFER, label (2-60), upiId + payeeName (UPI, required), details (bank, required, write-only), showToCustomers? }` | the method, `status: UNVERIFIED`, `payeeCheck: MATCH\|MISMATCH\|UNKNOWN` (never blocks) | 400 `PAYMENT_METHOD_INVALID` (bad id or name, missing bank details, any gateway kind) |
| `PUT /v3/me/payment-methods/:id` | `{ label?, status?: UNVERIFIED\|ACTIVE\|DISABLED, upiId?, payeeName?, confirmUpiChange? }` | the method | 409 `PAYMENT_METHOD_CONFIRM_REQUIRED` (new UPI id without `confirmUpiChange: true`; nothing changes), 404 `PAYMENT_METHOD_INVALID` (foreign, missing, or a hidden gateway row), 409 `PAYMENT_METHOD_INVALID` (activate without a passed test) |
| `DELETE /v3/me/payment-methods/:id` | none | the method, now `DISABLED` (never erased) | 404 |
| `POST /v3/me/payment-methods/:id/default` | none | the method with `isDefault: true`; the previous default is cleared (one per business, enforced by the database) | 404, 409 (method not ACTIVE) |
| `POST /v3/me/payment-methods/:id/test` | none | sandbox result; a UPI method passes when it has a UPI id | 404 |
| `GET /v3/admin/vendors/:vendorId/payment-methods` | none | `{ id, vendorId, kind, label, status, isDefault, upiMasked (pr•••@bank), payeeName, verifiedAt }`; no bank details, no secrets | 403 for MARKETING; **OPERATIONS and SUPER_ADMIN**, read only |

A confirmed UPI change and a default change write the activity entry `payment_method.upi_changed` with field names only.

### Slice 5.17b Pay requests and payments (owner 5, public 2)

States: `AWAITING`, `CUSTOMER_SAYS_PAID`, `PAID`, `EXPIRED`, `CANCELLED`.

| Route | Request | Response | Errors |
|---|---|---|---|
| `POST /v3/me/payment-requests` | `{ amountPaise (int >= 1), customerName (2-80), customerPhone?, note? (200), methodId? (default: the default ACTIVE UPI), orderId? (then amount must equal the order total) }` | `{ id, code, payUrl, amountPaise, amountText, note, customerName, customerPhone, source, requestId, orderId, methodId, status: AWAITING, expiresAt, customerSaidAt, customerUtr, createdAt }` | 409 `PAY_LINK_EXPIRY_NOT_SET` (staff have not set `payLinkExpiryHours`), 409 `PAYMENT_METHOD_INVALID` (no ACTIVE UPI method), 400 `PAY_REQUEST_INVALID`, 404 `PAY_REQUEST_NOT_FOUND` (foreign or missing order), 409 `PAY_STATE_INVALID` (order not waiting for payment) |
| `GET /v3/me/payment-requests?status=&orderId=&page=&pageSize=` | query | paged list of the same shape | 400 |
| `GET /v3/me/payment-requests/:id` | none | the request plus `payment: { amountPaise, utr, confirmedBy, confirmedAt } \| null` | 404 `PAY_REQUEST_NOT_FOUND` |
| `POST /v3/me/payment-requests/:id/cancel` | none | the request, `CANCELLED` (the link stops working) | 404, 409 `PAY_STATE_INVALID` (already PAID, EXPIRED or CANCELLED) |
| `POST /v3/me/payment-requests/:id/mark-paid` | `{ utr? (8-22 letters and digits), idempotencyKey? (8-80 of A-Za-z0-9._-) }` | the request (`PAID`) plus `alreadyPaid`, `payment`, and `document: { id, number, kind } \| null`; idempotent: a repeat returns the same payment, makes no second one | 400 `PAY_REFERENCE_INVALID`, 400 `PAY_REQUEST_INVALID`, 404, 409 `PAY_STATE_INVALID` (CANCELLED). A late payment (EXPIRED) is accepted. |
| `GET /v3/public/pay/:code` | none (public, rate limited, `no-store`) | `{ state, businessName, payeeName, amountPaise, amountText, note, upiIntent, qrPayload, expiresAt }`; when already paid only `{ state: PAID, businessName, amountText }`. No phone number, no customer name. | 404 plain `Not found` (unknown or malformed code, Free vendor, suspended, removed, Legal takedown), 410 `PAY_LINK_EXPIRED` (cancelled or expired) |
| `POST /v3/public/pay/:code/i-have-paid` | `{ utr? }` | `{ state: CUSTOMER_SAYS_PAID }` (or the current state if already moved); tells the vendor; **never marks paid**; repeat changes nothing | 400 `PAY_REFERENCE_INVALID`, 404 plain, 410 `PAY_LINK_EXPIRED` |

`POST /v3/payments/vendor/:vendorId/:methodId` (the 5.14 vendor-gateway webhook) answers a plain 401 unless the owner sets `VENDOR_GATEWAY_WEBHOOK_ENABLED=true`. Leave it unset.

### Slice 5.17d Tax profile, receipts and invoices (owner 6, public 1)

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /v3/me/tax-profile` | none | `{ vendorId, gstRegistered, gstin, stateCode, legalName, address, compositionScheme, invoicePrefix }` (defaults when never saved) | 403 |
| `PUT /v3/me/tax-profile` | any of `gstRegistered, gstin, stateCode, legalName, address, compositionScheme, invoicePrefix (0-6 capitals or digits)`; registered needs a valid GSTIN (format and check character), legal name and address; the state is read from the GSTIN; unregistered clears the number | the saved profile | 400 `PAY_REQUEST_INVALID` |
| `GET /v3/me/documents?page=&pageSize=` | query | paged list of owner views | 403 |
| `GET /v3/me/documents/:id` | none | `{ id, kind: TAX_INVOICE\|BILL_OF_SUPPLY\|BILL\|FEE_RECEIPT, number, totalPaise, amountText, items, tax: { taxablePaise, taxPaise, cgstPaise, sgstPaise, igstPaise, supply }, customerName, flags: { assumedIntraState }, whatsappStatus, emailStatus, resendCount, publicUrl, createdAt }` | 404 `PAY_REQUEST_NOT_FOUND` |
| `POST /v3/me/documents/:id/resend` | none | the owner view, `resendCount` raised; sends the link again by WhatsApp and e-mail (sandbox) | 404 |
| `GET /v3/me/documents/:id/download` | none | `{ number, pdfRef, mode: FAKE, publicUrl }` (the renderer is a fake in this build) | 404 |
| `GET /v3/public/doc/:code` | none (public, rate limited, `no-store`) | `{ kind, number, issuedAt, business: { name, legalName, address, gstin }, customerName, items, tax, totalPaise, amountText }`; no phone, no e-mail | 404 plain (unknown code, removed vendor, Legal takedown) |

Documents are made by Mark as paid, one per payment, with a gap-free number per vendor and financial year (for example `INV2627-00001`). A registered vendor's manual payment makes no document (no tax rate to use): the payment stands and `document.needs_tax_rate` is written.

Route classification baseline and the owner-only list were updated for the new owner routes; the role-matrix oracle grew from 263 to 264 (the one staff route).


## Batch 9 (branch v3-b9): Website manager, 49 new routes (30 vendor, 19 staff), staging only, nothing exposed on a real host

Responses use the standard envelope. Errors carry a stable `code`, a plain `message` and, for a field problem, the `field` name; the submitted text is never echoed. Vendor routes take the vendor from the signed-in principal (there is no vendor id in any vendor URL, query or body). Editing needs the `website` team area; **publish and restore are owner only**. Staff routes use the role matrix: OPERATIONS and SUPER_ADMIN unless stated; MARKETING is refused on anything with personal, money or customer data. (The stage file names SUPPORT, Website Developer and Customer Support roles that do not exist here: decision D-1.)

### The draft (slice 5.5a), all under `/v3/me/site`

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET editor/map` | none | `{ themeId, map: { pages: [{ key, sections: [{ id, label, optional, fields[], lists[], fromOfferings, visibilityOnly }] }], gaps[] }, fonts[], pro, limits, fields }` derived from the theme's own templates | 409 `NO_THEME` |
| `GET draft` | none | `{ doc, rev, dirty, baseVersion, liveVersion }` | |
| `PUT draft/field` | `{ key, value }` (a key of the map, e.g. `hero.title`) | the draft view | 400 `FIELD_LOCKED` (SEO, canonical, markup and every key not in the map), 400 `FIELD_INVALID`, 422 `WORDING_NOT_ALLOWED`, 403 `FEATURE_LOCKED` (Pro-only wording) |
| `PUT draft/list/:name` | `{ items[] }` for `faqs, gallery, steps, trust, stats, team, credentials, pages` | the draft view | 400 `FIELD_LOCKED`, `FIELD_INVALID`, `ALT_REQUIRED`, `SLUG_INVALID`, `LIST_TOO_LONG`, 409 `LIMIT_REACHED` (plan limit) |
| `PUT draft/sections` | `{ hidden[], order[] }` | the draft view | 400 `SECTION_REQUIRED` (the top banner cannot be hidden), `SECTION_UNKNOWN` |
| `PUT draft/brand` | `{ brand: { accent?, accentDark?, fontHeading?, fontBody?, logo? } }` | the draft view | 400 `FONT_NOT_ALLOWED`, `FIELD_LOCKED` (anything else) |
| `PUT draft/navigation` | `{ header[], footer[] }` of `{ key, label (1-40), visible }` | the draft view | 400 `NAV_INVALID` |
| `DELETE draft` | none | the draft view, now equal to what is live | |
| `POST draft/preview` | none | `{ publication, reused }` (a DRAFT_PREVIEW; open it with the 5.4 preview route; never public) | |
| `POST draft/publish` (owner) | none | Pro: `{ mode: 'LIVE', unchanged, publication }`; Free: `{ mode: 'SUBMITTED', submission }` | 409 `NOTHING_TO_PUBLISH`, `SUBMISSION_PENDING`, 422/400 the same field and wording codes |
| `GET revisions` | none | publications with `hasContentSnapshot` | |
| `GET revisions/compare?from=&to=` | versions | `{ content: { fields[], lists[], sections, brand, navigation, seo[], location, reviewLink, testimonials }, pages: { added[], removed[], changed[], unchanged } }` | 404 `VERSION_NOT_FOUND` |
| `POST revisions/restore` (owner) | `{ toVersion }` | `{ publication }`; the draft becomes that version's content | 403 `FEATURE_LOCKED` (needs version history), 404 |

Example, a Pro publish: `POST /v3/me/site/draft/publish` returns `{ "success": true, "statusCode": 200, "data": { "mode": "LIVE", "unchanged": false, "publication": { "version": 3, "status": "PUBLISHED" } } }`. A second publish with no change returns `"unchanged": true` and creates nothing. Example, a refused field: `PUT draft/field {"key":"seo.canonical","value":"x"}` returns 400 `{ "code": "FIELD_LOCKED", "field": "seo.canonical" }`.

### Free edits go to review (slice 5.5c, amendment 06)

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /v3/me/site/submissions` | none | own submissions, newest first: `{ id, scope, status: SUBMITTED\|APPROVED\|REJECTED, submittedAt, decidedAt, reason, changed }` | |
| `GET /v3/me/site/submissions/:id` | none | one of them (the rejection reason is here) | 404 `SUBMISSION_NOT_FOUND` |
| `GET /v3/admin/content-reviews?status=&vendorId=&page=&pageSize=` | query | paged list with `vendorId, reviewerId` | |
| `GET /v3/admin/content-reviews/:id` | none | the submission with its `payload` document | 404 |
| `POST /v3/admin/content-reviews/:id/approve` | none | the submission, `APPROVED`; the submitted payload (not a later draft) is built and published | 409 `SUBMISSION_NOT_OPEN`, build errors leave it waiting |
| `POST /v3/admin/content-reviews/:id/reject` | `{ reason (3-500, plain text) }` | the submission, `REJECTED`; the old content stays live | 422 `REASON_REQUIRED`, 409 `SUBMISSION_NOT_OPEN` |

### Media and the Banner Library (slice 5.5b)

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /v3/me/site/media` | none | `[{ id, url, altText, width, height, contentType, bytes }]` | |
| `POST /v3/me/site/media` | multipart `file` + `alt` | the picture; re-encoded, metadata dropped, stored under the vendor's own folder; the same picture twice is one row | 409 `MEDIA_NOT_CONFIGURED` (staff caps unset), 422 `ALT_REQUIRED`, `MEDIA_TYPE_NOT_ALLOWED` (SVG never), `MEDIA_TYPE_MISMATCH`, `MEDIA_INVALID`, 413 `MEDIA_TOO_LARGE`, 503 `STORAGE_NOT_CONFIGURED` |
| `DELETE /v3/me/site/media/:id` | none | `{ removed: true }` | 404 `MEDIA_NOT_FOUND`, 409 `MEDIA_IN_USE` |
| `GET /v3/me/site/banners` | none | reference banners of my category (no licence data); healthcare and legal-finance see banners without identifiable people | |
| `POST /v3/me/site/banner` | `{ bannerId }` | `{ banner, published: false }`; writes the hero picture and its description to my draft | 404 `BANNER_NOT_AVAILABLE` |
| `GET /v3/admin/banner-library?categoryId=` (all staff) | query | every banner with `sourceUrl, author, licenceName, obtainedOn, categoryId, active` | |
| `PUT /v3/admin/banner-library/:id/active` | `{ active }` | the banner | 404 |
| `GET /v3/admin/vendors/:id/site/banners` | none | all banners available for that vendor, including pictures with people | |
| `POST /v3/admin/vendors/:id/site/banner` | `{ bannerId }` | `{ banner, published: true }`; staff acting for the vendor are the review, so it goes live | 404 `BANNER_NOT_AVAILABLE` |
| `GET` and `POST /v3/admin/vendors/:id/site/media` | as the vendor's, for that vendor | the picture(s); recorded in that vendor's activity with the staff member as the actor | as above |

Plan settings (all unset by default; set with `PUT /v3/admin/plan-settings/:key`, SUPER_ADMIN): `mediaMaxBytes`, `mediaAllowedTypes` (png, jpeg, webp), `mediaMaxPixels`, `testimonialMaxCount`, `actOnBehalfMaxMinutes`.

### Per-page SEO (B1)

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /v3/me/site/seo` | none | `{ pages: [{ pageKey, label, seoTitle, seoDescription, shareImageRef, isCustomTitle, isCustomDescription, slug: { value, editable }, defaults }], limits: { title: 60, description: 160 } }` | |
| `PUT /v3/me/site/draft/seo/:pageKey` | `{ seoTitle?, seoDescription?, shareImageRef? }` (`home, about, services, gallery, contact, page:<slug>, item:<id>`; an empty value removes the custom text) | the draft view | 400 `FIELD_LOCKED` (slug, canonical, structured data and any other key, or a page the site does not have), `FIELD_INVALID`, `IMAGE_NOT_ALLOWED` (not one of the site's own pictures), 422 `WORDING_NOT_ALLOWED` |
| `GET /v3/admin/seo/pages?vendorId=&issue=` (all staff) | `issue`: `DEFAULT_TITLE, DEFAULT_DESCRIPTION, DUPLICATE_TITLE, SHORT_DESCRIPTION` | paged `{ vendorId, pageKey, issue }` | |
| `GET /v3/admin/vendors/:id/site/seo` (all staff) | none | the effective SEO of every page of the live site | |

### Location and directions (B2)

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /v3/me/site/location` | none | `{ location, address, directionsUrl }` (`https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`, or the address text, URL-encoded) | |
| `GET /v3/me/site/location/parse?url=` | a full Google Maps link | `{ ok: true, coords }` or `{ ok: false, code }`; nothing is fetched; short links (maps.app.goo.gl) are not expanded | |
| `PUT /v3/me/site/draft/location` | `{ addressLine1?, addressLine2?, city?, state?, pincode? (6 digits), latitude?, longitude? (a pair), mapLinkInput? }` | the draft view; a full link supplies coordinates you did not type | 400 `FIELD_INVALID`, `LOCATION_COORDS_INCOMPLETE`, `SHORT_LINK_NOT_EXPANDED`, `LINK_HOST_NOT_ALLOWED`, `LINK_HAS_NO_COORDINATES` |
| `GET /v3/admin/vendors/:id/site/location` | none | the live location row or `null` | |

Free sites show the address as plain text and no directions link; Pro sites show the Get directions link.

### Google review link (B3) and testimonials (B4), Pro only

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /v3/me/site/review-link` | none | `{ url, pro }` | |
| `PUT /v3/me/site/draft/review-link` | `{ url }` (https on google.com and its subdomains, g.page, maps.app.goo.gl or search.google.com; empty removes it) | the draft view | 403 `FEATURE_LOCKED` (Free), 400 `REVIEW_HOST_NOT_ALLOWED`, `FIELD_INVALID` |
| `GET /v3/me/site/testimonials` | none | `{ items, label: 'Words shared by the business owner', maxCount, limits: { name: 40, text: 300 }, pro }` | |
| `PUT /v3/me/site/draft/testimonials` | `{ items: [{ name, text, date?, consent: true }] }`; exactly these four fields | the draft view | 403 `FEATURE_LOCKED`, 409 `TESTIMONIALS_NOT_CONFIGURED`, `LIMIT_REACHED`, 400 `NAME_NOT_ALLOWED`, `CONSENT_REQUIRED`, `FIELD_LOCKED` (rating, stars, score, url and every other key), `FIELD_INVALID`, 422 `WORDING_NOT_ALLOWED` |
| `GET /v3/admin/vendors/:id/site/review-link` and `/testimonials` | none | the live row(s) | |

No star rating, aggregate rating or review structured data is ever generated.

### Act on behalf and the onboarding queue (5.13b)

| Route | Request | Response | Errors |
|---|---|---|---|
| `POST /v3/admin/vendors/:id/act-on-behalf` | `{ reason (3-500) }` | `{ id, vendorId, staffId, reason, startedAt, expiresAt, state: ACTIVE }`; the vendor is notified | 409 `ACT_ON_BEHALF_NOT_CONFIGURED`, `SESSION_ACTIVE`, 422 `REASON_REQUIRED`, 404 `ACT_ON_BEHALF_VENDOR_NOT_FOUND` |
| `POST /v3/admin/act-on-behalf/:sessionId/end` | none | the session, `ENDED` (your own; SUPER_ADMIN may end any) | 403 `ACT_ON_BEHALF_INVALID`, 404 `SESSION_NOT_FOUND` |
| `GET /v3/admin/act-on-behalf?vendorId=&active=` | query | paged sessions | |
| `GET /v3/me/act-on-behalf` | none | `[{ id, reason, startedAt, expiresAt, endedAt, endedBy, state }]`, never the staff member | |
| `GET /v3/admin/onboarding-queue?kind=&page=` | `kind`: `SEEDED, CLAIM, NEW_VENDOR` | `{ items: [{ kind, vendorId, businessName, state, since, detail }], counts, total }`, oldest first, a vendor once | |

Inside a session the staff member sends the header `x-act-on-behalf-session: <id>` on `/v3/admin/vendors/:id/...` routes. The header is refused on any other route (`ACT_ON_BEHALF_WRONG_ROUTE`), for another vendor (`ACT_ON_BEHALF_WRONG_VENDOR`), for another staff member's session (`ACT_ON_BEHALF_INVALID`) and after the session has ended or run out (`ACT_ON_BEHALF_EXPIRED`). A change to a payment method, bank detail, UPI id, payee or password is refused (`ACT_ON_BEHALF_FORBIDDEN`) and the attempt is written to the vendor's activity. Every allowed request is written to the vendor's activity with `actOnBehalfSessionId`. Sessions end by themselves after `actOnBehalfMaxMinutes` (a sweep every minute, and on the next use).

Route classification baseline: 1079 to 1128 routes; owner-only list gained `POST /v3/me/site/draft/publish` and `POST /v3/me/site/revisions/restore`; the role-matrix oracle grew from 264 to 283.

## Batch 11: own-domain automation (5.6c), domain sales (5.6d) and transfer-in (5.6e)

42 routes (vendor 25, staff 17). Vendor routes are OWNER ONLY, use the verified principal's vendor and take no vendor id. Staff routes are OPERATIONS and SUPER_ADMIN (approving or rejecting a price is SUPER_ADMIN only); MARKETING is denied on all of them. Every error carries a stable `code`. Money is whole paise. Nothing here makes a live call: the registrar flags `REGISTRAR_LIVE_SEARCH` and `REGISTRAR_LIVE_PURCHASE` default OFF.

### Own-domain connection (5.6c)

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /v3/me/domains/connections` | none | `[ConnectionView]` | |
| `GET /v3/me/domains/:id/connection-guide?registrar=` | `registrar`: GODADDY, NAMECHEAP, HOSTINGER, BIGROCK, OTHER | `{ ownership: VERIFIED or WAITING, records: [{ purpose: OWNERSHIP or CONNECT, type: TXT or CNAME, host, hostLabel, value }], connectNotice, bareDomain: { needsCloudflareOption, text } or null, steps: [text], registrars, connection }` | 404 `CONNECTION_NOT_FOUND` |
| `GET /v3/me/domains/:id/connection` | none | `ConnectionView` | 404 `CONNECTION_NOT_FOUND` |
| `POST /v3/me/domains/:id/connection` | `{ mode?: CONNECT or FORWARD, registrar? }` | `ConnectionView` (the same one when called again) | 403 `FEATURE_LOCKED` (Free), 409 `CONNECTION_NOT_READY` (ownership not confirmed, or the connection address not set) |
| `POST /v3/me/domains/:id/connection/check` | none | `ConnectionView` (rate limited) | 429 `CONNECTION_CHECK_TOO_SOON`, 409 `CONNECTION_PROVIDER_FAILED` |
| `PUT /v3/me/domains/:id/connection/mode` | `{ mode }` | `ConnectionView` | 400 `CONNECTION_STATE_INVALID` |
| `POST /v3/me/domains/:id/connection/retry` | none | `ConnectionView` | 409 `CONNECTION_STATE_INVALID` |
| `DELETE /v3/me/domains/:id/connection` | none | `ConnectionView` (the domain stays the vendor's) | |
| `GET /v3/admin/domain-connections?status=&page=` | `status`: PENDING, VERIFYING, ACTIVE, NEEDS_ATTENTION, LAPSED | paged `ConnectionView` | |
| `POST /v3/admin/vendors/:id/domains/:domainId/connection/retry` | none | `ConnectionView` | |
| `GET /v3/admin/vendors/:id/domain-log?page=` | none | paged `{ id, at, actionKey, actorType, actorId, entityId, summary }`, newest first | |

`ConnectionView`: `{ id, domainId, hostname, connectHost, bareDomain, needsCloudflareOption, mode, status, certStatus, sslStatus: NONE, PENDING, ACTIVE or FAILED, failureReason, lastCheckedAt, activatedAt }`. A bare domain connects through its www host first. After the plan lapses (after grace) `status` is LAPSED and the vendor's host redirects (302) to the Get4Domain subdomain.

### Identity check (5.6d, vendor)

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /v3/me/identity` | none | `{ status, details, emailVerified, phoneVerified, document: { kind, last4, uploadedAt, purged } or null, consentGiven, reviewNote }`; never the document | |
| `PUT /v3/me/identity/details` | `{ legalName, company, email, phoneCc, phone, addressLine1, city, state, country?, zipcode }` | the same view | 400 `IDENTITY_INVALID`, `IDENTITY_AADHAAR_REFUSED` |
| `POST /v3/me/identity/otp` | `{ channel: EMAIL or PHONE }` | `{ sent: true, expiresAt }` | 409 `OTP_NOT_AVAILABLE`, `OTP_TOO_SOON`, `OTP_DELIVERY_FAILED` |
| `POST /v3/me/identity/otp/verify` | `{ channel, code }` | the view | 400 `OTP_INVALID` |
| `PUT /v3/me/identity/document` | `{ kind: PAN, GST_CERTIFICATE, UDYAM, BUSINESS_REGISTRATION or AADHAAR_MASKED, last4? (only for AADHAAR_MASKED), mime: application/pdf, image/jpeg or image/png, dataBase64 }` | the view (the check goes back to INCOMPLETE) | 400 `IDENTITY_INVALID`, `IDENTITY_DOCUMENT_TOO_LARGE`, 409 `IDENTITY_STORAGE_NOT_CONFIGURED` |
| `POST /v3/me/identity/submit` | `{ consent: true }` | the view, `IN_REVIEW` | 409 `IDENTITY_STATE_INVALID` |

### Identity check (staff)

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /v3/admin/identity-checks?status=&page=` | default `IN_REVIEW` | paged `{ vendorId, status, legalName, company, docKind, emailVerified, phoneVerified, updatedAt }` | |
| `GET /v3/admin/vendors/:id/identity` | none | the view plus the access log; never the document | 404 `IDENTITY_NOT_FOUND` |
| `POST /v3/admin/vendors/:id/identity/document` | `{ reason (5-300) }` | `{ kind, mime, last4, dataBase64 }`; the access is logged before this is returned | 400 `IDENTITY_REVIEW_REASON_REQUIRED`, 404 `IDENTITY_DOCUMENT_NOT_SET` |
| `POST /v3/admin/vendors/:id/identity/approve` | `{ note? }` | the view | 409 `IDENTITY_STATE_INVALID` |
| `POST /v3/admin/vendors/:id/identity/reject` | `{ reason (5-300) }` | the view; the vendor sees the reason | 400 `IDENTITY_REVIEW_REASON_REQUIRED` |

### Domain sales (5.6d) and transfer-in (5.6e), vendor

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /v3/me/domain-sales/overview` | none | `{ state: ACTIVE or LOCKED_PREVIEW, upsellText, identity, purchasesReady, extensions }` | |
| `GET /v3/me/domain-sales/search?name=` | a name, with or without an extension | `{ name, results: [{ domain, status: AVAILABLE, TAKEN or UNKNOWN, price: { totalPaise } or null }] }` | 403 `FEATURE_LOCKED`, 503 `REGISTRAR_NOT_LIVE`, `REGISTRAR_UNAVAILABLE` |
| `POST /v3/me/domain-sales/quote` | `{ domain, years (1-10), privacy? }` | `Quote` | 400 `DOMAIN_INVALID`, 409 `DOMAIN_PRICE_NOT_SET`, `DOMAIN_PRICE_UNAVAILABLE`, `TAX_NOT_CONFIGURED` |
| `POST /v3/me/domain-sales/purchase` | `{ domain, years, privacy?, idempotencyKey, expectedTotalPaise, consent: true }` | `Order` | 403 `FEATURE_LOCKED`, 409 `IDENTITY_NOT_APPROVED`, `REGISTRAR_NOT_CONFIGURED`, `REGISTRAR_BALANCE_LOW`, `DOMAIN_NOT_AVAILABLE`, `DOMAIN_PRICE_CHANGED` (with the new `totalPaise`), `INSUFFICIENT_WALLET` (with `shortfallPaise`), `WALLET_NOT_ACTIVE`, `WALLET_IDEMPOTENCY_CONFLICT`, 400 `DOMAIN_CONSENT_REQUIRED` |
| `GET /v3/me/domain-sales/orders`, `GET /v3/me/domain-sales/orders/:id` | page | paged `Order`, or `Order` with `invoice: { number, issuedAt, totalPaise, lines, taxPaise, taxablePaise }` | 404 `DOMAIN_ORDER_NOT_FOUND` |
| `GET /v3/me/domain-sales/registered` | none | `[{ id, domain, status, expiresAt, privacy, dnsStatus, registeredAt, lastRenewedAt }]` | |
| `POST /v3/me/domain-sales/registered/:id/renew-quote` | `{ years }` | `Quote` | 404 `DOMAIN_NOT_FOUND` |
| `POST /v3/me/domain-sales/registered/:id/renew` | `{ years, idempotencyKey, expectedTotalPaise }` | `Order` | 409 `DOMAIN_EXPIRED` (at or after the expiry), `DOMAIN_PRICE_CHANGED`, 404 `DOMAIN_NOT_FOUND` |
| `POST /v3/me/domain-sales/transfer-quote` | `{ domain, privacy? }` | `Quote` (kind `TRANSFER_IN`) | as for a quote |
| `POST /v3/me/domain-sales/transfer` | `{ domain, authCode (6-64), privacy?, idempotencyKey, expectedTotalPaise, confirmUnlocked: true, consent: true }` | `Order` in `SUBMITTED` while the registrar works | 400 `TRANSFER_AUTH_INVALID`, `TRANSFER_CONFIRM_REQUIRED`, 409 `TRANSFER_NOT_ELIGIBLE` (with `reason`: LOCKED, RECENTLY_REGISTERED, RECENTLY_TRANSFERRED, NOT_REGISTERED, UNKNOWN), and the purchase errors |

Example quote (a buyer in the seller's state, cost 700.00, margin 20 percent):

```json
{ "success": true, "statusCode": 200, "data": { "domain": "sriganesh.com", "tld": "com", "years": 1, "kind": "REGISTER", "costPaise": 70000, "marginPaise": 14000, "privacyPaise": 0,
  "taxablePaise": 84000, "taxPaise": 15120, "totalPaise": 99120,
  "lines": [ { "name": "CGST", "ratePercent": 9, "amountPaise": 7560 }, { "name": "SGST", "ratePercent": 9, "amountPaise": 7560 } ] } }
```

Example purchase answer: `{ "id": "...", "kind": "REGISTER", "domain": "sriganesh.com", "years": 1, "status": "COMPLETED", "amountPaise": 99120, "privacy": false, "failureCode": null, "settled": true, "pendingConfirmation": false, "replay": false }`. `status` is COMPLETED, FAILED (the hold was released; `failureCode` says why), or UNKNOWN or SUBMITTED (`pendingConfirmation: true`: the registrar has not confirmed yet; the hold stays and recovery settles it). Sending the same `idempotencyKey` again returns the same order with `replay: true`.

### Domain sales (staff)

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /v3/admin/domain-orders?vendorId=&status=&kind=&page=` | query | paged orders with cost, margin, privacy price, who asked, registrar order id | |
| `POST /v3/admin/vendors/:id/domains/register` | as `purchase` plus `{ reason (5-300) }` (no `consent`) | `Order`; spends the vendor's own wallet | as for a purchase |
| `GET /v3/admin/domain-margins` | none | the price book rows | |
| `POST /v3/admin/domain-margins` | `{ tld (an extension, `privacy`, or `transfer.<extension>`), kind: PERCENT_BP or FIXED_PAISE, value, note? }` | the proposed row | 400 `MARGIN_INVALID` |
| `POST /v3/admin/domain-margins/:id/approve` (SUPER_ADMIN) | `{ effectiveFrom }` | the approved row | 400 `MARGIN_INVALID`, 404 `MARGIN_NOT_FOUND`, 409 `MARGIN_STATE_INVALID` |
| `POST /v3/admin/domain-margins/:id/reject` (SUPER_ADMIN) | none | the rejected row | 409 `MARGIN_STATE_INVALID` |
| `POST /v3/admin/registrar/recover` | `{ olderThanMinutes }` | `{ settled, released, left }` | |
| `POST /v3/admin/registrar/reconcile` | none | `{ id, checked, settled, mismatches, balanceKnown }` | |
| `GET /v3/admin/registrar/runs` | none | the latest runs with their mismatches | |

Route classification baseline: 1128 to 1170 routes; the role-matrix oracle grew from 283 to 300.
