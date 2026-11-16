# DISPATCH STATUS A (backend lane, Wave 3)

Branch v3-w3, worktree C:\Get4Domain\get4domain-w2. Baseline before J0: build passes, test:ci 265 suites, 5011 tests passing.

| Job | Part | Status | Commit | Tests | Note |
|---|---|---|---|---|---|
| J0 | Section 0 | DONE | 192a67e | n/a | docs\v3\V3_WAVE3_BACKEND.md written |
| J1 | A roles and partners | DONE | 889b56a | build ok; test:ci 266 suites, 5033 tests | labels fold into SALES in the principal; partner login = admin-team row with role REFERRAL_PARTNER, principal role PARTNER, global PartnerScopeGuard; migration 20261220100000 (not applied) |
| J2 | B public pricing | DONE | c6d0ebe | build ok; test:ci 267 suites, 5046 tests | GET /v3/public/pricing, 60 s service cache + Cache-Control; amounts via the same priceQuote the checkout uses (no discount); GST from the tax-rate table |
| J3 | C checkout and gateways | DONE | 6e3f03e | build ok; test:ci 268 suites, 5112 tests | PaymentGatewayPort over Razorpay + Cashfree (+ in-memory fake for tests), admin setting GET/PUT /v3/admin/payment-gateway, POST /v3/payments/cashfree/webhook, order cancel, migration 20261220110000 (gateway column, not applied) |
| J4 | D auto invoice | TODO | | | |
| J5 | E cash by admin | TODO | | | |
| J6 | F no discounts guard | TODO | | | |
| J7 | G trial and team live | TODO | | | |
| J8 | H themes | TODO | | | |
| J9 | I referrals and commission | TODO | | | |
| J10 | J small items | TODO | | | |
| J11 | K tests, docs, contract | TODO | | | |

## ASSUMPTIONS

1. The price book stores a total per term (3, 6, 12 months), so no "monthly x months" fallback was needed.
2. The existing plan-billing module is extended rather than duplicated (one contract per concept).
3. The labels FIELD_EXECUTIVE and TELECALLER are normalised to SALES (the MARKETING value) in `staffRoleOf`, so they hold exactly SALES rights by construction.
4. Checkout handles PLANS through the one order type (V3PlanOrder). Add-ons and themes cannot go through it yet (the order row needs a plan); themes are handled in J8, add-on packs stay on the wallet path they already use. Listed as a limit, not silently dropped.
5. Live mode: the old gate (PaymentsGate.port, used by the wallet) still has NO live branch and its test is unchanged. Live exists only on the new port, and needs the admin setting live AND PLAN_PAYMENTS_LIVE_ENABLED=true AND that gateway's live keys.
6. Cashfree has no signed browser return and no event id header: confirm relies on the server-side payments fetch, the webhook event id is cf-<payment id>-<type>, and the signature covers timestamp + raw body with a 10 minute window.
7. A payment the gateway reports for an amount or currency that differs from the order puts the order in REVIEW (held). Nothing resolves a held order yet (see QUESTIONS).

## QUESTIONS FOR THE OWNER

1. GST rate: read from the tax-rate table (data); the owner confirms the value.
2. Should OPERATIONS be allowed to confirm cash (today ADMIN and SUPER_ADMIN only)?
3. Commission on a reversed payment: line marked REVERSED and flagged; is a clawback from the next payout wanted?
4. Partner payout details (bank or UPI) are recorded by staff as a reference only.
5. Held payments (order status REVIEW after an amount or currency mismatch, or money for a cancelled or expired order): staff can list them (GET /v3/admin/billing/orders?status=REVIEW) but nothing marks them paid, because the vendor can never pay manually and cash is the only exception. How should a held gateway payment be resolved: refund at the gateway and record it, or an admin approval route?
