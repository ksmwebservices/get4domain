# V3 Wallet and Services: owner rules and data dictionary

Branch `v3-b4` (worktree `C:\Get4Domain\get4domain-b4`), from `origin/v3-b3` `d056f93`. Dispatch: `docs/v3/stages/V3_DISPATCH/STAGE_07_WALLET_SERVICES_BATCH_4.md`. Working log: `docs/v3/B4_LOG.md`. The reference for what was built (API contract, decisions, differences) is `docs/v3/V3_S7_BATCH4.md`, written at the end of the batch.

This file has two parts. Part 1 is the owner's rules, frozen on 4 November 2026, copied word for word from the dispatch. They are the specification: code, tests and texts follow them, and nothing in this file may weaken them. Part 2 is the data dictionary, filled in slice by slice as each migration lands.

---

## Part 1. OWNER RULES (frozen 4 November 2026)

1. Everything our team does for a vendor is a paid SERVICE, done only on request, charged to the vendor's wallet (or covered by a plan allowance or a prepaid pack). Self-service in the dashboard stays free within the plan. Vendors must be able to see what a service includes, who does it, how approval works and its price before they confirm.
2. The wallet is V3's own wallet and ledger. It does not read or write any legacy wallet table or constant (decision D1). It becomes ACTIVE for a vendor only after the vendor's first Pro plan term (quarterly, half-yearly or annual) is PAID. Free vendors have no wallet (locked preview). Vendors top up the wallet to buy add-on packs and services. The balance is kept when a plan expires; spending follows each service's plan-state rule (default: a service that needs Pro features can be bought only while Pro is ACTIVE or in grace; the balance is never deleted).
3. Money rules: integer paise end to end; append-only ledger; the balance never goes negative; no cash-out; NO refunds of any kind (plan, service and top-up money is never returned; a hold released on cancel or rejection, and a charge reversed after a system failure, are not refunds); unused credit expires one year after its top-up (consumed oldest first; an EXPIRY entry writes it off); credit pays services, packs, message sending and plan renewals; staff adjustments need a reason and SUPER_ADMIN. Get4Domain's own revenue only: this wallet never holds or moves a customer's payment for a vendor's goods or services.
4. THEME SWITCH SERVICE (the product term): one theme is included in the Pro subscription (the first Pro theme when a vendor upgrades from Free). A renewal does NOT give another free theme. Every later theme switch, at any time, is charged by the Theme Switch Service fee from the price book. The fee covers applying the chosen theme and migrating the vendor's content; it is a licence to use the theme while the vendor has the plan, not ownership of the theme. A vendor can switch themselves or ask our team (same fee; staff can also do it for the vendor, charging the wallet or marking it complimentary with a reason). Previewing a theme with the vendor's own content is free. If a plan expires and Pro returns, the stored theme is restored without a charge.
5. Prices: all prices come from the price book (admin-set, effective-dated, approved). The ONLY seeded price is a row for THEME_SWITCH of 29900 paise stated by the owner as the intended fee, seeded with status PROPOSED (never APPROVED by seed) so staff approve it. No other price is invented. No timeframes or prices in generated or seeded text.

---

## Part 2. Data dictionary

Filled in as each slice is built. Every table is additive, has row level security on (no policy: the backend role bypasses it, the same rule as every other public table), and carries its own migration folder.

(Slice sections are added below by the slice commits.)
