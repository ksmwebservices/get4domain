# V3 Public Site (Frontend Slice 4)

The directory, business profiles, claim flow, business sign-in and sign-up, and legal pages of Get4Domain V3, inside the existing Next.js app (`get4domain_mvp`). Server rendered. **Off by default: with the flag off the live site behaves exactly as before.** Branch `v3-pub`. Nothing here is pushed or deployed.

Related: `PUBLIC_SITE_CONTRACT.md` (API shapes and the Step 0 findings), `PUBLIC_GAPS.md` (what the backend and the live app still need), `PUBLIC_LEGAL_DRAFTS.md` (legal texts are drafts for counsel).

## 1. Routes

| Address | What | Notes |
|---|---|---|
| `/directory` | Directory home | Renders the model for path `/`. The marketing home owns `/` (G11). |
| `/{city}`, `/{city}/{category}`, `/{city}/{category}-in-{locality}`, `/state/{state}`, `/category/{category}`, `/pincode/{pin}/{category}`, each with `/page/{n}` | Listing pages | No route of their own: see section 3. Rendered by `/directory-pages/[...path]`. |
| `/business/{slug}` | Business profile | Same mechanism. |
| `/go/{businessId}` | Click-out | Middleware rewrite to `/directory-go/{id}`, which asks the API and answers a 302. Only for a uuid or cuid segment (G3); every other `/go/..` is still the campaign page. |
| `/directory-api/page-visit` | Beacon proxy | Tokens only (path, utm_source, utm_medium, utm_campaign, kw). Always answers ok. |
| `/claim`, `/claim/start/{slug}`, `/claim/{token}`, `/claim/live`, `/claim/screens` | Claim flow | `/claim/screens` (every claim screen on one page) exists only in sample mode. |
| `/directory-api/claim/{start,otp-request,otp-verify,setup}` | Claim proxy | The browser talks only to this site. |
| `/account/login`, `/account/register`, `/account/forgot-password`, `/account/reset-password?token=` | Business sign-in, sign-up, reset request, reset confirm | Sign-in hands the owner to `NEXT_PUBLIC_VENDOR_APP_URL` (section 3a). Sign-up links on to the business app. The reset request (`POST /v3/account/password/reset/request`) says the same thing for every address and shows an "email is switched off" state on `MAIL_DISABLED`; the reset page (`POST /v3/account/password/reset/confirm`) shows one "link is not valid" screen for an invalid, used, expired or short (under 20 characters) token, with no API call for a short one; the body is `{ token, newPassword }`. `/directory-api/auth/{login,register,forgot,reset}` is the proxy. |
| `/claim/live` | Go-live notice | Follows `?redirectTo=` when it is safe (section 3b). |
| `/legal`, `/legal/{terms,privacy,refund-and-cancellation,wallet-terms,directory-listing-terms}` | Legal drafts | `noindex, nofollow` until counsel approves. |
| `/sitemaps/directory-index.xml`, `/sitemaps/directory-{n}.xml` | Directory sitemaps | The backend's text as written. `/sitemap.xml` is unchanged. |
| `/robots.txt` | Main robots | Flag on: served by `/directory-robots` (middleware rewrite), existing rules kept; directory Disallow lines and one directory Sitemap line added only when the backend says the pages are indexable. |

Frozen rules held in the code: the only action on a listing is a Visit site link through `/go/{id}` (never a direct link, never the API host, never a custom domain); no phone, email, WhatsApp, `tel:`, `mailto:` or `wa.me` anywhere on a directory page (smoke test checks every page); robots, canonical, title, description, H1, breadcrumbs, JSON-LD and prev and next are rendered exactly as the page model gives them; the `www` host is never used as a canonical origin; no ranking claims; no counts, ratings or reviews other than what the model carries (it carries none).

## 2. The flag and the environment

Names only (values in `.env.local`, never committed; the example file lists them):

| Name | Meaning | Default |
|---|---|---|
| `V3_PUBLIC_ENABLED` | Exactly `true` turns the public site on. Read from the server environment on every request. | off |
| `V3_PUBLIC_USE_MOCKS` | `false` calls the API; anything else uses the built-in sample data and never touches the network. | on |
| `API_BASE_URL` | Server-only API address (preferred). | none |
| `NEXT_PUBLIC_API_BASE_URL` | Fallback API address. | none |
| `NEXT_PUBLIC_VENDOR_APP_URL` | The business app (Vite app) address; where sign-in, claim setup and approval continue. The handoff code goes on this address as `#handoff=`; the fallback is this address plus `/login`. | none: the screens say it is not set up yet |
| `V3_PUBLIC_SITE_ORIGIN` | Canonical origin for the directory Sitemap line (`www` is stripped). | none: no Sitemap line is added |
| `V3_PUBLIC_REVALIDATE_SECONDS` | Cache time of a page model when the API gives no max-age (10 to 86400). | 300 |

There is no production address in the code. Real mode with no API address shows the error screen, not a guessed address.

## 3. How the flag keeps the live site unchanged

Three measures, each checked by `npm run smoke:v3-public` against two real built servers (flag off and flag on):

1. **Fixed routes** (`/directory`, `/claim`, `/legal`, `/account`, `/sitemaps` and the `/directory-*` handlers): while the flag is off the middleware answers a plain 404 before anything renders. (Pages cannot do this themselves: the live root `loading.tsx` sends a page's HTTP status before the page runs, G9.)
2. **The directory addresses** (`/{city}` and the rest) have no route of their own, and a page cannot answer a real 404 or 410 (the live root `loading.tsx` sends a page's status before the page runs). So, while the flag is on, the middleware runs the **directory gate** (`src/lib/v3-public/gate.ts`) for an address that could be a directory address, that is, any path whose first segment is not a live route (`LIVE_SEGMENTS`, kept in step with the folders of `src/app` by a test). The gate asks the directory API (the same call the page makes; answers are remembered for a short while) and answers the real status itself: **404 or 410 with `X-Robots-Tag: noindex, nofollow` and a noindex page**, 503 if the API cannot answer, otherwise a rewrite to `/directory-pages/...`, which renders the model. With the flag off the gate does not run, so an unknown address is the same real 404 as before. `loading.tsx` itself is untouched.
3. **`/go/{id}`, `/robots.txt`** are touched by the middleware only while the flag is on.
4. **Site-wide JSON-LD.** The root layout's Organization, SoftwareApplication and WebSite scripts stay exactly as they are for every existing page and for every request while the flag is off (`headers()` is not even called, so marketing pages stay static). While the flag is on, the middleware marks requests for the directory, claim, account and legal routes with `x-v3-route: 1` and the root layout leaves those three scripts out, so those routes carry only the page model's JSON-LD (none on claim, account and legal).

Existing pages, `sitemap.ts`, `robots.ts`, `llms.txt` and all existing metadata are untouched. The only edits to existing files are additive and flag-guarded: `src/middleware.ts`, `src/app/layout.tsx` (the JSON-LD guard above), `package.json` (two scripts) and `.env.local.example` (names).

### 3a. Handoff to the business app

After a visitor signs in on `/account/login`, or finishes the setup step of a claim, the server (never the browser) signs the owner in and calls `POST /v3/auth/handoff` with that owner's bearer token; it answers `{ code, expiresAt, ttlSeconds }` and only `code` is used. The vendor app's redeem answers tokens only. The token lives inside that one server call; only the one-time code goes back to the page. The page then sends the visitor to `NEXT_PUBLIC_VENDOR_APP_URL` with the code in the URL **fragment**: `https://<vendor app>/#handoff=<code>`. A fragment is not sent to any server and not written to logs. The pages are `noindex` with `Referrer-Policy: no-referrer`.

If the route is missing, answers an error, gives no usable code, or the sign-in answer has no `accessToken`, the visitor goes to the vendor app's own login (`<vendor app>/login`) instead and signs in there. With no vendor app address the screen says so. For the claim setup the password just typed is used for that one sign-in and is not kept. Sign-up (`/account/register`) is unchanged: it links on to the business app.

### 3b. redirectTo after approval

Approval happens in the vendor app. It sends the owner to `/claim/live`, optionally with `?redirectTo=`. The page follows the value only when it is a relative path starting with one `/`, or an absolute `https:` address without credentials. It drops anything with a space, control character or backslash, `//host`, `javascript:`, `data:`, plain `http:` and every other scheme, and then shows the normal link to the business app. Relative paths resolve on this site. The rule is in `lib/v3-public/redirect.ts` and is tested (`claim-and-auth.test.ts`) and smoke checked.

## 4. Turning it on in staging

1. Set in the staging environment: `V3_PUBLIC_ENABLED=true`, `V3_PUBLIC_USE_MOCKS=true` (first), `V3_PUBLIC_SITE_ORIGIN=<staging origin>`, `NEXT_PUBLIC_VENDOR_APP_URL=<staging business app>`.
2. Restart the app (the flag is read at runtime, no rebuild). Open `/directory`, `/chennai/plumbers`, `/business/sri-murugan-plumbing`, `/claim`, `/legal`.
3. To use the real API: set `API_BASE_URL=<staging API>` and `V3_PUBLIC_USE_MOCKS=false`, restart. Check `/directory` and one business page; check `/sitemaps/directory-index.xml` and `/robots.txt`.
4. Turn it off again by unsetting `V3_PUBLIC_ENABLED` and restarting.

## 5. Reviewing with sample data (no API, no database)

`npm run build`, then `V3_PUBLIC_ENABLED=true npx next start`. The sample data follows the real page model. Useful addresses:

- Listings: `/directory`, `/chennai`, `/chennai/plumbers` (three pages with `/page/2`, `/page/3`), `/chennai/plumbers-in-adyar`, a thin page `/chennai/plumbers-in-velachery`, an empty page `/pincode/600020/plumbers`, `/state/tamil-nadu`, `/category/plumbers`.
- Businesses: unclaimed `/business/sri-murugan-plumbing`, claimed with a backlink block `/business/anand-electricals`, listing only (no site) `/business/kavitha-home-care`, removed `/business/removed-shop`, unknown `/business/nope`.
- Claim: `/claim?name=murugan`, `/claim/start/{slug}` for each of the four states, `/claim/mock-claim-token-00000000` (code `123456` works, `111111` fails, `000000` shows the attempts message), `/claim/mock-mail-off-token-0000` (email switched off), `/claim/screens` (all screens).
- Sign-in: `owner@example.invalid` with `Password1` works and hands off with a code (`#handoff=mock-handoff-code-0000`); `nohandoff@example.invalid` with `Password1` signs in but gets no code (the vendor app login); `taken@example.invalid` is the "already exists" case on sign-up. Claim setup in sample mode hands off the same way (`nohandoff@example.invalid` as the login email gives no code).
- Reset: `/account/forgot-password` (`mailoff@example.invalid` shows the email-switched-off state), `/account/reset-password?token=mock-reset-token-000000000` works, `?token=mock-reset-expired-0000000`, any other well-formed token, or any token under 20 characters shows "not valid"; no token shows the missing-link text. The new password needs 8 to 72 characters with a capital letter and a number (the API's rule).
- Go-live redirect: `/claim/live?redirectTo=/pricing` follows to `/pricing`; `javascript:`, `//host`, `http:` and `data:` values are dropped.
- Click-out: `/go/b-1001?src=city` answers a 302 to an invalid-domain sample address.

## 6. Checks

- `npx tsc --noEmit` (typecheck), `npm run build`.
- `npm run test:v3-public`: 96 unit tests (`node:test`, no new dependency): flag and configuration, route guard, the directory gate and the list of live routes, page model to metadata (title with brand at most 60, canonical, robots, prev and next), card and click-out rules, pagination, JSON-LD escaping, copy rules over the whole strings module (banned words, timeframes, ranking claims, prices, contact details), error-code messages, claim, sign-in, handoff target and reset calls, redirectTo rules, the four listing states, robots and sitemap text, firm identity.
- `npm run smoke:v3-public` (after a build): 506 checks against real servers: flag off (every new route 404, unknown addresses stay 404, the root JSON-LD unchanged, live pages untouched, robots and sitemap unchanged) and flag on (real 404 and 410 with noindex for unknown and removed directory addresses, only the page model JSON-LD on directory, claim, account and legal routes, landmarks, one H1, skip link, labels, no contact links, single Visit site link, JSON-LD parses, robots and canonical from the model, pagination, claim screens, reset pages and calls, handoff answers, redirectTo handling, legal drafts, sitemaps, robots additions, click-out, no console output in the new code).
- Lint: the app has no ESLint configuration (`next lint` opens an interactive setup), so lint was not run. Accessibility was checked by the smoke test and by hand against the page markup; Lighthouse was not run.

## 7. Checklist before the flag goes on in production

Blocking (owner decisions or backend work, see `PUBLIC_GAPS.md`):

- [ ] Counsel approves or replaces the five legal texts (G18), the GSTIN is set (G6).
- [x] Real 404 and 410 for directory addresses (gate, section 3). `src/app/loading.tsx` stays as it is; the same soft 404 on other live dynamic pages such as `/demo/*` is a separate live-site matter and is not changed.
- [x] Site-wide JSON-LD kept off the directory, claim, account and legal routes (section 3, item 4). Build with `V3_PUBLIC_ENABLED` unset (the flag is a run-time setting); a build with it set would make `headers()` run while prerendering.
- [ ] Decide the directory home address and its canonical (G11).
- [ ] Backend: business id format or a different click-out prefix (G3); listing state, business id and services on the business model (G4, G5); a public start-claim route (G1); a registered email-off code (G12); reserved segments (G7).
- [ ] Backend and vendor app: `POST /v3/auth/handoff` and the vendor app reading `#handoff=` (G2); vendor app redirect to `/claim/live` after approve (G13); the reset email linking to `/account/reset-password?token=` on this site (G14); the assumed request and answer field names (G2, G14).
- [ ] API trusts `X-Forwarded-For` from the app server so rate limits stay per visitor (G15). nginx already sets it.

Then, in order, on staging with the real API (`V3_PUBLIC_USE_MOCKS=false`):

- [ ] `/directory`, one city, one category, one business: titles, descriptions, canonical, robots as the model says; one Visit site link per card; no contact details.
- [ ] Click-out: `/go/{real id}` redirects to the business subdomain, never a custom domain.
- [ ] Claim: a real claim link end to end including the email-off state if the mail flag is off.
- [ ] `/sitemaps/directory-index.xml` empty while the backend setting `directoryPagesIndexable` is off; `/robots.txt` has no directory lines while it is off.
- [ ] Switch `directoryPagesIndexable` on only after counsel approval; recheck robots and the sitemap.
- [ ] Production: set the flag, restart, repeat the first three checks, submit the directory sitemap in Search Console.

## 8. Files

`src/lib/v3-public/` (flag, config, strings, types, API client, mocks, metadata, click-out, claim, proxies, handoff and redirect rules, robots, routes, firm, pagination, tests), `src/components/directory/`, `src/app/(directory)/` (layout, pages, handlers), `scripts/v3-public/` (test hook, smoke). Edited existing files: `src/middleware.ts`, `next.config.ts`, `package.json`, `.env.local.example`.

## 9. One domain, subdomains (Slice 6)

Branch `v3-pub-host`. Everything here needs `V3_PUBLIC_ENABLED=true` **and** `MAIN_HOST` set. With the flag off, or with no `MAIN_HOST`, nothing in this section applies and behaviour is as before (checked by the smoke test: flag off with all six names set changes nothing). Plan and findings: `HOSTNAMES_PLAN.md`.

### Environment (names only, in `.env.local.example`; no default anywhere in code)

`MAIN_HOST`, `DIRECTORY_HOST`, `APP_HOST`, `ADMIN_HOST`, `API_HOST`, `MEDIA_HOST`. A host name only (no scheme). `www.` of the main host is the same site, non-canonical. An unset name means that host class is not configured. Vendor hosts need no name: `<label>.<main host without www>`.

### Host table as implemented (`lib/v3-public/hostnames.ts`, `host-routing.ts`, `middleware.ts`)

| Host | Behaviour |
|---|---|
| main | Marketing as before. `/directory` and `/directory/...` go 308 to the directory host without the prefix (query kept). Directory addresses are not served (no gate); `/sitemaps/...` is a 404. `/robots.txt` is the existing rules and main sitemaps only. |
| `www.` main | 308 to the canonical main host, path and query kept. |
| directory | `/` is the directory home (internal rewrite to `/directory`, public address has no prefix). `/directory...` goes 308 to the same address without the prefix. Directory, business, claim, account, legal, `/go/{business id}`, `/sitemaps/...`, `/robots.txt` are served. `/sitemap.xml` is the directory sitemap index. Marketing and every other live route is a real 404; a campaign slug under `/go/` is a 404. |
| `<vendor>` | V3 first: the backend's stored page, sitemap.xml, robots.txt, llms.txt and `/assets/...` are relayed by `/vendor-site` (internal). A host the backend answers a plain 404 for goes on to the V2 renderer (`/site/<name>`) so V2 vendors keep working until cutover; if the V2 rewrite does not apply it is a plain 404, never marketing. |
| app, admin, api, media, reserved labels (www aside), V2 client names | Never handled here: plain 404, noindex. |
| anything else (other domains, two-level names) | Real 404, never the marketing page. |

Redirect targets are always `https` (the request scheme is not trusted; localhost is http).

### Vendor sites

No content renderer in this app: the backend renders and stores complete pages (SEO head, Organization/WebSite/FAQPage JSON-LD, areaServed, backlink block, Free listing-only rules, noindex rules, takedown, redirects). The app relays `GET /v3/public/site/by-host` unchanged (body, `Content-Type`, `ETag`, `Cache-Control`, `Content-Language`, `X-Robots-Tag`; 304, 301/302 with an https `Location` only, 451, uniform 404). A backend that cannot answer gives a kind 503 not-available page (noindex, no contact links). Samples in mock mode: `sample-pro`, `sample-free`, `sample-draft`, `sample-hostile`, `sample-moved`, `sample-takedown`, `sample-down` (`.<main host>`).

### Go-live checklist for hostnames

- [ ] Backend items A to E of `HOSTNAMES_PLAN.md` (directory origin, brand on the main origin, home path `/`, robots line) **before** the directory host is indexed. Blocking.
- [ ] DNS (Cloudflare): `directory`, `app`, `admin`, `api`, `media` and the wildcard `*` under the main domain; `www` redirected to the bare host.
- [ ] nginx server blocks: main + `www` and `directory` and `*` to this app (port 3006) with `Host $host` and `X-Forwarded-For` kept; explicit blocks for `app` (vendor SPA), `admin` (admin SPA), `api`, and the V2 client names ahead of the wildcard; SPA fallback and `X-Robots-Tag: noindex, nofollow` on `app` and `admin`; `nginx -t` before reload, backup of the old config.
- [ ] The six host names set in the server's private environment; `V3_PUBLIC_ENABLED` set last.
- [ ] `VITE_API_BASE_URL=https://<API_HOST>` when building the vendor and admin apps; `NEXT_PUBLIC_VENDOR_APP_URL=https://<APP_HOST>`.
- [ ] V2 names still served by V2 (see G24); first V3 vendor site checked on its host: page, `/sitemap.xml`, `/robots.txt`, `/llms.txt`.
- [ ] Checks: `npm run test:v3-public` (unit), `npm run smoke:v3-public` (real servers: flag off with hosts set, flag on without hosts, flag on with hosts).

## 10. Commercial public pages (Slice 7)

Branch `v3-pub-fe3`. Plan and API shapes: `PUBLIC_COMMERCE_PLAN.md`. Same switch as section 9: the pages need `V3_PUBLIC_ENABLED=true` and `MAIN_HOST` set. They replace their live twins only on the canonical main host, by an internal rewrite to `/v3-site/...` (typing `/v3-site/...` is a 404). Flag off, or no `MAIN_HOST`: the live pages answer exactly as before (smoke checked with the host names set and the flag off).

| Address (main host) | Page | Notes |
|---|---|---|
| `/` | Home | Organization, WebSite and FAQPage JSON-LD |
| `/pricing` | Pricing | free trial, Handyman, Professional, Ecommerce; term switch quarterly, half-yearly, annual; prices without GST from `GET /v3/public/pricing`; GST line; a plan with no price shows words and no number; add-on packs with no price; Free and paid comparison; feature table; FAQ (FAQPage JSON-LD only, no price schema); every call to action goes to `/register?plan=..&term=..` |
| `/register` | Self-service register | business name, searchable category, site address with live availability and the reserved-name message, owner name, email, phone, password, terms; carries plan, term and the referral cookie; field errors in plain words; on success goes to the business app (`APP_HOST` or `NEXT_PUBLIC_VENDOR_APP_URL`) with the handoff code, or to its login. `noindex`. |
| `/login` | Sign in | the Slice 4 sign-in; forgot and reset stay `/account/...` |
| `/r/{code}` | Referral landing | valid code: first-party cookie `g4d_ref` holding the code only (httpOnly, SameSite=Lax, Secure, no Domain), then `/register`. Unknown, disabled or unreadable code: no cookie, `/referral-link` (neutral page, code not repeated). |
| `/how-it-works`, `/industries`, `/features`, `/about`, `/contact` | Marketing | breadcrumbs and JSON-LD; industries lists the published packs (12; 16 with `V3_REGULATED_PACKS_PUBLIC=true`), links each to its page and shows the categories from the API |
| `/industries/{slug}` | Industry landing page | see section 11 |

Browser calls (same origin, flag guarded): `POST /directory-api/register`, `GET /directory-api/subdomain?slug=` (the server asks `GET /v3/public/subdomain-availability?name=`). No payment form or card field exists anywhere on the public site: payment happens only inside the business app through the gateway.

Copy: one module (`lib/v3-public/site-strings.ts`), tested over every string: no workspace, BOS or LeadSpace, "enquiries" not "leads", no timeframes (the three billing terms are allowed), no written price, no discount, offer, coupon or deal wording, no ranking claim, no rating or review claim. Smoke repeats the rules on the rendered text of every page.

Sitemap: the first six pages have the same addresses as the live ones, which `sitemap.xml` already lists. The industry landing pages (section 11) are not in it: they have their own `/sitemap-industries.xml` (flag on, main host only), named in robots.txt only while the flag is on. `sitemap.xml` itself is byte for byte the same with the flag on and off (checked). Register and referral pages are noindex.

Reviewing with samples: `npm run build`, then `V3_PUBLIC_ENABLED=true MAIN_HOST=localhost DIRECTORY_HOST=directory.localhost npx next start` and open `/`, `/pricing`, `/register?plan=professional&term=12`, `/r/SAMPLE-PARTNER` (valid), `/r/SAMPLE-OFF` (disabled), `/industries`. Sample addresses: `taken-site` is taken, `taken@example.invalid` is a taken email, `api` is reserved.

Go-live checklist for the commercial pages:

- [ ] Backend: the Wave 3 shapes are built in (G28 partly, G29, G30 closed). Still to confirm: what `/auth/register` answers (G28), and the public pack list (G31).
- [ ] Owner decision G32: the commercial pages replace the live marketing pages on the main host when the flag and `MAIN_HOST` are set. Keep the flag off on the live server until this is intended.
- [ ] `APP_HOST` (or `NEXT_PUBLIC_VENDOR_APP_URL`) set so register can hand off to the business app.
- [ ] Referral and registration reach the API with the visitor address (G15).
- [ ] Counsel approves the legal pages that register links to (G18).

## 11. Industry landing pages (dispatch B3)

Branch `v3-pub-fe4`. Same switch as sections 9 and 10 (`V3_PUBLIC_ENABLED` and `MAIN_HOST`). Report: `DISPATCH_REPORT_B3.md`.

- **Routes.** `/industries/{slug}` on the main host, one per published pack (12): `property-and-real-estate`, `retail-and-ecommerce`, `food-service`, `field-services-and-trades`, `vehicle-services`, `logistics-and-freight`, `gym-salon-and-wellness`, `education-and-training`, `consulting-and-creative`, `hospitality-travel-and-events`, `rentals-and-fleet`, `b2b-supplier-and-dealer`. The middleware rewrites them to `/v3-site/industries/{slug}` (typing that address is a 404). No slug equals a live industry id, so `/industries/travel` and the other live pages are untouched.
- **Regulated packs.** `CLINIC`, `LAB`, `PHARMACY` and `PRACTICE_LEGAL_FINANCE` (slugs `clinic-and-patient-care`, `lab-and-diagnostics`, `pharmacy-and-medical-store`, `legal-and-finance-practice`) have no page, are not on the hub or in the sitemap, and answer a real 404, unless `V3_REGULATED_PACKS_PUBLIC` is exactly `true` (default off). `/register?pack=` ignores them while they are unpublished.
- **Content.** Server rendered from `lib/v3-public/packs.ts` and `lib/v3-public/industries.ts` (kinds of business) and `site-strings.ts` (`SITE.industryPage`): what the pack gives (its working areas), the kinds of business it suits, the registered categories from the API, how it works (register, trial site live, move to a paid plan), a call to action to `/register?pack=KEY`, links to the hub and `/pricing`, and an FAQ. Title is the pack name and "website" with the brand when it fits in 60 characters; description; canonical on the main host; indexable. JSON-LD: FAQPage and BreadcrumbList (no price, offer, rating or review markup). One H1, landmarks, skip link, breadcrumbs.
- **Register.** `/register?pack=FOOD_SERVICE` starts the category list on that pack's categories, with a "Show all categories" button. Only a published pack key counts.
- **Hub.** `/industries` lists only published packs and links each to its page.
- **Sitemap.** The published pages are listed in `/sitemap-industries.xml`, served only with the flag on and `MAIN_HOST` set, and named in robots.txt only then. `sitemap.ts` is unchanged and prerendered (G36).
- **Unknown live industry id.** With the flag on the middleware answers a real 404 for `/industries/{id}` when the id is not a live one (G35).
- **Tests.** `__tests__/industries.test.ts` (publication rules, slugs, metadata length, copy rules over the page text, host routing, JSON-LD) and smoke checks over every page in four servers: flag off, flag on without host names, flag on with host names, and with `V3_REGULATED_PACKS_PUBLIC=true`.

## 12. Wave 3 reconciliation (dispatch B3)

The pricing route, address check, referral check and register fields follow `API_CONTRACT_WAVE3.md` (see G28 to G30). Mock mode feeds the same normaliser and parsers as real mode.


## 13. Dispatch C1 (Wave 4 shapes, real-API probe, theme question)

- **Register refusals.** A validation 400 from `POST /auth/register` lists the field names in `data.fields` (A3-1). `mapRegisterFailure` now reads that list when the message words name no field, so the form marks the right field instead of the general message. Names with no form field (`referralCode`, `track`, `product`) still give the general message. The success answer (HTTP 201, `data.accessToken`), the three address codes and the 409 for an email already registered were already handled; real-mode tests with a stubbed fetch now pin them and check that only contract fields are sent.
- **Vendor-site theme.** Not built here (gap G37). The by-host answer is the backend's finished, stored page, already drawn from the vendor's chosen theme; no theme key and no render data reach this app, and the relay never edits a stored page. A Free site, an unknown theme and a missing theme all arrive as the backend's own page.
- **Real-API probe.** `npm run probe:v3-real -- http://localhost:3008` (or `PROBE_API_BASE_URL`, or `--env NAME`). GET only, no login, nothing created, no secret. Checks pricing, three address names, an unknown referral code, the directory home model (including whether the canonical still carries `/directory`), the sitemap index, robots, llms.txt and an unknown vendor host, each against the site's own parsers. API not reachable: one line, exit 0.


## 14. Dispatch D1 (legal and company pages)

Branch `v3-pub-fe6`. Same switch as sections 9 and 10: the pages need `V3_PUBLIC_ENABLED=true` and `MAIN_HOST`, are reached only by the main-host rewrite to `/v3-site/...` (typing `/v3-site/...` is a 404), and replace a live page only with the flag on. Flag off, or no `MAIN_HOST`: every live page answers as before. Review sheet and open questions: `LEGAL_REVIEW.md`. The text is a plain-language **draft that a lawyer in India must review before the flag goes on.** Report: `DISPATCH_REPORT_D1.md`.

| Address (main host) | Page | Live twin |
|---|---|---|
| `/terms`, `/privacy-policy`, `/refund-policy` | Terms of Service, Privacy Policy, Refund and Cancellation Policy | yes, replaced only with the flag on |
| `/payments-and-billing`, `/delivery-policy`, `/acceptable-use`, `/cookie-notice`, `/disclaimer` | Payments and Billing, Delivery Policy, Acceptable Use, Cookie Notice, Disclaimer | none |
| `/directory-listing-terms`, `/partner-terms` | Directory and Listing Terms, Partner Programme Terms | none |
| `/about`, `/contact` | About Us, Contact (rewritten slice 7 pages) | the slice 7 pages |

- **Framework.** One route `v3-site/[doc]/page.tsx` renders every policy through `components/site/LegalDocument.tsx`: one H1, effective date and version (one constant in `lib/v3-public/legal-meta.ts`), table of contents of the headings, sections, company details, links to the other policies, print friendly (header, footer and contents are hidden when printing). The policy addresses live in `legal-paths.ts` (read by the middleware, kept in step with the registry by a test); the text in `legal-text/*.ts`, gathered by `legal-strings.ts`; About and Contact text in `company-strings.ts`.
- **Firm facts** (`firm-facts.ts`). Legal name, registered address and the GSTIN (only when set) come from `GET /v3/public/firm` in real mode (5 minute cache) and fall back to the decided facts. Support email and phone, grievance officer and CIN come from the environment (`V3_PUBLIC_SUPPORT_EMAIL`, `V3_PUBLIC_SUPPORT_PHONE`, `V3_PUBLIC_GRIEVANCE_OFFICER_NAME`, `..._EMAIL`, `..._PHONE`, `V3_PUBLIC_FIRM_CIN`), all empty by default; an invalid value counts as empty; a page prints nothing for an empty value, and the grievance section exists only when some grievance value is set. Mock mode never touches the network.
- **SEO.** Every page: canonical on the main host, title at most 60 characters with the brand, description, BreadcrumbList JSON-LD; About and Contact also carry one Organization block written from the firm facts only (no rating, logo, founding date or sameAs). The policy pages are listed in `/sitemap-industries.xml` (flag on, main host only); `sitemap.xml`, `robots.txt`, `llms.txt` and the existing metadata are unchanged.
- **Wire-in.** The commerce footer links every policy page, About and Contact (not the older `/legal/*` drafts). `/pricing` and `/register` show "By continuing, you accept the Terms of Service and the Privacy Policy." with links to `/terms` and `/privacy-policy` (`components/site/AcceptNotice.tsx`); the register accept checkbox and its logic are unchanged, its two links now point to the new pages.
- **Checks.** `npm run test:v3-public`: 293 unit tests (legal framework, firm facts, copy rules over all policy and company text, decided facts present, host routing). `npm run smoke:v3-public`: 1633 checks over five real servers (flag off with host names, flag on without host names, flag on with host names, regulated packs on, flag on with every contact value set), including one H1, landmarks, title length, canonical, JSON-LD, table of contents, accessibility structure, forbidden words, no placeholder, no GSTIN line while none is set, flag-off equals live, and the footer and accept-notice wire-in.
- **Not done here.** Lint (the app has no ESLint configuration, G19). No browser pass. The older `/legal/*` drafts on the directory host are untouched.


## 15. Dispatch D2 (owner default terms on the legal pages)

Branch `v3-pub-fe7`. The ten policy pages, About and Contact keep their routes and headings; the text now applies the eight owner defaults (refunds, cancellation, grievance, data, taxes, partner, trial; law and courts were already there). New shared component `components/site/GrievanceBlock.tsx` (name, email, phone and the 48 hours and one month timelines) is used by Contact and by Terms and Refund (`showGrievance` on the document) and prints only when a grievance value is set. The copy guard (`legal-copy-rules.test.ts`, mirrored in the smoke script) allows exactly "48 hours" and "one month", only in a sentence naming the grievance officer or a complaint; every other digit, time word and percentage is still refused. Go-live environment names: `GO_LIVE_PUBLIC.md`. Review sheet: `LEGAL_REVIEW.md` (D2 section). Everything is still behind `V3_PUBLIC_ENABLED`; the flag-off smoke checks pass.
