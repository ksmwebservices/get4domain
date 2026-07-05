# Get4Domain Platform

> **Engineering Standard v1.0** | Low-cost Business Web Applications | SaaS Managed Service

[![Website](https://img.shields.io/badge/website-get4domain.com-blue)](https://get4domain.com)
[![Standard](https://img.shields.io/badge/standard-v1.0-green)](./docs/technical)

---

## 🏢 About Get4Domain

Get4Domain delivers professional web applications for businesses across industries.

**Services:**
- Custom Web Applications (industry-specific)
- SaaS Managed Hosting
- Annual Renewal & AMC
- Digital Marketing
- WhatsApp / SMS / Email Campaigns

**Business Model:**
- Client pays for software implementation + managed service
- No source code handover (unless separately contracted)
- 50% advance → Development → 50% final → Production

---

## 🗂️ Repository Structure

```
GET4DOMAIN/
├── .github/                  # CI/CD workflows, PR templates
├── docs/                     # Business & technical documentation
│   ├── business/             # Proposals, agreements, SOW templates
│   ├── technical/            # Architecture, standards, guidelines
│   ├── agreements/           # NDA, contract templates
│   ├── onboarding/           # Client onboarding guides
│   └── prompts/              # AI Engineering prompt library
├── frontend/                 # Get4Domain Platform UI (future)
├── backend/                  # Get4Domain Platform API (future)
├── database/                 # Platform database schemas
├── deployment/               # Docker, Nginx, K8s configs
├── engineering/              # Engineering standards & industry packs
│   ├── coding-standards/     # TypeScript, NestJS, Next.js standards
│   ├── templates/            # Project initialization templates
│   ├── checklists/           # Pre-launch, review checklists
│   ├── docker-base/          # Base Docker images
│   └── industry-reference/   # Per-industry master knowledge base (never duplicated in client repos)
│       ├── travel/
│       ├── real-estate/
│       ├── hospital/
│       ├── school/
│       ├── restaurant/
│       ├── hr/
│       └── retail/
├── shared/                   # Shared libraries (future)
├── scripts/                  # Dev, build, deployment scripts
├── testing/                  # Platform-level tests
├── assets/                   # Brand assets, logos
├── uploads/                  # Platform uploads
└── logs/                     # Platform logs
```

---

## 🛠️ Technology Stack (Standard)

| Layer       | Technology                              |
|-------------|------------------------------------------|
| Frontend    | Next.js, TypeScript, Tailwind, shadcn/ui |
| Backend     | NestJS, TypeScript                       |
| Database    | PostgreSQL + Prisma ORM                  |
| Auth        | JWT + Refresh Token + RBAC               |
| Deployment  | Docker + Docker Compose + Nginx          |
| AI Workflow | ChatGPT (Business Consultant / Reviewer) + Claude Code (Engineer) + Bolt (UI) |

---

## 🤖 AI Engineering Workflow

| Role                            | Tool        | Responsibility                                                                 |
|----------------------------------|-------------|---------------------------------------------------------------------------------|
| Business Consultant / Reviewer  | ChatGPT     | Business Consultant, Architecture Review, Solution Review, Prompt Engineering, Final Approval |
| Engineer                        | Claude Code | Engineering Package Generation, Documentation, Backend Development, Integration, Testing, Deployment |
| UI Builder                      | Bolt        | Frontend UI                                                                     |

Claude Code is authorized to generate and maintain the Engineering Package
for approved projects following Get4Domain Engineering Standards.

---

## 📋 Client Project Structure

Each client project is a **separate repository**:

```
CLIENT_PROJECTS/
├── MR_TRAVELS_001/     → github.com/ksmwebservices/mr-travels-001
├── HR_001/             → github.com/ksmwebservices/hr-001
├── HOSPITAL_001/       → github.com/ksmwebservices/hospital-001
└── REAL_ESTATE_001/    → github.com/ksmwebservices/real-estate-001
```

Each has: Separate Git repo · Separate DB · Separate deployment · Separate subdomain

---

## 🌿 Branch Strategy

```
main      → Production only (protected)
develop   → Integration
feature/* → Feature work
fix/*     → Bug fixes
hotfix/*  → Production hotfixes
release/* → Release prep
```

## 📝 Commit Standard

```
feat:     New feature
fix:      Bug fix
docs:     Documentation
chore:    Maintenance
refactor: Code restructure
test:     Tests
deploy:   Deployment changes
```

---

## 🔒 IP Policy

This repository contains Get4Domain's proprietary engineering framework.
Client deliverables are always in separate repositories.
Source code is NOT included in client deliverables unless separately contracted.

© 2025 Get4Domain. All rights reserved.
