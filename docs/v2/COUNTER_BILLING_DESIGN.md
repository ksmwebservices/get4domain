# Counter billing for Workspace — design (NOT built)

> Status: **design only**, written 2026-10-08 for KSM's decision. Nothing here is implemented. Until it ships, a shop sale is recorded with **Adjust stock → Shop sale** (see [STEPNROCK_HANDOVER.md](STEPNROCK_HANDOVER.md)).

## 1. What it is

A fast "bill the customer at the counter" screen for a Workspace shop: pick products from the **one catalogue** (My Products), choose how they paid, optionally attach a customer, issue a GST bill, print/share it — and the stock goes down by itself.

### Workspace vs BOS

| | **Workspace (this design)** | **BOS (later, not in this design)** |
|---|---|---|
| Stock | one location; stock moves only by bills, online orders and Adjust stock | several locations, transfers |
| Buying side | none (stock is added with Adjust stock → Return / Opening) | purchasing, suppliers, goods-received, purchase bills |
| Valuation | none | stock valuation, cost price, margin reports |
| Accounting | the bill is a GST **invoice** only | the bill also posts accounting entries (sales, tax, cash/bank), GSTR filing |
| Counter | cash / UPI / card / credit **recorded** | settlement, cash-drawer reconciliation, day-close |

## 2. The bill

| Part | Rule |
|---|---|
| Lines | products picked from VendorProduct (the one catalogue); quantity; price defaults to the catalogue price and may be changed on the line with a visible "edited" mark (owner/staff with products permission only) |
| Customer | **optional.** Walk-in bills have no customer; if a name/phone is given it is saved to Contacts so the sale shows in CRM |
| Payment mode | cash · UPI · card · **credit** (credit = not paid yet; creates an open balance on the customer, who is then required) |
| GST | per bill: **off**, **exclusive** (GST added on top) or **inclusive** (the price already contains GST). The vendor's GSTIN and the line GST rate come from tax settings (per product default, overridable on the line) |
| Issue | one button. Issuing is a single database transaction: number assigned → invoice saved → stock deducted → movements written |
| Share | PDF (existing invoice PDF renderer) and WhatsApp/SMS link through the existing senders |
| Daily summary | today's bills, total by payment mode, GST collected, items sold, credit given — one screen, plus a WhatsApp/e-mail copy to the owner on request |

## 3. Stock rules (the important part)

1. **Issuing a bill deducts stock through the same atomic function** as online orders: `StockService.reserve(tx, vendorId, lines, { type: 'BILL', id }, 'bill:<id>', 'SHOP_SALE', actor)` — the conditional `UPDATE … WHERE stockQty >= qty`, all lines or none, never negative, one `StockMovement` per line with `reason = SHOP_SALE`, `refType = 'BILL'`, `refId = <bill id>` and a correct `balanceAfter`, all in the bill's transaction. Nothing new to invent; one new call site.
2. **Not enough stock?** The bill is refused with the same "only N left" message as the website. A shop that really has the goods but a wrong count fixes the count first (Adjust stock → Recount) — we do not allow negative stock.
3. **Void** (same day, owner only, reason required): marks the bill VOID and calls `StockService.restore(...)` with reason `CANCEL`, `refType = 'BILL'` → a movement puts the units back, once (idempotent key `void:<bill id>`).
4. **Return / credit note** (later date, partial allowed): creates a linked credit note for the returned lines and restores those quantities with reason `RETURN`. The original bill is never edited.
5. **A bill made from an online order must NOT deduct a second time.** Online/order-request orders already reserved stock when they were placed (`refType = 'ORDER'`). When the shop turns an order into a bill ("Create bill from this order"):
   * the bill carries `orderId`; the stock call is **skipped** for every line that came from that order (the movement ledger already has `ORDER/<id>` for it);
   * any line added or increased on the bill beyond the order *is* deducted normally;
   * if the order is later cancelled, the order's restore runs; if the bill is voided, only the bill's own deductions are restored — implemented by linking through `refId`, with a unique `(refType, refId, productId)` check so the same units can never be taken twice;
   * a test makes this impossible to regress (see §7).
6. **Counter sale during an online order** (the last pair sold twice at the same time): both paths use the same conditional UPDATE, so exactly one wins and the other gets "only 0 left".

## 4. Data changes (additive migration)

Reuse `GenericInvoice` (today's GST invoice for vendors) where possible; it needs these gaps closed:

| Gap in today's `GenericInvoice` | Change |
|---|---|
| `contactId` is **required** | make it nullable (walk-in), or auto-attach a per-vendor "Walk-in customer" contact. Nullable is cleaner; one additive `ALTER … DROP NOT NULL` |
| one flat `gstRate` for the whole invoice, no GST mode | add `gstMode` (`NONE/EXCLUSIVE/INCLUSIVE`) and put the rate on each line in `items` (JSON already) — totals computed with the existing `commercial/pricing-math.ts` rules (integer paise, same rounding as Commerce invoices) instead of floats |
| `invoiceNumber` = `count + 1`, globally `@unique`, not safe under two simultaneous bills and not per financial year | a per-vendor, per-FY counter row incremented in the bill transaction (same pattern as the Commerce invoice numbers); keep the old numbers as they are |
| `status` only `PENDING/PAID` | add `ISSUED/PAID/CREDIT/VOID`, plus `paymentMode` (`CASH/UPI/CARD/CREDIT`), `paidAt`, `voidedAt`, `voidReason` |
| no link to an order or to stock | add `orderId` (nullable), `source` (`COUNTER/ORDER/MANUAL`) |
| no credit notes | new small table `g4d_credit_notes` (bill id, lines, reason, amount) |

No backfill; old invoices keep working unchanged. `StockMovement.refType` already accepts free text, so `BILL` needs no change.

## 5. Size, in plain terms

**M–L (about 5–8 working days with tests).** Screens: counter screen, bill list/detail, daily summary (M). Backend: bill create/void/return transactions, numbering, totals, credit notes (M). Risk work: order→bill linking and the double-deduct guard, GST modes, PDF changes (S–M). Can be split: **v1 = counter bill + void + daily summary** (M), **v2 = returns/credit notes and bill-from-order** (S–M).

## 6. Risks to the existing invoice code

| Risk | Why | Mitigation |
|---|---|---|
| Changing `GenericInvoice` breaks existing vendors' invoices and the Invoices screen | `contactId` is read as non-null in the list and PDF | additive nullable change; the list/PDF/`sendLink` paths get null-safe tests first |
| Money in floats | existing code uses `Float` and `Math.round(x*100)/100` | new bills compute in integer paise with the shared `pricing-math`; store paise alongside, convert for display |
| Duplicate invoice numbers | `count + 1` races | transactional counter; unique per (vendor, FY, number) |
| GST wrongly computed for "inclusive" | the old model only knows exclusive | test table: exclusive / inclusive / off × 0, 5, 12, 18 % × 1–3 lines, compared with a hand-computed reference |
| Double deduction (order + bill) | two code paths touch the same units | §3.5 plus a database-level uniqueness check and a ledger test |
| Slow counter on a busy shop | one transaction per bill with several row locks | bills lock only the products on them, in a fixed (sorted) order to avoid deadlocks |
| A staff member discounting silently | edited prices | edited-price mark on the bill and the daily summary; owner permission for discounts above a limit |

## 7. Test plan (must fail before it ships and pass after)

1. Issue a bill for 2 of 3 in stock → stock 1, one `SHOP_SALE` movement (`BILL/<id>`, `balanceAfter 1`), bill ISSUED, number assigned.
2. Two simultaneous bills of 2 against stock 3 → exactly one succeeds, stock 1 (on PGlite, like `verify-stock-pg.js`).
3. A bill with two lines where the second is short → nothing is saved, nothing deducted.
4. Same idempotency key twice → one bill.
5. Void → stock back once; voiding twice is refused; void of a PAID bill needs the owner's reason.
6. Return of 1 of 2 → credit note, stock +1 with reason `RETURN`; returning more than was sold is refused.
7. **Bill from an order**: order of 2 already reserved 2; billing it leaves stock unchanged; adding a third unit on the bill deducts exactly 1; cancelling the order afterwards does not restore units the bill sold; voiding the bill restores only the bill's own units. A property test runs random orders/bills/voids/cancels and checks `stock = opening + Σ movements ≥ 0` after every step.
8. GST table (§6) against hand-computed amounts; rounding on a 3-line inclusive bill.
9. Walk-in bill (no customer), credit bill (customer required), cash/UPI/card recorded; daily summary totals equal the sum of the day's bills by mode.
10. Permissions: owner and staff with the products permission only; other vendors' products cannot be billed; no data from another vendor appears in the summary.
11. Existing invoices still list, render to PDF and send a link after the migration.

## 8. Decisions needed from KSM

1. Is **credit sale** part of v1, or only cash/UPI/card?
2. GST: does Step N Rock charge GST at all today (the Commerce deal for Suresh is "no GST")? If not, GST **off** is the default and the GST modes can follow in v2.
3. Printing: A4 PDF only, or also a thermal-printer (58/80 mm) layout?
4. Who may change a line price or give a discount — owner only, or staff up to a limit?
