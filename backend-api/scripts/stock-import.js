#!/usr/bin/env node
'use strict';
/**
 * Import legacy stock (opening balances and movements) of ONE business into the STAGING ledger. STAGING ONLY: the connection comes from the staging guard, which refuses anything that is not the
 * allow-listed staging project. A DRY RUN by default; nothing is written without --apply. Safe to run twice: every row is keyed by its source id, so a second run changes nothing.
 *
 *   node scripts/stock-import.js --vendor <vendorId> --file <rows.json>            dry run: what would be imported, what is rejected
 *   node scripts/stock-import.js --vendor <vendorId> --file <rows.json> --apply    write it, then print the count-and-total comparison
 *
 * The file is a JSON array of { sourceId, sku, kind: "OPENING" | "MOVEMENT", qty, note? }. A SKU must already exist as a product or variant of that business (the store catalogue is loaded first).
 * Needs `npx nest build` first (it uses the compiled service). A row for an unknown SKU, or a movement that would take stock below zero, is rejected with its reason. Output never contains a
 * connection string.
 */
const fs = require('fs');
const path = require('path');
const { loadStagingEnv } = require('./staging/guard');

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const APPLY = argv.includes('--apply');
const BACKEND = path.resolve(__dirname, '..');

(async () => {
  const vendorId = arg('--vendor'); const file = arg('--file');
  if (!vendorId || !file) { console.error('Usage: node scripts/stock-import.js --vendor <vendorId> --file <rows.json> [--apply]'); process.exit(2); }
  let rows;
  try { rows = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); } catch { console.error('The file is not readable JSON.'); process.exit(2); }
  if (!Array.isArray(rows)) { console.error('The file must hold a JSON array of rows.'); process.exit(2); }

  const env = loadStagingEnv();
  const dist = (p) => require(path.join(BACKEND, 'dist/src/v3-store', p));
  const { StoreService } = dist('store.service');
  const { PrismaStoreStore } = dist('prisma-store.store');
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  try {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!vendor) { console.error('No such business on staging.'); process.exit(2); }
    const svc = new StoreService(new PrismaStoreStore(prisma), { activeRates: async () => [] }, { methods: async () => [] });
    const r = await svc.importStock(vendorId, rows, APPLY);
    console.log(APPLY ? 'APPLIED to staging.' : 'DRY RUN (nothing written). Add --apply to write.');
    console.log(`  read ${r.read}  rejected ${r.rejected.length}  already applied ${r.alreadyApplied}  to apply ${r.toApply}  applied ${r.applied}`);
    for (const x of r.rejected.slice(0, 50)) console.log(`  rejected row ${x.index}: ${x.reason}`);
    console.log(`  file totals      rows ${r.sourceTotals.rows}  quantity ${r.sourceTotals.quantity}  skus ${r.sourceTotals.skus}`);
    if (r.databaseTotals) {
      console.log(`  database totals  rows ${r.databaseTotals.rows}  quantity ${r.databaseTotals.quantity}  skus ${r.databaseTotals.skus}`);
      console.log(r.comparison.ok ? '  COMPARISON OK: counts and totals match.' : `  COMPARISON DIFFERS: rows ${r.comparison.rowsMatch ? 'match' : 'differ'}, quantity ${r.comparison.quantityMatch ? 'matches' : 'differs'}, skus ${r.comparison.skusMatch ? 'match' : 'differ'}.`);
      if (!r.comparison.ok) process.exitCode = 3;
    }
  } catch (e) {
    console.error('ERROR:', env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
