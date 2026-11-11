# Stage 9 design: UPI payments, pay requests, receipts and invoices

Branch `v3-b5` (slices 5.17a, 5.17b, 5.17d; 5.17c skipped by the owner; Pro on credit deferred to Release 2). Governing documents: `docs/v3/stages/STAGE_09_PAYMENTS_BATCH_5.md` and Owner Amendment 06 (UPI only for vendors; Mark as paid is the only route to Paid). The plain-language rules are in `docs/v3/V3_PAYMENTS_AND_RECEIPTS.md`; the route contract is in `docs/v3/V3_API_DOCUMENTATION.md` (section "Stage 9"); the build log is `docs/v3/B5_LOG.md`. This file describes the code as it is now.

## 1. The payment flow

1. The vendor (owner only) has an ACTIVE, default UPI method. They create a **pay request** for an amount (`POST /v3/me/payment-requests`), by hand or for one of their orders.
2. The customer opens the pay link (`GET /v3/public/pay/:code`), pays the vendor directly in their own UPI app (the page returns the `upi://pay` intent and the same text as the QR payload), then taps **I have paid** (`POST /v3/public/pay/:code/i-have-paid`, optional UPI reference).
3. The tap moves the request to `CUSTOMER_SAYS_PAID` and tells the vendor (message template `payment_said_paid_vendor`). **It never marks anything paid.**
4. The vendor checks their own bank or UPI app and taps **Mark as paid** (`POST /v3/me/payment-requests/:id/mark-paid`). Only now does the request become `PAID`, one payment row is written, the linked order (if any) is marked paid, and the receipt or invoice is issued in the vendor's name (section 4).

Get4Domain never receives, holds or moves the money. There is no provider call anywhere in this flow. The plan amount for a vendor's own subscription is a different system (Batch 1 plan billing) and is not touched.

**Gap to flag (not fixed, documentation only):** the pay page copy that says "you pay the business directly, Get4Domain does not receive your money" belongs to the page renderer, not to this API. The public pay response carries the business name, payee name, amount, note, QR payload, state and expiry, but **no notice text field**. The statement must be added to the page (or the response) before launch; see section 9.

## 2. Payment methods (slice 5.17a)

Table `g4d_vendor_payment_methods` (existing from 5.14), four additive columns: `upiId`, `payeeName`, `isDefault` (default false), `showToCustomers` (default false), plus a partial unique index `g4d_vendor_payment_methods_one_default_idx` on `(vendorId) WHERE isDefault`, so the database allows one default per business.

- Kinds a vendor can create: `UPI`, `PAY_ON_DELIVERY`, `PAY_AT_VISIT`, `BANK_TRANSFER`. Gateway kinds (`OWN_GATEWAY`, `GATEWAY_*`) are refused with 400 `PAYMENT_METHOD_INVALID`, and rows left by an earlier build are hidden from every owner, staff and public response; asking for one answers like a row that does not exist.
- A UPI method needs a valid UPI id (`name@bank`, stored trimmed and lower case) and a payee name (spacing folded, no markup). Bank transfer needs `details` (write-only, sealed).
- States: `UNVERIFIED` (new, or after a UPI id change) → `ACTIVE` (after the sandbox test and the terms) → `DISABLED`. A default must be `ACTIVE`.
- **Changing a UPI id** needs `confirmUpiChange: true`; without it, 409 `PAYMENT_METHOD_CONFIRM_REQUIRED` and nothing changes. With it the id changes, the method drops to `UNVERIFIED`, and the activity entry `payment_method.upi_changed` is written (section 7).
- The payee name is checked through a port (a fake in this build). A mismatch is returned as information (`payeeCheck: MISMATCH`) and never blocks.
- Staff see methods read-only with the UPI id masked (`pr•••@bank`), never bank details or secrets.

## 3. Payment requests and payments (slice 5.17b)

Tables (migration `20261126100000_v3_payment_requests`): `g4d_payment_requests` (id, vendorId, `code` unique, amountPaise, note, customerName, customerPhone, source `MANUAL|REQUEST|ORDER`, requestId, orderId, methodId, status, expiresAt, customerSaidAt, customerUtr, createdBy, timestamps) and `g4d_payments` (one per request: `paymentRequestId` unique, amountPaise, level 1, provider `UPI_MANUAL`, providerPaymentId, utr, `confirmedBy` `VENDOR|GATEWAY`, confirmedAt, `idempotencyKey` unique per vendor). Enums `V3PaySource`, `V3PayStatus`, `V3PaymentConfirmedBy`. Money is whole paise (integer) everywhere; the amount text is built without floating point.

Public code: 24 characters from a 32-letter alphabet (no look-alike letters), unguessable, unique.

### Allowed transitions (`nextPayStatus`, `core/pay-core.ts`)

| From | Event | To |
|---|---|---|
| AWAITING | customer taps "I have paid" | CUSTOMER_SAYS_PAID |
| AWAITING | expiry job, `expiresAt` passed | EXPIRED |
| AWAITING, CUSTOMER_SAYS_PAID | vendor cancels | CANCELLED |
| AWAITING, CUSTOMER_SAYS_PAID, **EXPIRED** | vendor marks paid | PAID |
| PAID | vendor marks paid again | PAID (idempotent: same payment, nothing new) |
| CANCELLED | anything | refused (final); PAID and EXPIRED also refuse cancel |

Every change is compare-and-set in the store (`updateMany ... WHERE status IN (...)`), so two simultaneous changes cannot both win. `confirmPaid` runs in one transaction: it flips the status and inserts the payment row together. A request the customer said they paid does not expire by itself.

The expiry window is the B3 setting `payLinkExpiryHours`, which has **no default**: until staff set it, creating a request returns 409 `PAY_LINK_EXPIRY_NOT_SET`. The expiry job (`PaymentsCron`, every 5 minutes) is safe to repeat and to run twice.

Only the vendor's own owner session can create, list, cancel or mark paid (`VendorOwnerGuard`, plan feature `payments.vendor_methods`; a Free vendor gets 403, a team member 403).

## 4. Receipts and invoices (slice 5.17d)

Tables (migration `20261127100000_v3_receipts_invoices`): `g4d_vendor_tax_profiles` (one per vendor: gstRegistered, gstin, stateCode, legalName, address, compositionScheme, invoicePrefix default `INV`), `g4d_invoice_series` (vendorId + periodKey unique, prefix, nextNumber), `g4d_vendor_documents` (kind, number, seq, periodKey, `paymentId` unique, customer snapshot, items, tax, totalPaise, pdfRef, `publicCode` unique, whatsapp and email send state, resendCount, flags) and `g4d_outbox` (idempotent message log with a hashed and a masked address, never the raw phone). Enums `V3DocKind` (`TAX_INVOICE`, `BILL_OF_SUPPLY`, `BILL`, `FEE_RECEIPT`) and `V3SendStatus`.

- **One document per payment**: `paymentId` is unique. Marking paid twice, or a repeat of the document step, returns the first document and sends nothing new.
- **Type** follows the tax profile: not registered → `BILL` (a Professional-plan vendor → `FEE_RECEIPT`); registered and composition → `BILL_OF_SUPPLY`; registered → `TAX_INVOICE`.
- **Tax** is exact paise: CGST and SGST for the same state, IGST for another state; an unknown customer state is assumed same-state and flagged `assumedIntraState`; an odd paise goes to SGST. The document total must equal what was paid, otherwise no document is made. A tax invoice is made only when the lines carry their own tax (an order). A **registered vendor's manual payment** has no tax rate to use, so **no document is made**, the payment stands, and the activity entry `document.needs_tax_rate` is written. Nothing guesses a rate.
- **Number**: `PREFIX + financial year + "-" + 5 digits` (for example `INV2627-00001`), at most 16 characters, gap-free per vendor and financial year (April start, India time). The series row is bumped in the same transaction as the document insert, so a failed write gives the number back; a per-vendor queue serialises creators before any transaction opens. 13 payments confirmed at once give 13 numbers with no gap and no repeat.
- **Sending**: WhatsApp and e-mail carry a public link only (business, kind, number, amount, link). Messages and the PDF go through fake ports in this build; a live attempt is recorded `FAILED` plainly. Resend uses a new attempt number so the idempotent outbox sends again.
- **Public page** `GET /v3/public/doc/:code`: business, lines, tax, total; no phone number, no e-mail; one plain 404 for anything that must reveal nothing.
- A fault in any of this never undoes the payment.
- The 5.14 order invoice (`g4d_vendor_invoices`) is untouched and still created for an order; see section 9.

## 5. Mark as paid is the only route to Paid

- The customer's tap cannot reach `PAID` (state machine, tested in the unit and staging suites).
- No webhook can reach it: the 5.14 vendor-gateway webhook (`POST /v3/payments/vendor/:vendorId/:methodId`) answers a plain 401 unless `VENDOR_GATEWAY_WEBHOOK_ENABLED=true`. **Leave it unset.** Nothing in this build sets it; the 5.14 webhook tests turn it on only inside their own harness, and a test proves the default is off.
- Gateway method kinds cannot be created, so there is no secret for a webhook to verify against anyway.

## 6. Late payments (flagged)

An `EXPIRED` request can still be marked paid by the vendor (money can arrive late and the vendor is the source of truth). `CANCELLED` cannot. The pay page itself returns 410 `PAY_LINK_EXPIRED` for an expired link, so a customer cannot start a new payment on it. This is a decision of mine, logged in `B5_LOG.md` as an open question: say if you want it refused instead (a one-line change in `nextPayStatus` and `confirmPaid`).

## 7. Security

- **RLS is on** for `g4d_payment_requests`, `g4d_payments`, `g4d_vendor_tax_profiles`, `g4d_invoice_series`, `g4d_vendor_documents` and `g4d_outbox` (enabled, no policy; the application connects with a role that bypasses it, as for every V3 table). `db:staging:rls-off` is the check.
- **Tenant isolation**: the vendor id comes only from the signed-in principal, and every store read or write has `vendorId` in its WHERE. A foreign id and a missing id give the same 404 and the same code (`PAY_REQUEST_NOT_FOUND`, `PAYMENT_METHOD_INVALID`). Cross-tenant tests: `b5-isolation.spec.ts` (unit) and, on staging, `payments-methods.int`, `payments-requests.int` and `payments-documents.int` (vendor B cannot read, cancel, mark paid, resend or download vendor A's request, document or method, nor create a request on A's method).
- **Public routes** are rate limited, set no cookie, send `Cache-Control: no-store`, and look rows up only by the unguessable code. A suspended or removed vendor, a Legal takedown and a Free vendor are all one plain 404.
- **No phone number or e-mail** in the public pay response, the public document response or the outbox payload.
- **Activity**: `payment_method.upi_changed` is written for a confirmed UPI change and for a default change (field names only, e.g. `{ changed: ['upiId'] }`). **The UPI value is never stored in it**, and the activity masker also hides secrets. The alert rule `PAYMENT_METHOD_CHANGED` matches it. Other entries: `payment_request.created|cancelled|customer_says_paid`, `payment.marked_paid`, `document.issued|resent|needs_tax_rate`, `tax_profile.updated` (field names only). The wiring test `payments-wiring.spec.ts` proves the real `ActivityService` reaches the three Stage 9 services (it is an optional dependency, so a missing provider would drop entries silently).
- **Per-vendor queue**: `payQueue` (pay requests) and `docQueue` (documents), both a `KeyedQueue`, wait **before** any database transaction opens, as stop-line 7 requires. No Redis or BullMQ.
- **Staff**: the only staff route is `GET /v3/admin/vendors/:vendorId/payment-methods` (OPERATIONS and SUPER_ADMIN, read only, masked). MARKETING is refused.
- Nothing here touches legacy billing, wallet, BOS, commercial, domain-campaign, vendor-payments or menu-gating tables or constants.

## 8. Routes

See `docs/v3/V3_API_DOCUMENTATION.md`, section "Stage 9". 21 routes: 6 owner payment-method (list, create, update, disable, set default, test), 1 staff read, 5 owner pay-request, 2 public pay, 6 owner tax-profile and document, 1 public document. (The payment-method routes other than default and the staff read existed since 5.14; their contract changed.) Route baseline and the owner-only list were updated; the role-matrix oracle grew from 263 to 264.

## 9. Open items and differences

For the owner and the accountant (none block the code):

1. **Tax wording** of each document kind (title, declarations, "tax invoice" text for a registered Professional vendor) is not decided; the code carries the kind and the numbers only.
2. **Advance-receipt treatment**: a payment taken before supply is issued as the same document kind; whether GST law needs a separate "receipt voucher" is for the accountant.
3. **Tax-exclusive pricing**: order lines are tax-exclusive, as 5.14 prices them, and the document total must equal what was paid, otherwise no document is made. Whether vendors should price tax-inclusive is open.
4. **Odd paise** goes to SGST (a rule I chose; confirm).
5. **Two documents for one order payment**: the 5.14 order invoice and the new 5.17d document. Recommendation: vendors issue the 5.17d one and the 5.14 invoice is retired in a later batch.
6. **Late payments** (section 6).
7. **Checkout** does not create the pay request automatically; the owner makes it. Decide whether checkout should.
8. **Pay page notice** that Get4Domain does not hold the money (section 1) is not yet delivered by the API.
9. The expiry window `payLinkExpiryHours` has no value; staff must set it before any link can be created.

Differences from the dispatch: slice 5.17c (provider payments and webhook) is skipped under Amendment 06; gateway method kinds are rejected instead of supported; the 5.14 gateway webhook is off by default; Pro on credit is deferred to Release 2.
