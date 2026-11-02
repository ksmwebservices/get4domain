# Baseline changes — the 72 pre-existing modified files

> Date: 2026-11-02 · Branch `v3-step0` · HEAD `963e793`
> **Read-only analysis.** Nothing was staged, committed, stashed, reset or edited, and no `.env*` or secret file was opened. Sources: `git status`, `git diff --numstat`, and reading the diffs and the owner's own progress document (`docs/v2/EXISTING_CLIENTS_PROGRESS.md`, untracked).
> **Totals: 72 modified files, +1544 / −570.** I did not build, lint or test these files; completeness below is what the diffs and the progress document say, not something I verified by running it.

## 0. What these changes are

All 72 files belong to **one coherent, undeployed feature** from the 21 Oct dispatch *"Existing clients on Website Manager"* (`GET4DOMAIN_DISPATCH_V2_EXISTING_CLIENTS_21OCT2026.md`, untracked), started on top of the deployed head `4afe6ee` (an ancestor of the current HEAD). It has two halves:

1. **Connected mode** — four existing client sites (Allwin Tours, Step N Rock, Deebi Wedding Stories, KSM Quantum) keep their own design but read their content from Website Manager. A per-vendor add-on row (`site_connected`) switches it on, one vendor at a time, only by script. **No database migration** (add-on rows, no new columns).
2. **New vendors get a full site at registration** — `StarterService.provisionSite` writes a hidden DRAFT site (category starter content, designs) at sign-up, and the owner lands in Website Manager on a "get your site ready" checklist.

Progress document status: C0 audit DONE · C1 connection layer DONE · **C2 wire each app: code done, pixel comparison "being tuned until it passes"** · C3 Website Manager UI DONE · C4 backfill/dry-run/report DONE · C5 rollout order DONE · C6 new-vendor site DONE · **C7 guards: "suites written; passing run to be confirmed"** · C8 deploy section DONE.

**Dependency warning that applies to every group:** these modified files import or call **47 untracked companion files** (listed in section 7) plus 116 untracked evidence files (6.2 MB). Committing any group alone, without its companions, produces a tree that does not compile or whose test script fails.

## 1. Summary

| Group | Area | Files | + / − | Risk | State | Recommendation for the V3 base |
|---|---|---:|---|---|---|---|
| G1 | Backend auth + sign-up redirect | 3 | +16 / −3 | Medium | Complete per C6; run unconfirmed | **Leave out now**; revisit in V3.2 |
| G2 | Backend site-doc / Website Manager / connected mode | 13 | +612 / −89 | **Medium–High** | Complete per C1/C4; run unconfirmed | **Leave out now**; revisit in V3.2 |
| G3 | Dashboard Website Manager UI | 2 | +107 / −31 | Low–Medium | Complete per C3 | **Leave out now**; goes with G2 |
| G4a–d | Client apps (Allwin, Deebi, Step N Rock, KSM Quantum) | 52 | +668 / −447 | **Medium–High** (live sites) | Code done; **visual verification in progress** | **Leave out** (legacy client apps, separate deploys) |
| G5 | Deployment doc + verify wiring | 2 | +141 / −0 | Low | Doc done; suites unconfirmed | Keep with the feature, not with V3 |

## 2. G1 — Backend auth and sign-up redirect (3 files, +16 / −3)

| File | + | − |
|---|---:|---:|
| `backend-api/src/auth/auth.module.ts` | 2 | 0 |
| `backend-api/src/auth/auth.service.ts` | 12 | 1 |
| `get4domain_mvp/src/app/register/page.tsx` | 2 | 2 |

**What changed**
- `auth.service.ts`: `AuthService` now injects `StarterService` and, right after a vendor registers, calls `starter.provisionSite(vendor.id, { businessName, phone, industry })`. The call sits in a `try/catch` that only logs a warning, so a failure never blocks a sign-up. Also imports `Logger`.
- `auth.module.ts`: imports `SiteDocModule` so the injection resolves.
- `register/page.tsx`: after registering, the browser goes to `/dashboard/website/content` (Website Manager) instead of `/site/<subdomain>` or `/dashboard`.

**Risk: Medium.** It changes the sign-up path for *every* new vendor (extra database writes per sign-up: an add-on row, a CMS row and starter items) and adds a dependency from the auth module to the site-doc module (a circular-import risk I did not check by building). It is the only change in the 72 that touches the authentication area; Step 0 deliberately avoids both `auth` files, and the planned S7/S13 work does not need them, so there is no overlap with the V3 work.
**State:** complete according to C6; the `new-vendor-site` suite exists but its passing run is unconfirmed.

**Proposed commit message**
```
feat(signup): new vendors start with a hidden draft site and land in Website Manager

Registration now provisions the vendor's starter site (category content and designs) as a
DRAFT that stays hidden and unindexed until the owner publishes. A failure is logged and never
blocks the sign-up. After registering the owner opens Website Manager with the get-ready list.
```

## 3. G2 — Backend site-doc, CMS and connected mode (13 files, +612 / −89)

| File | + | − |
|---|---:|---:|
| `backend-api/scripts/site-document-backfill-lib.js` | 62 | 16 |
| `backend-api/scripts/site-document-backfill.js` | 4 | 40 |
| `backend-api/scripts/website-manager/standalone-seeds.json` | 377 | 17 |
| `backend-api/src/addons/addons.constants.ts` | 4 | 0 |
| `backend-api/src/cms/cms.service.ts` | 11 | 1 |
| `backend-api/src/cms/dto/update-vendor-cms.dto.ts` | 3 | 1 |
| `backend-api/src/registry/provisioning.ts` | 1 | 1 |
| `backend-api/src/site-doc/packs.service.ts` | 1 | 0 |
| `backend-api/src/site-doc/sample-markers.ts` | 16 | 3 |
| `backend-api/src/site-doc/site-doc.constants.ts` | 3 | 1 |
| `backend-api/src/site-doc/site-doc.service.ts` | 65 | 5 |
| `backend-api/src/site-doc/site-refresh.service.ts` | 28 | 0 |
| `backend-api/src/site-doc/starter.service.ts` | 37 | 4 |

**What changed**
- `site-doc.service.ts` (+65): the site view gains `connected` (which client app, its fields, public URL) and a `checklist` of seven steps ticked from what is really in the site; new `markOnboarding`, `refuseWhenConnected`, `connectedOf`.
- `starter.service.ts` (+37): new `provisionSite` (idempotent; draft; used by sign-up and the admin "create one site" button, which now takes the same path); design/starter endpoints refuse for connected vendors and mark "design chosen".
- `site-refresh.service.ts` (+28): on Publish also asks the vendor's own app to drop its cache (`/api/revalidate-site` with `REVALIDATE_SECRET`), 4-second timeout; the message to the owner depends on the app.
- `sample-markers.ts`: tracks which fields an owner has changed or cleared (`extras.edited`) — **written for every vendor on every edit, not only connected ones**, so the stored shape of `VendorCMS.extras` changes for all vendors.
- `cms.service.ts`, `update-vendor-cms.dto.ts`, `site-doc.constants.ts`, `packs.service.ts`: public payload `siteMode` + `connected`; optional 1–5 testimonial `rating`; the pack generator refuses for connected vendors.
- `addons.constants.ts` (+4) and `registry/provisioning.ts`: two new add-on keys (`site_connected`, `site_onboarding`) in the catalogue, excluded from the "beyond plan" report. These two files belong to the legacy plan/add-on registry (Workspace/BOS era); the changes are additive.
- `site-document-backfill.js` / `-lib.js` and `standalone-seeds.json` (+377): the backfill moves to a shared runner, prints a per-field dry run, fills `extras` key by key, and carries seeds for the four apps (content data, no secrets).

**Risk: Medium–High.** Largest backend change; touches the Website Manager every vendor uses; changes stored data shape; and `cms.service.ts`, `site-doc.service.ts`, `site-refresh.service.ts` import the **untracked** `backend-api/src/site-doc/connected-apps.ts`, so these files cannot be committed without it. Needs `REVALIDATE_SECRET` configured for the refresh to reach apps.
**State:** complete per C1/C4; the existing-clients Postgres suite is written, its passing run is unconfirmed.

**Proposed commit message**
```
feat(website-manager): connected mode for existing client apps, edit tracking, starter provisioning

A vendor can be switched (by script, one at a time, via the site_connected add-on) so that its own
app keeps its design and reads its content from Website Manager. Adds provisionSite (draft site at
sign-up), the get-ready checklist, edit tracking, app cache refresh on Publish, and the backfill
dry run/seeds for the four apps. No migration. Requires connected-apps.ts and the site-mode scripts.
```

## 4. G3 — Dashboard Website Manager UI (2 files, +107 / −31)

| File | + | − |
|---|---:|---:|
| `get4domain_mvp/src/app/dashboard/my-website/SiteContentTabs.tsx` | 57 | 16 |
| `get4domain_mvp/src/app/dashboard/my-website/SiteEditorV2.tsx` | 50 | 15 |

**What changed:** `SiteEditorV2.tsx` hides every tab and box a connected app cannot show ("no box that does nothing"), shows "your design" and a `ChecklistPanel` ("Get your site ready: n of m done") for new sites, and disables "Reset to starter" for connected vendors; `SiteContentTabs.tsx` adds `ChecklistPanel`, a `ConnectedDesignTab`, an optional `only` filter on the page-content tab and an optional testimonial rating.
**Risk: Low–Medium.** UI only. It reads `view.connected` / `view.checklist`, both optional, so it degrades safely if G2 is absent, but it is meaningless without G2.
**State:** complete per C3 (hand-verified in a browser per the progress document).

**Proposed commit message**
```
feat(dashboard): Website Manager get-ready checklist and connected-site editor
```

## 5. G4 — Client apps (52 files across four apps)

Common to all four: each app gets its own `lib/content.ts` (the app's **own words as defaults**), a `ContentContext` provider, a copy of the shared `site-connect/` files, a request-time `getContent()` with a 60-second cache that Publish drops, `/p/<slug>` owner pages, `/api/revalidate-site`, `robots`/`sitemap` that say "do not index" while a site is a preview or only starter text, and static pages become per-request. **Every one of those companions is untracked** (section 7). `docker-compose.yml` in each app gains `SITE_CONNECT_API`, `REVALIDATE_SECRET` and (Allwin) `SITE_URL`.

### G4a — Allwin Tours (`allwin-tours/`, port 3010) (16 files, +191 / −119)

| File | + | − |
|---|---:|---:|
| `allwin-tours/docker-compose.yml` | 3 | 0 |
| `allwin-tours/next.config.ts` | 4 | 0 |
| `allwin-tours/src/app/about/page.tsx` | 36 | 20 |
| `allwin-tours/src/app/contact/ContactForm.tsx` | 3 | 2 |
| `allwin-tours/src/app/contact/page.tsx` | 24 | 8 |
| `allwin-tours/src/app/fleet/page.tsx` | 11 | 6 |
| `allwin-tours/src/app/layout.tsx` | 32 | 18 |
| `allwin-tours/src/app/packages/page.tsx` | 11 | 6 |
| `allwin-tours/src/components/BookingModal.tsx` | 3 | 2 |
| `allwin-tours/src/components/ChatBot.tsx` | 2 | 1 |
| `allwin-tours/src/components/FleetSection.tsx` | 3 | 2 |
| `allwin-tours/src/components/Footer.tsx` | 28 | 26 |
| `allwin-tours/src/components/Hero.tsx` | 19 | 20 |
| `allwin-tours/src/components/Navbar.tsx` | 5 | 4 |
| `allwin-tours/src/components/PackagesSection.tsx` | 2 | 1 |
| `allwin-tours/src/components/Testimonials.tsx` | 5 | 3 |

**What changed:** Hero, About, Packages, Fleet, Contact, Footer, Navbar, Testimonials, BookingModal, ChatBot and layout now take their text/images from `useContent()`; `layout.tsx` builds metadata from the content (`generateMetadata`); `next.config.ts` +4; `docker-compose.yml` adds `SITE_CONNECT_API`, `REVALIDATE_SECRET`, `SITE_URL`.
**Proposed commit message:** `feat(allwin-tours): read site content from Website Manager in connected mode (design unchanged)`

### G4b — Deebi Wedding Stories (`deebiphotography/`, port 3016) (17 files, +166 / −139)

| File | + | − |
|---|---:|---:|
| `deebiphotography/app/layout.tsx` | 28 | 34 |
| `deebiphotography/app/robots.ts` | 7 | 1 |
| `deebiphotography/app/services/[slug]/page.tsx` | 6 | 3 |
| `deebiphotography/app/services/page.tsx` | 8 | 1 |
| `deebiphotography/app/sitemap.ts` | 9 | 1 |
| `deebiphotography/components/site/About.tsx` | 10 | 0 |
| `deebiphotography/components/site/BookingModal.tsx` | 6 | 5 |
| `deebiphotography/components/site/Contact.tsx` | 10 | 11 |
| `deebiphotography/components/site/FloatingWhatsApp.tsx` | 4 | 4 |
| `deebiphotography/components/site/Footer.tsx` | 45 | 35 |
| `deebiphotography/components/site/Header.tsx` | 9 | 6 |
| `deebiphotography/components/site/Hero.tsx` | 6 | 3 |
| `deebiphotography/components/site/Portfolio.tsx` | 6 | 2 |
| `deebiphotography/components/site/Testimonials.tsx` | 5 | 31 |
| `deebiphotography/docker-compose.yml` | 3 | 0 |
| `deebiphotography/lib/site-data.ts` | 1 | 1 |
| `deebiphotography/lib/use-services.ts` | 3 | 1 |

**What changed:** Header, Footer (social icons, owner pages), Hero, About, Portfolio, Testimonials, Contact, BookingModal, services pages, layout, `robots.ts` and `sitemap.ts` read the content; service packages keep their already-live catalogue path; `robots`/`sitemap` become dynamic; compose adds the three variables.
**Proposed commit message:** `feat(deebiphotography): read site content from Website Manager in connected mode (design unchanged)`

### G4c — Step N Rock (`stepnrock/`, port 3015) — **the live shop** (9 files, +180 / −114)

| File | + | − |
|---|---:|---:|
| `stepnrock/app/about/page.tsx` | 17 | 10 |
| `stepnrock/app/contact/page.tsx` | 24 | 11 |
| `stepnrock/app/layout.tsx` | 75 | 56 |
| `stepnrock/app/page.tsx` | 15 | 9 |
| `stepnrock/app/robots.ts` | 5 | 1 |
| `stepnrock/app/sitemap.ts` | 6 | 0 |
| `stepnrock/components/layout/Footer.tsx` | 29 | 24 |
| `stepnrock/components/layout/Header.tsx` | 6 | 3 |
| `stepnrock/docker-compose.yml` | 3 | 0 |

**What changed:** Home, About, Contact, Header, Footer, layout, `robots.ts` (disallow-all while preview/starter), `sitemap.ts` (owner pages) read the content. The progress document states the shop, product, cart and checkout paths are untouched; compose adds the three variables.
**Proposed commit message:** `feat(stepnrock): read site content from Website Manager in connected mode (shop paths untouched)`

### G4d — KSM Quantum (`ksm-quantum/`, port 3014) (10 files, +131 / −75)

| File | + | − |
|---|---:|---:|
| `ksm-quantum/docker-compose.yml` | 3 | 0 |
| `ksm-quantum/src/app/about/page.tsx` | 10 | 2 |
| `ksm-quantum/src/app/contact/page.tsx` | 17 | 6 |
| `ksm-quantum/src/app/layout.tsx` | 54 | 45 |
| `ksm-quantum/src/app/page.tsx` | 5 | 3 |
| `ksm-quantum/src/app/robots.ts` | 4 | 1 |
| `ksm-quantum/src/app/sitemap.ts` | 6 | 1 |
| `ksm-quantum/src/components/ContactForm.tsx` | 5 | 3 |
| `ksm-quantum/src/components/Footer.tsx` | 17 | 7 |
| `ksm-quantum/src/components/Nav.tsx` | 10 | 7 |

**What changed:** Home, About, Contact, ContactForm, Nav, Footer, layout, `robots.ts` and `sitemap.ts` read the content; social links appear only once the owner fills one in; compose adds the three variables.
**Proposed commit message:** `feat(ksm-quantum): read site content from Website Manager in connected mode (design unchanged)`

**Risk (G4): Medium–High.** These are four live production sites (one is a live shop). A change that renders text from a content layer must look **identical** until the owner edits something; the progress document says the pixel-by-pixel comparison is still being tuned (C2), so equality is **not yet proven**. Rendering changes from static to per-request for several pages. Each app deploys separately and needs the new environment variables and a rebuild.
**State:** code complete (typecheck and `next build` pass per the progress document); **visual verification in progress**; nothing deployed.

## 6. G5 — Deployment document and verify wiring (2 files, +141 / −0)

| File | + | − |
|---|---:|---:|
| `docs/v2/DEPLOYMENT.md` | 133 | 0 |
| `scripts/bos-verify.mjs` | 8 | 0 |

- `docs/v2/DEPLOYMENT.md` (+133): new **section 13** — the ordered, owner-run VM steps: check the database is up to date (read-only) and back it up, pull and compile scripts, set `REVALIDATE_SECRET`, rebuild the backend and web app, run the vendor report, then per client rebuild → dry run → apply → connect (rollout order: KSM Quantum, Deebi, Allwin, Step N Rock last), with rollback.
- `scripts/bos-verify.mjs` (+8): four new steps and a check that every existing-clients and new-vendor test id ran and passed. They call **untracked** scripts (`scripts/existing-clients/*`, `scripts/existing-clients-guard.mjs`), so `npm run bos:verify` would fail if this file were committed without them.
**Risk: Low** (docs) / **Low–Medium** (`bos-verify.mjs`, because of the untracked dependencies).
**State:** doc complete (C5, C8); suites written, passing run unconfirmed (C7).

**Proposed commit messages**
```
docs(deploy): section 13 — existing client sites on Website Manager and new vendors

test(bos-verify): add the existing-clients and new-vendor suites to the verify run
```

## 7. Untracked companions that must travel with these files

Counted from `git status` (names only). None of these is part of the 72, so none is mentioned in the numbers above.

| Area | Untracked files |
|---|---|
| Backend | `src/site-doc/connected-apps.ts`; `scripts/site-mode.js`, `site-mode-lib.js`, `site-mode-run.js`, `site-backfill-run.js`, `site-vendor-report.js`, `site-vendor-report-lib.js`; `scripts/existing-clients/` (5 files: `lib.js`, `specs.js`, and the three `verify-*` suites) |
| Repo scripts / shared | `scripts/existing-clients-guard.mjs`; `site-connect/` (`README.md`, `middleware.ts`, `revalidate-route.ts`, `site-connect.ts`) |
| Each of the four apps | `lib/content.ts`, `ContentContext.tsx`, `lib/site-connect.ts`, `middleware.ts`, `api/revalidate-site/route.ts`, `p/[slug]/page.tsx` (Allwin also `robots.ts`, `sitemap.ts`; Deebi also `lib/defaults.ts`) |
| Docs | `GET4DOMAIN_DISPATCH_V2_EXISTING_CLIENTS_21OCT2026.md`, `docs/v2/EXISTING_CLIENTS_PROGRESS.md` |
| Evidence | `evidence/existing-clients/` — 116 files, 6.2 MB (screenshots for the pixel comparison; probably not for the code repository) |
| Not part of this work | `ksm-quantum/.claude/` (tool configuration) |

## 8. Recommendation

**Do not commit any of the 72 files to the V3 base branches (`v3-upgrade` / `v3-step0`) as they stand.** Reasons:
1. They are one feature, not five independent changes. G1–G3 and the backend scripts reference each other and ~47 untracked files; a partial commit breaks the build or the verify script.
2. The feature is **not finished being verified**: pixel equality for the four apps (C2) and the passing run of the guard suites (C7) are both marked open, and nothing is deployed.
3. Most of the volume (G4, 52 of 72 files, plus the seeds and scripts) exists to serve **four legacy client sites**, which the V3 scope decisions (D1) put outside V3. A V3 base should not inherit a deployment plan (DEPLOYMENT.md section 13) for them.
4. G1/G2 also change behaviour for **all** new vendors and all vendors' stored site data, which belongs under V3.2 review, not in a base commit.

| Group | Verdict | Where it belongs |
|---|---|---|
| G1 backend auth + register | **Leave out of the V3 base now** | Candidate for **V3.2** ("instant free website at registration" is the same idea). Commit with G2 first; then review against the V3.2 design. |
| G2 site-doc / CMS / scripts | **Leave out now** | Same feature branch. Needs `connected-apps.ts` and the site-mode scripts. For V3.2, only `provisionSite`, the checklist and the edit tracking are relevant; connected mode is for the four legacy apps. |
| G3 dashboard UI | **Leave out now** | Goes with G2 (checklist is the V3.2-relevant part). |
| G4a–d client apps | **Leave out of V3 entirely** | Their own commits/branch (one per app), deployed per `DEPLOYMENT.md` section 13 after the visual check. |
| G5 DEPLOYMENT.md, bos-verify.mjs | **Keep with the feature**, not with V3 | Documents and tests the undeployed feature. `DEPLOYMENT.md` alone would compile, but describes steps for code that is not in the tree. |

**Suggested route (nothing here has been run):**
1. Cut a feature branch from the owner's V2 line (the `get4domain-site` branch at `233d78c`, which contains the deployed head `4afe6ee`), not from the V3 branches.
2. On that branch commit the five groups **together with the section 7 companions**, in this order: backend (G2 + `connected-apps.ts` + scripts) → G1 → G3 → each app (G4a–d with its companions) → G5. Keep `evidence/` and `ksm-quantum/.claude/` out of git (or use a separate evidence archive).
3. Before committing: build the backend, run `npm run bos:verify` (the suites boot the real API; build the apps asynchronously as the progress document explains), and finish the pixel comparison for the four apps.
4. Keep the feature **off the V3 CI path**; adopt only what V3.2 needs by merge or cherry-pick once the V3.2 plan and the pending plan-model amendment are known.

*Why not simply the smallest groups?* Even the "small" ones are unsafe alone: `DEPLOYMENT.md` documents undeployed code, `bos-verify.mjs` calls untracked scripts, `register/page.tsx` redirects to a page that exists but is only fully useful with G2/G3.
