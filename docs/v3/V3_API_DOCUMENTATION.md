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
