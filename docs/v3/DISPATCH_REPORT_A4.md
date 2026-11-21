# Dispatch A4 report (backend lane, branch v3-smoke2)

## Done
- Q0 investigation, Q1 held-payment role check pinned and businessName added, Q2 theme contract, Q3 tax-rate create never back-dated, Q4 staging cleanup of V3TEST tax rows, Q5 vendor-site model documented, Q6 final checks.
- Blocked: nothing.

## Commits
- c252a1e Q0-Q2 (held-payment businessName, real-stack role tests, theme contract)
- ee3a96a Q3-Q4 (tax-rate create rule, staging cleanup)
- 64e2428 Q5 (contract note)
- this report commit

## Q0(a) in plain words
The held-payment detail route was never open to other roles. Its admin guard runs before the id is parsed or looked up, so OPERATIONS, SALES, SUPPORT, a partner and a vendor get 403 for a real, an unknown or a malformed id, and an anonymous caller gets 401. I could not replay the front-end probe (the API was not running), so I treat its "let in" as a probe artifact. New tests through the real JWT strategy, guards, pipe and filter pin every role and id kind. If the front-end can reproduce it, send the exact request and the role of the login used.

## Other answers
- THEME_SWITCH price: set through the existing price book, SUPER_ADMIN only (propose, then approve with a start date). One owner-approved PROPOSED row already exists. No new route.
- Q3 reuses the code TAX_RATE_IN_FORCE; a start earlier today, or none, means "from now".
- Q5: no themeKey added; the public answer is finished HTML plus headers.

## Checks
- npm.cmd run build: clean. npm.cmd run test:ci: 290 suites, 5564 tests, all pass.
- No integration file was written or run, so no staging cleanup or smoke re-seed was needed.
- Route baseline regenerated: 1439 routes, no content change (no route added or removed).

## Assumptions
See DISPATCH_STATUS_A4.md (probe artifact reading; reused error code; --count prints tenants plus tax rows as one number).

## Questions
None.

## Owner commands
- Nothing needs running for these changes. After a staging run that creates tax rows, from backend-api: npm.cmd run test:cleanup-staging, then npm.cmd run test:cleanup-staging -- --count (must print 0).
- Not pushed.
