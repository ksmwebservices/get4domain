# Paying for Pro: the simplest path, with a V3 invoice (E7 design)

Written 26 Nov 2026 after reading `C:\Get4Domain\get4domain-w2\docs\v3\V3_PAY_PAGE_AND_CHECKOUT.md` and the plan billing code in `C:\Get4Domain\get4domain-w2\backend-api\src\plan-billing\`. Branch `v3-eng-e7` holds this document only: the paths that matter already exist, and the one missing path (a payment link) cannot be built or proved safely without the owner's gateway account (decision 1).

## 1. What a vendor can already do to buy Pro

| Path | Who starts it | Steps | Ends with |
|---|---|---|---|
| **A. Online checkout** | The vendor, in the vendor app | `POST /v3/me/billing/orders` (the server price: price book plus GST, never typed) opens the gateway checkout; the browser returns; `POST /v3/me/billing/orders/:id/confirm` and the gateway webhook both settle it (replay safe, amount and currency checked against the order, a mismatch is held for review) | Subscription started or extended, a V3 plan invoice with a number, the invoice e-mailed, the referral commission line (first payment only) |
| **B. Cash or bank transfer, confirmed by the office** | Staff (ADMIN or SUPER_ADMIN), or since E6 a telecaller for their own business | `POST /v3/admin/billing/vendors/:vendorId/cash-orders` (or the telecaller route `POST /v3/admin/telecaller/vendors/:id/collections`) makes the CASH order at the server price; an admin confirms with `POST /v3/admin/billing/orders/:id/mark-paid` (receipt reference, day received, amount equal to the total) | The same settlement as A: invoice, subscription, commission |
| **C. Razorpay or Cashfree gateway choice** | SUPER_ADMIN | `PUT /v3/admin/payment-gateway` picks the gateway and its mode (off, test, live); keys are stored encrypted by `PUT /v3/admin/payment-gateway/credentials/:gateway/:mode` | Checkout in A uses that gateway |

Both A and B end in the same code (`settlement.service.ts`), so there is one invoice format and one commission rule. The vendor reads invoices at `GET /v3/me/billing/invoices` and downloads one at `GET /v3/me/billing/invoices/:id/download`.

## 2. What is missing

1. **A shareable payment link** (a phone call ends with a link sent on WhatsApp; the vendor taps, pays by UPI, and is done). Today the vendor must be signed in to the vendor app to pay (path A), or pay the telecaller or office (path B).
2. **Live mode is deliberately refused** by the payments gate (`payments-gate.ts`): it needs the admin setting `live`, the environment flag `PLAN_PAYMENTS_LIVE_ENABLED=true` and a live adapter, and this build has no live adapter. Test mode works with test keys.
3. A vendor-facing **"how do I pay"** screen that offers A, and "pay the office or my telecaller" (B) in plain words (UI repo).

## 3. Recommended design for the payment link

Use the gateway's own hosted link, so no card or UPI detail ever touches Get4Domain.

- **Port:** add `createPaymentLink({ amountPaise, currency, receipt, description, customer: { name, contact, email }, expiresAtEpoch, notes: { planOrderId } })` to the gateway seam (`RazorpayPort`, and the Cashfree equivalent), a fake for tests, and the real call (`POST /v1/payment_links`) behind the same gate as checkout.
- **Route:** `POST /v3/me/billing/orders/:id/pay-link` (the vendor) and `POST /v3/admin/billing/orders/:id/pay-link` (staff and the telecaller for their own business). It returns the short link and its expiry (`payLinkExpiryHours`, 48, already a setting). The order is the same plan order made by `POST /v3/me/billing/orders`, so the amount is the server price.
- **Settlement:** the gateway's `payment.captured` and `payment_link.paid` events carry our order reference in `notes`; the webhook settles the order through the existing settlement (signature checked on the raw body, replay safe by event id, amount and currency compared with the order, a mismatch held). Nothing new in how invoices or commission are made.
- **Delivery:** the link goes by WhatsApp template and e-mail (decision 2). Staff can also copy it.
- **Failure behaviour:** link expired, payment failed or underpaid: the order stays CREATED or is HELD; the vendor can ask for a new link; no subscription is started until the settlement passes.

## 4. Hours

| Part | Hours |
|---|---|
| Port method, fake, real adapter call, tests | 5 |
| Routes (vendor and staff), expiry, idempotency, tests | 4 |
| Webhook mapping of link events to the plan order, held-payment cases, tests | 5 |
| WhatsApp template send and e-mail, tests | 3 |
| Staging proof against the gateway in test mode (needs owner test keys) | 3 |
| Vendor "how do I pay" screen (UI repo) | 6 |
| **Total** | **26** (17 backend) |

## 5. Decisions needed (also in C:\Get4Domain\docs-claude\queues\DECISIONS_NEEDED.md)

1. **Gateway account and test keys.** Razorpay or Cashfree, and the owner stores the test keys in the admin app (never in chat). Without them the link cannot be proved. Recommendation: Razorpay, test mode first.
2. **WhatsApp template** for the link (name proposed `plan_pay_link`, variables: owner name, plan name, amount, link). Needs Meta approval. Recommendation: submit it with the telecaller template (D5).
3. **Go-live for live payments.** Needs a live adapter, the live keys, `PLAN_PAYMENTS_LIVE_ENABLED=true` and the admin setting `live`. Recommendation: not before the test-mode proof is accepted.
4. **Interim path for the first clients:** cash or bank transfer through a telecaller or the office (path B, built) with the invoice issued on confirmation. Recommendation: use B until the link exists.
