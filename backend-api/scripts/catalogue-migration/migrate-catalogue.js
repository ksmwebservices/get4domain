#!/usr/bin/env node
'use strict';
/**
 * Universal Catalogue — DATA migration (dispatch 03-Oct-2026).
 *
 *   node scripts/catalogue-migration/migrate-catalogue.js                 # DRY RUN (default): read-only
 *   node scripts/catalogue-migration/migrate-catalogue.js --scope=all     # include sandbox/demo vendors
 *   node scripts/catalogue-migration/migrate-catalogue.js --vendor=<id>   # one vendor only
 *   CATALOGUE_MIGRATION_CONFIRM=I_HAVE_APPLIED_THE_SCHEMA_MIGRATION \
 *     node scripts/catalogue-migration/migrate-catalogue.js --apply       # WRITES (single transaction)
 *
 * Scope: `real` (default) = vendors with isSandbox=false; `all` also copies demo-sandbox rows.
 * Prerequisite for --apply: migration 20261003100000_universal_catalogue_columns applied.
 * Dry-run needs no new columns: it runs the exact SELECTs the apply step will INSERT from.
 *
 * Safety: writes only to "VendorProduct" and g4d_categories; g4d_catalog_items and
 * g4d_retail_products are never written. The apply runs in ONE transaction and aborts
 * (rolls back) unless the rows inserted equal the rows the dry-run planned.
 */
const { PrismaClient } = require('@prisma/client');
const S = require('./catalogue-sql');
const { assertWriteAllowed } = S;

const argv = process.argv.slice(2);
const flag = (name) => argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const val = (name) => { const f = flag(name); return f && f.includes('=') ? f.split('=').slice(1).join('=') : undefined; };
const opts = { scope: val('scope') || 'real', vendorId: val('vendor') };
const APPLY = Boolean(flag('apply'));
const CONFIRM_VALUE = 'I_HAVE_APPLIED_THE_SCHEMA_MIGRATION';

if (!['real', 'all'].includes(opts.scope)) { console.error('--scope must be real|all'); process.exit(2); }

const line = (s = '') => console.log(s);
const head = (s) => { line(); line(`── ${s} ${'─'.repeat(Math.max(0, 66 - s.length))}`); };

(async () => {
  const prisma = new PrismaClient();
  const q = (sql) => prisma.$queryRawUnsafe(sql);
  try {
    line(`Universal Catalogue data migration — ${APPLY ? 'APPLY' : 'DRY RUN (read-only)'} — scope=${opts.scope}${opts.vendorId ? ` vendor=${opts.vendorId}` : ''}`);

    // 0. Is the schema migration applied?
    const cols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_name = 'VendorProduct'`)).map((r) => r.column_name);
    const missing = S.NEW_COLUMNS.filter((c) => !cols.includes(c));
    const ready = missing.length === 0;
    head('Schema state');
    line(ready ? 'Schema migration APPLIED (all universal columns present).' : `Schema migration NOT applied — missing columns: ${missing.join(', ')}`);

    // 1. Source + target inventory
    head('Inventory (rows in scope)');
    const inv = await q(`SELECT
      (SELECT count(*)::int FROM g4d_catalog_items ci JOIN "Vendor" v ON v.id = ci."vendorId" WHERE ${S.scopeWhere(opts)}) AS catalog_item,
      (SELECT count(*)::int FROM g4d_retail_products rp JOIN "Vendor" v ON v.id = rp."vendorId" WHERE ${S.scopeWhere(opts)}) AS retail_product,
      (SELECT count(*)::int FROM g4d_catalog_items) AS catalog_item_total,
      (SELECT count(*)::int FROM g4d_retail_products) AS retail_product_total,
      (SELECT count(*)::int FROM "VendorProduct") AS vendor_product_total`);
    const i = inv[0];
    line(`CatalogItem  in scope: ${i.catalog_item}  (table total ${i.catalog_item_total})`);
    line(`RetailProduct in scope: ${i.retail_product}  (table total ${i.retail_product_total})`);
    line(`VendorProduct (all):    ${i.vendor_product_total}`);

    // 2. Plan
    head('Plan');
    const catalogToCopy = (await q(S.countOf(S.catalogSelect(opts))))[0].n;
    const retailToCopy = (await q(S.countOf(S.retailSelect(opts))))[0].n;
    const catsToCreate = (await q(S.countOf(S.categoryDistinctSelect(opts))))[0].n;
    line(`CatalogItem  -> VendorProduct rows to INSERT: ${catalogToCopy}`);
    line(`RetailProduct -> VendorProduct rows to INSERT: ${retailToCopy}`);
    line(`Category rows to create (from RetailProduct.category text): ${catsToCreate}`);
    // (rows excluded by NOT EXISTS because the id is already taken)
    const taken = await q(`SELECT
      (SELECT count(*)::int FROM g4d_catalog_items ci JOIN "Vendor" v ON v.id = ci."vendorId" WHERE ${S.scopeWhere(opts)} AND EXISTS (SELECT 1 FROM "VendorProduct" x WHERE x.id = ci.id${ready ? ` AND x."sourceModel" IS DISTINCT FROM 'catalog_item'` : ''})) AS catalog_collisions,
      (SELECT count(*)::int FROM g4d_retail_products rp JOIN "Vendor" v ON v.id = rp."vendorId" WHERE ${S.scopeWhere(opts)} AND EXISTS (SELECT 1 FROM "VendorProduct" x WHERE x.id = rp.id${ready ? ` AND x."sourceModel" IS DISTINCT FROM 'retail_product'` : ''})) AS retail_collisions,
      (SELECT count(*)::int FROM g4d_catalog_items ci JOIN g4d_retail_products rp ON rp.id = ci.id) AS cross_source_collisions`);
    const t = taken[0];
    line(`id collisions with a DIFFERENT existing VendorProduct: catalog=${t.catalog_collisions} retail=${t.retail_collisions}; CatalogItem~RetailProduct id overlap=${t.cross_source_collisions}`);
    const blockers = [];
    if (t.catalog_collisions || t.retail_collisions || t.cross_source_collisions) blockers.push('id collision(s) — copy would silently skip rows');

    // 3. Type probe — proves every select expression has exactly the target column's type
    head('Column type probe (select expression type == target column type)');
    for (const [label, select] of [['CatalogItem select', S.catalogSelect(opts)], ['RetailProduct select', S.retailSelect(opts)]]) {
      const probe = (await q(S.typeProbe(select)))[0];
      const bad = S.TARGET_COLUMNS.filter(([n, ty]) => probe[n] !== ty).map(([n, ty]) => `${n}: got ${probe[n]}, want ${ty}`);
      line(`${label}: ${bad.length ? 'MISMATCH ' + bad.join('; ') : `OK (${S.TARGET_COLUMNS.length} columns)`}`);
      if (bad.length) blockers.push(`${label} type mismatch`);
    }

    // 4. Existing-row backfill preview
    head('Backfill of the new columns on EXISTING VendorProduct rows (fill-NULL only)');
    const bf = await q(S.backfillPreviewSelect(opts, ready));
    if (!bf.length) line('(no existing VendorProduct rows in scope)');
    bf.forEach((r) => line(`${String(r.vendor).padEnd(18)} rows=${String(r.rows).padStart(3)}  industryType=${r.industryType}  priceAmount=${r.priceAmount}  stockQty(from customFields)=${r.stockQty}  status->inactive=${r.statusToInactive}`));

    // 5. Sandbox exposure warning
    if (opts.scope === 'all') {
      head('Scope=all notice');
      line('Sandbox rows are copied with active=false. DemoService.cleanupExpiredSandboxes must also delete a');
      line('vendor\'s VendorProduct rows (else vendor.delete fails on the FK) — that one-line fix ships in this');
      line('dispatch; deploy it BEFORE using --scope=all.');
    }

    if (blockers.length) {
      head('BLOCKERS');
      blockers.forEach((b) => line(`✗ ${b}`));
      process.exitCode = 1;
      return;
    }

    if (!APPLY) {
      head('DRY RUN COMPLETE');
      line('Nothing was written. To apply: schema migration first, then re-run with --apply and');
      line(`CATALOGUE_MIGRATION_CONFIRM=${CONFIRM_VALUE}`);
      return;
    }

    // ── APPLY ────────────────────────────────────────────────────────────────
    if (!ready) { console.error('\nABORT: schema migration 20261003100000_universal_catalogue_columns is not applied.'); process.exitCode = 2; return; }
    if (process.env.CATALOGUE_MIGRATION_CONFIRM !== CONFIRM_VALUE) {
      console.error(`\nABORT: set CATALOGUE_MIGRATION_CONFIRM=${CONFIRM_VALUE} to confirm you applied the schema migration and reviewed the dry run.`);
      process.exitCode = 2; return;
    }

    head('APPLY (single transaction)');
    const result = await prisma.$transaction(async (tx) => {
      const run = async (label, sql) => {
        assertWriteAllowed(sql);
        const n = await tx.$executeRawUnsafe(sql);
        line(`${label}: ${n} row(s)`);
        return n;
      };
      const cats = await run('Categories created', S.categoryInsert(opts));
      const c = await run('CatalogItem  copied', S.insertFrom(S.catalogSelect(opts)));
      const r = await run('RetailProduct copied', S.insertFrom(S.retailSelect(opts)));
      const b1 = await run('Existing rows backfilled (industryType/priceAmount/stockQty)', S.backfillIndustryUpdate(opts));
      const b2 = await run('Existing inactive rows -> status=inactive', S.backfillStatusUpdate(opts));
      if (c !== catalogToCopy || r !== retailToCopy || cats !== catsToCreate) {
        throw new Error(`Row counts differ from the dry-run plan (catalog ${c}/${catalogToCopy}, retail ${r}/${retailToCopy}, categories ${cats}/${catsToCreate}) — rolling back`);
      }
      return { cats, c, r, b1, b2 };
    }, { timeout: 120000, maxWait: 20000 });

    head('APPLIED');
    line(JSON.stringify(result));
    line('Now run:  node scripts/catalogue-migration/verify-catalogue.js ' + argv.filter((a) => a.startsWith('--scope') || a.startsWith('--vendor')).join(' '));
    line('Do NOT touch the old tables until verify prints ALL CHECKS PASSED.');
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });

