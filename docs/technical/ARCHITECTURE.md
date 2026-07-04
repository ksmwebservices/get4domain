# Architecture Overview — Get4Domain

## High-Level Shape

Every client project follows the same architecture, regardless of
industry:

```
Browser
  │
  ▼
Nginx (reverse proxy, SSL termination)
  │
  ├──▶ Next.js frontend (SSR/static, TypeScript, Tailwind + shadcn/ui)
  │
  └──▶ NestJS backend (REST API, TypeScript)
          │
          ▼
      PostgreSQL (via Prisma ORM)
```

Frontend and backend are separate deployable units, each with their own
Docker image, communicating over a versioned REST API
(`/api/v1/...`).

## Backend Layering

```
Controller  → HTTP only (routing, params, decorators)
Service     → business logic
DatabaseService (Prisma wrapper) → persistence
```

Cross-cutting concerns (auth, validation, logging, error handling,
response shaping) are implemented once as global guards/pipes/filters/
interceptors in `main.ts` and `AppModule`, not repeated per module.

## Auth Model

JWT access token (short-lived, ~15 min) + refresh token (long-lived, ~7
days, hashed in DB) issued at login. Role claims are embedded in the access
token and checked by `RolesGuard` against `@Roles()` metadata on each route.

## Multi-Tenancy Model

Get4Domain does **not** run a single multi-tenant database shared across
clients. Each client gets its own database (dev/staging/prod), its own
backend deployment, and its own subdomain
(`{client}[-env].get4domain.com`). This keeps client data fully isolated
and lets each project evolve independently.

## Environments

| Environment | URL pattern                          | Purpose                     |
|-------------|----------------------------------------|-------------------------------|
| Development | `{client}-dev.get4domain.com`          | Active development, Swagger on |
| Staging     | `{client}-staging.get4domain.com`      | Client review/UAT             |
| Production  | `{client}.get4domain.com`              | Live traffic                  |

## Deployment

Docker Compose runs `postgres`, `backend`, and `frontend` services behind
an Nginx reverse proxy on the production Ubuntu host. See P006 for the full
deployment procedure.

## Platform vs. Client Repos

This repository (`get4domain`) holds only the shared engineering standard
and prompt library — it is not part of any client's runtime architecture.
