# Dispatch report: lane B6 (registration site build, plan chooser, two live repair scripts)

Branch `v3-lane-b6` (from `v3-lane-k1`), worktree `get4domain-w2`. Nothing pushed. No `.env` file or secret was read or printed. Staging only; nothing was sent.

## B6.1 Cause of the ConflictException

**Rule that throws:** `SiteBuildService.buildWith` (`backend-api/src/site-publish/publish/site-build.service.ts`): when `categoryFor(doc, kit, categoryMap)` returns null it throws
`ConflictException` `PUBLISH_BLOCKED` with `missing: [{ code: 'CATEGORY' }]` ("This business has no category yet, so its site cannot be built."). Stage: **build** (after the draft site and address already exist).

`categoryFor` only accepts a vendor `industry` (or the CMS `packKey`) that is a theme-kit category, a pack in the kit's category map, or a catalogue key with a pack fallback. The signup form sends `industry` as a free string
(`RegisterDto.industry` is any string), and `RegistrationHook.resolveTrack` defaults an industry it does not know to `handyman`. So a Free "handyman" signup whose category is a free-text word such as `handyman`, `services`, `general`, `hr`
fails here **every time**, and the vendor's own retry (`POST /v3/me/site/create` -> `createMySite`) runs the same rule on the same data, so it can never succeed.

**Reproduced on staging** (real registration hook, trial site, build and publish services, tagged fixtures, removed afterwards; no phone, nothing sent). Before the fix, attempt 1 and attempt 2 both failed:

| industry sent | result before the fix |
|---|---|
| 56 handyman catalogue categories (for example `ac-appliance-repair`) | LIVE both attempts |
| `plumber`, `clinic`, `realestate`, `travel` | LIVE |
| `handyman`, `Handyman`, `services`, `general`, `hospital`, `hr`, `Other` | **FAILED, siteProvisionCode PUBLISH_BLOCKED**, both attempts |
| `restaurant` | FAILED with the fallback code SITE_FAILED once; **not reproduced** after the fix, cause not identified (see limits) |

**Suspects you named, checked and cleared (not the cause):**
- The vendor's own draft site row: `CmsDraftSiteProvisioner` upserts on `vendorId`; a second run keeps the same row (staging: one `VendorCMS` row after two attempts).
- Address/subdomain uniqueness against the vendor's own reservation: the trial path never re-checks the address after the vendor exists (`TrialSignupPolicy.taken` runs only at signup, before the vendor row exists); the publish step does not bind a host.
- Duplicate check matching the vendor's own record: the check runs before the vendor is created. The one place a duplicate can stop a site is the **review hold** (`DUPLICATE_REVIEW_PENDING` at publish), which is by design (D1) and needs staff to clear it. It is now visible in the diagnosis script.

**Fix (additive, no migration):**
- `categoryForTrack` (`content-adapter.ts`): the vendor's own kit category when there is one; otherwise the neutral design of the vendor's track (`TRACK_FALLBACK_CATEGORY`: handyman `plumber`, professional `it-consultant`, ecommerce `electronics-mobile`, the same pack fallbacks the directory already uses; a test checks each is a real kit category of that track). Used by the build and by the publish re-check.
  A vendor with no known track and no placeable category still gets the honest PUBLISH_BLOCKED / CATEGORY refusal.
- Retry is idempotent and was already reusing the vendor's own draft and address; this is now covered by a staging check (same site row, same publication count after the retry, address unchanged). A conflict on the address only arises from another vendor's host row (shown by the diagnosis script).
- Logging: `RegistrationHook` now logs `siteProvisionCode=... stage=draft|build|publish rule=<missing-field codes>` and still records the code on the vendor. The stage is set by `ModuleTrialSite`. No e-mail, phone or error text is logged (test).

## B6.2 Plan chooser

`GET /v3/me/plan-options` (new, owner only; `MePlansController`). Before this there was no route that gave the vendor the plans of their own track: the public pricing lists all three tracks, and the chooser had to guess the track (from the site, which does not exist when the build failed, hence "No plans are open for your kind of business yet").
- **Track:** the track of the plan the vendor holds (a registration gives the track's Free plan), else the minimum tier of the category chosen at registration. Never the site. Plan rows store the track in upper case (`HANDYMAN`); it is matched case-insensitively and answered in lower case.
- **Plans and terms:** ACTIVE public PRO plans of that track; for each, only the terms 3, 6, 12 that have an APPROVED INR price already in force (newest started wins); a term without one is left out; a price that cannot be shown without a GST rate is never a number. A plan with no priced term is left out.
- **Nothing to choose:** `reason` is `TRACK_UNKNOWN`, `NO_PLANS_FOR_TRACK` or `NO_APPROVED_PRICE` with a plain `message`.
- Response: `{ track, trackSource: 'PLAN'|'CATEGORY'|null, plans: [{ key, name, track, description, terms: [{ termMonths, price: { priceMinor, gstMinor, totalMinor }, purchasable }] }], reason, message }`.
- **The vendor app screen is not in this repository**; it must call this route instead of filtering the public pricing by the site's track.

## B6.3 / B6.4 Scripts (backend-api/scripts/live, need `npm run build`)

- `diagnose-vendor.js --email <e> | --id <id> [--staging]`: read only (a test fails if the script contains any write call). Prints track (plan held, category, which the chooser uses), plan, site row, publications and missing-for-search-engine fields, whether the build would use the vendor's own category or the track default, `siteProvisionStatus`, `siteProvisionCode`, the duplicate-review hold, the address owner (this vendor / another vendor / none), and the chooser's plans and terms. Never prints a phone or an e-mail. Refuses non-live databases with the same guard as the other live scripts (`--staging` selects the staging database for rehearsal).
- `retry-site-provision.js --email <e> | --id <id> [--apply] [--staging]`: dry run by default (reads, prints what a retry would do, writes nothing); `--apply` asks for the typed word `LIVE`. Refuses a vendor that is not a non-suspended vendor account with `siteProvisionStatus = FAILED`. Calls `RegistrationHook.createMySite`, the service behind the retry route. Every provider key is removed and e-mail set to capture mode before the services start, so it sends nothing.

## Choices I made (change any of them)
1. Track default categories (plumber / it-consultant / electronics-mobile) rather than adding a new "general" kit design.
2. The fallback lives in the build and publish re-check only. The settings status, the Website manager and the theme-switch pipeline still call `categoryFor` without a track.
3. Terms offered are limited to 3, 6 and 12 (no monthly), the same set as the public pricing.
4. The chooser route is owner only (a team member never starts a payment).
5. Plan track in the response is lower case, unlike the public pricing, which echoes the stored value.
6. `--apply` on `--staging` still asks for `LIVE`.

## Tests
- `test/b6-site-category.spec.ts` (12): free-text categories build, retry is idempotent, publish works, unknown track still refuses, defaults are real kit categories, log line, stage tagging. `site-build.spec.ts` updated for the new rule.
- `test/b6-plan-options.spec.ts` (12): annual only approved, all terms approved, track from category, held plan wins, upper-case track, no price at all, draft/future/non-INR never shown.
- `test/b6-live-scripts.spec.ts` (11): argument rules, read-only, no phone or e-mail, refusal of non-live databases, dry-run default and ordering, provider keys removed.
- Also run and green: wave3-trial, b2-registration-site, b5-site-facts, site-publish, site-seo, website-seo, theme-switch (all), route-classification (baseline regenerated; it also records two earlier drifts: K1's `GET /v3/admin/overview` and `GET /v3/me/site` now reading the principal).

## Staging check
`node scripts/staging/b6-check.js` (staging only, tagged fixtures and one tagged category pack, all removed, nothing sent): **20 of 20 checks passed, 0 fixture vendors left.** Covers no starter content, starter content (a tagged pack with the real starter seed), a catalogue-style key, retry idempotence, diagnosis without personal data, the repair of a failed vendor, an address owned by another vendor, and the chooser through the real service.

## Live steps (you run these; I touched nothing live)
1. Deploy the lane (no migration). `npm run build` in `backend-api`.
2. `export` the live env, then `node scripts/live/diagnose-vendor.js --email <the affected vendor>`. Expect `siteProvisionCode: PUBLISH_BLOCKED` and `build category: ... track default`. **If the code is anything else** (for example `DUPLICATE_REVIEW_PENDING` or `PUBLISH_BLOCKED` with another rule), stop: my cause then does not match live and the line tells you which rule it is.
3. `node scripts/live/retry-site-provision.js --email <vendor>` (dry run), then add `--apply` and type `LIVE`.
4. Re-run the diagnosis: status cleared, publication PUBLISHED, chooser lists the handyman plan.
5. Point the vendor app's Plan and billing screen at `GET /v3/me/plan-options`.
6. Other affected vendors: `select` vendors with `siteProvisionStatus = 'FAILED'` and repeat steps 3-4 per vendor.

## Limits
- I could not read live, so the cause is proven on staging and on the code, not on a live row. Step 2 confirms it on live in one command; the new log line will name the rule for any new failure.
- Staging has no category packs, so "a category with starter content" used one tagged pack built from the real starter seed; the failing rule fires before content matters, so the result is the same either way.
- `restaurant` failed once with an uncoded error in a batch run and passed in every later run; I did not find the cause. The new log line (code, stage, rule) will show it if it recurs.
