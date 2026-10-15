#!/usr/bin/env node
'use strict';
/**
 * Change ONE vendor category (the `industry` value and the category pack its site uses). It changes nothing else: no content, no items, no design, no flag.
 * Then the vendor presses "Reset to starter" in Website Manager to fill what is empty, and publishes.
 *
 *   node scripts/industry-designs/set-vendor-category.js --vendor ksm-webtech-services --category technology            DRY RUN
 *   SITE_DOC_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/industry-designs/set-vendor-category.js --vendor ksm-webtech-services --category technology --apply
 *   rollback: run it again with the previous category (the dry run prints it).
 * Needs `npx nest build`.
 */
const fs = require('fs');
const path = require('path');
const BE = path.join(__dirname, '..', '..');
const CONFIRM = 'I_HAVE_READ_THE_DRY_RUN';
const argv = process.argv.slice(2);
const argOf = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const line = (s = '') => console.log(s);

/** The change itself, shared with the tests. Returns a plain description; writes only when apply is true. */
async function changeCategory(prisma, subdomain, categoryKey, apply) {
  const vendor = await prisma.vendor.findUnique({ where: { subdomain }, select: { id: true, businessName: true, industry: true, isSandbox: true } });
  if (!vendor) throw new Error(`No vendor with subdomain "${subdomain}".`);
  const pack = await prisma.categoryPack.findUnique({ where: { key: categoryKey } });
  if (!pack || !pack.enabled) throw new Error(`No category "${categoryKey}" that is switched on. Run Add starter packs in Admin, Category packs.`);
  const cms = await prisma.vendorCMS.findUnique({ where: { vendorId: vendor.id }, select: { packKey: true } });
  const before = { industry: vendor.industry, packKey: cms ? cms.packKey : null };
  const after = { industry: categoryKey, packKey: categoryKey };
  if (apply) {
    await prisma.vendor.update({ where: { id: vendor.id }, data: { industry: categoryKey } });
    await prisma.vendorCMS.upsert({ where: { vendorId: vendor.id }, create: { vendorId: vendor.id, packKey: categoryKey }, update: { packKey: categoryKey } });
  }
  return { vendor, before, after, packName: pack.name };
}
module.exports = { changeCategory };

if (require.main === module) {
  if (!process.env.DATABASE_URL) {
    for (const name of ['.env', '.env.local']) {
      const file = path.join(BE, name);
      if (!fs.existsSync(file)) continue;
      for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
      }
    }
  }
  (async () => {
    const sub = argOf('--vendor'); const cat = argOf('--category'); const APPLY = argv.includes('--apply');
    if (!sub || !cat || sub.startsWith('--') || cat.startsWith('--')) { console.error('--vendor <subdomain> and --category <key> are required: one vendor at a time.'); process.exit(2); }
    if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(2); }
    if (APPLY && process.env.SITE_DOC_CONFIRM !== CONFIRM) { console.error(`ABORT: set SITE_DOC_CONFIRM=${CONFIRM}`); process.exit(2); }
    const { PrismaService } = require(path.join(BE, 'dist', 'src', 'prisma', 'prisma.service'));
    const prisma = new PrismaService();
    await prisma.$connect();
    try {
      const r = await changeCategory(prisma, sub, cat, APPLY);
      line(`${r.vendor.businessName} (${sub}): industry "${r.before.industry}", site category "${r.before.packKey || 'none'}" -> industry "${r.after.industry}", site category "${r.after.packKey}" (${r.packName}).`);
      line(APPLY ? 'DONE. Nothing else was changed. Now the vendor presses "Reset to starter" in Website Manager, checks the preview and publishes.' : `DRY RUN: nothing written. To undo later run this script again with --category ${r.before.industry}.`);
    } finally { await prisma.$disconnect(); }
  })().catch((e) => { console.error(e.message || e); process.exit(1); });
}
