# SMOKE RUN: a real local API on staging, with throwaway logins

For the front-end lanes (vendor, admin and partner apps, and the public site, mocks off). The API runs on your machine, talks to the **STAGING** database only, and cannot reach a payment gateway, a mail provider, an SMS provider or any other service. Every login it creates is a synthetic one: e-mail ends `@v3test.invalid`, business name starts `V3TEST`, so `npm.cmd run test:cleanup-staging` removes it.

Two PowerShell windows: **Window A** runs the API (it stays busy), **Window B** does everything else. Always run each block exactly as written, one block at a time.

Nothing here prints a password or a token. The passwords live only in `C:\Get4Domain\smoke\users.json`, outside every repository. Never commit it, never paste it into a chat.

## 0. Once, in Window B: be on the right branch and build

```powershell
cd C:\Get4Domain\get4domain-w2\backend-api
git branch --show-current
```
It must print `v3-smoke` (or a branch that contains it).

```powershell
npm.cmd run build
```

## 1. Create the throwaway logins (Window B)

```powershell
cd C:\Get4Domain\get4domain-w2\backend-api
node scripts/staging/smoke-seed.js
```
It refuses to run unless the staging guard passes (the project must be on the staging allow-list and not on the production deny-list). It prints each role, its e-mail and id, the referral code `SMKTEST2`, and writes `C:\Get4Domain\smoke\users.json`. Run it again at any time: it finds the same rows and gives every login a **new** random password (the file is rewritten).

| key in users.json | who | notes |
|---|---|---|
| superAdmin | SUPER_ADMIN staff | |
| admin | ADMIN staff | |
| sales | SALES staff (stored as MARKETING) | |
| operations | OPERATIONS staff | |
| partner | referral partner | signs in as role PARTNER; link code `SMKTEST2` |
| vendorFree | vendor on the Free plan | trial site, subdomain `smoke-free-site`, a draft site with one service |
| vendorPaid | vendor on Handyman Pro | subscription row made by the seed, no gateway, no order; subdomain `smoke-paid-site` |

Sign in through `POST /auth/login` with the e-mail and password from `users.json`, like any user.

## 2. Start the API (Window A)

```powershell
cd C:\Get4Domain\get4domain-w2\backend-api
node scripts/staging/smoke-api.js
```
- Port **3008** (change it with `--port 3100`). Listens on `127.0.0.1` only.
- Payment gateways **off** (no gateway key is passed, `PLAN_PAYMENTS_LIVE_ENABLED=false`), mail **captured** (`EMAIL_MODE=test`, nothing is sent), schedulers off, login rate limit off, and a random signing secret made at start (every start signs everyone out).
- Allowed browser origins (strict CORS): `http://localhost:5173`, `5174`, `5175`, `5176` (the Vite dev ports of the vendor, admin, partner and site apps). Any `http://localhost:<port>` and `http://127.0.0.1:<port>` is also accepted by the API's own rule. To name other ports: `node scripts/staging/smoke-api.js --origins http://localhost:5173,http://localhost:4000`.
- It refuses to start if `.env.local` or `.env` exists in `backend-api` (the app would load it and it could point at a real database or real providers), if `dist` is missing (run the build), or if the staging guard fails.
- Ready when Window A prints `Get4Domain API running on port 3008`.

Check it (Window B):
```powershell
curl.exe -s http://localhost:3008/health
curl.exe -s http://localhost:3008/v3/public/pricing
```

Point the app you are testing at `http://localhost:3008` with its mock switch off (the app's own setting for the API address).

## 3. Optional: run the probe (Window B, with the API running)

```powershell
cd C:\Get4Domain\get4domain-w2\backend-api
node scripts/staging/smoke-probe.js --out ..\docs\v3\SMOKE_RESULTS_A3.md
```
It signs in each throwaway role and calls every GET route of the public, partner, vendor and admin areas as each of them (and as nobody), checks allowed roles get in and refused roles are refused, and writes the table. GET only. It refuses any API that is not on localhost.

## 4. Stop the API (Window A)

Press **Ctrl+C** in Window A. The launcher stops the API with it. Check nothing is left:
```powershell
Get-NetTCPConnection -LocalPort 3008 -State Listen -ErrorAction SilentlyContinue
```
No output means it is stopped.

## 5. Remove what the seed made (Window B)

```powershell
cd C:\Get4Domain\get4domain-w2\backend-api
node scripts/staging/smoke-seed.js --reset
```
Removes **only** the smoke users (matched by the fixed tag `smoke` in the e-mail, plus the `@v3test.invalid` and `V3TEST` markers) and deletes `users.json`. The general sweep is `npm.cmd run test:cleanup-staging` (and `npm.cmd run test:cleanup-staging -- --count` must then print 0); it removes the smoke users too, so run the seed again afterwards.

## Good to know

- A Free vendor gets `403 FEATURE_LOCKED` on tabs outside its plan (accounts, customers, jobs, appointments, store and so on). That is the plan gate working, not a fault: use `vendorPaid` for those screens (the paid plan is Handyman Pro; the store tabs belong to the e-commerce track and stay locked for both).
- Staging has no real gateway keys and none are used. Anything that needs a payment (plan orders, wallet top-ups) answers `PAYMENTS_DISABLED` or `PAYMENTS_NOT_CONFIGURED`. A wallet funded by hand is not part of this kit.
- The seed vendors share one handyman business category chosen by the seed.
- Environment NAMES the API launcher sets: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NODE_ENV`, `EMAIL_MODE`, `THROTTLE_DISABLED`, `LEADSPACE_SCHEDULER`, `PLAN_PAYMENTS_LIVE_ENABLED`, `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (both the text `placeholder-smoke-kit`: the legacy payment service builds its client at start-up and the SDK refuses an empty value; the app itself treats any value starting `placeholder` as not configured), `PORT`, `HOST`, `CORS_MODE`, `CORS_EXTRA_ORIGINS`, `FRONTEND_URL`, `PUBLIC_APP_URL`, `PUBLIC_API_URL`, `SITE_BASE_DOMAIN`, and `PLATFORM_SETTINGS_KEY` only when the staging file has it.
