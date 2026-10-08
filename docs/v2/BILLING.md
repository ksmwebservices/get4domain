# BILLING — how Get4Domain bills (policy summary for staff)

> Plain-language rules for the people running the platform. Mechanics, state machines and security are in [COMMERCIAL_ENGINE.md](COMMERCIAL_ENGINE.md). Public pricing is unchanged: **annual-only** Workspace ₹11,988 / BOS ₹23,988 + 18 % GST. Everything below about custom cycles and discounts is an **admin-only** override.

## 1. What can be sold
| Product | How it is billed |
|---|---|
| DomainApp **Workspace** / **BOS** | a *term*: monthly, half-yearly, annual, or custom months (1–60). List price = annual price ÷ 12 × months |
| DomainCampaign | add-on line on an invoice (fee by ad-budget bracket, entered by you) |
| Managed Services | custom lines on an invoice (priced per project) |

A vendor's **plan** (Workspace or BOS) is what decides their features — *never* the price they paid. A BOS vendor on a ₹1 deal still gets everything BOS includes.

> **Who can open Commerce:** Super Admin and Operations. Marketing staff do not see it and the server refuses them (403) on every Commerce endpoint.

## 2. Creating a deal (Admin → Commerce → Deal builder)
1. Choose an existing vendor, or a **new prospect** (name, business, email, optional demo subdomain). A prospect's demo site stays hidden from the public until their activation invoice is paid.
2. Choose plan + cycle (+ add-ons / custom lines).
3. Optional discount — percent, flat, or a promo code. **A reason is always required. Over 20 % you must type CONFIRM.** Every discount is logged.
4. GST: *on top (18 %)*, *included in the price*, or *none*. GST is always worked out on the amount **after** the discount.
5. Choose which payment methods this invoice allows: Razorpay, UPI QR, bank transfer. Set grace days and how long the link stays valid.
6. **Create invoice + link** (they pay, then the plan activates) or **Activate now, payment due in N days** (everything is switched on immediately; they have N days to pay, then the grace days).
7. The pay link is shown **once**. Need it again? Open the invoice → **Copy link** (this issues a fresh link and the old one stops working).

## 3. When a customer pays
- **Razorpay:** automatic. The invoice flips to Paid only after Razorpay itself confirms the money.
- **UPI QR / bank transfer:** the customer taps "I have paid" and gives the UTR. It lands in **Payments to confirm** (a badge shows how many are waiting). **Check the UTR and the amount against your bank statement**, then enter the amount you **actually received**:
  - exact → Paid, plan activates/renews;
  - less → *Part paid* — the balance stays due and the QR now asks for the remaining amount only;
  - more → Paid, the extra is recorded as an overpayment (adjusted on their next invoice — there are **no automatic refunds**).
  A UTR can be used only once. If someone reuses one, it is rejected and flagged to you. You can reject any payment with a reason; the customer is told.

## 4. Renewals, reminders, lapse
- **15 days before** the term ends an invoice is created and sent. Reminders go at **15, 7 and 1 day before**, and when overdue.
- Paying **early never loses days** — the new term starts when the old one ends.
- A negotiated deal renews at its negotiated price. A plan/cycle change a customer has been approved for renews at **the price KSM approved** (see §5): list price unless you lowered it.
- If the term ends and the **grace days** pass unpaid, the account is **lapsed**: no publishing, no outbound messages, no AI Studio spending. **Nothing is deleted** — the customer can still log in and see everything, and paying lifts the lapse immediately.

## 5. Changing a plan
- The customer sends a request from their Billing page; it appears in **Plan changes**.
- **Downgrades** only ever take effect at renewal.
- When you approve, the **net price** box starts at the plan's list price. You may lower it (never raise it) — a reason is required, and over 20% off you must type CONFIRM. The override is logged. The next renewal bills that same price. If the credit is bigger than the price, the invoice is ₹0 and the change goes live straight away.
- **Upgrades** can start now: the new plan is charged at the approved price (list unless changed), minus a credit for the **unused days** of the current term (unused days × the daily net rate). The credit only reduces the new invoice; it is never paid out in cash.
- While a customer is on a negotiated deal they do not see a self-serve upgrade button — they see **Contact us**.

## 6. Promo codes
Admin → Commerce → Promo codes. Rules are checked on the server every time: dates, plan, cycle, minimum term, total and per-customer limits, one code per invoice, and no stacking on a special discount unless you allowed it on that invoice. A redemption counts only when the invoice is **paid**. Type and value can't be edited after creation (switch a code off and make a new one).

## 7. One-time credits and allowances (from the plan)
| | Workspace | BOS |
|---|---|---|
| AI Studio credit — annual list amount | ₹499 | ₹1,299 |
| …what a term actually includes (prorated by length, nearest whole rupee, halves up, never above the annual amount) | 12 mo ₹499 · 6 mo ₹250 · 3 mo ₹125 · 1 mo ₹42 | 12 mo ₹1,299 · 6 mo ₹650 · 3 mo ₹325 · 1 mo ₹108 |
| Free SEO keywords | 3 | 6 |
| Theme changes per year | 2 | 4 |

## 8. Where the money settings live
- **Payee & QR** (Admin → Commerce → Payee & QR, also under Settings): UPI ID, payee name, optional printed QR, bank details, instructions. Without a UPI ID the "UPI QR" option shows as not set up.
- **Annual list prices:** Admin → Pricing Manager (`domainapp_workspace_yearly`, `domainapp_bos_yearly`); the code falls back to ₹11,988 / ₹23,988.

**How the AI Studio credit is granted.** It is a one-time wallet credit, shown to the customer as "AI Studio credit included" on their Billing page — never as a charge on an invoice. You can change the figure per deal (₹0–₹5,000) in the Deal builder, or on a term via Edit / override; changes are logged. The wallet receives `target − what the customer has already been given`: a first activation gets the full amount for the term, a renewal of the same plan gets nothing more, moving from half-yearly to annual (or Workspace to BOS) gets only the difference, and a downgrade or a lower figure never takes anything back.

## 9. Special arrangements (Release 1A policy)

**Standard for every client:** annual plan, paid through Razorpay, GST 18% added on top.

**Exceptions exist only through an active special arrangement set by KSM** (Admin > Pricing > Special arrangements). Each arrangement has a reason, an end date and a history, and every change goes to the commercial audit log. The server refuses a deal, draft, preview or plan-change request that needs an exception the client does not have.

| Exception | Rule |
|---|---|
| Half-year plan | Essentials and Pro only, never Custom (Custom is not a term). The list price for six months is 55% of the annual list (`HALF_YEAR_LIST_PERCENT`, one constant). The price charged is the net KSM approves in the deal builder, at or below list, with a reason; above 20% off needs CONFIRM as before. At the half-year end the renewal is the annual plan unless the arrangement is still in force |
| Manual UPI QR / offline payment | Only for a client with an arrangement that lists the channel. Activation or renewal happens only after KSM confirms the amount actually received. Duplicate UTRs are still flagged |
| GST not charged | Needs a reason and an end date at most 6 months away (`MAX_GST_NONE_MONTHS`). The invoice still stores the GST it would have carried and prints "GST not charged — special arrangement until <date>". The "GST not collected" report (per month and client, with CSV) is for the CA |

**When an arrangement ends:** the next renewal invoice goes back to annual, Razorpay only, GST 18% on top (no half-year negotiated price carries over), and KSM gets an admin notification. KSM also gets one notice 15 days before the end date and one when it ends, from the daily 06:00 IST job, never repeated.

**Not covered:** an arrangement belongs to an existing client. A brand-new prospect has no arrangement, so a first deal for them is on standard terms; create the arrangement, then re-issue if special terms are agreed.

Paid-plan invoices and the plan the vendor sees: only **Plan and billing** (Your Get4Domain account) takes payment from a vendor.
