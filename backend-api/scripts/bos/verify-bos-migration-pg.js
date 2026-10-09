// Full BOS migration 20261009180000_bos_spine on REAL Postgres (PGlite), never the production database.
// Rehearses the migration on top of the schema as it was BEFORE it (with live-looking rows in the tables it touches), then proves:
//   - it applies cleanly and every existing row is untouched,
//   - the migrated database equals a database built straight from schema.prisma (columns, defaults, indexes): no drift,
//   - the RLS script covers every new table.
// SKIPs (exit 0) when PGlite is not installed.   node scripts/bos/verify-bos-migration-pg.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..', '..');
const pgDir = process.env.G4D_PGLITE_DIR || path.join(os.tmpdir(), 'pgtest');
const MIGRATION = '20261009180000_bos_spine';
let pass = 0; let fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 300)}` : ''}`); } };

async function load(mod) {
  const dir = path.join(pgDir, 'node_modules', ...mod.split('/'));
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const entry = (pkg.exports && pkg.exports['.'] && (pkg.exports['.'].import?.default ?? pkg.exports['.'].import ?? pkg.exports['.'].default)) || pkg.module || pkg.main;
  return import(pathToFileURL(path.join(dir, typeof entry === 'string' ? entry : (entry.default ?? entry.import))).href);
}
const prismaSql = (args) => execFileSync(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'diff', ...args, '--script'], { cwd: root, env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: 'true' }, maxBuffer: 64 * 1024 * 1024 }).toString();

(async () => {
  let pglite;
  try { pglite = await load('@electric-sql/pglite'); } catch (e) { console.log(`SKIP  PGlite not found under ${pgDir} (set G4D_PGLITE_DIR): ${e.message}`); process.exit(0); }
  const { PGlite } = pglite;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-bos-mig-'));
  console.log(`\n== MIGRATION ${MIGRATION} on a database that already holds data`);
  const migration = fs.readFileSync(path.join(root, 'prisma', 'migrations', MIGRATION, 'migration.sql'), 'utf8');
  let ref = 'HEAD';
  try { const added = execFileSync('git', ['log', '--diff-filter=A', '--format=%H', '-1', '--', `prisma/migrations/${MIGRATION}`], { cwd: root }).toString().trim(); if (added) ref = `${added}^`; } catch { /* uncommitted */ }
  const oldSchema = path.join(tmp, 'old.prisma');
  fs.writeFileSync(oldSchema, execFileSync('git', ['show', `${ref}:backend-api/prisma/schema.prisma`], { cwd: root, maxBuffer: 64 * 1024 * 1024 }));
  const db = new PGlite();
  await db.exec(prismaSql(['--from-empty', '--to-schema-datamodel', oldSchema]));
  await db.exec(`INSERT INTO "Vendor"("id","name","email","password","businessName","updatedAt") VALUES ('v1','Suresh','s@x.in','x','Step N Rock', now());`);
  await db.exec(`INSERT INTO g4d_contacts("id","vendorId","name","phone","updatedAt") VALUES ('c1','v1','Old customer','9000000001', now());`);
  await db.exec(`INSERT INTO "VendorProduct"("id","vendorId","name","stockQty","trackStock","updatedAt") VALUES ('p1','v1','Runner shoe', 7, true, now());`);
  await db.exec(`INSERT INTO g4d_stock_movements("id","vendorId","productId","delta","reason","balanceAfter","idempotencyKey") VALUES ('m1','v1','p1',7,'OPENING',7,'k1');`);
  let applied = true; let err = '';
  try { await db.exec(migration); } catch (e) { applied = false; err = e.message; }
  ok('the migration applies cleanly on top of the previous schema, with a vendor, a customer, a product and its stock movement present', applied, err);
  const q = async (c, sql) => (await c.query(sql)).rows;
  const prod = (await q(db, `SELECT "stockQty","trackStock","hsn","gstRate","purchasePriceAmount" FROM "VendorProduct" WHERE id='p1'`))[0];
  ok('the existing product is untouched; the new item columns are NULL', prod.stockQty === 7 && prod.trackStock === true && prod.hsn === null && prod.gstRate === null && prod.purchasePriceAmount === null, JSON.stringify(prod));
  const mv = (await q(db, `SELECT delta,"balanceAfter","variantKey","locationId" FROM g4d_stock_movements WHERE id='m1'`))[0];
  ok('the existing stock movement is untouched; variant and location are NULL (= the product total, the default place)', mv.delta === 7 && mv.balanceAfter === 7 && mv.variantKey === null && mv.locationId === null);
  const ct = (await q(db, `SELECT name,"gstin","state","shippingAddress","openingBalancePaise" FROM g4d_contacts WHERE id='c1'`))[0];
  ok('the existing customer is untouched; GSTIN / state NULL and opening balance 0', ct.name === 'Old customer' && ct.gstin === null && ct.state === null && Number(ct.openingBalancePaise) === 0, JSON.stringify(ct));
  ok('the new BOS tables exist and are empty', (await q(db, `SELECT count(*)::int AS n FROM g4d_bos_documents`))[0].n === 0 && (await q(db, `SELECT count(*)::int AS n FROM g4d_bos_journal_entries`))[0].n === 0);

  const fresh = new PGlite();
  await fresh.exec(prismaSql(['--from-empty', '--to-schema-datamodel', path.join(root, 'prisma', 'schema.prisma')]));
  const shape = async (c) => JSON.stringify(await q(c, `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name`));
  const idx = async (c) => JSON.stringify(await q(c, `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`));
  const a = await shape(db); const b = await shape(fresh);
  ok('DRIFT: the migrated database has exactly the columns schema.prisma describes (every table: names, types, nullability, defaults)', a === b, a === b ? '' : 'differs');
  const ia = await idx(db); const ib = await idx(fresh);
  ok('DRIFT: and exactly the same indexes and unique keys', ia === ib, ia === ib ? '' : 'differs');
  await fresh.close(); await db.close();

  console.log('\n== RLS script');
  const rls = fs.readFileSync(path.join(root, 'prisma', 'sql', 'enable_rls_public.sql'), 'utf8');
  const tables = [...migration.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]);
  ok(`the RLS script is written for every new table (${tables.length}) or enables RLS on all public tables`, tables.length > 0 && (tables.every((t) => rls.includes(t)) || /pg_tables|information_schema|FOR\s+r\s+IN/i.test(rls)), tables.filter((t) => !rls.includes(t)).join(','));
  console.log(`\n${pass} passed, ${fail} failed`);
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
})();
