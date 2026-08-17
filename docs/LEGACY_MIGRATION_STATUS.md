# Legacy Migration — Status & Hand-off (17 Aug 2026)

Dispatch: `docs/GET4DOMAIN_DISPATCH_LEGACY_MIGRATION_17AUG2026.md`.
Rule note: the "never touch MR Travels / 3000/3001" rule is **revoked by KSM**;
CLAUDE_MEMORY_V2.md updated to match (it previously still said PERMANENT).

## ✅ Done this session — MR Travels new vendor site (PARALLEL, no cutover)

- **Read first (no writes to the legacy system):** inspected the legacy repo +
  the live public site. The legacy Supabase DB is **unreachable from dev** (tenant
  IP allow-list, VM-only) — content was read from `mrtravels.get4domain.com`
  (public) + the repo `BRAND` constant. The legacy operational DB holds only
  **placeholder catalog data** (1 test package, 1 test vehicle); MR Travels was
  never launched. Full inventory: `docs/LEGACY_MIGRATION_MRTRAVELS_CONTENT.md`.
- **Vendor already existed:** `admin@mrtravels.com`, subdomain `mrtravels`, owner
  "Jayachandran", non-sandbox, industry travel — but **empty** (no CMS, 0 products).
  So this was a **content migration onto an existing vendor**, not account creation.
- **Migrated (additive, idempotent — `scripts/migrate-mrtravels.ts`):**
  - VendorCMS: business identity, full About story, SEO, phone/email/address/WhatsApp.
  - 7 VendorProducts: the advertised service set + the one real (Munnar) package.
  - Custom travel theme "MR Travels — Heritage Gold" (linked via `themeId`).
  - Owner's account fields + password untouched; nothing deleted.
- **Verified LIVE in parallel** at `https://get4domain.com/site/mrtravels`:
  - Home: hero + tagline "Your Journey, Our Priority" + WhatsApp (`wa.me/919952109224`),
    full About story, 6-product grid + "View all".
  - `/listings`: all 7 packages incl. **Munnar ₹8,000, 3D/2N**.
  - `/contact`: phone 99521 09224, mrtravelstours@gmail.com, Thirukazhukundram
    address, WhatsApp + Send Enquiry, footer.
  - Builds: backend `npm run build` 0 errors; migration script typecheck 0 errors.

## ✅ Template library (Track A 2.2/2.3) — extended, not duplicated

Multi-theme-per-industry **already existed** end-to-end (schema `WebsiteTheme`,
service `list(industry)`, admin create/list/delete, vendor picker). The only gap
vs. the dispatch — **preview thumbnails** — was wired through (admin form + list +
vendor picker now surface `WebsiteTheme.preview`). Commit `25618e1`.

## ⛔ HARD STOPS — awaiting KSM (do NOT proceed without explicit approval)

1. **DNS / traffic cutover** of `mrtravels.get4domain.com` off port 3000 onto the
   new vendor site. Not touched. Requires KSM to look at the new site first.
2. **Deleting/stopping** the legacy MR Travels or Allwin Tours containers/data.
   Not touched — keep the verified backup tars as the rollback window.

## ❓ KSM decisions needed

1. **Operational BOS gap (the real mismatch):** the new vendor site is a marketing
   site + lightweight DomainApp core. The legacy app is a full travel ERP
   (bookings, fleet, quotations, invoicing, tariff, trip sheets, corporate
   contracts, driver/customer portals). Cutover means MR Travels **loses those
   workflows** unless they're built as Get4Domain addons. Fine if it's all test
   data (it is) — but it's your call. This is the mismatch flagged per the dispatch.
2. **GSTIN** `33ABCDE1234F1Z5` looks like a placeholder — set the real one via the
   vendor dashboard before invoices go out. (Deliberately left out of CMS/SEO.)
3. **Logo** `mainlogo_mrtravel.png` lives in the legacy app's assets — re-upload via
   the vendor dashboard (banner currently uses a stock image).
4. **Allwin Tours (port 3010)** — same staged pattern. Its Get4Domain vendor
   (`allwintours`, travel) also already exists but is **empty** (renders the
   "being set up" state). Not migrated yet — say the word and I'll repeat the
   content-migration step for it (its real content still needs reading, same
   public-site approach; its DB is likely IP-blocked too).

## Re-run / rollback

- Re-run migration (idempotent, on the VM): `cd backend-api && npx ts-node scripts/migrate-mrtravels.ts`
- Rollback the new content (does not affect the legacy app): delete the vendor's
  VendorCMS + VendorProducts + the "Heritage Gold" theme for vendor
  `cmrqjd1le0000d1kd0w1xbyn8`.
