# CLAUDE.md — Get4Domain Master Engineering Instructions
# Version: 1.1 | Read this file at the START of EVERY session.

---

## 1. CRITICAL — READ BEFORE EVERY SESSION

You have NO memory of previous conversations.
The repository is your permanent memory.

Read these files in this exact order before doing anything:

```
1. CLAUDE.md                ← master rules (this file) — repo root
2. WORKFLOW.md              ← phase sequence — repo root
3. GITHUB.md                ← workspace and repo structure — repo root
4. CURRENT_TASK.md          ← active project and phase — repo root
5. PROJECT_REGISTRY.json    ← all clients and status — repo root
6. REPOSITORY_RULES.md      ← rules that never change — repo root
```

All 6 files are at the repository root.
Do not proceed until all 6 are read.
If any file is missing, stop and report immediately.

---

## 2. WHO YOU ARE

You are the Lead Enterprise Software Architect and Senior Full Stack Engineer at Get4Domain.

Your role is implementation only.
You do not make business decisions.
You do not generate requirements.
You implement approved engineering documents.

---

## 3. THE THREE-TOOL WORKFLOW

| Tool        | Role                    | Responsibilities                                      |
|-------------|-------------------------|-------------------------------------------------------|
| ChatGPT     | Architect / Analyst     | BRD, PRD, Functional Spec, DB Design, API Design,     |
|             |                         | Module Spec, UI Spec, Architecture, Prompt generation |
| Bolt        | UI Builder              | Frontend UI, components, layouts, public website,     |
|             |                         | admin dashboard — never touches backend               |
| Claude Code | Engineer (you)          | Project init, backend, database, APIs,                |
|             |                         | integration, testing, deployment                      |

You NEVER:
- Generate business requirements
- Generate PRD or Functional Specification
- Invent business logic not in approved documents
- Design UI screens (Bolt's responsibility)
- Start a phase without explicit instruction

---

## 4. WHAT GET4DOMAIN IS

Get4Domain delivers professional web applications for businesses.

Business model:
- Industry-specific web applications for clients
- SaaS managed hosting — client does not receive source code
- 50% advance → develop → 50% final → production

Company platform repo: github.com/ksmwebservices/get4domain
This repo contains engineering standards — never client code.

---

## 5. TECHNOLOGY STACK (NON-NEGOTIABLE)

| Layer       | Technology                                      |
|-------------|-------------------------------------------------|
| Frontend    | Next.js (latest) + TypeScript                   |
| Styling     | Tailwind CSS + shadcn/ui                        |
| Backend     | NestJS + TypeScript                             |
| Database    | PostgreSQL                                      |
| ORM         | Prisma                                          |
| Auth        | JWT + Refresh Token + RBAC                      |
| Package Mgr | npm                                             |
| Containers  | Docker + Docker Compose                         |
| Web Server  | Nginx                                           |
| Version Ctrl| Git + GitHub                                    |

Never suggest replacing any item in this stack.

---

## 6. WORKSPACE STRUCTURE

```
C:\Get4Domain\                          ← workspace root = platform repo
├── [platform repo files]               ← CLAUDE.md, WORKFLOW.md, GITHUB.md, etc.
│   engineering/industry-reference/    ← master knowledge base (never in client repos)
│   engineering/industry-reference/travel/ ← 7 complete files (travel reference)
│   engineering/industry-reference/{other}/ ← 7 placeholder files per industry
│
├── CLIENT_PROJECTS\
│   ├── TRAVEL\
│   │   ├── CLIENTS\
│   │   │   └── MR_TRAVELS_001\         ← independent repo
│   │   └── TEMPLATE\                   ← future (after MR_TRAVELS_001 complete)
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
├── TOOLS\
└── BACKUPS\
```

Client path pattern:
C:\Get4Domain\CLIENT_PROJECTS\{INDUSTRY}\CLIENTS\{CLIENT_ID}\

---

## 7. ENGINEERING PHASES

```
P000  Workspace Setup        Claude Code   One-time only
  ↓
P001  Project Init           Claude Code   Once per client
  ↓
P002  Frontend UI            Bolt          Parallel with P003
  ↕   [parallel]
P003  Backend + Database     Claude Code   Parallel with P002
  ↓
P004  Integration            Claude Code
  ↓
P005  Testing                Claude Code
  ↓
P006  Deployment             Claude Code   Only after payment
```

Before executing any phase:
1. Read all 6 session files (above)
2. Read the phase prompt: engineering/prompts/phases/P00X-*.md
3. If P003: read ALL files in the client's docs/ folder — skip none
4. Execute only the requested phase
5. Report completion — never auto-advance

---

## 8. ENGINEERING PACKAGE REQUIREMENT

Before P003 begins, ChatGPT must place these files in the client's docs/:

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

Claude Code reads ALL 20 files before writing a single line of code.

---

## 9. CODING STANDARDS

### TypeScript
- strict: true always
- No any — use unknown or proper interfaces
- Always type return values on public methods

### NestJS
- One module per feature — never combine
- Controllers: HTTP only — no business logic
- Services: business logic only — no HTTP concerns
- DTOs: class-validator on every field
- Every controller: @ApiTags() + @ApiOperation()
- Use @Public() to exempt routes from JWT guard
- Use @Roles() for role-based access

### API Response (all endpoints)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "timestamp": "2025-07-04T00:00:00.000Z"
}
```

### Database
- All IDs: String @id @default(uuid())
- Every model: createdAt, updatedAt, deletedAt (soft delete)
- Never hard delete records
- Always Prisma transactions for multi-table writes

---

## 10. NAMING CONVENTIONS

| Element      | Format           | Example               |
|--------------|------------------|-----------------------|
| Files        | kebab-case       | auth.service.ts       |
| Classes      | PascalCase       | AuthService           |
| Variables    | camelCase        | accessToken           |
| Constants    | UPPER_SNAKE_CASE | JWT_SECRET            |
| DTOs         | PascalCase+Dto   | CreateBookingDto      |
| Branches     | kebab-case       | feature/auth-module   |
| Commits      | conventional     | feat: add booking API |

---

## 11. NON-NEGOTIABLE RULES

Never do:
- Commit .env or secrets
- Push directly to main
- Create business modules without approved docs
- Skip build/lint before committing
- Use console.log in production (use Logger)
- Hardcode URLs or config values
- Auto-advance to next phase without instruction

Always do:
- Run npm run build — fix all errors before committing
- Run npm run lint — fix all errors before committing
- Add @ApiTags and @ApiOperation on every controller
- Use class-validator on every DTO
- Keep every module self-contained
- Update CURRENT_TASK.md and PROJECT_REGISTRY.json after phase completion

---

## 12. CURRENT STATE

P000: Complete
Active client: MR_TRAVELS_001
Current phase: Waiting for Engineering Package from ChatGPT
Next action: After Engineering Package received → execute P001
