#!/usr/bin/env node
'use strict';
/**
 * Load the Banner Library from a folder of images plus a manifest into the STAGING database. STAGING ONLY: the connection comes from the staging guard.
 * A DRY RUN by default; nothing is written without --apply. Safe to run twice. Nothing is ever deleted.
 *
 *   node scripts/banner-library-load.js --dir <folder> [--manifest <file>]           dry run
 *   node scripts/banner-library-load.js --dir <folder> [--manifest <file>] --apply   write it
 *
 * The folder and the manifest are supplied by the owner's team (this script never downloads anything). The manifest is a JSON list with one row per image:
 *   { "file", "sourceUrl", "author", "licence", "obtainedOn" (YYYY-MM-DD), "category" (a kit category id), "alt", "hasPeople" (true or false) }
 * An image with no manifest row is refused. Any manifest error loads nothing. Needs `npm run build` first. --apply needs picture storage to be switched on
 * (a later release binds the real adapter; until then --apply stops with STORAGE_NOT_CONFIGURED and writes nothing). Output never contains a connection string.
 */
const fs = require('fs');
const path = require('path');
const { loadStagingEnv } = require('./staging/guard');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const BACKEND = path.resolve(__dirname, '..');

(async () => {
  const dir = arg('--dir');
  if (!dir || !fs.existsSync(dir)) { console.error('Give --dir <folder with the images>.'); process.exit(2); }
  const manifestPath = arg('--manifest') || path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) { console.error(`No manifest at ${manifestPath}.`); process.exit(2); }
  const env = loadStagingEnv();
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  const { runBannerLoad } = dist('v3-website/media/banner-loader');
  const { PrismaMediaStore } = dist('v3-website/media/media.store');
  const { SharpImagePort, UnconfiguredMediaStorage } = dist('v3-website/media/media.ports');
  const { loadKit } = dist('site-publish/renderer/renderer-loader');
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));

  const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort().map((name) => ({ name, bytes: fs.readFileSync(path.join(dir, name)) }));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  try {
    const row = await prisma.v3PlanSetting.findUnique({ where: { key: 'mediaMaxPixels' } });
    const maxPixels = row && Number.isInteger(row.valueJson) && row.valueJson >= 1 ? row.valueJson : null;
    const report = await runBannerLoad(
      { store: new PrismaMediaStore(prisma), storage: new UnconfiguredMediaStorage(), image: new SharpImagePort() },
      { files, manifest, categories: loadKit().CATEGORIES.map((c) => c.id), today: new Date().toISOString().slice(0, 10), maxPixels, apply: APPLY },
    );
    console.log(APPLY ? 'APPLIED to staging.' : 'DRY RUN (nothing written). Add --apply to write.');
    if (report.errors.length) { console.error('Nothing was loaded:\n - ' + report.errors.join('\n - ')); process.exitCode = 2; return; }
    console.log(`  would create ${report.created.length}, update ${report.updated.length}, unchanged ${report.unchanged.length}, refused ${report.refused.length}`);
    for (const r of report.refused) console.log(`  refused ${r.file}: ${r.reason}`);
    for (const f of report.rowsWithoutFile) console.log(`  manifest row without a file: ${f}`);
  } catch (e) {
    const code = e && e.response && e.response.code;
    console.error('ERROR:', code || env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
