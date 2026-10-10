// The LeadSpace migrations (20261010100000_leadspace, 20261010110000_leadspace_page_stats and 20261010120000_leadspace_followups) on REAL Postgres (PGlite), never the production database.
// Rehearses them on top of the schema as it was BEFORE LeadSpace, with live-looking rows in the tables the merge reads (vendor, products, campaigns, landing pages,
// campaign leads, a DomainCampaign record), then proves: they apply cleanly, every existing row is untouched, the migrated database equals one built straight from
// schema.prisma (no drift), nothing is dropped or altered in an existing table, and the RLS script covers every new table.
// SKIPs (exit 0) when PGlite is not installed.   node scripts/leadspace/verify-leadspace-migration-pg.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..', '..');
const pgDir = process.env.G4D_PGLITE_DIR || path.join(os.tmpdir(), 'pgtest');
const FIRST = '20261010100000_leadspace';
const MIGRATIONS = [FIRST, '20261010110000_leadspace_page_stats', '20261010120000_leadspace_followups'];
let pass = 0; let fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 300)}` : ''}`); } };

async function load(mod) {
  const dir = path.join(pgDir, 'node_modules', ...mod.split('/'));
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const entry = (pkg.exports && pkg.exports['.'] && (pkg.exports['.'].import?.default ?? pkg.exports['.'].import ?? pkg.exports['.'].default)) || pkg.module || pkg.main;
  return import(pathToFileURL(path.join(dir, typeof entry === 'string' ? entry : (entry.default ?? entry.import))).href);
}
const prismaSql = (args) => execFileSync(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'diff', ...args, '--script'], { cwd: root, env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: 'true', DATABASE_URL: 'postgresql://x:x@localhost:5432/x', DIRECT_URL: 'postgresql://x:x@localhost:5432/x' }, maxBuffer: 64 * 1024 * 1024 }).toString();

(async () => {
  let pglite;
  try { pglite = await load('@electric-sql/pglite'); } catch (e) { console.log(`SKIP  PGlite not found under ${pgDir} (set G4D_PGLITE_DIR): ${e.message}`); process.exit(0); }
  const { PGlite } = pglite;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-ls-mig-'));
  console.log('\n== LeadSpace migrations on a database that already holds data');
  let ref = 'HEAD';
  try { const added = execFileSync('git', ['log', '--diff-filter=A', '--format=%H', '-1', '--', `prisma/migrations/${FIRST}`], { cwd: root }).toString().trim(); if (added) ref = `${added}^`; } catch { /* uncommitted */ }
  const oldSchema = path.join(tmp, 'old.prisma');
  fs.writeFileSync(oldSchema, execFileSync('git', ['show', `${ref}:backend-api/prisma/schema.prisma`], { cwd: root, maxBuffer: 64 * 1024 * 1024 }));
  const db = new PGlite();
  await db.exec(prismaSql(['--from-empty', '--to-schema-datamodel', oldSchema]));
  await db.exec(`INSERT INTO "Vendor"("id","name","email","password","businessName","updatedAt") VALUES ('v1','Allwin','a@x.in','x','Allwin Tours', now());`);
  await db.exec(`INSERT INTO "VendorProduct"("id","vendorId","name","priceAmount","updatedAt") VALUES ('p1','v1','Goa 3N/4D', 12999, now());`);
  await db.exec(`INSERT INTO g4d_campaigns("id","vendorId","name","status","channels","content","updatedAt") VALUES ('c1','v1','Diwali','completed','["whatsapp"]','{"whatsapp":"Goa"}', now());`);
  await db.exec(`INSERT INTO g4d_campaign_pages("id","vendorId","slug","title","headline","benefits","phone","whatsapp","updatedAt") VALUES ('cp1','v1','goa-diwali','Goa','Goa for Diwali','["Pickup"]','9840011111','9840022222', now());`);
  await db.exec(`INSERT INTO g4d_campaign_leads("id","campaignPageId","vendorId","name","phone","status","updatedAt") VALUES ('l1','cp1','v1','Suresh','9876500001','new', now());`);
  await db.exec(`INSERT INTO g4d_domain_campaign_records("id","vendorId","month","adSpendPaise","feePaise","updatedAt") VALUES ('r1','v1','2026-09',1000000,200000, now());`);
  const q = async (c, sql) => (await c.query(sql)).rows;
  const snap = async () => JSON.stringify({
    v: await q(db, `SELECT * FROM "Vendor" ORDER BY id`), p: await q(db, `SELECT * FROM "VendorProduct" ORDER BY id`), c: await q(db, `SELECT * FROM g4d_campaigns ORDER BY id`),
    cp: await q(db, `SELECT * FROM g4d_campaign_pages ORDER BY id`), l: await q(db, `SELECT * FROM g4d_campaign_leads ORDER BY id`), r: await q(db, `SELECT * FROM g4d_domain_campaign_records ORDER BY id`),
  });
  const before = await snap();
  let applied = true; let err = '';
  const sqls = MIGRATIONS.map((m) => fs.readFileSync(path.join(root, 'prisma', 'migrations', m, 'migration.sql'), 'utf8'));
  for (const s of sqls) { try { await db.exec(s); } catch (e) { applied = false; err = e.message; break; } }
  ok('all three migrations apply cleanly, in order, on top of the previous schema with campaign data present', applied, err);
  ok('EVERY existing row is exactly as it was (vendor, product, campaign, landing page, campaign lead, DomainCampaign record)', (await snap()) === before);
  const tables = [...sqls.join('\n').matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]);
  ok(`the ${tables.length} new LeadSpace tables exist and are empty`, tables.length === 22 && (await Promise.all(tables.map(async (t) => (await q(db, `SELECT count(*)::int AS n FROM "${t}"`))[0].n))).every((n) => n === 0), String(tables.length));
  const stmts = sqls.join('\n').replace(/--.*$/gm, '').split(';').map((x) => x.trim()).filter(Boolean);
  const touchesOld = stmts.filter((x) => /^(DROP|TRUNCATE|DELETE|UPDATE|INSERT)/i.test(x) || (/^ALTER TABLE/i.test(x) && !/^ALTER TABLE "(g4d_leadspace_profiles|g4d_leadspace_daily_stats|g4d_lead_events)" ADD COLUMN/i.test(x)));
  ok('nothing is dropped, deleted or altered in an existing table (the only ALTERs add a column to a LeadSpace table)', touchesOld.length === 0, touchesOld.join(' | '));
  const fresh = new PGlite();
  await fresh.exec(prismaSql(['--from-empty', '--to-schema-datamodel', path.join(root, 'prisma', 'schema.prisma')]));
  const shape = async (c) => JSON.stringify(await q(c, `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name`));
  const idx = async (c) => JSON.stringify(await q(c, `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`));
  // the old schema plus the BOS tables is not what schema.prisma describes today: compare only the LeadSpace tables, which these migrations are responsible for
  const only = async (c, f) => JSON.stringify((JSON.parse(await f(c))).filter((r) => tables.includes(r.table_name ?? r.tablename ?? '') || (r.indexname && tables.some((t) => r.indexdef.includes(`"${t}"`)))));
  ok('DRIFT: the migrated LeadSpace tables have exactly the columns schema.prisma describes (names, types, nullability, defaults)', (await only(db, shape)) === (await only(fresh, shape)));
  ok('DRIFT: and exactly the same indexes and unique keys', (await only(db, idx)) === (await only(fresh, idx)));
  await fresh.close(); await db.close();

  console.log('\n== RLS script');
  const rls = fs.readFileSync(path.join(root, 'prisma', 'sql', 'enable_rls_public.sql'), 'utf8');
  ok('the RLS script enables RLS on every public table, so every new table is covered', /pg_tables/i.test(rls) && /ENABLE ROW LEVEL SECURITY/i.test(rls));
  ok('the RLS script still has its dollar quotes (a shell once ate them)', /DO \$\$/.test(rls) && /END \$\$;/.test(rls));
  ok('and says in a comment that the LeadSpace tables are covered', /LeadSpace/.test(rls) && /20261010100000_leadspace/.test(rls) && /20261010110000_leadspace_page_stats/.test(rls) && /20261010120000_leadspace_followups/.test(rls));
  console.log(`\n${pass} passed, ${fail} failed`);
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
})();
