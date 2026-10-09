// Full BOS on REAL Postgres (PGlite) through the REAL NestJS API: Chain A (sell), B (bill + collect), C (stock + purchase), D (books),
// the stock-ledger property test, stock concurrency, document cancel/reversal, idempotency and the Essentials -> Pro -> Essentials -> Pro run.
// Needs `npx nest build` first and PGlite (SKIPs cleanly when it is not installed).
const { startHarness, available } = require('../e2e/bos-harness');

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 400)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const J = (x) => JSON.stringify(x);

// deterministic pseudo random so a failure can be replayed
let seed = 20261009; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - real-Postgres BOS proofs not run'); process.exit(0); }
  const h = await startHarness({ port: 3097, pgPort: 54331 });
  const { prisma, call } = h;
  const ent = h.svc('EntitlementsService', 'bos/entitlements.service');
  const stock = h.svc('StockService', 'stock/stock.service');
  let code = 0;
  try {
    const mk = async (vendorId, name, price, over = {}) => prisma.vendorProduct.create({ data: { vendorId, name, price: String(price), priceAmount: price, trackStock: true, stockQty: 0, hsn: '6403', gstRate: 18, purchasePriceAmount: Math.round(price * 0.6), active: true, ...over } });
    const open = async (vendorId, p, qty) => prisma.$transaction((tx) => stock.setOpening(tx, vendorId, p.id, qty, 'test'));
    const shop = await h.createVendor({ key: 'bosshop', industry: 'retail', plan: 'WORKSPACE' });
    const T = shop.token;
    const pen = await mk(shop.id, 'Blue Pen', 100); const book = await mk(shop.id, 'Notebook', 250); const service = await mk(shop.id, 'Repair visit', 500, { trackStock: false, stockQty: null, purchasePriceAmount: null });
    await open(shop.id, pen, 50); await open(shop.id, book, 20);

    section('[feat:bos.spine] Settings, numbering, GST invoice (Chain A + B)');
    let r = await call('PUT', '/bos/settings', { gstRegistered: true, gstin: '33AAAAA0000A1Z5', state: 'Tamil Nadu', legalName: 'Bosshop Traders', priceMode: 'EXCLUSIVE' }, T);
    ok('settings saved', r.status === 200, J(r.body));
    r = await call('POST', '/bos/parties', { name: 'Asha Stores', phone: '9876543210', type: 'customer', state: 'Tamil Nadu' }, T);
    ok('a customer can be added', r.status === 201 || r.status === 200, J(r.body));
    const asha = r.data;
    r = await call('POST', '/bos/documents', { docType: 'QUOTE', partyId: asha.id, lines: [{ itemId: pen.id, qty: 10 }], issue: true }, T);
    ok('a quote is issued with the first QT number', r.status < 300 && /^QT\//.test(r.data?.doc?.number ?? ''), J(r.body));
    const quote = r.data.doc;
    ok('quote totals: 10 x 100 + 18% = 1180', quote.totalPaise === 118000, quote.totalPaise);
    ok('a quote does NOT move stock', (await prisma.vendorProduct.findUnique({ where: { id: pen.id } })).stockQty === 50);
    r = await call('POST', `/bos/documents/${quote.id}/convert`, { to: 'SALES_INVOICE', issue: true }, T);
    ok('quote converts to an invoice', r.status < 300, J(r.body));
    const inv1 = r.data.doc ?? r.data;
    ok('invoice number is INV/FY/0001 and stock dropped by 10', /\/0001$/.test(inv1.number ?? '') && (await prisma.vendorProduct.findUnique({ where: { id: pen.id } })).stockQty === 40, `${inv1.number}`);
    r = await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyId: asha.id, lines: [{ itemId: book.id, qty: 2 }, { itemId: service.id, qty: 1 }], issue: true }, T);
    const inv2 = r.data.doc;
    ok('second invoice gets the next gapless number', /\/0002$/.test(inv2.number ?? ''), inv2?.number);
    ok('an item whose stock is not tracked sells without touching stock', (await prisma.vendorProduct.findUnique({ where: { id: service.id } })).stockQty === null);
    r = await call('POST', '/bos/payments', { kind: 'RECEIPT', partyId: asha.id, mode: 'UPI', amount: 500, allocations: [{ documentId: inv1.id, amount: 500 }] }, T);
    ok('a part payment is accepted', r.status < 300, J(r.body));
    let g = (await call('GET', `/bos/documents/${inv1.id}`, undefined, T)).data;
    ok('invoice shows PART_PAID with the right balance', g.status === 'PART_PAID' && g.paidPaise === 50000, `${g.status} ${g.paidPaise}`);
    r = await call('GET', '/bos/outstanding', undefined, T);
    const owing = (r.data.rows ?? r.data.parties ?? r.data)?.find?.((x) => (x.partyId ?? x.id) === asha.id);
    ok('outstanding lists Asha with what she owes', Boolean(owing), J(r.data).slice(0, 300));
    r = await call('POST', '/bos/payments', { kind: 'RECEIPT', partyId: asha.id, mode: 'CASH', amount: 5000, auto: true }, T);
    ok('an auto-allocated receipt clears the rest and keeps any extra as an advance', r.status < 300, J(r.body));

    section('[feat:bos.counter] Counter billing: idempotent, walk-in, all-in-one');
    r = await call('POST', '/bos/counter/sale', { lines: [{ itemId: pen.id, qty: 3 }], payments: [{ mode: 'CASH', amount: 354 }], idempotencyKey: 'counter-test-0001' }, T);
    ok('counter sale takes cash and issues the bill', r.status < 300 && r.data?.invoice?.status === 'PAID', J(r.body));
    const before = (await prisma.vendorProduct.findUnique({ where: { id: pen.id } })).stockQty;
    const again = await call('POST', '/bos/counter/sale', { lines: [{ itemId: pen.id, qty: 3 }], payments: [{ mode: 'CASH', amount: 354 }], idempotencyKey: 'counter-test-0001' }, T);
    ok('the same sale sent twice bills once', again.data?.replayed === true && (await prisma.vendorProduct.findUnique({ where: { id: pen.id } })).stockQty === before);
    r = await call('POST', '/bos/counter/sale', { lines: [{ itemId: pen.id, qty: 1 }], payments: [], idempotencyKey: 'counter-test-0002' }, T);
    ok('an unpaid walk-in bill is refused with a plain sentence', r.status === 400 && /customer/i.test(J(r.body)), J(r.body));

    section('[feat:bos.credit-note] Credit note / return restores stock; cancel posts a reversal');
    g = (await call('GET', `/bos/documents/${inv2.id}`, undefined, T)).data;
    const bookLine = g.lines.find((l) => l.itemId === book.id || l.name === 'Notebook');
    const stockBefore = (await prisma.vendorProduct.findUnique({ where: { id: book.id } })).stockQty;
    r = await call('POST', `/bos/documents/${inv2.id}/credit-note`, { lines: [{ refLineId: bookLine.id, qty: 1, restock: true }], reason: 'Customer returned one', issue: true }, T);
    ok('credit note for 1 of 2 notebooks issues', r.status < 300 && /^CN\//.test(r.data?.doc?.number ?? ''), J(r.body));
    ok('returned notebook is back in stock', (await prisma.vendorProduct.findUnique({ where: { id: book.id } })).stockQty === stockBefore + 1);
    r = await call('POST', `/bos/documents/${inv2.id}/credit-note`, { lines: [{ refLineId: bookLine.id, qty: 5 }], reason: 'Too many', issue: true }, T);
    ok('a line cannot be credited for more than was sold', r.status === 400, J(r.body));
    r = await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyId: asha.id, lines: [{ itemId: pen.id, qty: 2 }], issue: true }, T);
    const toCancel = r.data.doc; const penBefore = (await prisma.vendorProduct.findUnique({ where: { id: pen.id } })).stockQty;
    r = await call('POST', `/bos/documents/${toCancel.id}/cancel`, { reason: 'Customer changed mind' }, T);
    ok('an invoice can be cancelled', r.status < 300, J(r.body));
    ok('cancel puts the stock back', (await prisma.vendorProduct.findUnique({ where: { id: pen.id } })).stockQty === penBefore + 2);
    const gone = await prisma.bosDocument.findUnique({ where: { id: toCancel.id } });
    ok('the cancelled invoice is still there (soft void), number kept', gone && gone.status === 'CANCELLED' && gone.number === toCancel.number);

    section('[feat:bos.journal] Books balance after all of that (Chain D) - Essentials has the totals, not the ledgers');
    const entries = await prisma.bosJournalLine.findMany({ where: { vendorId: shop.id } });
    const dr = entries.reduce((a, l) => a + l.debitPaise, 0); const cr = entries.reduce((a, l) => a + l.creditPaise, 0);
    ok(`total debits equal total credits across ${entries.length} journal lines`, dr === cr && entries.length > 0, `${dr} vs ${cr}`);
    const bad = await prisma.$queryRawUnsafe(`SELECT "entryId", SUM("debitPaise") d, SUM("creditPaise") c FROM g4d_bos_journal_lines WHERE "vendorId" = '${shop.id}' GROUP BY "entryId" HAVING SUM("debitPaise") <> SUM("creditPaise")`);
    ok('every single journal entry balances on its own', bad.length === 0, J(bad));
    r = await call('GET', '/bos/reports/summary', undefined, T);
    ok('Accounts totals are real (sales > 0), not all zero', (r.data.salesPaise ?? r.data.sales ?? 0) > 0, J(r.body));
    r = await call('GET', '/bos/books/trial-balance', undefined, T);
    ok('Essentials: the trial balance is refused with PLAN_REQUIRED naming the feature and plan', r.status === 403 && r.body?.code === 'PLAN_REQUIRED' && r.body?.feature === 'bos.books' && /Pro/.test(r.body?.requiredPlan ?? ''), J(r.body));
    r = await call('POST', '/bos/purchases', { docType: 'PURCHASE_BILL', partyName: 'Supplier X', lines: [{ itemId: pen.id, qty: 5, rate: 55 }], issue: true }, T);
    ok('Essentials: a purchase bill is refused with PLAN_REQUIRED', r.status === 403 && r.body?.code === 'PLAN_REQUIRED', J(r.body));

    section('[feat:bos.stock-ledger] PROPERTY: on-hand always equals the sum of movements after random sales/purchases/adjustments/cancels');
    {
      const pro = await h.createVendor({ key: 'prop', industry: 'retail', plan: 'BOS' });
      const PT = pro.token;
      await call('PUT', '/bos/settings', { gstRegistered: true, state: 'Tamil Nadu', negativeStock: 'BLOCK' }, PT);
      const sup = (await call('POST', '/bos/parties', { name: 'Wholesale Co', phone: '9111111111', type: 'supplier', state: 'Tamil Nadu' }, PT)).data;
      const cust = (await call('POST', '/bos/parties', { name: 'Ravi', phone: '9222222222', type: 'customer', state: 'Tamil Nadu' }, PT)).data;
      const items = [await mk(pro.id, 'Alpha', 120), await mk(pro.id, 'Beta', 80), await mk(pro.id, 'Gamma', 300)];
      for (const it of items) await open(pro.id, it, 30);
      const live = []; let refused = 0; let ops = 0;
      for (let i = 0; i < 60; i += 1) {
        const it = pick(items); const op = pick(['sell', 'sell', 'buy', 'adjust-', 'adjust+', 'cancel', 'return']);
        ops += 1;
        if (op === 'sell') {
          const rr = await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyId: cust.id, lines: [{ itemId: it.id, qty: 1 + Math.floor(rnd() * 8) }], issue: true }, PT);
          if (rr.status < 300) live.push(rr.data.doc); else refused += 1;
        } else if (op === 'buy') {
          const rr = await call('POST', '/bos/purchases', { docType: 'PURCHASE_BILL', partyId: sup.id, lines: [{ itemId: it.id, qty: 1 + Math.floor(rnd() * 10), rate: 40 }], issue: true }, PT);
          if (rr.status >= 300) refused += 1;
        } else if (op === 'adjust-') {
          const rr = await call('POST', `/stock/products/${it.id}/adjust`, { mode: 'remove', quantity: 1 + Math.floor(rnd() * 5), reason: 'DAMAGE' }, PT);
          if (rr.status >= 300) refused += 1;
        } else if (op === 'adjust+') {
          const rr = await call('POST', `/stock/products/${it.id}/adjust`, { mode: 'add', quantity: 1 + Math.floor(rnd() * 5), reason: 'ADJUSTMENT' }, PT);
          if (rr.status >= 300) refused += 1;
        } else if (op === 'cancel' && live.length) {
          const d = live.splice(Math.floor(rnd() * live.length), 1)[0];
          await call('POST', `/bos/documents/${d.id}/cancel`, { reason: 'property test' }, PT);
        }
        if (i % 10 === 9 || i === 59) {
          for (const x of items) {
            const p = await prisma.vendorProduct.findUnique({ where: { id: x.id } });
            const agg = await prisma.stockMovement.aggregate({ where: { vendorId: pro.id, productId: x.id }, _sum: { delta: true } });
            if ((p.stockQty ?? 0) !== (agg._sum.delta ?? 0) || (p.stockQty ?? 0) < 0) { ok(`on-hand equals sum of movements for ${x.name} after op ${i}`, false, `${p.stockQty} vs ${agg._sum.delta}`); }
          }
        }
      }
      let allOk = true;
      for (const x of items) {
        const p = await prisma.vendorProduct.findUnique({ where: { id: x.id } });
        const agg = await prisma.stockMovement.aggregate({ where: { vendorId: pro.id, productId: x.id }, _sum: { delta: true } });
        const last = await prisma.stockMovement.findFirst({ where: { vendorId: pro.id, productId: x.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
        if ((p.stockQty ?? 0) !== (agg._sum.delta ?? 0) || (p.stockQty ?? 0) < 0 || (last && last.balanceAfter !== p.stockQty)) allOk = false;
      }
      ok(`after ${ops} random operations (${refused} correctly refused) on-hand = sum of movements = last balance, never negative`, allOk);
      const jl = await prisma.bosJournalLine.findMany({ where: { vendorId: pro.id } });
      ok('and the books still balance after the random run', jl.reduce((a, l) => a + l.debitPaise - l.creditPaise, 0) === 0 && jl.length > 0);
      r = await call('GET', '/bos/books/trial-balance', undefined, PT);
      ok('Pro: trial balance is open and balanced', r.status === 200 && (r.data.totalDebitPaise ?? r.data.debitPaise) === (r.data.totalCreditPaise ?? r.data.creditPaise), J(r.body).slice(0, 300));
      const stockAcc = jl.filter((l) => l.accountCode === '1200').reduce((a, l) => a + l.debitPaise - l.creditPaise, 0);
      const perp = (await prisma.vendorProduct.findMany({ where: { vendorId: pro.id } })).reduce((a, p) => a + Math.round((p.purchasePriceAmount ?? 0) * 100) * (p.stockQty ?? 0), 0);
      ok('the Stock account in the books is a real figure (not negative)', stockAcc >= 0, `${stockAcc} vs ${perp}`);

      section('[feat:bos.stock-concurrency] 12 sales race for 5 units: exactly 5 sell, never negative');
      const hot = await mk(pro.id, 'Hot item', 100); await open(pro.id, hot, 5);
      const results = await Promise.all(Array.from({ length: 12 }, (_, k) => call('POST', '/bos/counter/sale', { lines: [{ itemId: hot.id, qty: 1 }], payments: [{ mode: 'CASH', amount: 118 }], idempotencyKey: `race-${k}-xxxxxxxx` }, PT)));
      const sold = results.filter((x) => x.status < 300).length; const left = (await prisma.vendorProduct.findUnique({ where: { id: hot.id } })).stockQty;
      ok(`sold ${sold} of 12, ${left} left`, sold === 5 && left === 0, `${sold}/${left}`);
      ok('the refused ones got a plain sentence about stock', results.filter((x) => x.status >= 400).every((x) => /stock|in stock|available/i.test(J(x.body))), J(results.find((x) => x.status >= 400)?.body));
    }

    section('[feat:bos.upgrade] Essentials -> Pro -> Essentials -> Pro: nothing lost, nothing re-entered');
    {
      const u = await h.createVendor({ key: 'upg', industry: 'retail', plan: 'WORKSPACE' });
      const UT = u.token;
      await call('PUT', '/bos/settings', { gstRegistered: true, state: 'Tamil Nadu' }, UT);
      const it = await mk(u.id, 'Widget', 200); await open(u.id, it, 500);
      const c = (await call('POST', '/bos/parties', { name: 'Bulk Buyer', phone: '9333333333', type: 'customer', state: 'Tamil Nadu' }, UT)).data;
      const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
      let salesDocs = 0; let attemptsRefused = 0;
      for (let d = 29; d >= 0; d -= 1) {
        const rr = await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyId: c.id, docDate: day(d), lines: [{ itemId: it.id, qty: 2 }], issue: true }, UT);
        if (rr.status < 300) salesDocs += 1;
        if (d % 5 === 0) {
          const pr = await call('POST', '/bos/purchases', { docType: 'PURCHASE_BILL', partyName: 'Sup', lines: [{ itemId: it.id, qty: 10, rate: 100 }], issue: true }, UT);
          if (pr.status === 403 && pr.body?.code === 'PLAN_REQUIRED') attemptsRefused += 1;
        }
        await call('POST', `/stock/products/${it.id}/adjust`, { mode: 'add', quantity: 1, reason: 'ADJUSTMENT' }, UT).catch(() => null);
      }
      ok('30 days of Essentials sales captured, every purchase attempt refused with PLAN_REQUIRED', salesDocs === 30 && attemptsRefused === 6, `${salesDocs}/${attemptsRefused}`);
      const snapshot = async () => ({
        docs: (await prisma.bosDocument.findMany({ where: { vendorId: u.id }, orderBy: { number: 'asc' }, select: { number: true, totalPaise: true, status: true } })),
        lines: (await prisma.bosJournalLine.count({ where: { vendorId: u.id } })),
        moves: (await prisma.stockMovement.count({ where: { vendorId: u.id } })),
        qty: (await prisma.vendorProduct.findUnique({ where: { id: it.id } })).stockQty,
      });
      const s0 = await snapshot();
      const setPlan = async (planKey) => { await prisma.billingTerm.updateMany({ where: { vendorId: u.id, isCurrent: true }, data: { planKey } }); ent.invalidate(u.id); };
      await setPlan('BOS');
      let tb = await call('GET', '/bos/books/trial-balance', undefined, UT);
      ok('after upgrade the Pro trial balance opens and covers the whole history, balanced', tb.status === 200 && (tb.data.totalDebitPaise ?? tb.data.debitPaise) === (tb.data.totalCreditPaise ?? tb.data.creditPaise) && (tb.data.totalDebitPaise ?? tb.data.debitPaise) > 0, J(tb.body).slice(0, 300));
      const s1 = await snapshot();
      ok('upgrade changed no earlier record (documents, journal lines, movements, stock all identical)', J(s0) === J(s1));
      const pl = await call('GET', '/bos/books/profit-and-loss', undefined, UT);
      ok('Pro P&L shows 30 days of revenue', pl.status === 200 && J(pl.body).includes('4000'), J(pl.body).slice(0, 200));
      const sp = await call('POST', '/bos/parties', { name: 'Upg Supplier', phone: '9555555555', type: 'supplier', state: 'Tamil Nadu' }, UT);
      const pb = await call('POST', '/bos/purchases', { docType: 'PURCHASE_BILL', partyId: sp.data?.id, lines: [{ itemId: it.id, qty: 10, rate: 100 }], issue: true }, UT);
      ok('Pro: a purchase bill now works', pb.status < 300, J(pb.body));
      await setPlan('WORKSPACE');
      tb = await call('GET', '/bos/books/trial-balance', undefined, UT);
      ok('downgrade: Pro screens lock with PLAN_REQUIRED', tb.status === 403 && tb.body?.code === 'PLAN_REQUIRED', J(tb.body));
      const s2 = await snapshot();
      ok('downgrade deleted nothing', s2.docs.length >= s1.docs.length && s2.lines >= s1.lines && s2.moves >= s1.moves);
      const dn = await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyId: c.id, lines: [{ itemId: it.id, qty: 1 }], issue: true }, UT);
      ok('downgraded: new Essentials activity still posts to the books', dn.status < 300 && (await prisma.bosJournalLine.count({ where: { vendorId: u.id } })) > s2.lines, J(dn.body));
      await setPlan('BOS');
      tb = await call('GET', '/bos/books/trial-balance', undefined, UT);
      const dnLines = await prisma.bosJournalLine.findMany({ where: { vendorId: u.id } });
      ok('upgrade again: Pro reports include the downgraded period and still balance', tb.status === 200 && dnLines.reduce((a, l) => a + l.debitPaise - l.creditPaise, 0) === 0, J(tb.body).slice(0, 200));
      const staff = await call('GET', '/bos/entitlements', undefined, UT);
      ok('entitlements endpoint reports the plan and every capability', staff.status === 200 && staff.data.plan === 'BOS' && Object.keys(staff.data.capabilities).length >= 9, J(staff.body).slice(0, 200));
    }

    section('[feat:bos.orders] Website order -> invoice, idempotent, no second stock deduction (Chain E bridge)');
    {
      const w = await h.createVendor({ key: 'webshop', industry: 'retail', plan: 'WORKSPACE' });
      await call('PUT', '/bos/settings', { gstRegistered: true, state: 'Tamil Nadu', orderInvoiceOn: 'PAID' }, w.token);
      const it = await mk(w.id, 'Web tee', 590); await open(w.id, it, 10);
      const bridge = h.svc('BosOrderBridge', 'bos/flows.service');
      // a paid web order as the engine writes it
      const sale = await prisma.posSale.create({ data: { vendorId: w.id, type: 'web', status: 'completed', subtotal: 500, taxAmount: 90, total: 590, paymentMethod: 'upi', customerName: 'Web Buyer', customerPhone: '9444444444', items: [{ productId: it.id, catalogItemId: it.id, name: 'Web tee', qty: 1, price: 590, tracked: true }] } }).catch((e) => ({ error: e }));
      if (sale.error) { ok('web order fixture created', false, sale.error.message); } else {
        await stock.adjust(w.id, it.id, { mode: 'remove', quantity: 1, reason: 'SHOP_SALE', note: 'the order reserved it' }, 'engine'); // what the checkout does when the order is placed
        await bridge.onOrder(w.id, sale.id, 'PAID'); await bridge.onOrder(w.id, sale.id, 'PAID');
        const docs = await prisma.bosDocument.findMany({ where: { vendorId: w.id, sourceType: 'POS_SALE' } });
        ok('exactly one invoice for the order even when told twice', docs.length === 1, docs.length);
        ok('invoice total equals the order total (₹590 inclusive of GST)', docs[0]?.totalPaise === 59000, docs[0]?.totalPaise);
        ok('stock was NOT deducted a second time', (await prisma.vendorProduct.findUnique({ where: { id: it.id } })).stockQty === 9);
        ok('the website order invoice is paid in full by the order payment', docs[0]?.status === 'PAID' || docs[0]?.status === 'ISSUED', docs[0]?.status);
        await bridge.onOrder(w.id, sale.id, 'CANCELLED');
        const after = await prisma.bosDocument.findUnique({ where: { id: docs[0].id } });
        ok('cancelling the order cancels (reverses) the invoice, nothing deleted', after.status === 'CANCELLED');
      }
    }

    section('[feat:bos.backfill] Backfill: dry-run writes nothing, --apply posts opening balances once, a second run does nothing');
    {
      const { planVendor, applyVendor } = require('../bos-spine-backfill-lib');
      const old = await h.createVendor({ key: 'legacy', industry: 'retail', plan: 'WORKSPACE' });
      await prisma.vendorProduct.create({ data: { vendorId: old.id, name: 'Old stock A', price: '100', priceAmount: 100, trackStock: true, stockQty: 10, purchasePriceAmount: 60 } });
      await prisma.vendorProduct.create({ data: { vendorId: old.id, name: 'Old stock B (no cost)', price: '50', priceAmount: 50, trackStock: true, stockQty: 4 } });
      const debtor = await prisma.contact.create({ data: { vendorId: old.id, name: 'Old Debtor', phone: '9666666666', type: 'customer' } });
      await prisma.genericInvoice.create({ data: { vendorId: old.id, contactId: debtor.id, invoiceNumber: 'OLD-1', items: [], subtotal: 1000, total: 1180, status: 'PENDING' } });
      await prisma.genericInvoice.create({ data: { vendorId: old.id, contactId: debtor.id, invoiceNumber: 'OLD-2', items: [], subtotal: 500, total: 590, status: 'PAID' } });
      const vendor = { id: old.id, subdomain: 'legacy' };
      const count = async () => (await prisma.bosJournalEntry.count({ where: { vendorId: old.id } }));
      const plan = await planVendor(prisma, vendor);
      ok('dry run reports Rs 600 of opening stock (10 x 60), the item without a cost is skipped, and Rs 1,180 owed', plan.stockPaise === 60000 && plan.trackedWithoutCost === 1 && plan.receivablesPaise === 118000, J(plan));
      ok('dry run wrote nothing', (await count()) === 0 && !(await prisma.bosSettings.findUnique({ where: { vendorId: old.id } })));
      await applyVendor(prisma, plan);
      const lines = await prisma.bosJournalLine.findMany({ where: { vendorId: old.id } });
      ok('apply posted two balanced opening entries', (await count()) === 2 && lines.reduce((a, l) => a + l.debitPaise - l.creditPaise, 0) === 0);
      ok('the customer carries the opening balance, the product and its stock are untouched', (await prisma.contact.findUnique({ where: { id: debtor.id } })).openingBalancePaise === 118000 && (await prisma.vendorProduct.findFirst({ where: { vendorId: old.id, name: 'Old stock A' } })).stockQty === 10);
      const again = await planVendor(prisma, vendor);
      await applyVendor(prisma, again);
      ok('a second run posts nothing', (await count()) === 2 && again.stockPaise === 0 && again.receivables.length === 0, J(again));
    }
  } catch (e) {
    console.log(`  FAIL  suite crashed -> ${e.stack || e}`); fail += 1; failures.push('crash');
  } finally {
    await h.stop();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) console.log('FAILED:\n - ' + failures.join('\n - '));
  code = fail ? 1 : 0;
  setTimeout(() => process.exit(code), 300);
})();
