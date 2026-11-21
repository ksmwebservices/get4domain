# Dispatch C1 report (frontend lane, public site)

Branch `v3-pub-fe5` (from `v3-pub-fe4`), folder `get4domain-pub/get4domain_mvp`; docs in `get4domain-pub/docs/v3`. Nothing pushed.

## Done
| Job | Result | Commit |
|---|---|---|
| P0 Investigate | Every public fetcher compared with the Wave 3 and Wave 4 (incl. A3) contracts; top of `DISPATCH_STATUS_C1.md` | 65a05a0 |
| P1 Reconcile | The one DIFFERENT row fixed: the register validation 400 lists fields in `data.fields`; 6 new tests including real-mode register with a stubbed fetch | a576662 |
| P3 Real-API probe | `scripts/real-probe.mjs`, `npm run probe:v3-real`; run now: "API not reachable", exit 0 | c4f58b2 |
| P4 Quality | No new page or route, so no new accessibility or structured-data test was needed; smoke re-run after each change | (no change) |
| P5 Docs and report | `PUBLIC_SITE.md` section 13, `PUBLIC_GAPS.md` G37, this report | the commit after c4f58b2 |

## Blocked
- **P2 Theme rendering: BLOCKED-BY-GAP (G37).** `GET /v3/public/site/by-host` returns the stored finished page, which the backend already draws from the vendor's `themeId`. The answer has no theme key, and `GET /v3/public/themes?pack=` has no colours, fonts or layout. This app relays stored pages byte for byte by a frozen rule, so nothing was invented. The exact shape needed, if the owner wants this app to restyle a page, is in `PUBLIC_GAPS.md` G37. The cleaner fix is on the backend (republish on a theme switch), which A3 already does.

## Differences found against the real contracts
- Different: the register validation 400 field list (fixed).
- Same: pricing, address check, referral, register request, 201 success, the address codes and the email 409, the directory host output (no `/directory` prefix), brand on the main origin.
- Missing and stays open: the handoff route's answer (G2), a public pack list (G31), a theme key and render data (G37).
- Not public-site: theme switch routes, held payments, gateway credentials, GST rate and TDS.

## Gaps open
G2 (handoff shape), G31, G37 (new), plus the unchanged G1, G3 to G7, G11 to G16, G18 to G27, G32 to G34. G28 closes: the register answer is documented. The terms screen after a first registration must call `/auth/me` (the register answer has no `termsAcceptanceRequired`): that is the vendor app's step.

## Tests and smoke
- `npx tsc --noEmit` clean, `npm run build` clean (the app has no `typecheck` script; no ESLint configuration, G19).
- Unit tests: 250 pass (244 before).
- Smoke: 1198 of 1198 over four servers (flag off, flag on without host names, flag on with host names, regulated packs published).
- Probe: not reachable (API not started); its table path was checked against a throwaway local stub, 10 of 10, not against the real API.

## Skipped
Browser click-through (G20); a real-API run; lint.

## Run the probe once the API is up
```
cd C:\Get4Domain\get4domain-pub\get4domain_mvp
npm.cmd run probe:v3-real -- http://localhost:3008
```
(Use the port the API prints; or set `PROBE_API_BASE_URL`.) It prints one OK or DIFF row per check; a DIFF names the route and the status. Read-only.
