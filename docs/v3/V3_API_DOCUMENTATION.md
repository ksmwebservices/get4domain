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
