# Batch 13 run log (Stage 17 core run, Block 4a)

Worktree `C:\Get4Domain\get4domain-b13`, branch `v3-b13`, base `origin/v3-b11` at `f1403f2` (Stage 15 finish `7676aad` plus the staging fix). Not pushed.

## GATE CHECK (owner override 1)
`git fetch` ok. `origin/v3-b12` does not exist (Release 1 skips Stages 10, 11, 12, 14 and 16), so the run starts from `origin/v3-b11`. Its log `docs/v3/B11_LOG.md` shows the Stage 15 FINISH and the Stage 15 staging fix section (`f1403f2`); owner note: 53 of 53 integration suites green on staging. PASSED.

## Reconnaissance (facts found, decided against)
- `V2_INVENTORY.md` is not on this branch (it is on `v3-inv`); read from there. V3 code does not read V2 tables (stop-line 5), so the inventory is used only for what NOT to carry over.
- `g4d_customers` does not exist anywhere yet: this run creates it.
- Stage 9 already built the public order path: `paymentReadiness`, `priceCart`, coupons (`V3Offer`), stock reservations (`V3StockLevel`, `V3StockReservation`), order statuses, shipping and tracking JSON, refund-as-record, vendor invoices. Slice 5.24c extends it through the `Catalogue` port and does not rebuild it.
- The entitlement seed has no feature for CRM, accounts, jobs, appointments or the store, and no LIMITED allowance for invoices or stock for Free, so Amendment 06 point 2 needs no replacement; new keys are added additively with Free `LOCKED_PREVIEW`.
