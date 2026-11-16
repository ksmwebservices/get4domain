# V3 Wave 2 backend: pack records, vendor and admin gap routes, uploads, listing import, industry profile fields, add-on eligibility, firm identity

Branch `v3-w2` (worktree `C:\Get4Domain\get4domain-w2`, branched from `v3-seo1`). Source of the work: `WAVE2_BACKEND_PROMPT.md`, the front-end gap files `FRONTEND_GAPS.md`, `API_CONTRACT_SLICE2.md` and `API_CONTRACT_ADMIN.md`, and Amendments 10 to 14.

**Status.** Built, unit-tested, committed. **Nothing is applied, nothing was run on staging, nothing is pushed.** The nine migrations are written and verified (`verify:migrations`, `verify:raw-sql`) and are NOT applied. The five integration files are written and type-checked and were NOT run. Section 9 lists the owner commands in order. Part H (H1 to H3) is described in sections 1, 2 and 7, with its choices in section 8.

Product text rules held everywhere: no timeframes, "enquiries" not "leads", never the words workspace, BOS or LeadSpace, prices exclude GST, a PENDING price is never a number. No real provider is called: storage is the existing R2 adapter, selected only by environment and settings and OFF by default; tests use the in-memory store.

## 1. Commits and migrations

| Part | Commit | Migration (NOT applied) |
|---|---|---|
| A pack records | `9619eca` | `20261219100000_v3_pack_records` |
| B vendor gap routes (+ C8) | `2be6a3b` | `20261219110000_v3_wave2_vendor_gaps` |
| C admin gap routes | `d321791` | `20261219120000_v3_wave2_admin_gaps` |
| D media and import, E profile fields (one commit: they share the schema, the error list, the role matrix and the module wiring) | `bc525f4` | `20261219130000_v3_wave2_media`, `20261219140000_v3_wave2_profile_fields` |
| F tests and this document | `e3c9dea` | none |
| G1 the profile feeds the site (services, hours, location) | `3bcf816` | `20261219150000_v3_wave2_site_mapping` (two CHECKs widened; no table, no column) |
| G2 draft uploads follow the listing by an upload group token | `fdf437b` | `20261219160000_v3_wave2_upload_groups` (one nullable column, one index, one check) |
| G3 staff edit the record fields of a pack tab | `28dfdee` | none |
| H1 the staging checker test uses `node --check` | `5bf801e` | none |
| H2 add-on eligibility as data | `e718abd`, follow-up `426a963` | `20261219170000_v3_wave2_addon_eligibility` (one table, a CHECK, the seed rows) |
| H3 firm identity as data | `0a33bc8` | `20261219180000_v3_wave2_firm_profile` (one table, one row, CHECKs) |

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
| `g4d_addon_eligibility` | `V3AddonEligibility` | which add-on pack a pack may buy, one row per pair, `active=false` turns it off and keeps the row; the owner rules are also a CHECK | platform, staff editable |
| `g4d_firm_profile` | `V3FirmProfile` | the platform company: legal name, registered address, GSTIN, PAN, registered email and phone; ONE row (`id = platform`, a CHECK) | platform, SUPER_ADMIN edits |

## 2. Routes (61 new)

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

**Part G (the profile reaches the site, uploads follow the listing, staff edit tab fields).**

| Route | Who | Notes |
|---|---|---|
| `POST /v3/admin/seeded-sites/:id/media/attach` | SUPER_ADMIN, ADMIN, OPERATIONS, SALES | body `{ group }`: attaches the draft uploads I made under that upload group to the listing; idempotent |
| `GET /v3/admin/pack-engine/tab-fields?ownerKey=&tabKey=` | SUPER_ADMIN, ADMIN, OPERATIONS | every record field of one tab, hidden ones too, with the types on offer |
| `PUT /v3/admin/pack-engine/tab-fields` | SUPER_ADMIN, ADMIN | add or change one record field; audited; nothing deleted |
| `POST /v3/admin/media/drafts` (existing) | same as before | now also takes an optional multipart field `group` (the upload group token) |
| `POST /v3/admin/seeded-sites` (existing) | same as before | now also takes `uploadGroup`; the answer then carries `uploads: { attached, skipped, alreadyAttached }` |

**Part H, eligibility and firm identity.**

| Route | Who | Notes |
|---|---|---|
| `GET /v3/admin/pack-engine/addon-eligibility` | SUPER_ADMIN, ADMIN, OPERATIONS | `{ rows: [{ addonKey, packKey, active }], addons, packs, fixedRules }` |
| `PUT /v3/admin/pack-engine/addon-eligibility` | SUPER_ADMIN, ADMIN | body `{ addonKey, packKey, active }`; audited with before and after; a pair that breaks an owner rule or names something unknown is 400 `ADDON_ELIGIBILITY_INVALID` (`details.problems`) |
| `GET /v3/me/packs` (existing) | owner | `addonPacks` now lists ONLY the add-ons the business's pack may buy; each is still `priceStatus: PENDING`, `price: null`, `priceNote: "Price not set"` |
| `POST /v3/me/packs/:key/purchase` (existing) | owner | an add-on the pack may not buy is 409 `ADDON_NOT_ELIGIBLE`; an eligible one is still 409 `ADDON_PRICE_PENDING`; the registration offer is filtered the same way |
| `GET /v3/public/firm` | everyone, no sign-in | `{ legalName, registeredAddress }` and `gstin` only when one is set; never the PAN, email or phone; `Cache-Control: public, max-age=300` |
| `GET /v3/admin/firm-profile` | SUPER_ADMIN only | the whole profile |
| `PUT /v3/admin/firm-profile` | SUPER_ADMIN only | any of `legalName`, `registeredAddress`, `gstin`, `pan`, `registeredEmail`, `registeredPhone` (null or empty clears the optional four); audited; 400 `FIRM_PROFILE_INVALID` with `details.fields` |

**Part P, public site gaps (from PUBLIC_GAPS.md).**

| Route | Who | Gap and notes |
|---|---|---|
| `POST /v3/claim/start` | everyone, throttled like the code request (3 a minute per address) | G1: body `{ businessSlug, channel? }` (EMAIL by default, or SMS). Finds the listing, issues the claim link, sends the code to the owner address ON THE RECORD (never one the caller types) through the mail port and answers `{ token, channel, message }`; the token then drives `GET /v3/claim/:token/status`, `POST .../otp/request` and `POST .../otp/verify`. Anything that cannot be claimed (unknown, malformed, draft, suspended, removed, already claimed, no business record) is the SAME 409 `DIRECTORY_STATE_INVALID`. |
| `POST /v3/claim/:token/otp/request` (existing) | everyone | G12: with `channel: EMAIL` and the mail switch OFF it now answers 503 `MAIL_DISABLED`, the same for every token (decided before the token is looked at). The SMS channel is unchanged. |

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
| Admin C9 | `POST /v3/admin/seeded-sites` with `profile`, and the schema route | what staff enter now appears on the draft site (services in the Offerings, hours as rows, address parts in the location; section 7 G); keyed by the schema's field keys: `state`, `pincode`, `services` (list of `{ name, description? }`), `opening_hours`, `social_*`, plus the industry fields; not `packKey`, `hours` or `social: []` |
| Admin C10 | the import routes | the template lists the columns; `state`, `pincode` and `services` are read |
| Admin C11 | the upload routes, and `uploadGroup` on `POST /v3/admin/seeded-sites` or `POST .../media/attach` | draft uploads made before the listing existed are attached to it when it is made |
| Admin C12 | `POST /v3/admin/seeded-sites/:id/go-live` | `{ alreadyLive, ...the listing }` |
| Admin C13 | nothing to do | already valid |

## 4. Role matrix (as data)

New entries in `ADMIN_ROLE_MATRIX` (OPS_AND_SUPER means SUPER_ADMIN and OPERATIONS; ADMIN inherits OPERATIONS; SUPPORT is refused unless listed): permission matrix, ALL staff and SUPPORT (added to `STAFF_ROLE_EXTENSIONS.SUPPORT.allow`); vendors list, held count, notes, invoices list, subdomain log, go-live, profile-fields read: OPS_AND_SUPER; upload, import, schema and on-behalf profile routes: ALL staff (SALES included, SUPPORT refused); `PUT /v3/admin/profile-fields` and `.../map`: SUPER_ADMIN, and ADMIN through `STAFF_ROLE_EXTENSIONS.ADMIN.allow`. Pinned by `test/admin-role-matrix.spec.ts` (oracle now 381 routes) and the new specs. Part G adds the attach route (every staff role that creates on behalf, SUPPORT refused) and the tab-fields routes (read: SUPER_ADMIN, ADMIN, OPERATIONS; edit: SUPER_ADMIN, and ADMIN through the extension). The oracle is now 384 routes. Part H: `GET /v3/admin/pack-engine/addon-eligibility` is OPS_AND_SUPER and `PUT` is SUPER_ONLY with ADMIN added through `STAFF_ROLE_EXTENSIONS.ADMIN.allow` (so ADMIN and SUPER_ADMIN edit; OPERATIONS reads; SALES and SUPPORT are refused); both `/v3/admin/firm-profile` routes are SUPER_ONLY and ADMIN is NOT added (the profile holds the PAN, email and phone).

## 5. Error codes (all registered through `BUSINESS_ERROR_CODES`)

Part A `PACK_RECORD_INVALID`, `PACK_RECORD_NOT_FOUND`, `PACK_TAB_NO_RECORDS`, `PACK_TAB_OWNER_ONLY` (and `TAB_LOCKED`, existing). Part B `VENDOR_GAP_INVALID`, `MIGRATION_REQUEST_OPEN`, `PROMO_DRAFT_NOT_FOUND`, `TEAM_MEMBER_NOT_FOUND`, `TEAM_MEMBER_EXISTS`, `PLAN_INVOICE_NOT_FOUND`. Part C `ADMIN_GAP_INVALID`, `ADMIN_VENDOR_NOT_FOUND`, `OFFLINE_AMOUNT_MISMATCH`, `GO_LIVE_BLOCKED` (details.reason DO_NOT_CONTACT or TERMS_REQUIRED). Part D `UPLOAD_NOT_CONFIGURED`, `UPLOAD_EMPTY`, `UPLOAD_TOO_LARGE`, `UPLOAD_TYPE_NOT_ALLOWED`, `UPLOAD_TYPE_MISMATCH`, `UPLOAD_UNSAFE`, `UPLOAD_INVALID`, `UPLOAD_ALT_INVALID`, `UPLOAD_NOT_FOUND`, `UPLOAD_LISTING_NOT_FOUND`, `IMPORT_INVALID`, `IMPORT_BLOCKED` (details.report holds every row). Part E `PROFILE_INVALID`, `PROFILE_CATEGORY_UNKNOWN`, `PROFILE_NO_CATEGORY`, `PROFILE_GATED`, `PROFILE_LISTING_NOT_FOUND`, `PROFILE_FIELD_INVALID`. Per-field problems travel in the error's `data.fields` (the filter passes `details` through; it drops other extra keys). Part G `PACK_FIELD_INVALID` (per-field problems in `data.fields`), `PACK_FIELD_IN_USE`, `PACK_TAB_UNKNOWN`. Part H `ADDON_NOT_ELIGIBLE` (409), `ADDON_ELIGIBILITY_INVALID` (400, `details.problems`), `FIRM_PROFILE_INVALID` (400, `details.fields`). Part P `MAIL_DISABLED` (503, G12).

## 6. Settings, flags and environment

New plan settings (all null = OFF until staff set them, validated like the other storage settings, `PUT /v3/admin/plan-settings/:key`): `mediaUploadMaxBytes`, `mediaUploadMaxPixels`, `mediaUploadAllowedTypes` (a list from `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`, `application/pdf`). With them unset every upload answers 503 `UPLOAD_NOT_CONFIGURED`. Real storage stays behind the existing public storage settings and R2 keys (see `V3_STORAGE.md`); `MEDIA_STORAGE_MODE=fake` binds the in-memory store for staging tests. The counsel switch `packGatedPacksOpen` (existing, OFF) also hides the health, legal and finance profile fields. No new environment variable.

## 7. How each part works

**A. Pack records.** The field list is platform data; a record is checked against it on every write (unknown field, wrong type, oversize value, markup, a status outside OPEN, IN_PROGRESS, DONE, CANCELLED). Money is a whole number of paise, never negative, and the schema says "Before GST"; nothing grosses it up. `searchText` joins the searchable fields, lower case, so a search is one indexed column. A `status`-typed field is lifted into the row status. The guard answers per tab with the engine's new `accessOf(vendor, ownerKey, tabKey)` (the old `access` finds the first tab with a key, which would answer `billing` with the COMMON tab). Loader: `node scripts/seed-v3-pack-tab-fields.js` (dry run by default, idempotent, never overwrites an edit).

**B.** The five bar groups are data (`COMMON_TAB_GROUP`): Grow holds promotion, social, AI studio, website and domain; Money holds billing and accounting; More holds support, plan and migration; pack, capability and add-on tabs and CRM, TeleCRM and industry are Business. Next steps come from four real facts (no published site, details the last build says are missing, a plan order waiting for payment, a custom domain not yet connected); a team member only gets the steps of an area they hold. A deactivated team member gets status `deactivated`, which the JWT strategy already refuses.

**C.** `mark-paid` checks the details first; an amount that is not the order's amount is refused (the money that arrived is never more or less than the order); the four columns are written in the same transaction as the payment and the audit row. Go-live: serialised per business in process, idempotent, refused for a removed business, a phone on the register, and a claimed business whose owner has not accepted the current Terms (staff approve a site for an owner but never accept the Terms for them).

**D.** Order of checks: uploads switched on, something sent, within the byte cap, an allowed type BY ITS BYTES, the claimed type agrees, nothing active inside. A picture is decoded and re-encoded (location and camera data dropped, size read). SVG is refused if it carries a script, an event handler, a foreign object or an external reference (never "cleaned in place"); a PDF is refused if it has JavaScript, an auto-run action, a launch, an embedded file or a form post, or is cut short. The key is `vendors/<vendorId>/uploads/<sha256>.<ext>` or `drafts/<staffId>/<sha256>.<ext>`: the folder is a server-held id, the file is named by its content, the extension comes from the detected type; the file's own name is never used. The import: the template is `category, business name, phone, email, address, city, state, locality, pincode, services (semicolon separated)`, then the staff tick columns `source kind, source note, public facts only`, then one column per profile field of the category. Rows are judged exactly as a seeded batch judges them plus the category's profile fields; a dry run (the default) creates nothing; an apply runs the same judgement and is refused (409, full report) if even one row is bad; a row already listed is skipped, so applying the same file twice makes nothing twice; a row that fails while being made is reported failed and the rows before it stay (apply the same file again and they are skipped and it is retried). A made row is an unclaimed listing, the first of the four states, with its draft site built by the existing creation path.

**E.** 16 packs, each with the 21 common fields plus its own industry fields (the common set: business name, tagline, about, services with short descriptions, opening hours, address with locality and pincode, contact, social links, banner image and its description, gallery images), and a category field only where the catalog gave that category field hints (143 of 196 categories; the other 53 inherit). Seed (offline dry run): 1263 fields, 948 map rows, 0 problems. Values are checked (plain text only, no ranking claim by the same wording filter as the SEO text, no price: "prices are set in the price list, before GST"), kept as given in `g4d_vendor_profile_values`, and written into the site draft through the map: FIELD rows set one site field (the address is composed from its parts), LIST rows add items (all industry and category fields go to ONE `credentials` list, because a list write replaces the list; the gallery goes to `gallery`), NONE rows keep the value on the profile only. A site write the plan does not allow is reported in `site.skipped`, never silent, and does not undo the saved profile. Loader: `node scripts/seed-v3-profile-fields.js`.

**G. The profile reaches the site; uploads follow the listing; staff edit tab fields.** (1) The map kinds are now FIELD, LIST, LOCATION, HOURS, OFFERINGS and NONE, and only `business_name` is NONE. *Services* go to the business's Offerings (the catalogue the site already reads): each service becomes an active item with its short description and NO price; the port is tenant scoped, idempotent (the same list again changes nothing), retires but never deletes a service no longer named, and never touches a service the vendor made themselves. *Opening hours* are a profile type `hours` (the compact text `Mon-Sat 09:00-18:00; Sun closed`, or day rows) kept in a new optional `hours` list of the managed site document, because the theme renderer already draws day rows but nothing stored them (the older one-line `businessHours` is kept in step for the search file and the chat bot); no table or column was needed. *Address line, locality, city, state and pincode* go into the document's location, merged over what the owner already has (a map link, coordinates), and the location projects into `g4d_site_locations` when a version goes live; the pincode must be six digits. Every value is checked by the same text filters as before, and no text may carry a `tel:`, `mailto:` or `wa.me` link or a price, so a Free site stays informational. A site write the plan does not allow is reported in `site.skipped`, never silent. (2) A draft upload takes an optional `group` token; creating the listing with the same `uploadGroup` (or `POST /v3/admin/seeded-sites/:id/media/attach`) moves ONLY the calling staff member's drafts of that group into the business's library, once; the stored object keeps its key; a file the business already has is dropped as a duplicate; every move is audited; a token never moves a file already attached to another listing. (3) Staff edit the record fields of a tab: only a real record tab; a type cannot change once any business has records on the tab (hide the field and add a new one); one status field and at most forty fields a tab; `active: false` hides, nothing is deleted.

**H. Eligibility, firm identity.** (H2) The table says which add-on pack each PACK (not each category) may buy. It is seeded by the migration (a row is inserted only when its add-on pack and its pack exist) and by the pack loader (`loadPackEngine` creates the missing rows and never touches one staff edited). The owner rules are written once in `core/addon-eligibility-core.ts` and used three ways: the edit route refuses a pair that breaks one, the check that decides what a business sees ignores such a row even if it was written behind the service, and the migration repeats them as a CHECK. Everything else is data: the second HOME_SAMPLE_COLLECTION case the owner called "direct" is one `PUT` with the pack key. A business with no pack sees and can buy nothing. The 15 second reference cache is dropped after every edit. (H3) One row holds the company. The GSTIN is checked for the 15 character layout (2 digit state code, the 10 character PAN, an entity number, `Z`, a check character) and a known state code (01 to 38, 97, 99); the PAN for its layout and, when both are set, for being the PAN inside the GSTIN. The check digit of the GSTIN is NOT computed. Readers: the commercial and legacy invoice template and the payments invoice (through the two `resolveCompany` methods), the proposal (`QuotesService.proposalCompany`), the plan invoice and the wallet tax invoice (through `BillingSettingsService.get`, which now overlays the seller name, address and GSTIN from the profile), and the public legal text (`TermsService.latest` fills `{{firm.name}}`, `{{firm.address}}`, `{{firm.gstin}}`, `{{firm.pan}}`, `{{firm.email}}`, `{{firm.phone}}`; a line whose value is not set is dropped whole). With no GSTIN an invoice has no GSTIN line, with no PAN no PAN, with no phone or email no contact line; nothing prints "pending". The `COMPANY_*` environment fallbacks and the typed name and address are gone from the templates; the logo still comes from Admin, Integrations. A missing row (the migration not run) answers the defaults, so a document is never blank.

**P. Public site gaps.** (G1, G12) `ClaimStartService` checks the mail switch first (only for the EMAIL channel), looks the listing up by slug, issues the claim link through `ClaimsService.issueForPublicStart` (actor SYSTEM with the caller address; audit action `claim.public_start`, no token in it) and asks the existing claim OTP for the code. The switch is `MAIL_ENABLED` (a provider of the global `V3MailModule`, reading `EMAIL_LIVE_SEND`, default OFF); a build or test without the provider has no check. A placeholder owner address (`@sites.get4domain.invalid`) gets nothing sent and the answer is still the same, so a screen cannot learn whether an address exists; such a business is claimed by SMS or by a staff link.

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
14. Uploads: no virus scanner is bound, so a PDF is accepted only by the structural checks above. The vendor's `/v3/me/media` library is separate from the older website library `/v3/me/site/media` (still working); a staff upload for a listing lands in the vendor's new library. A draft upload is attached to its listing by an upload group token (Part G).
15. Import: the two staff tick columns stay required (the "only public facts" tick is a compliance gate, not a convenience); `pincode` is required; the duplicate rule is the seeded-site rule (same phone, email, or name in the same city), a superset of the key (phone or email, name, pincode); a business removed before is skipped, never made again; the file is limited by the existing `seededBatchMaxRows` setting; picture lists cannot be given in a file; no row is written to the seeded batch table (the activity log records the import).
16. Profile: the category fields from the catalog's hints are plain text fields (the catalog gives names only). Part G maps services, opening hours and the address parts into the site, so the map rows that were NONE are now OFFERINGS, HOURS and LOCATION; a service written from a profile is an Offerings item with no price, and a profile that stops naming a service retires it (it is hidden, not deleted). Create-on-behalf takes a `profile` object instead of the screens' ad-hoc `hours`, `social[]` and `packKey`. Opening hours are drawn as day rows, not free text.
17. Vendor notes have no foreign key and are deleted after their vendors (the same pattern as the activity log), which the staging cleanup does.
18. **H2, the packs that sell goods (please confirm).** Derived from `PACK_SUMMARY_V1.csv` and the engine flags (a pack whose sheet lists products, a catalogue, a menu, parts or product sales, or whose flags say it holds stock): **RETAIL, FOOD_SERVICE, MEMBERSHIP_WELLNESS, VEHICLE_SERVICE, B2B_DEALER**. They get SHOP and ONLINE_ORDERING_DELIVERY. PHARMACY sells goods too and is excluded by the owner rule. Left out on purpose: CLINIC and LAB (they dispense or test, they do not sell goods), FIELD_SERVICE (it sells work, though a plumber may sell fittings), AGENCY_CONSULTING, EDUCATION, PRACTICE_LEGAL_FINANCE, PROPERTY, LOGISTICS, HOSPITALITY_EVENTS, RENTAL_FLEET. Adding one later is one `PUT`.
19. **H2, what this changes from before.** The old rule offered SHOP to every category below the Ecommerce tier (a plumber saw it) and PHARMACY_COUNTER to the 11 clinic categories with a bundle discount. Under the new rules neither remains: a plumber sees no add-on, a clinic sees none, only a lab sees HOME_SAMPLE_COLLECTION and only the pharmacy pack sees PHARMACY_COUNTER. The per-category `addonPacks` list in the category map is still stored but no longer decides anything. Two things to look at: RETAIL and B2B_DEALER categories already include the online shop, so SHOP is redundant for them; ONLINE_ORDERING_DELIVERY is described as food ordering but is given to the same goods list as SHOP because the owner named both together.
20. **H2, an add-on a business already holds.** If staff later switch a pairing off, an add-on that business already has is no longer listed (the list shows eligible add-ons only) but its records and tabs are untouched. SUPER_ADMIN's per-business switch (`PUT .../vendors/:vendorId/addons/:addonKey`) does not check eligibility; say if it should.
21. **H3, the old `company` settings.** Admin, Integrations still shows the Company details group (name, GSTIN, PAN, address, phone, email), but nothing reads those values except the logo. The firm profile is the one source. The three stored seller keys of the billing settings (`invoiceSellerName`, `invoiceSellerAddress`, `invoiceSellerGstin`) are no longer read when the profile is present. Invoices already issued keep the seller they were issued with (the plan and wallet invoices store a snapshot); the older commercial and legacy invoices are drawn live, so they show the profile as it is when they are opened.
22. **H3, wording.** The legacy invoice heading still says TAX INVOICE even with no GSTIN; the accountant should decide whether it should say INVOICE until a GSTIN is set. The profile holds no bank, CIN or state of registration beyond the GSTIN's state code; say if any is wanted. The public route shows no email or phone because the owner asked for the name, the address and the GSTIN only.
23. **H2 and H3 tables carry row level security with no policy**, like every platform table, and the migrations are written so they cannot fail on a database that has no packs yet.
24. **G1, one active link.** Starting a claim issues a new claim link and the store keeps one active link per business, so a visitor starting a claim replaces a link staff had issued for handover (the owner can start again from the listing, and the code only ever goes to the record). The per-address and per-phone hourly limits of the code request still apply, and the route is throttled.
25. **G1, uniform answers.** The 409 is the same for every listing that cannot be claimed, but a claimable listing answers a token, so a visitor can tell that a listing is claimable. That fact is already public (an unclaimed listing says so). SMS can be asked for instead of email, which works with the mail switch OFF.
26. **G12, where the switch is read.** `MAIL_DISABLED` is answered from the environment switch only, never from the state of a listing or an account, so it cannot be used to find anything out. It is a new code beside `EMAIL_NOT_LIVE` (which the mail port still throws for a send that is refused later).

Skipped (nothing invented): a stored copy and link for the invoice (said not to build it); a virus scanner for PDFs; anything that posts, schedules or sends (drafts and invites are records).

Previously failing, now fixed (H1): `test/seo-int-guards.spec.ts` ("the syntax is valid") now checks the staging script with `node --check` through `child_process`, and `npm.cmd run test:ci` is fully green (245 suites).

## 9. Open questions

1. Seat limits for the v3 team (needs a v3 plan feature).
2. Whether a pause stops, extends or ignores the paid term (from Part B of the pack engine, still open).
3. Whether to merge the two vendor picture libraries into one.
4. A virus scanner for PDFs, and how long unattached draft uploads are kept.
5. Whether a SUPPORT person should read a business's held count and notes (today OPERATIONS and above only).
6. The second HOME_SAMPLE_COLLECTION case the owner called "direct" (not defined; one row once it is).
7. The GSTIN, PAN, registered email and phone (empty until the owner supplies them).
8. Whether SHOP stays on the goods list for RETAIL and B2B_DEALER, whose shop is already included.

## 10. Owner commands for staging, in order

`npm.cmd`, from `C:\Get4Domain\get4domain-w2\backend-api` unless stated. **Nothing below has been run.**

1. `.env.staging` was copied into `C:\Get4Domain\get4domain-w2\` (not in git). Then `npm.cmd ci` is done; run `npx.cmd prisma generate` if the client is stale.
2. `npm.cmd run db:staging:migrate-status`. Expect the nine folders `20261219100000_v3_pack_records`, `20261219110000_v3_wave2_vendor_gaps`, `20261219120000_v3_wave2_admin_gaps`, `20261219130000_v3_wave2_media`, `20261219140000_v3_wave2_profile_fields`, `20261219150000_v3_wave2_site_mapping` `20261219160000_v3_wave2_upload_groups`, `20261219170000_v3_wave2_addon_eligibility` and `20261219180000_v3_wave2_firm_profile` pending (plus anything else this branch has that staging lacks). Then `npm.cmd run db:staging:migrate-deploy`, then `migrate-status` again (none pending).
3. `npm.cmd run db:staging:rls-off` (expect `0` tables without row level security), then `npm.cmd run db:staging:drift` (the 2 documented allowed items only; the new CHECKs and the notes trigger are not part of the schema diff).
4. `npm.cmd run build`, then `npm.cmd run test:ci`. Expect everything green (245 suites).
5. Seed scripts, each a **dry run** first (read the counts and the problems), then `--apply`, then the dry run again (nothing to create):
   - `node scripts/seed-v3-pack-tab-fields.js` (expect 96 tabs, 434 fields), then `node scripts/seed-v3-pack-tab-fields.js --apply`.
   - `node scripts/seed-v3-profile-fields.js` (expect 16 packs, 143 categories with fields of their own, 1263 fields, 948 map rows), then `node scripts/seed-v3-profile-fields.js --apply`.
6. Each integration file alone, the output saved: `npx.cmd jest --ci --runInBand test/pack-records.int.spec.ts --selectProjects int 2>&1 | Tee-Object -FilePath .\pack-records.int.log`, then the same for `test/vendor-gaps.int.spec.ts`, `test/admin-gaps.int.spec.ts`, `test/media-import.int.spec.ts` and `test/profile-fields.int.spec.ts`. Then the full `npm.cmd run test:int 2>&1 | Tee-Object -FilePath .\test-int.log`. They never apply a seed and never call real storage; platform rows they make carry `vtest-<run id>` and are removed in `afterAll`. Then, for Part H: `npx.cmd jest --ci --runInBand test/wave2-h.int.spec.ts --selectProjects int 2>&1 | Tee-Object -FilePath .\wave2-h.int.log` (it puts back the firm row and every eligibility pairing it touched).
   - Part H: after the migrations, `node scripts/seed-v3-pack-engine.js` (a dry run first) then `--apply` creates any eligibility pair the migration could not (when the packs were loaded after it); it never changes a row staff edited. Then read `GET /v3/admin/pack-engine/addon-eligibility` as SUPER_ADMIN: expect 12 rows (10 goods pairs, PHARMACY_COUNTER for PHARMACY, HOME_SAMPLE_COLLECTION for LAB).
   - Firm identity: nothing to seed (the migration inserts the one row with the name and the address). When the owner has them, `PUT /v3/admin/firm-profile` as SUPER_ADMIN with the GSTIN, PAN, email and phone; until then no document shows a GSTIN.
7. `npm.cmd run test:cleanup-staging -- --count` (must print 0). The cleanup script now also removes staff draft uploads, the vendor notes (after their vendors) and the tagged platform rows.
8. To use uploads on staging later: set `mediaUploadMaxBytes`, `mediaUploadMaxPixels` and `mediaUploadAllowedTypes` through `PUT /v3/admin/plan-settings/:key`, and the public storage settings and keys described in `V3_STORAGE.md`.
9. **Do not push without asking**: a push creates a Vercel Preview deploy. When ready: `git push origin v3-w2`.

## 11. Tests added

Unit: `pack-records-core`, `pack-records-http`, `wave2-vendor-gaps-core`, `wave2-vendor-gaps-http`, `wave2-vendor-gaps-services`, `wave2-admin-gaps`, `wave2-media-upload`, `wave2-profile-fields`, `wave2-listing-import`, and for Part G `wave2-site-mapping`, `wave2-upload-groups` and `wave2-pack-tab-fields`. Changed to follow the contract: `pack-part-b`, `pack-part-b-http` (the group and the shell section), `admin-role-matrix`, `tenant-model-registry`, the route baseline. Integration, written and NOT run: `pack-records.int.spec.ts`, `vendor-gaps.int.spec.ts`, `admin-gaps.int.spec.ts`, `media-import.int.spec.ts`, `profile-fields.int.spec.ts`. Part H: `wave2-addon-eligibility` and `wave2-firm-profile`, and `wave2-h.int` (staging, written, not run). Changed for H2: `pack-part-b`, `pack-part-b-http`, `pack-engine-service` (the offer follows the pack, not the category), `pack-wire` (a fourth pure core, the two new routes). Public site gaps: `wave2-claim-start` (G1 and G12).
