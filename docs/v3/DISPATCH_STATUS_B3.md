# Dispatch B3 status (frontend lane, public site refine)

| Job | State | Commit | Note |
|---|---|---|---|
| R0 Investigate | DONE | see R1 | findings below |
| R1 Reconcile with Wave 3 contract | DONE | R1COMMIT | pricing, subdomain check, referral, register reconciled; 219 unit tests, 795 smoke checks pass |
| R2 Industry landing pages | TODO | | |
| R3 Quality | TODO | | |
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

## QUESTIONS FOR THE OWNER
- none yet

## NOTES
- The app has no `typecheck` script: `npx tsc --noEmit` is used instead.
- Mock mode now runs the real pricing shape (MOCK_PRICING) through the same normaliser as real mode.
