#!/usr/bin/env node
'use strict';
/**
 * Universal Catalogue — post-migration VERIFICATION (read-only; SELECTs only).
 *
 *   node scripts/catalogue-migration/verify-catalogue.js [--scope=real|all] [--vendor=<id>]
 *
 * Run AFTER migrate-catalogue.js --apply and BEFORE anything old is touched. Exit 0 only when
 * every check passes. Exit 2 = schema migration not applied yet (nothing to verify).
 */
const { PrismaClient } = require('@prisma/client');
const S = require('./catalogue-sql');

const argv = process.argv.slice(2);
const val = (n) => { const f = argv.find((a) => a.startsWith(`--${n}=`)); return f ? f.split('=').slice(1).join('=') : undefined; };
const opts = { scope: val('scope') || 'real', vendorId: val('vendor') };
const W = S.scopeWhere(opts);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

(async () => {
  const prisma = new PrismaClient();
  const q = (sql) => prisma.$queryRawUnsafe(sql);
  try {
    const cols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_name = 'VendorProduct'`)).map((r) => r.column_name);
    const missing = S.NEW_COLUMNS.filter((c) => !cols.includes(c));
    if (missing.length) { console.error(`Schema migration not applied (missing: ${missing.join(', ')}). Nothing to verify.`); process.exitCode = 2; return; }

    console.log(`Universal Catalogue verification — scope=${opts.scope}${opts.vendorId ? ` vendor=${opts.vendorId}` : ''}\n`);
    const one = async (sql) => (await q(sql))[0];

    // 1. Row counts match, source -> unified
    for (const [label, table, model, alias] of [['CatalogItem', 'g4d_catalog_items', 'catalog_item', 'ci'], ['RetailProduct', 'g4d_retail_products', 'retail_product', 'rp']]) {
      const r = await one(`SELECT
        (SELECT count(*)::int FROM ${table} ${alias} JOIN "Vendor" v ON v.id = ${alias}."vendorId" WHERE ${W}) AS src,
        (SELECT count(*)::int FROM "VendorProduct" vp JOIN "Vendor" v ON v.id = vp."vendorId" WHERE vp."sourceModel" = '${model}' AND ${W}) AS dst`);
      check(`${label} row count == unified copies`, r.src === r.dst, `source=${r.src} unified=${r.dst}`);
      const miss = await one(`SELECT count(*)::int AS n FROM ${table} ${alias} JOIN "Vendor" v ON v.id = ${alias}."vendorId"
        WHERE ${W} AND NOT EXISTS (SELECT 1 FROM "VendorProduct" vp WHERE vp.id = ${alias}.id AND vp."sourceModel" = '${model}' AND vp."sourceId" = ${alias}.id)`);
      check(`${label}: every source id present in unified table (same id, same provenance)`, miss.n === 0, `missing=${miss.n}`);
    }

    // 2. Field fidelity on copies
    const cat = await one(`SELECT count(*)::int AS n FROM g4d_catalog_items ci JOIN "Vendor" v ON v.id = ci."vendorId" JOIN "VendorProduct" vp ON vp.id = ci.id AND vp."sourceModel" = 'catalog_item'
      WHERE ${W} AND NOT (vp.name = ci.name AND vp."vendorId" = ci."vendorId" AND vp.description IS NOT DISTINCT FROM ci.description AND vp."priceAmount" IS NOT DISTINCT FROM ci.price
        AND vp.unit IS NOT DISTINCT FROM ci.unit AND vp.image IS NOT DISTINCT FROM ci.image AND vp."stockQty" IS NOT DISTINCT FROM ci.stock
        AND vp."customFields" IS NOT DISTINCT FROM ci."customFields" AND vp."createdAt" = ci."createdAt"
        AND vp.status = (CASE WHEN ci.active THEN 'active' ELSE 'inactive' END))`);
    check('CatalogItem fields preserved (name, desc, price, unit, image, stock, customFields, timestamps, state)', cat.n === 0, `mismatching rows=${cat.n}`);
    const ret = await one(`SELECT count(*)::int AS n FROM g4d_retail_products rp JOIN "Vendor" v ON v.id = rp."vendorId" JOIN "VendorProduct" vp ON vp.id = rp.id AND vp."sourceModel" = 'retail_product'
      WHERE ${W} AND NOT (vp.name = rp.name AND vp."vendorId" = rp."vendorId" AND vp.sku IS NOT DISTINCT FROM rp.sku AND vp."priceAmount" = rp.price
        AND vp."stockQty" = rp."stockQty" AND vp."reorderLevel" = rp."reorderLevel" AND vp."createdAt" = rp."createdAt"
        AND vp.status = (CASE WHEN rp.active THEN 'active' ELSE 'inactive' END)
        AND (NULLIF(btrim(rp.category), '') IS NULL OR vp."categoryId" IS NOT NULL))`);
    check('RetailProduct fields preserved (name, sku, price, stock, reorder level, category link, state)', ret.n === 0, `mismatching rows=${ret.n}`);

    // 3. Copies are invisible to every live reader
    const vis = await one(`SELECT count(*)::int AS n FROM "VendorProduct" vp JOIN "Vendor" v ON v.id = vp."vendorId" WHERE vp."sourceModel" IS NOT NULL AND vp.active = true AND ${W}`);
    check('No migrated row is active=true (live storefront/checkout/bot output unchanged)', vis.n === 0, `visible copies=${vis.n}`);

    // 4. Integrity of references
    const badOp = await one(`SELECT count(*)::int AS n FROM "VendorProduct" vp WHERE vp."operationKey" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM g4d_operation_types o WHERE o.key = vp."operationKey")`);
    check('operationKey values all resolve to the Operation Registry', badOp.n === 0, `dangling=${badOp.n}`);
    const badCat = await one(`SELECT count(*)::int AS n FROM "VendorProduct" vp WHERE vp."categoryId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM g4d_categories c WHERE c.id = vp."categoryId" AND c."vendorId" = vp."vendorId")`);
    check('categoryId always points at a category of the SAME vendor', badCat.n === 0, `cross-vendor/dangling=${badCat.n}`);
    const rec = await one(`SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "VendorProduct" vp WHERE vp.id = r."catalogItemId"))::int AS unresolved
      FROM g4d_records r JOIN "Vendor" v ON v.id = r."vendorId" WHERE r."catalogItemId" IS NOT NULL AND ${W}`);
    check('Every Record.catalogItemId in scope resolves to a unified row (cutover can repoint 1:1)', rec.unresolved === 0, `records=${rec.total} unresolved=${rec.unresolved}`);

    // 5. Existing rows
    const ex = await one(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE "industryType" IS NULL)::int AS no_industry,
        count(*) FILTER (WHERE price ~ '${S.NUM_RE}' AND "priceAmount" IS NULL)::int AS price_gap
      FROM "VendorProduct" vp JOIN "Vendor" v ON v.id = vp."vendorId" WHERE vp."sourceModel" IS NULL AND ${W}`);
    check('Existing VendorProduct rows: industryType filled', ex.no_industry === 0, `rows=${ex.total} missing=${ex.no_industry}`);
    check('Existing VendorProduct rows: numeric price parsed into priceAmount', ex.price_gap === 0, `gaps=${ex.price_gap}`);

    // 6. Old tables untouched (informational — this tooling never writes them)
    const old = await one(`SELECT (SELECT count(*)::int FROM g4d_catalog_items) AS catalog_items, (SELECT count(*)::int FROM g4d_retail_products) AS retail_products`);
    console.log(`\ninfo  old tables still intact: g4d_catalog_items=${old.catalog_items}, g4d_retail_products=${old.retail_products}`);

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${failed.length ? `FAILED: ${failed.length} of ${results.length} checks` : `ALL CHECKS PASSED (${results.length})`}`);
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
