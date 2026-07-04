# Get4Domain

Get4Domain is a SaaS managed service company delivering low-cost, industry-specific
business web applications. Clients pay for implementation plus managed hosting;
source code is not delivered unless separately contracted.

This repository is the **company platform repo** — engineering standards, the
prompt library, shared tools, and (in future) the customer portal. Client
projects live in their own separate repositories (e.g.
`github.com/ksmwebservices/mr-travels-001`), never inside this one.

---

## Technology Stack

| Layer        | Technology                                      |
|--------------|--------------------------------------------------|
| Frontend     | Next.js (latest stable) + TypeScript              |
| Styling      | Tailwind CSS + shadcn/ui                          |
| Backend      | NestJS + TypeScript                               |
| Database     | PostgreSQL                                        |
| ORM          | Prisma                                            |
| Auth         | JWT + Refresh Token + Role-Based Access Control    |
| Package Mgr  | npm                                                |
| Containers   | Docker + Docker Compose                            |
| Web Server   | Nginx (reverse proxy)                              |
| Version Ctrl | Git + GitHub                                       |
| Dev OS       | Windows                                            |
| Prod OS      | Ubuntu                                             |

## Engineering Phases

| Phase | Owner       | Description                                        |
|-------|-------------|-----------------------------------------------------|
| P000  | Claude Code | One-time Get4Domain workspace initialization         |
| P001  | Claude Code | New client project initialization                    |
| P002  | Bolt        | Frontend UI — public site + admin dashboard           |
| P003  | Claude Code | Backend — auth, DB models, APIs, business modules      |
| P004  | Claude Code | Integration — connect Bolt UI to backend APIs          |
| P005  | Claude Code | Testing — build, lint, unit tests, API tests           |
| P006  | Claude Code | Deployment — Docker, Nginx, production server          |

Phase prompts live in `engineering/prompts/phases/`. Read `CLAUDE.md` and the
relevant phase prompt before starting any phase.

## Repository Structure

```
get4domain/
├── CLAUDE.md                   ← master engineering rules
├── GET4DOMAIN_PLATFORM.json    ← platform config
├── README.md
├── .github/                    ← CI/CD workflows, issue templates
├── docs/                       ← business + technical docs
├── engineering/                ← standards, prompts, industry packs
│   ├── coding-standards/
│   ├── prompts/phases/         ← P000 - P006
│   ├── checklists/
│   ├── industry-packs/
│   ├── templates/
│   └── docker-base/
├── frontend/                   ← platform frontend (future)
├── backend/                    ← platform backend (future)
├── shared/                     ← shared libraries (future)
├── deployment/                 ← platform deployment configs
├── scripts/                    ← workspace automation
└── assets/                     ← brand assets
```

## Branch Strategy

```
main       → Production only. Direct push never allowed.
develop    → Integration. All features merge here first.
feature/*  → One branch per feature. Branch from develop.
fix/*      → Bug fixes. Branch from develop.
hotfix/*   → Emergency production fixes. Branch from main.
release/*  → Release preparation. Branch from develop.
```

## Commit Standards

Conventional Commits: `<type>: <short description>` where type is one of
`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `deploy`, `style`.

## Environment URLs

| Environment | Pattern                           | Example                          |
|-------------|------------------------------------|-----------------------------------|
| Development | `{client}-dev.get4domain.com`      | `mr-travels-dev.get4domain.com`   |
| Staging     | `{client}-staging.get4domain.com`  | `mr-travels-staging.get4domain.com` |
| Production  | `{client}.get4domain.com`          | `mr-travels.get4domain.com`       |

## Current Active Client

| Field         | Value                                     |
|---------------|--------------------------------------------|
| Client ID     | MR_TRAVELS_001                             |
| Client Name   | M.R. Travels & Tours                       |
| Industry      | Travel & Tour (Tamil Nadu, India)          |
| Repo          | github.com/ksmwebservices/mr-travels-001    |
| Current Phase | P001 complete → P003 next                  |

See `CLAUDE.md` for the full engineering standard.
