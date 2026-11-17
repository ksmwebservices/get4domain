# DISPATCH STATUS E1 (deploy lane: V3 on the v3live container)

Branch `v3-pack` (from `v3-smoke2`). Nothing here was run against a server, a database or Docker. Nothing is pushed.

## Job table

| Job | State | Commit | One line |
|---|---|---|---|
| E0 Investigate | DONE | 23f01e3 | Six pieces mapped; four deploy gaps found (below). |
| E1a Build plan | DONE | c1464c5 | `docs/v3/DEPLOY_V3LIVE_PLAN.md` |
| E1b Compose and env | DONE | ac398ad | `deploy/v3live/docker-compose.apps.yml`, `env/*.example`, static test |
| E1c Host nginx files | DONE | 63d4003 | `deploy/v3live/nginx/*`, `WILDCARD_SWITCH_LATER.md`, static test |
| E1d Runbook | DONE | (this commit) | `deploy/v3live/RUNBOOK.md` |
| E1e Final checks and report | TODO | | build, test:ci, `DISPATCH_REPORT_E1.md` |

## E0: what exists to build and run each piece

Paths: backend = `C:\Get4Domain\get4domain-w2` (API in `backend-api\`), apps = `C:\Get4Domain\get4domain-ui`, public site = `C:\Get4Domain\get4domain-pub\get4domain_mvp`. Read only for the second and third.

| Piece | Build file that exists | Port inside | How it learns the API | Build time needs | Run time needs | Gap |
|---|---|---|---|---|---|---|
| API (NestJS) | `backend-api/Dockerfile.v3live` (+ `.dockerignore`), `docker-compose.v3live.yml`, `.env.live.example` | 3008 (`PORT`, `HOST=0.0.0.0`) | n/a. It learns its own hostnames from `V3_DOMAIN`, `FRONTEND_URL`, `PUBLIC_APP_URL`, `PUBLIC_API_URL`, `SITE_BASE_DOMAIN`, `DIRECTORY_PUBLIC_BASE_URL`; CORS from `CORS_MODE` and `CORS_EXTRA_ORIGINS`; its proxies from `TRUSTED_PROXIES`. | Nothing secret. | Every name in `REQUIRED_LIVE_ENV` (startup-check refuses to boot otherwise). | **G1** build fails (themes). **G2** private DB address refused. **G3** no `psql`, `pg_dump` or Prisma CLI in the runtime image. **G4** baseline needs a Supabase `extensions` schema. |
| Vendor SPA (Vite) | `apps/vendor/Dockerfile` (node build, then `nginx:1.27-alpine`) | 80 | Runtime file `/runtime-config.js`, written at container start from `API_BASE_URL` (`deploy/docker-entrypoint.sh`); `STORAGE_BASE_URL` optional. | Nothing. No address is baked in. Context = apps repo root (workspaces share `packages/`). | `API_BASE_URL` (the container refuses to start without it). | **G5** nginx master runs as root, port 80. |
| Admin SPA (Vite) | `apps/admin/Dockerfile` | 80 | same | same | same | same as G5 |
| Partner SPA (Vite) | `apps/partner/Dockerfile` | 80 | same | same | same | same as G5 |
| Apps "site" SPA | **none** (`apps/site` has no Dockerfile; Vite marketing page that reads `VITE_SUPABASE_*`) | n/a | n/a | n/a | n/a | Not part of V3 live. The main site `get4domain.com` is the Next app. Listed as a question. |
| Next public site | `get4domain_mvp/Dockerfile` (standalone output, user `nextjs`, port 3006, `HOSTNAME=0.0.0.0`) and `docker-compose.yml` (published on all addresses, no health check) | 3006 | Server side: `API_BASE_URL`, else `NEXT_PUBLIC_API_BASE_URL` (read at call time). Older pages and the revalidate route: `INTERNAL_API_URL`, else `NEXT_PUBLIC_API_URL`, else a hard-coded V2 fallback host. | `NEXT_PUBLIC_*` values are **inlined at build time** but the Dockerfile has no `ARG`, so they cannot be set. | `MAIN_HOST`, `DIRECTORY_HOST`, `APP_HOST`, `ADMIN_HOST`, `API_HOST`, `MEDIA_HOST`, `V3_PUBLIC_ENABLED`, `V3_PUBLIC_USE_MOCKS`, `V3_PUBLIC_SITE_ORIGIN`, `REVALIDATE_SECRET`, the six `V3_PUBLIC_*` firm-contact names. | **G6** mocks default ON. **G7** build args. **G8** the pub repo has no `docs/v3` files here (`PUBLIC_SITE.md`, `GO_LIVE_PUBLIC.md` not found), so flag meanings come from the source. |
| Vendor-site relay | Inside the Next app: `src/middleware.ts` rewrites `<label>.<NEXT_PUBLIC_SITE_BASE_DOMAIN>` to `/site/<label>`; V3 host routing in `lib/v3-public/host-routing.ts` | 3006 | Same API variables as above. | `NEXT_PUBLIC_SITE_BASE_DOMAIN` (defaults to `get4domain.com`) | same | The relay only sees hosts the host nginx sends to port 3006; the V2 wildcard keeps working until nginx is switched. The site's own reserved list lacks `partner` (the API's list has it); harmless because `partner.` has its own nginx block. |

How the API reaches the public site: `FRONTEND_INTERNAL_URL` (for example `http://<site container name>:3006`) plus `REVALIDATE_SECRET`, the same value on both sides.

### The four deploy gaps (and what this lane does about each)

- **G1 (blocker): the API image cannot be built from `backend-api/`.** `npm run build` runs `scripts/build-renderer.js`, which reads `../themes`. `Dockerfile.v3live` uses `backend-api` as the build context, so the renderer step fails. `Dockerfile.with-themes` documents this and is unused. Fix (additive, no application code touched): `deploy/v3live/api/Dockerfile`, build context = the repository root, with its own allow-list `.dockerignore`. A test pins it.
- **G2 (blocker): a private database address is refused.** `databaseUrlProblem` rejects `10.*`, `172.16-31.*`, `192.168.*` and host names containing `local`, `dev`, `test`, `demo`, `stage` and similar. The Postgres container must therefore be reached by its **Docker DNS name** on `v3net` (not its IP). The runbook says so and `check-live-env.js` is run before the first start.
- **G3 (blocker for the scripts): the runtime image has no `psql`, no `pg_dump` and no Prisma CLI** (Prisma is a dev dependency). Baseline, migrate, seed, bootstrap and backup need them. Fix: an `ops` target in the same Dockerfile (builder stage plus `postgresql17-client`), run as a throw-away container on `v3net`.
- **G4 (blocker for the baseline): `baseline-live.js` insists on a schema named `extensions`** (a Supabase thing). Plain Postgres 17 has none, so step B stops at "The schema extensions does not exist". Fix without code: one `CREATE SCHEMA extensions` in the runbook, and the database's `search_path` set to `"$user", public, extensions` so `pg_trgm` and `uuid-ossp` functions resolve without a schema prefix (Supabase does this itself).

Other facts:
- The existing apps compose publishes on `0.0.0.0` and the API compose publishes nothing (it relies on a Docker bridge address). Neither works for a host nginx that sits **outside** the LXD container: the Docker bridge address is not routed from the Contabo host. The new compose publishes each port on the LXD container's own address (`V3_BIND_IP`), the same pattern as Postgres.
- `V3_LIVE_ENVIRONMENT.md` was written for a Supabase database and a host-run build. This lane's runbook replaces its sections 2, 6a, 8 for the v3live container and leaves the rest valid.

## ASSUMPTIONS

1. The route-classification baseline diff (line endings only) is expected and is never committed (owner's answer). Commits are path-only.
2. New files live at the repository root: `deploy/v3live/` and `docs/v3/` (owner's answer).
3. Source gets onto the container by **git clone of each repo with a read-only deploy key** (recommended in the plan). The runbook includes a `scp` of an archive as the fallback.
4. Static SPAs are served by **their own nginx containers** (images already carry the CSP and headers; rollback is a tag), reached by the host nginx on the container address. A wrapper Dockerfile makes them run as non-root on port 8080, because the apps repo images run nginx as root and I may not edit that repo.
5. The Postgres Docker network is named `v3net` and is external to this compose project. The Postgres container name is unknown, so it is a placeholder (`PG_CONTAINER_NAME`).
6. Port plan on the container address: API 3008, Next site 3006, vendor 3101, admin 3102, partner 3103.
7. `main` (get4domain.com) is not switched by this lane. It stays on V2 until the owner says so; the plan lists the one extra nginx block needed.
8. The owner's nightly encrypted backups at `/opt/v3live/backups` stay as they are. The ops image adds an on-demand backup to a different folder, so the two never collide.
9. `V3_PUBLIC_USE_MOCKS=false` is set explicitly, because the code default is true (fixtures instead of the API).

## QUESTIONS FOR THE OWNER

(Filled in at the end; see `DISPATCH_REPORT_E1.md`.)
