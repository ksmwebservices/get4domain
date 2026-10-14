# Website Manager dispatch: progress (resume file)

Dispatch: `GET4DOMAIN_DISPATCH_V2_WEBSITE_MANAGER_14OCT2026.md`. Started 14 Oct 2026. KSM's additions (resume message): (1) bring Allwin Tours and Step N Rock onto the shared renderer, seeded from their hard-coded content with the same look, behind `site_doc_v2`, nothing switched on; (2) the Allwin subdomain is `allwintours`; (3) shared upload service with clear messages and the nginx `client_max_body_size` as a labelled VM step; (4) run bos:verify, the migration drift check and the frontend build and typecheck before the final commit; (5) stage only my own files.

To resume: read this file and the dispatch, continue from the first line not marked DONE, same rules, push to origin at the end.

## Phases

| Phase | Status | Where |
|---|---|---|
| 0 Trace and audit | DONE | `evidence/website-manager/AUDIT.md` (root causes RC1 to RC6), `REPRO.md`, `prod-readonly-raw.json` |
| 1 Single source of truth | DONE (flag-gated) | `VendorCMS` stays the one row; migration `20261014100000_website_manager`; new renderer `get4domain_mvp/src/engine/sitedoc/`; backfill `scripts/site-document-backfill.js` (+ lib, seeds); switch `scripts/site-doc-flag.js`; readiness reads the same data and a test proves it equals the page |
| 2 Draft, preview, publish, refresh, versions | DONE | `backend-api/src/site-doc/*`, editor `my-website/SiteEditorV2.tsx`, `/api/revalidate-site`, page cache tag `site:<subdomain>` |
| 3 Uploads | DONE | `backend-api/src/uploads/media.service.ts`, guard `scripts/website-manager/uploads-guard.js`, nginx step in DEPLOYMENT section 11 |
| 4 Every plan gets the editor | DONE | registry `website.content/new-pages/design/search/readiness` open for LEADSPACE with test ids; plan limits in `site-doc.constants.ts`; Website link in the LeadSpace-only shell |
| 5 Theme and layout engine | DONE | 13 themes (`engine/kit/site-themes.json`, AA contrast tested), 3-4 layouts for each of hero, about, items, gallery, quotes, contact |
| 6 Category packs | DONE | `g4d_category_packs`, admin `/admin/category-packs`, 32 starter packs, generate-from-pack onboarding, Salon acceptance test |
| 7 Existing vendors and VM steps | DONE (dry run on prod is for KSM: see below) | `docs/v2/DEPLOYMENT.md` section 11 |
| 8 Guards | DONE | wired into `npm run bos:verify` |

## Root causes (short; full text in AUDIT.md)

RC1 Allwin (and in part Step N Rock, Deebi) are hand-written standalone apps that ignore `VendorCMS`. RC2 readiness and public page read different data only because of RC1. RC3 about half of the editor fields never reached the shared public page. RC4 stock content appeared when a field was empty. RC5 saving was immediate, no draft, preview, publish or history. RC6 uploads failed silently, were unprocessed, and a PNG was not refused by our code (likely the proxy size limit, step 2 of section 11).

## Decisions taken without asking

1. The single source of truth stays `VendorCMS` (it already is the store every reader uses). Draft, layout and version pointer are added to the same row; versions, the media ledger and category packs are three new tables.
2. The production database was read with SELECT only inside a READ ONLY transaction (precedent: `STEPNROCK_TRACE.md`); only yes/no presence of fields was printed. The backfill dry run against production is left to KSM (section 11, step 7): Claude did not run the backfill script against production.
3. Allwin's real subdomain is `allwintours` (no hyphen); the earlier text that said `allwin-tours` for the campaign-merge script should be read the same way.
4. "Bring onto the shared renderer" is done as: seed the document, add two themes that match their colours (`harbour-amber`, `street-orange`), make the shared renderer able to show everything those sites show (logo, banner, about, services, gallery, quotes, contact, order-request cart, extra pages), and serve the vendor's own address from the shared renderer through a host rewrite in the frontend middleware (`<name>.get4domain.com` becomes `/site/<name>`). The nginx change that sends an address to the shared renderer is a labelled VM step; until it is made, each vendor's own app keeps serving that address. No vendor is switched on.
5. The shared renderer is not pixel-identical to the two hand-written sites. It reproduces their colours, content and structure through a theme and layouts, but the two hand-written sites have richer, custom pages (for example Step N Rock's product detail pages with size and colour choices). KSM should compare each side by side before moving that address.
6. Public pages are now cached for a minute (tag `site:<subdomain>`). Vendors not on the new workflow see changes within a minute instead of at once; vendors on it see them within seconds of Publish. The Step N Rock standalone app is untouched.
7. A pack's FAQ and trust points are not editable by the vendor in v1 (they come from the pack); every other field a page shows is editable.
8. Extra pages (title and text) are the meaning of "pages" for the plan limits (LeadSpace 1, Essentials 5, Pro 25, the home page counts as one).
9. `VendorProduct` rows the backfill adds are marked in `customFields` so a rollback removes exactly them (hard delete of its own insert only).
10. The retired external test id `site.live-edit` is still mapped in `scripts/bos-verify.mjs` EXTERNAL (harmless, no registry feature uses it now).

## Not done / limits

- The Facebook reel (Lentlo Sites) could only be read as a caption.
- Deebi Photography and the corporate site `ksm-quantum` were not moved (no instruction); Deebi already reads part of the CMS.
- Custom domains: the host rewrite handles `<name>.get4domain.com`; mapping a vendor's own domain (for example stepnrock.com) to the shared renderer needs a domain table lookup that does not exist yet.
- The pack's FAQ and trust points are not vendor-editable (decision 7).
- Production dry runs and every VM step are KSM's (DEPLOYMENT section 11).
