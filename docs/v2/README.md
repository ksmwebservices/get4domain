# Get4Domain V2 — audit baseline documents (2026-10-02)

Produced by the PRD §94 audit (audit-and-documentation only; PRD §99). Authoritative requirements: [`../reference/GET4DOMAIN_V2_PRD.md`](../reference/GET4DOMAIN_V2_PRD.md).

**Start here:** [AUDIT_REPORT.md](AUDIT_REPORT.md) — the evidence-based answer to "is the application 100% functional against the PRD?" (No), the critical findings, and the 26 required items.

| Document | PRD § | Contents |
|---|---|---|
| [AUDIT_REPORT.md](AUDIT_REPORT.md) | 94 | Verdict, scorecard, critical findings S1–S15, conflicts, 26 required items |
| [STATUS.md](STATUS.md) | 93 | Current reality: git, migrations, shipped surface, open defects, decisions |
| [FEATURE_MATRIX.md](FEATURE_MATRIX.md) | 92.1 | Master Feature Matrix (BOS, Growth/Social, Client WebApp) + 362-row tally |
| [UI_ACTION_MATRIX.md](UI_ACTION_MATRIX.md) | 92.2 | Dashboard/UI Action Matrix (84 + 52 rows), page data-source classification, orphan UI |
| [INTEGRATIONS.md](INTEGRATIONS.md) | 92.3, 89 | Integration matrix, env-var inventory, §89 compliance |
| [INDUSTRY_MATRIX.md](INDUSTRY_MATRIX.md) | 92.4 | 32 PRD industries, registry, backend modules |
| [COMMUNICATION_MATRIX.md](COMMUNICATION_MATRIX.md) | 92.5 | Channel/use-case matrix + WhatsApp/SMS/Email/automation findings |
| [TEST_PLAN.md](TEST_PLAN.md) | 92.6 | Test Matrix (coverage 0%), strategy, first suites |
| [PERMISSIONS.md](PERMISSIONS.md) | 93 | Principals/roles, auth findings, tenancy/IDOR audit |
| [ROADMAP.md](ROADMAP.md), [RELEASE_PLAN.md](RELEASE_PLAN.md), [TASKS.md](TASKS.md) | 90, 91, 93 | Release sequence, §91 schedule table, ordered backlog |
| [CHECKLIST.md](CHECKLIST.md) | 62, 63AE, 96, 98 | Definition-of-done tracking |
| [MIGRATION_PLAN.md](MIGRATION_PLAN.md), [DEPLOYMENT.md](DEPLOYMENT.md) | 93 | DB state/baseline plan; deployment state and hazards |
| [PRD.md](PRD.md) | 93 | Pointer to the authoritative PRD + decision log |
| [evidence/](evidence/) | — | Six raw static-audit findings files (comms, growth, bos, industry, frontend, platform) |

Note on the pre-existing `docs/PRD.md` and `docs/AUDIT_REPORT.md`: both predate V2. `docs/PRD.md` is marked superseded; `docs/AUDIT_REPORT.md` (Aug 2026) was left untouched as history. The V2 documents live here, in `docs/v2/`, so nothing historical was overwritten.
