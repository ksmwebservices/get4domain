# V3 slice 5.1: plans, tracks and entitlements (design note)

Status: design for the code in `backend-api/src/plans/`. No payment flow, no frontend. Legacy billing, BOS, commercial-engine and menu-gating tables are never read or written by this slice (owner decision D1; stop-line 5). The Tenant is the `Vendor` row (D2); ids are `cuid()`.

## 1. The model in one paragraph

Three **tracks** (handyman, professional, ecommerce), each with two **levels** (FREE, PRO): six plan rows. A vendor chooses a track at registration and starts on that track's FREE plan. A PRO plan is bought for a **term** of 3, 6 or 12 months (a 1-month term exists in the data model but is switched off by a plan setting). What a plan gives is a row per **feature** in a plan-feature matrix: each cell has a **state** (ACTIVE, LIMITED, LOCKED_PREVIEW, HIDDEN), an optional numeric limit, an optional enum value and an upsell text. Everything (plans, prices, taxes, discounts, grace days, features, matrix cells, limits) is database data that SUPER_ADMIN edits without code. Staff can also give one vendor an **override** for one feature (reason required, optional expiry). The **entitlement engine** answers "what may this vendor do?" by combining the vendor's current subscription, the status rules and the overrides.

## 2. Data dictionary (all new, all additive, `g4d_` table names)

Prisma model and enum names are prefixed `V3` because `Plan`, `Subscription` and several other names already exist (see section 8). Table names are the ones in the slice spec.

| Table (model) | Columns | Rules |
|---|---|---|
| `g4d_plans` (`V3Plan`) | id, key unique, track `V3PlanTrack` (HANDYMAN, PROFESSIONAL, ECOMMERCE), level `V3PlanLevel` (FREE, PRO), name, description, status `V3PlanStatus` (DRAFT, ACTIVE, RETIRED), isPublic, sortOrder, createdAt, updatedAt | keys: handyman_free, handyman_pro, professional_free, professional_pro, ecommerce_free, ecommerce_pro. Unique (track, level). A plan in use cannot be deleted, only retired. |
| `g4d_plan_prices` (`V3PlanPrice`) | id, planId, termMonths, amountPaise, currency (INR), taxInclusive, status `V3PriceStatus` (PROPOSED, APPROVED), effectiveFrom, createdAt, updatedAt | unique (planId, termMonths, effectiveFrom). termMonths 3, 6, 12 (1 only when setting `allowMonthly` is true). amountPaise integer >= 0. **FREE plans have no price rows** (a FREE subscription has `termMonths` null and never expires). Only APPROVED rows whose effectiveFrom is in the past are sold or shown publicly. |
| `g4d_features` (`V3Feature`) | id, key unique (dotted), name, group, kind `V3FeatureKind` (BOOLEAN, LIMIT, ENUM), unit, description, sortOrder | key format `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`. |
| `g4d_plan_features` (`V3PlanFeature`) | id, planId, featureKey, state `V3FeatureState`, limitValue int null, enumValue null, upsellText null, updatedAt | unique (planId, featureKey). featureKey references `g4d_features.key`. |
| `g4d_tax_rates` (`V3TaxRate`) | id, name, ratePercent decimal(6,3), appliesTo, active, validFrom, updatedAt | the highest-validFrom active row whose validFrom is past is used. |
| `g4d_discount_rules` (`V3DiscountRule`) | id, type `V3DiscountType` (TERM, PROMO, MIGRATION), name, percentOff decimal(6,3) null, amountOffPaise int null, conditions json, validFrom, validTo null, stackable, active, status `V3PriceStatus`, updatedAt | exactly one of percentOff and amountOffPaise. TERM rules carry `conditions: { termMonths }`. No payment code uses them yet; the pure function `priceQuote` resolves them. |
| `g4d_plan_settings` (`V3PlanSetting`) | key unique, valueJson, description, updatedAt | keys: `graceDays` (int, default 7), `allowMonthly` (bool, default false), `renewalReminderDays` (int array), `downgradeBehaviour` ("FALL_TO_FREE" or "KEEP_UNTIL_REPLACED"), `upgradeProration` ("NONE" or "PRORATE"), `registrationProvisioning` (bool, the global switch for the registration hook, default false) and `baseMonthlyPaise.<planKey>` (int, the base monthly-equivalent rate used to generate price rows). |
| `g4d_plan_subscriptions` (`V3PlanSubscription`) | id, vendorId (FK Vendor, cascade), planId (FK), status `V3SubscriptionStatus` (ACTIVE, GRACE, EXPIRED, CANCELLED), termMonths int null, startsAt, endsAt null, graceEndsAt null, source `V3SubscriptionSource` (REGISTRATION, SELF, STAFF, MIGRATION, PROMO), priceSnapshotJson, createdByType `V3ActorType` (SYSTEM, STAFF, VENDOR), createdById null, **currentVendorId null unique**, createdAt, updatedAt | At most one current subscription per vendor: `currentVendorId` equals `vendorId` while the row is current (ACTIVE or GRACE) and is NULL otherwise; the unique index makes a second current row impossible in the database. |
| `g4d_subscription_events` (`V3SubscriptionEvent`) | id, subscriptionId, vendorId (FK), type, fromPlanId null, toPlanId null, reason null, actorType, actorId null, at | append-only: no update or delete route and no update in code. |
| `g4d_entitlement_overrides` (`V3EntitlementOverride`) | id, vendorId (FK, cascade), featureKey, state, limitValue null, enumValue null, reason (required), expiresAt null, createdByStaffId, createdAt, updatedAt | an override wins over the plan until it expires. A vendor may have several rows over time; at most one non-expired row per feature is used (the newest). |
| `g4d_audit_logs` (`V3AuditLog`) | id, actorType, actorId null, action, entityType, entityId null, beforeJson null, afterJson null, ip null, at | append-only; written inside the same transaction as the change; secrets are never logged (values go through `redactSecrets`). |
| `g4d_vendor_flags` (`V3VendorFlag`) | id, vendorId (FK, cascade), key, enabled, updatedByStaffId null, updatedAt | unique (vendorId, key). Holds the per-vendor flag `v3_plans`. See decision D-2. |
| `Vendor` | + `source` text null, `registeredByStaffId` text null | provenance only. |

Every new table has row level security enabled in its migration (same rule as every public table; `db:staging:rls-off` must stay at 0). Vendor-scoped tables carry `vendorId`.

## 3. State machine

Stored subscription status is advisory; the **effective status** is computed from the dates and the settings every time (so a vendor never depends on a cron job):

```
FREE plan (endsAt null)                         -> ACTIVE forever
PRO, now <  endsAt                               -> ACTIVE
PRO, endsAt <= now < graceEndsAt                 -> GRACE   (graceEndsAt = endsAt + graceDays; stored when assigned)
PRO, now >= graceEndsAt, or stored CANCELLED     -> EXPIRED (falls to the same track's FREE plan features)
no current subscription, flag v3_plans off       -> LEGACY  (nothing V3 applies; no legacy behaviour changes)
no current subscription, flag v3_plans on        -> UNASSIGNED (all V3 features HIDDEN until staff assign a plan)
```

Transitions that write a subscription row and an event: REGISTRATION (free provisioning), STAFF assignment (new row; the previous current row is closed: status CANCELLED, currentVendorId null, event CHANGED), cancellation by staff. Renewal and self-purchase belong to slice 5.1b.

## 4. Precedence rules

For each feature key, the first that applies wins:
1. a non-expired **override** for the vendor (source OVERRIDE);
2. the **plan feature** of the effective plan (source PLAN; source STATUS when the effective plan is the FREE fallback caused by expiry, or when the vendor is UNASSIGNED/LEGACY);
3. the default: **HIDDEN** (source STATUS for unknown keys).

The effective plan is the vendor's own plan while ACTIVE or GRACE, the same track's FREE plan after expiry (setting `downgradeBehaviour` = FALL_TO_FREE) or still the PRO plan (KEEP_UNTIL_REPLACED). **Content is never deleted**: when `usage[key]` exceeds the limit the feature is returned as LIMITED with `overLimit: true` (existing items become read-only, new ones are refused).

## 5. Engine API

```
resolve(vendorId, { usage? })  -> { mode, plan, level, track, subscriptionStatus, graceWarning, features: { key: { state, limit, enumValue, upsellText, overLimit, source } } }
can(vendorId, key)             -> { allowed, state, limit, reason }          reason: null | FEATURE_LOCKED | FEATURE_HIDDEN | LIMIT_REACHED
assertWithinLimit(vendorId, key, currentCount)   throws 403 { code: LIMIT_REACHED, upsellText }
@RequiresFeature(key)          -> guard; 403 { code: FEATURE_LOCKED, upsellText }
toRenderEntitlements(resolved) -> { video, cart, booking, customDomain }     booleans for the theme kit
priceQuote(plan, termMonths, discounts, taxes) -> { baseMinor, discountMinor, taxableMinor, taxMinor, totalMinor, ... }
```

The pure core (`entitlement-engine.ts`, `pricing.ts`) has no database or Nest import; the Nest services load the data and call it. Cache: 30 seconds in process, keyed by vendor, cleared by any plan, feature, matrix, setting, override, flag or subscription write; a request memo (`req.entitlements`) so one request resolves once.

Renderer bridge pinned mapping: `video` = `site.video` ACTIVE; `cart` = `shop.cart` ACTIVE; `booking` = `site.booking` ACTIVE; `customDomain` = `site.custom_domain` ACTIVE and a verified domain exists (a later slice supplies it; until then the argument `hasVerifiedDomain` defaults to false, so `customDomain` is false). LIMITED, LOCKED_PREVIEW and HIDDEN are false.

## 6. Price generation and quotes

`generatePriceRows(plans, baseMonthlyPaise, termRules)`: for each PRO plan and term: `rupees = round_half_up(baseRupees x months x (100 - discountPercent) / 100)`, `amountPaise = rupees x 100`. With the seed's base rates (499, 999, 1499) and TERM rules (3: 0%, 6: 10%, 12: 20%) this yields Handyman Q 1497 / H 2695 / A 4790, Professional Q 2997 / H 5395 / A 9590, Ecommerce Q 4497 / H 8095 / A 14390 rupees (a test pins them). Change a percentage or a base rate in the seed (or in admin) and the rows regenerate; no price exists anywhere else.

`priceQuote`: base = price row; discounts are applied in order TERM, then PROMO, then MIGRATION; a non-stackable discount (when chosen) stops the chain at the best single one; a percentage is of the running amount; a fixed amount is capped at the running amount. Tax exclusive: `tax = round_half_up(taxable x rate)`, total = taxable + tax. Tax inclusive: `tax = taxable - round_half_up(taxable / (1 + rate))`, total = taxable. All values are integer paise.

## 7. API contract

All responses use the platform envelope `{ "success": true, "statusCode": 200, "message": "Success", "data": ..., "timestamp": "..." }`; examples show `data` only. Errors: `{ "success": false, "statusCode": 4xx, "message": "...", "code": "MACHINE_CODE" }`. Lists are paginated: query `?page=1&pageSize=25` (max 100), response `{ items, page, pageSize, total }`. Money is integer paise. Staff routes are checked by `AdminGuard` against the role matrix: reads SUPER_ADMIN and OPERATIONS, writes SUPER_ADMIN only; MARKETING is refused everywhere. Every write needs `expectedUpdatedAt` (the `updatedAt` last read) and is refused with 409 `STALE_WRITE` if the row changed.

### Public
`GET /v3/plans` (no login) -> `{ plans: [ { key, track, level, name, description, prices: [ { termMonths: 3, amountPaise: 149700, taxInclusive: false } ], features: [ { key, name, group, kind, state, limit, enumValue, upsellText } ] } ], terms: [3, 6, 12] }`. Only ACTIVE public plans, APPROVED prices, and feature rows whose state is not HIDDEN. Nothing internal (no ids, no settings, no overrides).

### Vendor (any vendor login; team members allowed to read)
- `GET /v3/me/entitlements` -> `{ mode: "V3", track: "HANDYMAN", level: "FREE", plan: "handyman_free", subscriptionStatus: "ACTIVE", graceWarning: false, features: { "site.video": { "state": "LOCKED_PREVIEW", "limit": null, "enumValue": null, "upsellText": "Add video with Pro", "overLimit": false, "source": "PLAN" } }, render: { video: false, cart: false, booking: false, customDomain: false } }`
- `GET /v3/me/subscription` -> `{ id, plan: { key, name, track, level }, status, termMonths, startsAt, endsAt, graceEndsAt, source, price: { amountPaise, currency, taxInclusive } | null }` or `{ subscription: null, mode: "LEGACY" }`.
- `GET /v3/me/subscription/events` (paginated) -> `{ items: [ { type: "ASSIGNED", fromPlan: null, toPlan: "handyman_free", reason: null, actorType: "SYSTEM", at } ] }`.

### Staff reads (SUPER_ADMIN, OPERATIONS)
- `GET /v3/admin/plans` -> `{ items: [ plan ] }`; `GET /v3/admin/plans/:id` -> plan with prices and feature rows.
- `GET /v3/admin/plans/:id/prices`; `GET /v3/admin/features`; `GET /v3/admin/plans/:id/features`; `GET /v3/admin/tax-rates`; `GET /v3/admin/discount-rules`; `GET /v3/admin/plan-settings`; `GET /v3/admin/audit-logs?entityType=&entityId=`.
- `GET /v3/admin/vendors/:id/subscription` -> `{ current, history: [ ... ], events: [ ... ] }`; `GET /v3/admin/vendors/:id/overrides`.
- `GET /v3/admin/vendors/:id/entitlements` -> the vendor resolve result plus, per feature, `why`: `{ source, planKey, overrideId, overrideReason, overrideExpiresAt }`.

### Staff writes (SUPER_ADMIN only; each writes `g4d_audit_logs` with before and after)
- `POST /v3/admin/plans` body `{ key, track, level, name, description?, status?, isPublic?, sortOrder? }` -> plan. `PUT /v3/admin/plans/:id` body `{ expectedUpdatedAt, name?, description?, status?, isPublic?, sortOrder? }` (key, track, level are immutable). `DELETE /v3/admin/plans/:id` -> `{ deleted: true }` or 409 `PLAN_IN_USE` (retire instead).
- `POST /v3/admin/plans/:id/prices` body `{ termMonths, amountPaise, taxInclusive?, status?, effectiveFrom? }`; `PUT /v3/admin/prices/:priceId` body `{ expectedUpdatedAt, amountPaise?, taxInclusive?, status?, effectiveFrom? }`; `DELETE /v3/admin/prices/:priceId`. Refused: negative or fractional amount (400 `INVALID_AMOUNT`), a term not in (3, 6, 12) unless `allowMonthly` (400 `INVALID_TERM`), a price on a FREE plan (400 `FREE_PLAN_HAS_NO_PRICE`). Existing subscriptions keep their own snapshot, so editing or deleting a price never changes what a vendor already bought.
- `POST /v3/admin/features` body `{ key, name, group, kind, unit?, description?, sortOrder? }`; `PUT /v3/admin/features/:key`; `DELETE /v3/admin/features/:key` (409 `FEATURE_IN_USE` when a matrix cell or override uses it).
- `PUT /v3/admin/plans/:id/features` (bulk matrix save) body `{ expectedUpdatedAt, rows: [ { featureKey, state, limitValue?, enumValue?, upsellText? } ] }` -> the saved rows; one transaction; rows not listed are left alone.
- `POST /v3/admin/tax-rates`, `PUT /v3/admin/tax-rates/:id`, `DELETE /v3/admin/tax-rates/:id`; `POST /v3/admin/discount-rules`, `PUT /v3/admin/discount-rules/:id`, `DELETE /v3/admin/discount-rules/:id`; `PUT /v3/admin/plan-settings/:key` body `{ expectedUpdatedAt?, valueJson, description? }` (value validated per key).
- `POST /v3/admin/vendors/:id/subscription` body `{ planKey, termMonths?, endsAt?, reason }` (reason required; FREE plans take no term) -> the new subscription; source STAFF; closes the previous current row; writes an event and an audit row; invalidates the cache.
- `POST /v3/admin/vendors/:id/overrides` body `{ featureKey, state, limitValue?, enumValue?, reason, expiresAt? }`; `PUT /v3/admin/overrides/:overrideId`; `DELETE /v3/admin/overrides/:overrideId` (sets `expiresAt` to now: overrides are expired, not erased, so the audit trail stays complete).
- `PUT /v3/admin/vendors/:id/flags/v3_plans` body `{ enabled }` -> the flag row.

Error codes: `STALE_WRITE` 409, `PLAN_IN_USE` 409, `FEATURE_IN_USE` 409, `INVALID_AMOUNT` 400, `INVALID_TERM` 400, `FREE_PLAN_HAS_NO_PRICE` 400, `REASON_REQUIRED` 400, `UNKNOWN_PLAN` 404, `UNKNOWN_VENDOR` 404, `FEATURE_LOCKED` 403, `LIMIT_REACHED` 403.

## 8. Names that differ from the slice spec, and why

| Spec | Built | Why |
|---|---|---|
| model names `Plan`, `PlanPrice`, ... | `V3Plan`, `V3PlanPrice`, `V3PlanFeature`, ... | Prisma names must be unique: `Plan`, `SubStatus` and others already exist as enums or models. Table names (`@@map`) are exactly the spec's. |
| enum names `track`, `level`, `status`, ... | `V3PlanTrack`, `V3PlanLevel`, `V3PlanStatus`, `V3PriceStatus`, `V3FeatureKind`, `V3FeatureState`, `V3DiscountType`, `V3SubscriptionStatus`, `V3SubscriptionSource`, `V3ActorType` | same reason |
| partial unique index on (vendorId) where status in (ACTIVE, GRACE) | nullable unique column `currentVendorId` | Prisma cannot express a partial index and a hand-written one would show as drift in `db:staging:drift`; a nullable unique column enforces the same rule and stays in the schema. |
| per-vendor flag `v3_plans` in "the repo's existing flag mechanism" | new table `g4d_vendor_flags` | the existing mechanism is the `VendorAddon` row (`site_doc_v2`), a legacy table that stop-line 5 forbids V3 code to read or write. |
| price rows listed in the seed | the seed holds base rates and TERM discount rules; price rows are generated | the owner's instruction: no price exists except by the generator. |
| `g4d_plan_prices.taxInclusive` | kept, default false | prices are shown without GST and tax is added in the quote. |
| `createdById`, audit `actorId` | plain text, no foreign key | actors are vendors, staff members or the seeded admin vendor row. |
| tax row | GST 18 percent, exclusive | taken from the older docs; the owner confirms (open question). |

## 9. Decision log

- **D-1** The effective status is computed from dates, not stored and trusted, so expiry needs no scheduled job.
- **D-2** The vendor flag lives in V3's own table (stop-line 5 beats "use the existing mechanism").
- **D-3** FREE plans have no price rows; a FREE subscription has `termMonths` null.
- **D-4** Optimistic concurrency by `updatedAt` on every admin PUT; writes and audit rows share one transaction.
- **D-5** Overrides are never deleted by the API; DELETE expires them.
- **D-6** `UNASSIGNED` (flag on, no subscription) is a third mode so staff can see which flagged vendors still need a plan.
- **D-7** The registration hook is switched by the plan setting `registrationProvisioning` (there is no vendor yet at that moment) and never blocks or fails registration.
- **D-8** Seed values are the owner's file: the engine reads whatever is in the tables; nothing in code names a price, limit or state.
- **D-9** Staging integration tests need `.env.staging`; in this build session the file could not be copied into the worktree, so migration application and the integration tests are written and ready but must be run by the owner (commands in `S51_LOG.md`).
