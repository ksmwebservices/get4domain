# Website Manager dispatch: progress (resume file)

Dispatch: `GET4DOMAIN_DISPATCH_V2_WEBSITE_MANAGER_14OCT2026.md`. Started 14 Oct 2026. To resume: read this file and the dispatch, continue from the first phase not marked DONE, same rules, push to origin at the end.

## Phases

| Phase | Status | Commit | Notes |
|---|---|---|---|
| 0 Trace and audit | DONE | see git log | `evidence/website-manager/AUDIT.md` (root causes RC1 to RC6), `REPRO.md`, read-only production audit |
| 1 Single source of truth | PARTIAL: backend done | next commit | VendorCMS stays the one source; draft/layout/versions columns + 3 tables (migration 20261014100000_website_manager); backfill + site_doc_v2 flag scripts; PUBLIC RENDERER (docV2 pack-driven, no stock fallbacks), readiness and standalone apps (allwin-tours, stepnrock) reading CMS NOT done |
| 2 Draft, preview, publish, refresh, versions | PARTIAL: backend done | next commit | /site-doc/me/* (draft, preview-link, publish, versions, restore), 45 assertions in scripts/website-manager/verify-site-doc-pg.js; frontend editor UI, Next cache tags + /api/revalidate-site route NOT done |
| 3 Uploads | not started | | |
| 4 Every plan gets the editor | not started | | |
| 5 Theme and layout engine | not started | | |
| 6 Category packs | not started | | |
| 7 Existing vendors and VM steps | not started | | |
| 8 Guards | not started | | |

## Root causes (short; full text in AUDIT.md)

RC1 Allwin (and in part Step N Rock, Deebi) are hand-written standalone apps that ignore `VendorCMS`. RC2 readiness and public page read different data only because of RC1. RC3 about half of the editor fields never reach the shared public page. RC4 stock content appears when a field is empty. RC5 saving is immediate, no draft, preview, publish or history. RC6 uploads fail silently, are unprocessed, and a PNG is not refused by our code (likely the proxy size limit, a VM check).

## Decisions taken without asking

1. The single source of truth stays `VendorCMS` (one row per vendor; it already is the store every reader uses: shared renderer, readiness, WhatsApp bot). Draft and layout choices are added to the same row; versions go in one new table. No second site-document table.
2. The production database was read with SELECT only inside a READ ONLY transaction (precedent: `STEPNROCK_TRACE.md`); only yes/no presence of fields was printed.
3. Allwin's real subdomain is `allwintours` (no hyphen).

## Resume here

Build order left: (a) frontend: Website Manager draft/preview/publish/versions UI, Theme+layout tab, `/api/revalidate-site` route and cached fetch with tag `site:<sub>`; (b) docV2 renderer (themes>=8, layout variants, no stock fallbacks, logo/socials/portfolio/email rendered); (c) Phase 3 shared upload service (sharp is NOT installed: needs adding), (d) Phase 4 registry minPlan LEADSPACE + provisioning of website_manager, (e) Phase 6 category packs + admin, (f) Phase 7 DEPLOYMENT section, (g) Phase 8 guards in bos:verify, registry test ids. Facebook reel (Lentlo Sites, Rs 500 website+app+CRM+WhatsApp API+domain, one-time) could only be read as a caption; the video itself is not viewable.
