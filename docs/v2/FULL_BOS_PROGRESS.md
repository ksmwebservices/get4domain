# Full BOS progress (resumable)

Dispatch: `GET4DOMAIN_DISPATCH_V2_FULL_BOS_09OCT2026.md` (repo root). Started 2026-10-09 from `9a482a4` (Release 1A, already on origin).

Resume rule: read this file, then the dispatch, then continue at the first slice not marked DONE.

## Slices

| Slice | Status | Commit | Notes |
|---|---|---|---|
| S0 audit | DONE | `8ed7b9d` | `docs/v2/evidence/full-bos/AUDIT_2026-10-09.md` |
| S1 spine (+ the server side of S2 to S5) | DONE | see git log (`feat(bos): S1`) | Schema + migration `20261009180000_bos_spine`, GST engine, posting rules, documents, payments, counter, stock ledger, purchases, expenses, books, exports, entitlements, order bridge, backfill script. Tests: `scripts/bos/verify-bos-pure.js` (45), `scripts/bos/verify-bos-pg.js` (53, real Postgres) |
| S2 sell and bill: dashboard screens | NOT STARTED | | server done in S1; screens, Payments (own gateway keys), old "Invoices" retirement and redirect still to do |
| S3 stock and purchases: dashboard screens | NOT STARTED | | server done in S1 |
| S4 accounts and CA pack: dashboard screens | NOT STARTED | | server done in S1 |
| S5 entitlements: admin editing, staff seat limit, UI Locked cards | NOT STARTED | | resolver, guard, PLAN_REQUIRED and the upgrade/downgrade test done in S1 |
| S6 bugs B1/B3/B4/B7 + class audits | NOT STARTED | | |
| S7 sweep + backlog | NOT STARTED | | |
| S8 guards, docs, push | NOT STARTED | | |

## Decisions taken without asking KSM

1. Money is stored in integer paise; the vendor-side GST engine (`src/bos/gst.ts`) is separate from Get4Domain's own `commercial/pricing-math.ts`.
2. Reused tables instead of making second ones: Party = `Contact`, Item = `VendorProduct`, stock ledger = `StockMovement`, website order = `PosSale` type `web`.
3. Perpetual inventory: a sale posts cost of goods at the item's purchase price against Stock; manual stock adjustments post to the books at cost in the same transaction (a listener on `StockService`).
4. Website-order invoices use INCLUSIVE prices with no round-off (the customer pays exactly what the site showed) and never move stock a second time; one invoice per order (unique source key).
5. A vendor with no billing term, or a lapsed/cancelled one, resolves as Essentials for gated views. Capture is never gated and nothing is deleted.
6. Admin exceptions are stored as `VendorAddon` rows `cap:<capabilityId>`; plan limit/minimum-plan overrides in `g4d_plan_overrides` (edited through the existing Plan access screen).
7. No new npm packages: a small zip/xlsx writer lives in `src/bos/export/office.ts`.
8. Expense payment on credit is not exposed through the API yet (supplier bills go through Purchases).
9. Variants are tracked on movements (`variantKey`); the BLOCK check applies per variant only once that variant has history.
10. A credit note for a full quantity can differ from the invoice by one paisa when prices are tax-inclusive (half-up rounding); the credit note never exceeds the line.
11. The error filter now also returns `code`, `feature` and `requiredPlan` at the top level for `PLAN_REQUIRED` only (nothing else changes shape).
12. `bos-stock.service.ts` is a second writer of `stockQty` (needed for variants, locations and the BLOCK/WARN/ALLOW policy). The existing "every stock write has a movement" guard was extended to cover it.
13. Quote/order conversion accepts `issue: true` for one click; otherwise it makes a draft.

## Resume notes

- Local test harness: `backend-api/scripts/e2e/bos-harness.js` (PGlite + real Nest app). Needs `node_modules` for `@electric-sql/pglite` under `%TEMP%\pgtest` (or `G4D_PGLITE_DIR`).
- Run everything: `cd backend-api && npx nest build && node scripts/commercial-verify/run-all.js`.
- Push: the permission check blocked `git push` in an earlier session; if blocked again, say so in the report and KSM pushes from PowerShell.
