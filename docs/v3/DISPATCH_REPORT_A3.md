# DISPATCH REPORT A3 (backend lane: smoke kit, themes, small fixes): for the owner

Branch `v3-smoke` (from `v3-w4-fix`) in `C:\Get4Domain\get4domain-w2`. **Nothing was pushed.** No `.env` file or secret was read or printed. No real payment, mail, SMS or provider call was made (the local API has no provider key and mail is captured). Staging was touched only through the allowed doors: the smoke scripts, `test:cleanup-staging`, and the API started by `smoke-api.js` (stopped every time; nothing is running now, port 3008 is free). No database command other than those, no migration.

Final gate on the last code state: `npm.cmd run build` passes; `npm.cmd run test:ci` **287 suites, 5,544 tests pass** (Wave 4 ended at 283 and 5,499). The route baseline was regenerated: **no route added or removed**, no difference. `npm.cmd run test:cleanup-staging -- --count` printed **0** after the cleanup; the seed was then run again, so the smoke users exist now (see below).

## Done (all five jobs DONE, none BLOCKED)

| Job | What | Commit |
|---|---|---|
| M0 | investigation, findings at the top of `DISPATCH_STATUS_A3.md` | 90e8e52 |
| M1 | smoke kit: `scripts/staging/smoke-seed.js` (guarded, idempotent, `--reset`), `smoke-api.js` (local API on staging), `smoke-lib.js`, `docs/v3/SMOKE_RUN.md`, 16 unit tests | 90e8e52 |
| M2 | `smoke-probe.js` + `smoke-probe-lib.js`: 213 GET routes x 8 callers (anon, SUPER_ADMIN, ADMIN, SALES, OPERATIONS, partner, Free vendor, paid vendor), table in `SMOKE_RESULTS_A3.md`, 11 unit tests. **0 FAIL**: 180 pass, 10 reached the guards and wanted input, 23 are plan gates for the Free vendor. No backend mistake found, so nothing to fix. | 8be199e |
| M3 | Themes: the backend was already built in Batch 4 (preview, switch, fee, history, wallet charge in one transaction with an idempotency key and an audit row, plan gate, staff routes, role matrix rows, 40 tests). The one gap was the registered code `THEME_SWITCH_FEE_PENDING`; a paid switch with no approved price now answers 409 with it (before: the generic `SERVICE_PRICE_NOT_SET`). 6 new tests: price pending is never a number, refused switch leaves no row and no charge, the same key works once the fee is set, the included first switch and a staff gift do not need the fee, Free is refused first, empty wallet vs missing price. | 01ed14c |
| M4 | (a) `PUT` and `DELETE /v3/admin/tax-rates/:id` refuse a rate whose start has passed (409 `TAX_RATE_IN_FORCE`); a waiting rate stays editable but cannot be moved to the past; 8 tests; checked live on staging (409, row count unchanged). (b) `/auth/register` response and error codes documented in `API_CONTRACT_WAVE4.md` (gaps G2 and G28), written from the real behaviour. Theme switch and the new codes documented there too. (c) nothing else found by M2. | 1d210e2 |
| (test) | `plans-errors.spec.ts` pins the plan code list; the new code was added to the expected list (not a weakened check) | b025166 |
| M5 | this report, `SMOKE_RESULTS_A3.md` final (with the FOR THE FRONT-END LANES section), status file | final commit |

Not written: **no new integration file** (the changes are pure rules proven with in-memory twins, and the live behaviour of both was checked on the local API), so there is no integration file to run alone. The existing integration files were not run.

## New migrations

**None.** The theme-switch table (`20261121100000_v3_theme_switch`) was already in the folder. Nothing was applied to staging by me.

## Environment variable NAMES (never values)

Set by `smoke-api.js` for the local API: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (random each start), `NODE_ENV=development`, `EMAIL_MODE=test`, `THROTTLE_DISABLED=true`, `LEADSPACE_SCHEDULER=off`, `PLAN_PAYMENTS_LIVE_ENABLED=false`, `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (both the text `placeholder-smoke-kit`, because the legacy payment service builds its client at start-up and the SDK refuses an empty value; the app treats any value starting `placeholder` as not configured), `PORT`, `HOST=127.0.0.1`, `CORS_MODE=strict`, `CORS_EXTRA_ORIGINS`, `FRONTEND_URL`, `PUBLIC_APP_URL`, `PUBLIC_API_URL`, `SITE_BASE_DOMAIN`, `PLATFORM_SETTINGS_KEY` (only when `.env.staging` has it). Every provider variable of your shell is removed from the child. Read by the seed and the launcher through the existing guard: the staging `DATABASE_URL` and `DIRECT_URL` (`.env.staging`). New optional: `SMOKE_USERS_FILE` (a different users file path; still must be outside the repo and named `users.json`).

## What the smoke kit gives the front-end lanes

Throwaway logins on staging (created by the last seed run; passwords only in `C:\Get4Domain\smoke\users.json`, which is outside every repo): `superAdmin`, `admin`, `sales` (stored as MARKETING), `operations`, `partner` (referral code `SMKTEST2`), `vendorFree` (Free plan, subdomain `smoke-free-site`, draft site with one service), `vendorPaid` (Handyman Pro by a staff-source subscription row, subdomain `smoke-paid-site`, no gateway). All have e-mails `smoke-...@v3test.invalid` and names starting `V3TEST`, so the existing cleanup removes them. Not provided: a funded wallet (a hand-funded wallet would be fake ledger money) and a published site (the sites are drafts).

## SMOKE_RESULTS

`docs\v3\SMOKE_RESULTS_A3.md`: 213 routes probed, 68 skipped (they need an id the seed does not know, or reach a provider; each is listed). Results: 180 pass, 10 reached (the route needs a query or state), 0 FAIL. The same file has "FOR THE FRONT-END LANES" with seven items (plan gates for the Free vendor, routes that need a query, state-dependent 404s, registering, the theme fee, the GST name, and 403 handling).

## Assumptions (full list in `DISPATCH_STATUS_A3.md`)

1. The fee "SUPER_ADMIN platform setting" is read as the existing price book entry `THEME_SWITCH` (only the SUPER_ADMIN sets it, empty = PENDING). A separate new setting would duplicate it; swapping is small if you want one.
2. "Free refused with a registered code" is the existing `THEME_SWITCH_PLAN_STATE`.
3. "A rate already in force" = any rate whose start has passed.
4. The seed writes rows directly with Prisma; every run refreshes all passwords.

## Questions for you

0. **Staging price book holds an approved THEME_SWITCH price of 29,900 paise**, so the fee view says SET. `theme-switch.int.spec.ts` creates and removes exactly such a price, so this is probably a leftover; you said the fee is not decided. Check the price book on staging and retire it if it is a leftover. I did not touch it.
1. **Leftover test tax rows on staging (29 in all)**, one named `V3TEST GST ...` at 18 percent shows on the public pricing answer. `test:cleanup-staging` has no step for tax rates, so `--count` can print 0 while they stay. Remove them and add a cleanup step, or leave them?
2. `POST /auth/register` tells a caller an email already has an account (409): account enumeration. Documented as is. Change it?
3. A first `POST /auth/register` omits `termsAcceptanceRequired` (login and `/auth/me` carry it). Documented; add it to the register answer?
4. `POST /v3/admin/tax-rates` (create) can still back-date a rate. You named PUT and DELETE only. Lock it too?

## Exact owner commands, in order

Review (PowerShell, one at a time):
```powershell
cd C:\Get4Domain\get4domain-w2\backend-api
git branch --show-current
git log --oneline -8
git status
```
Use the kit (full steps in `docs\v3\SMOKE_RUN.md`; Window A runs the API, Window B the rest):
```powershell
npm.cmd run build
node scripts/staging/smoke-seed.js
```
```powershell
node scripts/staging/smoke-api.js
```
(Window A; leave it open; Ctrl+C stops it.)
```powershell
node scripts/staging/smoke-probe.js --out ..\docs\v3\SMOKE_RESULTS_A3.md
```
(Window B, optional.) When the lanes are done:
```powershell
node scripts/staging/smoke-seed.js --reset
npm.cmd run test:cleanup-staging -- --count
```
Pushing is yours to decide: a push creates a Vercel Preview deploy. The branch is `v3-smoke`; I did not push it.
