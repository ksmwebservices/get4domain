# Full BOS progress (resumable)

Dispatch: `GET4DOMAIN_DISPATCH_V2_FULL_BOS_09OCT2026.md` (repo root). Started 2026-10-09 from `9a482a4` (Release 1A, already on origin).

Resume rule: read this file, then the dispatch, then continue at the first slice not marked DONE. Everything below is DONE; the only thing left is KSM's VM steps ([DEPLOYMENT.md](DEPLOYMENT.md) section 8).

## Slices

| Slice | Status | Commit | Notes |
|---|---|---|---|
| S0 audit | DONE | `8ed7b9d` | `docs/v2/evidence/full-bos/AUDIT_2026-10-09.md` |
| S1 spine, migration, backfill | DONE | `7cb0e41` | migration `20261009180000_bos_spine`, GST engine, posting rules, services, tests (rule book 45, real Postgres) |
| S5 server side: admin split, seats, key validation, e-mail, reminders, low-stock message | DONE | `3ed64f4` | |
| S2-S4 screens | DONE | `1b36be4` | invoices, quotes, counter, stock, purchases, accounts, CA pack, collect payments, public invoice page |
| S6 bugs B1-B5, B7 + class audits | DONE | `f6500a1` | |
| S7 sweep + S8 guards | DONE | `290d53c` | `npm run bos:verify` |
| Docs, migration rehearsal, final push | DONE | see git log | |

## Decisions taken without asking KSM

1. Money is stored in integer paise; the vendor-side GST engine (`src/bos/gst.ts`) is separate from Get4Domain's own `commercial/pricing-math.ts`.
2. Reused tables instead of making second ones: Party = `Contact`, Item = `VendorProduct`, stock ledger = `StockMovement`, website order = `PosSale` type `web`.
3. Perpetual inventory: a sale posts cost of goods at the item's purchase price against Stock; manual stock adjustments post to the books at cost in the same transaction.
4. Website-order invoices use INCLUSIVE prices with no round-off (the customer pays exactly what the site showed) and never move stock a second time; one invoice per order.
5. A vendor with no billing term, or a lapsed or cancelled one, resolves as Essentials for gated views. Capture is never gated and nothing is deleted.
6. Admin exceptions are `VendorAddon` rows `cap:<capabilityId>`; plan limit and minimum-plan overrides are in `g4d_plan_overrides`, edited through `/admin/bos/capabilities` (reason required, audited).
7. No new npm packages: a small zip/xlsx writer lives in `src/bos/export/office.ts`.
8. Expense on credit is not exposed through the API yet (supplier bills go through Purchases).
9. Variants are tracked on movements (`variantKey`); the BLOCK check applies per variant only once that variant has history.
10. A credit note for a full quantity can differ from the invoice by one paisa when prices are tax-inclusive; it never exceeds the line.
11. The error filter returns `code`, `feature`, `requiredPlan` at the top level for `PLAN_REQUIRED` and `LIMIT_REACHED` only, and turns validation message lists into one plain sentence.
12. `bos-stock.service.ts` is a second writer of `stockQty` (variants, locations, BLOCK/WARN/ALLOW policy). The "every stock write has a movement" guard was extended to cover it.
13. Quote and order conversion accept `issue: true` for one click; otherwise they make a draft.
14. Edit bodies (DTO classes named Update/Patch/Edit) drop echoed read-only keys (id, vendorId, createdAt, updatedAt, deletedAt, createdBy, nameNormalized, openingBalancePaise, deliveredAt, lastBilledPeriod) when the DTO does not list them; every other unknown key is still refused. The forms also send only editable fields (`editable()`).
15. Staff seats: `bos.staff.seats` (Essentials 1, Pro 5, editable); people already added are never removed by a downgrade.
16. A vendor who already has campaigns keeps Campaigns open on any plan (signal `hasCampaigns`); Campaigns is otherwise a Pro screen. Decision for Allwin Tours: switch it to v2 after deploy.
17. The response wrapper no longer wraps HTML pages and file downloads in JSON (found while proving the shared invoice link).
18. The older Accounts page keeps its industry views and GST filing tracker as a tab; its totals now include BOS invoices and expenses (they used to be all zero).
19. The marketing pages still type prices (606 lines, guarded so the number can only fall); the vendor dashboard has none.
20. The UPI QR image is not drawn; the UPI ID and a tap-to-pay link are shown.

## Resume notes

- Local test harness: `backend-api/scripts/e2e/bos-harness.js` (PGlite + real Nest app). Needs `@electric-sql/pglite` under `%TEMP%\pgtest` (or `G4D_PGLITE_DIR`).
- Run everything: `npm run bos:verify -- --build` from the repo root.
- **Never run `backend-api/scripts/security-verify/run-all.js`**: its live-app steps boot the app against the database in `.env.local`. `run-offline.js` is the safe subset and is what `bos:verify` uses.
- Push: the permission check blocked `git push` in an earlier session; if blocked again, say so in the report and KSM pushes from PowerShell: `git push origin get4domain-site`.
