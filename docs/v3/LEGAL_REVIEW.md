# Legal and company pages: review sheet (dispatch D1)

**Status: plain-language DRAFT. A lawyer in India must review and approve (or replace) every text below before `V3_PUBLIC_ENABLED` is turned on in production.** Nothing here is legal advice and nothing is pushed or deployed. The pages answer only with the flag on and `MAIN_HOST` set; the live site is unchanged otherwise.

Branch `v3-pub-fe6`. Texts: `get4domain_mvp/src/lib/v3-public/legal-text/*.ts` (one file per policy) and `company-strings.ts` (About, Contact). Shared constants (effective date, version): `legal-meta.ts`. Firm details: `firm-facts.ts`.

## Dispatch D2: OWNER DEFAULTS applied (branch `v3-pub-fe7`)

The owner chose default terms so the site can go live now. Each is an **OWNER DEFAULT awaiting lawyer review**, not a lawyer-approved term. They replace the "as shown at checkout or as agreed in writing" wording where D1 left a decision open. The only numbers and time words now in policy text are "48 hours" and "one month" (grievance timelines).

| # | OWNER DEFAULT (awaiting lawyer review) | Where |
|---|---|---|
| 1 | Laws of India; courts at Chennai, Tamil Nadu exclusive; no arbitration | Terms, Privacy, Refund, Disclaimer, Partner, Listing (unchanged from D1) |
| 2 | A plan payment is not refundable once the plan is active. Exceptions: duplicate payment; payment taken but no plan activated; payment whose amount did not match the order and was held. Refund through the gateway to the original method after an administrator checks the gateway record. Wallet: prepaid credit, no refund, no cash-out. Legal rights kept | Refund, Payments, Terms, Delivery |
| 3 | Stop renewing any time; access to the end of the paid term; no part refund | Refund, Terms, Payments, About |
| 4 | Grievance officer acknowledges in 48 hours, resolves in one month; block and support contacts shown when the firm data exists | Contact, Terms, Refund (block); company details on every policy page |
| 5 | Data kept while the account is active; after closing, deleted or anonymised except records the law requires (invoices, tax) | Privacy |
| 6 | Prices exclude GST; GST at the rate in force added at checkout as its own line; invoice after a successful payment; no GST percentage printed | Payments, Terms, Delivery, About |
| 7 | Partner: slabs set by the company; counted once on the first successful paid plan payment; monthly payouts; tax at source as the law requires at the rate the company applies; PAN; no discounts | Partner, Privacy |
| 8 | Free trial site is informational; main features need a paid plan; no trial length | Terms, Delivery, About |

**Still open for the lawyer** (not decided by the defaults): whether to have an arbitration clause; retention periods (the text gives none); the real cookie list; the partner agreement as a contract (clawback, termination, confidentiality); TDS wording and rate; GSTIN invoice wording while the number is pending; whether the Chennai exclusive jurisdiction holds against consumers; whether the wallet falls under prepaid-instrument rules; whether "no refund once active" and the exceptions meet gateway merchant terms and the E-Commerce Rules; the grievance officer's required details.

**Still open for the owner**: the billing terms named in the text are quarterly, half-yearly or annually, but the project notes say launch pricing is annual only; the cash-payment return wording ("agreed with that administrator in writing") was not one of the eight defaults.

The "open questions" columns in the table below are the D1 versions: refund window, cancellation notice, trial length, retention and the partner numbers are now answered by the defaults above (still awaiting review).

## How the texts were written (rules held)

- Only these company facts are used: legal name KSM QUANTUM TECHNOLOGIES, Tidel Park, Chennai, Tamil Nadu, India; brand Get4Domain; the business model facts in the dispatch.
- Decided facts used: vendors pay only through the payment gateway (Razorpay or Cashfree); plans are billed quarterly, half-yearly or annually; prices exclude GST and GST is added at checkout; an invoice is issued after a successful payment; the wallet is prepaid platform credit with no refunds and no cash-out; a payment that does not match the order is held for review and any refund goes through the gateway to the original payment method; failed or cancelled orders do not activate a plan; cash is accepted only when an administrator confirms it; no discounts, coupons or offers exist; Free sites are informational; partners are independent, paid by slabs the admin sets, counted once on a vendor's first successful paid plan payment, paid monthly with TDS as per law.
- Governing law of India; courts at Chennai, Tamil Nadu have exclusive jurisdiction; **no arbitration clause**; **no section numbers**; laws named only in general terms (Information Technology Act and its rules; Digital Personal Data Protection Act and its rules as in force; Consumer Protection (E-Commerce) Rules; Central Goods and Services Tax Act), without years.
- **No numbers and no time words** in policy text. Where a rule normally needs one, the text says "as shown at checkout or as agreed in writing". A unit test (`legal-copy-rules.test.ts`) fails if a digit, a time word, a price, a percentage, a banned word, a ranking claim, a promise of a discount or guarantee (other than to say there is none), a placeholder, an arbitration word or a stray law name appears.
- Effective date `2026-11-17` and version `1.0 (draft)` come from one constant (`legal-meta.ts`). The date is the drafting date: **set it again on the day the flag goes on.**

## Pages

| Page | Path (main host) | Replaces a live page? | Open questions (owner = O, CA = C, lawyer = L) |
|---|---|---|---|
| Terms of Service | `/terms` | yes, `/terms`, only with the flag and `MAIN_HOST` on | O: trial length and limits; what happens to a trial or Free site that does not upgrade; what happens at the end of a billing term (renewal or not); service-level promises (none made). L: liability wording (excluded losses, third-party and business content), consumer-law carve-out wording, whether "we may suspend" needs a notice step, intermediary status of the platform, whether an exclusive Chennai jurisdiction is enforceable against consumers. |
| Privacy Policy | `/privacy-policy` | yes, `/privacy-policy` | L: DPDP notice contents (purposes, consent, data fiduciary status, rights, grievance route, breach handling, complaint to the Board), children's data, cross-border processing and where hosting is, how the directory's data about unclaimed businesses is lawfully sourced and used. O: retention periods (the text gives none), hosting provider names if they should be listed, whether analytics are used. |
| Refund and Cancellation Policy | `/refund-policy` | yes, `/refund-policy` | O: refund eligibility window and amount, cancellation notice, whether a plan fee is refunded after activation, how long the team takes to decide and to start a refund. C: GST and credit-note handling on a refund. L: whether "no promised refund" is acceptable to the gateways and consumer rules. |
| Payments and Billing | `/payments-and-billing` | no (new) | C: invoice wording while the GSTIN is pending, place-of-supply wording, what the invoice must show. O: end-of-term behaviour (renewal reminders or not), what the wallet can be spent on, whether top-ups expire (the older `/legal/wallet-terms` draft says each top-up carries an expiry date; this page does not), cash payment procedure. L: whether the wallet is a regulated prepaid instrument. |
| Delivery Policy | `/delivery-policy` | no (new) | O: the activation time to show at checkout (the page says "as shown at checkout"). L: wording the payment gateways and the E-Commerce Rules expect for a digital service. |
| Acceptable Use Policy | `/acceptable-use` | no (new) | L: the list of prohibited content, notice-and-takedown steps and timelines under the intermediary rules, reporting route. O: who handles abuse reports. |
| Cookie Notice | `/cookie-notice` | no (new) | L and O: the real cookie list. The page names only the first-party referral cookie (known from the code), "sign-in and security" cookies in general words, and the gateway's own cookies. Confirm every cookie the site and the business app set, and whether analytics or other categories exist and need consent. |
| Disclaimer | `/disclaimer` | no (new) | L: wording of the limit of responsibility, the "no professional advice" statement. |
| Directory and Listing Terms | `/directory-listing-terms` | no (new; the older `/legal/directory-listing-terms` draft stays, noindex) | L: lawful basis and notice for listing a business before it claims the page, removal and correction process, claim verification, any category limits. O: removal and correction handling times (none stated). |
| Partner Programme Terms | `/partner-terms` | no (new) | O: commission slabs and how a partner is told, payout day and minimum, TDS rate, reversal of commission on a refund or a failed payment, loss of unpaid commission on breach, what bank or tax details are collected. C: TDS wording and rate, partner invoices (GST on commission). L: the partner agreement (independent status, termination, clawback, confidentiality, non-solicit). |
| About Us | `/about` | yes, the slice 7 page at the same path | O: confirm "what a business can do" list matches the product. Nothing else is claimed (no history, numbers or team). |
| Contact | `/contact` | yes, the slice 7 page at the same path | O: support email and phone, grievance officer name, email and phone, CIN: see the list below. L: grievance timelines (the page states none) and the officer details the E-Commerce Rules and the intermediary rules expect. |

## Cross-cutting questions

**Owner**
1. Refund windows, amounts and the cancellation notice (nothing is promised in the draft).
2. Trial length and limits, and what happens when a trial or Free site is not upgraded.
3. End-of-term behaviour of a plan (renewal or lapse), and the wallet: spend scope, expiry, any minimum.
4. Partner programme numbers: slabs, payout day, minimum payout, TDS rate, commission reversal.
5. Support email and phone, grievance officer, CIN, registered office line (see "fields to fill").
6. Whether to retire the older `/legal/*` drafts when these pages go live (they overlap and are noindex).
7. The effective date to print on the day the flag goes on.

**Chartered accountant**
1. GST invoice wording while the GSTIN is pending, and once it is set.
2. GST treatment of wallet top-ups (at top-up or at use) and of partner commission.
3. TDS wording and rate for partner payouts, and the statement given to partners.
4. Credit notes on refunds.

**Lawyer in India**
1. Liability, disclaimer and suspension wording; exclusive Chennai jurisdiction against consumers; no arbitration clause is included (decide whether one is wanted).
2. DPDP compliance of the privacy policy and the directory's handling of unclaimed businesses' data; children's data; retention; grievance route and timelines.
3. E-Commerce Rules and intermediary rules disclosures for a platform of this kind (seller and grievance officer details, takedown route).
4. Cookie categories and whether consent is needed.
5. Partner agreement as a contract (the page is terms of participation, not a full agreement).
6. Whether the prepaid wallet falls under any prepaid-instrument rules.
7. Gateway (Razorpay, Cashfree) merchant-terms requirements for the policy set.

## Fields the admin must fill

From the **firm profile** (admin screen of the backend, `PUT /v3/admin/firm-profile`, public read `GET /v3/public/firm`): legal name, registered address (full street address and PIN), GSTIN. The public route sends these three only. The pages fall back to "KSM QUANTUM TECHNOLOGIES, Tidel Park, Chennai, Tamil Nadu, India" while the API is not used or cannot answer.

From the **server environment** of the public site (names in `.env.local.example`, empty means nothing is printed): `V3_PUBLIC_SUPPORT_EMAIL`, `V3_PUBLIC_SUPPORT_PHONE`, `V3_PUBLIC_GRIEVANCE_OFFICER_NAME`, `V3_PUBLIC_GRIEVANCE_OFFICER_EMAIL`, `V3_PUBLIC_GRIEVANCE_OFFICER_PHONE`, `V3_PUBLIC_FIRM_CIN`. The backend keeps the registered email and phone private, so they are not read from the API. (Gap G38.)

## Known limits of the drafts

- They state no refund window, no trial length, no retention period, no response time, no service level and no tax rate, on purpose.
- The Cookie Notice is the least certain page: it lists what the code is known to set, nothing more.
- The public site pages need `MAIN_HOST` (same switch as the slice 7 pages). With the flag on and no `MAIN_HOST`, the live `/terms`, `/privacy-policy` and `/refund-policy` answer as before and the new-only addresses answer 404.
- The directory host serves its own older `/legal/*` drafts; the new policies are on the main host.
