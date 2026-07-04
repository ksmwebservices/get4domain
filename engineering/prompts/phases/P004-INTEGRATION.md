# P004 — Integration
# Get4Domain Engineering Standard v1.0
# Phase: P004 | Owner: Claude Code | Runs after P002 (Bolt) + P003 (Backend) complete

---

## YOUR ROLE IN THIS PHASE

Connect the Bolt-built frontend UI to the Claude Code-built backend APIs.
No new UI screens, no new backend modules — this phase wires the two
together.

---

## READ FIRST

1. Read `CLAUDE.md` in the GET4DOMAIN repo
2. Read the P002 deliverables report (screens Bolt built)
3. Read the P003 deliverables report (endpoints available, Swagger docs)
4. Read this file completely — then execute

---

## TASK 1 — API CLIENT SETUP

In `frontend/src/lib/axios.ts`:

- Base URL from `NEXT_PUBLIC_API_URL`
- Request interceptor: attach access token from auth store
- Response interceptor: on 401, attempt refresh via `/auth/refresh` once,
  then retry the original request; on repeated failure, log the user out
- Unwrap the standard `{ success, statusCode, message, data, timestamp }`
  response shape so callers just get `data`

---

## TASK 2 — AUTH INTEGRATION

- Wire the login screen to `POST /auth/login`
- Store access token in memory (Zustand store), refresh token in an
  httpOnly cookie set by the backend (not accessible to JS)
- Wire `GET /auth/me` to populate the current user on app load
- Wire logout to `POST /auth/logout` and clear client state
- Protect admin routes with a client-side auth guard that redirects to
  login when there is no valid session, backed by the server-side JWT
  guard as the real enforcement point

---

## TASK 3 — PER-MODULE SERVICE LAYER

For every module from `MODULE_LIST.md`, create
`frontend/src/services/api/{module}.ts` exposing typed functions
(`list`, `getById`, `create`, `update`, `remove`) that call the
corresponding backend endpoints, typed against the DTOs from P003.

Replace Bolt's placeholder data in each screen with:
- `@tanstack/react-query` hooks (`useQuery`/`useMutation`) calling the
  service layer
- Loading, empty, and error states for every list/detail screen
- Form submission wired to `react-hook-form` + `zod`, validating against
  the same rules as the backend DTO

---

## TASK 4 — ROLE-BASED UI

- Hide/disable actions in the UI based on the current user's role,
  mirroring (not replacing) the backend's `@Roles()` enforcement
- Never rely on UI-side hiding as the actual security boundary — the
  backend guard is authoritative

---

## TASK 5 — ERROR HANDLING

- Map backend error responses (via `AllExceptionsFilter`) to user-facing
  toast/inline messages
- 401 → redirect to login (after failed refresh)
- 403 → "not authorized" message, no stack traces or internal details
  shown to the user
- 404 → "not found" state on detail screens
- 5xx → generic failure message, logged client-side for diagnostics

---

## TASK 6 — BUILD AND VERIFY

```bash
cd frontend && npm run build && npm run lint
cd backend && npm run build && npm run lint
```

Manually exercise: login, at least one full CRUD flow per module, logout,
and token refresh (wait past access-token expiry or simulate) before
marking complete.

---

## DELIVERABLES

```
P004 — INTEGRATION COMPLETE
=============================

1. AUTH FLOW: login/refresh/logout/me ✅/❌
2. MODULES WIRED: [list each module ✅/❌]
3. ERROR HANDLING: 401/403/404/5xx ✅/❌
4. BUILD: frontend ✅/❌ | backend ✅/❌
5. LINT: frontend ✅/❌ | backend ✅/❌
6. MANUAL VERIFICATION: [what was clicked through]
7. READY FOR: P005 (Testing)
```

---

## STRICT RULES

- ✅ Reuse Bolt's screens — do not redesign them
- ✅ Reuse P003's DTOs/endpoints — do not add new backend routes here
- ❌ Do NOT add new business logic during integration
- ❌ Do NOT store the refresh token in localStorage/sessionStorage
- ❌ Do NOT bypass the role-based guards on the backend
