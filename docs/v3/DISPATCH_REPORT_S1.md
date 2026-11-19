# Dispatch report: lane S1 (a published Free site that shows nothing)

Branch `v3-lane-s1` (from `v3-lane-b6`), worktree `get4domain-w2`. Nothing pushed. No `.env` file or secret read or printed. Staging only; nothing sent.

## S1.1 The exact path and the exact condition

1. Browser asks `plumberboy.get4domain.com`. `get4domain_mvp/src/middleware.ts` rewrites the vendor host to `/site/plumberboy` (read only).
2. `get4domain_mvp/src/app/site/[subdomain]/[[...rest]]/page.tsx` calls `fetchSite()`, which calls **`GET {API}/cms/site/plumberboy`** (the legacy route). It does **not** call the V3 route `GET /v3/public/site/by-host`; no file in `get4domain_mvp` references it.
3. If that response is not OK, `fetchSite` returns null and both `generateMetadata` and the page call `notFound()`. That is why the page title is the default "Get4Domain - Your Online Business Visibility Partner": the metadata step 404s before any title is built.
4. `CmsService.getSiteBySubdomain` (`backend-api/src/cms/cms.service.ts:426`) throws NotFound when
   **`cmsRow && cmsRow.siteStatus !== 'LIVE' && !preview`**.
5. The V3 trial site creates the `VendorCMS` row as `DRAFT` (`CmsDraftSiteProvisioner`) and the V3 publish only writes `V3SitePublication` rows; **nothing ever set `VendorCMS.siteStatus` to `LIVE`**. So a vendor with a PUBLISHED V3 site v1 still has a DRAFT legacy row and the legacy route refuses it.

**Side: backend data.** The condition is a backend row value (`VendorCMS.siteStatus`) that the V3 publish never maintained. (A second, smaller gap is on the site app side: it never asks the V3 renderer. See S1.3.)

**Reproduced on staging** (real hook, trial site, content, build, publish; tagged fixtures, removed; nothing sent), for a category text not in the list (`Home repair and trades`) and for a category with starter content (a tagged pack built from the real starter seed): with the row left `DRAFT` (the old state) `GET /cms/site/<sub>` answers **404** while `/v3/public/site/by-host` serves the published page (200). After the repair the legacy route answers 200 with the home text.
I did not run the site app itself: the backend route and the app code above settle it, and the site app was left untouched.

**Second finding (privacy):** `content-adapter.ts` fell back to the vendor's **login e-mail** (`cms.email || vendor.email`) and the renderer printed it as plain text in the contact block. The live v1 page was therefore showing the owner's login e-mail. Fixed (below).

## S1.2 Backend fix (additive, no migration)

- **Content:** `FreeHomeContentService` (`v3-trial`) runs inside the trial-site build, before the build. It builds text from the registration details (`buildFreeHomeContent`, pure): business name, the category exactly as typed, city, area, pincode (six digits only), a short generic about, and four generic services for the vendor's track. It states nothing invented (no price, claim, year, rating, availability or coverage; a test checks this) and never receives the e-mail.
- **Only empty fields are filled.** The owner's words and a category pack's starter text are never replaced. Starter text that sits only in the pending draft is copied to the live column the legacy route reads. Generated text is marked with the existing sample markers, so the owner's edit replaces it. The generic services are added as sample catalogue rows (no price) only when the vendor has no catalogue at all.
- **Registration details travel:** `AuthService.register` now passes city, area and pincode to the hook and the trial site (they were only used by the duplicate check). A later retry or the rebuild script does not know them (they were never stored); the category text and name still give a complete page.
- **Legacy row:** the trial site sets `VendorCMS.siteStatus = LIVE` **before** the build and puts the previous status back if the build or publish fails. Order matters: the build hashes the row, so setting it afterwards made the next retry a second version.
- **E-mail:** a site with no calls to action (Free) never prints an e-mail address.
- **Free stays an information page and not indexable:** tests and the staging check assert no form, button, `mailto:`, `tel:` or WhatsApp link, no e-mail, `indexable = false`, and `CLAIMED` / `VERIFIED_CONTACT` still listed as missing (`HOME_CONTENT` is gone). An address block appears only when an address exists (none is invented).
- **Idempotent:** a second run writes nothing; staging: two further retries kept the same publications and catalogue rows.

## S1.3 Ready-to-paste P8 dispatch prompt (site app; I did not edit `get4domain_mvp`)

The backend fix above is enough to make plumberboy appear. These changes make the site app robust and are recommended:

```
P8 DISPATCH: vendor host site app (get4domain_mvp). Edit only the files named. Do not touch the backend.

Files: src/app/site/[subdomain]/[[...rest]]/page.tsx (fetchSite, generateMetadata, VendorSitePage).

1. Prefer the V3 published site. Before the legacy fetchSite, call
   GET {API_BASE}/v3/public/site/by-host?host=<subdomain>.get4domain.com&path=<path>&lang=en
   (returns the stored HTML with ETag, 404 for anything not published). If it answers 200, render that HTML
   as the page (same approach as the theme frame: full document, no extra chrome) and forward the X-Robots-Tag
   header. Cache it by tag `site:<subdomain>` with revalidate 60. Only on 404 fall through to the legacy path.
   Reason: the V3 renderer already makes a Free page listing-only (no buttons, forms or contact links); the legacy
   renderer shows a contact form and the chat widget.

2. Friendly page instead of the bare 404 for an EXISTING but unfinished vendor host. Add a small public
   route GET /cms/site-state/<subdomain> is NOT available; instead use the legacy response status:
   GET /cms/site/<subdomain> answers 404 both for an unknown name and for a not-yet-live site, so the app cannot
   tell them apart today. Ask the backend dispatch for a field first (see below) and until then keep notFound().
   When the field exists: for { exists: true, live: false } render a plain page, HTTP 200 with
   noindex,nofollow: "This site is being set up. Please check back soon." with the platform logo and a link
   to https://get4domain.com. For { exists: false } keep notFound().

3. Thin content: for a legacy-path site whose cms.about is empty and products is empty, do not render the empty
   hero; render the same "being set up" page (noindex) instead of an empty page.

4. generateMetadata must set a title from the vendor business name (or "<name> | Get4Domain") on every non-404
   branch, never the default site title.

Acceptance: plumberboy.get4domain.com shows the V3 page; an unknown subdomain still 404s; a draft vendor shows the
"being set up" page; view-source on a Free page has no <form>, no mailto: and no tel: link.
```

Backend follow-up needed for item 2 (not built here): an additive `GET /cms/site-state/:subdomain` returning `{ exists, live }` (no other field).

## S1.4 scripts/live/rebuild-site-content.js (needs `npm run build`)
`--id <vendor id>` only; dry run by default (prints the plan, the row status, what would be filled; writes nothing); `--apply` asks for the typed word `LIVE`. Refuses a non-vendor, suspended or plan-less account, and any non-live database (same guard as the other live scripts; `--staging` for rehearsal). Calls `RegistrationHook.createMySite`, the retry route's service, after removing every provider key and putting e-mail in capture mode. It prints no phone, e-mail or connection string. A test checks the script contains no direct write call.

## S1.5 Free "Build a preview"
`SiteBuildService.build` (what `POST /v3/me/site/build` calls) on the staging fixtures: a 9.5 KB page (category text) and a 13 KB page (starter content), both with the business name, services and place, no form or button, no e-mail. Before the fix the page was empty of business text (unit test "BEFORE").

## Choices I made (change any)
1. The legacy row is set LIVE by the V3 trial publish (not by a site-app change). Risk: until P8 item 1 ships, the legacy renderer serves that Free site and **may show its contact form and chat widget**, which a Free page should not have. If you prefer, hold the live repair until P8 is done.
2. E-mail is blank for every Free site, including an e-mail the owner typed into the profile.
3. Generic services are four per track, stored as sample catalogue rows.
4. Registration details city/area/pincode are shown in text only; no address is invented.

## Tests
`s1-free-home.spec.ts` (16): content, no invention, idempotence, only-empty fill, starter promotion, BEFORE/AFTER page, no CTA/e-mail, order and rollback of the LIVE status. `s1-rebuild-script.spec.ts` (6). Updated for the new call shape: `wave3-trial`, `plans-registration`. Green: site-content, site-build, site-publish, site-seo, website-seo, b2-registration-site, b5-site-facts, b6-*.
Staging: `node scripts/staging/s1-check.js` : **26 of 26 passed, 0 fixtures left.**

## Live steps (you run these; I touched nothing live)
1. Deploy the lane (no migration); `npm run build` in `backend-api`.
2. Decide choice 1. If you want no legacy form on a Free site, ship P8 item 1 first.
3. `node scripts/live/diagnose-vendor.js --id cmwn17col0009qq07m1cgz0w3` then
   `node scripts/live/rebuild-site-content.js --id cmwn17col0009qq07m1cgz0w3` (dry run), then add `--apply` and type `LIVE`.
4. Check `https://plumberboy.get4domain.com`: the home text, no contact link, and in view-source no e-mail. Re-run the diagnosis: row LIVE, a new PUBLISHED version.
5. Other Free vendors with a PUBLISHED site and a DRAFT legacy row: list them (`VendorCMS.siteStatus <> 'LIVE'` with a `V3SitePublication` PUBLISHED) and repeat step 3 per vendor.

## Limits
- I could not read live. The cause is proven on staging and on the code of both sides; step 3 confirms it on the real vendor.
- The site app was not run; no site app file was changed.
- Retry and rebuild cannot know city, area or pincode (never stored).

## Addendum S1.6 `GET /cms/site-state/:subdomain`
Public, read only, `@Throttle(RATE.siteRead)`, `Cache-Control: public, max-age=30` plus a 30 second in-process cache (at most 2000 names). Answers only `{ exists: boolean, status: 'LIVE' | 'DRAFT' | 'NOT_FOUND' }`; an unknown, sandbox or malformed name is `{ exists: false, status: 'NOT_FOUND' }` with HTTP 200 (a malformed name costs no database read). Same rule as `GET /cms/site/:subdomain`: no CMS row or a LIVE row is LIVE, any other status is DRAFT. No name, e-mail, phone or id is ever in the answer (test). Route baseline row added (`public`). There is no role-matrix row because the matrix lists staff routes only; this one is public. This is the field the P8 prompt (item 2) waits for: `{ exists: true, status: 'DRAFT' }` is the "being set up" page, `NOT_FOUND` stays a 404.

## Addendum S1.7 the public signup accepts only a listed category
`POST /auth/register` now refuses an `industry` that is not an ACTIVE `V3PackCategory.categoryKey` (the list `GET /v3/public/pack-categories` returns): HTTP 400, code `INDUSTRY_NOT_IN_LIST` (registered with the exception filter through the pack error list), message `Choose your business category from the list.` An empty, blank, missing, non-string, mis-cased (`Plumber`) or space-padded value gets the same answer, and no vendor is made. The check runs after the replay of an existing account, so a vendor who registered earlier under an older value can still sign in. Partner, admin and import routes call `VendorsService.create` directly and are not touched (a test checks the vendor service does not contain the check).

**ACTION NEEDED BEFORE THIS SHIPS: existing callers that send free text or ids that are not categoryKeys.** Checked against the 196 active categories on staging:
- **The web signup form** (`get4domain_mvp/src/app/register/page.tsx`) sends the 20 ids of `src/data/industries-list.ts` (`travel, restaurant, clinic, hotel, salon, gym, realestate, education, retail, construction, events, finance, automobile, logistics, diagnostics, photography, professional, agriculture, coaching, technology`). **None of the 20 is a categoryKey, so every one is now refused.** The `?industry=` prefill from the demos uses the same ids.
- **The LeadSpace signup** (`/register?product=leadspace`) sends the fixed value `general`, which is not a categoryKey: refused. (`scripts/leadspace/verify-app-pg.js` and `walkthrough-api.js` also post to `/auth/register` and will be refused unless they send a listed key.)
- Existing unit tests that build `AuthService` with hand-made data now add `test/support/listed-industries.ts` (every key listed); nothing else about them changed.
So the signup form must be changed (P8) to load `GET /v3/public/pack-categories` and send the chosen `categoryKey`, and LeadSpace needs a listed key (or an exemption, which I did not add because you asked for no exceptions). Deploy the backend and the form together, or signup is closed in between.

Tests: `test/s1-addendum.spec.ts` (22). Affected suites rerun and green: s1-free-home, route-classification, pack-wire, admin-role-matrix, b2-registration-site, duplicate-paths, plans-registration, terms-session, wave3-referrals, wave3-trial.

## Addendum S3 `plan` on `GET /cms/site/:subdomain`
The answer the public site app reads now carries `plan: 'FREE'` when the vendor's CURRENT plan (ACTIVE or GRACE) has level FREE, and `plan: 'PRO'` for any other held plan. A vendor with no current plan (a legacy vendor, or one whose plan has expired or been cancelled) has **no plan field at all**; a sandbox vendor is never served by this route (404), so it has none either. The read selects only `plan.level` of the vendor's own current subscription: no plan id, key, track, price or subscription id can reach the answer. No new caching: the site app's existing 60 second cache rule is unchanged, so a Free-to-Pro change shows within a minute.
Note: the plan table has only the levels FREE and PRO. The trial site that registration builds runs on the track's Free plan, so "the TRIAL kind" is level FREE and gives `FREE`. There is no separate TRIAL level to map.
Tests: `test/s3-site-plan.spec.ts` (9): Free, trial (Free plan), Pro, an unfamiliar level (PRO), no plan, sandbox and unknown vendor, the exact read, the answer's keys equal the old keys plus `plan`, and a test that fails if any e-mail, phone, id, price or plan detail appears. Staging: `node scripts/staging/s3-check.js`, 7 of 7 passed (Free fixture FREE, Pro fixture PRO, no plan and an expired plan have no field, no personal or plan detail, 4 fixtures removed, 0 left).
For the site app (P8): read `site.plan === 'FREE'` to render the information-only page; treat an absent field as "not a V3 plan" (render as before).
