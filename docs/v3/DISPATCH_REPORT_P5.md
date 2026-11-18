# Dispatch report P5: search, domain search, register by plan

Branch `v3-pub-fe13` (created from `v3-pub-fe12`; no earlier fe13 branch existed, so there was no half-finished work to keep or remove). Not pushed. No backend change, no .env read. Backend read only: `get4domain-w2` (branch `v3-lane-b4`) and `DISPATCH_REPORT_B3.md`.

## Done
- **P5.1 Search.** New `/directory-api/suggest?q=&type=` proxies `GET /v3/directory/suggest` (businesses, categories with sub categories, places, 8 of each). The shared box (home and directory) shows grouped suggestions after 2 letters with a pause, and says in words when it is loading, has nothing, or could not be fetched (502 from the route). A typed place and a six digit pincode go to the backend as typed (`location`); the old "unknown place" guess is gone, the screen shows the backend's own `locationUnknown`. Results carry the business id (`data-business-id`). Place box offers "Search the pincode N".
- **P5.2 Domain search.** `/directory-api/domain-availability` proxies `GET /v3/public/domain-availability`. Subdomain: available, taken, reserved, invalid, plus the similar-name warning. Custom domain: "not switched on yet" while the registrar is off; per extension results only when the API gives them. Any unreadable answer is shown as "could not be checked", never available. "Create this site" appears only for AVAILABLE.
- **P5.3 Register.** City, area, pincode (required), GSTIN (optional, 15 characters). 409 `DUPLICATE_POSSIBLE` shows "Is this your business?" with public listing facts, a claim/view link and "No, this is a different business", which resends with `confirmDistinct: true`; the form keeps the typed password for that. `DUPLICATE_BUSINESS` shows its message and a claim link. Track logic kept.
- **P5.4** Directory host `/account/register` is a 308 to the main `/register` (query kept) in the host layer, with a page-level fallback.
- **P5.5** Choose buttons already carried plan and term; the Free card (and growth page links) now go to `/register`.
- **P5.6** The price route's top-level `free` entry is read as kind FREE or TRIAL, kept out of the Pro plans, and its name feeds the Free card; a name with the retired trial word is replaced.
- **P5.7** "Pro plans", "See Pro plans", "Move to a Pro plan" across the public copy; copy guard tests updated and a new guard added. Legal documents untouched.
- **P5.8** With `?plan=` and `?term=`: title "Create your account for {plan}", summary card (plan, term select, price from the price route only, "billed {term} {total} + GST"), "Change plan" to pricing, button "Continue to payment". No plan keeps the Free wording and "Create my account".
- **P5.9** Category picker: a button opening a bottom sheet (centred panel on larger screens) with search and family groups, 48 px rows, Escape closes. A Pro plan lists only its track (from `minTier`); "My business isn't here: see all categories" shows all. Picking another track's category switches the plan, with a visible notice and the price updated. Free lists all by family.
- **P5.10** After a Pro registration: "Your account is created. Continue to payment", says the plan is not paid for yet, says the site was created only when the answer's `site.status` is LIVE or published, and links to the vendor app `/login?next=/app/more/plan?plan=..&term=..`.

## Choices made
- "What you sell" is **not added**: `RegisterDto` has no such field and the pipe uses `forbidNonWhitelisted`, so sending it would reject signups, and collecting it without sending it would be dishonest.
- Sub category level: the pack-categories answer has family and category only, so the picker groups family then category and shows a sub line only if data carries one (supported, empty today).
- Pro never auto-redirects; Free redirects only when the answer says the site is published (as before).
- The `next` path `/app/more/plan` is the vendor app's Plan and billing screen. I found no code in the vendor app that reads `next` or `plan`/`term` yet.
- Sample mode: sample categories now have tiers (Professional, Ecommerce, Handyman) so the track picker can be reviewed; a business called "Adyar Plumbing House" triggers the duplicate step.
- Left as is: the comparison column "Paid plan" and "paid plan" inside sentences (only the three named phrases were renamed).

## Gaps to know
- Vendor app must read `next`, `plan` and `term` after sign-in (other lane).
- No field for what the business sells; no sub categories in the category list.
- `scripts/v3-public/smoke-g3.mjs` line ~219 still expects the old suggest answer (`places`/`categories` trees); not run, not updated.
- Prices in screenshots are the sample price route.

## Verification
`npm.cmd run test:v3-public`: 492 pass, 0 fail (P5 suite added). `tsc --noEmit` clean. `next build` passes. `scripts/v3-public/p5-shots.mjs` against `next start` (sample data, main and directory hosts): ALL PASSED at 375, 768 and 1280 (suggestions, pincode, unknown place, domain states, pricing links, register Free and by plan, picker, plan switch, duplicate step, payment screen, no sideways scroll, no page errors, 308 redirect). Screenshots in `docs/v3/p5-shots/`.
