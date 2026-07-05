# GITHUB.md — Repository & Workspace Structure
# Get4Domain Engineering Standard v1.0
# Read at the start of every session.

---

## GitHub Account

Organization: ksmwebservices
URL: https://github.com/ksmwebservices

---

## Repository Map

### Company Platform (this repo)
```
Repository:  github.com/ksmwebservices/get4domain
Local path:  C:\Get4Domain\
Purpose:     Engineering standards, prompt library, documentation,
             future company portal, future admin portal, shared assets
Rule:        NEVER contains client business applications
```

### Client Repositories (each client = independent repo)
```
github.com/ksmwebservices/mr-travels-001
github.com/ksmwebservices/abc-travels-001
github.com/ksmwebservices/hospital-001
github.com/ksmwebservices/hr-001
```

Each client repo has its own:
codebase · database · deployment · documentation · Git history

---

## Local Workspace Structure

```
C:\Get4Domain\                          ← Workspace root = platform repo
│
├── CLAUDE.md                           ← Session startup file 1
├── WORKFLOW.md                         ← Session startup file 2
├── GITHUB.md                           ← Session startup file 3
├── CURRENT_TASK.md                     ← Session startup file 4
├── PROJECT_REGISTRY.json               ← Session startup file 5
├── REPOSITORY_RULES.md                 ← Session startup file 6
├── engineering\
│   ├── prompts/phases/             ← P000–P006 prompt files
│   ├── coding-standards/
│   ├── checklists/
│   └── industry-reference/         ← master knowledge base (never in client repos)
│       ├── travel/                 ← 7 complete files
│       └── {other industries}/     ← 7 placeholder files each
├── docs\                               ← Business documentation
├── scripts\                            ← Workspace scripts
└── assets\                             ← Brand assets
│
├── CLIENT_PROJECTS\                    ← All client repos (never inside platform repo)
│   │
│   ├── TRAVEL\
│   │   ├── CLIENTS\
│   │   │   ├── MR_TRAVELS_001\         ← github.com/ksmwebservices/mr-travels-001
│   │   │   └── ABC_TRAVELS_001\        ← future
│   │   └── TEMPLATE\                   ← future reusable template (after MR_TRAVELS_001)
│   │
│   ├── HR\
│   │   ├── CLIENTS\
│   │   └── TEMPLATE\                   ← future
│   │
│   ├── HOSPITAL\
│   │   ├── CLIENTS\
│   │   └── TEMPLATE\                   ← future
│   │
│   ├── REAL_ESTATE\
│   │   ├── CLIENTS\
│   │   └── TEMPLATE\                   ← future
│   │
│   └── RESTAURANT\
│       ├── CLIENTS\
│       └── TEMPLATE\                   ← future
│
├── SHARED_LIBRARIES\                   ← Future reusable npm packages
│   ├── auth\
│   ├── ui\
│   ├── notifications\
│   ├── email\
│   ├── logging\
│   ├── utils\
│   └── types\
│
├── TOOLS\
│   ├── scripts\
│   ├── docker\
│   ├── utilities\
│   └── templates\
│
└── BACKUPS\
```

---

## Client Path Convention

```
C:\Get4Domain\CLIENT_PROJECTS\{INDUSTRY}\CLIENTS\{CLIENT_ID}\

Examples:
  C:\Get4Domain\CLIENT_PROJECTS\TRAVEL\CLIENTS\MR_TRAVELS_001\
  C:\Get4Domain\CLIENT_PROJECTS\HR\CLIENTS\HR_001\
  C:\Get4Domain\CLIENT_PROJECTS\HOSPITAL\CLIENTS\HOSPITAL_001\
```

---

## Branch Strategy (All Repositories)

```
main       → Production only. Direct push NEVER allowed.
develop    → Integration. All work merges here first.
feature/*  → One branch per feature. Branch from develop.
fix/*      → Bug fixes. Branch from develop.
hotfix/*   → Emergency production fixes. Branch from main.
release/*  → Release preparation. Branch from develop.
```

### Branch Protection Rules

main branch:
- Require pull request before merging
- Require 1 approval minimum
- Do not allow force pushes

develop branch:
- Require pull request before merging

---

## Commit Standards

```
Format: <type>: <short description>

Types:
  feat      → new feature
  fix       → bug fix
  docs      → documentation only
  chore     → maintenance
  refactor  → restructure without feature change
  test      → tests
  deploy    → deployment config
  style     → formatting only
```

---

## Starting a New Client Repository

1. Create GitHub repo: github.com/ksmwebservices/{client-id-lowercase}
   Visibility: Private — no README initialization

2. Clone locally:
   cd C:\Get4Domain\CLIENT_PROJECTS\{INDUSTRY}\CLIENTS\
   git clone https://github.com/ksmwebservices/{repo} {CLIENT_ID}

3. Update PROJECT_REGISTRY.json — add client entry

4. Update CURRENT_TASK.md — set active project + phase

5. Give Claude Code the session startup prompt

---

## Development URLs

```
Development:  {client}-dev.get4domain.com
Staging:      {client}-staging.get4domain.com
Production:   {client}.get4domain.com  OR  client's own domain
```

---

## GitHub Actions

.github/workflows/ci.yml        → Build + lint on every PR
.github/workflows/deploy-dev.yml → Auto-deploy to dev on develop push

Secrets to configure in GitHub Settings:
  SSH_PRIVATE_KEY
  SERVER_IP
  SERVER_USER
