# DEPLOY V3 LIVE: the build plan (E1a)

Target: one LXD container `v3live` on the Contabo server (Ubuntu 24.04, Docker 29, 2 CPU, 6 GiB). Postgres 17 already runs in Docker inside it (`/opt/v3live/postgres`, network `v3net`, database `get4domain_v3`, user `g4d_live`). The host nginx (outside the container) terminates TLS behind Cloudflare and proxies to the container's address.

**Nothing in this plan was run.** Every command is in `deploy/v3live/RUNBOOK.md`, one per block, with the window it runs in. This file explains the shape and the reasons.

## 1. The shape

```
Cloudflare ──TLS──> host nginx (Contabo host) ──http──> LXD container v3live  (address V3_BIND_IP)
                                                          │
                                  Docker network v3net ───┼── g4d-v3-api      :3008  (NestJS)
                                  (external, created by   ├── g4d-v3-site     :3006  (Next: main, directory, vendor sites)
                                   the Postgres project)  ├── g4d-v3-vendor   :8080  (static SPA, app.)
                                                          ├── g4d-v3-admin    :8080  (static SPA, admin.)
                                                          ├── g4d-v3-partner  :8080  (static SPA, partner.)
                                                          └── <postgres container>   :5432 (already there)
```

Why published ports on the container address (not Docker bridge addresses): the host nginx is outside the LXD container, and the Docker bridge range inside it is not routed from the host. The existing `docker-compose.v3live.yml` of the API relies on a bridge address and would not be reachable. Each service is published on `${V3_BIND_IP}:<port>` only, never `0.0.0.0` and never the host's public address; Postgres already follows the same pattern.

## 2. Getting the source onto the container: recommendation

**Clone each repo with its own read-only deploy key.** Three repos, three keys, each added on GitHub as a *deploy key without write access*.

| Repo | Path in the container | Used for |
|---|---|---|
| backend (`get4domain-w2`, branch `v3-pack` or the release branch) | `/opt/v3live/src/backend` | API image, ops image, `deploy/v3live` files, scripts, migrations |
| apps (`get4domain-ui`) | `/opt/v3live/src/apps` | vendor, admin, partner images |
| public site (`get4domain_mvp`) | `/opt/v3live/src/site` | Next image |

Why clone over copy: the commit id is the version (it goes into `GIT_COMMIT` and the image tag), `git pull` is the update, `git checkout <old tag>` is the rollback of the source, and no archive has to be kept in step. A deploy key can read one repo only and cannot push, so a stolen container cannot change code. The private keys live in `/opt/v3live/secrets/deploy_keys/` (mode 600, never in a repo, never printed).

Fallback if the owner does not want keys on the server: `git archive` on the PC, `scp` the three archives, unpack into the same three folders. The rest of the plan is identical. Without a `.git` folder the version tag is typed by hand (`IMAGE_TAG`).

Nothing is built from a dirty tree: the runbook checks `git status` is clean and prints the commit before every build.

## 3. Images, names and tags

One tag per release, `IMAGE_TAG`, which is `<yyyymmdd>-<short commit of the backend repo>` (for example `20261203-a1b2c3d`). Every service is tagged with the same value, so a release is one word. `latest` is never used.

| Service | Image | Built from | Build command shape |
|---|---|---|---|
| API | `get4domain-v3-api:${IMAGE_TAG}` | `deploy/v3live/api/Dockerfile` (target `runner`), context = backend repo root | `docker build -f deploy/v3live/api/Dockerfile --target runner -t ... .` |
| Ops (migrate, baseline, seed, bootstrap, backup) | `get4domain-v3-ops:${IMAGE_TAG}` | same Dockerfile, target `ops` | same, `--target ops` |
| Vendor SPA | `get4domain-v3-vendor:${IMAGE_TAG}` | apps repo `apps/vendor/Dockerfile`, then the non-root wrapper `deploy/v3live/spa/Dockerfile` | two builds: base, then wrapper |
| Admin SPA | `get4domain-v3-admin:${IMAGE_TAG}` | `apps/admin/Dockerfile` + wrapper | same |
| Partner SPA | `get4domain-v3-partner:${IMAGE_TAG}` | `apps/partner/Dockerfile` + wrapper | same |
| Public site | `get4domain-v3-site:${IMAGE_TAG}` | `deploy/v3live/site/Dockerfile`, context = public site repo | `docker build --build-arg ... ` |

Why not the repos' own Dockerfiles as they are:

- **API.** `Dockerfile.v3live` has `backend-api` as its context and cannot see `../themes`; `npm run build` fails at the renderer step. `deploy/v3live/api/Dockerfile` is the same file with the repo root as the context and a `COPY themes`. Same runtime stage (non-root uid 1001, tini, health check on `/health`).
- **Public site.** Its Dockerfile has no `ARG`, but Next inlines `NEXT_PUBLIC_*` at build time (API address for the older pages, site base domain, vendor app address, public Razorpay key, VAPID key). The wrapper adds the `ARG`s and nothing else; it also adds a health check.
- **SPAs.** The apps' images are right (no address baked in; `runtime-config.js` and the CSP are written when the container starts from `API_BASE_URL`), but nginx runs as root on port 80. The wrapper makes the nginx directories owned by the `nginx` user, moves the listen port to 8080 and the pid file to `/tmp`, and sets `USER nginx`. It adds no content.

**Build order** (nothing depends across the three repos): ops image first (it is needed for the database steps and is the first proof the API builds), then the API image, then the three SPAs, then the site. The database steps (baseline, seeds) happen **before** the API is started, so the API's first boot is against a complete schema.

## 4. Where the static SPAs are served

**Recommendation: three small nginx containers (the apps' own images), reached by the host nginx on `V3_BIND_IP:3101/3102/3103`.** Reasons: the Content-Security-Policy is generated from `API_BASE_URL` at container start (a folder served by the host nginx would need that logic re-made by hand and kept in step); a rollback is one tag; the cache and header rules are already tested in the apps repo; and the host nginx stays a pure proxy with the same shape for every host.

The alternative (host nginx serving a copied `dist` folder) is simpler to look at but loses the generated CSP and makes rollback a folder swap. Not recommended.

The host nginx adds nothing to the CSP (the container's header passes through); it only replaces `X-Robots-Tag` with one value, so there is never a duplicate.

## 5. Ports

| Service | Inside the container (Docker) | Published on the LXD container address | Host nginx proxies `host` to |
|---|---|---|---|
| API | 3008 | `${V3_BIND_IP}:3008` | `api.` |
| Public site | 3006 | `${V3_BIND_IP}:3006` | `directory.`, later `get4domain.com` and the wildcard |
| Vendor SPA | 8080 | `${V3_BIND_IP}:3101` | `app.` |
| Admin SPA | 8080 | `${V3_BIND_IP}:3102` | `admin.` |
| Partner SPA | 8080 | `${V3_BIND_IP}:3103` | `partner.` |
| Postgres | 5432 | already on the container address | nothing (not proxied) |

Services reach each other by name on `v3net`: the site calls `http://g4d-v3-api:3008`; the API calls `http://g4d-v3-site:3006` to refresh pages; both reach Postgres by its container name. **The API must use the Postgres container's name, never its IP**: the startup check refuses private addresses and any host name containing words such as `local`, `dev`, `test` or `demo`.

## 6. Environment files

Kept on the server in `/opt/v3live/env/` (outside every repo, mode 600, never committed). Templates with names only are in `deploy/v3live/env/`: `compose.env.example` (what compose substitutes: tag, bind address, ports, build arguments), `api.env.example`, `site.env.example`. Real values are made on the server; secrets are generated with `openssl rand`; the database password is read from the existing `/opt/v3live/secrets/pg_password` with `cat` into the file, never typed or shown.

## 7. Everything starts OFF

`V3_PUBLIC_ENABLED=false`, `PLAN_PAYMENTS_LIVE_ENABLED=false`, `EMAIL_LIVE_SEND=false` (and the other sending and money switches unset). `V3_PUBLIC_USE_MOCKS=false` is set explicitly, because the code's default is `true` (fixtures, no API calls). The wildcard `*.get4domain.com` keeps serving V2; only `api.`, `app.`, `admin.`, `partner.` and `directory.` get explicit V3 rules, and the V2 client names keep theirs.

## 8. Order of the whole job (the runbook numbers these)

1. Host and container checks, deploy keys, clone the three repos.
2. Build the ops image; build the API, SPA and site images.
3. Env files; `check-live-env`.
4. Database preparation (`extensions` schema, `search_path`), baseline (dump on the PC first), seeds.
5. Bring the apps up; first SUPER_ADMIN; health checks inside the container.
6. Host nginx: install the five blocks, `nginx -t`, reload; DNS and Cloudflare; health checks per host.
7. Day-one admin checklist (project doc `V3_ADMIN_DAY_ONE_SETUP`), backup and restore test, copy backups off the server.
8. Later and separately: public flag on; wildcard switch; main site switch.

## 9. Rollback in one paragraph

Code: set `IMAGE_TAG` in `/opt/v3live/env/compose.env` back to the previous tag and `up -d --no-build`; images are never deleted on release, so the old one is still there. Config: every env file is copied to `<name>.<date>` before it is changed. Data: migrations are additive, so the older image runs on a newer schema; a data restore always goes into a new database (`V3_LIVE_ENVIRONMENT.md` section 11). nginx: each file replaced is first copied to `.bak-<date>`, and `nginx -t` runs before every reload. Per-step rollbacks are in the runbook.
