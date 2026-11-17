# DISPATCH STATUS A2 (backend lane, Wave 4)

Branch v3-w4, worktree C:\Get4Domain\get4domain-w4. Baseline before W0: v3-w3 (276 suites, 5355 tests at its last gate).

| Job | Part | Status | Commit | Tests | Note |
|---|---|---|---|---|---|
| W0 | investigate | DONE | (this commit) | n/a | docs\v3\V3_WAVE4_BACKEND.md section 0 |
| W1 | directory host | TODO | | | |
| W2 | held payments | TODO | | | |
| W3 | retire discount routes | TODO | | | |
| W4 | commission adjustment | TODO | | | |
| W5 | partner state | TODO | | | |
| W6 | tests and docs | TODO | | | |

## ASSUMPTIONS

1. HOSTNAMES_PLAN.md is read from C:\Get4Domain\get4domain-pub\docs\v3 (it exists there; Wave 3 could not find it). The dispatch says the switch is DIRECTORY_PUBLIC_BASE_URL, so the plan's `directoryOrigin` plan setting is NOT added: the env value is the one switch (unset = old behaviour).

## QUESTIONS FOR THE OWNER

(none yet)
