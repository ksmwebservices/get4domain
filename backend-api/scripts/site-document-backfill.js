#!/usr/bin/env node
'use strict';
/**
 * Website Manager backfill (KSM runs this on the VM). Puts into Website Manager what a vendor's public site already shows, so nothing changes visually.
 *
 *   node scripts/site-document-backfill.js                              DRY RUN for every vendor with a subdomain: writes NOTHING
 *   node scripts/site-document-backfill.js --vendor allwintours         DRY RUN for one vendor
 *   SITE_DOC_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/site-document-backfill.js --vendor allwintours --apply
 *   SITE_DOC_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/site-document-backfill.js --vendor allwintours --rollback --apply     (undo exactly what apply did)
 *
 * Only EMPTY fields are filled; a value a vendor typed is never overwritten. --apply requires --vendor (one vendor at a time). The vendor is NOT switched
 * to the new editor by this script: that is scripts/site-doc-flag.js. Needs `npx nest build` (it reads dist/).
 */
const fs = require('fs');
const path = require('path');
const { plan, apply, rollback, CONFIRM } = require('./site-document-backfill-lib');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const ROLLBACK = argv.includes('--rollback');
const argOf = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const only = argOf('--vendor');
const line = (s = '') => console.log(s);
const head = (s) => { line(); line(`── ${s} ${'─'.repeat(Math.max(0, 70 - s.length))}`); };

if (!process.env.DATABASE_URL) {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(__dirname, '..', name);
    if (!fs.existsSync(file)) continue;
    for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

(async () => {
  if (APPLY && !only) { console.error('--apply needs --vendor <subdomain>: one vendor at a time.'); process.exit(2); }
  if (ROLLBACK && !only) { console.error('--rollback needs --vendor <subdomain>.'); process.exit(2); }
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(2); }
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host; } catch { return 'unknown'; } })();
  line(`Website Manager backfill: ${ROLLBACK ? 'ROLLBACK ' : ''}${APPLY ? 'APPLY' : 'DRY RUN (read-only)'}. Database host: ${host}`);
  const { PrismaService } = require(path.join(__dirname, '..', 'dist', 'src', 'prisma', 'prisma.service'));
  const prisma = new PrismaService();
  await prisma.$connect();
  const seeds = JSON.parse(fs.readFileSync(path.join(__dirname, 'website-manager', 'standalone-seeds.json'), 'utf8'));
  try {
    const vendors = await prisma.vendor.findMany({ where: { subdomain: only ? only : { not: null }, isSandbox: false }, select: { id: true, subdomain: true, industry: true, businessName: true }, orderBy: { subdomain: 'asc' } });
    if (only && vendors.length === 0) { console.error(`No live vendor with subdomain "${only}".`); process.exitCode = 1; return; }
    for (const v of vendors) {
      head(`${v.subdomain} (${v.businessName}, ${v.industry})`);
      const seed = seeds[v.subdomain];
      if (ROLLBACK) {
        line('Would undo: the fields the backfill filled (if still unchanged) and the products it added.');
        if (!APPLY) { line(`DRY RUN: nothing written. To undo:  SITE_DOC_CONFIRM=${CONFIRM} node scripts/site-document-backfill.js --vendor ${v.subdomain} --rollback --apply`); continue; }
        if (process.env.SITE_DOC_CONFIRM !== CONFIRM) { console.error(`ABORT: set SITE_DOC_CONFIRM=${CONFIRM}`); process.exitCode = 2; return; }
        const r = await rollback(prisma, v, seed);
        line(`Rolled back: restored ${r.restored.length ? r.restored.join(', ') : 'no fields'}; removed ${r.products} product(s). ${r.note ?? ''}`);
        continue;
      }
      const p = await plan(prisma, v, seed);
      line(`Source of what the public site shows: ${p.source}`);
      line(`  would FILL (empty today): ${p.fill.length ? p.fill.join(', ') : 'nothing'}`);
      line(`  would KEEP (vendor already has a value): ${p.keep.length ? p.keep.join(', ') : 'nothing'}${p.differs.length ? `  (the old public site says something different for: ${p.differs.join(', ')}; the vendor's value stays)` : ''}`);
      line(`  would ADD products: ${p.addProducts}`);
      for (const n of p.notes) line(`  note: ${n}`);
      if (!APPLY) continue;
      if (process.env.SITE_DOC_CONFIRM !== CONFIRM) { console.error(`ABORT: set SITE_DOC_CONFIRM=${CONFIRM}`); process.exitCode = 2; return; }
      const r = await apply(prisma, v, seed, p);
      line(`APPLIED: filled ${r.filled.length ? r.filled.join(', ') : 'nothing'}; added ${r.products} product(s).`);
      line(`Undo with: SITE_DOC_CONFIRM=${CONFIRM} node scripts/site-document-backfill.js --vendor ${v.subdomain} --rollback --apply`);
    }
    if (!APPLY && !ROLLBACK) { head('DRY RUN COMPLETE'); line(`Nothing was written. To apply for one vendor: SITE_DOC_CONFIRM=${CONFIRM} node scripts/site-document-backfill.js --vendor <subdomain> --apply`); }
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error(e); process.exit(1); });
