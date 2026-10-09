// Full BOS spine backfill (logic). Takes a PrismaClient so the CLI and the PGlite test share the same code.
//
// What it does, per vendor, and nothing else ("opening balances only"):
//   1. makes sure the vendor has BOS settings and the chart of accounts;
//   2. posts ONE opening entry for stock on hand: tracked items x purchase price, against owner capital;
//   3. for every customer who still owes money on an old (pre-BOS) invoice, sets their opening balance and posts it as a receivable.
// It never creates old invoices, never changes a product, a stock quantity, a contact's details or any existing record.
// Every posting has a fixed source id, so running it twice does nothing the second time.
const path = require('path');
const dist = (p) => require(path.join(__dirname, '..', 'dist', 'src', p));

const OPEN_STATUSES_NOT = ['PAID', 'CANCELLED', 'VOID', 'DRAFT'];
const toPaise = (rupees) => Math.round((Number(rupees) || 0) * 100);

async function planVendor(prisma, vendor) {
  const [settings, stockPosted, products, invoices] = await Promise.all([
    prisma.bosSettings.findUnique({ where: { vendorId: vendor.id } }),
    prisma.bosJournalEntry.findFirst({ where: { vendorId: vendor.id, sourceType: 'OPENING', sourceId: 'backfill:stock' }, select: { id: true } }),
    prisma.vendorProduct.findMany({ where: { vendorId: vendor.id, trackStock: true, stockQty: { gt: 0 } }, select: { id: true, stockQty: true, purchasePriceAmount: true } }),
    prisma.genericInvoice.findMany({ where: { vendorId: vendor.id, status: { notIn: OPEN_STATUSES_NOT } }, select: { contactId: true, total: true } }),
  ]);
  const withCost = products.filter((p) => p.purchasePriceAmount && p.purchasePriceAmount > 0);
  const stockPaise = stockPosted ? 0 : withCost.reduce((a, p) => a + Math.round(p.stockQty * toPaise(p.purchasePriceAmount)), 0);
  const owedBy = new Map();
  for (const i of invoices) owedBy.set(i.contactId, (owedBy.get(i.contactId) ?? 0) + toPaise(i.total));
  const posted = await prisma.bosJournalEntry.findMany({ where: { vendorId: vendor.id, sourceType: 'OPENING', sourceId: { startsWith: 'backfill:receivable:' } }, select: { sourceId: true } });
  const done = new Set(posted.map((p) => p.sourceId.replace('backfill:receivable:', '')));
  const receivables = [...owedBy.entries()].filter(([contactId, v]) => v > 0 && !done.has(contactId)).map(([partyId, amountPaise]) => ({ partyId, amountPaise }));
  return {
    vendorId: vendor.id, subdomain: vendor.subdomain, hasSettings: Boolean(settings), stockAlreadyPosted: Boolean(stockPosted),
    stockItems: stockPosted ? 0 : withCost.length, stockPaise, trackedWithoutCost: products.length - withCost.length,
    receivables, receivablesPaise: receivables.reduce((a, r) => a + r.amountPaise, 0),
  };
}

async function applyVendor(prisma, plan) {
  const { ChartService } = dist('bos/core.services');
  const { openingLines } = dist('bos/posting-rules');
  const result = { settingsCreated: false, stockEntry: false, receivableEntries: 0 };
  await prisma.$transaction(async (tx) => {
    if (!plan.hasSettings) { await tx.bosSettings.create({ data: { vendorId: plan.vendorId } }); result.settingsCreated = true; }
    await new ChartService().ensure(tx, plan.vendorId);
    const post = (sourceId, memo, lines) => tx.bosJournalEntry.create({
      data: { vendorId: plan.vendorId, entryDate: new Date(), sourceType: 'OPENING', sourceId, sourceVersion: 1, memo, lines: { create: lines.map((l) => ({ vendorId: plan.vendorId, accountCode: l.accountCode, partyId: l.partyId ?? null, debitPaise: l.debitPaise, creditPaise: l.creditPaise })) } },
    });
    if (plan.stockPaise > 0) { await post('backfill:stock', 'Opening stock at cost (backfill)', openingLines({ stockPaise: plan.stockPaise, receivables: [], payables: [] })); result.stockEntry = true; }
    for (const r of plan.receivables) {
      const c = await tx.contact.findFirst({ where: { id: r.partyId, vendorId: plan.vendorId }, select: { id: true, openingBalancePaise: true, name: true } });
      if (!c) continue;
      if (!c.openingBalancePaise) await tx.contact.update({ where: { id: c.id }, data: { openingBalancePaise: r.amountPaise } });
      await post(`backfill:receivable:${r.partyId}`, `Opening balance: ${c.name} (backfill)`, openingLines({ stockPaise: 0, receivables: [{ partyId: r.partyId, amountPaise: r.amountPaise }], payables: [] }));
      result.receivableEntries += 1;
    }
  });
  return result;
}

/** Which vendors: one by subdomain (--vendor), otherwise every vendor that has products or contacts. */
async function pickVendors(prisma, slug) {
  if (slug) return prisma.vendor.findMany({ where: { subdomain: slug }, select: { id: true, subdomain: true } });
  return prisma.vendor.findMany({ where: { OR: [{ products: { some: {} } }, { contacts: { some: {} } }] }, select: { id: true, subdomain: true }, orderBy: { createdAt: 'asc' } });
}

module.exports = { planVendor, applyVendor, pickVendors };
