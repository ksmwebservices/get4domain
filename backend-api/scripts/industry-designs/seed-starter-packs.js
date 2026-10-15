#!/usr/bin/env node
'use strict';
/**
 * Creates the 24 starter categories (flow family, four designs, starter content) that are missing, and ADDS the family, designs and starter content to an older pack that
 * has none. Anything an admin edited is kept. The same as the "Add starter packs" button in Admin, Category packs: use whichever you like.
 *
 *   node scripts/industry-designs/seed-starter-packs.js            DRY RUN: says what it would create and upgrade, writes nothing
 *   SITE_DOC_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/industry-designs/seed-starter-packs.js --apply
 * Safe to run again. Needs `npx nest build`. Touches only the table g4d_category_packs; no vendor, site or item is read or written.
 */
const fs = require('fs');
const path = require('path');
const BE = path.join(__dirname, '..', '..');
const CONFIRM = 'I_HAVE_READ_THE_DRY_RUN';
const APPLY = process.argv.includes('--apply');
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
  if (APPLY && process.env.SITE_DOC_CONFIRM !== CONFIRM) { console.error(`ABORT: set SITE_DOC_CONFIRM=${CONFIRM}`); process.exit(2); }
  const { PrismaService } = require(path.join(BE, 'dist', 'src', 'prisma', 'prisma.service'));
  const { planStarterSeed } = require(path.join(BE, 'dist', 'src', 'site-doc', 'industry-seeds'));
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const plan = planStarterSeed(await prisma.categoryPack.findMany({ select: { key: true, config: true } }));
    console.log(`Would create ${plan.create.length}: ${plan.create.map((p) => p.key).join(', ') || '-'}`);
    console.log(`Would add designs and starter content to ${plan.upgrade.length} older pack(s): ${plan.upgrade.map((p) => p.key).join(', ') || '-'}`);
    console.log(`Already complete and left alone: ${plan.kept}`);
    if (!APPLY) { console.log('\nDRY RUN: nothing written. Add --apply with SITE_DOC_CONFIRM=' + CONFIRM + ' to do it.'); return; }
    for (const p of plan.create) await prisma.categoryPack.create({ data: { key: p.key, name: p.name, config: p.config, createdBy: 'seed-starter-packs' } });
    for (const p of plan.upgrade) await prisma.categoryPack.update({ where: { key: p.key }, data: { config: p.config } });
    const after = planStarterSeed(await prisma.categoryPack.findMany({ select: { key: true, config: true } }));
    console.log(after.create.length === 0 && after.upgrade.length === 0 ? `\nPASS: all ${after.kept} starter categories are in place.` : '\nFAIL: read-back still shows work to do.');
    if (after.create.length || after.upgrade.length) process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})().catch((e) => { console.error(e); process.exit(1); });
