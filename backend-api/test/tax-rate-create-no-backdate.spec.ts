import { RulesAdminService } from '../src/plans/admin/rules-admin.service';

/** Dispatch A4 Q3: POST /v3/admin/tax-rates never accepts a start that is already past (the rule of the GST rate setting). Existing rows are not touched. */
interface Row { id: string; name: string; ratePercent: number; appliesTo: string; active: boolean; validFrom: Date }
const NOW = new Date('2026-11-17T10:00:00Z');   // 15:30 on 17 November, India time
const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.())?.code ?? '';
const status = (e: unknown): number => (e as { getStatus?: () => number })?.getStatus?.() ?? 0;
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };

function world() {
  const rows: Row[] = [{ id: 'existing', name: 'GST', ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: new Date('2026-01-01T00:00:00Z') }];
  const audits: string[] = []; let invalidated = 0; let n = 0;
  const tx = { v3TaxRate: { create: async (a: { data: Partial<Row> }) => { const r = { id: `new${++n}`, appliesTo: 'ALL', active: true, validFrom: NOW, ...a.data } as Row; rows.push(r); return { ...r }; } } };
  const prisma = { ...tx, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
  const svc = new RulesAdminService(prisma as never, { record: async (_t: unknown, _a: unknown, action: string) => { audits.push(action); } } as never, { invalidateAll: () => { invalidated++; } } as never);
  svc.clock = () => NOW;
  return { svc, rows, audits, invalidated: () => invalidated };
}
const actor = { type: 'STAFF' as const, id: 's1', ip: null };
const base = { name: 'GST next', ratePercent: 12, appliesTo: 'ALL' };

describe('POST /v3/admin/tax-rates is never back-dated (A4 Q3)', () => {
  it('a start on an earlier India-time day is 409 TAX_RATE_IN_FORCE: nothing created, no audit row, no cache flush', async () => {
    const w = world();
    for (const validFrom of ['2026-11-16T12:00:00Z', '2026-11-16T18:29:59Z', '2026-01-01T00:00:00Z', '2020-01-01T00:00:00Z']) {
      const e = await err(w.svc.createTaxRate({ ...base, validFrom } as never, actor));
      expect([validFrom, status(e), code(e)]).toEqual([validFrom, 409, 'TAX_RATE_IN_FORCE']);
    }
    expect(w.rows.map((r) => r.id)).toEqual(['existing']); expect(w.audits).toEqual([]); expect(w.invalidated()).toBe(0);
  });

  it('a later day, and a later moment today, are kept exactly as given', async () => {
    const w = world();
    const a = await w.svc.createTaxRate({ ...base, validFrom: '2026-12-01T00:00:00Z' } as never, actor);
    const b = await w.svc.createTaxRate({ ...base, name: 'GST evening', validFrom: '2026-11-17T12:30:00Z' } as never, actor);
    expect(a.validFrom.toISOString()).toBe('2026-12-01T00:00:00.000Z'); expect(b.validFrom.toISOString()).toBe('2026-11-17T12:30:00.000Z');
    expect(w.audits).toEqual(['tax.create', 'tax.create']); expect(w.invalidated()).toBe(2);
  });

  it('today (an earlier moment of the same India-time day) and no date both mean "from now": the start is left to the moment of creation, never an earlier time', async () => {
    const w = world();
    for (const validFrom of ['2026-11-17T00:00:00Z', '2026-11-16T23:59:59Z', '2026-11-16T18:30:00Z', '2026-11-17T10:00:00Z', undefined]) {
      const r = await w.svc.createTaxRate({ ...base, ...(validFrom ? { validFrom } : {}) } as never, actor);
      expect(r.validFrom.getTime()).toBe(NOW.getTime());
    }
    expect(w.rows.filter((r) => r.id.startsWith('new'))).toHaveLength(5);
  });

  it('existing rows are not changed by creating a rate, and a refused create leaves them as they were', async () => {
    const w = world(); const before = JSON.stringify(w.rows);
    await err(w.svc.createTaxRate({ ...base, validFrom: '2026-11-01T00:00:00Z' } as never, actor));
    expect(JSON.stringify(w.rows)).toBe(before);
    await w.svc.createTaxRate({ ...base, validFrom: '2027-01-01T00:00:00Z' } as never, actor);
    expect(JSON.stringify(w.rows.filter((r) => r.id === 'existing'))).toBe(JSON.stringify([JSON.parse(before)[0]]));
  });
});
