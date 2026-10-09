# LeadSpace progress (resumable)

Dispatch: `GET4DOMAIN_DISPATCH_V2_LEADSPACE_10OCT2026.md` (repo root). Started 2026-10-10 from `8403c80`. Resume rule: read this file, then the dispatch, continue at the first phase not DONE. Dispatch A's shared services did **not** exist, so they are built here to the interfaces in Dispatch A section 6 (social publisher service, WhatsApp provider abstraction with sandbox).

## Phases

| Phase | Status | Commit | Notes |
|---|---|---|---|
| 0 audit | DONE | (this commit) | `docs/v2/evidence/leadspace/AUDIT.md` |
| 1 data model | NOT STARTED | | |
| 2 landing pages | NOT STARTED | | |
| 3 capture engine, common WhatsApp, wallet rules | NOT STARTED | | |
| 4 vendor mobile dashboard | NOT STARTED | | |
| 5 wallet refill and invoice | NOT STARTED | | |
| 6 admin: prices, approval, promotion scheduler | NOT STARTED | | |
| 7 merge Campaigns into LeadSpace | NOT STARTED | | |
| 8 pilot readiness and guards | NOT STARTED | | |

## Decisions taken without asking KSM

1. The LEADS purse is a new pair of tables (purse + ledger with running balance and idempotency keys); the AI purse stays the existing `Wallet` untouched, so AI credit behaviour cannot change.
2. LeadSpace pages are served at `/ls/<slug>`; the `<slug>.<base domain>` host rewrite is added behind the environment switch `LEADSPACE_BASE_DOMAIN` (off by default, so no existing site changes). Turning it on needs DNS/nginx work by KSM.

## Resume notes

- Run everything: `npm run bos:verify -- --build` from the repo root. Never run `security-verify/run-all.js` (it boots the app against the database in `.env.local`).
- Shell edits strip backslashes, backticks and `$`: write files with the Write/Edit tools; re-read any `.sql` file or file with `$$` after editing.
- Push: if blocked by the permission check, say so; KSM runs `git push origin get4domain-site`.
