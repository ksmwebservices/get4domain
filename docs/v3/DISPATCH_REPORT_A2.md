# DISPATCH REPORT A2 (backend lane, Wave 4): for the owner's morning

Branch `v3-w4` in `C:\Get4Domain\get4domain-w4` (made from `v3-w3`, then `v3-w3` was merged in once for the two Wave 3 fixes `a2d1b7e` and `1200c6d`: **no conflicts**). **Nothing was pushed. No database command was run. No .env file or secret was read.** Final gate on the last code state: `npm run build` passes, `npm run verify:migrations` (255 files) and `npm run verify:raw-sql` (1338 files) pass, `npm run test:ci` 283 suites and 5499 tests pass (Wave 3 ended at 276 suites). The route baseline was regenerated and shows no further difference.

## Done (all jobs DONE, none BLOCKED)

| Job | What | Commit |
|---|---|---|
| W0 | investigation, exists-or-missing table | a00cf7d |
| (merge) | `v3-w3` into `v3-w4`, clean | d687067 |
| W1 | directory host: brand on the main origin, listings on the directory host, no `/directory` prefix, unchanged when unset | 8e2105d |
| W2 | held payments: list, detail, resolve (ACCEPT only at the exact total including GST, REJECT with a note) | 7c5244c |
| W3 | the four `/v3/admin/discount-rules` routes retired | 871e560 |
| W4 | commission adjustment (reversal after payout) with netting and carry-forward | 6ba8afd |
| W5 | partner portal vendor state from the business address, then the place tree | d2312a8 |
| W6 | gateway keys entered by the SUPER_ADMIN in the admin app (write-only, encrypted) | 9c4f2ee |
| W7 | GST rate setting with an effective day and history | 08a4ef3 |
| W8 | TDS on commission payouts, partner PAN | cef520c |
| W9 | three integration files (not run), `V3_WAVE4_BACKEND.md`, `API_CONTRACT_WAVE4.md` | d95aa78 |

Status commits sit alongside (`DISPATCH_STATUS_A2.md` has the row per job, every assumption and the question). W1 was carried over uncommitted from the earlier session: its one failing test was a wrong regex (the badge image path `/v3/directory/badge/...` is an API asset path, not a page prefix), fixed in the test only.

## What each job does, in one line, and how you check it

- **W1** With `DIRECTORY_PUBLIC_BASE_URL` set, page model, sitemap index and chunks, robots, click-out and backlink urls use that host with no `/directory`; the "Get4Domain" brand link stays on the main site. `directoryPagesIndexable` stays OFF by default.
- **W2** `GET /v3/admin/billing/held-payments` (+ `/:id`, `POST /:id/resolve`), ADMIN and SUPER_ADMIN only. ACCEPT needs the verified amount to equal the order total including GST and the gateway payment id; one transaction (plan, invoice, audit). REJECT fails the order with the note and queues the vendor message through the mail port (flag OFF: stays pending). Idempotent. No refund is made here.
- **W3** The routes, service methods, DTOs, validator, role-matrix and baseline lines and the unused repository read are gone; tables, migrations and the seed file are untouched.
- **W4** A line reversed after payout stays PAID and flagged; one negative `ADJUSTMENT` line is made; the next month close nets it (oldest first, only while the partner is left with more than nothing) or carries it forward; a partner already paid for the month waits for the next close; closing again is safe. Shown in the admin ledger, the CSV (new `kind` column) and the partner view.
- **W5** State from the business address; else the STATE above the place in the directory tree; else empty. Cleaned, at most 60 characters.
- **W6** `GET`, `PUT`, `DELETE /v3/admin/payment-gateway/credentials[/:gateway/:mode]`, **SUPER_ADMIN only**. Stored encrypted (the platform settings AES-GCM, master key from the environment) in the existing platform settings table under its own category; never returned (status shows present yes or no, who and when, at most the last 4 characters of the key id); never logged (redaction tests); audited with field names only. Checkout and webhook verification read stored keys first and fall back to the environment. Going live still needs the admin setting, the live flag and the live keys.
- **W7** `GET` and `PUT /v3/admin/gst-rate`: SUPER_ADMIN sets a rate from today or a later day (never the past) with a reason; a new row each time, older rows never edited, history kept; an order keeps the rate it was quoted with. Empty until you and the CA confirm a rate.
- **W8** Payout record has gross, TDS and net. `tdsPercent` is a SUPER_ADMIN setting, **empty by default = no TDS**. `GET /v3/admin/commission/payouts/preview` pre-fills the TDS; ADMIN or SUPER_ADMIN may change it with a reason. Partner PAN (optional, staff write only; the partner sees it masked). Partner routes and a new payouts CSV show gross, TDS and net. The app computes no tax law beyond applying the percent.

## Assumptions (full list in the status file)

1. `HOSTNAMES_PLAN.md` was read from `get4domain-pub`; the switch is the environment value, so the plan's `directoryOrigin` setting was not added.
2. Held REJECT: the note is kept in the order `reason`; the vendor mail outcome is returned (not stored). ACCEPT goes through the one settlement path (the invoice shows the gateway payment id).
3. Commission: net exactly zero counts as "nothing to pay", so the adjustment is carried; adjustments are netted into the closing month.
4. Gateway keys use the existing platform settings table and AES-GCM util, so **no migration** for W6. Another server instance sees a key change within 30 seconds.
5. GST: the older generic `PUT` and `DELETE /v3/admin/tax-rates/:id` were left as they are (additive-only rule).
6. TDS: percent kept on each payout as basis points; pre-fill rounds to the nearest paisa, half up; net must stay above zero; no PAN rule or threshold is applied.
7. The payouts CSV (it carries the PAN) is ADMIN and SUPER_ADMIN only; the preview (no PAN) is also readable by OPERATIONS.

## Questions for you

1. The older generic `PUT` and `DELETE /v3/admin/tax-rates/:id` (SUPER_ADMIN) can still edit or delete a rate row that is already in force, which rewrites history. Shall they be restricted to rows that have not started yet?
2. Older modules outside the v3 billing path still hard-code 18 percent GST (the demo data, the website themes price, the old refill default, the old invoice text). Do you want a separate job to move them to the one rate setting?
3. Should the partner see their own PAN masked (as built) or in full?

## New migrations (written and verified, NOT applied)

1. `20261230100000_v3_wave4_commission_adjustment`: ledger `kind` and `adjustsLineId`; one line per vendor and kind; the amount rule allows a negative amount for an ADJUSTMENT only. Existing rows become `COMMISSION`.
2. `20261230110000_v3_wave4_tds_payouts`: partner `pan`; payout `grossMinor`, `tdsMinor`, `netMinor`, `tdsPercentBp`, `tdsEdited`, `tdsReason`; existing payouts get gross = total, TDS 0, net = total; checks that net = gross - TDS and a PAN has the shape of a PAN.

Neither creates a table (both tables already have row level security on).

## Environment variable NAMES (no values were read)

`DIRECTORY_PUBLIC_BASE_URL` (W1, optional: the directory host, for example `https://directory.example.com`); `PLATFORM_SETTINGS_KEY` (W6: the master key that encrypts the gateway keys; **must be set on the server before the first key is entered**, otherwise the set is refused with `GATEWAY_CREDENTIALS_UNAVAILABLE`); `PLAN_PAYMENTS_LIVE_ENABLED` (live still needs it to be `true`); `EMAIL_LIVE_SEND` (the mail flag, OFF by default: the held-payment rejection message stays pending until it is on). The gateway key variables from Wave 3 still work as the fallback (`RAZORPAY_TEST_*`, `RAZORPAY_LIVE_*`, `CASHFREE_TEST_*`, `CASHFREE_LIVE_*`).

## The exact owner staging commands, in order

Run in PowerShell, one at a time, from `C:\Get4Domain\get4domain-w4\backend-api` on the branch `v3-w4`, with the staging environment file in place (do not use the production file). Wave 3's own staging run in `get4domain-w2` comes first and is not touched by these.

1. `git status` and confirm the branch is `v3-w4` and the tree is clean.
2. `npm.cmd ci`
3. `npm.cmd run build`
4. `npm.cmd run verify:migrations` and then `npm.cmd run verify:raw-sql`
5. `npm.cmd run db:staging:migrate-status` (read only: it should list the two new migrations as pending)
6. `npm.cmd run db:staging:migrate-deploy` (applies `20261230100000_v3_wave4_commission_adjustment` and `20261230110000_v3_wave4_tds_payouts`)
7. `npm.cmd run db:staging:migrate-status` then `npm.cmd run db:staging:drift` (both should be clean)
8. Set `PLATFORM_SETTINGS_KEY` in the staging environment if it is not set yet (a long random value you keep).
9. `npx.cmd jest --ci --runInBand --selectProjects int test/commission-adjustment.int.spec.ts`
10. `npx.cmd jest --ci --runInBand --selectProjects int test/held-payments.int.spec.ts`
11. `npx.cmd jest --ci --runInBand --selectProjects int test/directory-host.int.spec.ts`
12. If a suite stops half way: `npm.cmd run test:cleanup-staging`
13. Only after all three pass: `npm.cmd run test:int` for the full integration run, then `npm.cmd run test:cleanup-staging`.

Run the three files and the full run one at a time, never together with a build or `test:ci`. The three integration files were type-checked but **never run** in this lane.

## What was not touched

No push, no database command, no real provider call, no new npm dependency, nothing outside `C:\Get4Domain\get4domain-w4` and branch `v3-w4`. Wallet, domain, directory ranking and every Wave 3 route other than the ones named above are unchanged.
