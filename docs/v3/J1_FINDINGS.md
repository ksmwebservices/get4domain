# J1 findings (P0, read only)

App folder: `get4domain_mvp`. Branch `v3-pub-fe9` (from `v3-pub-fe8`). Nothing was run against the live site; everything below comes from reading the code.

## 1. How the site is styled today
- Tailwind 3.4 (`tailwind.config.js`) plus `src/app/globals.css` (`@tailwind` layers, base rules only). No component library; `lucide-react` is installed.
- Tokens exist but belong to the older marketing and dashboard skins: `primary` (blue), `secondary` (orange), `brand`, `gold`, `ruby`, `ink`, shadows `card`, `premium`, `device`. Fonts are a system stack (`-apple-system, Inter, Segoe UI`), not self-hosted through `next/font`.
- The V3 public pages (`(v3site)`, `(directory)`) use none of this design work: plain `slate-*` utilities, `max-w-5xl`, text-only headers, no hero, no imagery. Each of the two shells has its own header and footer copy.
- Reusable pieces: `components/site/*` (Blocks, PricingPlans, RegisterForm, Crumbs, LegalDocument), `components/directory/*` (ModelPage, ListingCard, States, Pagination, Breadcrumbs, Claim*). `components/marketing/HeroMockup.tsx` is a device-mockup piece from the older site (reusable as a starting point).
- Copy lives in string files, guarded by tests: `lib/v3-public/site-strings.ts`, `marketing-strings.ts`, `strings.ts`, `company-strings.ts`, `legal-*`.

## 2. Where things live
| Page | File |
|---|---|
| Main home | `src/app/(v3site)/v3-site/page.tsx` (shell: `v3-site/layout.tsx`) |
| Main header and footer | `v3-site/layout.tsx` (inline) |
| Product, pricing, how it works, partners, guides, about, contact, register | `v3-site/<name>/page.tsx` |
| Industry list, pack, category | `v3-site/industries/page.tsx`, `[slug]/page.tsx`, `[slug]/[category]/page.tsx` |
| Directory home | `src/app/(directory)/directory/page.tsx` (renders `ModelPage`) |
| Directory city, category, business pages | `(directory)/directory-pages/[...path]/page.tsx` (reached by the middleware gate rewrite) |
| Directory header and footer | `(directory)/layout.tsx` (inline) |
| Claim, account, legal | `(directory)/claim`, `account`, `legal` |

Public addresses (`/product`, `/pricing`, `/industries/...`) are rewritten to `/v3-site/...` by `middleware.ts` + `lib/v3-public/host-routing.ts` when `V3_PUBLIC_ENABLED` and `MAIN_HOST` are set. The directory host maps `/` to `/directory`.

## 3. Why "Directory" feels confusing
- The main header link goes to `directoryOrigin()` (the `DIRECTORY_HOST` root). That root is the directory home page, which only renders the backend page model for path `/`: an H1, an intro, and listing cards or facet links. **It has no search form at all.** With 0 listings and no facet links it shows only the empty state ("No businesses to show here yet" with a "Back to the directory" link to itself).
- The only inputs on the public site that ask for a "subdomain" or a name are the register form (`/register`, site address field with live check) and the claim search (`/claim`, business name plus city). The header offers "Claim a listing" and "Create an account" next to "Directory" on the directory host, so a visitor who wanted to search lands on forms that ask for something else. I could not open the live site from here, so I cannot say which of the two screens the owner saw; both fit the description.
- Fix (P3): the directory home becomes a real search home (what + where), with category chips, cities, and a good empty state. The header on the directory host keeps one clear "Directory" link to it.

## 4. API routes used today (all through `lib/v3-public`)
| Need | Route | Status |
|---|---|---|
| Directory pages (home, city, category, business) | `GET /v3/directory/pages/resolve?path=` | exists, used |
| Listing search or list | `GET /v3/directory/businesses?...`, `/businesses/{slug}` | exists (list shape in `api.ts`) |
| Categories of the packs (196) | `GET /v3/public/pack-categories` | exists, used by register and industry pages |
| Plans and prices | `GET /v3/public/pricing` (paise before GST, `PRICE_PENDING` carries no price) | exists, used by `/pricing` |
| Subdomain availability | `GET /v3/public/subdomain-availability?name=` via `/directory-api/subdomain` | exists, used by the register form |
| Backlink block, claim status | `/v3/directory/backlink-block/{id}`, `/v3/claim/{token}/status` | exist |

Gaps (to list in the report, pages must use honest empty states): no public route that lists the 16 packs with their tabs (packs are data in `packs.ts`); no public route that lists the 58 seeded locations or the 53 directory categories except as facets inside a page model; no domain registrar availability route (registrar is off, so a custom domain box can only offer "connect a domain you own"). The backend source is not in this repo's `src`, so routes were read from the client code only.

## 5. Constraints seen
- Copy and legal guard tests exist (`src/lib/v3-public/__tests__`); run only those: `npm.cmd run test:v3-public`.
- `middleware.ts` sets the V3 route header and the directory gate; new routes must be added to `routes.ts` rules if they are not under `/v3-site` or the directory paths.
- No ESLint config (G19), so verification is typecheck, build and the unit tests.
