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

1. **Uploads are lost on every recreate.** `backend-api/docker-compose.yml` has no volume for `uploads/`; the documented deploy command is `--force-recreate`. Vendor-uploaded images vanish. The runner stage also runs as non-root and may not be able to create `uploads/` — verify on the VM.
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
