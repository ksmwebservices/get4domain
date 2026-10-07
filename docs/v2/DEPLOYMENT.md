# DEPLOYMENT — Get4Domain (current state + V2 requirements)

> Describes what exists today (from the platform audit and `docs/VM_DEPLOY_RUNBOOK.md`) and what V2 needs. **Nothing here was executed by this audit.** Environment variable *names* only — never values. See also [MIGRATION_PLAN.md](MIGRATION_PLAN.md), [INTEGRATIONS.md](INTEGRATIONS.md) (full env inventory, section D).

## 1. Current deployment model

| Item | Reality |
|---|---|
| Host | One VM (`ksmwebtechservices@…`), Docker Compose **per app**, nginx in front; deploy = manual SSH `git pull; docker compose build --no-cache; docker compose up -d --force-recreate` (`docs/VM_DEPLOY_RUNBOOK.md:66-67`); rollback documented at `:179` |
| Apps / ports | `backend-api` 3008 · `get4domain_mvp` 3006 · `ksm-quantum` 3014 · `stepnrock` 3015 · `deebiphotography` 3016 · `allwin-tours` 3010 |
| Images | multi-stage, non-root, **Node 20-alpine (past EOL)**, **no HEALTHCHECK**, no resource limits |
| nginx | configs in repo for web apps only; **no API (gapi.get4domain.com → 3008) config in the repo**; `:80` only (TLS assumed terminated elsewhere); only `X-Frame-Options` / `X-Content-Type-Options`; wildcard `*.get4domain.com` block exists but nothing rewrites host → `/site/<sub>` (middleware matches `/demo/*` only) |
| Database | Supabase Postgres, pooled `DATABASE_URL` + direct `DIRECT_URL`; **dev and prod share it** |
| CI/CD | none (`.github/` absent) |
| Monitoring / health / backups | none in repo (no `/health`, no Sentry, no backup policy) |
| Process manager | Docker `restart: unless-stopped` only |

## 2. Deployment hazards (act before the next deploy)

1. **Uploads were lost on every recreate — fixed in code, one-time migration pending (KSM).** `backend-api/docker-compose.yml` now mounts named volumes on `/app/uploads` (public images + reels) and `/app/private-uploads` (payment proofs), and the Dockerfile creates both owned by the non-root app user. Until the first deploy of that code, today's uploads still live only in the running container: follow **§3b.1 (back up) → §3b.3 (restore)**. Audited: no other app in the monorepo writes files at runtime.
2. **`PLATFORM_SETTINGS_KEY` must be set** or saving any integration secret/vendor payment key throws; it is absent from the local `.env.local` — confirm on the VM. Losing the key makes all stored secrets undecryptable (silent env fallback).
3. **`OTP_DEV_ECHO` must be unset in production** (it returns OTP codes in API responses). Customer-portal OTP is also returned as `devOtp` whenever `NODE_ENV !== 'production'` — ensure the container sets `NODE_ENV=production`.
4. **`JWT_SECRET` has no boot check** and is read at module-import time; customer tokens fall back to the literal `'dev-secret'` if unset. Demo gate falls back to a hard-coded secret if `DEMO_ACCESS_SECRET` is unset.
5. **Razorpay and Resend keys are read only from `process.env`.** Entering them in Admin → Integrations has no effect.
6. Swagger UI (`/api/docs`) is open in production; CORS reflects any origin.
7. Node 20 is EOL as of Oct 2026 — plan base-image upgrade (Node 22/24 LTS).
8. Standalone sites run old Next (13.5.1 / 14.2.35) — upgrade path needed.

## 3. Pending deploy actions for the already-merged work
1. **Apply** `backend-api/prisma/migrations/20261002120000_domain_campaign_custom_fee` (adds `isCustomFee`): `cd backend-api && npx prisma migrate deploy` — **before** deploying the DomainCampaign fee code (`f7ad328`).
2. Rebuild/redeploy `backend-api` and `get4domain_mvp`.
3. Create the Razorpay Plans: "DomainApp Workspace — Annual" (₹11,988 + GST) and "DomainApp BOS — Annual" (₹23,988 + GST).
4. Smoke test (read-only first): `/pricing` returns `workspaceYearly`/`bosYearly`; `/domain-campaign` shows the three brackets; admin → Managed Services → DomainCampaign tab loads; record a test spend for a test vendor, verify the fee preview and the invoice description, then remove the test record.

## 3b. Commercial Engine v1 + follow-up A + stepnrock go-live — run on the VM, in exactly this order

Applies to commits `69a8c44` (Commercial Engine v1) and the follow-up A commit (public-uploads volume, MARKETING lock-out, plan-change price). Nothing here has been run on the VM by Claude — KSM runs every command.

**Prerequisites** (once): `backend-api/.env.local` already holds `DATABASE_URL`, `DIRECT_URL`, `RAZORPAY_KEY_ID/SECRET`, `FRONTEND_URL`. Nothing new is required.

**What changed for containers.** Only `backend-api` (container `get4domain_backend`) writes public files, to `/app/uploads` (vendor image uploads, rendered reels). It now has two named volumes: `get4domain_public_uploads` → `/app/uploads` and `get4domain_private_uploads` → `/app/private-uploads` (payment proofs). The sibling apps — `get4domain_frontend` (get4domain_mvp), `stepnrock`, `ksm_quantum`, `allwin_tours`, `deebiphotography` — write nothing at runtime (their `public/` is baked into the image from git), so they need no volume. `docker compose down -v` deletes volumes: **never use `-v`** on these stacks.

### 3b.1 BEFORE the deploy — back up the uploads (one time)

The first deploy replaces the container, and everything in its writable layer — including today's `/app/uploads` — is discarded with it. Copy it out first.

```bash
# A. Where to put the backup, and a count of what is inside the running container.
export BK="$HOME/backups/uploads-$(date +%Y%m%d-%H%M)"
mkdir -p "$BK/backend-uploads"
echo "files in the container now:"
docker exec get4domain_backend sh -c 'find /app/uploads -type f 2>/dev/null | wc -l'

# B. Copy them to the host (the trailing /. copies the contents).
docker cp get4domain_backend:/app/uploads/. "$BK/backend-uploads/"

# C. Count what landed on the host and write a checksum manifest to compare against later.
echo "files in the backup:"
find "$BK/backend-uploads" -type f | wc -l
( cd "$BK/backend-uploads" && find . -type f | sort | xargs -r sha256sum ) > "$BK/backend-uploads.sha256"
wc -l "$BK/backend-uploads.sha256"
echo "$BK"        # note this path — you need it in 3b.3
```
**The two counts must be equal.** If they differ, stop and do not deploy. (`docker cp` failing with "no such file" means the container has never stored an upload — the counts are 0 and 3b.3 has nothing to restore.)

Optional proof that the other apps hold no uploads (expect `0` for each):
```bash
for c in get4domain_frontend stepnrock ksm_quantum allwin_tours deebiphotography; do
  printf '%s: ' "$c"; docker exec "$c" sh -c 'ls -d /app/uploads /app/public/uploads 2>/dev/null | wc -l'
done
```

### 3b.2 Deploy (in this order)

```bash
# 1. Get the code
cd /srv/get4domain-site && git pull origin get4domain-site

# 2. Apply the migrations. ORDER MATTERS: schema first, then the new backend. Additive only.
#    Applies 20261002120000, 20261002130000 (if not yet applied), 20261007120000_commercial_engine, 20261007130000_plan_change_price.
cd backend-api
#    2a. The failed first attempt left an UNFINISHED row for 20261007120000_commercial_engine in _prisma_migrations
#        (verified read-only on 2026-10-07: no object from that migration exists, 0 steps ran). Prisma refuses every
#        new migration (P3009) until it is marked rolled back. Run this ONCE, before deploy:
npx prisma migrate resolve --rolled-back 20261007120000_commercial_engine
#    2b. Apply. The fixed file is applied from scratch.
npx prisma migrate deploy

# 3. Rebuild + restart the API. Creates the two named volumes on first run (empty, owned by the app user).
docker compose build --no-cache && docker compose up -d --force-recreate
docker compose logs --tail=50 backend      # look for "Nest application successfully started"

# 4. Rebuild + restart the web app (new /pay/[token], Admin → Commerce, vendor Billing)
cd ../get4domain_mvp
docker compose build --no-cache && docker compose up -d --force-recreate

# 5. Rebuild + restart the stepnrock SITE (its contact form now posts to the CRM)
cd ../stepnrock
docker compose build --no-cache && docker compose up -d --force-recreate
```

> **Migration SQL hygiene.** `20261007120000_commercial_engine/migration.sql` originally ended with a pasted Prisma "Update available" box, which Postgres rejected (P3018). It is removed; `npm run verify:migrations` now guards every migration file. When you generate SQL: `export PRISMA_HIDE_UPDATE_MESSAGE=true`, redirect straight into the file (stdout only) and run `npm run verify:migrations` before committing — see [MIGRATION_PLAN.md](MIGRATION_PLAN.md) Step 4.
> Rehearsed on real Postgres (PGlite, PG 18) on top of the pre-commercial schema DDL: both migrations apply cleanly, and the original file reproduces the exact syntax error. Not rehearsed on Supabase PG 15 itself; the SQL uses nothing newer than PG 12.

### 3b.3 AFTER the first deploy — restore the uploads into the new volume (one time)

Images served from `/uploads/*` return 404 between step 3 and this restore, so run it straight away.

```bash
export BK="$HOME/backups/uploads-YYYYMMDD-HHMM"      # ← the path 3b.1 printed

# A. Copy the backup into the volume (through the running container), then fix ownership.
docker cp "$BK/backend-uploads/." get4domain_backend:/app/uploads/
docker exec -u root get4domain_backend chown -R nestjs:nodejs /app/uploads

# B. Compare: file counts, then checksums (no output from diff = identical).
echo "backup:    $(find "$BK/backend-uploads" -type f | wc -l)"
echo "container: $(docker exec get4domain_backend sh -c 'find /app/uploads -type f | wc -l')"
docker exec get4domain_backend sh -c 'cd /app/uploads && find . -type f | sort | xargs -r sha256sum' | diff - "$BK/backend-uploads.sha256" && echo "CHECKSUMS MATCH"
```
(If 3b.1 found 0 files, skip A and B.)

**C. A sample public image URL must return 200** (use any file from the backup):
```bash
F=$(cd "$BK/backend-uploads" && find . -type f | head -1 | sed 's|^\./||'); echo "$F"
curl -s -o /dev/null -w 'via nginx/API host: %{http_code}\n' "https://gapi.get4domain.com/uploads/$F"      # expect 200
curl -s -o /dev/null -w 'direct to container: %{http_code}\n' "http://127.0.0.1:3008/uploads/$F"          # expect 200
```
**D. Prove the volume survives a recreate** (and that the app user can write to it):
```bash
docker exec get4domain_backend sh -c 'echo persisted > /app/uploads/.persist-check'
cd /srv/get4domain-site/backend-api && docker compose up -d --force-recreate
docker exec get4domain_backend cat /app/uploads/.persist-check        # expect: persisted
docker exec get4domain_backend rm /app/uploads/.persist-check
```
Keep `$BK` for at least a week, then delete it.

**Future deploys need no extra steps.** `docker compose build --no-cache && docker compose up -d --force-recreate` keeps both volumes; the backup/restore above is a one-time migration for the move from the container's writable layer to the volume.

### 3b.4 Before you share any pay link

Admin → Commerce → **Payee & QR** → enter the UPI ID + payee name (and bank details), Save, and check the QR preview.

### 3b.5 Stepnrock activation (dry run first, then apply)
```bash
cd /srv/get4domain-site/backend-api
npx nest build                                      # the script runs the compiled services in dist/

# a) DRY RUN — reads only, writes nothing. Check the plan says TOTAL ₹5,994.00 and "schema APPLIED".
node scripts/activate-stepnrock.js

# b) APPLY — creates the deal + activation invoice, activates now with 7 days to pay,
#    grants the one-time ₹499 AI Studio credit and the 2-theme-change allowance, prints the pay link ONCE.
STEPNROCK_ACTIVATE_CONFIRM=I_HAVE_APPLIED_THE_COMMERCIAL_ENGINE_MIGRATION node scripts/activate-stepnrock.js --apply
#    different payment window:    ... --apply --due-days=14
#    lost the link?               ... --apply --reissue-link     (the old link stops working)
```
The script refuses to run twice (it will not create a second activation invoice or term) and sends **no** messages — you share the printed link yourself.

### 3b.6 Smoke test after deploy
1. **Login** — admin and a vendor log in; no console errors.
2. **Existing vendor dashboard** — open an existing vendor's dashboard (not stepnrock): pages load, previously uploaded images still show.
3. **Vendor billing page** — stepnrock vendor → Billing shows "Payment due by …" and the invoice with **Pay**. An older vendor without a term still sees the previous Billing page.
4. **Admin Commerce** — loads; **Payee & QR** preview shows a QR; Plan changes → Approve… shows the editable price field.
5. **Public pay link** — open stepnrock's pay link on a phone: amount ₹5,994, UPI QR visible, "I have paid" form works; `https://get4domain.com/pay/not-a-real-token` → "This payment link is not valid".
6. Submit a test UTR → it appears under **Payments to confirm** with a badge.
7. A MARKETING staff login shows **no Commerce** in the menu, and `/admin/commerce` shows "Your staff role does not include billing and payments".
8. `cd backend-api && npm run verify:commercial` (needs `npx nest build`) — expect 116 + 221 + 14 passed.

### Rollback
Code: redeploy the previous image. Database: both migrations are additive; the new tables/columns can stay unused. Do **not** delete `get4domain_private_uploads` (payment evidence) or `get4domain_public_uploads` (vendor images).

## 4. Environment variables
Authoritative names-only inventory: [INTEGRATIONS.md §D](INTEGRATIONS.md). Required for money flows: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `PLATFORM_SETTINGS_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`. Provider keys via Admin → Integrations (DB-encrypted, env fallback): AI (`CLAUDE_API_KEY`, `OPENAI_API_KEY`), storage (`SUPABASE_*`), Fast2SMS (`FAST2SMS_*`), Meta, Google Ads, video, ResellerClub, pricing rate card (`PRICE_*`).
**V2 will add** (names provisional): social-OAuth client ids/secrets (Meta, Google, LinkedIn, YouTube), WhatsApp Cloud API/BSP credentials per vendor (stored encrypted, not env), test-DB URL for CI, Sentry DSN, backup/storage bucket settings, rate-limit/redis URL, webhook secrets for every provider.

## 5. V2 deployment requirements
- **CI/CD:** build + lint + test on every PR; migration rehearsal job against a throw-away DB; deploy via pipeline (image tags, health-gated rollout, rollback).
- **Staging** environment with its own database (see MIGRATION_PLAN Step 0).
- **Health/observability:** `/health` (liveness) and `/ready` (DB/provider checks), Docker `HEALTHCHECK`, Sentry, structured logs with request id and PII redaction, uptime alerts.
- **Backups:** DB PITR + tested restore; object storage for uploads with versioning.
- **Edge:** TLS everywhere (wildcard + per-custom-domain via ACME), HSTS/CSP, host-based routing for vendor sites, API vhost config in the repo.
- **Secrets:** per-environment secret store; boot-time env validation (fail fast).
- **Zero-downtime migrations:** expand → deploy → contract.

## 6. Production-readiness checklist (PRD §63AF #30)
All items currently **NOT MET** — see [CHECKLIST.md](CHECKLIST.md) §B/§G and [AUDIT_REPORT.md](AUDIT_REPORT.md) critical findings.
