# Full BOS progress (resumable)

Dispatch: `GET4DOMAIN_DISPATCH_V2_FULL_BOS_09OCT2026.md` (repo root). Started 2026-10-09 from `9a482a4` (Release 1A, already on origin).

Resume rule: read this file, then the dispatch, then continue at the first slice not marked DONE.

## Slices

| Slice | Status | Commit | Notes |
|---|---|---|---|
| S0 audit | IN PROGRESS | | `docs/v2/evidence/full-bos/AUDIT_2026-10-09.md` |
| S1 spine | NOT STARTED | | |
| S2 sell and bill | NOT STARTED | | |
| S3 stock and purchases | NOT STARTED | | |
| S4 accounts and CA pack | NOT STARTED | | |
| S5 entitlements + upgrade/downgrade test | NOT STARTED | | |
| S6 bugs B1/B3/B4/B7 + class audits | NOT STARTED | | |
| S7 sweep + backlog | NOT STARTED | | |
| S8 guards, docs, push | NOT STARTED | | |

## Decisions taken without asking KSM

(appended as they are made)

## Resume notes

- Local test harness: `backend-api/scripts/e2e/bos-harness.js` (PGlite + real Nest app). Needs `node_modules` for `@electric-sql/pglite` under `%TEMP%\pgtest` (or `G4D_PGLITE_DIR`).
- Push: the permission check blocked `git push` in an earlier session; if blocked again, say so in the report and KSM pushes from PowerShell.
