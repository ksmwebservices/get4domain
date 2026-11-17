import { RulesAdminService } from '../src/plans/admin/rules-admin.service';
import { PLAN_ERROR_CODES } from '../src/plans/plans.errors';

/** M4(a) (dispatch A3, owner agreed): the generic tax-rate PUT and DELETE cannot rewrite or remove a rate that has already started. A rate still waiting to start stays editable; a change is a new rate. */
interface Row { id: string; name: string; ratePercent: number; appliesTo: string; active: boolean; validFrom: Date; updatedAt: Date }
const NOW = new Date('2026-11-17T10:00:00Z');
const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.())?.code ?? '';
const status = (e: unknown): number => (e as { getStatus?: () => number })?.getStatus?.() ?? 0;
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };

function world() {
  const rows: Row[] = [
    { id: 'past', name: 'GST', ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z') },
    { id: 'now', name: 'GST now', ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: NOW, updatedAt: new Date('2026-11-01T00:00:00Z') },
    { id: 'old-off', name: 'Old, switched off', ratePercent: 5, appliesTo: 'ALL', active: false, validFrom: new Date('2025-01-01T00:00:00Z'), updatedAt: new Date('2025-01-01T00:00:00Z') },
    { id: 'future', name: 'GST later', ratePercent: 12, appliesTo: 'ALL', active: true, validFrom: new Date('2026-12-01T00:00:00Z'), updatedAt: new Date('2026-11-10T00:00:00Z') },
  ];
  const audits: string[] = []; let invalidated = 0;
  const tx = {
    v3TaxRate: {
      findUnique: async (a: { where: { id: string } }) => { const r = rows.find((x) => x.id === a.where.id); return r ? { ...r } : null; },
      findUniqueOrThrow: async (a: { where: { id: string } }) => ({ ...rows.find((x) => x.id === a.where.id)! }),
      updateMany: async (a: { where: { id: string; updatedAt: Date }; data: Partial<Row> }) => { const r = rows.find((x) => x.id === a.where.id && x.updatedAt.getTime() === a.where.updatedAt.getTime()); if (!r) return { count: 0 }; Object.assign(r, a.data); return { count: 1 }; },
      delete: async (a: { where: { id: string } }) => { rows.splice(rows.findIndex((x) => x.id === a.where.id), 1); },
    },
  };
  const prisma = { ...tx, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
  const audit = { record: async (_t: unknown, _a: unknown, action: string) => { audits.push(action); } };
  const svc = new RulesAdminService(prisma as never, audit as never, { invalidateAll: () => { invalidated++; } } as never);
  svc.clock = () => NOW;
  return { svc, rows, audits, invalidated: () => invalidated };
}
const actor = { type: 'STAFF' as const, id: 's1', ip: null };

describe('the generic tax-rate PUT and DELETE (M4a)', () => {
  it('the code is registered, so the exception filter passes it through', () => { expect(PLAN_ERROR_CODES).toContain('TAX_RATE_IN_FORCE'); });

  it('a rate already in force cannot be rewritten (409 TAX_RATE_IN_FORCE): nothing changes, no audit row', async () => {
    const w = world();
    for (const id of ['past', 'now']) {
      const e = await err(w.svc.updateTaxRate(id, { ratePercent: 28, expectedUpdatedAt: w.rows.find((r) => r.id === id)!.updatedAt.toISOString() } as never, actor));
      expect(status(e)).toBe(409); expect(code(e)).toBe('TAX_RATE_IN_FORCE');
    }
    expect(w.rows.find((r) => r.id === 'past')!.ratePercent).toBe(18); expect(w.rows.find((r) => r.id === 'now')!.ratePercent).toBe(18);
    expect(w.audits).toEqual([]); expect(w.invalidated()).toBe(0);
  });

  it('a rate that started and was later switched off is history too: neither its fields nor its switch can be changed', async () => {
    const w = world();
    expect(code(await err(w.svc.updateTaxRate('old-off', { active: true, expectedUpdatedAt: w.rows.find((r) => r.id === 'old-off')!.updatedAt.toISOString() } as never, actor)))).toBe('TAX_RATE_IN_FORCE');
    expect(w.rows.find((r) => r.id === 'old-off')!.active).toBe(false);
  });

  it('a rate already in force cannot be deleted, a started one in the past neither; the rows stay', async () => {
    const w = world();
    for (const id of ['past', 'now', 'old-off']) { const e = await err(w.svc.deleteTaxRate(id, actor)); expect(status(e)).toBe(409); expect(code(e)).toBe('TAX_RATE_IN_FORCE'); }
    expect(w.rows.map((r) => r.id)).toEqual(['past', 'now', 'old-off', 'future']); expect(w.audits).toEqual([]);
  });

  it('a rate still waiting to start can be changed and removed, and the change is audited', async () => {
    const w = world();
    const r = await w.svc.updateTaxRate('future', { ratePercent: 13, validFrom: '2026-12-15T00:00:00Z', expectedUpdatedAt: w.rows.find((x) => x.id === 'future')!.updatedAt.toISOString() } as never, actor);
    expect(r.ratePercent).toBe(13); expect(w.rows.find((x) => x.id === 'future')!.validFrom.toISOString()).toBe('2026-12-15T00:00:00.000Z');
    expect(w.audits).toEqual(['tax.update']); expect(w.invalidated()).toBe(1);
    expect(await w.svc.deleteTaxRate('future', actor)).toEqual({ deleted: true }); expect(w.rows.some((x) => x.id === 'future')).toBe(false); expect(w.audits).toEqual(['tax.update', 'tax.delete']);
  });

  it('a waiting rate cannot be moved into the past or to this very moment (that would rewrite what orders were priced with)', async () => {
    const w = world();
    for (const validFrom of ['2026-11-17T09:59:59Z', '2026-11-17T10:00:00Z', '2020-01-01T00:00:00Z']) {
      const e = await err(w.svc.updateTaxRate('future', { validFrom, expectedUpdatedAt: w.rows.find((x) => x.id === 'future')!.updatedAt.toISOString() } as never, actor));
      expect(code(e)).toBe('TAX_RATE_IN_FORCE');
    }
    expect(w.rows.find((x) => x.id === 'future')!.validFrom.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('the boundary is the clock: the second a rate starts, it locks', async () => {
    const w = world(); const future = w.rows.find((r) => r.id === 'future')!;
    w.svc.clock = () => new Date(future.validFrom.getTime() - 1);
    expect((await w.svc.updateTaxRate('future', { name: 'GST later (renamed)', expectedUpdatedAt: future.updatedAt.toISOString() } as never, actor)).name).toBe('GST later (renamed)');
    w.svc.clock = () => future.validFrom;
    expect(code(await err(w.svc.deleteTaxRate('future', actor)))).toBe('TAX_RATE_IN_FORCE');
  });

  it('an unknown rate is still 404, not 409', async () => {
    const w = world();
    expect(status(await err(w.svc.deleteTaxRate('nope', actor)))).toBe(404); expect(status(await err(w.svc.updateTaxRate('nope', { name: 'x', expectedUpdatedAt: NOW.toISOString() } as never, actor)))).toBe(404);
  });
});
