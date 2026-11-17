# Dispatch A4 status (backend lane, branch v3-smoke2)

| Job | State | Commit | One line |
|---|---|---|---|
| Q0 | DONE | (with Q1) | Findings below. No code. |
| Q1 | DONE | see report | Detail route was already correct (probe artifact); pinned with real-stack tests; businessName added to list rows and detail. |
| Q2 | TODO | | Theme contract. |
| Q3 | TODO | | Tax-rate create: no back-dated start. |
| Q4 | TODO | | Staging cleanup of V3TEST tax rows (not run). |
| Q5 | TODO | | Vendor-site model: document, themeKey if free. |
| Q6 | TODO | | Final checks and report. |

## Q0 findings

### (a) Held-payment detail "let in" for OPERATIONS, SALES, a partner and a vendor
`GET /v3/admin/billing/held-payments/:id` is on `HeldPaymentsAdminController`, which carries `@UseGuards(AdminGuard)` at class level. Nest runs guards before pipes and before the handler, so the order for every request is:
global `ThrottlerGuard` -> global `JwtAuthGuard` (401 with no or a bad token) -> `ModuleGuard` -> `RetiredModuleGuard` -> `PartnerScopeGuard` -> class `AdminGuard` (403) -> pipes -> handler -> `HeldPaymentsService.detail(id)` (the only place an id is looked up).
`:id` has no pipe and no DTO, so a malformed id is never parsed before the role check. `AdminGuard` is not id-aware: it asks only "is this a staff principal" and "does the matrix allow this role on `GET /v3/admin/billing/held-payments/:id`" (SUPER_ADMIN base, ADMIN by the extension; every other role refused). So a non-admin role gets 403 for a real, an unknown and a malformed id alike, and an anonymous caller gets 401. The earlier staging test (real id) and the list route agree. **I found no code path that lets a non-admin role reach the lookup or see a different answer than 403.** The front-end probe's "let in" was therefore a probe artifact (most likely the probe counted any answer that was not its expected status, or ran with tokens that were really ADMIN or SUPER_ADMIN; the real API was not running here, so I could not replay it). Q1 pins this with real-stack tests.

For an admin, an unknown id answers 404 `HELD_PAYMENT_NOT_FOUND` (from the service), and so does an order that is not held.

### (b) Where the THEME_SWITCH price is set
The price book. The service `THEME_SWITCH` is seeded with ONE PROPOSED price row (29,900 paise, the owner-approved figure, before GST) that is not in force until approved.
- Read the row id: `GET /v3/admin/services/THEME_SWITCH` (all staff; MARKETING sees no prices) lists its `prices`.
- Propose a new price: `POST /v3/admin/services/THEME_SWITCH/prices` body `{ "amountPaise": <int 1..1000000000>, "taxCategory"?: string(40), "taxInclusive"?: boolean, "note"?: string(300) }`. **SUPER_ADMIN only** (matrix; the controller comment says OPERATIONS but the matrix, which AdminGuard enforces, says SUPER_ADMIN, and ADMIN is denied in the extension).
- Edit a PROPOSED price: `PUT /v3/admin/services/prices/:id` `{ amountPaise?, taxCategory?, taxInclusive?, note? }`, SUPER_ADMIN only.
- Approve: `POST /v3/admin/services/prices/:id/approve` body `{ "effectiveFrom": "<ISO 8601 date>" }`, SUPER_ADMIN only; the date must not be in the past and must be later than the price in force. Until approval the fee is PENDING and is never a number.
- Retire: `POST /v3/admin/services/prices/:id/retire`, SUPER_ADMIN only.
So an admin route exists; Q2 adds no route.

### (c) Theme route shapes
Written out in full in `API_CONTRACT_WAVE4.md` section A4-2 (Q2).

## ASSUMPTIONS
1. Q0(a): treated as a probe artifact because the code path is provably guard-first; if the front-end can reproduce it with a recorded request and the principal's real role, send me that request.
2. The route baseline file had an uncommitted change when this lane started (from before A4); it is regenerated in Q6 so the final diff is whatever the code really produces.

## QUESTIONS FOR THE OWNER
- None yet.
