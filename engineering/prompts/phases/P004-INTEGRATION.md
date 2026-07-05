# P004 — Integration
# Get4Domain Engineering Standard v1.0
# Phase: P004 | Owner: Claude Code | Runs after P002 + P003 complete

---

## YOUR ROLE IN THIS PHASE

Connect the Bolt-built frontend to the NestJS backend APIs.
Wire up authentication. Connect all forms to real endpoints.
Add loading states and error handling.

---

## READ FIRST

1. Read CLAUDE.md
2. Check all Bolt-built pages in frontend/src/app/
3. Check all backend API endpoints in Swagger: http://localhost:3001/api/docs
4. Read this file completely — then execute

---

## TASK 1 — AUTHENTICATION FLOW

Wire up login and token management:

### src/services/api/auth.service.ts
```typescript
// POST /auth/login → store tokens
// POST /auth/refresh → refresh access token
// POST /auth/logout → clear tokens
// GET /auth/me → get current user
```

### src/store/auth.store.ts (Zustand)
```typescript
// State: user, accessToken, isAuthenticated, isLoading
// Actions: login, logout, refreshToken, setUser
```

### Update src/lib/axios.ts
```typescript
// Request interceptor: attach Bearer token from store
// Response interceptor: on 401, call refresh token, retry
// On refresh fail: logout + redirect to /login
```

### Middleware: app/middleware.ts
```typescript
// Protect all /dashboard/* routes
// Redirect to /login if no valid token
// Redirect to /dashboard if already logged in and hitting /login
```

---

## TASK 2 — CONNECT EACH MODULE

For each business module, create:

### src/services/api/{module}.service.ts
```typescript
// getAll(filter) → GET /api/v1/{module}
// getById(id) → GET /api/v1/{module}/:id
// create(dto) → POST /api/v1/{module}
// update(id, dto) → PATCH /api/v1/{module}/:id
// remove(id) → DELETE /api/v1/{module}/:id
// Module-specific methods as needed
```

### src/hooks/use{Module}.ts
```typescript
// useQuery for list + detail
// useMutation for create, update, delete
// Use @tanstack/react-query
// Invalidate queries after mutations
```

### Update each page:
- Replace placeholder data with real API calls
- Add loading skeletons while fetching
- Add error messages on failure
- Add success toasts on create/update/delete
- Wire up forms (react-hook-form + zod validation)
- Wire up pagination
- Wire up search/filter

---

## TASK 3 — FORM VALIDATION

All forms must use:
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// Zod schema must match backend DTO validation
// Error messages must be user-friendly
// Required fields marked with *
```

---

## TASK 4 — ERROR HANDLING

Global error handling:
- 400 Validation Error → show field-level errors
- 401 Unauthorized → redirect to login
- 403 Forbidden → show "Access denied" message
- 404 Not Found → show empty state
- 500 Server Error → show "Something went wrong" toast

---

## TASK 5 — BUILD VERIFICATION

```bash
cd frontend && npm run build   # must pass 0 errors
cd frontend && npm run lint    # must pass 0 errors
```

---

## DELIVERABLES

```
P004 — INTEGRATION COMPLETE
============================
1. Auth flow: login, refresh, logout, protected routes ✅/❌
2. Modules connected: [list each ✅/❌]
3. Form validation working: ✅/❌
4. Error handling: ✅/❌
5. Frontend build: ✅/❌
6. Ready for: P005 (Testing)
```

---

## STRICT RULES

- ✅ Do NOT redesign any UI — only wire up logic
- ✅ Zod schemas must match backend DTO validation exactly
- ✅ All API calls go through src/services/api/ only
- ✅ All state in Zustand stores or react-query (no local state for server data)
- ❌ Do NOT add new UI components — use what Bolt built
- ❌ Do NOT change backend APIs

