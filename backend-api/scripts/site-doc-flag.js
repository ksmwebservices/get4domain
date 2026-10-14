#!/usr/bin/env node
'use strict';
/**
 * Switch the NEW Website Manager (draft, preview, publish, versions, themes and layouts, the new public renderer) on or off for ONE vendor.
 *
 *   node scripts/site-doc-flag.js --on  --vendor <subdomain>            DRY RUN
 *   SITE_DOC_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/site-doc-flag.js --on  --vendor <subdomain> --apply
 *   (use --off to put the vendor back on the old editor and the old public renderer; nothing is deleted)
 *
 * Changes only the `site_doc_v2` add-on row of the named vendor. Same pattern as set-vendor-access.js (--nav-v2). Needs `npx nest build`.
 */
const fs = require('fs');
const path = require('path');
const CONFIRM = 'I_HAVE_READ_THE_DRY_RUN';
const argv = process.argv.slice(2);
const argOf = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const line = (s = '') => console.log(s);
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
  const on = argv.includes('--on'); const off = argv.includes('--off');
  const sub = argOf('--vendor');
  if (on === off) { console.error('Say --on or --off.'); process.exit(2); }
  if (!sub || sub.startsWith('--')) { console.error('--vendor <subdomain> is required: one vendor at a time.'); process.exit(2); }
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(2); }
  const APPLY = argv.includes('--apply');
  const { PrismaService } = require(path.join(__dirname, '..', 'dist', 'src', 'prisma', 'prisma.service'));
  const { SITE_FLAG_ADDON } = require(path.join(__dirname, '..', 'dist', 'src', 'site-doc', 'site-doc.constants'));
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const v = await prisma.vendor.findUnique({ where: { subdomain: sub }, select: { id: true, businessName: true, isSandbox: true } });
    if (!v) { console.error(`No vendor with subdomain "${sub}".`); process.exitCode = 1; return; }
    const cur = await prisma.vendorAddon.findUnique({ where: { vendorId_addonKey: { vendorId: v.id, addonKey: SITE_FLAG_ADDON } } });
    const now = cur?.enabled === true;
    line(`${v.businessName} (${sub}): the new Website Manager is currently ${now ? 'ON' : 'OFF'}; you asked for ${on ? 'ON' : 'OFF'}.`);
    if (now === on) { line('Nothing to change.'); return; }
    if (!APPLY) { line(`DRY RUN: nothing written. Add --apply with SITE_DOC_CONFIRM=${CONFIRM} to switch.`); return; }
    if (process.env.SITE_DOC_CONFIRM !== CONFIRM) { console.error(`ABORT: set SITE_DOC_CONFIRM=${CONFIRM}`); process.exitCode = 2; return; }
    await prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId: v.id, addonKey: SITE_FLAG_ADDON } }, create: { vendorId: v.id, addonKey: SITE_FLAG_ADDON, enabled: on }, update: { enabled: on } });
    const after = await prisma.vendorAddon.findUnique({ where: { vendorId_addonKey: { vendorId: v.id, addonKey: SITE_FLAG_ADDON } } });
    line(after?.enabled === on ? `PASS: the new Website Manager is now ${on ? 'ON' : 'OFF'} for ${sub}.` : 'FAIL: read-back does not match.');
    if (after?.enabled !== on) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error(e); process.exit(1); });
