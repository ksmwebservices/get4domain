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

## P2.6 Installable app feel (phone bottom bar and PWA)
Commit `c2b8366` plus the final touches in the commit after it. Tests: `app-shell.test.ts` (new, 25 checks) with portal, register, host-routing, flag and copy-rule suites: 155/155. `tsc` clean, `next build` passes. Browser check: `node scripts/pwa/shots.mjs` against `next start` (flag on, sample mode, main host and `directory.localhost`): 33 of 33 checks pass. Screenshots at 375 px (and 1280 for the desktop check) are in `docs/v3/p2-shots/`.

**(a) Bottom bar** (`components/portal/MobileNav.tsx`, rules in `lib/v3-public/app-nav.ts`)
- Home, Search (directory search), Categories (`/industries`), Plans (`/pricing`), More. Below the `md` breakpoint (768 px) only; `display:none` at 1280 (checked). Tablets keep the header menu.
- More is a bottom sheet (dialog: Escape, backdrop and X close, focus moves in and returns, Tab stays inside, page scroll locked): Sign in, Start free, Product, How it works, Guides, Partners, Install app.
- Thumb-sized: every control 75 by 64 px (checked at least 44). Active state: brand colour, a bar on top of the tab, `aria-current="page"`. A link to the other host (for example Search from the main host when the directory is its own host) is never marked active; the check is by path on this host.
- Safe area: bottom padding `env(safe-area-inset-bottom)`; `viewport-fit=cover` is set on the two public layouts only (the V2 pages keep the old viewport).
- Never covers content: a spacer of the same height follows the footer, so scrolled to the end the footer ends above the bar (checked on home and register). Hidden while a text field has focus (the on-screen keyboard), shown again after. Hidden in print.
- Not shown on legal pages (the ten policy paths and `/legal/*`): my choice, they are long reading with their own links. Easy to change in `showAppNav`.
- Used on both hosts: the bar is in `PortalShell`, which serves the main site and the directory.

**(b) PWA**
- Manifest (`src/app/manifest.ts`, served at `/manifest.webmanifest` on every host): id, name, short name, standalone, start url `/`, scope `/`, theme `#2563eb` (the root layout's colour), four local icons, shortcuts Search and Plans. Root layout adds `appleWebApp` meta.
- Icons: drawn by `scripts/pwa/make-icons.mjs` into `public/icons/`: `app-icon.svg`, `app-icon-maskable.svg`, `app-192.png`, `app-512.png`, `app-maskable-512.png`, `apple-touch-180.png` (the "G" is a path, no font, no external image). The older `icon-192.png` and friends stay for the V2 pages.
- Service worker: I did not add a second worker. `/sw.js` already existed and carries the dashboard's Web Push; two workers cannot share the scope `/`, and a second registration would replace the first and break push. So `public/sw.js` was tightened and extended, push handlers unchanged:
  - caches only `/offline.html`, `/icons/app-192.png` and `/icons/app-512.png`, added one by one at install, old caches removed on activate (checked in the browser: the cache holds exactly those three files on both hosts, and still only those after visiting a page and calling `/directory-api/...`);
  - pages: network only, never cached; a 404, 410, redirect, noindex header or a flag-off 404 passes through untouched; the offline page appears only when the network itself fails (checked with the worker's network switched off);
  - everything else (API, scripts, images, other origins, non-GET) is not intercepted at all;
  - `/offline.html` is a self-contained static file (inline style, no script, no external address, noindex) so it looks right offline; the old `/offline` route is no longer used by the worker.
  - `next.config.ts` serves `/sw.js` with `Cache-Control: no-cache` and `Service-Worker-Allowed: /`.
- Registration (`ServiceWorkerRegister`) sits in `PortalShell`, which asserts `V3_PUBLIC_ENABLED`, so with the flag off nothing registers. A worker registered earlier is harmless (it never alters a response). The directory host gets its own registration and cache (checked on `directory.localhost`).
- Install item in More: uses `beforeinstallprompt` (Chrome, Edge, Android) and shows "Thank you..." after accepting; on iPhone, iPad and iPadOS it shows the "Add to Home Screen" hint (checked with an iPhone user agent); hidden when the app is already installed or the browser offers no way. The item therefore does not appear on desktop Firefox or Safari.

Choices made and limits:
- The install prompt event can fire before the page has loaded its script; if missed, the item is absent until the next visit.
- The service worker does not make pages available offline, by design (they depend on flags, hosts and login).
- Not tested on real iOS or Android devices, only in Chromium with phone emulation. The Lighthouse "installable" audit was not run.
- `docs/v3/j1-shots/` (from the earlier dispatch) is still untracked and was left alone.
