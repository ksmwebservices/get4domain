# P000 — Get4Domain Workspace Initialization
# Get4Domain Engineering Standard v1.1
# Phase: P000 | Owner: Claude Code | ONE-TIME ONLY — never repeat

---

## PURPOSE

Initialize the permanent Get4Domain development workspace on a new machine.
This runs once. After it completes, the workspace is frozen until a new machine
or a major restructure is explicitly authorized.

---

## READ FIRST

Before doing anything, read these 6 files in order:

1. CLAUDE.md
2. WORKFLOW.md
3. GITHUB.md
4. CURRENT_TASK.md
5. PROJECT_REGISTRY.json
6. REPOSITORY_RULES.md

All 6 are at the repository root (C:\Get4Domain\).
Do not proceed until all 6 are read and understood.

---

## WHAT THIS PHASE DOES

Two things only:

A) Verifies the Get4Domain platform repository files and structure
B) Creates workspace sibling folders on the local machine

---

## TASK 1 — VERIFY SESSION FILES AT REPO ROOT

All 6 files must exist at C:\Get4Domain\ (repo root).
If any is missing, stop and report — do not proceed.

```
C:\Get4Domain\
├── CLAUDE.md               ← master rules
├── WORKFLOW.md             ← phase sequence and responsibilities
├── GITHUB.md               ← workspace and repo structure
├── CURRENT_TASK.md         ← active project and phase
├── PROJECT_REGISTRY.json   ← all client projects and status
└── REPOSITORY_RULES.md     ← non-negotiable rules
```

---

## TASK 2 — VERIFY ENGINEERING STRUCTURE

Verify these folders and files exist inside the repo.
Create only missing items — never overwrite existing content.

```
C:\Get4Domain\
├── engineering\
│   ├── prompts\
│   │   └── phases\
│   │       ├── P000-WORKSPACE-INIT.md    ← this file
│   │       ├── P001-PROJECT-INIT.md
│   │       ├── P002-BOLT-UI.md
│   │       ├── P003-BACKEND.md
│   │       ├── P004-INTEGRATION.md
│   │       ├── P005-TESTING.md
│   │       └── P006-DEPLOYMENT.md
│   ├── coding-standards\
│   │   ├── TYPESCRIPT.md
│   │   ├── NESTJS.md
│   │   ├── DATABASE.md
│   │   └── GIT.md
│   ├── checklists\
│   │   ├── PRE-LAUNCH.md
│   │   ├── CODE-REVIEW.md
│   │   └── CLIENT-ONBOARDING.md
│   └── industry-reference\
│       ├── travel\
│       │   ├── OVERVIEW.md
│       │   ├── MODULES.md
│       │   ├── DB_GUIDE.md
│       │   ├── API_GUIDE.md
│       │   ├── UI_GUIDE.md
│       │   ├── IMPLEMENTATION_NOTES.md
│       │   └── MODULE_CHECKLIST.md
│       ├── hr\           (7 placeholder files)
│       ├── hospital\     (7 placeholder files)
│       ├── real-estate\  (7 placeholder files)
│       ├── restaurant\   (7 placeholder files)
│       ├── retail\       (7 placeholder files)
│       └── school\       (7 placeholder files)
├── docs\
│   ├── business\
│   │   ├── PAYMENT_POLICY.md
│   │   └── CLIENT_REPOSITORY_GUIDE.md
│   ├── technical\
│   │   └── ARCHITECTURE.md
│   └── onboarding\
│       └── NEW_CLIENT_QUESTIONNAIRE.md
├── scripts\
│   ├── workspace-verify.sh
│   └── new-client.sh
└── assets\
    └── logos\
```

---

## TASK 3 — CREATE WORKSPACE SIBLING FOLDERS

These folders are siblings to the repo files inside C:\Get4Domain\.
They are NOT committed to Git — they are local machine structure only.

```
C:\Get4Domain\
├── [repo files — already exist]
│
├── CLIENT_PROJECTS\
│   ├── TRAVEL\
│   │   ├── CLIENTS\         ← client repos go here
│   │   └── TEMPLATE\        ← future (after MR_TRAVELS_001 completes)
│   ├── HR\
│   │   └── CLIENTS\
│   ├── HOSPITAL\
│   │   └── CLIENTS\
│   ├── REAL_ESTATE\
│   │   └── CLIENTS\
│   └── RESTAURANT\
│       └── CLIENTS\
│
├── SHARED_LIBRARIES\
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

Run this PowerShell from C:\Get4Domain\ to create missing folders:

```powershell
$root = "C:\Get4Domain"
$folders = @(
  "$root\CLIENT_PROJECTS\TRAVEL\CLIENTS",
  "$root\CLIENT_PROJECTS\TRAVEL\TEMPLATE",
  "$root\CLIENT_PROJECTS\HR\CLIENTS",
  "$root\CLIENT_PROJECTS\HOSPITAL\CLIENTS",
  "$root\CLIENT_PROJECTS\REAL_ESTATE\CLIENTS",
  "$root\CLIENT_PROJECTS\RESTAURANT\CLIENTS",
  "$root\SHARED_LIBRARIES\auth",
  "$root\SHARED_LIBRARIES\ui",
  "$root\SHARED_LIBRARIES\notifications",
  "$root\SHARED_LIBRARIES\email",
  "$root\SHARED_LIBRARIES\logging",
  "$root\SHARED_LIBRARIES\utils",
  "$root\SHARED_LIBRARIES\types",
  "$root\TOOLS\scripts",
  "$root\TOOLS\docker",
  "$root\TOOLS\utilities",
  "$root\TOOLS\templates",
  "$root\BACKUPS"
)
foreach ($folder in $folders) {
  if (-not (Test-Path $folder)) {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    Write-Host "CREATED: $folder"
  } else {
    Write-Host "EXISTS:  $folder"
  }
}
Write-Host "`nWorkspace folders verified."
```

---

## TASK 4 — VERIFY GIT SETUP

```bash
# Confirm Git is initialized
git status

# Confirm branches exist
git branch

# Confirm remote is set correctly
git remote -v
# Should show: origin → https://github.com/ksmwebservices/get4domain

# If remote is missing:
git remote add origin https://github.com/ksmwebservices/get4domain.git

# Branches required: main and develop
# If develop is missing:
git checkout -b develop
git checkout main
```

---

## TASK 5 — RUN VERIFICATION SCRIPT

```bash
bash scripts/workspace-verify.sh
```

All items must show ✅ before P000 is declared complete.
Fix any ❌ items before proceeding.

---

## DELIVERABLES

Report this when P000 is complete:

```
P000 — WORKSPACE INITIALIZATION COMPLETE
==========================================

1. SESSION FILES (all 6 at repo root):
   CLAUDE.md             ✅/❌
   WORKFLOW.md           ✅/❌
   GITHUB.md             ✅/❌
   CURRENT_TASK.md       ✅/❌
   PROJECT_REGISTRY.json ✅/❌
   REPOSITORY_RULES.md   ✅/❌

2. ENGINEERING STRUCTURE:
   P000-P006 prompts     ✅/❌
   coding-standards/     ✅/❌
   checklists/           ✅/❌
   industry-reference/travel/ (7 files) ✅/❌
   industry-reference/other/ (placeholders) ✅/❌

3. WORKSPACE SIBLING FOLDERS:
   [Each folder: CREATED or EXISTS]

4. GIT:
   Branches: main, develop ✅/❌
   Remote: github.com/ksmwebservices/get4domain ✅/❌

5. VERIFICATION SCRIPT: PASS/FAIL

6. ISSUES FOUND: [list any ❌ items]

7. STATUS: P000 COMPLETE — Ready for Engineering Package
```

---

## STRICT RULES

- ✅ Verify and create structure only
- ✅ Report exactly what exists vs what was created
- ✅ Preserve all existing files — never overwrite
- ❌ Do NOT push to GitHub
- ❌ Do NOT commit (push is a manual step requiring credentials)
- ❌ Do NOT start P001 or any client work
- ❌ Do NOT invent or modify business documentation
