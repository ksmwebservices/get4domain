// Starts the real API on a throw-away in-memory Postgres (PGlite), seeds two shops (Essentials and Pro) with realistic business records, prints the
// logins and stays up so the dashboard can be driven in a browser. Local only: nothing here can reach a real database.
//   node scripts/bos/walkthrough-server.js            (API on http://127.0.0.1:3091)
const fs = require('fs');
const path = require('path');
const { startHarness } = require('../e2e/bos-harness');

(async () => {
  const h = await startHarness({ port: 3091, pgPort: 54340 });
  const { prisma, call } = h;
  const stock = h.svc('StockService', 'stock/stock.service');
  const open = (vid, p, q) => prisma.$transaction((tx) => stock.setOpening(tx, vid, p.id, q, 'seed'));
  const mk = (vid, name, price, cost, gst, hsn, extra = {}) => prisma.vendorProduct.create({ data: { vendorId: vid, name, price: String(price), priceAmount: price, trackStock: true, stockQty: 0, hsn, gstRate: gst, purchasePriceAmount: cost, sku: name.slice(0, 3).toUpperCase() + Math.floor(price), active: true, ...extra } });

  const out = {};
  for (const [key, plan] of [['essentials', 'WORKSPACE'], ['pro', 'BOS']]) {
    const v = await h.createVendor({ key: `walk-${key}`, industry: 'retail', plan, subdomain: `walk${key}` });
    await prisma.vendor.update({ where: { id: v.id }, data: { businessName: key === 'pro' ? 'Metro Footwear' : 'Step Right Shoes' } });
    const T = v.token;
    await call('PUT', '/bos/settings', { gstRegistered: true, gstin: '33AAAAA0000A1Z5', state: 'Tamil Nadu', legalName: key === 'pro' ? 'Metro Footwear' : 'Step Right Shoes', upiId: 'stepright@okbank', bankDetails: 'Step Right Shoes, A/c 000123456789, IFSC TEST0001234', priceMode: 'EXCLUSIVE', roundOff: true }, T);
    const runner = await mk(v.id, 'Runner shoe', 1999, 1200, 12, '6403');
    const sandal = await mk(v.id, 'Leather sandal', 1299, 700, 12, '6402');
    const socks = await mk(v.id, 'Sports socks (pair)', 199, 90, 12, '6115', { reorderLevel: 20 });
    const polish = await mk(v.id, 'Shoe polish', 120, 55, 18, '3405', { reorderLevel: 10 });
    await prisma.vendorProduct.create({ data: { vendorId: v.id, name: 'Shoe repair (service)', price: '250', priceAmount: 250, trackStock: false, stockQty: null, gstRate: 18, hsn: '9987', active: true } });
    for (const [p, q] of [[runner, 14], [sandal, 9], [socks, 6], [polish, 40]]) await open(v.id, p, q);
    await call('POST', `/bos/stock/items/${runner.id}/variant-stock`, { variantKey: 'UK8', mode: 'add', quantity: 4, reason: 'OPENING' }, T).catch(() => null);
    const cust = [];
    for (const [name, phone, gstin] of [['Asha Stores', '9876500001', '33CCCCC2222C1Z5'], ['Ravi Kumar', '9876500002', null], ['Meena Traders', '9876500003', null]]) {
      cust.push((await call('POST', '/bos/parties', { name, phone, type: 'customer', state: 'Tamil Nadu', ...(gstin ? { gstin } : {}) }, T)).data);
    }
    const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
    const i1 = (await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyId: cust[0].id, docDate: day(12), dueDate: day(-2), lines: [{ itemId: runner.id, qty: 3 }, { itemId: socks.id, qty: 6 }], issue: true }, T)).data.doc;
    await call('POST', '/bos/payments', { kind: 'RECEIPT', partyId: cust[0].id, mode: 'UPI', amount: 3000, allocations: [{ documentId: i1.id, amount: 3000 }] }, T);
    const i2 = (await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyId: cust[1].id, docDate: day(5), lines: [{ itemId: sandal.id, qty: 2 }], issue: true }, T)).data.doc;
    await call('POST', '/bos/payments', { kind: 'RECEIPT', partyId: cust[1].id, mode: 'CASH', amount: 2910, allocations: [{ documentId: i2.id, amount: 2910 }] }, T);
    await call('POST', '/bos/documents', { docType: 'SALES_INVOICE', partyId: cust[2].id, docDate: day(40), dueDate: day(30), lines: [{ itemId: polish.id, qty: 5 }, { name: 'Shoe repair (service)', qty: 2, rate: 250 }], issue: true }, T);
    await call('POST', '/bos/documents', { docType: 'QUOTE', partyId: cust[2].id, lines: [{ itemId: runner.id, qty: 10 }], issue: true }, T);
    await call('POST', '/bos/counter/sale', { lines: [{ itemId: socks.id, qty: 2 }], payments: [{ mode: 'CASH', amount: 446 }], idempotencyKey: `walk-${key}-counter-1` }, T);
    const sec = (await call('GET', `/bos/documents/${i1.id}`, undefined, T)).data;
    await call('POST', `/bos/documents/${i1.id}/credit-note`, { lines: [{ refLineId: sec.lines[1].id, qty: 1, restock: true }], reason: 'One pair returned', issue: true }, T);
    for (const [cat, d, a, m] of [['5300', 'Shop rent', 12000, 'BANK'], ['5400', 'Electricity bill', 2300, 'UPI']]) await call('POST', '/bos/expenses', { category: cat, description: d, amount: a, paymentMode: m }, T);
    if (plan === 'BOS') {
      const sup = (await call('POST', '/bos/parties', { name: 'Metro Wholesale', phone: '9888800001', type: 'supplier', state: 'Tamil Nadu', gstin: '33BBBBB1111B1Z5' }, T)).data;
      await call('POST', '/bos/purchases', { docType: 'PURCHASE_BILL', partyId: sup.id, supplierRef: 'MW-2210', lines: [{ itemId: runner.id, qty: 10, rate: 1250, gstRate: 12 }], issue: true }, T);
    }
    out[key] = { email: v.email, password: v.password, token: T, id: v.id };
  }
  fs.writeFileSync(path.join(process.env.TEMP || '.', 'bos-walkthrough-logins.json'), JSON.stringify(out, null, 2));
  console.log('WALKTHROUGH API READY on http://127.0.0.1:3091');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { email: v.email, password: v.password }])), null, 2));
})().catch((e) => { console.error('SEED FAILED', e); process.exit(1); });
