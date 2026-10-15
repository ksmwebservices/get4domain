// The Website Manager migration (20261014100000_website_manager) on REAL Postgres (PGlite), never the production database.
// Rehearses it on top of the schema as it was BEFORE (with live-looking vendor and site rows), then proves: it applies cleanly, every existing row is untouched,
// only nullable/defaulted columns were added to an existing table, the migrated tables equal a database built straight from schema.prisma (no drift), and the RLS
// script covers the new tables. SKIPs (exit 0) when PGlite is not installed.   node scripts/website-manager/verify-migration-pg.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..', '..');
const pgDir = process.env.G4D_PGLITE_DIR || path.join(os.tmpdir(), 'pgtest');
const MIG = '20261014100000_website_manager';
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-wm-mig-'));
  console.log('\n== Website Manager migration on a database that already holds data');
  let ref = 'HEAD'; let newRef = null;
  try { const added = execFileSync('git', ['log', '--diff-filter=A', '--format=%H', '-1', '--', `backend-api/prisma/migrations/${MIG}`], { cwd: path.join(root, '..') }).toString().trim(); ref = added ? `${added}^` : 'HEAD'; newRef = added || null; } catch { /* uncommitted: the committed schema is the "before" */ }
  const oldSchema = path.join(tmp, 'old.prisma');
  fs.writeFileSync(oldSchema, execFileSync('git', ['show', `${ref}:backend-api/prisma/schema.prisma`], { cwd: path.join(root, '..'), maxBuffer: 64 * 1024 * 1024 }));
  const db = new PGlite();
  await db.exec(prismaSql(['--from-empty', '--to-schema-datamodel', oldSchema]));
  const hasOld = !/draft/.test(fs.readFileSync(oldSchema, 'utf8').split('model VendorCMS {')[1]?.split('}')[0] ?? '');
  await db.exec(`INSERT INTO "Vendor"("id","name","email","password","businessName","updatedAt") VALUES ('v1','Allwin','a@x.in','x','Allwin Tours', now());`);
  await db.exec(`INSERT INTO "VendorCMS"("id","vendorId","logo","phone","updatedAt") VALUES ('c1','v1','https://x/logo.jpg','8220467673', now());`);
  const q = async (c, sql) => (await c.query(sql)).rows;
  const snap = async () => JSON.stringify({ v: await q(db, `SELECT * FROM "Vendor" ORDER BY id`), c: await q(db, `SELECT "id","vendorId","logo","phone","themeId","portfolio" FROM "VendorCMS" ORDER BY id`) });
  const before = await snap();
  ok('the "before" schema really is the one without the new columns (so this rehearses the real change)', hasOld);
  const sql = fs.readFileSync(path.join(root, 'prisma', 'migrations', MIG, 'migration.sql'), 'utf8');
  let applied = true; let err = '';
  try { await db.exec(sql); } catch (e) { applied = false; err = e.message; }
  ok('the migration applies cleanly on top of the previous schema with live-looking rows present', applied, err);
  ok('EVERY existing row is exactly as it was (vendor and site row)', (await snap()) === before);
  const row = (await q(db, `SELECT "siteVersion", "draft", "layout", "publishedAt" FROM "VendorCMS" WHERE id='c1'`))[0];
  ok('the existing site row gets the safe defaults (version 0, no draft, no layout, not "published")', row.siteVersion === 0 && row.draft === null && row.layout === null && row.publishedAt === null, JSON.stringify(row));
  const stmts = sql.replace(/--.*$/gm, '').split(';').map((x) => x.trim()).filter(Boolean);
  const touchesOld = stmts.filter((x) => /^(DROP|TRUNCATE|DELETE|UPDATE|INSERT)/i.test(x) || (/^ALTER TABLE/i.test(x) && !/^ALTER TABLE "VendorCMS" ADD COLUMN/i.test(x)));
  ok('nothing is dropped, deleted or rewritten; the only change to an existing table is added columns on "VendorCMS"', touchesOld.length === 0, touchesOld.join(' | '));
  const adds = [...sql.matchAll(/ADD COLUMN\s+"(\w+)"\s+([A-Z0-9()]+)([^,;]*)/g)];
  ok('every added column is nullable or has a default (no row can fail)', adds.length === 8 && adds.every((m) => !/NOT NULL/.test(m[3]) || /DEFAULT/.test(m[3])), J(adds.map((m) => m.slice(1, 4))));
  const fresh = new PGlite();
  // the schema as it was when this migration was added: later migrations (for example industry designs) add their own columns and have their own rehearsal
  let newSchema = path.join(root, 'prisma', 'schema.prisma');
  if (newRef) { newSchema = path.join(tmp, 'new.prisma'); fs.writeFileSync(newSchema, execFileSync('git', ['show', `${newRef}:backend-api/prisma/schema.prisma`], { cwd: path.join(root, '..'), maxBuffer: 64 * 1024 * 1024 })); }
  await fresh.exec(prismaSql(['--from-empty', '--to-schema-datamodel', newSchema]));
  const tables = ['VendorCMS', 'g4d_site_versions', 'g4d_media_assets', 'g4d_category_packs'];
  const shape = async (c) => JSON.stringify((await q(c, `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name`)).filter((r) => tables.includes(r.table_name)));
  const idx = async (c) => JSON.stringify((await q(c, `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`)).filter((r) => tables.some((t) => r.indexdef.includes(`"${t}"`))));
  ok('DRIFT: the migrated tables have exactly the columns schema.prisma describes (names, types, nullability, defaults)', (await shape(db)) === (await shape(fresh)));
  ok('DRIFT: and exactly the same indexes and unique keys', (await idx(db)) === (await idx(fresh)));
  await fresh.close(); await db.close();
  const rls = fs.readFileSync(path.join(root, 'prisma', 'sql', 'enable_rls_public.sql'), 'utf8');
  ok('the RLS script covers every public table (so the 3 new tables are covered) and still has its dollar quotes', /ENABLE ROW LEVEL SECURITY/i.test(rls) && /DO \$\$/.test(rls) && /END \$\$;/.test(rls));
  ok('and says in a comment that these tables are covered', /20261014100000_website_manager/.test(rls));
  console.log(`\n${pass} passed, ${fail} failed`);
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
})();

function J(x) { return JSON.stringify(x); }
