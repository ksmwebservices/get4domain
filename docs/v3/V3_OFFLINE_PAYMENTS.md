# V3 cash and offline payment recording (Block 4b, slice 5; Amendment 09 Part C1)

A business can say HOW a customer paid it: UPI (the default), cash or bank transfer. This is a record of the business's own money. Get4Domain never holds it, never counts it, and nothing here touches the wallet or any Get4Domain ledger (a test scans the payment code for any wallet or ledger import).

## What changed

- `g4d_payments` gains `method` (`UPI | CASH | BANK_TRANSFER`, CHECK, default `UPI`) and `vendorRecorded` (always true on this path, default true). Every existing payment keeps its meaning: it was a UPI payment the business confirmed. The provider label is `UPI_MANUAL`, `CASH_MANUAL` or `BANK_MANUAL`: the business confirmed it, no gateway did.
- `g4d_payment_requests.methodId` may now be empty (the only relaxation; migration `20261214130000_v3_offline_payments`). A payment the business writes down by hand needs no UPI method on file, so a cash-only business can record sales.
- Mark as paid (`POST /v3/me/payment-requests/:id/mark-paid`) takes an optional `method`. Cash with a UPI reference is refused (a made-up proof). It is still the only door to PAID.
- **New:** `POST /v3/me/payment-requests/record-offline` (owner only): `{ method, idempotencyKey, orderId? | amountPaise + customerName, reference?, note?, customerPhone? }`. Against an order the amount is the order total and the order becomes PAID; if the order already has an open pay link that link is the one settled (no second request). The call runs one at a time per business and the key makes a repeat call a no-op (found a real race while testing: two parallel calls with one key would otherwise both create a request).
- The receipt or invoice names the method (`paymentMethod` on the owner view and the public page; also in the stored flags).
- Activity: `payment.marked_paid` and `payment.recorded_offline` carry `method` and `vendorRecorded`; a payment on a request that had already expired also carries `late: true` (Amendment 09 W2: allowed, flagged, visible).

## Not in this slice

Staff "Record offline payment" for a business paying Get4Domain (Amendment 09 C2: plan or wallet top-up, two-person rule, ledger entry and receipt in Get4Domain's name) is **not built**: it creates Get4Domain money and a ledger entry, needs the owner's two-person threshold amount (an open question in the amendment) and an accountant-reviewed receipt wording. C3 holds: no path here is refundable by code.
