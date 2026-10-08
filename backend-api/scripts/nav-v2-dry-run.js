#!/usr/bin/env node
'use strict';
/**
 * Dashboard v2 dry run — READ-ONLY. For every vendor: plan, profile, modules on, what the v2 menu would show, and the
 * "would lose access" list (modules they use that v2 would not offer). Writes ONE report file under docs/v2/evidence/ and nothing to the database.
 *
 *   node scripts/nav-v2-dry-run.js            (needs `npx nest build`; reads DATABASE_URL from the environment or backend-api/.env)
 */
const path = require('path');
const fs = require('fs');
const { analyseVendor, renderReport } = require('./nav-v2-dry-run-lib');
const dist = (p) => require(path.join(__dirname, '..', 'dist', 'src', p));

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
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (export it from backend-api/.env first).'); process.exit(2); }
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host; } catch { return 'unknown'; } })();
  const { PrismaService } = dist('prisma/prisma.service');
  const reg = dist('registry/registry.generated');
  const { AVAILABLE_MODULES, NAV_V2_DEFAULT_FROM } = dist('addons/addons.constants');
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const vendors = await prisma.vendor.findMany({ where: { role: 'VENDOR' }, select: { id: true, subdomain: true, businessName: true, industry: true, createdAt: true, status: true, isSandbox: true }, orderBy: { createdAt: 'asc' } });
    const results = [];
    for (const v of vendors) results.push(await analyseVendor(prisma, reg, AVAILABLE_MODULES, v, NAV_V2_DEFAULT_FROM));
    const report = renderReport(results, { at: new Date().toISOString(), host });
    const dir = path.join(__dirname, '..', '..', 'docs', 'v2', 'evidence');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `nav-v2-dry-run-${new Date().toISOString().slice(0, 10)}.md`);
    fs.writeFileSync(file, report);
    console.log(report);
    console.log(`Report written to ${file}`);
    const blocked = results.filter((r) => r.wouldLose.length).length;
    process.exitCode = blocked ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
