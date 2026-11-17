# DISPATCH STATUS A3 (backend lane: smoke kit, themes, small fixes)

Branch `v3-smoke` (from `v3-w4-fix`), folder `C:\Get4Domain\get4domain-w2\backend-api` (repo root `C:\Get4Domain\get4domain-w2`; docs live in `..\docs\v3`).

| Job | Status | Commit | One line |
|---|---|---|---|
| M0 | DONE | 90e8e52 (this file) | investigation, findings below |
| M1 | DONE | 90e8e52 | smoke seed (+ `--reset`), local API launcher on staging, SMOKE_RUN.md, 16 unit tests; seed and API run once on staging, `/health` and `/v3/public/pricing` answered 200, API stopped |
| M2 | DONE | 8be199e | smoke probe: 213 routes x 8 callers, 0 FAIL, no backend mistake found; SMOKE_RESULTS_A3.md; 11 unit tests |
| M3 | DONE | 01ed14c | theme switch was already built (Batch 4); the one gap, the registered `THEME_SWITCH_FEE_PENDING`, built with 6 new tests; no migration needed |
| M4 | DONE | 1d210e2 | (a) generic tax-rate PUT/DELETE refuse a started rate (`TAX_RATE_IN_FORCE`), 8 tests; (b) `/auth/register` documented (G2, G28); (c) nothing else found by M2 |
| M5 | see DISPATCH_REPORT_A3.md | | final checks and report |

## M0 FINDINGS (no code written for M0)

**Synthetic users and cleanup.** `scripts/staging/test-tenant-cleanup.js` removes a vendor only when BOTH markers match: e-mail ends `@v3test.invalid` AND `businessName` starts `V3TEST` (a seeded placeholder vendor, e-mail `@sites.get4domain.invalid`, is also matched by the name). Staff (`g4d_admin_team_members`) and referral partners are matched by the e-mail suffix alone. A partner login is an admin-team row with role `REFERRAL_PARTNER` linked from `referralPartner.staffUserId`; the partner row itself carries the suffix too. A plan subscription, its events, site settings and vendor pack cascade with the vendor. The CLI is `npm run test:cleanup-staging` (`-- --count` prints the vendor count). It does NOT remove tax-rate rows (see QUESTIONS).

**How a session is obtained in tests.** Tests never log in: `test/support/fixtures.ts` signs a JWT with a per-process random `JWT_SECRET` over rows whose `password` is the string `not-a-real-hash`. For the smoke kit a REAL login is needed (`POST /auth/login`, bcryptjs hash compared in `AuthService.loginCore`; order tried: Vendor, then AdminTeamMember with status `active` and a password, then vendor TeamMember). Staff roles are the `AdminRole` enum; SALES is stored as `MARKETING`; a partner is `REFERRAL_PARTNER` and signs in as role `PARTNER`. `LoginDto` needs `@IsEmail` and 6 or more characters.

**How the API starts.** `node dist/src/main` after `npm run build`. Port `PORT` (default 3008), `HOST`. `AppModule` loads `.env.local` then `.env` through `ConfigModule`; in THIS worktree neither exists (only `.env.staging`, `.env.example`, `.env.live.example`), and dotenv never overrides a variable already in the process environment. The launcher refuses to start if either file exists and passes an explicit environment. `assertLiveEnv()` is a no-op unless `NODE_ENV=production` and `V3_LIVE=true`. First attempt failed at start: the legacy `PaymentsService` builds a Razorpay client in its constructor and the SDK refuses an empty key; the launcher now passes the text `placeholder-smoke-kit` for the two legacy key variables (the app itself treats any value starting `placeholder` as "not configured"), so no gateway is reachable.

**Env NAMES.** `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NODE_ENV`, `EMAIL_MODE`, `THROTTLE_DISABLED`, `LEADSPACE_SCHEDULER`, `PLAN_PAYMENTS_LIVE_ENABLED`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (both the placeholder), `PORT`, `HOST`, `CORS_MODE`, `CORS_EXTRA_ORIGINS`, `FRONTEND_URL`, `PUBLIC_APP_URL`, `PUBLIC_API_URL`, `SITE_BASE_DOMAIN`, `PLATFORM_SETTINGS_KEY` (only when the staging file has it). Every provider variable of the parent shell (including the `RAZORPAY_TEST_*`, `RAZORPAY_LIVE_*` and `CASHFREE_*` names the plan-billing code reads) is removed from the child environment.

**CORS.** `buildCorsOptions()`: default mode reflects any origin; `CORS_MODE=strict` allows only `*.get4domain.com`, `http://localhost:<any port>`, `http://127.0.0.1:<any port>`, `FRONTEND_URL` and `CORS_EXTRA_ORIGINS`. The launcher uses strict and names `http://localhost:5173` to `5176`.

**Themes (for M3).** Already built in Batch 4 (slice 5.16d): `src/v3-theme-switch/` (service, store, pipeline port, controllers, migration `20261121100000_v3_theme_switch` already in the folder), 40+ unit tests, `theme-switch.int.spec.ts`. Gap found: the refusal for a paid switch with no approved price used the generic `SERVICE_PRICE_NOT_SET`; the dispatch wants `THEME_SWITCH_FEE_PENDING`. Fee source is the price book entry `THEME_SWITCH` (SUPER_ADMIN only; ADMIN is denied the price book), see ASSUMPTIONS.

## ASSUMPTIONS

1. The repo root for `docs\v3` is `C:\Get4Domain\get4domain-w2`; there is no `docs` folder under `backend-api`.
2. Smoke users are created straight in the staging database with Prisma (no API needed for the seed), with bcryptjs hashes made from random passwords at run time. Each run refreshes every password.
3. The "paid-plan vendor" is a staff-source Handyman Pro subscription row (no gateway, no order, no invoice), the shape a staff assignment makes. Its wallet is not funded (a hand-funded wallet would be fake money in the ledger); a front-end test of a PAID theme switch needs a funded wallet and an approved `THEME_SWITCH` price, neither of which the kit creates.
4. M3: "a SUPER_ADMIN platform setting" is read as the existing price book entry `THEME_SWITCH` (set only by SUPER_ADMIN, effective-dated, empty by default = PENDING). A separate new setting would duplicate it and the services price-book screens already exist. If the owner wants a plain setting key instead, it is a small swap inside `ThemeSwitchService.quote` and `fee`.
5. M3: "Free refused with a registered code" is the existing `THEME_SWITCH_PLAN_STATE` (409): a theme can be switched only while a paid plan is in force or in grace. The preview stays free for everyone.
6. M4(a): "a rate already in force" is read as any rate whose start has passed (in force, superseded or switched off), because every one of them can have priced an order. A waiting rate cannot be moved to a start in the past either.
7. M2: expected results come from code (the role matrix through `effectiveRolesFor`, and the route classes), not from hand lists, so the probe cannot drift from the guards. A refusal by a plan gate for a vendor (`FEATURE_LOCKED`) counts as GATED, not a failure.

## QUESTIONS FOR THE OWNER

0. **Staging price book holds an approved THEME_SWITCH price of 29,900 paise.** `GET /v3/me/site/theme/fee` answers `SET`. `theme-switch.int.spec.ts` creates exactly such a price and removes it afterwards, so this is probably a leftover of an interrupted run (or a row you approved). You said the fee is not decided: look at the services price book on staging and, if it is a leftover, retire it so the front-end lanes see PENDING. I did not touch it.
1. **A leftover test tax row is live on staging (29 tax-rate rows in all).** `GET /v3/public/pricing` shows GST named `V3TEST GST rmwgdpkfm5f57` at 18 percent: a billing integration test created a `g4d_tax_rates` row and `test:cleanup-staging` has no step for tax rates (so `--count` can print 0 while the row stays). The front-end lanes will see that name. Remove it (and add a cleanup step for `V3TEST GST` rows), or leave it so pricing shows GST?
2. `POST /auth/register` tells a caller that an email already has an account (409 "A vendor with this email already exists"): account enumeration. Documented as is; change it?
3. `POST /auth/register` omits `termsAcceptanceRequired` on a first registration (login and `/auth/me` have it). Documented (call `/auth/me` after registering); add it to the register answer?
4. `POST /v3/admin/tax-rates` (create) can still back-date a new rate. Out of scope here (you named PUT and DELETE); lock it too?
