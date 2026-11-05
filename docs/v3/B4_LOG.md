# B4 log: Wallet, services, service requests, theme switch (Stage 07)

Worktree `C:\Get4Domain\get4domain-b4`, branch `v3-b4`, from `origin/v3-b3` (`d056f93`). Dispatch: `docs/v3/stages/V3_DISPATCH/STAGE_07_WALLET_SERVICES_BATCH_4.md`. No push. No `.env.staging` in this worktree, so every staging step is written and marked NOT RUN. Dependencies installed with `npm ci` in `backend-api`.

## Gate check (5 November 2026)
`git fetch` ran. `origin/v3-b3` exists and equals the local `v3-b3` (`d056f93`). Its log carries the Batch 3 FINISH section of `docs/v3/B3_LOG.md` and the staging follow-up commits (`c0a1022`, `f98bb96`, `d056f93`). The owner's note of 5 November 2026 states: Batch 3 verified on staging by the owner and pushed as `v3-b3`; 7 migrations and both seeds applied; drift shows only the 2 allowed items; RLS-off 0; full `test:int` 34 of 34 suites and 373 of 373 tests; cleanup count 0. The gate is satisfied.

The same note answers the open questions: Free loses the 20 AI credits and the basic reports (accepted); a suspended vendor's sign-in stays blocked while the site stays listed as a Free listing-only site; the tax rate per item goes to Batch 13; the directory SUSPENDED fix and the set-password claim guard are the first tasks of Batch 4b (Stage 8). Neither of those two is part of this batch.

Branch note: the new branch was created from `origin/v3-b3` and its upstream was removed (`git branch --unset-upstream`) so a bare `git push` can never write to `v3-b3`.

## Baseline (before any change)
(filled in below)
