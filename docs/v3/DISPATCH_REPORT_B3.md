# Dispatch report B3: B3.0 price book (urgent), B3.1 to B3.6

Branch **`v3-lane-b3`** (cut from `v3-dup-check`). The name `v3-b3` was already taken: it is the earlier Batch 3 branch, merged into `v3-dup-check` and checked out in the `get4domain-b3` worktree, so it was not moved or deleted. Nothing pushed. No `.env` file or secret was read or printed. Staging was used (this lane only).

Migrations (all additive, `verify-migrations-additive` passes each; applied to staging, **not to live**):
- `20270107100000_v3_b3_plan_service_allowances` (new table, row level security on)
- `20270109100000_v3_b3_price_withdrawn` (one new value `WITHDRAWN` of the enum `V3PriceStatus`)

Not done: the pack-engine loader was not run against staging (the command was refused by the permission classifier); run it yourself, see "Run on live" steps 4 and 6.

## B3.0 Price book: why the nine prices say PRICE_PENDING (code read, staging rehearsed)

What decides the public price (`/v3/public/pricing`, `public-pricing.service.ts` + `public-pricing.shape.ts`): for each ACTIVE public paid plan and each term, the **latest `APPROVED` row whose start (`effectiveFrom`) is not later than now and whose currency is INR**. That row is "in force". Everything else is ignored: `PROPOSED`, `WITHDRAWN`, a start in the future, another currency. The start date is stored on the row itself (`effectiveFrom`, set when it is approved; the admin screen sends a bare date, "today" means "from now").

**(1) Why an approved price can still show PRICE_PENDING.** `propose-v3-prices.js` reports a row as "approved" by its **status only**; it never looks at the start date. The public route also needs the start to have passed. Causes, in order of likelihood:
1. The row is APPROVED with a **start date in the future** (a later date chosen in the Prices screen, or an approve before the B2.3 fix that took "tomorrow"). It shows PRICE_PENDING until that moment, even though it is "approved".
2. The price **holds GST** (`taxInclusive`) and **no active tax rate** exists: the price cannot be split, so it is shown as pending.
3. The row's currency is not INR.
4. (Whole plan missing rather than pending) the plan is not ACTIVE and public.
I could not look at the live rows from here. **`node scripts/live/price-book-report.js` (new, read only) prints, for each plan and term, every row, which one is in force and the reason when none is.** Run it on live first; it names the cause.

**(2) A second approved price for the same plan and term.** It does not end or replace the earlier row. If it starts at the **same moment**: refused, 409 `PRICE_START_CLASH`. Otherwise both stay APPROVED and the one with the **latest start that has passed** is in force; the older one stays as history. Trap (tested): an approved row that starts **later** still takes over at its start, whatever was approved after it. So a wrongly approved future-dated row will silently replace the right price on its start day: it must be withdrawn.

**(3) Correcting a wrongly approved price.** Before this change the only tools were `PUT /v3/admin/prices/:id` (edits amount, date or status of a row, which rewrites history) and `DELETE` (removes the row). New: **`POST /v3/admin/prices/:priceId/withdraw` `{ "reason": "..." }`**, SUPER_ADMIN only, reason required (5 to 300 characters), one audit row (`price.withdraw`: before, after, reason, whether it was in force, what is in force afterwards). The row, its amount, its start date and its creation time are never edited; only its status becomes `WITHDRAWN`.
- Not yet in force (future start): it never starts. The earlier started price stays in force.
- In force: the latest earlier started APPROVED price of that plan and term is in force again, or PRICE_PENDING if there is none. The answer says which (`wasInForce`, `inForceAfter`).
- Subscriptions keep their own copy of the price they were sold at, so nobody already subscribed changes.
- A withdrawn row cannot be approved again (propose a new price). Withdrawing twice answers the same row and logs nothing. A PROPOSED row is not withdrawn; delete it (existing route). A wrong price that is already in force can also simply be **superseded**: approve the correct proposal from now and it wins (latest start); withdraw is for removing a row completely or a future-dated one.
- Edge: a withdrawn row still holds its start moment, so approving another price for the same plan and term at exactly the same millisecond still gives PRICE_START_CLASH (practically only an issue for a scripted approve).

**(4) Exact steps on live so the nine new prices become the prices in force** (rupees before GST: handyman_pro 2247 / 3774 / 5988, professional_pro 4497 / 7494 / 11988, ecommerce_pro 5847 / 9774 / 15588 for 3 / 6 / 12 months):
1. Deploy this branch's build, then apply the migrations: `node scripts/live/migrate-live.js status`, then `... deploy` (type LIVE). This adds only the `WITHDRAWN` value and the allowance table.
2. `node scripts/live/price-book-report.js` (read only). Note, for each plan and term, the id of every APPROVED row that is **FUTURE** or otherwise wrong.
3. For each wrong or future-dated approved row: `POST /v3/admin/prices/<id>/withdraw` with `{"reason":"entered with the wrong start date"}` (SUPER_ADMIN). Old approved rows that already started and are simply old do not need withdrawing: a newer start replaces them, and they stay as history.
4. `node scripts/live/propose-v3-prices.js` (dry run), then `... --apply` (type LIVE). It proposes only, never approves.
5. In the admin Prices screen (or `POST /v3/admin/prices/<id>/approve` with `{"effectiveFrom":"<today as YYYY-MM-DD>"}`) approve each of the nine proposed rows, starting today. Today means "from now": they are in force at once.
6. Re-run `price-book-report.js`: each of the nine lines must say IN FORCE with the new amount. Then `GET /v3/public/pricing`: all nine terms `AVAILABLE`. If the tax rate line of the report says NONE, set up the GST rate (otherwise `purchasable` stays false and a GST-inclusive price shows pending).
Staging rehearsal with the real service (`scripts/staging/b3-price-check.js --approve-nine`): a wrong future-dated price was approved, shown not in force, withdrawn with a reason (row kept, one audit row, second withdraw no new row), then all nine proposals were approved and each is the price in force. Staging is left in that state (nine in force, one withdrawn rehearsal row on handyman_pro 3 months).

**Free plan in the public pricing.** `kind: 'TRIAL'` was a constant in `public-pricing.shape.ts`; the description was taken from the first Free plan by sort order, which is `handyman_free` ("...for handyman and home-service businesses", from `v3-plans.seed.json`). Now the public Free entry is one neutral entry that borrows nothing from a track: `{ key: 'free', name: 'Free plan', kind: 'FREE', description: 'A free website and directory listing for any kind of business.', informational: true }`. Note: `kind` changed from `TRIAL` to `FREE`; the public site and the apps must read `FREE` (the UI repo only references `TRIAL` in a test fake). Nothing to change on live for this (it is code, not data).

## B3.1 "Free trial" label
The label shown in the vendor app is **app text**, not live data: `get4domain-ui/apps/vendor/src/strings.ts` line 34 `planFree: 'Free trial'` (and line 541 `'You are on the Free trial.'`), used by `HomePage.tsx:74` (`plan === 'free' ? S.planFree : info.name`) and `PlanScreen.tsx:91`. That repo was not touched: change those strings to "Free plan". Backend: the three Free plans were named "Handyman Free / Professional Free / Ecommerce Free" in `v3-plans.seed.json`; the seed now names all three **"Free plan"**; the public pricing Free entry is "Free plan". New audited route `PUT /v3/admin/plans/by-key/:key/name` `{ "name": "Free plan" }` (SUPER_ADMIN, key never changes, same name = no write, `plan.rename` audit row).
**Run on live (as SUPER_ADMIN):** `PUT /v3/admin/plans/handyman_free/name`, `.../professional_free/name`, `.../ecommerce_free/name`, each with `{"name":"Free plan"}`. (The seed loader never overwrites an existing row, so it will not do this.)

## B3.2 Held duplicate review
The routes already existed: `GET /v3/admin/duplicates/reviews`, `POST .../:id/clear`, `POST .../:id/reject` (ADMIN or SUPER_ADMIN, written reason, 409 when already decided). Gaps fixed: the list returned bare ids; it now carries the **held business** (name, subdomain, trade, registered date), the **matched record** (name, subdomain) and its **public listing** (slug, name, category, city, area; never phone, e-mail or owner), plus the signals and score. A decision now writes an **audit row in the same transaction** as the status change (`duplicate.review.clear` / `.reject`, who, reason); before, only the review row held it. Tests added.

## B3.3 Included services
- New table `g4d_plan_service_allowances` (plan, term 3/6/12, group, quantity). **No row = not set**: the owner set no numbers, so none are written or defaulted.
- Six groups: REELS (the three reel services), POSTERS, POSTS, BLOGS_CONTENT (blog creator, content creator), SUBDOMAIN_SPOTLIGHT (no request service exists yet, stored and reported only), SEO_KEYWORD_WORK (SEO manager, per keyword).
- SUPER_ADMIN `PUT /v3/admin/included-services/:planKey/:termMonths/:groupKey` `{ "quantity": N | null }` (null clears to not set; 0 refused), audited; `GET /v3/admin/included-services` (OPERATIONS and SUPER_ADMIN) shows every paid plan x 3 terms x 6 groups.
- `GET /v3/me/services`: each service now has `included: { state: 'INCLUDED' | 'NOT_SET', group, limit, used, remaining }` and the answer has `includedServices` per group. INCLUDED only when a quantity is set for the vendor's plan **and billing term**; the count is shared across a group's services. A Free vendor (no term) gets NOT_SET. Request creation uses the same quantity, so what is shown is what is funded.
- Funding kind: the existing enum value is `INCLUDED_ALLOWANCE` (the "PLAN" funding); renaming it would be a breaking change, so it was kept. The older per-plan feature `services.included.<KEY>` still works as a fallback when no term quantity is set.
- Add-on pack `CUSTOM_DOMAIN_SEO_ADS` ("SEO and paid ads for your own domain"), price PENDING (the pack engine allows this; the add-on holds no amount), added to `pack-engine-settings.json`; it is created by the pack-engine loader (Run on live, step 4).

## B3.4 Navigation keys
Thirteen new COMMON tabs in the pack-engine data (`pack-engine-settings.json`), so the server decides the state: Free-open (ACTIVE on Free): `profile, notifications, legal, account, activity` (what the app's own fallback list opened); paid-only (LOCKED_PREVIEW on Free, ACTIVE on paid, locked again when paused): `tasks, offerings, reviews, chat, reports, wallet, packs, team`. Bar groups added to `COMMON_TAB_GROUP`: tasks and offerings business; reviews, chat, reports grow; wallet, packs money; team, profile, notifications, legal, account, activity more. Team audiences (`TEAM_TAB_AREA`): owner only: wallet, packs, team, profile, activity; any member: tasks, notifications, legal, account; by area: offerings website, reviews campaigns, chat communication, reports reports. The navigation state comes from the tab data (the `freeTrial` flag), not from `v3-plans.seed.json`, so the plan feature seed was not changed. Existing tests that pinned "four ACTIVE tabs on Free" and "13 common tabs" were updated to nine and 26.

## B3.5 Directory search
- G49: a typed word matches the name or description (as before), **a category it answers to** (name, parent category names, staff-reviewed singular/plural/synonyms/specialisations from `g4d_seo_category_keywords`), or **a service name**; every word must be found somewhere (AND); prefix matching kept.
- G50: `GET /v3/directory/suggest?q=&type=category,place,business&limit=` (max 8 each). Categories and places come from the 60 s cached trees (no query), businesses from one parameterised prefix query (`ILIKE`, the existing trigram index); public statuses only; text normalised first; throttled; two characters minimum.
- G51: `location` accepts a slug path, **typed text** ("Adyar", "Adyar Chennai") or a six digit **pincode**; text that matches no place gives no results and `filters.locationUnknown: true`.
- G53: every result and the detail carries `id` (the directory business id, never the vendor id).
- G55: `search` added to `RESERVED_SEGMENTS`. Not built: near me, open now (G52), popularity (G56). Synonyms work through the keyword table only.
- Staging check (`scripts/staging/b3-check.js`, two tagged fixture businesses made and removed): 19 checks passed, including search timings of 140 to 1,600 ms (first call includes tree loading). **Staging caught a real bug**: a regex lost its backslashes in my edit and a word with no letters left produced a `:*` tsquery error; fixed with a tested helper (`tsWord`).
- No migration (an index migration was dropped because the staging drift gate allows only two intentional items).

## B3.6 Public domain availability
`GET /v3/public/domain-availability?name=` (no login, throttled, never cached). Answer: `{ name, subdomain: { state: AVAILABLE | TAKEN | RESERVED | INVALID, name, message, similarTo }, customDomain: { state, registrar: 'ON' | 'OFF', message, results[] } }`. Custom domain states: `REGISTRAR_OFF` while `REGISTRAR_LIVE_SEARCH` is off (the registrar is never called), `AVAILABLE` / `TAKEN` / `UNKNOWN` per extension when on, `NOT_FOR_SALE` (no extension with an approved price, or the typed extension is not sold), `INVALID`. "Available" is said only when the registrar itself said AVAILABLE; a registrar error is `UNKNOWN`. TAKEN for a subdomain covers "taken" and "not allowed" (the existing signup check deliberately gives one answer). No prices are returned. The same name is asked of the registrar at most once a minute. Staging check: registrar off gives REGISTRAR_OFF and no registrar call; on with nothing on sale gives NOT_FOR_SALE.

## Decisions I made
1. Branch name `v3-lane-b3` (see top). 2. Withdraw = a new enum value, not an edit or delete. 3. Free public entry kind `FREE`. 4. Allowance groups and the service-to-group mapping (above). 5. Funding enum name kept. 6. Profile, wallet, packs, team, activity owner only for team members. 7. `TAKEN` for taken and blocked subdomains.

## Run on live (in this order)
1. Deploy the build, then `node scripts/live/migrate-live.js status` and `deploy` (two additive migrations).
2. `node scripts/live/price-book-report.js`; withdraw wrong rows; propose and approve the nine (B3.0 steps 2 to 6 above).
3. Rename the three Free plans (B3.1).
4. `node scripts/live/seed-live.js seed-v3-pack-engine.js` (dry run), then `--apply` (type LIVE): creates the 13 navigation tabs and the add-on pack; it only adds missing rows.
5. Nothing to run for B3.2, B3.5, B3.6. Quantities for B3.3 stay not set until the owner decides.
6. Staging only, for me or you: `node scripts/seed-v3-pack-engine.js` then `--apply` was not run (refused); until it is, staging lacks the 13 tabs and the add-on.

## Not done / watch
- Vendor app: "Free trial" text, a response type change for `kind`, reading `included` and `includedServices`, the new tabs: other repos, not touched.
- Staging drift gate fails on `Vendor_businessName_trgm_idx` (from the earlier duplicate-check migration, not from B3); the two B3 migrations add nothing the gate flags.
- The full unit suite was not run, only affected suites (b3-*, pack, directory, duplicates, services, service-requests, registrar-adjacent, role matrix, route baseline, pricing). `tsc` clean for `src/` and `test/`; `npm run build` succeeded earlier in the lane (before B3.0). The route baseline was regenerated and also picked up the five routes of B1 and B2 it had not recorded.
- `PUT /v3/admin/prices/:id` can still edit an approved row; I did not lock it (existing screens may use it). Use withdraw for corrections.
