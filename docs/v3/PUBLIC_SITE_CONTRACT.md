# V3 Public Site Contract (Frontend Slice 4, Step 0)

Branch `v3-pub`, app `get4domain_mvp` (Next.js 15.5, React 19, Tailwind 3, TypeScript strict). Written before any code. Everything here is read from the backend source in `get4domain-w2/backend-api/src` and from this app; nothing was run.

Status of inputs: Amendments 11 to 14 are **not present as files** in `get4domain-site` (only Amendment 08 to 10 exist). The backend docs `V3_SEO_DIRECTORY.md`, `V3_DIRECTORY_CLAIM.md` and `V3_POLICY_TEXT.md` in `get4domain-w2/docs/v3` were used instead, plus the controllers. If an amendment says something different, it wins and this file changes.

## 1. Response conventions

- Most JSON routes pass through the backend `TransformInterceptor`: `{ success, statusCode, message, data, timestamp }`. The client unwraps `data`.
- Routes that use `@Res()` answer the raw body: the sitemaps, `robots.txt`, `llms.txt` (text or XML), the badge, and the `/v3/go` redirect.
- `v3/directory/pages/*` uses `@Res({ passthrough: true })` with an ETag. A 304 returns no body, so the client must keep the last body per URL and reuse it on 304. The Next data cache (`revalidate`) is the first layer; the ETag is the second.
- Errors carry `{ message, code }`. Screens switch on `code`, never on the sentence.
- Rate limits (per minute, per IP): page reads 120, click-out 60, claim status 20, OTP request 3, OTP verify 10, login 10, register 5.

## 2. API routes the public site calls

All paths are relative to the API base (env, never hard-coded).

### 2.1 Directory page models (public, ETag, `Cache-Control: public, max-age=N, stale-while-revalidate=N`)

| Route | Use |
|---|---|
| `GET /v3/directory/pages/resolve?path=/chennai/plumbers-in-adyar/page/2` | The one call for the catch-all. 200 model, 404 `SEO_NOT_FOUND`, 410 `DIRECTORY_GONE` (removed business). |
| `GET /v3/directory/pages/:type` | By type with slug query (`state, city, locality, category, term, pincode, slug, page`). Used only by tests and mocks; the catch-all uses `resolve`. |

`PageModel` (the only thing pages render; nothing is computed on the front end):

```
type: 'home'|'state'|'city'|'category'|'cityCategory'|'localityCategory'|'pincodeCategory'|'business'
path: string
page: { number, totalPages, pageSize, total, prev, next, prevPath, nextPath } | null
meta: { title, description, canonical, robots, indexable, noindexReason, hreflang[] }
h1, intro: string
breadcrumbs: { name, path, url }[]
jsonLd: object[]                     // BreadcrumbList, CollectionPage/ItemList, LocalBusiness
cards: { name, slug, profilePath, locality, category, description, claimed, verified,
         hoursText, imageUrl, visitUrl|null, listingOnly }[]
facets: { kind, items: { name, path, count? }[] }[]
related: { nearbyLocalities[], relatedCategories[], parents[] }
faq: { question, answer }[]
business?: { name, claimed, verified, category, locality, city, description,
             address|null, geo|null, hoursText, imageUrl, visitUrl|null, listingOnly }
```

Notes that shape the build:
- `noindexReason`: `FLAG_OFF | THIN | EMPTY | NOT_INDEXABLE | UNCLAIMED | SUSPENDED`. `meta.robots` is `index, follow, max-image-preview:large` or `noindex, follow`. We render `meta.robots` exactly.
- `card.visitUrl` is the API-host click-out `https://<api>/v3/go/{businessId}?src=<pageType>[&kw=]`. It is the **only** place the business id appears on a page model. The front end parses the id out of it and links `/go/{id}?src=..` on our own host (rule: never a direct link, never the API host). `listingOnly: true` (no site on a subdomain) means no Visit site link is rendered at all.
- The business model has **no services list, no listing state field beyond `claimed`/`verified`, and no business id**. Services as plain text and the four listing states are therefore only partly available (see gaps G4, G5).
- Hours text is `hoursText` only.
- Model never carries phone or email. `v3/directory/businesses` (search) does carry `phone` for claimed businesses: the front end types strip it, nothing ever renders it.

### 2.2 Other directory reads

| Route | Use |
|---|---|
| `GET /v3/directory/backlink-block/:businessId` | `{ brand:{href,text}, links:{href,text}[], html }`. Needs a business id, which the model does not give (G5). |
| `GET /v3/directory/badge-embed/:businessId`, `GET /v3/directory/badge/:id.svg` | Badge snippet and picture. Not rendered in this slice. |
| `GET /v3/directory/businesses?location=&category=&q=&page=&pageSize=` | Search for the claim flow "find your business". Items are `PublicBusinessView` (`slug, name, claimed, category, location, description, ...`). |
| `GET /v3/directory/sitemaps/index.xml`, `/sitemaps/directory-{n}.xml`, `/robots.txt`, `/llms.txt` | Raw bodies, ETag. Sitemaps are empty and robots has no Sitemap line while `directoryPagesIndexable` is OFF. `llms.txt` 404s while not indexable. |
| `POST /v3/directory/page-visits` body `{ path, utm_source?, utm_medium?, utm_campaign?, kw? }` | The beacon. Always answers `{ ok: true }`. Tokens only. |
| `GET /v3/go/:businessId?src=&kw=` | Click-out: 302 to the business subdomain, `X-Robots-Tag: noindex, nofollow`, `no-store`, uniform 404. |

`DIRECTORY_DISALLOW` (robots): `/go/`, `/v3/go/`, `/search`, `/*?*q=`, `/*?*query=`, `/*?*sort=`, `/*?*order=`, `/*?*filter=`, `/*?*page=`.

### 2.3 Claim (public, rate limited, uniform answers)

| Route | Body | Answer |
|---|---|---|
| `GET /v3/claim/:token/status` | none | `{ valid:true, businessName, expiresAt }` or the same 404 for every bad link |
| `POST /v3/claim/:token/otp/request` | `{ channel?: 'SMS'\|'EMAIL' }` | `{ sent:true, message }` (same whether or not the link is valid) |
| `POST /v3/claim/:token/otp/verify` | `{ code: '123456' }` | `{ claimed:true, vendorId, setupToken, setupTokenExpiresAt }` or `OTP_INVALID` |
| `POST /v3/claim/setup` | `{ setupToken, password(8-128), acceptTerms, email? }` | `{ vendorId, loginEmail, passwordSet:true, termsAccepted:true, next:'LOGIN' }` |
| `POST /v3/me/claim/approve` | Bearer token of the owner | `{ state:'LIVE', alreadyLive, publicationId, version }` |

Error codes the claim screens map: `OTP_INVALID, GRANT_INVALID, CLAIM_EMAIL_REQUIRED, CLAIM_EMAIL_TAKEN, CLAIM_NOT_CLAIMED, CLAIM_TERMS_REQUIRED, CLAIM_GO_LIVE_UNAVAILABLE, DIRECTORY_NOT_FOUND, DIRECTORY_GONE, DIRECTORY_INVALID, DIRECTORY_STATE_INVALID, SEO_NOT_FOUND` plus HTTP 429 (rate limit, message from the API) and 5xx.

The claim token is a staff-issued single-use link. **There is no public route that starts a claim from a listing** (G1). The four "listing states" (`UNCLAIMED_LISTING`, `DRAFT_SITE`, `CLAIMED`, `LIVE`) are not exposed by any public route: the page model gives only `claimed` and `verified` (G4).

### 2.4 Auth

| Route | Body | Answer |
|---|---|---|
| `POST /auth/login` | `{ email, password(min 6) }` | `{ accessToken, user:{ id,name,email,role,adminRole?,businessName,industry,subdomain,... } }` |
| `POST /auth/register` | `{ name,email,password(8+, one capital, one digit),businessName,industry,phone?,product?,track? }` | same as login |
| `POST /auth/password/forgot`, `POST /auth/password/reset` | exist in `account-security` (public). Request shapes to be read in Step 6 before use. |

The vendor app is a separate Vite app. On success the public site does **not** store a token: it redirects to `NEXT_PUBLIC_VENDOR_APP_URL`. A token cannot move between origins, so login is a pass-through form only if the vendor app accepts a handoff (G2); the simplest and safest design is that the public `/account/login` collects nothing and links to the vendor app's own login. Decision recorded under G2; Step 6 builds the form version only if the owner confirms a handoff.

## 3. What is missing (recorded in `PUBLIC_GAPS.md` as built)

- G1 Public "start a claim for this listing" (slug to claim link, email or SMS) does not exist.
- G2 Token handoff from the public site to the vendor Vite app does not exist.
- G3 Click-out `businessId` format is not documented; `/go/{id}` collides with the live `/go/[slug]` campaign page (section 5.2).
- G4 No public listing-state field (four states) and no `siteState` on page models.
- G5 No business id and no services on the business page model; backlink block needs an id.
- G6 Firm settings (legal identity, GSTIN) have no admin route.
- G7 `RESERVED_SEGMENTS` lacks the new top-level segments this slice uses (`legal`, `claim`, `account`, `directory`).
- G8 410 for a removed business cannot be sent as a real 410 status from an app-router page.

## 4. How the existing app is built

- Root `src/app/layout.tsx`: `<html lang="en-IN">`, global metadata with title template `%s | Get4Domain`, robots `index, follow`, no canonical, and **three site-wide JSON-LD scripts** (Organization, SoftwareApplication with the Workspace and BOS offers, WebSite) in `<head>`, plus `AuthProvider` and `GoogleAnalytics`. New pages inherit these. The SoftwareApplication script contains the words "Workspace" and "BOS". It is in the existing root layout, which this slice must not change while the flag is off. Recorded as a go-live item: guard that script behind a path check or move it into `(marketing)` before the flag is turned on in production.
- `(marketing)/layout.tsx` wraps Header, Footer, ChatBot, bottom nav and the demo gate. Directory routes will use their own route group `(directory)` with a minimal layout so the chatbot and demo gate never load on them.
- Metadata: `lib/metadata.ts` `createPageMetadata` (title forced through `title.absolute`, 60 char brand rule, self canonical, OG, robots by boolean). It cannot take a model's robots or canonical, so the directory gets its own generator (`modelToMetadata`) and uses `title.absolute` the same way. `lib/structured-data.ts` has `breadcrumbJsonLd`; `config/seo-routes.ts` is the static route table behind `sitemap.ts`; neither is edited.
- `middleware.ts` matcher `'/((?!_next/|api/|.*\\..*).*)'` plus `/robots.txt` and `/sitemap.xml`. It rewrites reserved-looking vendor hosts and gates `/demo/*`. Only one flag-guarded addition is planned (section 5.2).
- `sitemap.ts` and `robots.ts` are file conventions serving `/sitemap.xml` and `/robots.txt`. `robots.ts` disallows `/login` and `/register` and lists `sitemap.xml` and `sitemap-leadspace.xml`.
- Env today: `NEXT_PUBLIC_API_URL` with a **hard-coded production fallback** in about a dozen files. The new client does not copy that fallback.
- No test runner, no ESLint config (`next lint` would open an interactive setup), no `typecheck` script. Checks available: `npx tsc --noEmit`, `next build`, and Node 24's built-in `node --test` with native TypeScript stripping (new code uses relative imports so it runs without a loader). No new dependency is needed.

## 5. Flag and guard design

### 5.1 Flag
- `V3_PUBLIC_ENABLED` (server only, default off, true only for the literal `true`). Read **at request time** through `isV3PublicEnabled()`; every new route and handler is `dynamic = 'force-dynamic'` so staging can switch it without a rebuild. Backend data is still cached by `fetch` revalidate.
- `assertV3Public()` calls `notFound()` when off; it is the first line of every new page, layout and route handler. Off means: all new routes 404, no metadata, no JSON-LD, no sitemap or robots handlers answering, no change to any existing output.
- `V3_PUBLIC_USE_MOCKS` (default `true`): the typed client returns fixtures. `false` calls the API unchanged.
- Env names: `V3_PUBLIC_ENABLED`, `V3_PUBLIC_USE_MOCKS`, `API_BASE_URL` (server), `NEXT_PUBLIC_API_BASE_URL` (browser, claim forms only), `NEXT_PUBLIC_VENDOR_APP_URL`, `V3_PUBLIC_SITE_ORIGIN` (the canonical origin for sitemap and robots lines; no default to production). Real mode with no API base configured gives the error state, not a guessed URL. Names only go in `.env.local.example`.

### 5.2 Route plan and collisions with the live site

| New route | Why this path |
|---|---|
| `(directory)/[...path]/page.tsx` | The catch-all for `/{city}`, `/{city}/{category}`, `/state/..`, `/category/..`, `/pincode/..`, `/business/{slug}`, all with `/page/{n}`. Static segments always win in Next, so no live page is shadowed. |
| `(directory)/directory/page.tsx` | Directory home. The model's home path is `/`, which the live marketing home owns and which this slice must not touch. The page resolves `/` and is reachable at `/directory`. |
| `(directory)/legal/{terms,privacy,refund-and-cancellation,wallet-terms,directory-listing-terms}` | The live `/terms`, `/privacy-policy`, `/refund-policy` exist and stay as they are. |
| `(directory)/claim/**` | Claim flow (`/claim`, `/claim/find`, `/claim/[token]/...`). |
| `(directory)/account/{login,register,forgot-password}` | The live `/login` and `/register` are the existing vendor screens and are untouched. |
| `sitemaps/[file]/route.ts` (flag-guarded) | Directory sitemap index and chunks. `sitemap.ts` stays as it is. |
| `/go/{businessId}` | **Collision**: `/go/[slug]` is a live campaign page. A page and a route handler cannot share a segment. Plan: one flag-guarded branch in `middleware.ts`: when the flag is on and the segment matches the business id format, rewrite to `/directory-go/{id}` (a route handler that proxies to `/v3/go/{id}` and returns the 302, no-store, noindex). Everything else, and everything when the flag is off, continues to the legacy page unchanged. Needs G3 (id format) before go-live. |

Segments to reserve in the catch-all against a city named like a live page: it calls `notFound()` for the first segment `about, pricing, features, industries, ...` only through the backend `resolve` (which already reserves most); `legal, claim, account, directory` are static routes so they win anyway (G7 asks the backend to reserve them too).

### 5.3 Rendering
- Server components, `fetch(url, { next: { revalidate } })`, one `getModel(path)` wrapped in `React.cache` so `generateMetadata` and the page share one request. 4 second timeout via `AbortSignal.timeout`. `revalidate` from the response `max-age`, default 300 seconds when absent. ETag kept in a small per-process map for conditional requests.
- Unknown path or page beyond the last: `notFound()` (real 404). 410: `notFound()` plus a gone-aware not-found copy is not possible from a page, so 410 renders as 404 (G8).
- Thin pages: rendered as the model says (noindex via `meta.robots`), never a 404.

## 6. Step plan (unchanged from the prompt)

Foundation, directory pages, business profile, sitemaps and robots, claim, login and register, legal, tests, docs. Commits after each step, path-only, no push.

## 7. As built: where the final design differs from section 5

Written after the build. These replace the statements above where they differ.

- **No root catch-all route.** A `(directory)/[...path]` page at the root was built first. With the live site's root `loading.tsx` it turned every unknown address, even with the flag off, from a 404 into a 200 (verified against a build without the page). It was replaced by: no root route, a `next.config.ts` `fallback` rewrite to `/directory-pages/[...path]` that applies only to a request carrying the header `x-v3-public: 1`, set by the middleware only while the flag is on. Flag off: byte-for-byte the old behaviour (unknown address: real 404).
- **Fixed routes under the flag.** The middleware answers a plain 404 for the fixed V3 paths while the flag is off, because a page-level `notFound()` is sent as HTTP 200 under the live `loading.tsx` (gap G9). With the flag on, an unknown directory address is therefore a 200 with `noindex` until that file is changed.
- **ISR was tried and dropped** for the directory page: it did not fix the status and it would have served a cached directory page after the flag was turned off.
- **Click-out proxy.** `/go/{id}` is rewritten by the middleware to `/directory-go/{id}` for uuid and cuid segments only (and fixture ids in sample mode).
- **Claim and sign-in go through same-origin proxies** (`/directory-api/...`), so the browser never needs the API address, CORS or the API's sentences. Rate limiting by visitor relies on `X-Forwarded-For` (G15).
- **Directory home** is `/directory` (G11).
- **Sitemap index** is served at `/sitemaps/directory-index.xml` (not `/sitemap.xml`, which stays the existing one); robots is served by a handler the middleware rewrites `/robots.txt` to, only while the flag is on.
- Sign-in uses the safer `POST /auth/session/login`; sign-up uses `POST /auth/register`; reset request uses `POST /auth/password/forgot`.

- **Update after the first follow-up:** unknown directory addresses are now a real 404 and removed businesses a real 410 (a middleware gate, flag on only; no fallback rewrite, `next.config.ts` is unchanged). Directory, claim, account and legal routes render only the page model's JSON-LD while the flag is on. See `PUBLIC_SITE.md` section 3.
