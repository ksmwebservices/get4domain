# Dispatch D2 report: owner default terms on the legal pages

Branch `v3-pub-fe7` (on `v3-pub-fe6`). Nothing pushed. No backend start, database, `.env` access or provider call. Everything stays behind `V3_PUBLIC_ENABLED`.

## Done

| Job | State | Commit |
|---|---|---|
| D0 placement table | DONE | `acc4e20` (table in `DISPATCH_STATUS_D2.md`) |
| D1a rewrite of the texts, grievance block, guard and smoke changes | DONE | `acc4e20` |
| D2a go-live environment names; date shown from one place | DONE | `9e31b94` |
| D3 docs and this report | DONE | the commit after `9e31b94` |

Blocked: none.

## What changed per page

- **Refund and Cancellation Policy**: no refund once a plan is active; three exceptions (duplicate, taken but no plan, amount mismatch held); gateway refund to the original method after an administrator checks the gateway record; stop renewing any time, access to the end of the paid term, no part refund; wallet unchanged; legal rights kept; grievance block.
- **Terms of Service**: same refund and cancellation rules; GST at the rate in force as its own line; Free trial site informational, main features need a paid plan, no trial length; grievance block.
- **Payments and Billing**: cancellation, GST own line, invoice, duplicate and no-plan payments, admin check, refund summary.
- **Delivery Policy**: trial site informational; GST line; missing-plan route with the admin check and refund.
- **Privacy Policy**: retention (kept while the account is active, deleted or anonymised after closing, except records the law requires); partner PAN.
- **Partner Programme Terms**: PAN required; tax at source at the rate the company applies.
- **About**: trial informational, stop renewing, GST own line.
- **Contact**: grievance text with "48 hours" and "one month"; refunds pointer. Block now a shared component.
- Headings and routes unchanged. Law and Chennai courts, no arbitration were already in place.

## Tests and checks (all after the last commit's code)

- Typecheck (`npx tsc --noEmit`; the app has no `typecheck` script): passes.
- Build: passes.
- Unit tests `test:v3-public`: 300 of 300 pass.
- Smoke `smoke:v3-public`: 1641 of 1641 pass (includes flag-off regression, and new checks that Terms and Refund show the block only when grievance values are set).
- Guard test: allows exactly "48 hours" and "one month" in a grievance or complaint sentence; new tests prove "49 hours", "2 days", "within one month", a percentage and the phrases in other sentences are still refused; no GST percentage anywhere; the two phrases appear only in the Contact grievance text.

## Found and fixed on the way

- Two D1 guard checks had a word boundary saved as a backspace character and never ran (About "no invented history" in the unit test, "prints nothing for a value that is not set" in smoke). Fixed; they pass.
- The guard rejected my first draft ("second payment": "second" is a time word). Reworded.

## What the owner must set (names only; see `GO_LIVE_PUBLIC.md`)

`V3_PUBLIC_ENABLED`, `V3_PUBLIC_USE_MOCKS` (false), `MAIN_HOST`, `DIRECTORY_HOST`, `APP_HOST`, `ADMIN_HOST`, `API_HOST`, `MEDIA_HOST`, `API_BASE_URL`, `V3_PUBLIC_SITE_ORIGIN`, `V3_PUBLIC_SUPPORT_EMAIL`, `V3_PUBLIC_SUPPORT_PHONE`, `V3_PUBLIC_GRIEVANCE_OFFICER_NAME`, `_EMAIL`, `_PHONE`, `V3_PUBLIC_FIRM_CIN`; leave `V3_REGULATED_PACKS_PUBLIC` unset. Set the grievance name and email, or the block (and its timelines) is not shown. Set `LEGAL_EFFECTIVE_DATE` in `legal-meta.ts` on go-live day.

## Questions for the owner

1. Billing terms: the text says quarterly, half-yearly or annually; notes say launch pricing is annual only (G43).
2. Cash payment returns: keep "agreed with that administrator in writing" or align with the no-refund default?

All defaults are OWNER DEFAULTS awaiting lawyer review (`LEGAL_REVIEW.md`, D2 section, with the lawyer's open questions). Stopped here; not pushed.
