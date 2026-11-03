# Production release runbook — V3 Step 0 (branch `v3-step0`, PR #1)

> Written 2026-11-03. **Document only. Nothing in this file has been run.** Every step is for the owner to run, in order, and to tick off. Where something could not be confirmed from the repository it says **"owner to confirm on the server"**.
>
> Plain-English key: *the server* = the Contabo VPS (Docker behind nginx, Cloudflare in front, Flexible SSL). *The API* = the `backend-api` container (name `get4domain_backend`, port 3008, public host `gapi.get4domain.com`). *The website* = the `get4domain_mvp` container (name `get4domain_frontend`, port 3006). Vercel is **not** part of production; the grey Vercel "Preview" check on the PR can be ignored.
>
> Stop rule for every step: if the expected output is not what you see, **stop, do not continue, and use that step's rollback**. Ask before improvising.

## What this release contains (so you know what you are approving)
- **Backend (`backend-api`)**: wallet debits that cannot go negative and end cleanly when the database is busy (S12); staff roles that really limit what MARKETING / OPERATIONS staff can do (S7); team members blocked from owner-only money, plan, domain and payment-key actions (S8); new sign-in-session and password routes: reset by email, change password, rotating refresh tokens (S13); `GET /health` and `GET /health/ready`.
- **Website (`get4domain_mvp`)**: SEO changes (301 redirects from `/site/<name>` to `<name>.get4domain.com`, `noindex` on private pages, cleaner structured data, `robots.txt`, `sitemap.xml`, no `/demo/*` in the sitemap).
- **Database**: two **additive** migrations (new column, new tables; nothing is dropped or rewritten): `20261102120000_wallet_idempotency` and `20261103120000_account_security`.
- **Not in this release**: the 72 baseline files (the four client sites' Website Manager work). They exist only as uncommitted edits on your PC (backed up in `C:\Get4Domain\_backup_baseline_2026-11-03`) and are **not** in the branch, so they cannot reach the server. The other client sites (Allwin, Deebi, Indian Ambulance, KSM Quantum, Step N Rock) are **not rebuilt** by this runbook.

---

## 1. Preconditions (nothing is touched yet)

- [ ] **1.1 The latest work is pushed.** On your PC: `git ls-remote origin v3-step0`. Expected: the commit hash is the same as `git rev-parse HEAD` in `C:\Get4Domain\get4domain-site` (at the time of writing `6b0ecb5`, or newer if more was committed). Rollback: not needed (read-only).
- [ ] **1.2 PR #1 is green on all three jobs.** GitHub → the repo → Pull requests → #1 → Checks. Expected: **backend**, **staging-gate** and **frontend-build** all show a green tick (the Vercel Preview line is not one of the three). Not green? Stop; do not continue. Rollback: not needed.
- [ ] **1.3 You have reviewed the commits.** PR #1 → Commits. At the time of writing the PR holds **31 commits** (you mentioned 29; the count grows by each log commit, so compare with the PR, not this file). Read the commit titles; the detail per task is in `docs/v3/AUTORUN_LOG.md`. Rollback: not needed.
- [ ] **1.4 Decision on the 72 baseline files: excluded.** Confirm to yourself that this release is **only** what is in PR #1. The 72 files are not in the PR (PR #1 → Files changed will not list `allwin-tours/`, `deebiphotography/`, `ksm-quantum/` or `stepnrock/` content-layer files). Rollback: not needed.
- [ ] **1.5 Vercel is not involved.** Nothing to do. Production is only the server. A push to GitHub makes a Vercel Preview; it never changes the live site.
- [ ] **1.6 What the server pulls — owner to confirm on the server.** From `docs/v2/DEPLOYMENT.md` and `docs/v3/BRANCH_AND_DEPLOY_FINDINGS.md`: the server folder is **`/srv/get4domain-site`** and it pulls **`origin/get4domain-site`** (`git pull origin get4domain-site`). One older guide (`MONDAY_DEPLOYMENT_GUIDE.md`) instead used `/srv/get4domain` and the default branch (`main`), which has none of the product code. Run on the server:
  `git -C /srv/get4domain-site branch --show-current` — expected: `get4domain-site`.
  `ls -d /srv/get4domain 2>/dev/null` — expected: nothing printed. If the first line prints anything else, or the second prints a folder, **stop and tell me**; the steps below assume the first answer. Rollback: not needed (read-only).
- [ ] **1.7 Do not merge to `main`, do not rename `main`.** `main` is a different, older project and is not used by this release.

## 2. Backups (before anything changes)

- [ ] **2.1 Fresh database backup.** Supabase dashboard → the production project → **Database → Backups**. Take/confirm a **new backup made now** (if only daily backups exist, use *Download* or create an on-demand backup if your plan has it). Expected: a backup dated today appears in the list. Write its date/time in your own notes. Rollback: not needed.
- [ ] **2.2 Copy the server settings files.** On the server:
  `mkdir -p ~/release-backup-v3 && cd /srv/get4domain-site`
  `cp backend-api/.env ~/release-backup-v3/backend.env`
  `cp backend-api/docker-compose.yml ~/release-backup-v3/backend-compose.yml`
  `cp get4domain_mvp/.env ~/release-backup-v3/frontend.env`
  `cp get4domain_mvp/docker-compose.yml ~/release-backup-v3/frontend-compose.yml`
  `chmod 600 ~/release-backup-v3/*.env`
  Expected: `ls -l ~/release-backup-v3` lists four files. These contain secrets: keep them on the server (or in your password manager), **never** in GitHub, chat or email. If a file name differs (for example the frontend uses `.env.production`), copy that instead — **owner to confirm on the server**. Rollback: not needed.
- [ ] **2.3 Write down the commit hash that is deployed now.** On the server: `git -C /srv/get4domain-site rev-parse HEAD`. Expected: one 40-character hash (at the time of writing the branch tip was `233d78c…`). **Keep this hash; it is your rollback target in section 8.** Also record the running images: `docker ps --format '{{.Names}}  {{.Image}}'` and keep the output.
- [ ] **2.4 Uploads volume.** Nothing to do for this release (no change to uploads). If you want an extra copy anyway, use the "3b.1 backup" block in `docs/v2/DEPLOYMENT.md`.

## 3. Database migrations

**What they are (both additive, both already rehearsed on staging):**
- `20261102120000_wallet_idempotency`: adds one optional column and one unique index to `g4d_wallet_transactions`.
- `20261103120000_account_security`: adds one optional column `passwordChangedAt` to `Vendor`, `g4d_admin_team_members` and `g4d_team_members`; creates two new tables `g4d_password_resets` and `g4d_refresh_tokens` (with row-level security switched on).
Old code ignores all of it, so the migrations can safely be applied **before** the new code is deployed.

- [ ] **3.1 Confirm the rehearsal on staging (read-only).** On your PC, in `C:\Get4Domain\get4domain-site\backend-api`: `npm run db:staging:migrate-status`. Expected: every migration listed as applied, including the two above, and "Database schema is up to date". Also the latest green **staging-gate** job on PR #1 (step 1.2) is the proof that the full test suite passed against staging with these migrations. Rollback: not needed (staging only).
- [ ] **3.2 Check what production already has (read-only).** On the server, in `/srv/get4domain-site/backend-api`: `npx prisma migrate status`. Expected: it lists the two new migrations as **not yet applied**, and **no** failed or unfinished ones. If it reports a failed/unfinished migration (error P3009), **stop**: that needs the "mark rolled back" step in `docs/v2/DEPLOYMENT.md` §3b.2 first, with my help. (`docs/v3/V3_PRODUCTION_MIGRATION_STATE.md` has the earlier read-only comparison.) The way to run `npx` on the server follows the previous release — **owner to confirm on the server** that Node and `node_modules` exist there; if not, tell me and we use a one-off container instead. Rollback: not needed.
- [ ] **3.3 Explicit approval.** Only continue if backup 2.1 exists **and** you say, in your own words, "apply the two migrations to production". Nobody else (including me) does this step for you.
- [ ] **3.4 Apply.** On the server, in `/srv/get4domain-site/backend-api` (code at the new commit — see 5.1 — or any commit that contains the two migration folders): `npx prisma migrate deploy`. Expected: "2 migrations found … applied" / "All migrations have been successfully applied". Note: the API container does **not** run migrations by itself; this is the only place they are applied.
  Rollback / forward fix: the migrations only **add**. If something looks wrong, do **not** try to undo them: redeploy the previous code (section 8) — it ignores the new column/tables — and tell me; a forward fix is a new migration. Restoring the database backup is the last resort and loses everything written since the backup.
- [ ] **3.5 Verify.** In the Supabase **SQL editor** (production project) run these read-only queries:
  `select migration_name, finished_at, rolled_back_at from _prisma_migrations where migration_name in ('20261102120000_wallet_idempotency','20261103120000_account_security');` — expected: 2 rows, `finished_at` filled, `rolled_back_at` empty.
  `select count(*) from information_schema.tables where table_name in ('g4d_password_resets','g4d_refresh_tokens');` — expected: `2`.
  `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;` — expected: `0` (no table without row-level security).
  Rollback: see 3.4.

## 4. Server settings and the database password

Names only. Never paste values into chat, the PR or this file. Edit the files on the server (`nano /srv/get4domain-site/backend-api/.env`), then values are picked up at the restart in section 5.

- [ ] **4.1 Settings for the API (`backend-api/.env`).**
  Must be present (check, do not retype if already there): `JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `RESEND_API_KEY`, `NODE_ENV=production`.
  **Set now:** `FRONTEND_URL` = `https://get4domain.com` (reset emails build their link from it; without it the built-in default is the same address).
  **Optional, safe defaults exist (leave unset unless you want to change them):** `PASSWORD_RESET_TTL_MINUTES`, `PASSWORD_RESET_MAX_PER_HOUR`, `REFRESH_TOKEN_TTL_DAYS`, `AUTH_MIN_FAILURE_MS`, `LOGIN_MAX_FAILURES`, `LOGIN_FAILURE_WINDOW_MINUTES`.
  **Leave UNSET for now:** `ACCESS_TOKEN_TTL`. Unset means sign-in tokens last as long as today. Do **not** set a short value (like 15 minutes) until the website uses refresh tokens (section 6), or users will be signed out constantly.
  **Never set in production:** `EMAIL_MODE`. `EMAIL_MODE=test` captures emails instead of sending them; the code ignores it when `NODE_ENV=production`, but do not rely on that — leave it out.
  **Only if you use connected client sites:** `REVALIDATE_SECRET` (same value in the API and the website). Not needed by anything in PR #1 — **owner to confirm** whether it is already set; if it is, leave it.
  Check: `grep -c '^FRONTEND_URL=' backend-api/.env` — expected `1`. Rollback: put the saved copy back (`cp ~/release-backup-v3/backend.env backend-api/.env`).
- [ ] **4.2 Website settings (`get4domain_mvp/.env`).** No new variable is introduced by this branch. Check that the API address variables are the same as today (do nothing if they are). Rollback: restore the saved copy from 2.2.
- [ ] **4.3 Rotate the production database password (its own step; do it only when 3.5 passed and the site is working on the old code).** Purpose: a clean rotation of the main database credential, done as its own controlled change.
  1. Pick a moment when a brief reconnect is acceptable. Have the **old** password saved in your password manager first (rollback).
  2. Supabase → production project → **Project Settings → Database → Reset database password** (the `postgres` user). Use a long random password with letters and digits only (avoids characters that break connection strings). Copy it to the password manager.
  3. On the server edit `backend-api/.env`: update the password inside **`DATABASE_URL`** and **`DIRECT_URL`** (same new password in both). Do the same for any other server file, script or app that connects to this database — **owner to confirm on the server** with `grep -l "supabase" /srv/*/.env /srv/*/*/.env 2>/dev/null` (shows file names only; do not open them in chat).
  4. Restart the API: `cd /srv/get4domain-site/backend-api && docker compose up -d --force-recreate`.
  5. Expected: `curl -s http://127.0.0.1:3008/health/ready` returns a body with `ok`/ready and HTTP 200, and `docker compose logs --tail=30 backend` shows no authentication errors.
  6. Also rotate the read-only audit role (`audit_readonly`) password in Supabase, or remove the role if you no longer need it, and update/delete the local file that held its address on your PC.
  Rollback: Supabase → Reset database password again and type the **old** password back in; restore `backend.env` from 2.2; restart as in step 4.
  Also rotate (separate, same style): any key you pasted into a chat during the project (check your own notes). Do not rotate `JWT_SECRET` in this release: it signs out every user.

## 5. Deploy (one service at a time)

- [ ] **5.1 Get the release onto the server.** Two ways; use the first, **owner to confirm on the server** which branch it follows (step 1.6).
  *Way A (recommended): the server keeps following `get4domain-site`.* On GitHub, PR #1 → **Ready for review**, then **Merge pull request** into `get4domain-site` (this is **not** `main`). That is your decision and your click; I do not do it. Then on the server: `cd /srv/get4domain-site && git pull origin get4domain-site`. Expected: "Fast-forward"/"Updating 233d78c..…", no conflict message. Check `git rev-parse HEAD` equals the PR's merge commit.
  *Way B: test the branch first without merging.* `cd /srv/get4domain-site && git fetch origin v3-step0 && git checkout v3-step0`. Expected: "Switched to branch 'v3-step0'". Afterwards the server no longer follows `get4domain-site`, so switch it back in section 8 before any later pull.
  Rollback: `git checkout <hash from 2.3>` (section 8). Do not use `git reset` on the server's working folder if there are local edits — check `git status` first; **owner to confirm** the server folder has no hand-edited tracked files.
- [ ] **5.2 Build and start the API first.**
  `cd /srv/get4domain-site/backend-api && docker compose build --no-cache && docker compose up -d --force-recreate`
  `docker compose logs --tail=50 backend`
  Expected: the build finishes without errors; the log shows "Nest application successfully started" and no red errors about the database. Rollback: section 8.
- [ ] **5.3 Health check.** `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3008/health` — expected `200`. `curl -s http://127.0.0.1:3008/health/ready` — expected 200 and a body saying the database answered. Then from any computer: `https://gapi.get4domain.com/health` — expected 200. (Docker also runs this check itself every 30 seconds: `docker ps` should say "healthy".) Rollback: section 8.
- [ ] **5.4 Smoke tests on the API (use **your own** test accounts; never a customer's).**
  a. **Old sign-in still works:** sign in on the website the normal way. Expected: you reach the dashboard.
  b. **New session routes exist:** `curl -s -o /dev/null -w '%{http_code}\n' -X POST https://gapi.get4domain.com/auth/session/login -H 'Content-Type: application/json' -d '{}'` — expected `400` (empty body refused), **not** `404`. Same for `/auth/session/refresh`, `/auth/session/logout`, `/auth/password/forgot`, `/auth/password/reset`, `/auth/password/change` (the last needs sign-in: expect `401`).
  c. **Forgot-password gives the same answer for any address:** POST `/auth/password/forgot` with an address that does not exist — expected 2xx with a neutral message, and no email arrives. (Do **not** trigger it for a real customer.)
  d. **Staff limits:** if you have a MARKETING or OPERATIONS staff test account, sign in as it and open an owner-only action (for example change a vendor's plan): expected `403`. Production has no test staff accounts that I know of; if none exists, **skip** and rely on the staging tests — do not create accounts only for this unless you decide to.
  e. **Wallet top-up — test mode only:** only if the server's Razorpay keys are *test* keys, make one small top-up on your own test vendor and check the balance. **If the keys are live, skip this test. Never make a real payment as a test.**
  f. Watch the logs while you do these: `docker compose logs -f --tail=100 backend` (Ctrl+C to stop). Expected: no stack traces. A line like "Wallet … failed with a database error" is a warning to note; report it to me.
  Rollback: section 8 (or 8.3 to switch the new routes off).
- [ ] **5.5 Build and start the website second.** `cd /srv/get4domain-site/get4domain_mvp && docker compose build --no-cache && docker compose up -d --force-recreate && docker compose logs --tail=50`. Expected: build passes; the app is listening on port 3006. Check: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3006/` — expected `200`. Then open https://get4domain.com in a private window: home page loads, logins work. Rollback: section 8.
- [ ] **5.6 Do not touch the other client sites** (Allwin, Deebi, Indian Ambulance, KSM Quantum, Step N Rock). Their containers keep running as they are. Check afterwards: `docker ps` shows all of them still "Up".

## 6. Frontend gaps — what blocks the release and what can follow

| Gap | Blocks this release? | What it means for you |
|---|---|---|
| **Forgot / reset password pages are not built in the website.** The reset email link points at `/reset-password?token=…`, which does not exist yet. | **No** — but **do not announce or link a reset feature**, and do not advertise "forgot password" until the pages exist. The backend routes can stay on; nobody can reach them from the website. | Gate = do nothing visible. If you want the routes fully off until the pages exist, use 8.3. **Must be built before** customers can recover a lost password. |
| **New sign-in routes (`/auth/session/*`) are not used by the website.** The website still signs in with the old `/auth/login`. | **No.** Nothing changes for users. | The new routes simply wait. |
| **Access-token lifetime shortening** (`ACCESS_TOKEN_TTL`) waits for the website to use refresh tokens. | **No** — as long as `ACCESS_TOKEN_TTL` stays **unset** (step 4.1). | **Blocking only if you set it early.** Leave it unset until the website is switched. |
| **Legacy `/auth/login` follow-up** (same suspended-account message and timing as the new login). | **No.** | It needs the baseline file `auth/auth.service.ts` (one of the 72) to be committed first; it can follow later. Until then the old login keeps its old (slightly more revealing) behaviour. |
| **Admin menu may still show links that staff now get a 403 on** (`lib/admin-nav.ts`). | **No.** | Cosmetic: a staff member clicks, sees an error. Fix is a small frontend task. |
| **Hide Payments / Domain / theme-buy / wallet top-up buttons from team members.** | **No** — the backend already refuses them (403). | Cosmetic for now. |
| **Plan-aware pages (V3 prices, directory)** | **No** — not part of this release. | |

So: **nothing in this table blocks the release.** The only way to create a problem is to set `ACCESS_TOKEN_TTL` early or to announce password reset before its pages exist.

## 7. SEO after the deploy

- [ ] **7.1 Read-only look at the live site (browser, no tools).**
  Open `https://get4domain.com/robots.txt` — expected: no `Disallow: /_next/` line; lists the sitemap. Open `https://get4domain.com/sitemap.xml` — expected: no URL containing `/demo/`. Open `https://get4domain.com/demo/clinic` in a private window — expected: you are sent to `/visit-demo` (this is the demo gate, unchanged). Open `https://get4domain.com/site/<a real vendor name>` — expected: it redirects (301) to `https://<name>.get4domain.com`. Rollback: section 8.
- [ ] **7.2 The checker script.** `get4domain_mvp/scripts/seo-check.mjs` **refuses any address that is not on the same computer** (by design, so it can never hit the live site from outside). So do not point it at `https://get4domain.com`. Two options, **owner to confirm which you want**: (a) skip it — 7.1 covers the key points; or (b) run it **on the server**, against the website container on its local address: `cd /srv/get4domain-site/get4domain_mvp && DEMO_ACCESS_SECRET=<the value already set for the website, do not print it> node scripts/seo-check.mjs --base http://127.0.0.1:3006`. Expected: all groups pass, exit code 0. It sends plain GET requests only. Some checks that need a backend-less local build may report differences on a live build — send me the output instead of acting on it.
- [ ] **7.3 Google Search Console** (https://search.google.com/search-console): (1) URL Inspection of `https://get4domain.com/demo/clinic` — expected "noindex" / redirect, not "indexed"; (2) open the *Page indexing* report and, for the groups "Duplicate / alternate page with proper canonical" and "Page with redirect" that came from `/site/…` and `/demo/…` addresses, click **Validate fix**; (3) resubmit `https://get4domain.com/sitemap.xml`. Rollback: not needed (Search Console only reads).
- [ ] **7.4 Not yet.** Do **not** add a `Disallow: /demo/` line to `robots.txt` yet: Google must be able to see the `noindex` first. Do **not** change Cloudflare SSL to Full (strict), add the `www` → apex redirect, or turn on HSTS as part of this release: that is a **separate later change** with its own plan (`docs/v3/SEO_0_PLAN.md`, "0.4 plan"): first an origin certificate and `:443` on nginx for **every** site, then Full (strict), then the redirect, then HSTS in small steps. A mistake there can take every site offline, so it never shares a deploy with code.

## 8. Rollback plan

- [ ] **8.1 Go back to the previous code (normal rollback).** On the server: `cd /srv/get4domain-site && git checkout <hash from 2.3>` (if the server was in Way B, also run `git checkout get4domain-site` afterwards when you are finished), then in each of `backend-api` and `get4domain_mvp`: `docker compose build --no-cache && docker compose up -d --force-recreate`. Expected: `git rev-parse HEAD` equals the saved hash; `/health` returns 200; the site loads. The two migrations **stay**: they are additive and the old code ignores them.
- [ ] **8.2 Restore the database backup (last resort only).** Supabase → Database → Backups → restore the backup from 2.1. This **erases everything written after that backup** (new sign-ups, payments, edits). Do it only when the data itself is damaged, and tell me first.
- [ ] **8.3 Switch the new routes off quickly without redeploying.** The new routes all live under `/auth/session/` and `/auth/password/`. In the nginx file for `gapi.get4domain.com` add, above the existing `location /`, `location ~ ^/auth/(session|password)/ { return 403; }`, then `nginx -t && nginx -s reload`. Old `/auth/login` keeps working. Undo: delete those lines and reload. (Nginx file location: **owner to confirm on the server**.) There is no on/off setting for these routes inside the app.
- [ ] **8.4 Settings rollback.** Put back the `.env` files saved in 2.2 and recreate the containers (`docker compose up -d --force-recreate`).
- [ ] **8.5 Database password rollback.** Step 4.3 "Rollback".
- [ ] **8.6 After any rollback** write down what happened, and tell me before trying again.

## 9. Go / no-go checklist

**GO only if every line is true:**
- [ ] PR #1 shows all three jobs green and the commits have been reviewed (1.2, 1.3).
- [ ] The server folder and branch are what step 1.6 expects.
- [ ] A fresh database backup exists, the `.env`/compose copies exist, and the deployed commit hash is written down (section 2).
- [ ] Both migrations show as applied in staging and as "not yet applied, nothing failed" in production (3.1, 3.2).
- [ ] You have said, in your own words, that the two migrations may be applied to production (3.3).
- [ ] `ACCESS_TOKEN_TTL` and `EMAIL_MODE` are **not** set on the server (4.1).
- [ ] You are not planning any Cloudflare, nginx or DNS change in the same session (7.4).

**NO-GO (stop) if any of these happens:** a failed or unfinished migration is reported; `/health/ready` does not return 200 after the API starts; login stops working for your own test account; the logs show repeated errors; a step's expected output does not match.

### What the owner must NOT do
- Do **not** merge anything into `main`, rename `main`, or change the repository's default branch for this release. (Merging PR #1 into `get4domain-site` is the release act; `main` is untouched.)
- Do **not** force-push, delete branches, or reset the server's folder.
- Do **not** run migrations, `prisma db push`, or `prisma migrate reset` against production in any way other than step 3.4, and never `migrate dev`.
- Do **not** put any password, key or connection string into chat, GitHub, a commit, a screenshot or this file.
- Do **not** set `EMAIL_MODE`, or a short `ACCESS_TOKEN_TTL`, in production.
- Do **not** rotate `JWT_SECRET` in this release (it signs everyone out).
- Do **not** make a real payment or send real emails/SMS/WhatsApp as a test.
- Do **not** commit or deploy the 72 baseline files as part of this release.
- Do **not** change Cloudflare SSL mode, DNS or HSTS in the same session as the deploy.

## Open questions for the owner (answers change the steps)
1. Which folder and branch does the server really use (step 1.6)? Until confirmed, Way A is written on the evidence of `docs/v2/DEPLOYMENT.md`.
2. Does the server have Node/`npx` to run `prisma migrate deploy`, as the previous release did (step 3.2)?
3. Are the server's Razorpay keys test or live (step 5.4e)?
4. Do you want the SEO checker run on the server (7.2b) or skipped (7.2a)?
5. Is `REVALIDATE_SECRET` already set on the server, and does anything else besides the API connect to the production database with the `postgres` password (4.3)?
