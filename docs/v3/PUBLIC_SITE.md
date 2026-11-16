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
| `/account/login`, `/account/register`, `/account/forgot-password` | Business sign-in, sign-up, reset request | On success the visitor continues to `NEXT_PUBLIC_VENDOR_APP_URL`. `/directory-api/auth/{login,register,forgot}` is the proxy. |
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
| `NEXT_PUBLIC_VENDOR_APP_URL` | The business app (Vite app) address; where sign-in, sign-up and approval continue. | none: the screens say it is not set up yet |
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
- Sign-in: `owner@example.invalid` with `Password1` works; `taken@example.invalid` is the "already exists" case on sign-up.
- Click-out: `/go/b-1001?src=city` answers a 302 to an invalid-domain sample address.

## 6. Checks

- `npx tsc --noEmit` (typecheck), `npm run build`.
- `npm run test:v3-public`: 84 unit tests (`node:test`, no new dependency): flag and configuration, route guard, the directory gate and the list of live routes, page model to metadata (title with brand at most 60, canonical, robots, prev and next), card and click-out rules, pagination, JSON-LD escaping, copy rules over the whole strings module (banned words, timeframes, ranking claims, prices, contact details), error-code messages, claim and sign-in calls, the four listing states, robots and sitemap text, firm identity.
- `npm run smoke:v3-public` (after a build): 474 checks against real servers: flag off (every new route 404, unknown addresses stay 404, the root JSON-LD unchanged, live pages untouched, robots and sitemap unchanged) and flag on (real 404 and 410 with noindex for unknown and removed directory addresses, only the page model JSON-LD on directory, claim, account and legal routes, landmarks, one H1, skip link, labels, no contact links, single Visit site link, JSON-LD parses, robots and canonical from the model, pagination, claim screens, legal drafts, sitemaps, robots additions, click-out, no console output in the new code).
- Lint: the app has no ESLint configuration (`next lint` opens an interactive setup), so lint was not run. Accessibility was checked by the smoke test and by hand against the page markup; Lighthouse was not run.

## 7. Checklist before the flag goes on in production

Blocking (owner decisions or backend work, see `PUBLIC_GAPS.md`):

- [ ] Counsel approves or replaces the five legal texts (G18), the GSTIN is set (G6).
- [x] Real 404 and 410 for directory addresses (gate, section 3). `src/app/loading.tsx` stays as it is; the same soft 404 on other live dynamic pages such as `/demo/*` is a separate live-site matter and is not changed.
- [x] Site-wide JSON-LD kept off the directory, claim, account and legal routes (section 3, item 4). Build with `V3_PUBLIC_ENABLED` unset (the flag is a run-time setting); a build with it set would make `headers()` run while prerendering.
- [ ] Decide the directory home address and its canonical (G11).
- [ ] Backend: business id format or a different click-out prefix (G3); listing state, business id and services on the business model (G4, G5); a public start-claim route (G1); a registered email-off code (G12); reserved segments (G7).
- [ ] Vendor app: token handoff or a plain link (G2); redirect to `/claim/live` after approve (G13); reset-password screen at the address in the email (G14).
- [ ] API trusts `X-Forwarded-For` from the app server so rate limits stay per visitor (G15). nginx already sets it.

Then, in order, on staging with the real API (`V3_PUBLIC_USE_MOCKS=false`):

- [ ] `/directory`, one city, one category, one business: titles, descriptions, canonical, robots as the model says; one Visit site link per card; no contact details.
- [ ] Click-out: `/go/{real id}` redirects to the business subdomain, never a custom domain.
- [ ] Claim: a real claim link end to end including the email-off state if the mail flag is off.
- [ ] `/sitemaps/directory-index.xml` empty while the backend setting `directoryPagesIndexable` is off; `/robots.txt` has no directory lines while it is off.
- [ ] Switch `directoryPagesIndexable` on only after counsel approval; recheck robots and the sitemap.
- [ ] Production: set the flag, restart, repeat the first three checks, submit the directory sitemap in Search Console.

## 8. Files

`src/lib/v3-public/` (flag, config, strings, types, API client, mocks, metadata, click-out, claim, proxies, robots, routes, firm, pagination, tests), `src/components/directory/`, `src/app/(directory)/` (layout, pages, handlers), `scripts/v3-public/` (test hook, smoke). Edited existing files: `src/middleware.ts`, `next.config.ts`, `package.json`, `.env.local.example`.
