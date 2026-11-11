# V3 Website Manager: rules document (B9.0)

Status: written first (B9.0), completed at the end of the run (section 12 onward). Branch `v3-b9`, worktree `C:\Get4Domain\get4domain-b9`, on `origin/v3-b5` (Stage 9, `8d9ca51`). Sources: `STAGE_13_WEBSITE_MANAGER_BATCH_9.md` (with the banner library addendum and Amendments 06 and 07), `AMENDMENT_08` Part B items B1 to B4, and `AMENDMENT_09` (read for context only, nothing built from it).

Only `backend-api`, `docs/v3` and `backend-api/prisma/seed` change. No frontend, no themes repo, no Stage 9 code.

## 1. Owner overrides for this run (they win over the stage file)

1. Base is `origin/v3-b5`, not `origin/v3-b8` (Release 1 skips Stages 10 to 12).
2. Batch 8 (theme zip, theme library) does not exist. Nothing of it is built. The Website Manager works against the renderer, the publish pipeline and the editable-field map that exist now. Each gap is listed in section 11 and in OPEN QUESTIONS.
3. No theme and no frontend is touched. A theme that does not expose every page and section is listed as a gap.
4. Amendment 08 backend items are extra slices after 5.5 and before 5.13b: B1 per-page SEO, B2 location and directions, B3 Google review link, B4 testimonials.
5. No Stage 9 code changes.
6. No push.

## 2. Owner rules that this run touches (frozen 4 November 2026, restated from the stage file)

- Rule 1: the subdomain is the canonical host by default; edits never change the canonical host or the sitemap rules; only the canonical host is in the sitemap.
- Rule 2: a Free site is an informational listing: business details and the phone number as plain text, no button, form or call to action. Pro features are LOCKED_PREVIEW. Pro sites carry the full call-to-action set for their tier.
- Rule 4: the bridge model; we promise promotion effort, not ranking, leads or sales.
- Rule 6: a site is never hidden or deleted because a plan lapses; stored Pro content is kept and returns with Pro.
- Rule 7: self-service in the dashboard is free within the plan; anything our team does for a vendor is a paid service done only on request.
- Rule 8: every vendor action is written to the activity log and staff see alerts afterwards.
- Rule 11: the prohibited-term scan is alert-only and never blocks.
- Rule 13: no timeframes in generated or seeded product text; the words Workspace, BOS and LeadSpace never appear in generated or seeded text.

## 3. Amendments applied (where they win)

- **Amendment 06** wins over the original Free rule: a Free vendor may edit, but every Free edit is a submission (DRAFT, SUBMITTED, APPROVED, REJECTED with a reason). Nothing reaches the live site until staff approve. The live site keeps the last approved content. Pro edits go live at once, with the activity log and staff alerts afterwards.
- **Amendment 07** wins over the page list: the manager edits every page. The vendor SEO tab and the Directory listing tab are removed from the vendor UI; the SEO APIs stay for staff and reports.
- **Amendment 08** wins over Amendment 07 for B1 to B4: the vendor edits per-page SEO text and slug (B1); the fixed markup (structured data, canonical, hreflang) stays automatic and locked.
- **Banner library addendum**: a Banner Library per category with a licence manifest, for staff and for the vendor.

## 4. Roles

The staff roles that exist today are `SUPER_ADMIN`, `OPERATIONS` and `MARKETING` (`admin-role-matrix.ts`). The stage file names `SUPPORT`, `Website Developer` and `Customer Support`, which do not exist. Decision D-1: wherever the stage names a support or developer role, the matrix gives `OPERATIONS` and `SUPER_ADMIN`; `MARKETING` is denied on anything that carries personal or money data. Listed in OPEN QUESTIONS (Q1).

## 5. Architecture in one page

- **Live content is the snapshot of the current publication.** Each build of the manager stores the content document it was built from, keyed by the publication id (`g4d_site_snapshots`). The live document is therefore always a function of which publication is PUBLISHED. A rollback needs no second write: the new version resolves to the source version's document. This removes the need for a "promote the draft" step that could succeed while the publish fails.
- **Draft overlay.** One draft document per vendor (`g4d_site_drafts`), saved field by field with a revision counter and a base version; autosave is a patch of one field.
- **ContentSource** gains a second layer: legacy `VendorCMS` (read only, unchanged) overlaid with the managed document. The renderer input mapping (`content-adapter.ts`) is not changed; the overlay is applied to the source document before it.
- **Publish (Pro)**: validate fields, wording check, build with the draft as the overlay, publish through the existing `PublishService`, store the snapshot, scan for prohibited terms (alert only), purge the public cache, write the activity row.
- **Submit (Free)**: validate, wording check, prohibited-term scan at submit time, store a `content_submissions` row with the payload. Staff approve (build with the payload as the overlay, publish, snapshot) or reject (reason required). Old content stays live.
- **Services and products are the same records as the vendor's Offerings or Catalogue** (`VendorProduct`); the site reads them, the manager never writes them.
- **Locked fields.** Titles, structured data, canonical links, hreflang and the SEO, GEO and AEO markup are generated by the platform and cannot be written by a vendor. The write path accepts only the typed fields of the editable-field map and rejects every other key.

## 6. Editable-field map

Derived from the kit at run time, never invented: the page templates of the chosen theme, each `data-g4d-section` (id, label, optional) in those templates, and the typed fields the renderer binds for that section. The map is pure data returned by `GET /v3/me/site/editor/map`.

## 7. Slices and migrations (each slice has its own migration folder, RLS on every table, cross-tenant tests)

| Slice | What | Migration |
|---|---|---|
| 5.5a | Content document, draft overlay, publish, snapshots, restore, compare, brand, navigation | `20261128100000_v3_website_manager` |
| 5.5b | Media library and Banner Library (manifest, StoragePort, re-encoding) | `20261129100000_v3_website_media` |
| 5.5c | Free edits to review (`content_submissions`) and staff review routes | `20261130100000_v3_content_submissions` |
| B1 | Per-page SEO | `20261201100000_v3_page_seo` |
| B2 | Location and directions | `20261202100000_v3_site_location` |
| B3 | Google review link | `20261203100000_v3_review_link` |
| B4 | Testimonials | `20261204100000_v3_testimonials` |
| 5.13b | Act on behalf and the onboarding queue | `20261205100000_v3_act_on_behalf` |

## 8. Per-task protocol (every slice)

Failing tests first with the red result shown; smallest change to green; lint, build, unit tests, `verify:migrations`, `verify:migrations-additive`, `verify:raw-sql`, the legacy static check, the route classification and role matrix tests; every new route classified and in the matrix; every new table has row-level rules and a cross-tenant test; staging integration tests written and marked NOT RUN; stage only the slice's paths; secret scan; path-only commit; append to `B9_LOG.md`.

## 9. Stop-lines in force

No production access, no live provider call, no deploy, no DNS change. Staging database only; additive migrations only. No secrets read or printed. No checkout, restore, stash, reset, clean, rebase or amend; path-only commits; no push. V3 code never reads or writes legacy billing, wallet, BOS, commercial, domain-campaign, vendor-payments or menu-gating tables. No invented business values (limits, caps, thresholds come from settings; loaders refuse to enable a feature until staff set them). No Redis or BullMQ; any per-vendor lock waits in the KeyedQueue before a transaction opens. Three distinct failed attempts: stop and report.

## 10. Wording and scan rules for this run

- **Wording check** (`wording-core.ts`, pure): refuses vendor text in SEO fields, testimonials, review wording and landing text that promises a result or a ranking (guarantees, "number one", "first page of Google", "top ranking", guaranteed leads or sales). It also refuses a rupee price in SEO text and the retired product names. It is a validation error for the vendor (`WORDING_NOT_ALLOWED`, names the field, never echoes the text into logs).
- **Prohibited-term scan** (Batch 4b, `TrustScanService`): runs after publish and at submit time for Free; alert only; never blocks.
- Generated or seeded text written by this run is scanned by a test for the retired names and for timeframes.

## 11. Gaps recorded as the run builds (completed at the end)

To be completed in section 14.
