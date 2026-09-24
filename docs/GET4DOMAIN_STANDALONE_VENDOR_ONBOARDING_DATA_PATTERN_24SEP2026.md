# Standalone sibling-app vendor onboarding — the real-data-at-deploy-time rule

**Dispatch: 24-Sep-2026. Read before onboarding the next standalone sibling app**
(the mr-travels / allwin-tours / ksm-quantum / stepnrock pattern — an uploaded/
client-built frontend deployed as its own Docker app+nginx vhost, not routed
through the shared section-kit engine).

## The rule

**A standalone sibling app's frontend must never ship with only hardcoded
fallback content as its real data source.** At deploy time, before handing the
site over as "live":

1. Create the real `Vendor` row (+ `VendorCMS`) for the client, reusing the
   existing auth/signup system — never a parallel bespoke account system.
2. Seed real `Category` rows for the client's actual product/service groupings
   — reuse an existing category name (case-insensitive, per vendor) rather than
   creating a disconnected duplicate; see `CmsService.findOrCreateCategory`
   (`backend-api/src/cms/cms.service.ts`) — this is the ONE place a Category row
   is ever created, and it's what every `POST .../products` call already goes
   through, so seeding via the real API (not a direct DB write) exercises it
   for real.
3. Seed real `VendorProduct` rows from whatever showcase/demo data shipped in
   the upload, linked to those categories — so the vendor's own Website Manager
   → My Products dashboard shows real, editable, replaceable starting content
   instead of an empty list.
4. Wire the frontend to read this real data (`GET /cms/site/:subdomain`, the
   same endpoint every live vendor site already uses) with the ORIGINAL
   hardcoded data kept only as a graceful fallback — never removed outright,
   since it's what keeps the site looking correct before step 3 runs and if
   the API is briefly unreachable.

## Why this matters (what happens if skipped)

Without this, "going live" only means the DNS + nginx + Docker container are
real — the *content* stays a static frontend array with zero relationship to
the vendor's actual database record. Two concrete failure modes:

- The vendor's dashboard (Website Manager, CRM, Orders) shows nothing, because
  there's genuinely no `VendorProduct`/`Category` data behind it — the "real"
  site the customer sees and the "real" data the vendor manages are two
  disconnected things.
- If a vendor later types a category name that happens to match one already
  implied by the hardcoded frontend content, there's nothing to reconcile
  against — it silently becomes a second, disconnected value with the same
  display name. (This was a real, live bug in `VendorProduct.category`
  before 24-Sep-2026: a bare free-text `String?` column, no dedicated table,
  no uniqueness check — fixed by the `Category` model + `findOrCreateCategory`
  referenced above. `allwin-tours` currently has the SAME gap this pattern
  describes — fully static `PACKAGES` data in `src/lib/constants.ts`, zero
  wiring to `VendorProduct`/backend-api — worth a follow-up pass, not
  retrofitted as part of this dispatch.)

## What does NOT solve this

- `IndustryExperience` (`g4d_industry_experiences` DB table +
  `get4domain_mvp/src/config/industry-experience.ts`) is **not** a category
  taxonomy — it's business-model/CRM-pipeline/module wiring only, and the DB
  table isn't even read by the running backend (only the frontend TS mirror
  is, for unrelated things). Don't reach for it when seeding categories.
- `IndustryConfig.catalogCustomFields` (`backend-api/src/config/industries/
  *.ts`) has a hardcoded category `select` for exactly 2 of 21 industries and
  targets a different model (`CatalogItem`, the domain-app/POS entity) — not
  `VendorProduct`, not reachable from the vendor dashboard's My Products form.

## Reference implementation

Step N Rock (`stepnrock/`) is the first app to follow this pattern fully —
see the commit that added `Category`/`findOrCreateCategory` and seeded its 6
categories + 12 products via the real `POST /cms/vendor/:id/products` API
(not a direct DB insert) for the exact shape to replicate.
