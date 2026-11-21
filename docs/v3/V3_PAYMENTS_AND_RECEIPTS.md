# V3 payments and receipts: rules (Batch 5)

Source: `docs/v3/stages/STAGE_09_PAYMENTS_BATCH_5.md`, with OWNER AMENDMENT 06 (6 November 2026, UPI only) winning over the dispatch text.

## Owner rules that apply (rule 4 and rule 12, in full intent)

**Rule 4, bridge model.** Requests go to the vendor through us. We never receive or hold customer payments. Online payment goes only to the vendor's own UPI id. The vendor's receipt or invoice is issued in the vendor's name by the app after a payment the vendor has confirmed. We promise promotion effort, not ranking, leads or sales.

**Rule 12, tax.** One rule chooses IGST or CGST plus SGST from the vendor's state against the customer's state. Rates come from tables, never code. Invoice wording and the treatment of advance receipts go to OPEN QUESTIONS for the accountant. The vendor's receipts follow the vendor's GST setting: tax invoice, bill of supply or plain bill.

## Amendment 06: UPI only for vendors

1. A vendor is paid by UPI: the vendor's UPI id and payee name, a generated QR, a pay link with the amount.
2. The customer taps "I have paid" (optional UPI reference number). That NEVER marks anything paid.
3. The vendor checks their own bank app and taps "Mark as paid". **Mark as paid is the only route to Paid** for a payment request, an order and an invoice.
4. The kinds GATEWAY_RAZORPAY, GATEWAY_CASHFREE, GATEWAY_PAYTM (and the 5.14 OWN_GATEWAY) are not offered to V3 vendors. They are rejected on create and update and hidden from every vendor and staff response. Nothing is deleted and no migration removes them.
5. Slice 5.17c (gateway adapters, per-vendor webhook inbox) is SKIPPED BY OWNER DECISION. No gateway port, adapter or webhook route is built.
6. A changed UPI id needs a confirm step and writes an alert (`PAYMENT_METHOD_CHANGED`). The existing payee-name check stays: a mismatch raises an alert and never blocks.
7. Get4Domain's own collection of plan and wallet payments is separate and unchanged.

## Levels

- **Level 1 (the only level offered):** UPI id plus payee name, vendor confirms.
- **Level 2 (gateway):** not offered to vendors; the enum values stay unused.

## Hard rules for the slices

- Money is integer paise; the UPI amount string is built without floating point.
- A Free vendor gets 403 LOCKED on every owner payment route.
- A payment request of vendor A can never use vendor B's method.
- Every change to a method, UPI id, bank detail or key records `PAYMENT_METHOD_CHANGED` (activity log; the existing interceptor covers the route, the service also records the semantic event with field names only, never values).
- No invented values: the expiry of a pay link comes from a staff-set setting; the feature refuses to create a link until the setting exists.
- Each slice has its own additive migration folder; every new table has RLS on and a cross-tenant test.
- No live provider call of any kind. Messages go through a fake port.
