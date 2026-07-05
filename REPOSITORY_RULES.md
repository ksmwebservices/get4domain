# REPOSITORY_RULES.md — Get4Domain Repository Rules
# Get4Domain Engineering Standard v1.0
# Read at the start of every session.

---

## Rule 1 — Platform Repository is Sacred

Repository: github.com/ksmwebservices/get4domain

This repository ONLY contains:
- Engineering standards and coding rules
- Phase prompt library (P000–P006)
- Workflow documentation
- Industry reference documentation
- Business documentation
- Future Get4Domain customer portal
- Future Get4Domain admin portal
- Shared engineering assets

This repository NEVER contains:
- Client application source code
- Client database schemas
- Client business logic
- Client-specific configuration
- Any deliverable that belongs to a client

---

## Rule 2 — Every Client is Independent

Every client project MUST be:
- A completely separate Git repository
- A completely separate database
- A completely separate deployment
- A completely separate subdomain

Client repos live at:
  github.com/ksmwebservices/{client-repo-name}

Client repos are cloned locally to:
  C:\Get4Domain\CLIENT_PROJECTS\{INDUSTRY}\CLIENTS\{CLIENT_ID}\

---

## Rule 3 — Industry Reference Lives Here

Industry knowledge base lives in THIS repo only:
  engineering/industry-reference/{industry}/

Structure per industry:
  OVERVIEW.md
  MODULES.md
  DB_GUIDE.md
  API_GUIDE.md
  UI_GUIDE.md
  IMPLEMENTATION_NOTES.md
  MODULE_CHECKLIST.md

This is NEVER duplicated inside client repositories.
Client repos reference it — they do not copy it.

---

## Rule 4 — Template Separation

MR_TRAVELS_001 is the first travel implementation.
It is NOT a template.

After MR_TRAVELS_001 is complete and delivered:
- Reusable parts are extracted
- A Travel Template is created at:
  C:\Get4Domain\CLIENT_PROJECTS\TRAVEL\TEMPLATE\

Until then: no template code exists.

---

## Rule 5 — Responsibilities Are Fixed

| Role        | Tool        | Responsibilities                                    |
|-------------|-------------|-----------------------------------------------------|
| Architect   | ChatGPT     | BRD, PRD, Functional Spec, DB Design, API Design,   |
|             |             | Module Spec, UI Spec, Architecture, Prompt generation|
| UI Builder  | Bolt        | Frontend UI, responsive layouts, components,        |
|             |             | public website, admin dashboard                     |
| Engineer    | Claude Code | Project init, backend, database, APIs,              |
|             |             | integration, testing, deployment                    |

Claude Code NEVER:
- Generates business requirements
- Generates PRD or Functional Specification
- Invents business logic not in approved docs
- Designs UI screens

Claude Code ONLY implements approved engineering documents.

---

## Rule 6 — Engineering Package Required

Before any implementation phase begins, ChatGPT must provide
the complete Engineering Package into the client's docs/ folder:

  01_PROJECT_BRIEF.md
  02_BUSINESS_REQUIREMENTS.md
  03_PRD.md
  04_FUNCTIONAL_SPECIFICATION.md
  05_SCOPE.md
  06_USER_ROLES.md
  07_MODULE_SPECIFICATION.md
  08_BUSINESS_WORKFLOW.md
  09_DATABASE_DESIGN.md
  10_API_SPECIFICATION.md
  11_UI_SPECIFICATION.md
  12_SECURITY_SPECIFICATION.md
  13_DEPLOYMENT_SPECIFICATION.md
  14_TEST_PLAN.md
  15_ACCEPTANCE_CRITERIA.md
  16_PROJECT_TASKS.md
  17_RELEASE_PLAN.md
  18_CHANGE_REQUEST_POLICY.md
  19_PAYMENT_WORKFLOW.md
  20_CURRENT_TASK.md

Claude Code reads ALL documents before implementation.
Claude Code skips NO document.

---

## Rule 7 — Phase Gate

No phase starts without explicit instruction.

```
ChatGPT generates Engineering Package
         ↓
Claude Code reads all docs/
         ↓
ChatGPT issues phase prompt
         ↓
Claude Code executes that phase only
         ↓
Claude Code reports completion to ChatGPT
         ↓
ChatGPT reviews and issues next phase prompt
```

Claude Code never auto-advances to the next phase.

---

## Rule 8 — No Production Without Payment

Development server: after P005 testing passes
Production deployment: ONLY after:
  - Client written approval received
  - Final 50% payment confirmed
  - Get4Domain admin authorizes P006

---

## Rule 9 — Source Code Policy

Clients purchase: software implementation + managed hosting
Clients do NOT receive: source code, internal framework, reusable modules

Source code delivery requires a separate written contract and fee.

---

## Rule 10 — Git Discipline

- Never commit to main directly
- Never commit .env or secrets
- Never force push
- Always run build + lint before committing
- Every commit follows conventional commit format
- One feature per branch
