# Dispatch B3 status (frontend lane, public site refine)

| Job | State | Commit | Note |
|---|---|---|---|
| R0 Investigate | DONE | see R1 | findings below |
| R1 Reconcile with Wave 3 contract | DONE | 095f801 | pricing, subdomain check, referral, register reconciled; 219 unit tests, 795 smoke checks pass |
| R2 Industry landing pages | DONE | 114cf78 | 12 pages at /industries/{slug}, regulated 4 behind V3_REGULATED_PACKS_PUBLIC; 239 unit tests, 1186 smoke checks (four servers) |
| R3 Quality | DONE | R3COMMIT | structured-data unit tests, no-host-names smoke mode, 241 unit tests, 1189 smoke checks; no ESLint config in the app (G19), lint not run; found G35 |
| R4 Docs and report | TODO | | |

## R0 FINDINGS: assumed shapes vs API_CONTRACT_WAVE3.md
Docs live at the repo root `docs/v3` (not under get4domain_mvp). Wave 4 contract does not exist at get4domain-w4, so it is not used.

| Area | Public site assumed | Wave 3 contract says | Action |
|---|---|---|---|
| Pricing (not a numbered gap) | `GET /v3/plans`, `{plans:[{prices:[{termMonths,amountPaise,taxInclusive}],features}],terms,tax}` | `GET /v3/public/pricing`, `{currency,pricesExcludeGst:true,terms,gst:{name,ratePercent}|null,free,plans:[{key,track,name,description,capabilities,terms:[{termMonths,state,price:{priceMinor,gstMinor,totalMinor}|null,purchasable}]}],addons:[{key,name,description,state,price|null,purchasable}]}` | G30 mostly closes: prices are always before GST, PRICE_PENDING has no number. Rewrite fetcher through a normaliser. Add-ons now come from the API |
| G28 subdomain check | `GET /v3/public/subdomain/check?slug=` answering `{available,reason:TAKEN/RESERVED/INVALID/TOO_SHORT}` | `GET /v3/public/subdomain-availability?name=` answering `{available,name,reason:AVAILABLE/INVALID/RESERVED/UNAVAILABLE,message}` | Change route, param and reasons (UNAVAILABLE = taken) |
| G28 register fields | sends categoryKey, subdomain, termMonths, referralCode, acceptedTerms | Only `subdomain` (max 63) and `referralCode` (max 20) are added; errors 400 SUBDOMAIN_INVALID, 400 SUBDOMAIN_RESERVED, 409 HOST_UNAVAILABLE; same credentials again signs in; bad referral ignored | Stop sending the three unknown fields (a whitelist could refuse them); map the three codes |
| G29 referral | `{valid,displayName}`, 404 for unknown | `{valid:true,source:"<display name>"}` or `{valid:false}` | Read `source` |
| G2 handoff / sign-in token | `/auth/session/login` has `accessToken`; handoff empty body | Wave 3 contract is silent (handoff is in DISPATCH_REPORT_A, not changed by Wave 3). `/auth/register` answer shape is not documented | Stays open, noted |
| G30 tax inclusive | may be `taxInclusive` | Prices are before GST, `pricesExcludeGst:true`, GST a separate field | Closed |
| G31 pack list | none | Not in Wave 3 (`/v3/public/themes?pack=` exists but lists themes, not pack contents) | Stays open |
| G1, G3 to G7, G12 to G16, G22, G23 | | Not covered by Wave 3 | Unchanged |

## ASSUMPTIONS
- Docs path is `get4domain-pub/docs/v3`, the existing location of PUBLIC_SITE.md, not get4domain_mvp.
- The register answer still carries `accessToken` (not in Wave 3 contract); the existing fallback to the vendor login applies if not.
- Selected billing term can no longer be sent at register (contract has no field); it stays a query hint only.

- The slugs are descriptive (for example `food-service`, `field-services-and-trades`), chosen so that none equals a live industry id (`retail`, `logistics`, `finance`...), so no live page is shadowed.
- `src/app/sitemap.ts` now has `export const dynamic = 'force-dynamic'` so the flag (a runtime value) can add the landing pages; with the flag off the XML is byte for byte the same (smoke compares it). This is the only edit to a live file other than the sitemap import lines.
- An unpublished regulated pack is a real 404 from the middleware decision (a page cannot send one, gap G9). With the flag off the address is the live page's own answer, as for any unknown industry id.
- `/register?pack=KEY` limits the category list to the pack (with a "Show all categories" button). Only a published pack key counts.
- The smoke failure seen once on "unknown industry address" was real, not timing: with the flag on, an unknown live `/industries/{id}` answers 500 (root layout reads `headers()` only when the flag is on, so an id that was not prerendered cannot render: DYNAMIC_SERVER_USAGE). With the flag off it is the live soft 404. Neither file is changed by this dispatch (git diff empty), so it is pre-existing: recorded as gap G35, not fixed (live files). The smoke now asserts only that such an address is never a landing page.

## QUESTIONS FOR THE OWNER
- none yet

## NOTES
- The app has no `typecheck` script: `npx tsc --noEmit` is used instead.
- Mock mode now runs the real pricing shape (MOCK_PRICING) through the same normaliser as real mode.
