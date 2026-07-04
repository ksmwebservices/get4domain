# P000 — Get4Domain Workspace Initialization
# Get4Domain Engineering Standard v1.0
# Phase: P000 | Owner: Claude Code | Frequency: ONE-TIME ONLY

---

## YOUR ROLE IN THIS PHASE

You are initializing the permanent Get4Domain development workspace.
This is done once. Never repeat P000 for the same machine.

---

## READ FIRST

Before doing anything:
1. Read `CLAUDE.md` in this repository root — full file, every section
2. Read `GET4DOMAIN_PLATFORM.json` — understand the platform structure
3. Read this file completely — then execute

---

## WHAT THIS PHASE DOES

P000 creates two things:

### A) Local Workspace on Developer Machine
The permanent folder structure at `C:\GET4DOMAIN\` on Windows.

### B) GET4DOMAIN Platform Repository
The company engineering repository at `github.com/ksmwebservices/get4domain`.
This repository holds: standards, prompts, industry packs, documentation.
It does NOT hold client applications.

---

## TASK 1 — VERIFY LOCAL WORKSPACE

Check if these folders exist on the local machine.
Create any that are missing. Do not delete existing folders.

```
C:\GET4DOMAIN\
├── GET4DOMAIN\             ← git clone of github.com/ksmwebservices/get4domain
├── CLIENT_PROJECTS\        ← all client repos live here (one folder per client)
├── SHARED_LIBRARIES\
│   ├── auth\
│   ├── ui\
│   ├── notifications\
│   ├── email\
│   ├── logging\
│   ├── utils\
│   └── types\
├── TOOLS\
│   ├── scripts\
│   ├── docker\
│   ├── utilities\
│   └── templates\
└── BACKUPS\
```

On Windows, create with:
```powershell
$folders = @(
  "C:\GET4DOMAIN\GET4DOMAIN",
  "C:\GET4DOMAIN\CLIENT_PROJECTS",
  "C:\GET4DOMAIN\SHARED_LIBRARIES\auth",
  "C:\GET4DOMAIN\SHARED_LIBRARIES\ui",
  "C:\GET4DOMAIN\SHARED_LIBRARIES\notifications",
  "C:\GET4DOMAIN\SHARED_LIBRARIES\email",
  "C:\GET4DOMAIN\SHARED_LIBRARIES\logging",
  "C:\GET4DOMAIN\SHARED_LIBRARIES\utils",
  "C:\GET4DOMAIN\SHARED_LIBRARIES\types",
  "C:\GET4DOMAIN\TOOLS\scripts",
  "C:\GET4DOMAIN\TOOLS\docker",
  "C:\GET4DOMAIN\TOOLS\utilities",
  "C:\GET4DOMAIN\TOOLS\templates",
  "C:\GET4DOMAIN\BACKUPS"
)
foreach ($folder in $folders) {
  if (-not (Test-Path $folder)) {
    New-Item -ItemType Directory -Path $folder -Force
    Write-Host "Created: $folder"
  } else {
    Write-Host "Exists:  $folder"
  }
}
```

---

## TASK 2 — VERIFY REPOSITORY STRUCTURE

Check that all required folders exist in this repository.
Create any missing folders with a `.gitkeep` file inside.

Required repository structure:
```
get4domain/
├── CLAUDE.md                               ← master rules (this is the one you read)
├── CLAUDE.md                               ← must exist and be complete
├── GET4DOMAIN_PLATFORM.json               ← platform config
├── README.md                              ← platform overview
├── .env.example                           ← environment template
├── .gitignore                             ← git ignore rules
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                         ← CI pipeline
│   │   └── deploy-dev.yml                 ← dev deployment
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
├── docs/
│   ├── business/
│   │   ├── PAYMENT_POLICY.md
│   │   └── CLIENT_REPOSITORY_GUIDE.md
│   ├── technical/
│   │   └── ARCHITECTURE.md
│   ├── agreements/                        ← NDA, SOW templates (add manually)
│   ├── onboarding/
│   │   └── NEW_CLIENT_QUESTIONNAIRE.md
│   └── prompts/                           ← client-specific prompts (future)
├── engineering/
│   ├── coding-standards/
│   │   ├── TYPESCRIPT.md
│   │   ├── NESTJS.md
│   │   ├── DATABASE.md
│   │   └── GIT.md
│   ├── prompts/
│   │   └── phases/
│   │       ├── P000-WORKSPACE-INIT.md     ← this file
│   │       ├── P001-PROJECT-INIT.md
│   │       ├── P002-BOLT-UI.md
│   │       ├── P003-BACKEND.md
│   │       ├── P004-INTEGRATION.md
│   │       ├── P005-TESTING.md
│   │       └── P006-DEPLOYMENT.md
│   ├── checklists/
│   │   ├── PRE-LAUNCH.md
│   │   ├── CODE-REVIEW.md
│   │   └── CLIENT-ONBOARDING.md
│   ├── industry-packs/
│   │   ├── travel/
│   │   │   ├── README.md
│   │   │   └── MODULE_LIST.md
│   │   ├── real-estate/
│   │   ├── hospital/
│   │   ├── school/
│   │   ├── restaurant/
│   │   ├── hr/
│   │   └── retail/
│   ├── templates/                         ← project templates (future)
│   └── docker-base/                       ← base Docker images (future)
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       │   ├── ui/
│       │   ├── layout/
│       │   └── common/
│       ├── lib/
│       ├── hooks/
│       ├── types/
│       ├── services/
│       ├── store/
│       ├── utils/
│       ├── constants/
│       └── styles/
├── backend/
│   ├── src/
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   ├── filters/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   ├── interfaces/
│   │   │   ├── pipes/
│   │   │   ├── utils/
│   │   │   ├── constants/
│   │   │   └── dto/
│   │   ├── config/
│   │   ├── database/
│   │   ├── logger/
│   │   └── modules/
│   │       ├── auth/
│   │       ├── users/
│   │       ├── clients/
│   │       ├── projects/
│   │       ├── invoices/
│   │       ├── payments/
│   │       └── hosting/
│   └── prisma/
│       ├── migrations/
│       └── seeds/
├── database/
├── deployment/
│   ├── docker/
│   ├── nginx/
│   ├── scripts/
│   └── k8s/
├── shared/
│   ├── ui-components/
│   ├── api-utils/
│   ├── validators/
│   ├── constants/
│   └── types/
├── testing/
│   ├── e2e/
│   ├── integration/
│   └── unit/
├── scripts/
│   ├── new-client.sh
│   └── workspace-verify.sh
├── assets/
│   ├── logos/
│   ├── images/
│   ├── icons/
│   └── fonts/
├── uploads/
└── logs/
```

---

## TASK 3 — VERIFY KEY FILES EXIST AND ARE COMPLETE

Check each file below. If missing or empty, create it.

### Required files (non-negotiable):

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Master engineering instructions — must be full, detailed |
| `GET4DOMAIN_PLATFORM.json` | Platform configuration JSON |
| `README.md` | Repository overview with full structure docs |
| `.gitignore` | Must exclude .env, node_modules, dist, uploads/* |
| `.env.example` | Template with all required environment variable keys |
| `engineering/prompts/phases/P000-WORKSPACE-INIT.md` | This file |
| `engineering/prompts/phases/P001-PROJECT-INIT.md` | Client project init prompt |
| `engineering/prompts/phases/P002-BOLT-UI.md` | Bolt UI prompt |
| `engineering/prompts/phases/P003-BACKEND.md` | Backend development prompt |
| `engineering/prompts/phases/P004-INTEGRATION.md` | Integration prompt |
| `engineering/prompts/phases/P005-TESTING.md` | Testing prompt |
| `engineering/prompts/phases/P006-DEPLOYMENT.md` | Deployment prompt |
| `engineering/coding-standards/TYPESCRIPT.md` | TS rules |
| `engineering/coding-standards/NESTJS.md` | NestJS rules |
| `engineering/coding-standards/DATABASE.md` | Database rules |
| `engineering/coding-standards/GIT.md` | Git rules |
| `engineering/checklists/PRE-LAUNCH.md` | Pre-launch checklist |
| `engineering/checklists/CODE-REVIEW.md` | Code review checklist |
| `engineering/checklists/CLIENT-ONBOARDING.md` | Onboarding checklist |
| `engineering/industry-packs/travel/README.md` | Travel industry spec |
| `engineering/industry-packs/travel/MODULE_LIST.md` | Travel module list |
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline |
| `docs/business/PAYMENT_POLICY.md` | Payment policy document |
| `docs/technical/ARCHITECTURE.md` | Architecture overview |
| `scripts/new-client.sh` | New client setup script |
| `scripts/workspace-verify.sh` | Workspace verification script |

---

## TASK 4 — GIT INITIALIZATION

```bash
# If git not initialized:
git init
git config user.email "dev@get4domain.com"
git config user.name "Get4Domain Engineering"

# Rename branch to main
git branch -m main

# Add remote (do not push yet — manual step)
git remote add origin https://github.com/ksmwebservices/get4domain

# Create develop branch
git checkout -b develop
git checkout main

# Stage and commit
git add .
git commit -m "feat: P000 – Get4Domain workspace initialization

Get4Domain Engineering Standard v1.0
- Complete repository structure
- CLAUDE.md master rules
- Engineering prompts P000-P006
- Coding standards (TS, NestJS, DB, Git)
- Industry packs (travel + 6 future)
- GitHub Actions CI/CD
- Business documentation
- Checklists and onboarding docs"
```

---

## TASK 5 — PUSH TO GITHUB (MANUAL — REQUIRES YOUR TOKEN)

```bash
# IMPORTANT: The existing GitHub repo has a static website.
# Pull first to preserve existing content.

git fetch origin
git pull origin main --allow-unrelated-histories --strategy-option=ours

# Push both branches
git push -u origin main
git push -u origin develop
```

If there are conflicts with existing website files — **preserve the existing files**.
Only add new engineering files. Never overwrite existing website content.

---

## TASK 6 — VERIFY EVERYTHING

Run the verification script:
```bash
./scripts/workspace-verify.sh
```

Manual checklist:
- [ ] All repository folders created
- [ ] All required files exist and have content
- [ ] CLAUDE.md is complete (not a stub)
- [ ] All P000-P006 prompt files are complete
- [ ] Git initialized with main + develop branches
- [ ] Remote origin set to github.com/ksmwebservices/get4domain
- [ ] .gitignore excludes .env, node_modules, uploads/*
- [ ] No client code in this repository

---

## DELIVERABLES — REPORT THIS WHEN DONE

```
P000 — WORKSPACE INITIALIZATION COMPLETE
==========================================

1. LOCAL WORKSPACE:
   [List each folder with ✅ EXISTS or ✅ CREATED]

2. REPOSITORY STRUCTURE:
   [Full folder tree]

3. FILES CREATED/VERIFIED:
   [List each file with status]

4. GIT STATUS:
   - Branches: main, develop
   - Commits: [count]
   - Remote: github.com/ksmwebservices/get4domain
   - Last commit: [message]

5. PENDING MANUAL ACTIONS:
   - Push to GitHub (requires your GitHub token/credentials)
   - Add existing website files if needed
   - Configure GitHub branch protection rules

6. READY FOR:
   P001 — Client Project Initialization (MR_TRAVELS_001)
```

---

## STRICT RULES FOR THIS PHASE

- ✅ Create structure and files only
- ✅ Preserve any existing files in the repository
- ✅ Report clearly what was created vs already existed
- ❌ Do NOT start client development
- ❌ Do NOT create MR_TRAVELS_001 or any client project
- ❌ Do NOT implement any business modules
- ❌ Do NOT push to GitHub automatically (push is a manual step)
- ❌ Do NOT delete or overwrite any existing website files

