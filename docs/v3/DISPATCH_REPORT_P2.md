# Dispatch report P2: registration (branch v3-pub-fe10, from v3-pub-fe9)

Not pushed. No .env read. Backend untouched (read only: `get4domain-w2/backend-api` auth, vendors, v3-duplicates, v3-trial, plans/registration).
Tests: `register.test.ts` + `site-copy-rules.test.ts` 65/65 pass. `tsc --noEmit` clean. `next build` passes.

## P2.1 Track on every signup
- Cause: `register-proxy.ts` sent `track` only for a paid plan, so a free signup never reached `RegistrationHook.afterRegister` (it returns when no track), and no trial site was made.
- Backend contract: `RegisterDto.track` is `IsIn(['handyman','professional','ecommerce'])`, lower case. Category tiers (`minTier`) are upper case `HANDYMAN|PROFESSIONAL|ECOMMERCE`. Values match after lower-casing. New `TRACKS`, `trackOfTier`, `DEFAULT_TRACK` in `register.ts`; `trackFor` in `register-proxy.ts`.
- Rule: a paid plan keeps its own track. The free plan takes the track from the chosen category's `minTier` (server-side, from the API category list `fetchCategories`, never from the browser).
- Choice made: if the category cannot be resolved (list unreachable, or a category only the static catalogue knows, or an unknown tier) the track is `handyman` (the smallest), never none. Owner may prefer a different fallback.
- The backend only provisions when plan setting `registrationProvisioning` is true; that is a backend switch I cannot see from here.
- Tests: free signup per tier, paid plan wins, unresolved category falls back, value set, sample mode.

## P2.2 Two register paths
- `/register` on the main host rewrites to `/v3-site/register`, whose `RegisterForm` (components/site) posts to `/directory-api/register` = `register-proxy`. That is the real register page.
- `auth-proxy.ts` `register` action is used by the directory host's `/account/register` (`AuthForms` RegisterForm), which is still linked from the directory sign-in page. It is not unused, so nothing was removed (auth-proxy also serves login, forgot, reset).
- Finding for the owner: that second path sends no `track`, no `subdomain`, no referral, and has no category-to-track data (V2 industry ids only), so signups through it get no trial site. Decision needed: redirect `/account/register` to `/register`, or retire it.

## P2.3 Error messages
`mapRegisterFailure` now reads the code first. New keys in `SITE.register.errors`: `businessDuplicate` (DUPLICATE_BUSINESS), `businessPossible` (DUPLICATE_POSSIBLE), `mailNotReady` (MAIL_DISABLED, EMAIL_NOT_CONFIGURED, EMAIL_NOT_LIVE), `server` (any other 5xx), `fieldsSummary` (banner over field errors; it used to show the generic "could not create" line). Already mapped, kept: existing email (409), weak password, subdomain taken/reserved/invalid, rate limit (429), service unavailable.
- Duplicate answers carry candidate businesses and a claim route; those are dropped, the words name no business, number or address. Test checks it.
- All new copy passes the existing copy-rule tests. The `server` words say to try signing in, since a 500 can come after the account exists.
- Behaviour change: a 500 now maps to `server` instead of `general`.

## P2.4 After registration
- The answer of POST /auth/register is `{ accessToken, user }` only; it has no site fact. So `RegisterResult` has `site: 'live' | 'pending'`, `live` only if the answer says `data.site.published === true` (assumed field, gap P2-G1; the backend does not send it today). In real mode today it is always `pending`.
- Pending: heading "Your account is created", "We are setting up your site. It is not live yet.", the business app button (if the hand-off worked) and a Sign in link to `/login`. The old "Your trial site is live" now shows only for `live`.
- Choice made: on pending there is no automatic redirect to the business app (the note would flash away); the visitor clicks. `live` still redirects.

## P2.5 Form fields vs backend (no fields added)
Backend `RegisterDto` takes, and the form does not ask for:
- `city`, `area`, `pincode`, `gstin` (make the duplicate check sharper; none stored by registration). Without pincode/area the medium duplicate rule stays silent.
- `confirmDistinct` (the answer to "Is this your business?" after a DUPLICATE_POSSIBLE 409; without it the visitor can only see the `businessPossible` message and cannot continue).
- `product` (`leadspace` only; the public form never sends it).
Also sent by the server, not asked: `referralCode` (cookie), `track` (now derived).
Observation: the proxy sends `industry` = category family (or pack key lower case), not the category key; the key is only the fallback. The backend duplicate check uses `industry` as its category. Check that is what the backend wants.
Form asks for, backend never reads: terms checkbox, term months (client-side only).
