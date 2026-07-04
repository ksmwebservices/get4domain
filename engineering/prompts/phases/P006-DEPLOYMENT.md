# P006 — Deployment
# Get4Domain Engineering Standard v1.0
# Phase: P006 | Owner: Claude Code | Runs after P005 (Testing) passes

---

## YOUR ROLE IN THIS PHASE

Deploy the client application to its target environment (dev, staging, or
production) using Docker, Nginx, and the Ubuntu production host.

---

## READ FIRST

1. Read `CLAUDE.md` in the GET4DOMAIN repo
2. Read `engineering/checklists/PRE-LAUNCH.md` — run through it before
   deploying to production specifically
3. Read the P005 deliverables — testing must have passed
4. Read this file completely — then execute

---

## TASK 1 — ENVIRONMENT CONFIGURATION

- Confirm the target environment (`dev`/`staging`/`prod`) and its URL per
  the pattern `{client}[-env].get4domain.com`
- Create the real `.env` for that environment from `.env.example`
  (never committed — placed directly on the server or in a secrets
  manager)
- Confirm database name/credentials are unique per environment

---

## TASK 2 — DOCKER BUILD

```bash
docker compose -f docker-compose.yml build
```

- `backend` and `frontend` images build using their `production` Docker
  stage (see P001 Task 6)
- Confirm image sizes are reasonable (no dev dependencies leaking into the
  production stage)

---

## TASK 3 — DATABASE MIGRATION

```bash
docker compose run --rm backend npx prisma migrate deploy
```

- Use `migrate deploy` (not `migrate dev`) in every non-dev environment
- Confirm the migration history matches what's committed in
  `backend/prisma/migrations/`
- Take a backup before migrating an environment that already has data
  (see `BACKUPS\` workspace convention)

---

## TASK 4 — NGINX REVERSE PROXY

Configure `deployment/nginx/{client}.conf`:

- Reverse proxy `/` to the frontend container, `/api/` to the backend
  container
- SSL termination (Let's Encrypt via certbot, or provided certs)
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- Gzip/compression at the proxy layer if not already handled by the app

---

## TASK 5 — START SERVICES

```bash
docker compose up -d
docker compose ps
```

Confirm all services report healthy, especially the `postgres` health
check.

---

## TASK 6 — SMOKE TEST

- Hit the health check endpoint through Nginx, not just directly against
  the container
- Log in as a seeded/admin user and exercise one full CRUD flow through
  the real domain
- Confirm Swagger is disabled (or access-restricted) in production

---

## TASK 7 — DNS (PRODUCTION ONLY)

- Point the `{client}.get4domain.com` DNS record at the production host
- Confirm SSL certificate covers the exact domain being served

---

## DELIVERABLES

```
P006 — DEPLOYMENT COMPLETE
============================

1. ENVIRONMENT: dev / staging / prod
2. URL: {client}[-env].get4domain.com
3. DOCKER: images built ✅/❌, services healthy ✅/❌
4. MIGRATION: applied ✅/❌, backup taken ✅/❌ (non-dev only)
5. NGINX: SSL ✅/❌, security headers ✅/❌
6. SMOKE TEST: ✅/❌ [what was exercised]
7. PRE-LAUNCH CHECKLIST: complete ✅/❌ (production only)
8. READY FOR: handover to client / next environment promotion
```

---

## STRICT RULES

- ✅ Run `engineering/checklists/PRE-LAUNCH.md` in full before any
      production deployment
- ✅ Take a database backup before migrating an environment with existing
      data
- ✅ Use `prisma migrate deploy`, never `migrate dev`, outside of local
      development
- ❌ Do NOT deploy to production before final payment is confirmed
      (see `docs/business/PAYMENT_POLICY.md`)
- ❌ Do NOT expose Swagger docs publicly in production
- ❌ Do NOT commit the real `.env` file anywhere
