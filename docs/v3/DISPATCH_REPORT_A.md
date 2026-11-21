# DISPATCH REPORT A (backend lane, Wave 3): for the owner's morning

Branch `v3-w3` in `C:\Get4Domain\get4domain-w2`. **Nothing was pushed. No database command was run. No .env file or secret was read.** Final gate: `npm run build` passes, `npm run test:ci` 276 suites and 5,355 tests pass, `lint:ci` 0 errors, `verify:migrations` and `verify:raw-sql` pass. Start point was 265 suites and 5,011 tests.

## What is done (all 12 jobs DONE)

| Job | Part | Commit |
|---|---|---|
| J0 | investigation, `V3_WAVE3_BACKEND.md` | 192a67e |
| J1 | A: roles and partners | 889b56a |
| J2 | B: public pricing | c6d0ebe |
| J3 | C: checkout, Razorpay and Cashfree behind one port, signed webhooks | 6e3f03e |
| J4 | D: automatic invoice | 4325cac |
| J5 | E: cash confirmed by an admin | 7f4590d |
| J6 | F: no discounts guard | 8e4bc46 |
| J7 | G: self-service trial and team go-live | a6e884c |
| J8 | H: themes (**partial**, see below) | b229ac5 |
| J9 | I: referrals and commission | d99ab81 |
| J10 | J: small items | bbb427e |
| J11 | K: integration files, docs, contract | af3cb68 |

Status commits sit between them (`DISPATCH_STATUS_A.md` holds one row per job, the assumptions and the questions).

## What is blocked or partial

Nothing is BLOCKED. **J8 is partial on purpose.** The V3 theme model has no per-theme purchase: the Standard theme is on every plan, a paid plan carries the theme library, one switch is included and later switches are the price-book fee paid from wallet credit (your 6 November rule). So I built the catalogue per pack and the owner's choice view (with `PLAN_REQUIRED` and a PENDING fee that is never a number), and did not invent a second order type to sell a theme through the gateway. The money still enters through the gateway when the wallet is topped up (J10 moves that onto the port). If you want a theme sold as its own purchase, that needs your decision.

## Needs your decision (also in the status file)

1. Held gateway payments (amount mismatch, or money for a cancelled or expired order) go to REVIEW and nothing resolves them yet: refund at the gateway and record it, or an approval route?
2. Retire the four `/v3/admin/discount-rules` routes? They no longer affect any price, but still exist because Wave 3 is additive-only while Part F says no discount route exists.
3. Should OPERATIONS be able to confirm cash (today ADMIN and SUPER_ADMIN only)?
4. A commission line already paid out when its payment is reversed is marked REVERSED and flagged; do you want a deduction from the next payout?
5. Where should a referred business's state come from for the partner portal (today its directory profile, else empty)?
6. GST rate: read from the tax-rate table; please confirm the value is the one you want.

## Choices I made that you should check

- FIELD_EXECUTIVE and TELECALLER are folded into SALES in the principal, so they cannot hold a right SALES lacks.
- **Price writes were tightened to SUPER_ADMIN only** (service and pack prices, domain margins) because Part F says no role below it changes a price. Tests that encoded the old rule were updated.
- **Go-live was opened to SALES (and the labels)** because you said field executives and telecallers make sites live. All refusals inside go-live are unchanged.
- The old "mark paid with just a reason" is gone. Cash needs an admin-made cash order, every detail, and is all-or-nothing. A few existing tests (billing-api, billing-flow int, staff-roles, services-api, wallet-api, registrar int) were updated to the new contract.
- Live payments exist only on the new port and need the setting `live`, `PLAN_PAYMENTS_LIVE_ENABLED=true` and that gateway's live keys. The old gate (and its "live is refused" test) is unchanged.
- The Free plan and the live Free trial site at registration stay behind the existing `registrationProvisioning` switch (off), so nothing changes for production until you turn it on.
- `HOSTNAMES_PLAN.md` does not exist, so the directory host uses `DIRECTORY_PUBLIC_BASE_URL` (unset = old behaviour).
- The J3 migration was edited in place (to allow the `cash` gateway) before anything applied it.

## New migrations (written, NOT applied)

`20261220100000_v3_wave3_roles_partners`, `20261220110000_v3_wave3_gateways`, `20261220120000_v3_wave3_referrals_commission`, `20261220130000_v3_wave3_wallet_gateway`. All additive, RLS on for every new table, no slab value seeded.

## Environment variable NAMES to set on the VM (never values)

`PLAN_PAYMENTS_LIVE_ENABLED`, `RAZORPAY_LIVE_KEY_ID`, `RAZORPAY_LIVE_KEY_SECRET`, `RAZORPAY_LIVE_WEBHOOK_SECRET`, `CASHFREE_TEST_APP_ID`, `CASHFREE_TEST_SECRET_KEY`, `CASHFREE_LIVE_APP_ID`, `CASHFREE_LIVE_SECRET_KEY`, `DIRECTORY_PUBLIC_BASE_URL` (the existing `RAZORPAY_TEST_*` names are unchanged). All are listed in `.env.live.example`. Both gateways stay OFF until you set keys and call `PUT /v3/admin/payment-gateway`.

## Owner staging commands, in order (PowerShell, in `C:\Get4Domain\get4domain-w2\backend-api`)

1. `npm.cmd run db:staging:migrate-status` (expect the four new folders pending)
2. `npm.cmd run db:staging:migrate-deploy`
3. `npm.cmd run db:staging:rls-off` (expect 0), then `npm.cmd run db:staging:drift` (expect the 2 documented items)
4. `npm.cmd run build`, then `npm.cmd run test:ci` (expect 276 suites green)
5. Seed scripts: none needed (the slabs are deliberately empty; the existing plans seed is unchanged: `node scripts/seed-v3-plans.js` dry run first, `--apply` only if it reports something to create)
6. Each integration file alone, output saved, for example `npx.cmd jest --ci --runInBand test/payments-gateways.int.spec.ts --selectProjects int 2>&1 | Tee-Object -FilePath .\payments-gateways.int.log`, then the same for `checkout-invoice`, `cash-confirmation`, `trial-signup`, `referrals-commission`, `partner-portal` (these six were written and type-checked but NOT run)
7. `npm.cmd run test:cleanup-staging -- --count` (must print 0; the cleanup now removes the Wave 3 rows, proved by `test/wave3-cleanup.spec.ts`)
8. After reading the logs: `git push -u origin v3-w3` (a push creates a Vercel preview)

Full detail: `V3_WAVE3_BACKEND.md` (routes, tables, matrix, codes, settings) and `API_CONTRACT_WAVE3.md` (every new route for the front-end slices).
