# Dispatch report P7: register category, real site address, Free done screen

Branch `v3-pub-fe15` (from `v3-pub-fe14`). Not pushed. No backend change, no .env read, no server touched. Backend read only: `get4domain-w2/backend-api` (`auth/dto/register.dto.ts`, `plans/registration/registration.hook.ts`, `v3-packs`). The `backend-api` inside this repo is an older copy (no `track`, `subdomain`, `city`), so the newer one was read.

## What caused the live break (found in the code)
The category page link (`?category=`) added a **static catalogue** option to the picker when the API list did not carry it, and that option's `industry` was the catalogue's *family label* ("Home repair and trades"). The form sent `industry: <that label>`. Even for normal picks, `industry` was the family, not the category id.

## What the register route accepts
`POST /auth/register` (`RegisterDto`): `industry` is a plain `@IsString()`, so the backend does **not** reject unknown text. It then uses `industry` as a **`categoryKey`** (`v3PackCategory.findUnique({ categoryKey })` for the track, and as the `category` of the trial site). So the right value is the `categoryKey` id from `GET /v3/public/pack-categories` (e.g. `plumber`). There is no sub category field, and the pipe uses `forbidNonWhitelisted`, so nothing else may be sent.

## Done
- **P7.1** `industry` now carries the `categoryKey`. The server (register proxy) re-reads the API category list and refuses any key not in it (field error "Please choose a category"); if the list cannot be read nothing is sent. The page no longer adds catalogue-only categories; `?category=` preselects only if the API list has it. Picker kept (family, then category, search, 48 px rows; Free lists all families; a Pro plan lists its track with "My business isn't here: see all categories"). Continue is disabled until a category is chosen, with the sentence "Choose your business category from the list to continue. We only accept a category from the list."
- **P7.2** Suffix and a full line "Your site address will be `<name>.get4domain.com`" come from `siteBaseDomain()` (reads `NEXT_PUBLIC_SITE_BASE_DOMAIN`, default `get4domain.com`, same default the vendor sites use) instead of `MAIN_HOST`. Availability check and its states unchanged. Test fails on `v3site` or any host that is not the base domain (and a test proves the guard catches a bad host).
- **P7.3** While submitting: a status line with the address as text. After success: "Your free site is being created", the address as plain text, link "Sign in to your business app" to `<vendor app>/login`. The automatic jump after registering was removed. No live or payment claim (a test checks the words).
- **P7.4** `__tests__/p7.test.ts` (incl. unknown text never reaches `/auth/register`, real-mode request body), `scripts/v3-public/p7-shots.mjs`, screenshots in `docs/v3/p7-shots/`.

## Choices
- **Sub categories:** the category list has family and category only. The only finer data is `starterServices` on `GET /v3/public/pack-categories/:key`; shown as chips (new proxy `/directory-api/category-services`). The register route cannot take them, so the chips are **display only** ("Your site can start with these"), not selectable and not sent. The keywords data does not exist in this API.
- A live site (`site.published`) no longer changes the Free screen's wording: it always says "being created", per the brief.
- The button text "My business isn't here: see all categories" is kept (the existing P5 script checks it).
- Updated the older register tests: unknown category is now refused; real-mode tests stub the category list.

## What the backend still needs
1. Reject an unknown `industry` in `RegisterDto` (check it against `v3PackCategory`); today it accepts any string and the site build fails later.
2. Optionally accept a sub category / starter services at registration (`RegisterDto` has none).
3. `RegisterDto.industry` description still says "clinic, restaurant, realestate" (old keys).

## Verification
`test:v3-public`: 529 pass, 0 fail. `tsc --noEmit` clean. `next build` passes. `p7-shots.mjs` ALL PASSED at 375, 768, 1280 (disabled Continue and reason, picker open and search, chips, real address, availability, Free done screen, server refusal of "Home repair and trades", no sideways scroll, no page errors). `p5-shots.mjs` and `p6-shots.mjs` still ALL PASSED. Screenshots use the sample data; the address screenshots show `get4domain.com` because the run set `NEXT_PUBLIC_SITE_BASE_DOMAIN`.
