# DISPATCH STATUS A (backend lane, Wave 3)

Branch v3-w3, worktree C:\Get4Domain\get4domain-w2. Baseline before J0: build passes, test:ci 265 suites, 5011 tests passing.

| Job | Part | Status | Commit | Tests | Note |
|---|---|---|---|---|---|
| J0 | Section 0 | DONE | 192a67e | n/a | docs\v3\V3_WAVE3_BACKEND.md written |
| J1 | A roles and partners | DONE | 889b56a | build ok; test:ci 266 suites, 5033 tests | labels fold into SALES in the principal; partner login = admin-team row with role REFERRAL_PARTNER, principal role PARTNER, global PartnerScopeGuard; migration 20261220100000 (not applied) |
| J2 | B public pricing | DONE | c6d0ebe | build ok; test:ci 267 suites, 5046 tests | GET /v3/public/pricing, 60 s service cache + Cache-Control; amounts via the same priceQuote the checkout uses (no discount); GST from the tax-rate table |
| J3 | C checkout and gateways | DONE | 6e3f03e | build ok; test:ci 268 suites, 5112 tests | PaymentGatewayPort over Razorpay + Cashfree (+ in-memory fake for tests), admin setting GET/PUT /v3/admin/payment-gateway, POST /v3/payments/cashfree/webhook, order cancel, migration 20261220110000 (gateway column, not applied) |
| J4 | D auto invoice | DONE | 4325cac | build ok; test:ci 269 suites, 5138 tests | invoice snapshot gets lines + payment block (gateway id or cash reference), page prints it (heading unchanged), mail recorded as pending in the outbox while EMAIL_LIVE_SEND is off; firm profile was already the seller; no migration |
| J5 | E cash by admin | DONE | 7f4590d | build ok; test:ci 270 suites, 5161 tests | mark-paid now cash only (method CASH, reference, received day, amount = total incl GST, special-case ack + note), ADMIN and SUPER_ADMIN; admin makes the cash order (POST /v3/admin/billing/vendors/:vendorId/cash-orders); all-or-nothing; J3 migration amended in place to allow gateway cash (still unapplied) |
| J6 | F no discounts guard | DONE | 8e4bc46 | build ok; test:ci 271 suites, 5207 tests | promoCode removed from checkout and renewal, quote never reads discount rules, price writes (service/pack prices, domain margins) now SUPER_ADMIN only, guard tests for roles, DTO fields and invoice immutability |
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
8. Cash needs an order, and with the gateways OFF a vendor cannot make one, so an ADMIN or SUPER_ADMIN makes a CASH order for the vendor (server price, no gateway). confirmCash accepts ONLY such orders: an online order, one held for review and a closed one are refused, which also removes any chance of a gateway payment arriving later for an order already paid in cash.
9. The old route behaviour (mark paid with just a reason, any method, also resolving REVIEW orders) is gone by design. Existing tests that encoded it (billing-api.spec, billing-flow.int.spec, staff-roles.spec) were updated to the new contract; the strict rules are tested in wave3-cash.spec.ts. PaymentSettlementService.markPaid remains as an internal method with no route.
10. The invoice mail uses the existing mail port (lane 1, kind RECEIPT) and the existing switch EMAIL_LIVE_SEND (default off). Off or not configured is recorded as QUEUED (pending) in the message outbox; no new flag was added.
11. Part F says no route or DTO field named coupon, discount or offer exists in version 3, and the Wave 3 rules say never remove an existing route. Resolved as: nothing removes the four slice 5.1 routes under /v3/admin/discount-rules (SUPER_ADMIN only), but NO checkout, cash order, wallet renewal or pricing page reads them any more, so a rule can never change an amount. The guard test lists those four routes and files by name. The vendor's own shop tools (/v3/me/offers, /v3/me/promotion/drafts) are for the vendor's customers, not Get4Domain pricing, and are outside the rule.
12. Part F also says no role below SUPER_ADMIN may change a price. OPERATIONS could still propose service and pack prices and domain margins (approval was already SUPER_ADMIN only). Those six writes are now SUPER_ADMIN only; the oracle and the tests that encoded the old rule were updated.

## QUESTIONS FOR THE OWNER

1. GST rate: read from the tax-rate table (data); the owner confirms the value.
2. Should OPERATIONS be allowed to confirm cash (today ADMIN and SUPER_ADMIN only)?
3. Commission on a reversed payment: line marked REVERSED and flagged; is a clawback from the next payout wanted?
4. Partner payout details (bank or UPI) are recorded by staff as a reference only.
5. Held payments (order status REVIEW after an amount or currency mismatch, or money for a cancelled or expired order): staff can list them (GET /v3/admin/billing/orders?status=REVIEW) but nothing marks them paid, because the vendor can never pay manually and cash is the only exception. How should a held gateway payment be resolved: refund at the gateway and record it, or an admin approval route?
6. Retire the four /v3/admin/discount-rules routes and the discount rule tables? They no longer affect any price, but they still exist because Wave 3 is additive-only and the document also says no discount route exists. Removing them needs your word.
