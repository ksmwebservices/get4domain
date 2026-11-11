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
