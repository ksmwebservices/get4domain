# DISPATCH STATUS A2 (backend lane, Wave 4)

Branch v3-w4, worktree C:\Get4Domain\get4domain-w4. Baseline before W0: v3-w3 (276 suites, 5355 tests at its last gate).

| Job | Part | Status | Commit | Tests | Note |
|---|---|---|---|---|---|
| W0 | investigate | DONE | (this commit) | n/a | docs\v3\V3_WAVE4_BACKEND.md section 0 |
| W1 | directory host | DONE | (this commit) | seo-pages + wave4-directory-host 63 pass, build ok | page-model, backlink block, page service use the directory host when DIRECTORY_PUBLIC_BASE_URL is set |
| W2 | held payments | DONE | (this commit) | 278 suites, 5398 tests pass (after oracle 411->414); build ok | 3 routes under /v3/admin/billing/held-payments, ADMIN+SUPER_ADMIN; REVIEW->FAILED edge added |
| W3 | retire discount routes | DONE | (this commit) | 278 suites pass (one spec fixed), build ok | 4 routes, service methods, DTOs, validator, matrix and baseline lines, repo.discountRules() removed; tables, migrations and seed untouched |
| W4 | commission adjustment | DONE | (this commit) | 279 suites, 5413 tests pass; build, verify:migrations, verify:raw-sql ok | NEW MIGRATION 20261230100000_v3_wave4_commission_adjustment (NOT applied) |
| W5 | partner state | DONE | (this commit) | 280 suites, 5423 tests pass; build ok | address state first, then the STATE above the place; cleaned, capped at 60, null when unknown |
| W6 | tests and docs | TODO | | | |

## ASSUMPTIONS

1. HOSTNAMES_PLAN.md is read from C:\Get4Domain\get4domain-pub\docs\v3 (it exists there; Wave 3 could not find it). The dispatch says the switch is DIRECTORY_PUBLIC_BASE_URL, so the plan's `directoryOrigin` plan setting is NOT added: the env value is the one switch (unset = old behaviour).

2. Merge of v3-w3 (a2d1b7e, 1200c6d) into v3-w4 was clean: no conflicts (it touched settlement.service.ts and test support files only).
3. W1 test regex: the badge image path /v3/directory/badge is an API asset route, so the "no /directory prefix" check ignores a /v3 prefix.
4. W2: REJECT stores the note in the order `reason` and the admin name/day in `settledByName`/`settledOn` (no migration). A FAILED order with a gateway payment id means "rejected held payment". The vendor mail on REJECT is best effort through the mail port and its outcome (PENDING/SENT/FAILED/NO_ADDRESS) is returned, not stored in an outbox (the outbox is keyed by invoice). ACCEPT runs through settle() with via CONFIRM, so the invoice shows the gateway payment id.
5. W3: the memory test repository keeps an INERT `discounts` array so the existing tests can still plant a rule and prove it changes no amount. The seed applier still seeds the table (dispatch: tables and seed untouched).
6. W4: an ADJUSTMENT is created ACCRUED with its negative amount already set, month = month of the reversal (the display month). At a close it is netted (oldest first, only while the partner is left with MORE than nothing; the first that does not fit and every later one wait) and moves to the closing month so that month's payout holds it. Adjustments are judged against the commission of the closing month, the ones already netted in it, and are skipped for a partner that already has a payout for that month (they wait for the next close). Net exactly zero is treated as "nothing to pay", so the adjustment is carried. A PAID line stays PAID (the payout record is history) and is flagged.
7. W4 migration changes the ledger unique rule from vendorId to (vendorId, kind) and the amount check (negative allowed for ADJUSTMENT only). Existing rows become kind COMMISSION.

## QUESTIONS FOR THE OWNER

(none yet)
