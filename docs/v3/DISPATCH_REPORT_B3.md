# Dispatch B3 report (frontend lane, public site refine)

Branch `v3-pub-fe4` (from `v3-pub-fe3`), folder `get4domain-pub/get4domain_mvp`. Nothing pushed. Docs are in `get4domain-pub/docs/v3` (the dispatch said `docs\v3` relative to the app; the existing files live at the repo root).

## Done
| Job | Result | Commit |
|---|---|---|
| R0 Investigate | Assumed shapes listed against the Wave 3 contract (top of `DISPATCH_STATUS_B3.md`) | 095f801 |
| R1 Reconcile | Pricing, address check, referral, register brought to the contract; mock and real mode share one path | 095f801 |
| R2 Industry landing pages | 12 pages at `/industries/{slug}`, hub links, register with the industry preselected, sitemap entries, regulated four unpublished | 114cf78 |
| R3 Quality | Structured-data unit tests, a flag-on-without-host-names smoke mode, a regulated-packs-on server; accessibility already checked by smoke on every new page | 4508dca |
| R4 Docs and report | `PUBLIC_SITE.md` (sections 10 to 12), `PUBLIC_GAPS.md`, this report | the commit after 4508dca |

## Blocked
Nothing. No job hit the three-attempt rule.

## Differences found against the real contract (and what changed)
1. **Pricing.** Assumed `GET /v3/plans` with `prices[].amountPaise/taxInclusive` and feature states. Real: `GET /v3/public/pricing` with `terms[].state` (AVAILABLE or PRICE_PENDING), `price.priceMinor`, `gst` separate, `capabilities` (names only, no limits or states), `addons` with a price status. Changed: `fromPricing` normaliser, mock now in the real shape, the feature table shows "Included" for each capability (the old "Up to N pages" and "Preview only" cells came from fields the contract does not have), add-ons come from the API.
2. **Address check.** Assumed `GET /v3/public/subdomain/check?slug=` with reasons TAKEN, RESERVED, INVALID, TOO_SHORT. Real: `GET /v3/public/subdomain-availability?name=` with reasons AVAILABLE, INVALID, RESERVED, UNAVAILABLE (taken). Local rules still run first.
3. **Referral.** Assumed `displayName`. Real: `source`. Unknown code is `{ valid: false }` (and 404 is still handled).
4. **Register.** Assumed extra fields `categoryKey`, `termMonths`, `acceptedTerms`, `subdomain`, `referralCode`. Real: only `subdomain` and `referralCode` are added. The three unknown fields are no longer sent (a validation whitelist could refuse them). Codes mapped: `SUBDOMAIN_INVALID`, `SUBDOMAIN_RESERVED`, `HOST_UNAVAILABLE` (409, taken address; it used to fall to the "email taken" message on a 409). The billing term chosen on the pricing page is therefore no longer sent to the API.
5. **Tax.** G30 closes: prices are before GST by contract.
6. Wave 4 contract file does not exist at `get4domain-w4`; not used.

## Pages and routes added
- `/industries/{slug}` (12 slugs, main host, rewritten internally to `/v3-site/industries/{slug}`), `/register?pack=KEY`.
- Hub `/industries` now links each page. Sitemap lists the 12 on the main host (flag on and `MAIN_HOST` set only).
- New env flag `V3_REGULATED_PACKS_PUBLIC` (default off): CLINIC, LAB, PHARMACY, PRACTICE_LEGAL_FINANCE get a page, a hub entry and a sitemap entry only when it is exactly `true`; off means a real 404 from the middleware.
- Files: `lib/v3-public/industries.ts` (new), `plans.ts`, `register.ts`, `register-proxy.ts`, `referral.ts`, `host-routing.ts`, `site-strings.ts`, `components/site/RegisterForm.tsx`, the pricing, register and industries pages, `app/sitemap.ts`, tests and smoke.

## Gaps still open
- G28 (rest): `/auth/register` answer shape and `industry` value are not in the contract; no field for term or category key.
- G31: no public pack list (landing pages use data in the app).
- G35 (new, live, owner): flag on, an unknown live `/industries/{id}` answers 500. Pre-existing, found by smoke; suggested fix `dynamicParams = false` on that page.
- G36 (new, owner): `sitemap.ts` is `force-dynamic` so the flag can add pages; XML with the flag off is unchanged.
- G34 (new, owner): counsel sign-off before `V3_REGULATED_PACKS_PUBLIC=true`.
- G19: no ESLint configuration in the app, so lint was not run (not added, per the dispatch).
- Unchanged and still open: G1 to G7, G11 to G16, G18, G20 to G27, G32, G33.

## Tests and smoke
- `npx tsc --noEmit` clean (the app has no `typecheck` script). `npm run build` clean.
- Unit tests: 241 pass (was 216 at the start of this lane; 25 added).
- Smoke (`npm run smoke:v3-public`): 1189 of 1189 pass over four servers: flag off with host names, flag on without host names, flag on with host names, and flag on with host names and the regulated packs published. Includes: flag off 404s, the live `/industries/travel` untouched, sitemap equal to the flag-off XML once the 12 entries are removed, regulated pages 404 by default and 200 when published, per page one H1, landmarks, skip link, title at most 60, canonical and robots, FAQPage and BreadcrumbList that parse, no price, offer or rating markup, no forbidden words, no contact link, every internal link resolves.
- Not run: a real API (real mode is checked by types and unit tests of the parsers only), a browser click-through (G20), lint.

## Skipped
- Real-mode network test of the new routes (no API access by rule).
- A test of the referral route's real-mode parsing with a stubbed fetch (the `source` read is one line; mock mode is tested).
- Fixing G35 (live file).
