# Telecaller backend: design (E6)

Written 26 Nov 2026. A telecaller is a Get4Domain employee who phones businesses, creates their website for them, collects the first payment, and is paid commission. This design builds on code that already exists; most of the work is wiring it into one safe flow. Branch: `v3-eng-e6`.

All paths below are in `C:\Get4Domain\get4domain-w2\backend-api\src\` unless a full path is given.

## 1. What exists today

| Need | What exists | Where |
|---|---|---|
| A login for an employee | A "partner" login: an admin-team member with role `PARTNER`, linked to a referral partner row (`type` FREELANCER, SALES_TEAM or ADMIN_TEAM). The guard `/v3/partner/*` lets only that principal in | `v3-partners\partner.guard.ts`, `v3-partners\partners.service.ts`, `admin-team\admin-team.service.ts` (`invite`) |
| Admin creates the account | Two separate steps today: invite a team member with role PARTNER (sends the invite mail and a WhatsApp template), then create the partner and link it | `v3-partners\api\partners.controllers.ts` |
| Create a business for an owner | `POST /v3/admin/vendor-sites`: vendor, Free plan, live trial site, welcome e-mail; the initial password is random and never shown | `v3-admin-vendor-site\admin-vendor-site.service.ts` |
| Who referred a business | `ReferralAttribution`, one row per business, first touch wins, source `ON_BEHALF` for a business made by staff | `v3-referrals\referrals.service.ts` (`setAttribution`) |
| First payment | Plan orders. A CASH order can be made for a vendor (server price plus GST) and is settled only when an admin confirms the cash with a receipt reference; that makes the invoice and the subscription | `plan-billing\plan-order.service.ts` (`createCashOrder`), `settlement.service.ts` (`confirmCash`) |
| Commission | `CommissionLedger` gets one line per business on its FIRST paid plan payment; slabs (the system ships with none), month close, payouts with TDS, CSV | `v3-referrals\referrals.service.ts`, `plan-billing\plan-paid.hook.ts` |
| What a partner sees | `GET /v3/partner/vendors` (name, state, day), `commission`, `payouts`, `link` | `v3-referrals\api\referrals.controllers.ts` |

## 2. What is missing, and the plan

| # | Part | Needs a decision? | Plan |
|---|---|---|---|
| A | One-step employee account | No | `POST /v3/admin/telecallers` {name, email, phone}: invites the PARTNER login, creates a SALES_TEAM partner linked to it, issues the referral code. If a later step fails the earlier ones are undone. `GET /v3/admin/telecallers` lists them with counts. |
| B | Create a business on behalf, as a telecaller | Partly (WhatsApp) | `POST /v3/partner/vendors`: same fields as the admin route; checks the telecaller is an active partner; refuses a duplicate business; creates it through the same service (so every rule is the same); attributes it to the telecaller (`ON_BEHALF`); a daily cap per telecaller (a setting, default off until set); sends the owner a **set-your-password link** by e-mail (the owner is never sent a password, and the telecaller never sees one). A WhatsApp copy of the link goes only if the message template is approved (decision 1). |
| C | Payment collection record | Partly (cash policy) | `POST /v3/partner/vendors/:id/collections` {planKey, termMonths, idempotencyKey, receiptRef}: only for a business attributed to this telecaller; creates the CASH plan order for the server price; the telecaller sees it as "waiting for the office". The office admin confirms the cash with the existing mark-paid route (receipt reference, day, amount equal to the total); that issues the invoice, starts the plan, and creates the commission line. No new table. |
| D | Commission | Yes (amounts) | The ledger, slabs, month close and payouts exist. Nothing to build until the owner enters slabs. Decision 2 says whether telecaller pay is commission only or salary plus commission. |
| E | Monitoring | No | `GET /v3/partner/monitor` (my counts: created, paid, waiting for the office, commission accrued, approved, paid) and `GET /v3/admin/telecallers/monitor` (the same per telecaller, with a month filter). Read only. |

## 3. Safety rules built in

- A telecaller reaches only `/v3/partner/*`; every route finds the partner from the login and works only on businesses attributed to that partner.
- The telecaller never receives a password, a token, the owner's bank details or another telecaller's businesses. The vendor list shows business name, state and day only (as today) plus a paid flag.
- Cash is never "paid" by the telecaller: only an admin confirms it. The telecaller's record is an order in the CREATED state with the telecaller as creator.
- Everything is audited (activity log) with the telecaller as actor.
- Commission follows the existing rule (first paid payment of a business, counted once); reversing a payment reverses the line.

## 4. Decisions needed (also in C:\Get4Domain\docs-claude\queues\DECISIONS_NEEDED.md)

1. **WhatsApp copy of the set-password link.** Needs a WhatsApp message template approved by Meta (name proposed: `vendor_account_ready`, two variables: owner name, link). Until then the link goes by e-mail only. Recommendation: submit the template; the code is ready and falls back to e-mail.
2. **Telecaller pay.** Commission only (slabs) or salary plus commission; the slab table is empty today. Recommendation: commission by slab, first paid plan only (as built), tiers set by the owner.
3. **Cash handling.** How the telecaller hands cash to the office (deposit slip, UPI to the company account, weekly settlement) and the time limit. Recommendation: the telecaller collects only by company UPI or bank transfer where possible; for cash, the order stays CREATED until the admin confirms with the deposit reference; orders older than N days show in the admin monitor as overdue (N set by the owner).
4. **Daily cap on new businesses per telecaller** (stops bulk fake signups). Recommendation: 20 a day, changeable in settings.

## 5. What is implemented now (no decision needed)

A (with e-mail invite as today), B (e-mail link; WhatsApp left off until decision 1), C (order creation; the office confirms with the existing route), E. Tests use fakes of every neighbour service; the neighbour services are found lazily (like the site rebuild port) so no module import cycle is created.
