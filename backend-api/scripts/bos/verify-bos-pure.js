// Full BOS: the pure rule book — GST math against a hand-computed table, every document type's journal balances, a reversal nets every
// account to zero, financial years, the xlsx/zip writer. No database. Run `npx nest build` first.
const path = require('path');
const dist = (p) => require(path.join(__dirname, '..', '..', 'dist', 'src', p));
const G = dist('bos/gst');
const P = dist('bos/posting-rules');
const O = dist('bos/export/office');

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

section('[feat:bos.gst] GST engine: hand-computed table');
{
  // every case: [label, lines, ctx, opts, expected {taxable, cgst, sgst, igst, total}]
  const ex = (intra = true, taxKind = 'GST') => ({ taxKind, priceMode: 'EXCLUSIVE', intraState: intra });
  const inc = (intra = true) => ({ taxKind: 'GST', priceMode: 'INCLUSIVE', intraState: intra });
  const cases = [
    ['exclusive 18% inside the state: 1 x ₹1,000', [{ qty: 1, ratePaise: 100000, gstRate: 18 }], ex(), {}, { taxable: 100000, cgst: 9000, sgst: 9000, igst: 0, total: 118000 }],
    ['exclusive 18% outside the state → IGST', [{ qty: 1, ratePaise: 100000, gstRate: 18 }], ex(false), {}, { taxable: 100000, cgst: 0, sgst: 0, igst: 18000, total: 118000 }],
    ['inclusive 18%: ₹1,180 contains ₹180 GST', [{ qty: 1, ratePaise: 118000, gstRate: 18 }], inc(), {}, { taxable: 100000, cgst: 9000, sgst: 9000, igst: 0, total: 118000 }],
    ['inclusive 5%: ₹105 contains ₹5', [{ qty: 1, ratePaise: 10500, gstRate: 5 }], inc(), {}, { taxable: 10000, cgst: 250, sgst: 250, igst: 0, total: 10500 }],
    ['inclusive 12%, 3 units of ₹112', [{ qty: 3, ratePaise: 11200, gstRate: 12 }], inc(), {}, { taxable: 30000, cgst: 1800, sgst: 1800, igst: 0, total: 33600 }],
    ['odd paisa split: ₹0.05 tax at 5% of ₹1 → CGST 2, SGST 3', [{ qty: 1, ratePaise: 100, gstRate: 5 }], ex(), {}, { taxable: 100, cgst: 2, sgst: 3, igst: 0, total: 105 }],
    ['bill of supply (no GST) ignores the rate', [{ qty: 2, ratePaise: 50000, gstRate: 18 }], ex(true, 'NONE'), {}, { taxable: 100000, cgst: 0, sgst: 0, igst: 0, total: 100000 }],
    ['0% rated item', [{ qty: 4, ratePaise: 2500, gstRate: 0 }], ex(), {}, { taxable: 10000, cgst: 0, sgst: 0, igst: 0, total: 10000 }],
    ['mixed rates: ₹1,000 at 5% + ₹1,000 at 18%', [{ qty: 1, ratePaise: 100000, gstRate: 5 }, { qty: 1, ratePaise: 100000, gstRate: 18 }], ex(), {}, { taxable: 200000, cgst: 11500, sgst: 11500, igst: 0, total: 223000 }],
    ['line discount ₹100 on ₹1,000 at 18%', [{ qty: 1, ratePaise: 100000, discountPaise: 10000, gstRate: 18 }], ex(), {}, { taxable: 90000, cgst: 8100, sgst: 8100, igst: 0, total: 106200 }],
    ['document discount ₹200 shared over two lines before tax', [{ qty: 1, ratePaise: 100000, gstRate: 18 }, { qty: 1, ratePaise: 100000, gstRate: 18 }], ex(), { discountPaise: 20000 }, { taxable: 180000, cgst: 16200, sgst: 16200, igst: 0, total: 212400 }],
    ['shipping ₹100 at 18%', [{ qty: 1, ratePaise: 100000, gstRate: 18 }], ex(), { shippingPaise: 10000, shippingGstRate: 18 }, { taxable: 110000, cgst: 9900, sgst: 9900, igst: 0, total: 129800 }],
    ['round off to the rupee: ₹1,180.40 → ₹1,180', [{ qty: 1, ratePaise: 100034, gstRate: 18 }], ex(), { roundOff: true }, { taxable: 100034, cgst: 9003, sgst: 9003, igst: 0, total: 118000 }],
    ['quantity 2.5 kg at ₹80, 5%', [{ qty: 2.5, ratePaise: 8000, gstRate: 5 }], ex(), {}, { taxable: 20000, cgst: 500, sgst: 500, igst: 0, total: 21000 }],
  ];
  for (const [label, lines, ctx, opts, e] of cases) {
    const t = G.computeDocument(lines, ctx, opts);
    const got = { taxable: t.taxablePaise, cgst: t.cgstPaise, sgst: t.sgstPaise, igst: t.igstPaise, total: t.totalPaise };
    ok(label, same(got, e), JSON.stringify(got));
  }
  const t = G.computeDocument([{ qty: 1, ratePaise: 100001, gstRate: 18 }, { qty: 1, ratePaise: 100003, gstRate: 18 }, { qty: 1, ratePaise: 99999, gstRate: 5 }], { taxKind: 'GST', priceMode: 'INCLUSIVE', intraState: true }, { discountPaise: 777, roundOff: true });
  ok('invariant: taxable + CGST + SGST + IGST + round off = total, always', t.taxablePaise + t.cgstPaise + t.sgstPaise + t.igstPaise + t.roundOffPaise === t.totalPaise, JSON.stringify(t));
  ok('shares of a discount add up exactly (largest remainder)', G.share(100, [1, 1, 1]).reduce((a, b) => a + b, 0) === 100 && same(G.share(10, [3, 3, 4]), [3, 3, 4]));
  let threw = false; try { G.computeDocument([{ qty: 0, ratePaise: 100, gstRate: 5 }], { taxKind: 'GST', priceMode: 'EXCLUSIVE', intraState: true }); } catch { threw = true; }
  ok('a zero quantity is refused', threw);
  ok('place of supply: same state (any case) is inside; a different state is IGST; unknown buyer state counts as inside', G.isIntraState('Tamil Nadu', ' tamil  nadu ') && !G.isIntraState('Tamil Nadu', 'Karnataka') && G.isIntraState('Tamil Nadu', ''));
  ok('financial year: 31 Mar 2027 is 26-27, 1 Apr 2027 is 27-28 (IST calendar)', G.financialYear(new Date('2027-03-31T10:00:00Z')) === '26-27' && G.financialYear(new Date('2027-04-01T00:00:00Z')) === '27-28' && G.financialYear(new Date('2027-03-31T19:00:00Z')) === '27-28');
  const hsn = G.hsnSummary([{ hsn: '6403', gstRate: 5, qty: 2, taxablePaise: 1000, cgstPaise: 25, sgstPaise: 25, igstPaise: 0 }, { hsn: '6403', gstRate: 5, qty: 1, taxablePaise: 500, cgstPaise: 12, sgstPaise: 13, igstPaise: 0 }, { hsn: null, gstRate: 18, qty: 1, taxablePaise: 100, cgstPaise: 9, sgstPaise: 9, igstPaise: 0 }]);
  ok('HSN summary groups by code and rate', hsn.length === 2 && hsn.find((h) => h.hsn === '6403').taxablePaise === 1500 && hsn.find((h) => h.hsn === '(none)').gstRate === 18);
}

section('[feat:bos.posting] every document type posts a BALANCED entry; a reversal nets to zero');
{
  const sum = (ls) => ({ d: ls.reduce((a, l) => a + l.debitPaise, 0), c: ls.reduce((a, l) => a + l.creditPaise, 0) });
  const bal = (ls) => { const s = sum(ls); return s.d === s.c; };
  const doc = { taxablePaise: 100000, cgstPaise: 9000, sgstPaise: 9000, igstPaise: 0, roundOffPaise: 0, totalPaise: 118000 };
  const all = {
    'sales invoice with cost of goods': P.salesInvoiceLines({ ...doc, partyId: 'p1', cogsPaise: 60000 }),
    'sales invoice with a positive round off': P.salesInvoiceLines({ taxablePaise: 100034, cgstPaise: 9003, sgstPaise: 9003, igstPaise: 0, roundOffPaise: -40, totalPaise: 118000, partyId: 'p1', cogsPaise: 0 }),
    'sales invoice with a negative round off': P.salesInvoiceLines({ taxablePaise: 100050, cgstPaise: 9004, sgstPaise: 9005, igstPaise: 0, roundOffPaise: 41, totalPaise: 118100, partyId: 'p1', cogsPaise: 0 }),
    'IGST sale': P.salesInvoiceLines({ taxablePaise: 100000, cgstPaise: 0, sgstPaise: 0, igstPaise: 18000, roundOffPaise: 0, totalPaise: 118000, cogsPaise: 0 }),
    'credit note with restock': P.creditNoteLines({ ...doc, partyId: 'p1', restockedCostPaise: 60000 }),
    'credit note without restock': P.creditNoteLines({ ...doc, partyId: 'p1', restockedCostPaise: 0 }),
    'purchase bill (stock and non-stock lines)': P.purchaseBillLines({ taxablePaise: 100000, cgstPaise: 9000, sgstPaise: 9000, igstPaise: 0, roundOffPaise: 0, totalPaise: 118000, partyId: 's1', stockTaxablePaise: 70000 }),
    'receipt fully allocated': P.receiptLines({ partyId: 'p1', mode: 'UPI', amountPaise: 50000, allocatedPaise: 50000 }),
    'receipt with an advance': P.receiptLines({ partyId: 'p1', mode: 'CASH', amountPaise: 50000, allocatedPaise: 20000 }),
    'gateway receipt': P.receiptLines({ partyId: 'p1', mode: 'GATEWAY', amountPaise: 50000, allocatedPaise: 50000 }),
    'payment to a supplier with an advance': P.paymentOutLines({ partyId: 's1', mode: 'BANK', amountPaise: 90000, allocatedPaise: 60000 }),
    'advance applied': P.advanceAppliedLines({ partyId: 'p1', amountPaise: 30000 }),
    'supplier advance applied': P.supplierAdvanceAppliedLines({ partyId: 's1', amountPaise: 30000 }),
    'expense with claimed GST (cash)': P.expenseLines({ category: '5300', taxablePaise: 10000, cgstPaise: 900, sgstPaise: 900, igstPaise: 0, totalPaise: 11800, paymentMode: 'CASH' }),
    'expense on credit': P.expenseLines({ category: '5300', taxablePaise: 10000, cgstPaise: 0, sgstPaise: 0, igstPaise: 1800, totalPaise: 11800, paymentMode: 'CREDIT', supplierId: 's1' }),
    'stock loss': P.stockAdjustmentLines(-4500), 'stock gain': P.stockAdjustmentLines(4500),
    'opening balances': P.openingLines({ stockPaise: 500000, receivables: [{ partyId: 'p1', amountPaise: 20000 }], payables: [{ partyId: 's1', amountPaise: 70000 }] }),
  };
  for (const [name, ls] of Object.entries(all)) ok(`${name}: debit = credit`, bal(ls), JSON.stringify(sum(ls)));
  let net = true;
  for (const ls of Object.values(all)) {
    const m = new Map();
    for (const l of [...ls, ...P.reverseLines(ls)]) m.set(l.accountCode + (l.partyId ?? ''), (m.get(l.accountCode + (l.partyId ?? '')) ?? 0) + l.debitPaise - l.creditPaise);
    if ([...m.values()].some((v) => v !== 0)) net = false;
  }
  ok('a reversal puts every account (and every party) back to exactly zero, for every document type', net);
  let threw = false; try { P.assertBalanced([{ accountCode: '1000', debitPaise: 100, creditPaise: 0 }, { accountCode: '4000', debitPaise: 0, creditPaise: 99 }]); } catch (e) { threw = e instanceof P.UnbalancedEntryError; }
  ok('an unbalanced entry is refused', threw);
  ok('a sale to a customer owing nothing posts the whole total to receivables and the whole taxable value to sales', all['sales invoice with cost of goods'].find((l) => l.accountCode === '1100').debitPaise === 118000 && all['sales invoice with cost of goods'].find((l) => l.accountCode === '4000').creditPaise === 100000);
}

section('[feat:bos.export] xlsx and zip writers produce valid archives');
{
  const z = O.zip([{ name: 'a.txt', data: Buffer.from('hello world'.repeat(50)) }, { name: 'b/ü.txt', data: Buffer.from('second') }]);
  ok('zip starts with a local header and ends with an end-of-central-directory record', z.readUInt32LE(0) === 0x04034b50 && z.readUInt32LE(z.length - 22) === 0x06054b50 && z.readUInt16LE(z.length - 22 + 10) === 2);
  ok('crc32 of "123456789" is cbf43926', O.crc32(Buffer.from('123456789')) === 0xcbf43926);
  const x = O.xlsx([{ name: 'Sales', rows: [[{ bold: 'Total' }, { money: 123456 }, 'a<b&c']] }, { name: 'Bad/Name?', rows: [[1, 2]] }]);
  ok('xlsx is a zip with the workbook parts', x.includes(Buffer.from('xl/workbook.xml')) && x.includes(Buffer.from('xl/worksheets/sheet2.xml')) && x.includes(Buffer.from('[Content_Types].xml')));
  ok('csv escapes commas, quotes and newlines; money shows rupees', O.csv([['a,b', 'say "hi"', { money: 250 }]]) === '"a,b","say ""hi""",2.50');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log('FAILED:\n - ' + failures.join('\n - '));
process.exitCode = fail ? 1 : 0;
