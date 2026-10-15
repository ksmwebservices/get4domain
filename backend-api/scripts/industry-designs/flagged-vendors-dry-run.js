#!/usr/bin/env node
'use strict';
/**
 * READ ONLY. For every vendor that is on the new Website Manager (add-on `site_doc_v2`), reports what the industry designs would mean for that vendor:
 * its category, whether that category has designs, which design it would start on, whether its site already holds starter content, and what "Reset to starter"
 * would fill. It has NO apply mode: nothing is ever changed automatically. Vendors that are not on the flag are not looked at and are never touched.
 *
 *   node scripts/industry-designs/flagged-vendors-dry-run.js            (needs `npx nest build`)
 *   node scripts/industry-designs/flagged-vendors-dry-run.js --json
 */
const fs = require('fs');
const path = require('path');
const BE = path.join(__dirname, '..', '..');
const JSON_OUT = process.argv.includes('--json');
const line = (s = '') => { if (!JSON_OUT) console.log(s); };

/** The pure part, also used by the tests: what would change for one vendor. */
function report(vendor, cms, products, packs) {
  const ind = (vendor.industry || '').toLowerCase();
  const byKey = (k) => packs.find((p) => p.key === k && p.enabled);
  const pack = byKey(cms && cms.packKey) || byKey(ind) || packs.find((p) => p.enabled && (p.config.keywords || []).some((w) => w.toLowerCase() === ind));
  const out = { subdomain: vendor.subdomain, name: vendor.businessName, industry: vendor.industry, category: pack ? pack.key : null, family: pack && pack.config ? pack.config.family || null : null, notes: [], wouldChange: [] };
  if (!pack) { out.notes.push('No category matches this vendor industry: no designs apply. Nothing would change.'); return out; }
  const designs = (pack.config.designs || []).filter((d) => d.enabled !== false);
  if (!designs.length) { out.notes.push('The category has no designs yet (run Add starter packs in Admin, Category packs). Nothing would change.'); return out; }
  const extras = (cms && cms.extras) || {};
  const sample = extras.sample || {};
  const have = cms && cms.designKey && designs.some((d) => d.key === cms.designKey);
  out.currentDesign = (cms && cms.designKey) || null;
  out.designs = designs.map((d) => d.name);
  if (!have) {
    const def = designs.find((d) => d.key === pack.config.defaultDesign) || designs[0];
    out.wouldChange.push(`would use the default design "${def.name}" (the public page changes layout when designs arrive for a vendor on the flag)`);
  }
  if (ind && pack.key !== ind && !(pack.config.keywords || []).some((w) => w.toLowerCase() === ind)) out.notes.push(`The vendor industry is "${vendor.industry}" but the category found is "${pack.key}".`);
  const empty = [];
  if (!(cms && cms.tagline)) empty.push('tagline');
  if (!(cms && cms.about)) empty.push('about');
  if (!(cms && cms.banner)) empty.push('banner');
  if (!extras.headline) empty.push('headline');
  if (!(extras.faq || []).length) empty.push('questions');
  if (!(products || []).length) empty.push('items');
  out.hasStarterContent = Object.values(sample).some(Boolean);
  out.items = (products || []).length;
  if (empty.length) out.wouldChange.push(`"Reset to starter" (a button the vendor presses; never automatic) would fill: ${empty.join(', ')}. It never overwrites what the vendor wrote.`);
  else out.notes.push('Nothing is empty: Reset to starter would change nothing.');
  if (!out.wouldChange.length) out.notes.push('Nothing would change.');
  return out;
}
module.exports = { report };

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
    if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(2); }
    const { PrismaService } = require(path.join(BE, 'dist', 'src', 'prisma', 'prisma.service'));
    const prisma = new PrismaService();
    await prisma.$connect();
    try {
      const flagged = await prisma.vendorAddon.findMany({ where: { addonKey: 'site_doc_v2', enabled: true }, select: { vendorId: true } });
      const packs = await prisma.categoryPack.findMany();
      const all = [];
      line(`Vendors on the new Website Manager: ${flagged.length}. READ ONLY: nothing is written.`);
      for (const f of flagged) {
        const vendor = await prisma.vendor.findUnique({ where: { id: f.vendorId }, select: { subdomain: true, businessName: true, industry: true, isSandbox: true } });
        if (!vendor || vendor.isSandbox) continue;
        const cms = await prisma.vendorCMS.findUnique({ where: { vendorId: f.vendorId } });
        const products = await prisma.vendorProduct.findMany({ where: { vendorId: f.vendorId }, select: { id: true } });
        const r = report(vendor, cms, products, packs);
        all.push(r);
        line(`\n${r.name} (${r.subdomain}), industry ${r.industry}, category ${r.category || 'none'}${r.family ? ` (${r.family})` : ''}`);
        if (r.designs) line(`  designs: ${r.designs.join(', ')}; current: ${r.currentDesign || 'none chosen'}; starter content: ${r.hasStarterContent ? 'yes' : 'no'}; items: ${r.items}`);
        for (const w of r.wouldChange) line(`  would change: ${w}`);
        for (const n of r.notes) line(`  note: ${n}`);
      }
      if (JSON_OUT) console.log(JSON.stringify(all, null, 2));
      else line('\nNothing was written. Vendors that are not on the flag were not read.');
    } finally { await prisma.$disconnect(); }
  })().catch((e) => { console.error(e); process.exit(1); });
}
