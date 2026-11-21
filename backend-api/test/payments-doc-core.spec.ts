import { buildDocument, chooseSupply, decideDocumentKind, docMessageText, financialYearKey, formatDocNumber, gstinCheckChar, stateCodeOfGstin, validateGstin, normaliseInvoicePrefix, DocKind } from '../src/v3-payments/core/doc-core';

/** Build a valid GSTIN from a 14 character body so the tests never depend on a real registration. */
const gstin = (body: string): string => body + gstinCheckChar(body);

describe('GSTIN validator and state code', () => {
  it('accepts a well formed number with the right check character and reads the state from the first two digits', () => {
    const g = gstin('33ABCDE1234F1Z'); expect(validateGstin(g)).toEqual({ ok: true, gstin: g, stateCode: '33' }); expect(stateCodeOfGstin(g)).toBe('33');
    expect(validateGstin(` ${g.toLowerCase()} `)).toEqual({ ok: true, gstin: g, stateCode: '33' });
  });
  it.each(['', '33ABCDE1234F1Z', '33ABCDE1234F1Z0'.slice(0, 14) + 'X', '99ZZZZZ9999Z9Z9', '00ABCDE1234F1Z5', '33ABCDE1234F0Z5', 'not a gstin', 42])('refuses %p', (v) => { expect(validateGstin(v as never).ok).toBe(false); });
  it('refuses a wrong check character and an unknown state code', () => {
    const g = gstin('29ABCDE1234F1Z'); const wrong = g.slice(0, 14) + (g[14] === '0' ? '1' : '0'); expect(validateGstin(wrong).ok).toBe(false);
    expect(validateGstin(gstin('50ABCDE1234F1Z')).ok).toBe(false);
  });
});

describe('the document type table: every combination', () => {
  const rows: Array<[boolean, boolean, 'PROFESSIONAL' | 'OTHER', DocKind]> = [
    [true, false, 'OTHER', 'TAX_INVOICE'], [true, false, 'PROFESSIONAL', 'TAX_INVOICE'],
    [true, true, 'OTHER', 'BILL_OF_SUPPLY'], [true, true, 'PROFESSIONAL', 'BILL_OF_SUPPLY'],
    [false, false, 'OTHER', 'BILL'], [false, false, 'PROFESSIONAL', 'FEE_RECEIPT'],
    [false, true, 'OTHER', 'BILL'], [false, true, 'PROFESSIONAL', 'FEE_RECEIPT'],
  ];
  it.each(rows)('gstRegistered=%s composition=%s tier=%s gives %s', (gstRegistered, composition, tier, want) => { expect(decideDocumentKind({ gstRegistered, composition, tier })).toBe(want); });
  it('covers all eight combinations exactly once', () => { expect(new Set(rows.map((r) => `${r[0]}${r[1]}${r[2]}`)).size).toBe(8); });
});

describe('intra or inter state', () => {
  it('same state is CGST plus SGST, a different state is IGST, an unknown customer state is assumed intra and flagged', () => {
    expect(chooseSupply('33', '33')).toEqual({ type: 'INTRA', assumed: false }); expect(chooseSupply('33', '29')).toEqual({ type: 'INTER', assumed: false });
    expect(chooseSupply('33', null)).toEqual({ type: 'INTRA', assumed: true }); expect(chooseSupply(null, '29')).toEqual({ type: 'INTRA', assumed: true }); expect(chooseSupply(null, null)).toEqual({ type: 'INTRA', assumed: true });
  });
});

describe('building a document: the split is exact in paise', () => {
  const lines = [{ name: 'Brass lamp', qty: 2, taxablePaise: 100_001, taxPercent: 18, taxPaise: 18_000 }, { name: 'Bell', qty: 1, taxablePaise: 33_333, taxPercent: 5, taxPaise: 1_667 }];
  it('a tax invoice, same state: taxable plus CGST plus SGST equals the total, and CGST plus SGST equals the tax of every line and the whole', () => {
    const d = buildDocument({ kind: 'TAX_INVOICE', lines, supply: { type: 'INTRA', assumed: false }, paidPaise: 100_001 + 18_000 + 33_333 + 1_667 })!;
    expect(d.totalPaise).toBe(153_001); expect(d.taxablePaise).toBe(133_334); expect(d.taxPaise).toBe(19_667); expect(d.cgstPaise + d.sgstPaise).toBe(19_667); expect(d.igstPaise).toBe(0);
    expect(d.taxablePaise + d.taxPaise).toBe(d.totalPaise); expect(d.cgstPaise).toBe(9_833); expect(d.sgstPaise).toBe(9_834);
    for (const l of d.lines) expect(l.cgstPaise + l.sgstPaise + l.igstPaise).toBe(l.taxPaise);
  });
  it('a tax invoice, other state: all of the tax is IGST', () => {
    const d = buildDocument({ kind: 'TAX_INVOICE', lines, supply: { type: 'INTER', assumed: false }, paidPaise: 153_001 })!; expect(d.igstPaise).toBe(19_667); expect(d.cgstPaise).toBe(0); expect(d.sgstPaise).toBe(0);
  });
  it('every odd and even tax amount splits exactly', () => {
    for (let t = 0; t <= 500; t++) { const d = buildDocument({ kind: 'TAX_INVOICE', lines: [{ name: 'x', qty: 1, taxablePaise: 1000, taxPercent: 1, taxPaise: t }], supply: { type: 'INTRA', assumed: false }, paidPaise: 1000 + t })!; expect(d.cgstPaise + d.sgstPaise).toBe(t); expect(d.sgstPaise - d.cgstPaise).toBe(t % 2); }
  });
  it('a bill, bill of supply or fee receipt shows each line at what was charged with no tax lines, and still totals what was paid', () => {
    for (const kind of ['BILL', 'BILL_OF_SUPPLY', 'FEE_RECEIPT'] as const) {
      const d = buildDocument({ kind, lines, supply: { type: 'INTRA', assumed: false }, paidPaise: 153_001 })!;
      expect(d.totalPaise).toBe(153_001); expect(d.taxPaise).toBe(0); expect(d.cgstPaise + d.sgstPaise + d.igstPaise).toBe(0); expect(d.lines.map((l) => l.amountPaise)).toEqual([118_001, 35_000]);
    }
  });
  it('refuses lines that do not add up to what was paid (the caller then keeps the payment and flags it)', () => { expect(buildDocument({ kind: 'BILL', lines, supply: { type: 'INTRA', assumed: false }, paidPaise: 1 })).toBeNull(); });
});

describe('numbering and wording', () => {
  it('the financial year starts on 1 April (India time) and the number is at most 16 characters', () => {
    expect(financialYearKey(new Date('2026-04-01T00:00:00+05:30'))).toBe('2627'); expect(financialYearKey(new Date('2026-03-31T23:59:59+05:30'))).toBe('2526'); expect(financialYearKey(new Date('2026-12-31T10:00:00Z'))).toBe('2627'); expect(financialYearKey(new Date('2027-03-31T18:29:59Z'))).toBe('2627'); expect(financialYearKey(new Date('2027-03-31T18:30:00Z'))).toBe('2728');
    expect(formatDocNumber('INV', '2627', 1)).toBe('INV2627-00001'); expect(formatDocNumber('ABCDEF', '2627', 99999).length).toBeLessThanOrEqual(16);
  });
  it('the prefix is 0 to 6 capital letters or digits', () => { expect(normaliseInvoicePrefix(' ab12 ')).toBe('AB12'); expect(normaliseInvoicePrefix('')).toBe('INV'); expect(normaliseInvoicePrefix(undefined)).toBe('INV'); for (const bad of ['ABCDEFG', 'A B', 'a/b', '<x>']) expect(normaliseInvoicePrefix(bad)).toBeNull(); });
  it('the message text carries the business name, the kind, the number, the amount and the link, and nothing else', () => {
    const t = docMessageText({ businessName: 'Priya Stores', kind: 'TAX_INVOICE', number: 'INV2627-00001', amountText: '1530.01', link: 'https://x.test/doc/ABC' });
    expect(t).toBe('Priya Stores has issued tax invoice INV2627-00001 for Rs 1530.01. View it here: https://x.test/doc/ABC'); expect(t).not.toMatch(/@|\+91|case|medical|file/i);
  });
});
