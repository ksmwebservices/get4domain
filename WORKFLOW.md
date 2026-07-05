# WORKFLOW.md — Get4Domain Engineering Workflow
# Version: 1.1 | Read at the start of every session.

---

## Three-Tool Workflow

| Tool        | Role                            | Never Does                                |
|-------------|-----------------------------------|---------------------------------------------|
| ChatGPT     | Business Consultant / Reviewer  | Write code, write engineering documents      |
| Bolt        | UI Builder                      | Backend, database, APIs                       |
| Claude Code | Engineer                        | Design UI                                      |

Claude Code is authorized to generate and maintain the Engineering Package
for approved projects following Get4Domain Engineering Standards.

---

## Phase Sequence

```
P000  Workspace Setup
      Owner: Claude Code | One-time only
  ↓

P001  Client Project Initialization
      Owner: Claude Code | Once per client
  ↓

EP01  Engineering Package Generation
      Owner: Claude Code | Generates the 20-document Engineering Package
      Gate:  ChatGPT reviews (architecture/solution/quality) and gives final approval
  ↓

P002  Frontend UI (Bolt)          P003  Backend + Database (Claude)
      Runs in PARALLEL ←────────────────→ Runs in PARALLEL
      Gate: P001 complete                Gate: P001 complete
            EP01 approved                     EP01 approved
  ↓

P004  Integration
      Owner: Claude Code
      Gate:  BOTH P002 and P003 complete
  ↓

P005  Testing
      Owner: Claude Code
      Gate:  P004 complete
  ↓

P006  Deployment
      Owner: Claude Code
      Gate:  P005 complete
             Client written approval
             Final 50% payment confirmed
```

---

## Engineering Package (required before P002/P003)

Claude Code generates 20 documents into the client's docs/ folder (phase EP01).
ChatGPT reviews and gives final approval before Claude Code writes any code
for P002 (handed to Bolt) or P003.

```
01_PROJECT_BRIEF.md          11_UI_SPECIFICATION.md
02_BUSINESS_REQUIREMENTS.md  12_SECURITY_SPECIFICATION.md
03_PRD.md                    13_DEPLOYMENT_SPECIFICATION.md
04_FUNCTIONAL_SPECIFICATION.md 14_TEST_PLAN.md
05_SCOPE.md                  15_ACCEPTANCE_CRITERIA.md
06_USER_ROLES.md             16_PROJECT_TASKS.md
07_MODULE_SPECIFICATION.md   17_RELEASE_PLAN.md
08_BUSINESS_WORKFLOW.md      18_CHANGE_REQUEST_POLICY.md
09_DATABASE_DESIGN.md        19_PAYMENT_WORKFLOW.md
10_API_SPECIFICATION.md      20_CURRENT_TASK.md
```

---

## Phase Gate Process

```
Claude Code generates Engineering Package (EP01)
       ↓
Documents placed in client docs/
       ↓
ChatGPT reviews (architecture / solution / quality) and gives final approval
       ↓
ChatGPT issues phase prompt to Claude Code
       ↓
Claude Code reads session files + all docs/
       ↓
Claude Code executes that phase ONLY
       ↓
Claude Code reports completion to ChatGPT
       ↓
ChatGPT reviews report
       ↓
ChatGPT issues next phase prompt
```

Claude Code NEVER auto-advances to the next phase.

---

## Phase Responsibilities

### P000 — Workspace Setup (one-time)
- Creates C:\Get4Domain\ sibling folders
- Verifies platform repo structure and files
- Initializes Git with main + develop branches
- Prompt: engineering/prompts/phases/P000-WORKSPACE-INIT.md

### P001 — Client Project Init
- Creates independent client repo
- Initializes Next.js frontend (no UI)
- Initializes NestJS backend (no business modules)
- Configures Prisma (empty schema)
- Docker, Nginx, Git setup
- Prompt: engineering/prompts/phases/P001-PROJECT-INIT.md

### EP01 — Engineering Package Generation (Claude Code)
- Generates all 20 Engineering Package documents into client docs/
- Cross-references all documents internally
- No source code, no UI, no backend implementation
- Submits package to ChatGPT for architecture / solution / quality review
- Prompt: engineering/prompts/phases/EP01-ENGINEERING-PACKAGE.md

### P002 — Frontend UI (Bolt)
- Public website
- Admin dashboard shell
- All UI components and pages
- Responsive layouts
- No backend connections yet
- Prompt: engineering/prompts/phases/P002-BOLT-UI.md

### P003 — Backend + Database (Claude)
- Complete Prisma schema (all models from DB Design)
- Authentication (JWT + refresh + RBAC)
- All business modules per Module Specification
- All APIs per API Specification
- Seed data
- Prompt: engineering/prompts/phases/P003-BACKEND.md

### P004 — Integration (Claude)
- Connect Bolt UI to backend APIs
- Wire authentication flow
- Connect all forms to endpoints
- Loading states, error handling
- Prompt: engineering/prompts/phases/P004-INTEGRATION.md

### P005 — Testing (Claude)
- Backend build + lint: 0 errors
- Frontend build + lint: 0 errors
- API endpoint testing
- Unit tests for critical services
- Docker build verification
- Prompt: engineering/prompts/phases/P005-TESTING.md

### P006 — Deployment (Claude)
- Production Docker build
- Ubuntu server + Nginx + SSL
- Database migration
- Backup configuration
- Prompt: engineering/prompts/phases/P006-DEPLOYMENT.md

---

## Payment Gates

```
Agreement signed + 50% advance
         ↓
    Development starts (P001)
         ↓
    Dev server delivered for client review
         ↓
    Client written approval
         ↓
    50% final payment confirmed
         ↓
    Production deployment (P006)
```

---

## Phase Completion Report Format

Claude Code provides this after every phase:

```
Phase: P001
Status: Complete

1. What was done: [list]
2. Files created: [list]
3. Build: PASS/FAIL [error count]
4. Lint: PASS/FAIL [error count]
5. Issues resolved: [list]
6. Pending items: [list]
7. Ready for: [next phase]
```

---

## Prompt File Locations

```
engineering/prompts/phases/
├── P000-WORKSPACE-INIT.md
├── P001-PROJECT-INIT.md
├── EP01-ENGINEERING-PACKAGE.md
├── P002-BOLT-UI.md
├── P003-BACKEND.md
├── P004-INTEGRATION.md
├── P005-TESTING.md
└── P006-DEPLOYMENT.md
```

---

## Session Startup Files

Read these 6 files at the start of every Claude Code session, in order:

```
1. CLAUDE.md                ← master rules
2. WORKFLOW.md              ← this file
3. GITHUB.md                ← workspace and repo structure
4. CURRENT_TASK.md          ← active project and phase
5. PROJECT_REGISTRY.json    ← all clients and status
6. REPOSITORY_RULES.md      ← non-negotiable rules
```

All 6 are at the repository root (C:\Get4Domain\).
Do not proceed until all 6 are read.

---

## Industry Reference Location

Master knowledge base — never duplicated in client repos:

```
engineering/industry-reference/
├── travel/       ← 7 complete files (MR_TRAVELS_001 reference)
├── hr/           ← 7 placeholder files
├── hospital/     ← 7 placeholder files
├── real-estate/  ← 7 placeholder files
├── restaurant/   ← 7 placeholder files
├── retail/       ← 7 placeholder files
└── school/       ← 7 placeholder files
```

Per industry: OVERVIEW.md, MODULES.md, DB_GUIDE.md, API_GUIDE.md,
UI_GUIDE.md, IMPLEMENTATION_NOTES.md, MODULE_CHECKLIST.md
