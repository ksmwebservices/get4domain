// Stepnrock handover — stock & orders on REAL Postgres (PGlite = Postgres compiled to WASM), never the production DB.
//   Part A  rehearses migration 20261008120000_stepnrock_handover on a database holding legacy rows.
//   Part B  runs the real StockService / PublicCheckoutService through the real Prisma client and fires many orders at once.
//
// HONEST LIMIT: PGlite serves ONE connection, so Prisma's concurrent transactions are queued, not interleaved on
// separate backends. What this proves on real Postgres: the conditional UPDATE (stockQty >= qty), the unique keys, the
// ledger arithmetic and the all-or-nothing rollback all behave correctly when 10–12 requests race. True row-lock
// interleaving across connections is Postgres' own READ COMMITTED guarantee for `UPDATE … WHERE stockQty >= n`
// (the second writer re-evaluates the WHERE after the first commits) and is not re-proven here.
//
// Needs @electric-sql/pglite + pglite-socket (not a repo dependency). Set G4D_PGLITE_DIR to a folder whose node_modules
// has them; if they cannot be found the suite SKIPs (exit 0) so CI without them stays green.
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

async function load(mod) {
  const dir = path.join(pgDir, 'node_modules', ...mod.split('/'));
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const entry = (pkg.exports && pkg.exports['.'] && (pkg.exports['.'].import?.default ?? pkg.exports['.'].import ?? pkg.exports['.'].default)) || pkg.module || pkg.main;
  const rel = typeof entry === 'string' ? entry : (entry.default ?? entry.import);
  return import(pathToFileURL(path.join(dir, rel)).href);
}

function prismaSql(args) {
  return execFileSync(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'diff', ...args, '--script'], { cwd: root, env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: 'true' }, maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
}


(async () => {
  let pglite; let sock;
  try { pglite = await load('@electric-sql/pglite'); sock = await load('@electric-sql/pglite-socket'); } catch (e) {
    console.log(`SKIP  PGlite not found under ${pgDir} (set G4D_PGLITE_DIR) — real-Postgres stock proofs not run: ${e.message}`);
    process.exit(0);
  }
  const { PGlite } = pglite; const { PGLiteSocketServer } = sock;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-stock-pg-'));

  // ── Part A: migration rehearsal on legacy data ──────────────────────────────────────────────
  section('MIGRATION 20261008120000_stepnrock_handover on a database that already holds data');
  {
    const migDir = path.join(root, 'prisma', 'migrations', '20261008120000_stepnrock_handover');
    const migration = fs.readFileSync(path.join(migDir, 'migration.sql'), 'utf8');
    // Baseline = the schema BEFORE this change: the commit that added the migration folder (its parent), or HEAD if uncommitted.
    let ref = 'HEAD';
    try {
      const added = execFileSync('git', ['log', '--diff-filter=A', '--format=%H', '-1', '--', 'prisma/migrations/20261008120000_stepnrock_handover'], { cwd: root }).toString().trim();
      if (added) ref = `${added}^`;
    } catch { /* uncommitted: HEAD */ }
    const oldSchema = path.join(tmp, 'old.prisma');
    fs.writeFileSync(oldSchema, execFileSync('git', ['show', `${ref}:backend-api/prisma/schema.prisma`], { cwd: root, maxBuffer: 64 * 1024 * 1024 }));
    const baseline = prismaSql(['--from-empty', '--to-schema-datamodel', oldSchema]);

    const db = new PGlite();
    await db.exec(baseline);
    await db.exec(`INSERT INTO "Vendor"("id","name","email","password","businessName","updatedAt") VALUES ('v1','Suresh','s@x.in','x','Step N Rock', now());`);
    await db.exec(`INSERT INTO "VendorProduct"("id","vendorId","name","price","updatedAt") VALUES ('p1','v1','Legacy Shoe','1000', now());`);
    await db.exec(`INSERT INTO "g4d_pos_sales"("id","vendorId","items","subtotal","total","updatedAt") VALUES ('s1','v1','[]',100,100, now()),('s2','v1','[]',50,50, now());`);
    await db.exec(`INSERT INTO "g4d_vendor_payment_config"("id","vendorId","updatedAt") VALUES ('c1','v1', now());`).catch(() => {});

    let applied = true; let err = '';
    try { await db.exec(migration); } catch (e) { applied = false; err = e.message; }
    ok('the migration applies cleanly on top of the previous schema with legacy rows present', applied, err);
    const q = async (sql) => (await db.query(sql)).rows;
    const prod = (await q(`SELECT "trackStock","stockQty","status","active" FROM "VendorProduct" WHERE "id"='p1'`))[0];
    ok('existing products keep their data and get trackStock=false (nothing becomes tracked by surprise)', prod && prod.trackStock === false && prod.active === true, JSON.stringify(prod));
    const sales = await q(`SELECT "id","idempotencyKey","status","customerName" FROM "g4d_pos_sales" ORDER BY "id"`);
    ok('existing sales are untouched; two legacy rows can share a NULL idempotencyKey', sales.length === 2 && sales.every((s) => s.idempotencyKey === null && s.status === 'completed'));
    const cols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_name='g4d_pos_sales'`)).map((r) => r.column_name);
    ok('new order-request columns exist', ['customerName', 'customerPhone', 'customerEmail', 'deliveryAddress', 'orderNote', 'orderSource', 'idempotencyKey', 'paidAt', 'cancelledAt'].every((c) => cols.includes(c)));
    const cfg = await q(`SELECT column_name FROM information_schema.columns WHERE table_name='g4d_vendor_payment_config' AND column_name='checkoutMode'`);
    ok('VendorPaymentConfig.checkoutMode exists and is nullable (legacy rows read as NULL)', cfg.length === 1);
    ok('the ledger table exists', (await q(`SELECT to_regclass('g4d_stock_movements') AS t`))[0].t !== null);
    await db.exec(`UPDATE "g4d_pos_sales" SET "idempotencyKey"='k1' WHERE "id"='s1'`);
    let dup = false; try { await db.exec(`UPDATE "g4d_pos_sales" SET "idempotencyKey"='k1' WHERE "id"='s2'`); } catch { dup = true; }
    ok('(vendor, idempotencyKey) is unique at the database level', dup);
    await db.exec(`INSERT INTO "g4d_stock_movements"("id","vendorId","productId","delta","reason","balanceAfter","idempotencyKey") VALUES ('m1','v1','p1',5,'OPENING',5,'open:p1')`);
    let dupMove = false; try { await db.exec(`INSERT INTO "g4d_stock_movements"("id","vendorId","productId","delta","reason","balanceAfter","idempotencyKey") VALUES ('m2','v1','p1',1,'ADJUSTMENT',6,'open:p1')`); } catch { dupMove = true; }
    ok('a movement idempotency key can be used once only', dupMove);
    await db.exec(`DELETE FROM "VendorProduct" WHERE "id"='p1'`);
    ok('deleting a product removes its ledger (cascade)', (await q(`SELECT count(*)::int AS n FROM "g4d_stock_movements"`))[0].n === 0);
    // The migration must also be re-runnable-safe in the sense that Prisma's own diff from (old+migration) to new schema is empty;
    // that is asserted by `npm run verify:migrations` (schema ⇄ migrations drift guard), not repeated here.
    await db.close();
  }

  // ── Part B: the real services, many simultaneous requests ───────────────────────────────────
  section('REAL Postgres: concurrent orders against limited stock');
  const fullSql = prismaSql(['--from-empty', '--to-schema-datamodel', path.join(root, 'prisma', 'schema.prisma')]);
  const db = new PGlite();
  await db.exec(fullSql);
  const server = new PGLiteSocketServer({ db, port: 54329, host: '127.0.0.1' });
  await server.start();
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1&pgbouncer=true&sslmode=disable';
  const { PrismaClient } = require(path.join(root, 'node_modules', '@prisma', 'client'));
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: [] });
  const dist = (p) => require(path.join(root, 'dist', 'src', p));
  const { StockService } = dist('stock/stock.service');
  const { PublicCheckoutService } = dist('engine/public-checkout.service');
  const { CmsService } = dist('cms/cms.service');
  const notes = [];
  const notifications = { notifyVendor: async (...a) => { notes.push(a); } };
  const stock = new StockService(prisma, notifications);
  const cms = new CmsService(prisma, undefined, stock);
  const checkout = new PublicCheckoutService(prisma, { getKeys: async () => null }, { createLead: async () => ({ id: 'l' }) }, stock, notifications);
  const addr = '12 Main Street, Vadapalani, Chennai 600026';
  const order = (key, productId, qty) => checkout.placeOrderRequest('v1', { items: [{ productId, name: 'x', qty }], name: 'Ravi', phone: '9876543210', address: addr, idempotencyKey: key });
  const settle = async (ps) => { const r = await Promise.allSettled(ps); return { ok: r.filter((x) => x.status === 'fulfilled'), bad: r.filter((x) => x.status === 'rejected') }; };
  const ledger = async (id) => { const m = await prisma.stockMovement.findMany({ where: { productId: id }, orderBy: { createdAt: 'asc' } }); const sum = m.reduce((a, x) => a + x.delta, 0); const p = await prisma.vendorProduct.findUnique({ where: { id } }); return { sum, stock: p.stockQty, n: m.length }; };

  try {
    await prisma.vendor.create({ data: { id: 'v1', name: 'Suresh', email: 's@x.in', password: 'x', businessName: 'Step N Rock', industry: 'retail', subdomain: 'shop' } });
    await prisma.vendorPaymentConfig.create({ data: { vendorId: 'v1', checkoutMode: 'ORDER_REQUEST' } });
    const mk = (name, qty, level = 1) => cms.addProduct('v1', { name, price: '1000', trackStock: true, stockQty: qty, reorderLevel: level }, 'owner');

    // 1. the dispatch's own acceptance test
    const a = await mk('Two-of-three', 3);
    const r1 = await settle([order('race-a-1', a.id, 2), order('race-a-2', a.id, 2)]);
    const la = await ledger(a.id);
    ok('[feat:commerce.stock.atomic] TWO simultaneous orders of 2 against stock 3: exactly ONE succeeds', r1.ok.length === 1 && r1.bad.length === 1, `${r1.ok.length} ok / ${r1.bad.length} refused`);
    ok('…stock is exactly 1 (never −1) and the ledger agrees (opening +3, order −2)', la.stock === 1 && la.sum === 1 && la.n === 2, JSON.stringify(la));

    // 2. many small orders racing for a few units
    const b = await mk('Five-units', 5);
    const r2 = await settle(Array.from({ length: 12 }, (_, i) => order(`race-b-${i}`, b.id, 1)));
    const lb = await ledger(b.id);
    ok('12 simultaneous orders of 1 against stock 5: exactly 5 succeed, 7 are refused', r2.ok.length === 5 && r2.bad.length === 7, `${r2.ok.length}/${r2.bad.length}`);
    ok('…stock is 0, never negative, and the ledger sums to the stock', lb.stock === 0 && lb.sum === 0 && lb.n === 6, JSON.stringify(lb));
    ok('…the refusals are clean 400s (out of stock / only N left), not 500s', r2.bad.every((x) => x.reason?.getStatus?.() === 400), r2.bad.map((x) => x.reason?.message).join(' | ').slice(0, 200));

    // 3. (not run here) a same-key submit storm ends in a Postgres unique violation, which makes PGlite's socket drop the whole
    //    connection (Prisma P1017/P1001) — a PGlite artefact, real Postgres answers P2002. The database-level unique key is proven in
    //    Part A and the 'return the winner' handling of P2002 is proven in verify-stock.js against the fake.

    // 4. double cancel at once restores exactly once
    const d = await mk('Cancel-race', 4);
    const placed = await order('cancel-1', d.id, 3);
    const r4 = await settle([checkout.cancelOrder('v1', placed.orderId, 'owner'), checkout.cancelOrder('v1', placed.orderId, 'owner'), checkout.cancelOrder('v1', placed.orderId, 'owner')]);
    const ld = await ledger(d.id);
    ok('3 simultaneous cancels of one order: exactly one wins', r4.ok.length === 1, `${r4.ok.length} ok`);
    ok('…stock restored ONCE (4 → 1 → 4), not tripled', ld.stock === 4 && ld.sum === 4, JSON.stringify(ld));

    // 5. all-or-nothing across two lines on real Postgres
    const e1 = await mk('Line-A', 5); const e2 = await mk('Line-B', 1);
    let failed = false;
    try { await prisma.$transaction((tx) => stock.reserve(tx, 'v1', [{ productId: e1.id, qty: 2 }, { productId: e2.id, qty: 3 }], { type: 'ORDER', id: 'x' }, 'order:x')); } catch { failed = true; }
    const l1 = await ledger(e1.id); const l2 = await ledger(e2.id);
    ok('a two-line cart where line B is short fails as a whole; line A is rolled back by Postgres', failed && l1.stock === 5 && l1.n === 1 && l2.stock === 1, `${JSON.stringify(l1)} ${JSON.stringify(l2)}`);

    // 6. adjust-stock races
    const f = await mk('Adjust-race', 10);
    const r6 = await settle(Array.from({ length: 6 }, (_, i) => stock.adjust('v1', f.id, { mode: 'remove', quantity: 3, reason: 'SHOP_SALE', idempotencyKey: `adj-${i}` }, 'owner')));
    const lf = await ledger(f.id);
    ok('6 simultaneous "remove 3" against 10: exactly 3 succeed (never below 0), stock 1', r6.ok.length === 3 && lf.stock === 1 && lf.sum === 1, `${r6.ok.length} ok ${JSON.stringify(lf)}`);
    const same = await settle(Array.from({ length: 4 }, () => stock.adjust('v1', f.id, { mode: 'add', quantity: 5, reason: 'RETURN', idempotencyKey: 'same-adj' }, 'owner')));
    const lf2 = await ledger(f.id);
    ok('4 simultaneous adjusts with the same key apply once (1 → 6)', same.ok.length === 4 && lf2.stock === 6 && lf2.sum === 6, JSON.stringify(lf2));

    // 7. global invariant
    const all = await prisma.vendorProduct.findMany({ where: { trackStock: true } });
    const bad = [];
    for (const p of all) { const l = await ledger(p.id); if ((p.stockQty ?? 0) < 0 || l.sum !== p.stockQty) bad.push(p.name); }
    ok('INVARIANT after everything: no product is negative and every ledger sums to its stock', bad.length === 0, bad.join());
  } finally {
    await prisma.$disconnect().catch(() => {});
    await server.stop().catch(() => {});
    await db.close().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  process.exit(results.fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
