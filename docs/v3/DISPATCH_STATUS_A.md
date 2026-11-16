# DISPATCH STATUS A (backend lane, Wave 3)

Branch v3-w3, worktree C:\Get4Domain\get4domain-w2. Baseline before J0: build passes, test:ci 265 suites, 5011 tests passing.

| Job | Part | Status | Commit | Tests | Note |
|---|---|---|---|---|---|
| J0 | Section 0 | DONE | 192a67e | n/a | docs\v3\V3_WAVE3_BACKEND.md written |
| J1 | A roles and partners | DONE | 889b56a | build ok; test:ci 266 suites, 5033 tests | labels fold into SALES in the principal; partner login = admin-team row with role REFERRAL_PARTNER, principal role PARTNER, global PartnerScopeGuard; migration 20261220100000 (not applied) |
| J2 | B public pricing | TODO | | | |
| J3 | C checkout and gateways | TODO | | | |
| J4 | D auto invoice | TODO | | | |
| J5 | E cash by admin | TODO | | | |
| J6 | F no discounts guard | TODO | | | |
| J7 | G trial and team live | TODO | | | |
| J8 | H themes | TODO | | | |
| J9 | I referrals and commission | TODO | | | |
| J10 | J small items | TODO | | | |
| J11 | K tests, docs, contract | TODO | | | |

## ASSUMPTIONS

1. The price book stores a total per term (3, 6, 12 months), so no "monthly x months" fallback was needed.
2. The existing plan-billing module is extended rather than duplicated (one contract per concept).
3. The labels FIELD_EXECUTIVE and TELECALLER are normalised to SALES (the MARKETING value) in `staffRoleOf`, so they hold exactly SALES rights by construction.

## QUESTIONS FOR THE OWNER

1. GST rate: read from the tax-rate table (data); the owner confirms the value.
2. Should OPERATIONS be allowed to confirm cash (today ADMIN and SUPER_ADMIN only)?
3. Commission on a reversed payment: line marked REVERSED and flagged; is a clawback from the next payout wanted?
4. Partner payout details (bank or UPI) are recorded by staff as a reference only.
