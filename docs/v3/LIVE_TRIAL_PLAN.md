# Live trial plan: driving school and travels packs (read only, 21 Nov 2026)

Packs: `C:\Get4Domain\theme-inbox\road-sign-driving-1.zip` (theme `road-sign-driving`) and `C:\Get4Domain\theme-inbox\route-board-travels-1.zip` (theme `route-board-travels`).

## How this was checked

- Static read of `get4domain-w2` (branch `v3-lane-e1`, `d74c9c0`), `get4domain-ui` (`v3-ui-s17`) and `get4domain-pub` (`v3-pub-a1`). I ran the kit's `validate-package` and `lint` on the two zips (unzipped into the scratchpad). No server, database, staging or `.env` was touched; nothing was changed except this file.
- Paths are relative to `get4domain-w2` unless they start with `get4domain-ui` or `get4domain-pub`. What is deployed on the server was not checked.
- Two earlier files cover the same ground in more depth: `docs/v3/DRIVING_PACK_READINESS.md` and `docs/v3/THEME_SPEC_RECONCILIATION.md`.

## 1. How each zip gets into the engine today

| Route | Works? | Evidence |
|---|---|---|
| Kit CLI `pack` / `validate-package` | Works, but **does not publish anything** | the CLI has no publish command (`themes/commands/` lists bolt-brief, bolt-kit, build-themes, category-map, contract-table, lint, pack, preview, shots, starter, validate-package). Both zips pass `validate-package` |
| `POST /v3/admin/theme-market/themes` (zip in field `file`, optional `vendorId`) | **Works in the code; this is the only route that can take a kit zip**, but both zips are refused today (below) | `backend-api/src/v3-theme-market/api/theme-market.controllers.ts:62`; then `submit` (`:77`) and `publish` (`:83`); roles OPERATIONS and SUPER_ADMIN read, writes listed in `THEME_MARKET_ADMIN_WRITES` (`backend-api/src/auth/guards/admin-role-matrix.ts:74`) |
| Admin Themes screen (Upload dialog) | **Fails: 404** | the screen posts to `/v3/admin/themes/upload` and `/validate` (`get4domain-ui/packages/api/src/themelib/client.ts:109,115`). No controller serves `v3/admin/themes` in `get4domain-w2` or `get4domain-pub`; the real prefix is `v3/admin/theme-market`. `get4domain-ui/packages/api/src/admin-matrix.ts:221` calls these routes "ASSUMED" |
| Old Next admin import (`POST /admin/themes/import`) | Fails for a different reason | it takes only the older flat format (root `home.html`, `theme.css`); a kit zip is refused (`backend-api/src/themes/core/sanitise.ts:193`) |

**What the upload route says to each zip.** `inspectPackage` returns every problem and the upload is refused if there is even one (`backend-api/src/v3-theme-market/core/theme-package-core.ts:141-155`; `theme-market.service.ts:84`). There is no waiver.

| Check | `route-board-travels` | `road-sign-driving` |
|---|---|---|
| Kit package check (`validate-package`) | valid | valid |
| `marketplace` block in `theme.json` (packs and licence are required, `theme-package-core.ts:63-64`) | **missing** (refused: `marketplace-required`) | **missing** (refused) |
| Content-free rule (no e-mail, phone or outside address; I searched the unzipped files) | no match | no match |
| Kit lint, all 40 rules (`theme-package-core.ts:147`) | 40 of 40 pass | **3 rules fail** (`contrast-tokens`, `text-stretch`, `hero-visible`): refused |
| Pack and track rule (`:104-107`) | would pass with `HOSPITALITY_EVENTS` (draws on `hotel-homestay`, professional track) | would pass with `EDUCATION` (draws on `coaching-centre`, professional track) |

So today: **neither zip uploads.** Travels needs only a `marketplace` block added and a re-pack. Road-sign needs that and one of: the three design-affecting rules changed, or a waiver mechanism added to the upload (a repo change).

## 2. How a vendor gets a theme, and how the two vendors are created

**Theme assignment** (`backend-api/src/site-publish/content/theme-resolution.ts:27-48`):
- A site uses the stored choice, else `defaultThemeFor(category)`, which is only ever a library theme (`site-publish/renderer/theme-render.service.ts:29,147`). A marketplace theme can never be a category default (no theme targets are stored).
- Any other theme needs the plan feature `site.themes = library`. The seed gives that to Pro only (`backend-api/prisma/seed/v3-plans.seed.json:18`). **The rule also applies when staff pick the theme** (`site-publish/publish/site-settings.service.ts:94-97`; the route says "the plan rules still apply").
- A theme uploaded with a `vendorId` is PRIVATE to that business and is offered only to it once PUBLISHED (`theme-render.service.ts:129-135`; `theme-market.service.ts:79-101`). The theme's `tracks` must include the vendor's track: both themes say `professional`, and both categories are Professional tier.
- Choosing: the vendor `PUT /v3/me/site/theme` (`site-publish/api/me-site.controller.ts:50`); staff `PUT /v3/admin/vendors/:id/site/theme` (`site-publish/api/sites-admin.controller.ts:45`). Staff can move a vendor to a Pro plan with `POST /v3/admin/vendors/:id/subscription` (reason required, SUPER_ADMIN, `plans/admin/vendor-plans-admin.controller.ts:21`) or give an entitlement override (`:30`).

**Creating the two vendors.** Admin app, On-behalf screen, Create form (`get4domain-ui/apps/admin/src/pages/onbehalf/CreateForm.tsx`, posts to `POST /v3/admin/vendor-sites`, `backend-api/src/v3-admin-vendor-site/admin-vendor-site.controller.ts:20`). Roles: SUPER_ADMIN, OPERATIONS, SALES.

| | Driving school | Travel agency |
|---|---|---|
| Category key to pick | `driving-school` (V3 master, pack `EDUCATION`) | `travel-agency` (V3 master, pack `HOSPITALITY_EVENTS`) |
| Kit category the site is drawn from | `coaching-centre` (pack fallback, `backend-api/src/directory/core/listable-categories.ts:15-17`); the kit has no driving category | `travel-agency` (the kit has it) |
| Theme's category list | `coaching-centre` ✓ | `travel-agency` ✓ |

Fields the team fills (`backend-api/src/v3-admin-vendor-site/admin-vendor-site.dto.ts`): category, business name, owner name, phone, e-mail, city, subdomain (all required); area, full address or address line, pincode, GSTIN and a duplicate-override reason (optional). **There is no field for logo, banner, services, prices or hours.** What the new site gets automatically: a Free plan, a live trial site built from the pack (starter text; for driving school a single starter service "Driving School", for travel agency "Travel Agency"; sample prices are hidden), and a generated banner (`backend-api/src/v3-trial/module-trial-site.ts:60-62`). The owner gets a welcome e-mail with a random password in plain text (`backend-api/src/email/email.service.ts:68-82`).

## 3. What can be edited after creation

| | Vendor | Admin |
|---|---|---|
| Text fields (tagline, about, hero title, sub title, announcement, hero image link, contact, social links) | **Yes**, Website tab, Content panel (`get4domain-ui/apps/vendor/src/pages/grow/website/WebsiteScreen.tsx:193-200`) | **No.** Staff can open a session on a vendor (`v3-website/api/act-on-behalf.controllers.ts:34`) but no `/v3/admin/vendors/:id/site/draft/*` route exists to write text |
| Lists (FAQs, gallery, steps, trust, stats, team, credentials, extra pages) | Backend yes (`v3-website/api/website.controllers.ts:47`); **no vendor screen** | No |
| Logo, brand colours, fonts | Backend yes (`:59`); **no vendor screen** | No |
| Banner and pictures | Pick a library banner (`v3-website/api/media.controllers.ts:55`, no screen); upload to media library with a description (screen yes, but uploads refuse until staff set size caps and storage keys, `v3-media-upload/core/media-upload-core.ts:37`, `media-upload.module.ts:15`); the picture is not placed into a field | Backend routes exist for banner and media on a vendor (`media.controllers.ts:78-90`); no admin screen found |
| Courses or services with price | Yes, from Offerings; **no duration** (`VendorProduct` has none, `prisma/schema.prisma:521`) | not checked |
| SEO title and description | Yes (`MediaPanels.tsx:139`) | read only |
| Location, hours | Location backend yes, no screen; hours: no route (`v3-website/website.service.ts:43,210` has the handler only) | No |
| Batch timings, RTO or related services, vehicle groups, service areas | **No** (nowhere to store; the site builder sends them empty, `site-publish/content/content-adapter.ts:121,127`, and never sends `offers`) | No |
| Theme choice | Yes if the plan has `library` | Yes through the plan rule above |
| Draft, preview, publish, rollback | Yes (Free publish goes to staff review, Pro live) | build, publish, rollback, preview, noindex (`sites-admin.controller.ts:51-77`) |

Effect on the two themes: road-sign draws no vehicle quick-pick, no timings table, no RTO list and no areas until those lists exist; route-board draws only the lists it uses from the same set. Both still draw hero, services, steps, FAQs, gallery, contact and reviews from what exists.

## 4. What renders the site on the vendor subdomain today

- The Next app rewrites `<name>.get4domain.com` to `/site/<name>` (`get4domain_mvp/src/middleware.ts:59-80`).
- **On `get4domain-w2` (this branch) the `/site/<name>` page asks the legacy route `GET /cms/site/<name>` and never the V3 page store** (`get4domain_mvp/src/app/site/[subdomain]/[[...rest]]/page.tsx:58-61`; no file in `get4domain_mvp` references `by-host`). It draws engine designs and flat theme packs, not kit themes.
- **On `get4domain-pub` (`v3-pub-a1`)** a second route, `/vendor-site`, relays the backend's stored page for the host unchanged (`get4domain_mvp/src/app/(directory)/vendor-site/[[...path]]/route.ts:11-12,21`). That page is the kit renderer's output (`backend-api/src/site-publish/publish/site-build.service.ts:77-98`, served by `GET /v3/public/site/by-host`, `site-publish/api/public-site.controller.ts:24`). It is active only with `V3_PUBLIC_ENABLED` on and `MAIN_HOST` set (`get4domain_mvp/src/lib/v3-public/host-routing.ts:12,74`). The live plan has `V3_PUBLIC_ENABLED=false` (`docs/v3/DEPLOY_V3LIVE_PLAN.md:86`).
- The wildcard `*.get4domain.com` still serves V2 (`deploy/v3live/nginx/WILDCARD_SWITCH_LATER.md`).

**Shell parts on a kit-rendered site (the relay path)** — the page is relayed unchanged, so only what the kit draws is there:

| Shell part | On a kit page | Where it exists instead |
|---|---|---|
| Bottom navigation | **3 items** (Call, WhatsApp, Directions), Pro only (`themes/lib/render.mjs:339-342`); not five, not industry-specific | 4 to 5 items in the engine shell: `get4domain-pub/get4domain_mvp/src/engine/shell/ShellBottomNav.tsx`, `engine/components/EngineBottomNav.tsx` |
| Request sheet with the chosen item | **Missing.** The kit has an inline enquiry form slot and the `data-g4d-item` attribute is allowed in templates (`themes/lib/vocabulary.mjs:78`), but nothing on a relayed page reads it | `engine/shell/ShellProvider.tsx:61-62` reads `data-g4d-item` for engine pages only |
| Install app button | **Missing** | `components/site-kit/InstallButton.tsx` (flagship themes), marketing `InstallPrompt.tsx` |
| Website chat | **Missing** (decided: Pro only, not built for sites) | marketing `ChatWidget.tsx` only |
| WhatsApp float | **Present** when the vendor has a WhatsApp or phone number and calls to action are on (`render.mjs:402-407`) | |
| "Powered by Get4Domain" line | Present (`render.mjs:271-274`) | |

## 5. Shortest ordered steps to a live sample driving vendor and travel vendor

Legend: **done** = already there; **small** = under a day, nothing blocks it; **blocked** = needs the named thing first.

| # | Step | State | Blocker or note |
|---|---|---|---|
| 1 | Add a `marketplace` block (packs `EDUCATION` / `HOSPITALITY_EVENTS`, short licence) to each `theme.json` and re-pack | small | `theme-package-core.ts:63-64`; outside the repo, in `theme-inbox` |
| 2 | Road-sign: clear the 3 lint failures | **blocked** | owner decision: change yellow accent, price chip wrap and track start state (design changes), or approve a waiver mechanism in the upload (repo change, about 1 day). Travels is not affected; start the trial with travels if this waits |
| 3 | Confirm the server runs the theme-market and site-publish tables and the build with the right branch | **blocked** | not checked here; `docs/v3/V3_PRODUCTION_MIGRATION_STATE.md` says what was applied; owner or ops to confirm |
| 4 | Create the two vendors in the admin Create form (categories above; fill the 7 required fields plus address) | done (screen and route exist, `admin-vendor-site.service.ts:42-56`) | needs a staff login with SALES, OPERATIONS or SUPER_ADMIN, and the mail provider live if the owner is to get the password |
| 5 | Move both vendors to a Pro plan (or give `site.themes = library` as an override) | small | SUPER_ADMIN only; reason required |
| 6 | Upload each zip as PRIVATE to its vendor, then submit and publish, by direct API call (not the Themes screen, which 404s) | small once steps 1 and 2 pass | `POST /v3/admin/theme-market/themes` with `vendorId`, then `/submit` and `/publish` |
| 7 | Set the theme for each vendor, build and publish | small | `PUT /v3/admin/vendors/:id/site/theme`, `POST .../site/build`, `POST .../site/publish` |
| 8 | Fill sample content | partly **blocked** | the owner logs in and edits text in the Website tab (works); lists, logo and hours only by direct API calls as the vendor; batch timings, RTO list, vehicle groups and areas cannot be filled at all until the data feed lane (`DRIVING_PACK_READINESS.md` lane 3) |
| 9 | Pictures | **blocked** for uploads | media size caps, allowed types and storage keys must be set by staff and ops; without them rely on the generated banner |
| 10 | Make the two names reachable: give each trial name its own nginx server block to the V3 site (an explicit name wins over the wildcard) and turn the public flags on for that app | **blocked** | owner decision on `V3_PUBLIC_ENABLED` and `MAIN_HOST`, ops access to nginx, and confirmation that the deployed site app is the `get4domain-pub` build with the `/vendor-site` relay. Until then, check the result with staff preview `GET /v3/admin/vendors/:id/site/preview/:publicationId/:path` (`sites-admin.controller.ts:77`) |
| 11 | Look at the result and note the missing shell parts | small | five-item nav, request sheet with item, install and chat are not drawn on relayed pages; accept for a trial |

Shortest honest path: steps 1, 4, 5, 6, 7 for **travels first** (it passes lint), with preview for viewing; road-sign follows when the owner decides step 2.
