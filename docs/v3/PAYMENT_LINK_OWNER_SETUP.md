# Plan payment links (E11e): what is built, and what you must enter

Written 27 Nov 2026. Branch `v3-eng-e11`. **Not deployed. Never tried against Razorpay.** No key exists in the code, and no live call was made. Links are **test mode only**: live is refused whatever the environment flag says, and `PLAN_PAYMENTS_LIVE_ENABLED` stays unset or `false`.

## What it does

Staff, a telecaller (for their own business) or the owner ask for a link for a Pro plan (3, 6 or 12 months). The amount is the server price (price book plus GST). They copy the link and share it. When Razorpay reports it paid, the **same settlement** as online checkout and office-confirmed cash runs: amount and currency checked, one invoice, the plan starts, the same commission rule.

| Route | Who |
|---|---|
| `POST /v3/me/billing/pay-links` | the business owner (not a team member) |
| `POST /v3/admin/billing/vendors/:vendorId/pay-links` | Admin, Super admin |
| `POST /v3/admin/telecaller/vendors/:id/pay-links` | a telecaller, for a business credited to them (the same rule as a cash collection) |

Body: `{"planKey": "handyman_pro", "termMonths": 3, "idempotencyKey": "8 to 80 letters, digits, - or _"}`.
Answer: `orderId`, `status`, `url` (null once it cannot be paid), `expiresAt`, `amountPaise`, `currency`, `reused`, `testMode: true`.

An open link for the same business, plan and term is returned again, not duplicated. If the price changed, the old order is cancelled and a new link is made.

Refusal codes: `PAYMENT_LINKS_DISABLED`, `PAYMENTS_DISABLED`, `PAYMENT_LINKS_TEST_ONLY`, `PAYMENTS_NOT_CONFIGURED`, `PAYMENT_LINK_EXPIRY_NOT_SET`, `PAYMENT_PROVIDER_ERROR`, `IDEMPOTENCY_CONFLICT`, plus the usual plan and price codes.

## Read this before switching it on

* **Test mode is a setting for the whole V3 server.** With `paymentsMode` = `test`, online checkout also opens in test mode for every vendor.
* **A test payment starts a real Pro plan** in the V3 database, uses a real invoice number and can create a commission line. Use only test businesses, or expect to reverse these records. Anyone who has a link can pay it with Razorpay's test details.
* Switching `payLinkEnabled` off stops new links. Payments already on their way are still recorded. Switching `paymentsMode` to `off` makes the server **ignore** the gateway's messages, so do not do that while a link is open.

## What you enter (never in chat or a document)

1. **A Razorpay account in test mode.** Create the test key pair, and choose a webhook secret.
2. **The three values, in the admin app** (Super admin), stored encrypted: `PUT /v3/admin/payment-gateway/credentials/razorpay/test` with `keyId` (starts `rzp_test_`), `keySecret`, `webhookSecret`. The server needs `PLATFORM_SETTINGS_KEY` set in `api.env` to store them; I did not check whether it is. (Alternative: `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`, `RAZORPAY_TEST_WEBHOOK_SECRET` in `api.env`.)
3. **The webhook, in the Razorpay test dashboard:** address `https://v3api.get4domain.com/v3/payments/razorpay/webhook`, the same webhook secret, events `payment_link.paid` and `payment.captured`.
4. **Gateway and mode:** `PUT /v3/admin/payment-gateway` with Razorpay and `test`.
5. **How long a link stays open:** plan setting `payLinkExpiryHours`, for example `48` (empty until set). Razorpay may refuse very long periods.
6. **Switch on:** plan setting `payLinkEnabled` = `true` (`PUT /v3/admin/plan-settings/payLinkEnabled`, body `{"valueJson": true}`).
7. Already needed for any plan sale: approved prices, the GST rate, and the invoice seller name, address and GSTIN.

## The first test (with you watching)

1. Make a link for a test business. Check the amount against the price list plus GST.
2. Open it and pay with a Razorpay test method.
3. Check: the order shows `PAID`; exactly one invoice; the plan is Pro; the commission line, if the business was referred.
4. In the Razorpay dashboard the webhook deliveries answer 200.
5. Send one delivery again from the dashboard: nothing changes.

## To verify with the real gateway

The request sent to `https://api.razorpay.com/v1/payment_links` and the fields read from `payment_link.paid` follow Razorpay's documentation as I understand it; neither was exercised. If a paid link does not activate, look at the payment events list in the admin app (`GET /v3/admin/billing/payment-events`): a result of `NO_ORDER` or `IGNORED` there points to a field that differs.

## Not built

* Sending the link by WhatsApp or e-mail (the template `plan_pay_link` needs Meta approval).
* Cancelling the link at Razorpay: cancelling the order here leaves the link open there; money paid on it is **held for review** (`held payments`), the plan does not start.
* Cashfree links, and live payments.
* Any screen.
