# V3 Wave 2 backend: pack records, vendor and admin gap routes, uploads, listing import, industry profile fields

Branch `v3-w2` (worktree `C:\Get4Domain\get4domain-w2`, branched from `v3-seo1`). Source of the work: `WAVE2_BACKEND_PROMPT.md`, the front-end gap files `FRONTEND_GAPS.md`, `API_CONTRACT_SLICE2.md` and `API_CONTRACT_ADMIN.md`, and Amendments 10 to 14.

**Status.** Built, unit-tested, committed. **Nothing is applied, nothing was run on staging, nothing is pushed.** The five migrations are written and verified (`verify:migrations`, `verify:raw-sql`) and are NOT applied. The five integration files are written and type-checked and were NOT run. Section 9 lists the owner commands in order.

Product text rules held everywhere: no timeframes, "enquiries" not "leads", never the words workspace, BOS or LeadSpace, prices exclude GST, a PENDING price is never a number. No real provider is called: storage is the existing R2 adapter, selected only by environment and settings and OFF by default; tests use the in-memory store.

## 1. Commits and migrations

| Part | Commit | Migration (NOT applied) |
|---|---|---|
| A pack records | `9619eca` | `20261219100000_v3_pack_records` |
| B vendor gap routes (+ C8) | `2be6a3b` | `20261219110000_v3_wave2_vendor_gaps` |
| C admin gap routes | `d321791` | `20261219120000_v3_wave2_admin_gaps` |
| D media and import, E profile fields (one commit: they share the schema, the error list, the role matrix and the module wiring) | `bc525f4` | `20261219130000_v3_wave2_media`, `20261219140000_v3_wave2_profile_fields` |
| F tests and this document | the commit after this file | none |

All five migrations are additive: new tables, new nullable columns, and one widened CHECK (the enquiry state gains HANDLED; no value is removed or renamed). Every new table has row level security on and no policy, the same rule as the earlier migrations. Table names use the repo's `g4d_` prefix (the brief wrote `v3_`).

| Table | Model | Holds | Scope |
|---|---|---|---|
| `g4d_pack_tab_fields` | `V3PackTabField` | the field list of each pack, capability or add-on tab (type, required, options, order, list column, searchable) | platform, staff editable |
| `g4d_pack_records` | `V3PackRecord` | a vendor's record on a pack tab (`data` jsonb, `searchText`, status), soft delete only | tenant |
| `g4d_migration_requests` | `V3MigrationRequest` | a request to move an existing site; one open request per business (unique `openVendorId`) | tenant |
| `g4d_promo_drafts` | `V3PromoDraft` | promotion and social drafts, never posted | tenant |
| `g4d_vendor_notes` | `V3VendorNote` | staff notes on a business; append only by trigger; no foreign key (like the activity log) | staff only |
| `g4d_plan_orders` + 4 columns | `V3PlanOrder` | `settledReference`, `settledOn`, `settledAmountPaise`, `settledByName` | existing |
| `g4d_media` | `V3Media` | uploaded pictures and pdf documents; `vendorId` NULL for a staff draft upload; unique `(scopeKey, sha256)` | tenant or staff draft |
| `g4d_category_profile_fields` | `V3CategoryProfileField` | profile fields per pack, and per category where the catalog says so (`categorySlug` empty = the whole pack) | platform, staff editable |
| `g4d_profile_site_map` | `V3ProfileSiteMap` | where a profile value goes in the site content (FIELD, LIST or NONE), most specific row wins | platform, staff editable |
| `g4d_vendor_profile_values` | `V3VendorProfileValue` | the checked values a business gave | tenant |

## 2. Routes (52 new)

Vendor routes are all behind `@UseTenant()`; the vendor is always the verified principal's. "Who" for staff routes is data in `src/auth/guards/admin-role-matrix.ts` (a route with no entry is SUPER_ADMIN only); SALES is the existing MARKETING value. The route baseline and the role oracle were regenerated; their diff is only these routes.

**Part A, pack records.** `:packKey` is the tab's OWNER (a pack, capability or add-on key, the `ownerKey` the navigation answer carries), because tab keys repeat across scopes (`billing`, `appointments`, `listings` each exist in more than one place).

| Route | Who | Notes |
|---|---|---|
| `GET /v3/me/packs/:packKey/tabs/:tabKey/schema` | owner and team | the form: fields in order, money marked paise and "Before GST", list columns, statuses |
| `GET .../records` | owner and team | `q`, `status`, `archived`, `page`, `pageSize`; a locked preview answers with `locked: true` |
| `GET .../records/:id` | owner and team | |
| `POST .../records` | owner and team | body `{ data: {...}, status? }`; unknown fields, wrong types, oversize values and markup refused, each named in `data.fields` |
| `PUT .../records/:id` | owner and team | only the fields sent change; `null` clears an optional field |
| `POST .../records/:id/archive`, `.../restore` | owner and team | soft delete only |

Tab rules: ACTIVE opens it; LOCKED_PREVIEW (Free trial, plan too low, paused plan) reads but never writes (403 `TAB_LOCKED`); HIDDEN or a tab the vendor does not have is refused even for a read; money and contract tabs (`OWNER_ONLY_RECORD_TABS`, data) refuse a team member (`PACK_TAB_OWNER_ONLY`); a LEGACY vendor is never restricted. COMMON tabs that already have their own contract (website, billing, accounting, domain, support, plan, migration, social, AI studio, promotion, CRM, TeleCRM, industry) have no generic record store (`PACK_TAB_NO_RECORDS`). Seeded fields: 96 record tabs, 434 fields.

**Part B, vendor gaps.**

| Route | Who | Gap |
|---|---|---|
| `GET /v3/me/site/theme/fee` | owner | 4: `{ pricePaise: number or null, priceStatus: SET or PENDING, taxNote: "Before GST" }`; never a number while PENDING |
| `GET /v3/me/domains/:id/log` | owner, tab `domain` | 5: `{ items: [{ at, action, result, attempts, by: YOU or GET4DOMAIN or SYSTEM }], page, pageSize, total }`; never a staff id |
| `GET`, `POST /v3/me/migration-requests` | owner, tab `migration` | 6: record only; a second request while one is open is 409 `MIGRATION_REQUEST_OPEN` |
| `GET /v3/me/navigation` | owner and team | 2: each tab carries `group` (home, business, grow, money, more) beside `scope` |
| `GET /v3/me/app-shell` | owner and team | 1: `nextSteps: [{ id, text, route }]` from real state; new shell section `nextSteps` |
| `GET /v3/me/billing/invoices/:id/download` | owner | 10: the invoice as an HTML file built from the stored invoice (escaped); the list now carries `snapshot.totalPaise` |
| `PUT /v3/me/inbox/:id/state` | owner | 8: accepts `HANDLED`; `GET /v3/me/inbox?state=HANDLED` |
| `GET`, `POST /v3/me/promotion/drafts`, `POST .../:id/archive` | owner, team with the campaigns area, tab `promotion` | 7: drafts only |
| `GET`, `POST /v3/me/social/drafts`, `POST .../:id/archive` | same, tab `social` | 7: drafts only |
| `GET /v3/me/team` | owner and team | 9: `{ departments, items: [{ id, name, role, department, areas, status }] }`; no email, phone or token |
| `POST /v3/me/team/invites`, `PUT /v3/me/team/:id`, `POST .../deactivate`, `.../reactivate` | owner only | 9: an invite is a record, nothing is sent |

**Part C, admin gaps.**

| Route | Who | Gap |
|---|---|---|
| `GET /v3/admin/permission-matrix` | every staff role | C1: `{ roles, fallback: [SUPER_ADMIN], routes: { "METHOD /path": [roles] } }`, read from the live matrix |
| `GET /v3/admin/vendors` | SUPER_ADMIN, ADMIN, OPERATIONS | C3: `q`, `plan` (PRO, FREE or a plan key), `status`, `industry`, `listingState`, `page`, `pageSize`; rows carry `plan` and `listingState` |
| `GET /v3/admin/vendors/:id/held-count` | same | C4: `{ count }` |
| `GET`, `POST /v3/admin/vendors/:id/notes` | same | C5: append only, audited without the note's text |
| `POST /v3/admin/billing/orders/:id/mark-paid` | SUPER_ADMIN (unchanged) | C6: body also takes `reference`, `receivedOn` (YYYY-MM-DD), `amountPaise`; the order lists `settledReference`, `settledOn`, `settledAmountPaise`, `settledByName` |
| `GET /v3/admin/invoices` | SUPER_ADMIN, ADMIN, OPERATIONS | C7: `vendorId`, `status` (PAID or REFUND_RECORDED), paging; rows `{ id, number, vendorId, totalPaise, status, refundRecordedPaise, issuedAt, financialYear, orderId }` |
| `GET /v3/admin/vendors/:id/subdomain-log` | same | C8 |
| `POST /v3/admin/seeded-sites/:id/go-live` | same | C12: idempotent |
| (no change) | | C13: `AdminRole` already has ADMIN and SUPPORT (Amendment 13 V9); covered by a test |

**Part D, uploads and import.**

| Route | Who | Gap |
|---|---|---|
| `GET`, `POST /v3/me/media`, `DELETE /v3/me/media/:id` | owner, team with the website area | multipart `file` and `alt`; a vendor's own uploads |
| `GET`, `POST /v3/admin/seeded-sites/:id/media`, `DELETE .../:mediaId` | SUPER_ADMIN, ADMIN, OPERATIONS, SALES | C11: for a listing made on behalf; audited against that business |
| `GET`, `POST /v3/admin/media/drafts`, `DELETE .../:mediaId` | same | C11: before the listing exists; only the person who made it sees it |
| `GET /v3/admin/seeded-sites/imports/template?category=` | same | C10: the columns |
| `POST /v3/admin/seeded-sites/imports/dry-run` | same | C10: body `{ csv }`; creates nothing |
| `POST /v3/admin/seeded-sites/imports/apply` | same | C10: refused with the full report if any row is bad |

**Part E, profile fields.**

| Route | Who | Gap |
|---|---|---|
| `GET /v3/admin/categories/:slug/profile-schema` | SUPER_ADMIN, ADMIN, OPERATIONS, SALES | C9 |
| `GET /v3/me/profile-schema`, `GET`, `PUT /v3/me/profile` | owner, team with the website area | the vendor equivalent; the PUT body is `{ values: {...} }` |
| `GET`, `PUT /v3/admin/seeded-sites/:id/profile` | SUPER_ADMIN, ADMIN, OPERATIONS, SALES | on behalf |
| `GET /v3/admin/profile-fields?packKey=` | SUPER_ADMIN, ADMIN, OPERATIONS | the field sets and the map |
| `PUT /v3/admin/profile-fields`, `PUT /v3/admin/profile-fields/map` | SUPER_ADMIN, ADMIN | edit a field or a map row; audited |
| `POST /v3/admin/seeded-sites` (existing) | unchanged roles | now takes an optional `profile` object, checked BEFORE anything is created |

## 3. Which route closes which front-end gap (for slice 5)

| Gap | Closed by | The shape the screen gets |
|---|---|---|
| Vendor 1 next steps | `GET /v3/me/app-shell` | `nextSteps: [{ id, text, route }]`, `null` where the shell section is not given |
| Vendor 2 group | `GET /v3/me/navigation` | `tabs[].group`; the old value is still in `tabs[].scope` |
| Vendor 3 pack records | the Part A routes | NOT the assumed shape: `POST { data, status? }`, rows `{ id, title, status, data, archived, ... }`; use `ownerKey` and `key` from the navigation tab in the URL |
| Vendor 4 theme fee | `GET /v3/me/site/theme/fee` | `pricePaise` is `null` while PENDING |
| Vendor 5 domain log | `GET /v3/me/domains/:id/log` | as above |
| Vendor 6 move a site | `/v3/me/migration-requests` | `{ id, siteUrl, status: RECEIVED, createdAt }` |
| Vendor 7 promotion and social | the draft routes | drafts only, nothing is posted |
| Vendor 8 handled | `PUT /v3/me/inbox/:id/state` | `HANDLED` |
| Vendor 9 team | `/v3/me/team` | readable by a team member |
| Vendor 10 invoice | `GET /v3/me/billing/invoices/:id/download` | the response IS the file (HTML), not `{ publicUrl }`; fetch it with the token and save the blob |
| Vendor 11 staff roles | already in place | `AdminRole` includes SUPPORT and ADMIN |
| Admin C1 | `GET /v3/admin/permission-matrix` | |
| Admin C3 | `GET /v3/admin/vendors` | `{ items, total, page, pageSize }` |
| Admin C4 | `GET /v3/admin/vendors/:id/held-count` | |
| Admin C5 | `/v3/admin/vendors/:id/notes` | `{ id, body, byStaffId, byName, createdAt }` |
| Admin C6 | `mark-paid` | `reason` is still required |
| Admin C7 | `GET /v3/admin/invoices` | |
| Admin C8 | `GET /v3/admin/vendors/:id/subdomain-log` | the domain log's row shape |
| Admin C9 | `POST /v3/admin/seeded-sites` with `profile`, and the schema route | keyed by the schema's field keys: `state`, `pincode`, `services` (list of `{ name, description? }`), `opening_hours`, `social_*`, plus the industry fields; not `packKey`, `hours` or `social: []` |
| Admin C10 | the import routes | the template lists the columns; `state`, `pincode` and `services` are read |
| Admin C11 | the upload routes | |
| Admin C12 | `POST /v3/admin/seeded-sites/:id/go-live` | `{ alreadyLive, ...the listing }` |
| Admin C13 | nothing to do | already valid |

## 4. Role matrix (as data)

New entries in `ADMIN_ROLE_MATRIX` (OPS_AND_SUPER means SUPER_ADMIN and OPERATIONS; ADMIN inherits OPERATIONS; SUPPORT is refused unless listed): permission matrix, ALL staff and SUPPORT (added to `STAFF_ROLE_EXTENSIONS.SUPPORT.allow`); vendors list, held count, notes, invoices list, subdomain log, go-live, profile-fields read: OPS_AND_SUPER; upload, import, schema and on-behalf profile routes: ALL staff (SALES included, SUPPORT refused); `PUT /v3/admin/profile-fields` and `.../map`: SUPER_ADMIN, and ADMIN through `STAFF_ROLE_EXTENSIONS.ADMIN.allow`. Pinned by `test/admin-role-matrix.spec.ts` (oracle now 381 routes) and the new specs.

## 5. Error codes (all registered through `BUSINESS_ERROR_CODES`)

Part A `PACK_RECORD_INVALID`, `PACK_RECORD_NOT_FOUND`, `PACK_TAB_NO_RECORDS`, `PACK_TAB_OWNER_ONLY` (and `TAB_LOCKED`, existing). Part B `VENDOR_GAP_INVALID`, `MIGRATION_REQUEST_OPEN`, `PROMO_DRAFT_NOT_FOUND`, `TEAM_MEMBER_NOT_FOUND`, `TEAM_MEMBER_EXISTS`, `PLAN_INVOICE_NOT_FOUND`. Part C `ADMIN_GAP_INVALID`, `ADMIN_VENDOR_NOT_FOUND`, `OFFLINE_AMOUNT_MISMATCH`, `GO_LIVE_BLOCKED` (details.reason DO_NOT_CONTACT or TERMS_REQUIRED). Part D `UPLOAD_NOT_CONFIGURED`, `UPLOAD_EMPTY`, `UPLOAD_TOO_LARGE`, `UPLOAD_TYPE_NOT_ALLOWED`, `UPLOAD_TYPE_MISMATCH`, `UPLOAD_UNSAFE`, `UPLOAD_INVALID`, `UPLOAD_ALT_INVALID`, `UPLOAD_NOT_FOUND`, `UPLOAD_LISTING_NOT_FOUND`, `IMPORT_INVALID`, `IMPORT_BLOCKED` (details.report holds every row). Part E `PROFILE_INVALID`, `PROFILE_CATEGORY_UNKNOWN`, `PROFILE_NO_CATEGORY`, `PROFILE_GATED`, `PROFILE_LISTING_NOT_FOUND`, `PROFILE_FIELD_INVALID`. Per-field problems travel in the error's `data.fields` (the filter passes `details` through; it drops other extra keys).

## 6. Settings, flags and environment

New plan settings (all null = OFF until staff set them, validated like the other storage settings, `PUT /v3/admin/plan-settings/:key`): `mediaUploadMaxBytes`, `mediaUploadMaxPixels`, `mediaUploadAllowedTypes` (a list from `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`, `application/pdf`). With them unset every upload answers 503 `UPLOAD_NOT_CONFIGURED`. Real storage stays behind the existing public storage settings and R2 keys (see `V3_STORAGE.md`); `MEDIA_STORAGE_MODE=fake` binds the in-memory store for staging tests. The counsel switch `packGatedPacksOpen` (existing, OFF) also hides the health, legal and finance profile fields. No new environment variable.

## 7. How each part works

**A. Pack records.** The field list is platform data; a record is checked against it on every write (unknown field, wrong type, oversize value, markup, a status outside OPEN, IN_PROGRESS, DONE, CANCELLED). Money is a whole number of paise, never negative, and the schema says "Before GST"; nothing grosses it up. `searchText` joins the searchable fields, lower case, so a search is one indexed column. A `status`-typed field is lifted into the row status. The guard answers per tab with the engine's new `accessOf(vendor, ownerKey, tabKey)` (the old `access` finds the first tab with a key, which would answer `billing` with the COMMON tab). Loader: `node scripts/seed-v3-pack-tab-fields.js` (dry run by default, idempotent, never overwrites an edit).

**B.** The five bar groups are data (`COMMON_TAB_GROUP`): Grow holds promotion, social, AI studio, website and domain; Money holds billing and accounting; More holds support, plan and migration; pack, capability and add-on tabs and CRM, TeleCRM and industry are Business. Next steps come from four real facts (no published site, details the last build says are missing, a plan order waiting for payment, a custom domain not yet connected); a team member only gets the steps of an area they hold. A deactivated team member gets status `deactivated`, which the JWT strategy already refuses.

**C.** `mark-paid` checks the details first; an amount that is not the order's amount is refused (the money that arrived is never more or less than the order); the four columns are written in the same transaction as the payment and the audit row. Go-live: serialised per business in process, idempotent, refused for a removed business, a phone on the register, and a claimed business whose owner has not accepted the current Terms (staff approve a site for an owner but never accept the Terms for them).

**D.** Order of checks: uploads switched on, something sent, within the byte cap, an allowed type BY ITS BYTES, the claimed type agrees, nothing active inside. A picture is decoded and re-encoded (location and camera data dropped, size read). SVG is refused if it carries a script, an event handler, a foreign object or an external reference (never "cleaned in place"); a PDF is refused if it has JavaScript, an auto-run action, a launch, an embedded file or a form post, or is cut short. The key is `vendors/<vendorId>/uploads/<sha256>.<ext>` or `drafts/<staffId>/<sha256>.<ext>`: the folder is a server-held id, the file is named by its content, the extension comes from the detected type; the file's own name is never used. The import: the template is `category, business name, phone, email, address, city, state, locality, pincode, services (semicolon separated)`, then the staff tick columns `source kind, source note, public facts only`, then one column per profile field of the category. Rows are judged exactly as a seeded batch judges them plus the category's profile fields; a dry run (the default) creates nothing; an apply runs the same judgement and is refused (409, full report) if even one row is bad; a row already listed is skipped, so applying the same file twice makes nothing twice; a row that fails while being made is reported failed and the rows before it stay (apply the same file again and they are skipped and it is retried). A made row is an unclaimed listing, the first of the four states, with its draft site built by the existing creation path.

**E.** 16 packs, each with the 21 common fields plus its own industry fields (the common set: business name, tagline, about, services with short descriptions, opening hours, address with locality and pincode, contact, social links, banner image and its description, gallery images), and a category field only where the catalog gave that category field hints (143 of 196 categories; the other 53 inherit). Seed (offline dry run): 1263 fields, 948 map rows, 0 problems. Values are checked (plain text only, no ranking claim by the same wording filter as the SEO text, no price: "prices are set in the price list, before GST"), kept as given in `g4d_vendor_profile_values`, and written into the site draft through the map: FIELD rows set one site field (the address is composed from its parts), LIST rows add items (all industry and category fields go to ONE `credentials` list, because a list write replaces the list; the gallery goes to `gallery`), NONE rows keep the value on the profile only. A site write the plan does not allow is reported in `site.skipped`, never silent, and does not undo the saved profile. Loader: `node scripts/seed-v3-profile-fields.js`.

## 8. Choices to check, what was skipped, known limits

Choices:
1. Table names use `g4d_` (the repo's prefix), not the brief's `v3_`.
2. COMMON tabs with their own contract have no generic record store (listed in Part A).
3. The record body is `{ data, status }`, and the URL uses the tab owner; both differ from what the vendor screens assumed (gap 3).
4. `group` on a navigation tab now means the five bar groups; the old value moved to `scope` (the two tests that pinned it were updated). The app shell has one more section, `nextSteps`.
5. The invoice download returns the HTML file itself, not `{ publicUrl }`: a public URL would need the storage port, which is off by default. Say if you want a stored copy with a link.
6. The theme fee is reported before GST; a price-book row flagged tax inclusive is still reported as its stored amount.
7. The v3 team routes write the same `g4d_team_members` table the team sign-in reads (one writer for the login), without calling the older team service (which uses the legacy seat limit). **No seat limit is enforced on the v3 invite**: the v3 plans have no seats feature. Reactivating a member who never signed in puts them back to `invited`, not `active`.
8. Promotion and social drafts need the team member to hold the campaigns area (the area the shell already maps both tabs to).
9. C6: `reason` stays required; a recorded amount that differs from the order is refused rather than stored.
10. C7 status words are PAID and REFUND_RECORDED (a SQL filter cannot compare paid and refunded amounts without raw SQL); the amounts ride on the row.
11. C12: "one transaction" is the existing publish transaction plus a per-business in-process queue; the audit row is written after it. Two server instances at once would rely on the publish's own uniqueness, which makes the second a no-op.
12. C3: the listing-state filter uses the stored lifecycle, which the staff seeded-site views write through when facts change, so a lifecycle that has not been viewed since a claim can lag. The row's own `listingState` is computed from the stored lifecycle and whether a site is published.
13. C13 needed no change.
14. Uploads: no virus scanner is bound, so a PDF is accepted only by the structural checks above. The vendor's `/v3/me/media` library is separate from the older website library `/v3/me/site/media` (still working); a staff upload for a listing lands in the vendor's new library. A draft upload (no listing) is not auto-attached when the listing is later made; the staff member passes the returned URL into the site content.
15. Import: the two staff tick columns stay required (the "only public facts" tick is a compliance gate, not a convenience); `pincode` is required; the duplicate rule is the seeded-site rule (same phone, email, or name in the same city), a superset of the key (phone or email, name, pincode); a business removed before is skipped, never made again; the file is limited by the existing `seededBatchMaxRows` setting; picture lists cannot be given in a file; no row is written to the seeded batch table (the activity log records the import).
16. Profile: the category fields from the catalog's hints are plain text fields (the catalog gives names only). Services, opening hours, locality, city, state and pincode are kept on the profile and are not drawn on the site yet (the site has no structured hours and its services come from Offerings): their map rows are NONE until you decide. Create-on-behalf takes a `profile` object instead of the screens' ad-hoc `hours`, `social[]` and `packKey`.
17. Vendor notes have no foreign key and are deleted after their vendors (the same pattern as the activity log), which the staging cleanup does.

Skipped (nothing invented): a staff route to edit a pack tab's record fields (the loader and the table are there; the SQL or the seed script edits them for now); a stored copy and link for the invoice; services written to the Offerings through profile import; attaching a draft upload to a listing automatically; anything that posts, schedules or sends (drafts and invites are records).

Pre-existing, not touched: `test/seo-int-guards.spec.ts` ("the read-only staging checker: the syntax is valid") fails in `npm.cmd run test:ci` on the starting commit too; it is the only failing unit test.

## 9. Open questions

1. Seat limits for the v3 team (needs a v3 plan feature).
2. Whether a pause stops, extends or ignores the paid term (from Part B of the pack engine, still open).
3. Whether the owner wants structured opening hours on the site, and services written to Offerings, so those map rows can stop being NONE.
4. Whether to merge the two vendor picture libraries into one.
5. A virus scanner for PDFs, and how long unattached draft uploads are kept.
6. Whether a SUPPORT person should read a business's held count and notes (today OPERATIONS and above only).

## 10. Owner commands for staging, in order

`npm.cmd`, from `C:\Get4Domain\get4domain-w2\backend-api` unless stated. **Nothing below has been run.**

1. `.env.staging` was copied into `C:\Get4Domain\get4domain-w2\` (not in git). Then `npm.cmd ci` is done; run `npx.cmd prisma generate` if the client is stale.
2. `npm.cmd run db:staging:migrate-status`. Expect the five folders `20261219100000_v3_pack_records`, `20261219110000_v3_wave2_vendor_gaps`, `20261219120000_v3_wave2_admin_gaps`, `20261219130000_v3_wave2_media` and `20261219140000_v3_wave2_profile_fields` pending (plus anything else this branch has that staging lacks). Then `npm.cmd run db:staging:migrate-deploy`, then `migrate-status` again (none pending).
3. `npm.cmd run db:staging:rls-off` (expect `0` tables without row level security), then `npm.cmd run db:staging:drift` (the 2 documented allowed items only; the new CHECKs and the notes trigger are not part of the schema diff).
4. `npm.cmd run build`, then `npm.cmd run test:ci`. Expect everything green except the one pre-existing failure named in section 8.
5. Seed scripts, each a **dry run** first (read the counts and the problems), then `--apply`, then the dry run again (nothing to create):
   - `node scripts/seed-v3-pack-tab-fields.js` (expect 96 tabs, 434 fields), then `node scripts/seed-v3-pack-tab-fields.js --apply`.
   - `node scripts/seed-v3-profile-fields.js` (expect 16 packs, 143 categories with fields of their own, 1263 fields, 948 map rows), then `node scripts/seed-v3-profile-fields.js --apply`.
6. Each integration file alone, the output saved: `npx.cmd jest --ci --runInBand test/pack-records.int.spec.ts --selectProjects int 2>&1 | Tee-Object -FilePath .\pack-records.int.log`, then the same for `test/vendor-gaps.int.spec.ts`, `test/admin-gaps.int.spec.ts`, `test/media-import.int.spec.ts` and `test/profile-fields.int.spec.ts`. Then the full `npm.cmd run test:int 2>&1 | Tee-Object -FilePath .\test-int.log`. They never apply a seed and never call real storage; platform rows they make carry `vtest-<run id>` and are removed in `afterAll`.
7. `npm.cmd run test:cleanup-staging -- --count` (must print 0). The cleanup script now also removes staff draft uploads, the vendor notes (after their vendors) and the tagged platform rows.
8. To use uploads on staging later: set `mediaUploadMaxBytes`, `mediaUploadMaxPixels` and `mediaUploadAllowedTypes` through `PUT /v3/admin/plan-settings/:key`, and the public storage settings and keys described in `V3_STORAGE.md`.
9. **Do not push without asking**: a push creates a Vercel Preview deploy. When ready: `git push origin v3-w2`.

## 11. Tests added

Unit: `pack-records-core`, `pack-records-http`, `wave2-vendor-gaps-core`, `wave2-vendor-gaps-http`, `wave2-vendor-gaps-services`, `wave2-admin-gaps`, `wave2-media-upload`, `wave2-profile-fields`, `wave2-listing-import`. Changed to follow the contract: `pack-part-b`, `pack-part-b-http` (the group and the shell section), `admin-role-matrix`, `tenant-model-registry`, the route baseline. Integration, written and NOT run: `pack-records.int.spec.ts`, `vendor-gaps.int.spec.ts`, `admin-gaps.int.spec.ts`, `media-import.int.spec.ts`, `profile-fields.int.spec.ts`.
