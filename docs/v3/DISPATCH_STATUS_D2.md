# Dispatch D2 status: owner default terms applied to the legal pages (branch v3-pub-fe7)

Repo root `C:\Get4Domain\get4domain-pub`, app `get4domain_mvp`. Branch `v3-pub-fe7` on `v3-pub-fe6`. Docs live in `docs\v3` at the repo root. Dispatch file: `C:\Get4Domain\get4domain-site\DISPATCH_D2_APPLY_LEGAL_DEFAULTS.md`.

| Job | State | Commit | One line |
|---|---|---|---|
| D0 | DONE | (in D1a commit) | Placement table below |
| D1a | DONE | see git log (feat(public): apply owner default terms) | Texts rewritten, shared GrievanceBlock on Contact/Terms/Refund, guard allows only the two grievance timelines; typecheck, build, 298 unit tests, 1641 smoke checks pass |
| D2a | TODO | | GO_LIVE_PUBLIC.md with environment variable names; effective date shown from one place |
| D3 | TODO | | LEGAL_REVIEW, PUBLIC_SITE, PUBLIC_GAPS, DISPATCH_REPORT_D2 |

## D0 placement table (where each owner default goes in the D1 pages)

Files: `src/lib/v3-public/legal-text/*.ts`, `company-strings.ts`, `components/site/LegalDocument.tsx`, `v3-site/contact/page.tsx`. Headings and routes stay as they are.

| # | Default | Pages and sections that change |
|---|---|---|
| 1 | Law of India, Chennai courts, no arbitration | Already in Terms, Privacy, Refund, Disclaimer, Partner, Listing (`laws-and-courts`). No change needed; the existing test keeps checking it. |
| 2 | Refunds: not refundable once the plan is active; three exceptions; gateway refund to the original method after an administrator checks the gateway record; wallet no refund, no cash-out; legal rights kept | Refund: `plan-fee-refunds`, `failed-and-cancelled-orders`, `held-payments`, `wallet`, `your-rights`. Payments: `failed-payments`, `held-payments`, `refunds`. Terms: `plans-and-billing`. Delivery: `if-something-is-missing`. |
| 3 | Cancellation: stop renewing any time; access to end of paid term; no part refund | Refund: `cancelling`. Terms: `suspension-and-ending`. Payments: `billing-terms`. |
| 4 | Grievance: acknowledge in 48 hours, resolve in one month; officer block and support contacts on Contact, Terms and Refund when firm data exists | Contact: grievance body. New shared component `GrievanceBlock` used by Contact and by Terms and Refund (flag `showGrievance` on the document). Support contacts already print in the "Company details" block of every policy page (rows are printed only when set). |
| 5 | Data: kept while the account is active; after closing, deleted or anonymised except records the law requires (invoices, tax) | Privacy: `retention` (and the `your-rights` erase bullet stays). |
| 6 | Taxes: prices exclude GST; GST at the rate in force added at checkout as its own line; invoice after a successful payment; no GST percentage printed | Payments: `gst`, `invoices`. Terms: `plans-and-billing`. Delivery: `invoice`. About: `how-you-pay`. Guard test keeps refusing a percentage. |
| 7 | Partner: slabs set by the company; counts once on first successful paid plan payment; monthly payouts; tax at source as the law requires at the rate the company applies; PAN; no discounts | Partner: `payouts-and-tax` (PAN, TDS wording). Privacy: Partner details bullet (PAN). The rest is already there. |
| 8 | Free trial site informational; main features need a paid plan; no trial length | Terms: `trial-and-free-sites` (remove "length and limits of a trial are shown when you sign up"). Delivery: `trial-site`. About: first bullet. |

Tests that change: `legal-copy-rules.test.ts` (guard allows exactly "48 hours" and "one month", only in a sentence about a grievance officer or complaint; fact assertions follow the new text), `legal-framework.test.ts` (grievance block flag), smoke script (`legalTextProblems` allows the same two phrases; new checks for the block).

## ASSUMPTIONS

1. The timelines "48 hours" and "one month" sit in the shared grievance block (Contact, Terms, Refund) and not in the policy section data, so they print only when a grievance officer detail is set. A promise about an officer who is not named would be empty. The guard test still allows the two phrases wherever a sentence names the grievance officer or a complaint.
2. Wording avoids the word "within" (the existing guard refuses it): "no later than 48 hours after it is received".
3. The year of the E-Commerce Rules is not printed (digits are refused); the rules are named without a year, as in D1.
4. The "support contacts" on Terms and Refund are the existing "Company details" rows (support email and phone), which print when set.
5. Partner "PAN" is spelled as "Permanent Account Number (PAN)"; no number format is printed.
6. The effective date constant stays `2026-11-17`; it is already shown only by `LegalDocument.tsx`. D2a adds a test that no other component prints it.

## QUESTIONS FOR THE OWNER

1. The pages still say plans are billed "quarterly, half-yearly or annually" (decided fact in D1). The project notes say the current launch pricing is annual only. Which is true at go-live? I did not change it (the dispatch says invent nothing else).
2. Cash payments: the Refund page says anything returned on a cash payment is "agreed with that administrator in writing" (D1 text, not one of the eight defaults). Keep, or align with default 2 (no cash refund)?

## FOUND AND FIXED

- D1 left two real defects in guard tests: a word boundary was saved as a backspace character, so the About "no invented history" assertion (`legal-copy-rules.test.ts`) and the smoke check "prints nothing for a value that is not set" never ran. Both now use `` and pass.
- `npm run typecheck` does not exist in this app; `npx tsc --noEmit` was used for the typecheck step.
- The guard caught the word "second" (a time word) in my first draft of the duplicate-payment sentences; reworded, not allowed.
