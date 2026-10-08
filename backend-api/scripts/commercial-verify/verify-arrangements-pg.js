// Release 1A special arrangements on REAL Postgres (PGlite = Postgres compiled to WASM), never the production database.
//   Part A  rehearses migration 20261009100000_special_arrangements on a database that already holds vendors and invoices.
//   Part B  runs the real ArrangementsService through the real Prisma client against the full current schema.
// Needs @electric-sql/pglite + pglite-socket (not a repo dependency). Set G4D_PGLITE_DIR to a folder whose node_modules has them;
// if they cannot be found the suite SKIPs (exit 0) so CI without them stays green.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..', '..');
const pgDir = process.env.G4D_PGLITE_DIR || path.join(os.tmpdir(), 'pgtest');
const results = { pass: 0, fail: 0 };
const ok = (name, cond, detail) => { if (cond) { results.pass += 1; console.log(`  PASS  ${name}`); } else { results.fail += 1; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const MIGRATION = '20261009100000_special_arrangements';

async function load(mod) {
  const dir = path.join(pgDir, 'node_modules', ...mod.split('/'));
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const entry = (pkg.exports && pkg.exports['.'] && (pkg.exports['.'].import?.default ?? pkg.exports['.'].import ?? pkg.exports['.'].default)) || pkg.module || pkg.main;
  const rel = typeof entry === 'string' ? entry : (entry.default ?? entry.import);
  return import(pathToFileURL(path.join(dir, rel)).href);
}

function prismaSql(args) {
  return execFileSync(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'diff', ...args, '--script'], {
    cwd: root, env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: 'true' }, maxBuffer: 64 * 1024 * 1024,
  }).toString();
}

(async () => {
  let pglite; let sock;
  try { pglite = await load('@electric-sql/pglite'); sock = await load('@electric-sql/pglite-socket'); } catch (e) {
    console.log(`SKIP  PGlite not found under ${pgDir} (set G4D_PGLITE_DIR) — real-Postgres arrangement proofs not run: ${e.message}`);
    process.exit(0);
  }
  const { PGlite } = pglite; const { PGLiteSocketServer } = sock;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-arr-pg-'));

  section(`MIGRATION ${MIGRATION} on a database that already holds data`);
  {
    const migration = fs.readFileSync(path.join(root, 'prisma', 'migrations', MIGRATION, 'migration.sql'), 'utf8');
    let ref = 'HEAD';
    try {
      const added = execFileSync('git', ['log', '--diff-filter=A', '--format=%H', '-1', '--', `prisma/migrations/${MIGRATION}`], { cwd: root }).toString().trim();
      if (added) ref = `${added}^`;
    } catch { /* uncommitted: HEAD */ }
    const oldSchema = path.join(tmp, 'old.prisma');
    fs.writeFileSync(oldSchema, execFileSync('git', ['show', `${ref}:backend-api/prisma/schema.prisma`], { cwd: root, maxBuffer: 64 * 1024 * 1024 }));
    const db = new PGlite();
    await db.exec(prismaSql(['--from-empty', '--to-schema-datamodel', oldSchema]));
    await db.exec(`INSERT INTO "Vendor"("id","name","email","password","businessName","updatedAt") VALUES ('v1','Suresh','s@x.in','x','Step N Rock', now());`);
    await db.exec(`INSERT INTO "Invoice"("id","invoiceNumber","vendorId","description","amount","gstAmount","totalAmount","updatedAt") VALUES ('i1','INV-2026-0001','v1','legacy',599400,0,599400, now());`);
    let applied = true; let err = '';
    try { await db.exec(migration); } catch (e) { applied = false; err = e.message; }
    ok('the migration applies cleanly on top of the previous schema with a vendor and an invoice present', applied, err);
    const q = async (sql) => (await db.query(sql)).rows;
    const inv = (await q(`SELECT "gstForgonePaise","gstNote","totalAmount" FROM "Invoice" WHERE "id"='i1'`))[0];
    ok('the existing invoice is untouched: new columns are NULL, amounts unchanged', inv && inv.gstForgonePaise === null && inv.gstNote === null && inv.totalAmount === 599400, JSON.stringify(inv));
    ok('the arrangements table exists and is empty', (await q(`SELECT count(*)::int AS n FROM "g4d_special_arrangements"`))[0].n === 0);
    await db.exec(`INSERT INTO "g4d_special_arrangements"("id","vendorId","validUntil","reason","createdBy","updatedAt") VALUES ('a1','v1', now() + interval '30 days','Founding client on special terms','admin@get4domain.com', now());`);
    const row = (await q(`SELECT "active","allowHalfYear","gstMode","allowedChannels","history" FROM "g4d_special_arrangements" WHERE "id"='a1'`))[0];
    ok('defaults hold: active, no half-year, GST EXCLUSIVE, no extra channels, empty history', row.active === true && row.allowHalfYear === false && row.gstMode === 'EXCLUSIVE' && (row.allowedChannels === '{}' || (Array.isArray(row.allowedChannels) && row.allowedChannels.length === 0)) && Array.isArray(row.history) && row.history.length === 0, JSON.stringify(row));
    let fk = false; try { await db.exec(`INSERT INTO "g4d_special_arrangements"("id","vendorId","validUntil","reason","createdBy","updatedAt") VALUES ('a2','nobody', now(),'x','x', now());`); } catch { fk = true; }
    ok('an arrangement cannot point at a client that does not exist (foreign key)', fk);
    // Drift guard: the migrated database and a database built straight from schema.prisma must have identical columns for what this migration touched.
    const fresh = new PGlite();
    await fresh.exec(prismaSql(['--from-empty', '--to-schema-datamodel', path.join(root, 'prisma', 'schema.prisma')]));
    const shape = async (conn) => (await conn.query(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE (table_name = 'g4d_special_arrangements') OR (table_name = 'Invoice' AND column_name IN ('gstForgonePaise','gstNote')) ORDER BY table_name, column_name`)).rows.map((r) => JSON.stringify(r)).join('|');
    const migrated = await shape(db); const direct = await shape(fresh);
    ok('DRIFT: the migration produces exactly the schema.prisma columns (names, types, nullability, defaults)', migrated.length > 0 && migrated === direct, migrated === direct ? '' : 'migrated=' + migrated.slice(0, 200) + ' direct=' + direct.slice(0, 200));
    await fresh.close();
    await db.close();
  }

  section('REAL Postgres: the real ArrangementsService through the real Prisma client');
  {
    const db = new PGlite();
    await db.exec(prismaSql(['--from-empty', '--to-schema-datamodel', path.join(root, 'prisma', 'schema.prisma')]));
    const server = new PGLiteSocketServer({ db, port: 54331, host: '127.0.0.1' });
    await server.start();
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54331/postgres?connection_limit=1&pgbouncer=true&sslmode=disable';
    const { PrismaClient } = require(path.join(root, 'node_modules', '@prisma', 'client'));
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: [] });
    const dist = (p) => require(path.join(root, 'dist', 'src', p));
    const { ArrangementsService } = dist('commercial/arrangements.service');
    const { CommercialAuditService } = dist('commercial/foundation.services');
    const sent = [];
    const messenger = { admin: async (...a) => { sent.push(a); } };
    const audit = new CommercialAuditService(prisma);
    const svc = new ArrangementsService(prisma, audit, messenger);
    const ADMIN = { id: 'admin1', email: 'admin@get4domain.com', role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' };
    const inDays = (n) => new Date(Date.now() + n * 86_400_000);
    try {
      await prisma.vendor.create({ data: { id: 'v1', name: 'Suresh', email: 's@x.in', password: 'x', businessName: 'Step N Rock', industry: 'retail', subdomain: 'shop' } });
      await prisma.vendor.create({ data: { id: 'v2', name: 'Other', email: 'o@x.in', password: 'x', businessName: 'Other Co', industry: 'retail', subdomain: 'other' } });
      const a = await svc.create({ vendorId: 'v1', allowHalfYear: true, gstMode: 'NONE', allowedChannels: ['UPI_QR'], validUntil: inDays(60), reason: 'Founding client on special terms' }, ADMIN);
      ok('create writes the row (enum array, JSON history, defaults) and returns it', a.active === true && a.allowedChannels.join() === 'UPI_QR' && a.gstMode === 'NONE' && Array.isArray(a.history) && a.history.length === 1);
      ok('activeFor reads it back; another client has none', (await svc.activeFor('v1'))?.id === a.id && (await svc.activeFor('v2')) === null);
      let blocked = false; try { await svc.assertAllowed({ planKey: 'WORKSPACE', billingCycle: 'HALF_YEARLY', gstMode: 'NONE', channels: ['RAZORPAY', 'UPI_QR'] }, 'v2'); } catch { blocked = true; }
      await svc.assertAllowed({ planKey: 'WORKSPACE', billingCycle: 'HALF_YEARLY', gstMode: 'NONE', channels: ['RAZORPAY', 'UPI_QR'] }, 'v1');
      ok('enforcement on real rows: client 1 passes, client 2 is refused', blocked);
      const e = await svc.update(a.id, { allowedChannels: ['UPI_QR', 'OFFLINE'], validUntil: inDays(70), reason: 'Added offline for cheques' }, ADMIN);
      ok('edit appends to the history and keeps the audit trail', e.history.length === 2 && e.allowedChannels.length === 2 && (await prisma.commercialAuditLog.count({ where: { entityType: 'SpecialArrangement', entityId: a.id } })) === 2);
      const mk = (id, vendorId, over) => prisma.invoice.create({ data: { id, invoiceNumber: id, vendorId, description: 'x', amount: 599400, gstAmount: 0, totalAmount: 599400, gstMode: 'NONE', gstForgonePaise: 107892, gstNote: 'GST not charged — special arrangement until x', kind: 'ACTIVATION', ...over } });
      await mk('INV-A', 'v1', { status: 'PAID' });
      await mk('INV-B', 'v1', { status: 'SENT' });
      await mk('INV-C', 'v1', { status: 'VOID' });
      await prisma.invoice.create({ data: { id: 'INV-D', invoiceNumber: 'INV-D', vendorId: 'v2', description: 'normal', amount: 100, gstAmount: 18, totalAmount: 118, kind: 'ACTIVATION', status: 'PAID' } });
      const rep = await svc.gstReport({});
      ok('"GST not collected" on real Postgres: counts issued non-void invoices, splits out the paid part, ignores normal invoices', rep.rows.length === 1 && rep.rows[0].invoices === 2 && rep.totalPaise === 107892 * 2 && rep.paidTotalPaise === 107892, JSON.stringify(rep));
      ok('the invoice read API shape carries the new columns', (await prisma.invoice.findUnique({ where: { id: 'INV-A' }, select: { gstForgonePaise: true, gstNote: true } })).gstForgonePaise === 107892);
      await prisma.specialArrangement.updateMany({ where: { id: a.id }, data: { validUntil: inDays(10) } });
      const n1 = await svc.runNotices(new Date());
      const n2 = await svc.runNotices(new Date());
      ok('the 15-day notice is sent once on real Postgres (conditional update claims it) and never repeated', n1.warned === 1 && n2.warned === 0 && sent.length === 1);
      await svc.end(a.id, 'Client moved to the standard annual plan', ADMIN);
      ok('ending removes it from force but keeps the row and the history', (await svc.activeFor('v1')) === null && (await prisma.specialArrangement.count()) === 1);
      ok('list filters work on real data (expired / active)', (await svc.list('active')).length === 0);
    } catch (err) {
      ok('real-Postgres run completed without an unexpected error', false, err && err.message);
    } finally {
      await prisma.$disconnect().catch(() => undefined);
      await server.stop().catch(() => undefined);
      await db.close().catch(() => undefined);
    }
  }

  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  process.exitCode = results.fail ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode), 300);
})().catch((e) => { console.error(e); process.exit(1); });
