# Dispatch report K1: admin overview API

Branch `v3-lane-k1` (from `v3-lane-b5`). Two commits, not pushed. No schema change and no migration, so `verify-migrations-additive` had nothing to check. Read only: the endpoint writes nothing.

## What was built

`GET /v3/admin/overview` in `backend-api/src/v3-admin-overview/`:

| File | Job |
|---|---|
| `overview-core.ts` | Pure parts: role to sections table, India-time month and day edges, series filling |
| `admin-overview.service.ts` | The queries, the per-section cache |
| `admin-overview.controller.ts`, `admin-overview.module.ts` | Route (AdminGuard) and wiring; module added to `app.module.ts` |

Route matrix entry `'GET /v3/admin/overview': SUPER_ADMIN, OPERATIONS, MARKETING` (ADMIN inherits OPERATIONS). `test/admin-role-matrix.spec.ts` oracle updated (439 routes).

## Choices I made (details left to me)

1. **FINANCE is not a staff role in this build** (`AdminRole` has no such value, and adding one is an enum migration plus a business decision). `SECTIONS_BY_ROLE` already has a `FINANCE: ['revenue']` entry, so when the role exists it is one line in the route matrix. Until then nobody can reach the route as FINANCE.
2. **Sections per role** follow what each role already reads elsewhere:
   - SUPER_ADMIN, ADMIN, OPERATIONS: all six sections.
   - SALES (MARKETING, and its labels FIELD_EXECUTIVE and TELECALLER): `vendors`, `enquiries`, `referrals`. No money, no tickets, no domain or service queues.
   - SUPPORT: refused at the route (not in your role list).
3. **Customers only**: vendor counts use `role = VENDOR` and `isSandbox = false` (staff rows and demo sandboxes are excluded).
4. **"By plan"** counts the vendor's current subscription (`currentVendorId` set). `free` is the sum of the Free plans, `pro` lists each Pro plan, `freeByTrack` lists each Free plan, `noPlan` is vendors with no current subscription.
5. **Sites**: `live` = a current PUBLISHED publication; `failed` = `Vendor.siteProvisionStatus = FAILED`; `provisioning` = provisioning jobs QUEUED, RUNNING or WAITING.
6. **Revenue** = plan orders with status PAID, by `paidAt`, in India-time months (UTC+5:30). `grossPaise` = amount paid; `gstPaise` = the invoice's stored `taxBreakdown.taxMinor`; `netOfGstPaise` = gross minus GST. Also wallet top-ups (PAID) and refunds (recorded refunds on plan orders, by `refundRecordedAt`). Domain and service charges are wallet spending, not new revenue sources here, so they are not added.
7. **Payments off** means `paymentsMode = off`: `revenue` is `null` (key present) and `dailySeries.paidOrders` is `null`. The off answer is never cached, so switching payments on shows real figures at once. In `test` mode the figures are real rows from test payments.
8. **Enquiries** = `g4d_requests` excluding SPAM. **Held** = inbox messages in state HELD (the same meaning as the existing held-count). **Held duplicates** = duplicate reviews still PENDING.
9. **Open ticket** = status OPEN, IN_PROGRESS or WAITING_VENDOR.
10. **Cache**: per section, 60 seconds, shared by all roles and callers, in memory per API instance. A failed read is not kept. `generatedAt` is the oldest section time in the answer.
11. **Queries**: counts, aggregates and one grouped query per series (no per-row loops). Seven or so reads run in parallel for a full answer.

## Response shape (for the K2 screen)

Absent = not allowed for the role. `null` = allowed but not available (payments off). All money is paise. All ages are whole minutes.

```jsonc
{
  "generatedAt": "2026-11-19T10:00:00.000Z",
  "cacheSeconds": 60,
  "sections": ["vendors","revenue","enquiries","support","domainsServices","referrals"],   // what this role received

  "vendors": {
    "total": 0, "new7Days": 0, "new30Days": 0,
    "byPlan": {
      "free": 0,
      "pro": [{ "planKey": "handyman_pro", "name": "…", "track": "HANDYMAN", "level": "PRO", "vendors": 0 }],
      "freeByTrack": [{ "planKey": "handyman_free", "name": "…", "track": "HANDYMAN", "level": "FREE", "vendors": 0 }],
      "noPlan": 0
    },
    "sites": { "live": 0, "failed": 0, "provisioning": 0 }
  },

  "revenue": null | {
    "currency": "INR", "timezone": "Asia/Kolkata",
    "thisMonth": { "paidOrders": 0, "invoices": 0, "grossPaise": 0, "gstPaise": 0, "netOfGstPaise": 0,
                   "walletTopups": { "count": 0, "paise": 0 }, "refunds": { "count": 0, "paise": 0 } },
    "lastMonth": { /* same fields */ }
  },

  "enquiries": { "captured7Days": 0, "captured30Days": 0, "held": 0, "heldDuplicatesWaitingReview": 0 },
  "support": { "openTickets": 0, "oldestOpenAgeMinutes": null },
  "domainsServices": {
    "domainOrders": { "pending": 0, "failed": 0 },
    "serviceQueue": { "waiting": 0, "inProgress": 0, "readyForReview": 0, "slaBreached": 0, "oldestWaitingAgeMinutes": null }
  },
  "referrals": { "partners": { "active": 0, "new7Days": 0, "new30Days": 0 }, "commissionsPending": { "count": 0, "amountPaise": 0 } },

  "dailySeries": {                       // each series appears only with its section; 30 days, oldest first, India-time days, zeros filled
    "vendors":    [{ "date": "2026-10-21", "count": 0 }, …],
    "enquiries":  [ … ],
    "paidOrders": null | [ … ]
  }
}
```

Screen notes for K2: render a section only if its key exists; show "Payments are off" when `revenue === null`; show "none" when an age is `null`; format paise as rupees on the client; use `generatedAt` for a "Updated at" label and refresh no faster than every 60 seconds; the `sections` array is the quick way to decide which cards to draw. The route answers 403 for SUPPORT and for a non-staff caller.

## Verification

- Unit: `test/k1-admin-overview.spec.ts` (22 tests): role filtering for every role, empty database (all zeros, null ages, 30 zero days), real rows flowing through, payments off (and not kept), cache hit and expiry, failed read not kept, query count fixed regardless of data, India-time helpers, the SQL time-zone rule, controller role passing. `admin-role-matrix` and `staff-vendor-access` specs pass (518 tests across the three).
- Build check: `tsc --noEmit -p tsconfig.build.json` clean.
- **Staging**: `node scripts/staging/k1-check.js` ran against staging, **all checks passed**. It compares the numbers with direct counts, checks role filtering and payments off on the real service, then adds a vendor, a paid order with invoice, a refund and a ticket inside a transaction that is rolled back (nothing kept; it confirms no row remains) and checks each number moves exactly as expected (11800 gross, 1800 GST, 10000 before GST).
- The staging check caught one real bug that the mock tests could not: the day series first read the stored UTC time as India time. Fixed (`(col AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata'`) and a test now guards the SQL text.

## What to run on live (nothing to migrate)

1. Deploy the backend build of `v3-lane-k1` (after the merge you choose). No migration, no environment variable, no flag.
2. Smoke as SUPER_ADMIN: `GET /v3/admin/overview` returns six sections and `dailySeries` with 30 days. Compare `vendors.total` with the vendors list count.
3. While `paymentsMode` is `off`, `revenue` must be `null`. After payments are switched on, the next call (no waiting) shows real revenue figures.
4. As a SALES login the answer must have only `vendors`, `enquiries`, `referrals`; as SUPPORT the call must be 403.
5. If the page is slow, look at the `INFO overview answered in … ms` line from `k1-check.js` (about 1.9 s cold on staging with an empty vendor table); repeat calls within 60 seconds are served from memory.

Known limits: the cache is per API instance (two instances may each recompute once a minute); the revenue block covers plan orders and wallet top-ups only; no FINANCE login exists until the role is added.
