# P005 — Testing
# Get4Domain Engineering Standard v1.0
# Phase: P005 | Owner: Claude Code | Runs after P004 (Integration) complete

---

## YOUR ROLE IN THIS PHASE

Verify the integrated application actually works — build, lint, unit
tests, and API tests — before the project moves to deployment.

---

## READ FIRST

1. Read `CLAUDE.md` in the GET4DOMAIN repo
2. Read the P003 deliverables (modules, endpoints) and P004 deliverables
   (integration points)
3. Read this file completely — then execute

---

## TASK 1 — BUILD VERIFICATION

```bash
cd backend && npm run build
cd frontend && npm run build
```

Both must complete with 0 errors. Warnings are acceptable but should be
reviewed — do not silence them with blanket eslint-disable comments.

---

## TASK 2 — LINT VERIFICATION

```bash
cd backend && npm run lint
cd frontend && npm run lint
```

Both must complete with 0 errors.

---

## TASK 3 — BACKEND UNIT TESTS

For every service in `backend/src/modules/*/`, add unit tests under
`testing/unit/` (or co-located `*.spec.ts` per NestJS convention) covering:

- Happy path for each public method
- Not-found case (`NotFoundException`)
- Duplicate/conflict case where applicable (`ConflictException`)
- Soft-delete filtering (deleted records excluded from `findAll`)
- Role/permission checks where logic lives in the service layer

Mock `DatabaseService` — do not hit a real database in unit tests.

```bash
cd backend && npm run test
```

---

## TASK 4 — API (INTEGRATION) TESTS

Under `testing/integration/`, cover the real HTTP surface against a test
database:

- Auth flow: login → access protected route → refresh → logout
- CRUD flow per business module, including validation failures (400) and
  auth failures (401/403)
- Response shape matches the standard `ResponseInterceptor` envelope on
  both success and error paths

---

## TASK 5 — E2E TESTS (IF IN SCOPE)

Under `testing/e2e/`, cover the critical user journeys end-to-end
(login → core module flow → logout) against a running dev instance, if the
client engagement scope includes E2E coverage.

---

## TASK 6 — REPORT

Record pass/fail counts per suite, not just "tests pass" — the deliverables
report must include actual numbers.

---

## DELIVERABLES

```
P005 — TESTING COMPLETE
=========================

1. BUILD: backend ✅/❌ | frontend ✅/❌
2. LINT: backend ✅/❌ [errors] | frontend ✅/❌ [errors]
3. UNIT TESTS: [passed]/[total], coverage: [module list]
4. INTEGRATION TESTS: [passed]/[total]
5. E2E TESTS: [passed]/[total] or "not in scope"
6. KNOWN ISSUES: [list, or "none"]
7. READY FOR: P006 (Deployment)
```

---

## STRICT RULES

- ✅ Every business module has at least one unit test file
- ✅ Every auth-protected endpoint has at least one integration test for
      the unauthorized case
- ❌ Do NOT mark this phase complete with failing tests
- ❌ Do NOT skip tests with `.skip`/`xit` to force a green run without
      fixing the underlying issue
