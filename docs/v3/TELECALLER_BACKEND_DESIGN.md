# Telecaller backend: design (E6)

Written 26 Nov 2026, revised the same day after reading the role matrix. A telecaller is a Get4Domain employee who phones businesses, creates their website for them, collects the first payment, and is paid commission. Most of this already exists; the work is joining it into one safe flow. Branch: `v3-eng-e6`. Updated 26 Nov 2026 (E9, branch `v3-eng-e9`) with the owner's decisions of that day: sections 4 and 5 and the new section 6.

All paths are in `C:\Get4Domain\get4domain-w2\backend-api\src\` unless a full path is given.

## 1. What exists today

| Need | What exists | Where |
|---|---|---|
| An employee login with sales rights | The staff role label **TELECALLER** (and FIELD_EXECUTIVE): folded into the SALES rights (the MARKETING value) when the principal is built. An admin invites one through the admin team | `auth\guards\admin-role-matrix.ts` (line 36), `admin-team\admin-team.service.ts` (`invite`) |
| Create a business for an owner | `POST /v3/admin/vendor-sites` is allowed for ALL staff: vendor, Free plan, live trial site, welcome e-mail; the initial password is random and never shown | `v3-admin-vendor-site\admin-vendor-site.service.ts` |
| Who referred a business | `ReferralAttribution`, one row per business, first touch wins, source `ON_BEHALF` for a business made by staff | `v3-referrals\referrals.service.ts` (`setAttribution`) |
| The commission person | A referral partner row (type SALES_TEAM) that can be linked to a login by `staffUserId`. **The link today accepts only the role REFERRAL_PARTNER**, so a TELECALLER cannot be linked yet | `v3-partners\partners.service.ts` (`assertLinkable`) |
| First payment | Plan orders. A CASH order can be made for a vendor (server price plus GST) and is settled only when an admin confirms the cash with a receipt reference; that makes the invoice and the subscription | `plan-billing\plan-order.service.ts` (`createCashOrder`), `settlement.service.ts` (`confirmCash`) |
| Commission | One ledger line per business on its FIRST paid plan payment; slabs (the system ships with none), month close, payouts with TDS, CSV | `v3-referrals\referrals.service.ts`, `plan-billing\plan-paid.hook.ts` |

## 2. What is missing, and the plan

| # | Part | Decision? | Plan |
|---|---|---|---|
| A | One-step employee account | No | `POST /v3/admin/telecallers` {name, email, phone, payType?} (ADMIN and SUPER_ADMIN since E9): invites a staff login with role TELECALLER (the invite mail as today), creates a SALES_TEAM partner linked to that login, issues the referral code. A later failure undoes the earlier steps. The link rule accepts TELECALLER as well as REFERRAL_PARTNER. |
| B | Create a business, as a telecaller | Partly (WhatsApp) | `POST /v3/admin/telecaller/vendors`: the same fields as `vendor-sites`, minus the duplicate override (admins only). Creates through the same service, so every rule is the same; attributes the business to the telecaller (`ON_BEHALF`); a daily cap per telecaller (20 since E9, a setting); sends the owner a **set-your-password link** by e-mail. The owner is never sent a password and the telecaller never sees one. A WhatsApp copy goes only when its message template is approved (decision 1). |
| C | Payment collection record | Partly (cash policy) | `POST /v3/admin/telecaller/vendors/:id/collections` {planKey, termMonths, idempotencyKey}: only for a business attributed to this telecaller; creates the CASH plan order at the server price. It stays "waiting for the office" (order status `PENDING_PAYMENT`). An admin confirms the cash with the existing mark-paid route (receipt reference, day, amount equal to the total); that issues the invoice, starts the plan and creates the commission line. No new table. |
| D | Commission | Yes (amounts) | Ledger, slabs, month close and payouts exist. Nothing to build until the owner enters slabs. |
| E | Monitoring | No | `GET /v3/admin/telecaller/monitor` (my counts: created, paid, waiting for the office, commission by state) and `GET /v3/admin/telecallers/monitor` (the same for every telecaller). Read only. |

## 3. Safety rules built in

- Every telecaller route finds the partner from the login and works only on businesses attributed to that partner. A business of someone else answers the same as an unknown one.
- The telecaller never receives a password, a token, bank details or another telecaller's businesses.
- Cash is never "paid" by the telecaller: only an admin confirms it. The telecaller's record is an order waiting for payment (`PENDING_PAYMENT`) with the telecaller as the creator.
- Everything is audited (activity log) with the telecaller as the actor.
- Commission follows the existing rule: the first paid payment of a business, counted once; reversing a payment reverses the line.

## 4. The owner's decisions (26 Nov 2026) and what is still open

Source: `C:\Get4Domain\docs-claude\V3_OWNER_ANSWERS_26NOV2026.md`.

| # | Question | Decision | State |
|---|---|---|---|
| 1 | WhatsApp copy of the set-password link | Submit the templates `vendor_account_ready` and `plan_pay_link` to Meta together (owner task) | E-mail only until the template is approved |
| 2 | Telecaller pay | BOTH: salary plus commission (employee) and commission slabs only (freelancer), chosen per telecaller; the owner enters amounts and tiers | Built (E9c) |
| 3 | Unconfirmed cash | Overdue after 60 days | Built (E9c), a setting |
| 4 | Daily cap | 20 new businesses per telecaller per day | Built (E9c), a setting |
| 5 | Who creates telecaller accounts | ADMIN as well as SUPER_ADMIN | Built (E9c) |

Still open (the owner to say):

1. **Different commission tiers for employees and freelancers?** There is one set of slab rows today and both pay types use it. A second set means a pay-type column on the slab rows and in the month close (about a day).
2. **Salary payment.** The monthly salary is stored and shown; nothing pays it or adds it to the commission payout.
3. **Listings.** The cap counts every business the telecaller registered today, and it blocks new business accounts (both creation routes). Seeded listings and the listing import (also open to sales staff) are counted but not blocked.
4. **Access after the owner takes over.** A telecaller may edit the website of a business they created for as long as the account exists. Say if this should end when the owner claims or pays.

## 5. What is implemented

A, B (e-mail link; WhatsApp left off), C (order creation; the office confirms with the existing route), E. The neighbour services are found lazily (as the site rebuild port does), so no module import cycle is created; tests use fakes.

## 6. E9: pay type, settings, cap, overdue cash, draft edits

| Item | How it works | Where |
|---|---|---|
| Pay type | Table `g4d_telecaller_profiles`: one row per telecaller partner with `payType` (`SALARY_PLUS_COMMISSION` or `FREELANCE_SLAB`) and `monthlySalaryMinor` (paise, only for the salaried type, may be empty). No amount is written in code or seeded | `prisma\migrations\20270111100000_v3_e9_telecaller_pay\migration.sql` |
| Setting pay | `GET` and `PUT /v3/admin/telecallers/:partnerId/pay`, SUPER_ADMIN only. PUT replaces: a salary left out is cleared. The type (not the amount) may also be chosen when the account is created | `v3-telecaller\telecaller.service.ts` |
| Commission | Unchanged: the owner's slab rows (`POST /v3/admin/commission/slabs`), the first paid plan payment of a business, month close, payouts | `v3-referrals` |
| Settings | `telecallerDailyCap` (20) and `telecallerCashOverdueDays` (60), changed by SUPER_ADMIN on `PUT /v3/admin/plan-settings/:key`, read on `GET /v3/admin/telecallers/settings` | `v3-telecaller\settings\telecaller-settings.ts` |
| Daily cap | Counted per day in India time, applied inside the business-creation service, so `POST /v3/admin/telecaller/vendors` and `POST /v3/admin/vendor-sites` both obey it; refusal `TELECALLER_DAILY_CAP`. A telecaller cannot override the duplicate check on either route | `v3-telecaller\telecaller-cap.service.ts` |
| Overdue cash | Each monitor row has `cashOverdue` (waiting cash orders older than the setting) and `cashOverdueAfterDays`. A notice only: nothing is cancelled. A telecaller's collection stays open (`PENDING_PAYMENT`) for 366 days, the oldest receipt day a confirmation accepts, so the setting must be below 366; an admin's own cash order still closes after 14 days. Corrected after the first E9 push (UD9): the monitor had counted only `CREATED`, and collections expired after 14 days | `v3-telecaller\core\telecaller-core.ts` |
| Editing a website | A telecaller starts an act-on-behalf session (a reason) for a business they created and uses the staff draft routes `PUT /v3/admin/vendors/:id/site/draft/*`. Sessions need the setting `actOnBehalfMaxMinutes`. Publishing and picture upload stay OPERATIONS, ADMIN and SUPER_ADMIN | `v3-admin-draft` |

**Deploy order:** apply the migration before the new API image starts; the telecaller monitor reads the new table.
