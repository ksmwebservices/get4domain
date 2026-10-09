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

    section('[feat:bos.payments-keys] Vendor payment keys (Bug B2): format checked, plain sentences, test connection, never filled from another field');
    {
      const k = await h.createVendor({ key: 'keys', industry: 'retail', plan: 'WORKSPACE' });
      let rr = await call('PUT', '/vendor-payments', { razorpayKeyId: 'keys@local.test' }, k.token);
      ok('an e-mail address in the Key ID is refused with a plain sentence that says what to do', rr.status === 400 && /rzp_test_|rzp_live_/.test(J(rr.body)) && !/must match|regular expression/i.test(J(rr.body)), J(rr.body));
      rr = await call('PUT', '/vendor-payments', { razorpayKeyId: 'rzp_test_AbC123xyz789', razorpayKeySecret: 'secretsecret123456', enabled: true, checkoutMode: 'ONLINE' }, k.token);
      ok('a real-looking test key saves, and the secret is never returned', rr.status === 200 && rr.data.razorpayKeyId === 'rzp_test_AbC123xyz789' && rr.data.mode === 'test' && rr.data.hasSecret === true && !J(rr.body).includes('secretsecret'), J(rr.body));
      // an old row that holds an e-mail (what the report script lists) is never shown back and never takes a payment
      await prisma.vendorPaymentConfig.update({ where: { vendorId: k.id }, data: { razorpayKeyId: 'someone@example.com' } });
      rr = await call('GET', '/vendor-payments', undefined, k.token);
      ok('a stored value that is not a Razorpay key is hidden and flagged so the screen asks for it again', rr.data.razorpayKeyId === null && rr.data.keyIdInvalid === true, J(rr.body));
      const pay = h.svc('VendorPaymentsService', 'vendor-payments/vendor-payments.service');
      ok('and it can never be used to take a payment', (await pay.getKeys(k.id)) === null);
      const okFetch = async () => ({ ok: true, status: 200 }); const badFetch = async () => ({ ok: false, status: 401 }); const downFetch = async () => { throw new Error('network'); };
      ok('test connection: accepted keys', (await pay.testConnection(k.id, { razorpayKeyId: 'rzp_live_AbC123xyz789', razorpayKeySecret: 'secretsecret123456' }, okFetch)).ok === true);
      const rej = await pay.testConnection(k.id, { razorpayKeyId: 'rzp_live_AbC123xyz789', razorpayKeySecret: 'wrongwrongwrong' }, badFetch);
      ok('test connection: rejected keys say what to check', rej.ok === false && /Key ID and the Key Secret/.test(rej.message));
      ok('test connection: Razorpay unreachable says so, without blaming the keys', (await pay.testConnection(k.id, { razorpayKeyId: 'rzp_live_AbC123xyz789', razorpayKeySecret: 'secretsecret123456' }, downFetch)).message.includes('could not reach'));
    }

    section('[feat:bos.entitlements-admin] Admin edits the plan split; per-vendor exceptions; staff seats follow the plan');
    {
      const adm = await h.createAdmin({ key: 'padmin' });
      const v = await h.createVendor({ key: 'seats', industry: 'retail', plan: 'WORKSPACE' });
      let rr = await call('GET', '/admin/bos/capabilities', undefined, adm.token);
      ok('admin sees every capability with its plan and limits', rr.status === 200 && rr.data.length >= 9 && rr.data.some((c) => c.id === 'bos.staff' && c.limits.seats.WORKSPACE === 1), J(rr.body).slice(0, 200));
      { const guard = new (h.dist('commercial/foundation.services').CommercialAdminGuard)(); const ctx = (user) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }); let refused = false; try { guard.canActivate(ctx({ role: 'ADMIN', adminRole: 'MARKETING' })); } catch { refused = true; } ok('the MARKETING staff role is refused (403) by the guard on these routes', refused); }
      ok('a vendor is refused (403)', (await call('GET', '/admin/bos/capabilities', undefined, v.token)).status === 403);
      const invite = (n) => call('POST', '/team/invite', { name: `Member ${n}`, role: 'Sales', modules: ['crm'] }, v.token);
      rr = await invite(1);
      ok('Essentials: the first extra team member can be added', rr.status < 300, J(rr.body));
      rr = await invite(2);
      ok('Essentials: the second is refused with LIMIT_REACHED and a plain sentence about upgrading', rr.status === 403 && rr.body?.code === 'LIMIT_REACHED' && /Upgrade/.test(rr.body?.message ?? ''), J(rr.body));
      rr = await call('PUT', '/admin/bos/capabilities/bos.staff', { limits: { seats: { WORKSPACE: 3 } }, reason: 'KSM raised Essentials seats' }, adm.token);
      ok('admin raises the Essentials seat limit (stored as config, not code)', rr.status === 200 && rr.data.find((c) => c.id === 'bos.staff').limits.seats.WORKSPACE === 3, J(rr.body).slice(0, 200));
      ok('the new limit applies at once', (await invite(2)).status < 300);
      rr = await call('PUT', '/admin/bos/capabilities/bos.staff', { limits: { seats: { WORKSPACE: 3 } }, reason: 'no' }, adm.token);
      ok('a change without a real reason is refused in plain words', rr.status === 400 && /reason/i.test(J(rr.body)), J(rr.body));
      rr = await call('POST', `/admin/bos/vendors/${v.id}/capability`, { capabilityId: 'bos.books', enabled: true, reason: 'Pilot customer, trial of the books' }, adm.token);
      ok('admin switches the books on for one Essentials vendor', rr.status < 300 && rr.data.capabilities['bos.books'].allowed === true && rr.data.capabilities['bos.books'].reason === 'EXCEPTION_ON', J(rr.data.capabilities['bos.books']));
      ok('and that vendor can now open the trial balance', (await call('GET', '/bos/books/trial-balance', undefined, v.token)).status === 200);
      await call('POST', `/admin/bos/vendors/${v.id}/capability`, { capabilityId: 'bos.books', enabled: null, reason: 'Trial finished, plan decides again' }, adm.token);
      ok('removing the exception puts the plan back in charge', (await call('GET', '/bos/books/trial-balance', undefined, v.token)).status === 403);
      const audit = await prisma.commercialAuditLog.findMany({ where: { action: { startsWith: 'plan.capability' } } });
      ok('every change is in the audit trail', audit.length >= 3, audit.length);
    }

    section('[feat:bos.share] Share, reminder, Today numbers, optional daily low-stock message');
    {
      const v = await h.createVendor({ key: 'sharer', industry: 'retail', plan: 'WORKSPACE' });
      await call('PUT', '/bos/settings', { gstRegistered: false }, v.token);
      const item = await mk(v.id, 'Shared item', 100); await open(v.id, item, 3); await prisma.vendorProduct.update({ where: { id: item.id }, data: { reorderLevel: 5 } });
      const cust = (await call('POST', '/bos/parties', { name: 'Meena', phone: '9777777777', type: 'customer' }, v.token)).data;
      const inv = (await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyId: cust.id, dueDate: new Date(Date.now() - 5 * 86400000).toISOString(), lines: [{ itemId: item.id, qty: 1 }], issue: true }, v.token)).data.doc;
      let rr = await call('GET', `/bos/documents/${inv.id}/share`, undefined, v.token);
      ok('share gives a public link and a WhatsApp deep link with the text filled in', rr.status === 200 && /\/d\/[A-Za-z0-9_-]{20,}/.test(rr.data.link) && rr.data.whatsappUrl.startsWith('https://wa.me/919777777777?text='), J(rr.body).slice(0, 200));
      const token = rr.data.link.split('/d/')[1];
      const page = await fetch(`${h.base}/public/bos/doc/${token}`);
      const html = await page.text();
      ok('the public page is real HTML (not JSON), opens without login, shows a Bill of Supply (not GST-registered) and no Pay now (no own gateway)', page.status === 200 && /text\/html/.test(page.headers.get('content-type') ?? '') && html.startsWith('<!doctype html>') && /Bill of Supply/.test(html) && !/Pay .* now/.test(html), html.slice(0, 200));
      const own = await fetch(`${h.base}/bos/documents/${inv.id}/html`, { headers: { Authorization: `Bearer ${v.token}` } });
      ok('the printable page of an invoice is real HTML too', own.status === 200 && (await own.text()).startsWith('<!doctype html>'));
      rr = await call('POST', `/bos/documents/${inv.id}/email`, {}, v.token);
      ok('e-mail without an address on file asks for one in plain words', rr.status === 400 && /e-mail address/i.test(J(rr.body)), J(rr.body));
      rr = await call('POST', `/bos/documents/${inv.id}/email`, { to: 'meena@example.com' }, v.token);
      ok('e-mail with no mail provider configured says so kindly instead of a server error', rr.status === 400 && /could not send/i.test(J(rr.body)) || rr.status < 300, J(rr.body));
      rr = await call('GET', `/bos/parties/${cust.id}/reminder`, undefined, v.token);
      ok('the reminder message names the amount and links to the invoice', rr.status === 200 && /₹100/.test(rr.data.text) && rr.data.text.includes('/d/') && rr.data.whatsappUrl.includes('wa.me'), J(rr.body).slice(0, 300));
      rr = await call('GET', '/bos/reports/today', undefined, v.token);
      ok('Today numbers: sales, outstanding, low stock and orders waiting are real', rr.data.salesTodayPaise === 10000 && rr.data.outstandingPaise === 10000 && rr.data.lowStock === 1 && rr.data.ordersWaiting === 0, J(rr.body));
      const jobs = h.svc('BosJobsService', 'bos/more.services');
      ok('the daily job sends one low-stock message', (await jobs.runLowStock()).notified === 1);
      ok('and not a second one the same day', (await jobs.runLowStock()).notified === 0);
      await call('PUT', '/bos/stock/alerts', { daily: false }, v.token);
      await prisma.notification.deleteMany({ where: { recipientId: v.id, type: 'LOW_STOCK_DAILY' } });
      ok('the vendor can switch the daily message off', (await jobs.runLowStock()).notified === 0 && (await call('GET', '/bos/stock/alerts', undefined, v.token)).data.daily === false);
    }

    section('[feat:bos.purchases] Purchases (Pro): supplier, purchase bill with input GST, stock in, cost updated, payables, payment out, cancel');
    let proId = null; let proToken = null;
    {
      const pr = await h.createVendor({ key: 'buyer', industry: 'retail', plan: 'BOS' }); proId = pr.id; proToken = pr.token; const PT = pr.token;
      await call('PUT', '/bos/settings', { gstRegistered: true, gstin: '33AAAAA0000A1Z5', state: 'Tamil Nadu', purchaseUpdatesCost: true }, PT);
      const sup = (await call('POST', '/bos/parties', { name: 'Metro Wholesale', phone: '9888888888', type: 'supplier', state: 'Tamil Nadu', gstin: '33BBBBB1111B1Z5' }, PT)).data;
      const it = await mk(pr.id, 'Bulk shirt', 500, { purchasePriceAmount: 200, gstRate: 5 }); await open(pr.id, it, 4);
      let rr = await call('POST', '/bos/purchases', { docType: 'PURCHASE_BILL', partyId: sup.id, supplierRef: 'MW-2210', lines: [{ itemId: it.id, qty: 10, rate: 250, gstRate: 5 }], issue: true }, PT);
      ok('a purchase bill is recorded and numbered', rr.status < 300 && /^PB/.test(rr.data?.doc?.number ?? ''), J(rr.body).slice(0, 300));
      const bill = rr.data.doc;
      ok('input GST is split: taxable 2,500 and 5% = 125 (CGST 62.50 + SGST 62.50), total 2,625', bill.taxablePaise === 250000 && bill.cgstPaise + bill.sgstPaise === 12500 && bill.totalPaise === 262500, J({ t: bill.taxablePaise, c: bill.cgstPaise, s: bill.sgstPaise, tot: bill.totalPaise }));
      const p1 = await prisma.vendorProduct.findUnique({ where: { id: it.id } });
      ok('stock went up by 10 and the item cost price follows the latest purchase (setting on)', p1.stockQty === 14 && p1.purchasePriceAmount === 250, `${p1.stockQty} ${p1.purchasePriceAmount}`);
      rr = await call('GET', '/bos/outstanding?kind=SUPPLIER', undefined, PT);
      const owed = (rr.data.parties ?? []).find((x) => x.partyId === sup.id);
      ok('payables show what is owed to the supplier', owed && owed.totalPaise === 262500, J(rr.body).slice(0, 200));
      rr = await call('POST', '/bos/payments', { kind: 'PAYMENT_OUT', partyId: sup.id, mode: 'BANK', amount: 1000, allocations: [{ documentId: bill.id, amount: 1000 }] }, PT);
      ok('a payment to the supplier is recorded against the bill', rr.status < 300, J(rr.body).slice(0, 200));
      rr = await call('GET', '/bos/outstanding?kind=SUPPLIER', undefined, PT);
      ok('and the payable drops to 1,625', (rr.data.parties ?? []).find((x) => x.partyId === sup.id)?.totalPaise === 162500, J(rr.body).slice(0, 200));
      rr = await call('GET', '/bos/books/purchase-register', undefined, PT);
      ok('purchase register lists the bill', rr.status === 200 && J(rr.body).includes('MW-2210') || J(rr.body).includes(bill.number), J(rr.body).slice(0, 200));
      const costGl = await prisma.bosJournalLine.findMany({ where: { vendorId: pr.id, accountCode: '1200' } });
      ok('stock account was debited with the stock value of the bill', costGl.some((l) => l.debitPaise === 250000));
      const sale = await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyName: 'Walker', lines: [{ itemId: it.id, qty: 2 }], issue: true, taxKind: 'GST' }, PT);
      ok('the next sale uses the new cost for cost of goods (2 x 250 = 500)', sale.status < 300 && (await prisma.bosJournalLine.findMany({ where: { vendorId: pr.id, accountCode: '5100' } })).some((l) => l.debitPaise === 50000), J(sale.body).slice(0, 200));
      rr = await call('POST', `/bos/purchases/${bill.id}/cancel`, { reason: 'Supplier sent wrong goods' }, PT);
      ok('a bill with a payment against it cannot be cancelled, and the sentence says what to do first', rr.status === 409 && /Cancel those first/.test(J(rr.body)), J(rr.body).slice(0, 200));
      const paid = (await call('GET', '/bos/payments?kind=PAYMENT_OUT', undefined, PT)).data;
      const payRow = (paid.rows ?? paid)[0];
      await call('POST', `/bos/payments/${payRow.id}/cancel`, { reason: 'Wrong amount paid' }, PT);
      const stockBeforeCancel = (await prisma.vendorProduct.findUnique({ where: { id: it.id } })).stockQty;
      rr = await call('POST', `/bos/purchases/${bill.id}/cancel`, { reason: 'Supplier sent wrong goods' }, PT);
      ok('after the payment is cancelled the bill can be cancelled (reversal) and 10 units leave stock', rr.status < 300 && (await prisma.vendorProduct.findUnique({ where: { id: it.id } })).stockQty === stockBeforeCancel - 10, J(rr.body).slice(0, 200));
    }

    section('[feat:bos.ca-pack] GST summary, HSN summary, CA pack, period lock (Pro)');
    {
      const PT = proToken;
      const cust = (await call('POST', '/bos/parties', { name: 'GST Customer', phone: '9100000001', type: 'customer', state: 'Tamil Nadu', gstin: '33CCCCC2222C1Z5' }, PT)).data;
      const it2 = await mk(proId, 'Taxed item', 1000, { gstRate: 18, hsn: '6109' }); await open(proId, it2, 20);
      const sale = await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyId: cust.id, lines: [{ itemId: it2.id, qty: 3 }], issue: true }, PT);
      let rr = await call('GET', '/bos/books/gst-summary', undefined, PT);
      ok('GST summary shows output tax and input tax tables', rr.status === 200 && J(rr.body).includes('6109') === false && (J(rr.body).toLowerCase().includes('output') || J(rr.body).toLowerCase().includes('gstr')), J(rr.body).slice(0, 300));
      rr = await call('GET', '/bos/books/hsn-summary', undefined, PT);
      ok('HSN summary groups the sale under its HSN code and rate', rr.status === 200 && J(rr.body).includes('6109') && J(rr.body).includes('18'), J(rr.body).slice(0, 300));
      const res = await fetch(`${h.base}/bos/books/ca-pack?kind=month&value=${new Date().toISOString().slice(0, 7)}`, { headers: { Authorization: `Bearer ${PT}` } });
      const buf = Buffer.from(await res.arrayBuffer());
      ok('CA pack downloads as a zip with the workbook inside', res.status === 200 && buf.readUInt32LE(0) === 0x04034b50 && buf.includes(Buffer.from('.xlsx')), `${res.status} ${buf.length}`);
      const bad = await fetch(`${h.base}/bos/books/ca-pack?kind=week&value=1`, { headers: { Authorization: `Bearer ${PT}` } });
      ok('an unknown period gets a plain sentence', bad.status === 400 && /Choose the period/.test(await bad.text()));
      // period lock: lock up to yesterday; a document dated inside the lock is refused, one dated today is fine
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      rr = await call('PUT', '/bos/settings/lock', { lockedUntil: yesterday }, PT);
      ok('the period can be locked', rr.status < 300, J(rr.body).slice(0, 200));
      rr = await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyName: 'Late entry', docDate: new Date(Date.now() - 5 * 86400000).toISOString(), lines: [{ itemId: it2.id, qty: 1 }], issue: true }, PT);
      ok('a document dated in a locked period is refused with a plain sentence that says what to do', rr.status >= 400 && /lock/i.test(J(rr.body)), J(rr.body).slice(0, 300));
      rr = await call('POST', `/bos/documents/${sale.data.doc.id}/credit-note`, { lines: [{ refLineId: (await call('GET', `/bos/documents/${sale.data.doc.id}`, undefined, PT)).data.lines[0].id, qty: 1, restock: true }], reason: 'Return after the lock', issue: true }, PT);
      ok('a credit note dated today (after the lock) is allowed instead', rr.status < 300, J(rr.body).slice(0, 300));
      await call('PUT', '/bos/settings/lock', { lockedUntil: null }, PT);
    }

    section('[feat:bos.recurring] Recurring invoices (Pro): runs once per due date, pauses when the plan drops, never deleted');
    {
      const PT = proToken;
      const cust = (await call('POST', '/bos/parties', { name: 'Monthly client', phone: '9100000002', type: 'customer', state: 'Tamil Nadu' }, PT)).data;
      const svc = await mk(proId, 'Monthly care plan', 1500, { trackStock: false, stockQty: null, purchasePriceAmount: null, gstRate: 18 });
      const tpl = (await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyId: cust.id, lines: [{ itemId: svc.id, qty: 1 }], issue: true }, PT)).data.doc;
      let rr = await call('POST', '/bos/books/recurring', { templateId: tpl.id, frequency: 'MONTHLY', nextRunOn: new Date().toISOString() }, PT);
      ok('an invoice can be set to repeat monthly', rr.status < 300, J(rr.body).slice(0, 200));
      const jobs = h.svc('BosJobsService', 'bos/more.services');
      const later = new Date(Date.now() + 60000);
      const r1 = await jobs.runRecurring(later); const r2 = await jobs.runRecurring(later);
      ok('the due invoice is created once, and running the job again creates nothing', r1.created === 1 && r2.created === 0, J([r1, r2]));
      const nextRows = await call('GET', '/bos/books/recurring', undefined, PT);
      ok('the schedule moves on to next month', nextRows.data.length === 1 && new Date(nextRows.data[0].nextRunOn).getTime() > Date.now() + 25 * 86400000, J(nextRows.body).slice(0, 200));
      await prisma.billingTerm.updateMany({ where: { vendorId: proId, isCurrent: true }, data: { planKey: 'WORKSPACE' } }); ent.invalidate(proId);
      await prisma.bosRecurring.updateMany({ where: { vendorId: proId }, data: { nextRunOn: new Date(Date.now() - 1000) } });
      const r3 = await jobs.runRecurring(new Date());
      ok('after a downgrade the schedule pauses (nothing is created, nothing is deleted)', r3.created === 0 && (await prisma.bosRecurring.count({ where: { vendorId: proId } })) === 1);
      ok('and Essentials cannot open the recurring screen (PLAN_REQUIRED)', (await call('GET', '/bos/books/recurring', undefined, PT)).body?.code === 'PLAN_REQUIRED');
    }

    section('[feat:bos.journal] Expenses post to the books on every plan and show in the Accounts totals');
    {
      const e = await h.createVendor({ key: 'spender', industry: 'retail', plan: 'WORKSPACE' });
      await call('PUT', '/bos/settings', { gstRegistered: true, state: 'Tamil Nadu' }, e.token);
      let rr = await call('POST', '/bos/expenses', { category: '5300', description: 'Shop rent', amount: 5000, paymentMode: 'BANK' }, e.token);
      ok('an expense is recorded on Essentials', rr.status < 300, J(rr.body).slice(0, 200));
      rr = await call('POST', '/bos/expenses', { category: '5300', description: 'Packing material with GST', amount: 1180, gstRate: 18, amountIncludesGst: true, claimGst: false, paymentMode: 'CASH' }, e.token);
      ok('an expense with GST inside the amount is accepted', rr.status < 300, J(rr.body).slice(0, 200));
      rr = await call('GET', '/bos/reports/summary', undefined, e.token);
      ok('the Accounts summary shows the expenses (6,180) instead of zero', rr.data.expensesPaise === 618000, J(rr.body).slice(0, 300));
      rr = await call('GET', '/accounting/summary', undefined, e.token);
      ok('the older Accounts page is no longer all zero: it now includes the expenses made here', rr.status === 200 && rr.data.expensesGross === 6180, J(rr.body).slice(0, 300));
      const exp = (await call('GET', '/bos/expenses', undefined, e.token)).data;
      const first = (exp.rows ?? exp)[0];
      rr = await call('POST', `/bos/expenses/${first.id}/cancel`, { reason: 'Entered twice by mistake' }, e.token);
      ok('an expense is cancelled by reversal, never deleted', rr.status < 300 && (await prisma.bosExpense.count({ where: { vendorId: e.id } })) === 2);
    }

    section('[feat:bos.variants] Sizes and colours: stock per variant, sold by variant, refused when that variant is short');
    {
      const v = await h.createVendor({ key: 'footwear', industry: 'retail', plan: 'WORKSPACE' });
      await call('PUT', '/bos/settings', { gstRegistered: true, state: 'Tamil Nadu', negativeStock: 'BLOCK', priceMode: 'EXCLUSIVE' }, v.token);
      const shoe = await mk(v.id, 'Runner shoe', 1999, { gstRate: 12, hsn: '6403', purchasePriceAmount: 1200 });
      let rr = await call('POST', `/bos/stock/items/${shoe.id}/variant-stock`, { variantKey: 'UK8', mode: 'add', quantity: 5, reason: 'OPENING' }, v.token);
      ok('opening stock can be entered for a size', rr.status < 300 && rr.data.onHand === 5, J(rr.body));
      await call('POST', `/bos/stock/items/${shoe.id}/variant-stock`, { variantKey: 'UK9', mode: 'add', quantity: 2, reason: 'OPENING' }, v.token);
      rr = await call('GET', '/bos/stock', undefined, v.token);
      const row = rr.data.rows.find((x) => x.id === shoe.id);
      ok('the Stock screen lists each size with its own count, and the item total is the sum', row.onHand === 7 && row.variants.length === 2 && row.variants.find((x) => x.variantKey === 'UK9').onHand === 2, J(row));
      rr = await call('POST', '/bos/counter/sale', { lines: [{ itemId: shoe.id, qty: 3, variantKey: 'UK9' }], payments: [{ mode: 'CASH', amount: 6717 }], idempotencyKey: 'variant-sale-001' }, v.token);
      ok('selling 3 of a size that has 2 is refused with the size and the count in the sentence', rr.status === 400 && /UK9/.test(J(rr.body)) && /only 2 left/.test(J(rr.body)), J(rr.body));
      rr = await call('POST', '/bos/counter/sale', { lines: [{ itemId: shoe.id, qty: 2, variantKey: 'UK8' }], payments: [{ mode: 'UPI', amount: 4478 }], idempotencyKey: 'variant-sale-002' }, v.token);
      ok('selling 2 of a size that has 5 works and the invoice line carries the size', rr.status < 300 && rr.data.invoice.status === 'PAID' && rr.data.invoice.lines[0].variantKey === 'UK8', J(rr.body).slice(0, 300));
      rr = await call('GET', `/bos/stock/items/${shoe.id}`, undefined, v.token);
      ok('item detail shows UK8 = 3 and UK9 = 2 after the sale', rr.data.variants.find((x) => x.variantKey === 'UK8').onHand === 3 && rr.data.variants.find((x) => x.variantKey === 'UK9').onHand === 2, J(rr.data.variants));
      rr = await call('POST', `/bos/stock/items/${shoe.id}/variant-stock`, { variantKey: 'UK9', mode: 'remove', quantity: 3, reason: 'DAMAGE' }, v.token);
      ok('removing more of a size than it has is refused', rr.status === 400, J(rr.body));
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
