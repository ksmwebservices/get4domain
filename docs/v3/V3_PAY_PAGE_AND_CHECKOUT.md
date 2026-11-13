# V3 pay page and checkout (Block 4b, slice 8; Amendment 09 Part W)

## W1: the fixed notice

Every pay-request response carries `notice`: "You are paying {business name} directly. Get4Domain does not receive or hold this payment." Only the business name varies (`payNotice` in `v3-payments/core/pay-core.ts`).

It is on the owner side (create, list, get, cancel, mark paid and again, record a payment) and on every public pay-page answer: waiting, said paid, paid, the repeat tap, and the expired and cancelled errors (the 410 body carries it). A plain 404 (unknown code, Free vendor, suspended, removed, takedown) reveals nothing and so carries nothing. Pages and themes show the field as it is; the test `payments-checkout.spec.ts` fails if any of those responses lacks it.

## W2: late payments

A request that has expired can still be marked paid. It is allowed and flagged: the activity row for `payment.marked_paid` carries `late: true`.

## W3: checkout makes the pay request itself

An online order (a shop with an ACTIVE UPI method) now gets its pay link from checkout: the order answer has `paymentStep: { step: "PAY_WITH_UPI_LINK", payUrl, expiresAt, notice }`. One order, one pay link: asking again returns the same link and creates nothing. The expiry comes from `payLinkExpiryHours`. If the link cannot be made (no expiry set, no UPI method) the order stands and the step is `PAY_LINK_PENDING`; the business makes the link by hand.

Wiring: the order route takes an optional `PayLinkPort`; `PayLinkBridgeModule` (global) binds it to the pay requests service so the orders module does not import the payments module. The wiring spec resolves the real modules together and checks the port is the real service. Without the bridge the older gateway step is used (kept only as that fallback).

## W4: payLinkExpiryHours = 48

The code default stays unset (no number is invented in code). `scripts/seed-v3-pay-settings.js` loads 48 into the settings table: dry run by default, `--apply` to write, staging guard, one audit row, never overwrites a value staff already set. Staff change it afterwards in admin settings (the one plan-settings API).

## W5: the old 5.14 order invoice is retired

What was removed or changed (nothing was deleted from the database):

| Was | Now |
|---|---|
| Marking an order PAID took an `INV-` number and wrote a `g4d_vendor_invoices` row (`markPaid`) | no number is taken and no row is written; the order payment produces ONE document, the receipt or invoice of the payments slice (5.17d), made when the payment is recorded |
| `POST /v3/me/orders/:id/invoice` issued an invoice for an order | answers 410 `ORDER_INVOICE_RETIRED` ("made as receipts and invoices when the payment is recorded"). If an invoice was issued before, it is still returned for that order |
| `GET /v3/me/invoices`, `POST /v3/me/invoices/:id/void` | unchanged: old rows stay readable and can still be voided (the number and the row stay) |
| the `g4d_vendor_invoices` table, its numbering and `createInvoice` in the store | kept for the old rows; nothing writes to it any more |

One consequence to know: an order paid through the legacy gateway webhook (off by default, and gateway rows are not offered to vendors since amendment 06) has no pay request, so it produces no 5.17d document either. That path is dead in practice.

## W6: accountant list (launch, not building)

Not built and not blocking: tax wording, advance-receipt treatment, tax-exclusive pricing, the odd-paise rule (currently goes to SGST).
