# DISPATCH REPORT E1: deploy packaging for V3 on the v3live container

Branch `v3-pack`. Nothing pushed. Nothing was run against a server, a database, Docker or the network; everything is plain text plus static tests.

## Done

| Job | Result | Commit |
|---|---|---|
| E0 Investigate | six pieces mapped, four deploy gaps found (table at the top of `DISPATCH_STATUS_E1.md`) | 23f01e3 |
| E1a Build plan | `docs/v3/DEPLOY_V3LIVE_PLAN.md`: clone with three read-only deploy keys, one tag per release, SPAs in their own nginx containers, port table | c1464c5 |
| E1b Compose and env | `deploy/v3live/docker-compose.apps.yml`, `api/Dockerfile` (+ ops stage), `spa/Dockerfile`, `site/Dockerfile`, `env/*.example` (4), static spec | ac398ad |
| E1c Host nginx | five host blocks, two V2 client blocks (placeholder upstreams), five snippets, Cloudflare real-IP generator, `README.md`, `WILDCARD_SWITCH_LATER.md`, static spec | 63d4003 |
| E1d Runbook | `deploy/v3live/RUNBOOK.md` (41 numbered steps in three labeled windows, rollback table), guard tests | 2ba2973 |
| E1e Final checks | `npm.cmd run build`: exit 0. `npm.cmd run test:ci`: **292 suites, 5622 tests, all passed**. This report. | (this commit) |

New tests: `backend-api/test/live-apps-deploy-files.spec.ts` (20 tests) and `backend-api/test/live-nginx-files.spec.ts` (about 55). They read the files as text: no secret, no value in any template, ports only on `V3_BIND_IP`, non-root users, health checks, dropped capabilities, flags off, every required name present, balanced braces, noindex, one server block per host.

## Blocked

Nothing. No job hit the three-failure rule; `docs/v3/E1_LOG.md` was not needed. (One of my own test patterns failed twice during E1b and was fixed in the test: it matched variable names and `user: "1001:1001"`. No test was weakened; the patterns were narrowed to what they were meant to catch.)

## Deploy blockers found (the "smallest fix" rule)

No application code was changed. Each blocker was fixed additively, in `deploy/v3live/` or in the runbook:

1. **The API image cannot be built from `backend-api/`.** `npm run build` runs `scripts/build-renderer.js`, which reads `../themes`; `Dockerfile.v3live` has `backend-api` as its context. Fix: `deploy/v3live/api/Dockerfile` builds from the repo root, with an allow-list `Dockerfile.dockerignore`. A test pins that `themes` is copied and that the renderer script still reads `../themes`.
2. **A private database address is refused by the startup check.** The API must use the Postgres container's Docker name, not its IP. Runbook steps 4, 8, 15.
3. **The runtime image has no `psql`, `pg_dump` or Prisma CLI**, which the baseline, migrate, seed, bootstrap and backup scripts need. Fix: an `ops` target in the same Dockerfile, run as a throw-away container on `v3net`.
4. **`baseline-live.js` requires a schema named `extensions`** (Supabase). Plain Postgres has none. Fix without code: runbook step 20 creates it and sets the database `search_path`.
5. **The host nginx is outside the LXD container**, so the existing bridge-address design is unreachable. Fix: every port is published on the container's own address (`V3_BIND_IP`).
6. **Public site:** `NEXT_PUBLIC_*` values are inlined at build time but its Dockerfile has no `ARG`; mocks default ON. Fix: `site/Dockerfile` wrapper with the arguments; `V3_PUBLIC_USE_MOCKS=false` written explicitly.

## Files created

`docs/v3/DISPATCH_STATUS_E1.md`, `DEPLOY_V3LIVE_PLAN.md`, `DISPATCH_REPORT_E1.md`; `.gitignore` (one added line: filled `deploy/v3live/env/*.env`); `deploy/v3live/`: `docker-compose.apps.yml`, `RUNBOOK.md`, `api/{Dockerfile,Dockerfile.dockerignore}`, `spa/Dockerfile`, `site/{Dockerfile,Dockerfile.dockerignore}`, `env/{api,site,site.build,compose}.env.example`, `nginx/{README.md,WILDCARD_SWITCH_LATER.md,update-cloudflare-ips.sh}`, `nginx/{api,app,admin,partner,directory,mrtravels,s2travels}.get4domain.com.conf`, `nginx/snippets/g4d-{proxy,gzip,headers-api,headers-spa,headers-site}.conf`; `backend-api/test/live-apps-deploy-files.spec.ts`, `live-nginx-files.spec.ts`.

`backend-api/test/baselines/route-classification.json` still shows the expected line-ending-only difference and was never staged.

## Not verified (honest list)

No image was built. Not run: `docker build` of all six images, `docker compose config`, `nginx -t`, the Cloudflare script, any database command, the SPA wrapper's `sed` edits against the real apps image (the build is written to fail loudly if they do not apply), and whether `postgresql17-client` exists in the Alpine release `node:20-alpine` uses today. The permission model of `g4d_live` in the existing Postgres container is assumed (owner of the database, may create trusted extensions); the runbook says what to do if not.

## Questions for the owner

1. **How do the repos reach the server?** The runbook recommends three read-only deploy keys. Say if you prefer `git archive` and `scp` (the fallback is written). What are the three GitHub repo addresses and the release branches or tags?
2. **What is the Postgres container's name** (it becomes the host in `DATABASE_URL`), and does `g4d_live` own `get4domain_v3` and may it create the `pgcrypto`, `uuid-ossp` and `pg_trgm` extensions? If not, who runs the two administrator steps (runbook 20 and 22)?
3. **Where do `mrtravels` and `s2travels` run today?** Their blocks proxy to `__MRTRAVELS_UPSTREAM__` and `__S2TRAVELS_UPSTREAM__`. If nginx already has rules for them, say so and the files are not installed.
4. **Do any of `app.`, `admin.`, `api.`, `partner.`, `directory.` already serve something from V2** in the host nginx? Installing the V3 blocks takes the name over (runbook step 31 stops and asks).
5. **Which certificate and key does nginx use for `*.get4domain.com`** (paths), and is Cloudflare set to Full (strict)?
6. **`FRONTEND_URL` and `V3_PUBLIC_SITE_ORIGIN`:** `https://get4domain.com` is assumed (e-mail links to the public site) even though the main site stays on V2 until switched. Confirm, or name another address.
7. **The five other V2 client names** (`allwintours`, `deebiphotography`, `indianambulance`, `ksmquantum`, `stepnrock`, `jscomputersmobiles`, `unicatherapy`): the wildcard file lists them as must-keep rules, but this lane writes explicit blocks only for the two the dispatch named. Do they already have their own server blocks? (`nginx -T | grep server_name` answers it.)
8. **`apps/site`** (the Vite marketing app with Supabase variables) has no Dockerfile and is not deployed here. Is it retired? The main site is the Next app.
9. **Non-root SPAs:** the apps repo images run nginx as root on port 80. This lane wraps them (non-root, port 8080) because that repo may not be edited here. Prefer that, or change the apps repo's Dockerfiles instead?
10. **Gateway checkout:** the apps' CSP blocks the Razorpay/Cashfree scripts until the apps repo adds their origins and a `checkout` object in the runtime config (stated in the apps' `DEPLOY_APPS.md`). Fine while `PLAN_PAYMENTS_LIVE_ENABLED=false`; it must be done before payments go live.
11. **The project doc `V3_ADMIN_DAY_ONE_SETUP`** is not in this repository; the runbook points to it by name. Where does it live?
12. **Backups:** the existing nightly job in `/opt/v3live/backups` is untouched; the runbook adds an on-demand backup with the repo's script in a separate folder. Do you want that on a nightly cron as well, or is the existing job enough?
13. **TRUSTED_PROXIES:** the runbook lists the LXD bridge subnet, the `v3net` subnet and the default Docker bridge subnet. After the first real traffic, confirm the rate limit sees the visitor's real address, not nginx's.
14. **Sizes:** the API body limit is 25 MB in nginx (and 1536 MB memory limit per API container); raise them together with the admin upload settings once those are set.
