# Batch 5 run log (slices 5.17a, 5.17b, 5.17d; 5.17c skipped)

Worktree `C:\Get4Domain\get4domain-b5`, branch `v3-b5`, from `origin/v3-b4b` (`bcc2ca0`). Dispatch `docs/v3/stages/STAGE_09_PAYMENTS_BATCH_5.md` with Owner Amendment 06. No push. No `.env.staging` here, so staging steps are written and marked NOT RUN.

## Gate check
`git fetch` ran. `origin/v3-b4b` exists at `bcc2ca0` (its FINISH commit). The owner's note says it passed staging and is pushed. Gate satisfied.

## Slice 5.17c: SKIPPED BY OWNER DECISION
Amendment 06: vendors are UPI only. No gateway port, adapters or webhook inbox are built in this run.

## B5.0 rules document
`docs/v3/V3_PAYMENTS_AND_RECEIPTS.md`.

## Slice 5.17a: DONE (payment methods, UPI only)
Red first: `test/payments-methods-service.spec.ts` failed to compile (service and world had no UPI fields, `setDefaultMethod`, `vendorMethods`), then went green (17 tests).
Built: migration `20261125100000_v3_payment_methods_upi` (additive: `upiId`, `payeeName`, `isDefault`, `showToCustomers` on `g4d_vendor_payment_methods`, plus a partial unique index, one default per vendor; the table's RLS is unchanged). Store port, Prisma store and memory twin. Service: UPI needs id and payee name; gateway kinds rejected on create and every legacy gateway row hidden from owner and staff responses and refused on update, test and default; changing the UPI id needs `confirmUpiChange`, drops the method to UNVERIFIED and records `payment_method.upi_changed` (field names only), which the PAYMENT_METHOD_CHANGED rule now also matches; the payee-name check runs and never blocks; bank details sealed, shown to customers only with `showToCustomers`. Routes: `POST /v3/me/payment-methods/:id/default`, `GET /v3/admin/vendors/:vendorId/payment-methods` (OPERATIONS and SUPER_ADMIN, masked, read only; MARKETING denied). Route baseline, role matrix and classification updated. `test/b5-isolation.spec.ts` added (legacy, Redis, names, pure cores, no gateway port or webhook route in v3-payments).
Staging test written, NOT RUN (no .env.staging here): `test/payments-methods.int.spec.ts`.
Decisions: (1) existing 5.14 tests that created OWN_GATEWAY through the service were changed to the amendment (bank details or UPI); the webhook tests keep their gateway row through a store-level helper `legacyGateway`, so no webhook test was removed. (2) `paymentReadiness` is unchanged; the public order service filters gateway rows out before it. (3) The sandbox "test" of a UPI method passes when a UPI id is stored.
Gates at slice end: lint and tsc clean, build ok, verify:migrations 44/44, verify:migrations-additive ok, verify:raw-sql ok, unit 135 suites / 2785 tests green (was 133 / 2762).

## Slice 5.17b: DONE (pay pages and payments, UPI only)
Red first: `test/payments-pay-core.spec.ts` failed (module missing), then green (26). Service spec `test/payments-requests-service.spec.ts` (16 tests) green on the first run after the build.
Built: pure core `src/v3-payments/core/pay-core.ts` (amount string from integer paise without floating point, UPI intent builder pa/pn/am/tn/cu, optional UPI reference validator, state machine, pay code from random bytes). Migration `20261126100000_v3_payment_requests` (additive: enums `V3PaySource`, `V3PayStatus`, `V3PaymentConfirmedBy`; tables `g4d_payment_requests`, `g4d_payments`; RLS on, no policy, like every public table). New module `PayRequestsModule` (`src/v3-payments`): store port, Prisma store, service, controllers, expiry cron (5 minutes). New staff-set setting `payLinkExpiryHours` with NO default: a request cannot be created until staff set it (409 `PAY_LINK_EXPIRY_NOT_SET`). New message template `payment_said_paid_vendor` (sandbox outbox).
Routes: owner (OWNER ONLY, feature `payments.vendor_methods`, Free gets 403) `POST/GET /v3/me/payment-requests`, `GET /:id`, `POST /:id/cancel`, `POST /:id/mark-paid`; public (rate limited, no-store) `GET /v3/public/pay/:code`, `POST /v3/public/pay/:code/i-have-paid`.
Rules proved: the customer tap gives CUSTOMER_SAYS_PAID and never PAID; Mark as paid is idempotent and makes one payment row (also under two simultaneous calls) and marks the linked order PAID once with one invoice; expired and cancelled links are a 410; unknown code, Free vendor, suspended, removed and Legal takedown are one plain 404; the public page carries no phone and no customer name; vendor B cannot read, cancel or mark paid vendor A's request or use A's method.
Decisions: (1) the 5.14 vendor-gateway webhook route is now OFF unless `VENDOR_GATEWAY_WEBHOOK_ENABLED=true` (plain 401 otherwise), so Mark as paid is the only route to Paid; the 5.14 webhook tests turn it on in their harness and a new test proves the default. (2) The UPI reference is 8 to 22 letters and digits, optional. (3) Expiry applies to AWAITING only; a request the customer said they paid does not expire by itself. (4) An EXPIRED request can still be marked paid by the vendor (a late payment is a fact); CANCELLED cannot. (5) An order's pay request is made by the owner (`orderId`), not automatically at checkout.
OPEN QUESTIONS for the owner: whether (4) is wanted; whether checkout should create the pay request automatically; the wording of the pay page text (it is plain data; the page copy belongs to the site renderer).
Staging test written, NOT RUN: `test/payments-requests.int.spec.ts`.
Gates at slice end: lint and tsc clean, build ok, verify:migrations 45/45, verify:migrations-additive ok, verify:raw-sql ok, unit 138 suites / 2834 tests green (one DI-metadata failure found by the full run and fixed: `Pick<>` types compile to Object, real classes now).
