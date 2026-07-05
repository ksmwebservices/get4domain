# P005 — Testing + Build Verification
# Get4Domain Engineering Standard v1.0
# Phase: P005 | Owner: Claude Code | Runs after P004 complete

---

## YOUR ROLE IN THIS PHASE

Verify the complete application is production-ready.
Fix all errors. Write critical unit tests. Verify Docker build.

---

## TASK 1 — BACKEND BUILD + LINT

```bash
cd backend
npm run build       # must be 0 errors
npm run lint        # must be 0 errors
npm run test        # must pass
```

Fix every error before proceeding. Warnings are acceptable.

---

## TASK 2 — FRONTEND BUILD + LINT

```bash
cd frontend
npm run build       # must be 0 errors
npm run lint        # must be 0 errors
```

Fix every error before proceeding.

---

## TASK 3 — API ENDPOINT TESTING

Test every endpoint manually or with a test script:

For each module verify:
- [ ] GET /api/v1/{module} → returns paginated list
- [ ] POST /api/v1/{module} → creates record, returns created object
- [ ] GET /api/v1/{module}/:id → returns single record
- [ ] PATCH /api/v1/{module}/:id → updates record
- [ ] DELETE /api/v1/{module}/:id → soft deletes (deletedAt set)
- [ ] Auth required (401 without token)
- [ ] Role required (403 with wrong role)

---

## TASK 4 — UNIT TESTS (CRITICAL SERVICES)

Write unit tests for:
- AuthService (login, refresh, logout)
- Any service with complex business logic
- GST calculation (if applicable)
- Invoice generation logic

Test file pattern:
```
backend/src/modules/auth/auth.service.spec.ts
backend/src/modules/invoices/invoices.service.spec.ts
```

Run:
```bash
npm run test
npm run test:cov    # check coverage
```

---

## TASK 5 — DOCKER BUILD VERIFICATION

```bash
# Build both images
docker build -t mr-travels-backend ./backend
docker build -t mr-travels-frontend ./frontend

# Test full stack with docker compose
docker compose up --build -d
docker compose ps      # all services healthy?
docker compose logs backend --tail=50
```

Verify:
- [ ] Backend starts without errors
- [ ] Frontend builds and serves
- [ ] Database connects
- [ ] Health check: http://localhost:3001/api/v1/health → 200 OK

---

## TASK 6 — SECURITY CHECKLIST

- [ ] No .env files committed
- [ ] No secrets in code
- [ ] All endpoints require auth (except /auth/login, /auth/refresh, public pages)
- [ ] Input validation on all POST/PATCH endpoints
- [ ] File upload size limits configured
- [ ] Rate limiting active

---

## DELIVERABLES

```
P005 — TESTING COMPLETE
========================
1. Backend build: ✅/❌
2. Backend lint: ✅/❌ [X errors, Y warnings]
3. Frontend build: ✅/❌
4. Frontend lint: ✅/❌
5. API tests: [X/Y endpoints passing]
6. Unit tests: [X passing, Y failing]
7. Docker build: ✅/❌
8. Security checklist: [X/Y items checked]
9. Ready for: P006 (Deployment) — pending client approval + full payment
```

