# EP01 — Engineering Package Generation
# Get4Domain Engineering Standard v1.1
# Phase: EP01 | Owner: Claude Code | Frequency: Once per client project
# Gate: P001 complete → Gate to exit: ChatGPT architecture/solution/quality review + final approval

---

## YOUR ROLE IN THIS PHASE

Generate the complete 20-document Engineering Package for the client into
its `docs/` folder, fully cross-referenced, with zero placeholder content.
This package is what ChatGPT reviews and approves before P002 (Bolt) and
P003 (Claude Code) are allowed to start. No source code, no UI, no backend
implementation happens in this phase.

---

## READ FIRST (in order)

1. `CLAUDE.md`, `WORKFLOW.md`, `GITHUB.md`, `CURRENT_TASK.md`,
   `PROJECT_REGISTRY.json`, `REPOSITORY_RULES.md` (platform session files, repo root)
2. `engineering/industry-reference/{industry}/` — all 7 files (`OVERVIEW.md`,
   `MODULES.md`, `DB_GUIDE.md`, `API_GUIDE.md`, `UI_GUIDE.md`,
   `IMPLEMENTATION_NOTES.md`, `MODULE_CHECKLIST.md`) for the client's industry.
   This is background/reference only — it does not fix the client's final
   module list or scope, which is decided fresh for each engagement.
3. The client's P001 completion report (confirms scaffold is in place).
4. Any client-specific business input already gathered (proposal, SOW,
   client interview notes) — wherever ChatGPT has placed it for this project.
5. This file — then execute.

---

## SCOPE

Generate all 20 documents listed in `WORKFLOW.md` §Engineering Package and
`REPOSITORY_RULES.md` Rule 6, into `{client-repo}/docs/`:

```
00_ENGINEERING_INDEX.md        (master index — write first, it defines the
                                 shared vocabulary every other document uses)
01_PROJECT_BRIEF.md            11_UI_SPECIFICATION.md
02_BUSINESS_REQUIREMENTS.md    12_SECURITY_SPECIFICATION.md
03_PRD.md                      13_DEPLOYMENT_SPECIFICATION.md
04_FUNCTIONAL_SPECIFICATION.md 14_TEST_PLAN.md
05_SCOPE.md                    15_ACCEPTANCE_CRITERIA.md
06_USER_ROLES.md               16_PROJECT_TASKS.md
07_MODULE_SPECIFICATION.md     17_RELEASE_PLAN.md
08_BUSINESS_WORKFLOW.md        18_CHANGE_REQUEST_POLICY.md
09_DATABASE_DESIGN.md          19_PAYMENT_WORKFLOW.md
10_API_SPECIFICATION.md        20_CURRENT_TASK.md
```

Also generate the client-level phase prompts consumed by P002–P006, placed
in the client repo at `engineering/prompts/`:

```
P002_BOLT_UI.md
P003_BACKEND.md
P004_INTEGRATION.md
P005_TESTING.md
P006_DEPLOYMENT.md
```

These are client-specific instantiations of the phase (naming: underscored,
to distinguish them from the platform's generic hyphenated phase templates
in `engineering/prompts/phases/`) — they point at this project's own `docs/`
files by exact filename, not at generic placeholders.

---

## RULES FOR THIS PHASE (non-negotiable)

1. **Skip no document.** All 20 files must exist before this phase reports
   complete (`REPOSITORY_RULES.md` Rule 6).
2. **No placeholder content.** Every section must be concrete and
   project-specific — no "TBD," "Lorem ipsum," or stub sections.
3. **Cross-reference discipline.** Establish ID schemes in `00` (module
   codes) and `02`/`04`/`15` (BR/FR/AC), then use them identically in every
   downstream document. A functional requirement (FR) traces to exactly one
   business requirement (BR) and one module (MOD); every module has a
   database footprint, an API section, and (if user-facing) a UI section
   (`00_ENGINEERING_INDEX.md` §6 Cross-Reference Rules — write this section
   first, since every other document depends on it).
4. **No UI design decisions belong here beyond a screen/route inventory**
   (`11_UI_SPECIFICATION.md` lists screens and data sources; it does not
   dictate pixel-level layout — that is Bolt's job in P002).
5. **No code.** This phase produces documentation only.
6. **Technology stack is fixed** — Next.js/NestJS/Prisma/PostgreSQL/JWT+RBAC
   (`CLAUDE.md` §5) — do not propose alternatives anywhere in the package.
7. **Do not duplicate the industry reference** into the client repo
   (`REPOSITORY_RULES.md` Rule 3) — reference it by path in `01_PROJECT_BRIEF.md`
   or `00_ENGINEERING_INDEX.md` if useful context, never copy its files.

---

## TASKS

1. Draft `00_ENGINEERING_INDEX.md` first: module registry, role registry,
   naming/identifier conventions, cross-reference rules, assumptions,
   dependencies, and an approval tracker. Every later document points back
   to this file for shared vocabulary.
2. Draft `01`–`08` (brief, business requirements, PRD, functional spec,
   scope, roles, module spec, business workflow) — the "what and why" layer.
3. Draft `09`–`13` (database design, API spec, UI spec, security spec,
   deployment spec) — the "how it is built" layer, each derived from the
   requirements layer, never introducing a requirement that wasn't
   established in `01`–`08`.
4. Draft `14`–`19` (test plan, acceptance criteria, project tasks, release
   plan, change request policy, payment workflow) — the "how it is verified
   and delivered" layer.
5. Draft `20_CURRENT_TASK.md` last, reflecting the actual state of this
   package's generation and the pending ChatGPT review gate.
6. Generate the 5 client-level phase prompts (`P002_BOLT_UI.md` ..
   `P006_DEPLOYMENT.md`) referencing the finished `docs/` files by name.
7. Self-review: walk every cross-reference (BR→FR→MOD→API→UI→Test→AC) once
   end-to-end before declaring the phase complete — this is the same check
   ChatGPT will perform during review; catching a break here saves a review
   round-trip.
8. Update `docs/20_CURRENT_TASK.md`, plus the platform's `CURRENT_TASK.md`
   and `PROJECT_REGISTRY.json`, to show EP01 complete (generation) and
   pending ChatGPT review.

---

## DELIVERABLES

```
Phase: EP01
Status: Complete (generation)

1. What was done: [document-by-document summary]
2. Documents created: 20/20 in docs/, listed
3. Phase prompts created: 5/5 in engineering/prompts/, listed
4. Cross-reference self-check: PASS/FAIL [any gaps found and fixed]
5. Placeholder content check: PASS (none found)
6. Issues resolved: [list]
7. Pending items: [list]
8. Ready for: ChatGPT architecture/solution/quality review and final approval
```

---

## STOP CONDITIONS

- Do not start P002 or P003 in this phase, even if the package looks complete.
- Do not implement any business module, screen, or API endpoint.
- Do not duplicate `engineering/industry-reference/{industry}/` content into
  the client repo.
- Do not proceed past this phase without ChatGPT's explicit final approval,
  per `WORKFLOW.md` Phase Gate Process.
