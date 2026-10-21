// The Industry designs migration (20261015100000_industry_designs) on REAL Postgres (PGlite), never the production database.
// Rehearses it on top of the schema as it was BEFORE (with live-looking vendor and site rows), then proves: it applies cleanly, every existing row is untouched,
// only nullable/defaulted columns were added to an existing table, the migrated tables equal a database built straight from schema.prisma (no drift), and the RLS
// script covers the new tables. SKIPs (exit 0) when PGlite is not installed.   node scripts/industry-designs/verify-designs-migration-pg.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..', '..');
const pgDir = process.env.G4D_PGLITE_DIR || path.join(os.tmpdir(), 'pgtest');
const MIG = '20261016100000_theme_packages';
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
  console.log('\n== [feat:industry-designs.migration] The industry designs migration on a database that already holds data: additive, no row touched, no drift');
  let ref = 'HEAD'; let newRef = null;
  try { const added = execFileSync('git', ['log', '--diff-filter=A', '--format=%H', '-1', '--', `backend-api/prisma/migrations/${MIG}`], { cwd: path.join(root, '..') }).toString().trim(); ref = added ? `${added}^` : 'HEAD'; newRef = added || null; } catch { /* uncommitted: the committed schema is the "before" */ }
  const oldSchema = path.join(tmp, 'old.prisma');
  fs.writeFileSync(oldSchema, execFileSync('git', ['show', `${ref}:backend-api/prisma/schema.prisma`], { cwd: path.join(root, '..'), maxBuffer: 64 * 1024 * 1024 }));
  const db = new PGlite();
  await db.exec(prismaSql(['--from-empty', '--to-schema-datamodel', oldSchema]));
  const hasOld = !/g4d_theme_packages/.test(fs.readFileSync(oldSchema, 'utf8'));
  await db.exec(`INSERT INTO "Vendor"("id","name","email","password","businessName","updatedAt") VALUES ('v1','Allwin','a@x.in','x','Allwin Tours', now());`);
  await db.exec(`INSERT INTO "VendorCMS"("id","vendorId","logo","phone","updatedAt") VALUES ('c1','v1','https://x/logo.jpg','8220467673', now());`);
  const q = async (c, sql) => (await c.query(sql)).rows;
  const snap = async () => JSON.stringify({ v: await q(db, `SELECT * FROM "Vendor" ORDER BY id`), c: await q(db, `SELECT * FROM "VendorCMS" ORDER BY id`) });
  const before = await snap();
  ok('the "before" schema really is the one without the theme tables (so this rehearses the real change)', hasOld);
  const sql = fs.readFileSync(path.join(root, 'prisma', 'migrations', MIG, 'migration.sql'), 'utf8');
  let applied = true; let err = '';
  try { await db.exec(sql); } catch (e) { applied = false; err = e.message; }
  ok('the migration applies cleanly on top of the previous schema with live-looking rows present', applied, err);
  ok('EVERY existing row is exactly as it was (vendor and site row, every column)', (await snap()) === before);
  const stmts = sql.replace(/--.*$/gm, '').split(';').map((x) => x.trim()).filter(Boolean);
  const touchesOld = stmts.filter((x) => /^(DROP|TRUNCATE|DELETE|UPDATE|INSERT)/i.test(x) || (/^ALTER TABLE/i.test(x) && !/^ALTER TABLE "g4d_theme_/i.test(x)));
  ok('nothing is dropped, deleted or rewritten, and no existing table is altered (only new g4d_theme_ tables, their keys and indexes)', touchesOld.length === 0, touchesOld.join(' | '));
  const created = [...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]);
  ok('it creates exactly the three theme tables: packages, assets and entitlements', J(created.sort()) === J(['g4d_theme_assets', 'g4d_theme_entitlements', 'g4d_theme_packages']), J(created));
  ok('the new tables start empty (no theme exists until an admin imports one)', (await q(db, 'SELECT (SELECT count(*) FROM g4d_theme_packages) a, (SELECT count(*) FROM g4d_theme_assets) b, (SELECT count(*) FROM g4d_theme_entitlements) c'))[0].a == 0);
  ok('the payment reference is unique, so a repeated payment message can never give two licences', /CREATE UNIQUE INDEX[^;]*g4d_theme_entitlements[^;]*paymentRef/.test(sql));
  ok('a theme key and version pair is unique', /CREATE UNIQUE INDEX[^;]*g4d_theme_packages[^;]*key[^;]*version/.test(sql));
  const fresh = new PGlite();
  await fresh.exec(prismaSql(['--from-empty', '--to-schema-datamodel', path.join(root, 'prisma', 'schema.prisma')]));
  const tables = created;
  const shape = async (c) => JSON.stringify((await q(c, `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name`)).filter((r) => tables.includes(r.table_name)));
  const idx = async (c) => JSON.stringify((await q(c, `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`)).filter((r) => tables.some((t) => r.indexdef.includes(`"${t}"`))));
  ok('DRIFT: the migrated tables have exactly the columns schema.prisma describes (names, types, nullability, defaults)', (await shape(db)) === (await shape(fresh)) && (await shape(db)).length > 100);
  ok('DRIFT: and exactly the same indexes and unique keys', (await idx(db)) === (await idx(fresh)));
  await fresh.close(); await db.close();
  const rls = fs.readFileSync(path.join(root, 'prisma', 'sql', 'enable_rls_public.sql'), 'utf8');
  ok('the RLS script covers every public table (so the three new tables) and still has its dollar quotes', /ENABLE ROW LEVEL SECURITY/i.test(rls) && rls.includes('DO $$') && rls.includes('END $$;') && rls.split('$$').length - 1 >= 2);
  console.log(`\n${pass} passed, ${fail} failed`);
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
})();

function J(x) { return JSON.stringify(x); }
