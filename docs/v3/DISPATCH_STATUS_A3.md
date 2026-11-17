# DISPATCH STATUS A3 (backend lane: smoke kit, themes, small fixes)

Branch `v3-smoke` (from `v3-w4-fix`), folder `C:\Get4Domain\get4domain-w2\backend-api` (repo root `C:\Get4Domain\get4domain-w2`; docs live in `..\docs\v3`).

| Job | Status | Commit | One line |
|---|---|---|---|
| M0 | DONE | (this file) | investigation, findings below |
| M1 | TODO | | smoke seed, local API launcher, SMOKE_RUN.md |
| M2 | TODO | | smoke probe and SMOKE_RESULTS_A3.md |
| M3 | TODO | | themes backend gap |
| M4 | TODO | | tax-rate PUT/DELETE, /auth/register docs, M2 fixes |
| M5 | TODO | | final checks and DISPATCH_REPORT_A3.md |

## M0 FINDINGS (no code written for M0)

**Synthetic users and cleanup.** `scripts/staging/test-tenant-cleanup.js` removes a vendor only when BOTH markers match: e-mail ends `@v3test.invalid` AND `businessName` starts `V3TEST` (a seeded placeholder vendor, e-mail `@sites.get4domain.invalid`, is also matched by the name). Staff (`g4d_admin_team_members`) and referral partners are matched by the e-mail suffix alone. A partner login is an admin-team row with role `REFERRAL_PARTNER` linked from `referralPartner.staffUserId`; the partner row itself carries the suffix too. `findTestVendorIds` and the cleanup steps already cover: vendor, CMS, wallet, products, team members, plan orders, partner links/ledger/payouts. A plan subscription, its events and site settings cascade with the vendor (`onDelete: Cascade`). The CLI is `npm run test:cleanup-staging` (`-- --count` prints the vendor count).

**How a session is obtained in tests.** Tests never log in: `test/support/fixtures.ts` signs a JWT with a per-process random `JWT_SECRET` (`seedStaff`, `seedPartnerLogin`, `seedBootstrapAdmin`, `vendorToken`) over rows whose `password` is the string `not-a-real-hash`. For the smoke kit a REAL login is needed (`POST /auth/login`, bcryptjs hash compared in `AuthService.loginCore`). Order tried: `Vendor` by e-mail, then `AdminTeamMember` (status `active`, a password), then vendor `TeamMember`. Staff roles are the `AdminRole` enum; SALES is stored as `MARKETING` (labels `FIELD_EXECUTIVE`/`TELECALLER` fold into it); a partner is `REFERRAL_PARTNER` and signs in as role `PARTNER`. `LoginDto` needs `@IsEmail` and a password of 6 or more characters. A bootstrap admin is a Vendor with role `ADMIN`/`SUPER_ADMIN` (becomes SUPER_ADMIN staff); a SUPER_ADMIN staff row is an `AdminTeamMember` with role `SUPER_ADMIN`.

**How the API starts.** `node dist/src/main` (`npm run build` first, `npm start`). Port `PORT` (default 3008), `HOST` (default 0.0.0.0). `AppModule` calls `ConfigModule.forRoot({ envFilePath: ['.env.local', '.env'] })`; in THIS worktree neither file exists (only `.env.staging`, `.env.example`, `.env.live.example`), and dotenv never overrides a variable already in the process environment. The launcher therefore refuses to start if `.env.local` or `.env` exists in the folder, and passes an explicit environment to the child process. `assertLiveEnv()` is a no-op unless `NODE_ENV=production` and `V3_LIVE=true`.

**Env NAMES the local API needs (names only).** `DATABASE_URL`, `DIRECT_URL` (staging, from the guard), `JWT_SECRET` (random per start), `PLATFORM_SETTINGS_KEY` (optional, only for sealing credentials), `PORT`, `NODE_ENV` (not `production`), `EMAIL_MODE=test` (mail captured, nothing sent), `THROTTLE_DISABLED=true` (the login rate limit would block the probe's six sign-ins), `LEADSPACE_SCHEDULER=off`, `PLAN_PAYMENTS_LIVE_ENABLED=false`, `FRONTEND_URL`, `PUBLIC_APP_URL`, `PUBLIC_API_URL`, `SITE_BASE_DOMAIN`, `CORS_MODE`, `CORS_EXTRA_ORIGINS`. Provider variables the launcher deletes from the child environment so nothing real can be called: the same list as `test/support/staging-env.ts` (`RAZORPAY_*`, `RESEND_API_KEY`, `MSG91_*`, `FAST2SMS_*`, `OPENAI_API_KEY`, `CLAUDE_API_KEY`, `SUPABASE_*`, `META_*`, `RESELLERCLUB_API_KEY`, and the rest).

**CORS.** `buildCorsOptions()`: default mode reflects any origin (credentials true). With `CORS_MODE=strict` only `*.get4domain.com`, `http://localhost:<any port>`, `http://127.0.0.1:<any port>`, `FRONTEND_URL` and `CORS_EXTRA_ORIGINS` pass. So Vite dev ports on localhost need no extra setting even in strict mode; the launcher uses strict and lists the four Vite origins explicitly anyway.

**Ports.** API 3008 by default; the Vite dev ports of the vendor, admin, partner and site apps are chosen by the front-end lanes (assumed 5173 to 5176, configurable by the launcher flag `--origins`).

**Themes (looked at for M3).** `src/v3-theme-switch/` (service, store, core, site pipeline port, errors, controllers) and `GET /v3/me/site/themes` already exist from Batch 4; the investigation for M3 continues in its own row.

## ASSUMPTIONS

1. The repo root for `docs\v3` is `C:\Get4Domain\get4domain-w2` (the dispatch writes `docs\v3\...` relative to it); there is no `docs` folder under `backend-api`.
2. Smoke users are created straight in the staging database with Prisma (no API needed for the seed), with bcryptjs hashes made from random passwords at run time.
3. The "paid-plan vendor" is a subscription row written for a Pro plan with a staff source (no gateway, no order, no invoice), the same shape a staff assignment makes.

## QUESTIONS FOR THE OWNER

(none yet)
