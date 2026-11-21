# DISPATCH REPORT G1 (backend lane)

Branch `v3-build-be`, from `v3-audit`. Not pushed. Status table: `DISPATCH_STATUS_G1.md`. Exact commands to see the work: `SEE_IT_BACKEND.md`.

## Result

| Job | State | What is real now |
|---|---|---|
| B1 enquiry path | DONE, proven on staging | `POST /v3/public/sites/:host/enquire` takes exactly what the theme form posts (urlencoded or JSON), builds the request, the consent and a server idempotency key, keeps every gate (404 for unknown, Free, suspended, taken down), spam score, block list and phone code, writes the copy into the vendor inbox the Enquiries screen reads, and sends the e-mail alert through the guarded mail port. Held rule: a business whose plan is not active has the enquiry kept HELD only when `heldEnquiriesEnabled` is on AND counsel's consent text is published, else one plain 404 |
| B2 price book | DONE (unit) | `GET /v3/admin/price-book` (every plan term, service, pack: IN_FORCE, SCHEDULED, PROPOSED or PRICE_PENDING, with counts), `POST /v3/admin/prices/:priceId/approve` (SUPER_ADMIN, audited), and the theme switch fee on `GET /v3/public/pricing` (`themeSwitch`, pending is never a number). Service and pack price routes already existed |
| B3 vendor screens | PARTLY | `POST /v3/me/customers/import`, `GET /v3/public/packs`, `GET /v3/public/packs/:key/demo`, a per-pack demo content set (16 packs, no price). `B3_SCREEN_GAPS.md` classifies all sample-only screens: 14 wiring only, 1 built, 10 need a table or a provider and are written as contracts, not built |
| B4 claim and go-live | DONE (unit) | the approval route and its tests already existed; added `GET /v3/me/claim/status` (not a listing / not claimed / awaiting approval and whether the owner may approve / live) and a whole-path test |
| B5 journeys | PARTLY | journey 4: `GET /v3/me/billing/orders/:id`; journeys 1 and 2: registration answer now carries `termsAcceptanceRequired`; journey 3 and 8: B1 and B4; journey 9: B2 gives the owner the way to set the fee. Not backend: journeys 7 and 12 staff screens, 6 needs owner data, 4 never exercised on a gateway (needs the owner's test keys) |
| B6 themes | PARTLY | the four kit-only category ids now count toward their pack (MEMBERSHIP_WELLNESS finds the Studio theme); packs with no designed category get the theme of their kit category, marked `KIT_FALLBACK` and `dedicated:false`; catalogue items carry `description`, `premium` and a generated `preview` path; `GET /v3/public/themes/:id/preview?pack=` draws the real renderer with the pack's sample business (no price, noindex); `scripts/build-theme-gallery.js` (80 renders, 0 MISSING). **Not done:** real new themes for PHARMACY, B2B_DEALER, RENTAL_FLEET, MEMBERSHIP_WELLNESS (a design job, the kit has none), Premium themes (T2), kit lint in CI (T4), stored thumbnails |
| B7 checks | DONE | see below |

## Checks run

- `npm.cmd run build`: passes.
- `npm.cmd run test:ci`: **295 suites, 5675 tests, all pass** (run after the last code change; commits after it are documents and the baseline only).
- Integration file `test/enquiry-form.int.spec.ts`, alone: 2 of 2 pass on staging. `npm.cmd run test:cleanup-staging` then `--count`: **0**.
- Route baseline regenerated: 1439 to 1448, the diff is exactly the 9 new routes (the old line-ending-only difference on that file is gone).
- No migration was written, so none to verify or apply; staging schema untouched.

## Incident to know about

My first staging command used `--selectProjects int <path>`; that option is variadic, so jest took the path as a second project name and ran the **whole** int suite (73 suites, about 26 minutes) against staging while I was still editing, so 49 suites failed to compile and say nothing. All synthetic data was cleaned afterwards (6 leftover tenants removed, count 0). Correct form: `npx.cmd jest --ci --runInBand --testPathPattern <name> --selectProjects int` (path first, flag last). One of the few suites that did run, `vendor-gaps.int.spec.ts`, fails on an extra `onFreePlan` field in the next-steps facts: that test is stale and was not caused by this work (not touched).

## Contract changes (all additive)

New routes: `POST /v3/public/sites/:host/enquire`; `GET /v3/admin/price-book`; `POST /v3/admin/prices/:priceId/approve`; `POST /v3/me/customers/import`; `GET /v3/public/packs`; `GET /v3/public/packs/:key/demo`; `GET /v3/me/claim/status`; `GET /v3/me/billing/orders/:id`; `GET /v3/public/themes/:id/preview`.
New fields: `themeSwitch` on public pricing; `termsAcceptanceRequired` on the registration answer; on theme catalogue items `description`, `premium`, `preview`; on the catalogue answer `dedicated` and `matchedBy: KIT_FALLBACK`.
New error codes: `PRICE_DATE_INVALID`, `PRICE_DATE_IN_PAST`, `PRICE_START_CLASH`, `CUSTOMER_IMPORT_TOO_LARGE`. Role rows: price book read OPERATIONS and SUPER_ADMIN (not ADMIN, not MARKETING); plan price approve SUPER_ADMIN only.

## Migrations

None written, none applied.

## Assumptions

1. The form's consent tick means `contactByBusiness` and `contactByPlatform` true, marketing false, at the current text version.
2. An empty message is stored as "(no message written)" rather than refused (the theme's textarea is optional).
3. Idempotency key = host, phone, message and the duplicate-window bucket, so a double click is one enquiry; the same words after the window score as a duplicate and may ask for a phone code.
4. A browser form post (Accept: text/html) is answered 303 to `/?enquiry=sent`; the public site half (Q2) is another repo.
5. The held rows go to the mail inbox only (no request row), counted against `inboxRatePerHour` when the owner has set it.
6. Plan price approval starts "now" unless a later date is given; a past date is refused.
7. Pack demo content comes from the theme kit's sample fixtures with prices, offers, stats, ratings and sample quotes removed; four packs have their own hand-written business.

## Questions for the owner

1. Should a claimed listing be approved automatically when the owner finishes account setup (terms are accepted there), instead of waiting for an approve click in the vendor app?
2. Which of the 10 schema-needing screens come first (deals, tasks, segments, reports, invoice settings)? Each needs a migration, so each is its own dispatch.
3. Who designs the four missing pack themes (pharmacy, B2B dealer, rental fleet, wellness) and the first Premium set?

## Owner commands

```powershell
cd C:\Get4Domain\get4domain-w2\backend-api
node scripts/build-theme-gallery.js
Start-Process C:\Get4Domain\w2-theme-gallery\index.html
```
Smoke API and the enquiry post: `SEE_IT_BACKEND.md` blocks (b) and (c). Nothing needs deploying for this to be reviewed; to ship it, push is the owner's call (a push creates a Vercel Preview).

## Commits

`b7d3a29` B1 route; `4bd5651` mail module fix; `cb8116c` B2; `c059801` B3; `37904f4` B4; `ee0ba1f` B5; `6496d52` B6; `ec3809a` route baseline; plus the documents commit after this report.
