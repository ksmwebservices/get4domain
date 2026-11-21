# V3 Public Commerce Plan (Frontend Slice 7, Step 0)

Branch `v3-pub-fe3` (from `v3-pub-host`). All new routes are behind `V3_PUBLIC_ENABLED`. The Wave 3 contract (`get4domain-w2/docs/v3/API_CONTRACT_WAVE3.md`) does not exist yet, so real Wave 2 shapes are used where the backend has them and every other shape is assumed and listed in `PUBLIC_GAPS.md` (G28 onward).

## 1. How the new pages coexist with the live ones

The live site already has `/`, `/pricing`, `/about`, `/contact`, `/features`, `/industries`, `/how-it-works`, `/register`, `/login`. They are not edited. The new pages live under an internal root `/v3-site/...` (a visitor typing it gets a 404, like `/vendor-site`). **Only when the host layer is on (flag on and `MAIN_HOST` set), on the canonical main host,** the middleware rewrites those exact addresses to the new pages. Flag off, or flag on without `MAIN_HOST`: the live pages answer exactly as before. Sub-paths such as `/industries/travel` stay live.

| Address (main host) | Page |
|---|---|
| `/` | Home |
| `/pricing` | Pricing |
| `/register` | Self-service register |
| `/login` | rewrite to the Slice 4 sign-in (`/account/login`); forgot and reset stay `/account/...` |
| `/r/{code}` | Referral landing |
| `/how-it-works`, `/industries`, `/features`, `/about`, `/contact` | Marketing pages |
| `/legal/...` | Slice 4 legal pages (linked, unchanged) |

Own layout (header: pricing, how it works, industries, directory link from `DIRECTORY_HOST`, sign in, register; footer: legal links). Copy lives in one module, `lib/v3-public/site-strings.ts`, with rule tests.

## 2. API calls

| Use | Route | Status | Shape |
|---|---|---|---|
| Plans, term prices, feature comparison | `GET /v3/plans` | **exists** | `{ plans: [{ key, track, level, name, description, prices: [{ termMonths, amountPaise, currency, taxInclusive }], features: [{ key, name, group, kind, unit, state, limit, enumValue, upsellText }] }], terms: number[], tax: { name, ratePercent } \| null }`; feature `state` is `ACTIVE`, `LIMITED` (limit), `LOCKED_PREVIEW` (upsellText); `HIDDEN` is never sent |
| Categories for register | `GET /v3/public/pack-categories` | **exists** | `[{ categoryKey, name, family, packKey, minTier }]` |
| Add-on packs of a category | `GET /v3/public/pack-categories/{key}` | **exists** | `addonPacks: [{ key, name, bundleDiscount, priceStatus: 'PENDING' }]` (the `bundleDiscount` field is never shown) |
| Register | `POST /auth/register` | **exists, extended (assumed)** | real body: `{ name, email, password (8+, capital, digit), businessName, industry, phone?, track? }`, answer carries `accessToken`. Assumed extra fields: `categoryKey`, `subdomain`, `termMonths`, `referralCode`, `acceptedTerms: true` |
| Subdomain availability | `GET /v3/public/subdomain/check?slug=` | **assumed** | `{ available: boolean, reason: 'TAKEN' \| 'RESERVED' \| 'INVALID' \| 'TOO_SHORT' \| null, message: string \| null }` |
| Referral code | `GET /v3/public/referral/{code}` | **assumed** | `{ valid: boolean, displayName: string \| null }`; 404 for unknown, disabled is `valid: false` |
| Hand-off after register | `POST /v3/auth/handoff` | exists (Slice 4 use) | `{ code }` |
| Login, forgot, reset | as Slice 4 | exists | unchanged |

Validation errors from the API are Nest style (`400`, `message` a string or a list of strings, optional `code`). They are mapped to the field by keywords (password, email, phone, subdomain, business name) and shown in plain words; an unmapped message is the general one. A route the API lacks (404 or 405) shows a kind "not available yet" state.

## 3. Rules held

Prices exclude GST with a separate "GST is added at checkout" line; Free is a trial; "Pro" means any paid plan; payment only inside the vendor app (no payment form, no card field, anywhere); a pending price shows no number; no discount, offer, coupon or deal wording (the `bundleDiscount` field is dropped); no timeframes (quarterly, half-yearly, annual are allowed); never workspace, BOS or LeadSpace; "enquiries" not "leads"; no ranking claims; no fabricated numbers, reviews or counts. Referral: the public site only carries the code (first-party cookie holding the code only); the backend attributes.

## 4. Steps

1 pricing, 2 register (and login link), 3 referral landing, 4 marketing pages and sitemap additions, 5 tests, 6 docs.
