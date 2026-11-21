import { PlansAdminService } from '../src/plans/admin/plans-admin.service';
import { effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import * as fs from 'fs';
import * as path from 'path';

/** B3.1: the Free plan's display name, the audited rename route, and who may call it. */
const code = (e: unknown): string | undefined => ((e as { getResponse?: () => { code?: string } }).getResponse?.() as { code?: string } | undefined)?.code;
const ACTOR = { type: 'ADMIN', id: 'a1', ip: null } as never;

function make(rows: Record<string, { id: string; key: string; name: string }>) {
  const audit = { record: jest.fn(async () => undefined) };
  const tx = {
    v3Plan: {
      findUnique: jest.fn(async ({ where }: { where: { key: string } }) => rows[where.key] ?? null),
      update: jest.fn(async ({ where, data }: { where: { key: string }; data: { name: string } }) => { rows[where.key] = { ...rows[where.key], name: data.name }; return rows[where.key]; }),
    },
  };
  const prisma = { $transaction: async (fn: (t: unknown) => unknown) => fn(tx) };
  const invalidate = jest.fn();
  const svc = new PlansAdminService(prisma as never, audit as never, { invalidateAll: invalidate } as never);
  return { svc, audit, tx, invalidate };
}

describe('B3.1 plan display name', () => {
  it('the seed names every Free plan "Free plan" and keeps the keys', () => {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'prisma/seed/v3-plans.seed.json'), 'utf8')) as { plans: { key: string; level: string; name: string }[] };
    const free = seed.plans.filter((p) => p.level === 'FREE');
    expect(free.map((p) => p.key).sort()).toEqual(['ecommerce_free', 'handyman_free', 'professional_free']);
    for (const p of free) expect(p.name).toBe('Free plan');
  });
  it('rename changes only the name, writes one audit row (before and after), and clears the entitlement cache', async () => {
    const { svc, audit, tx, invalidate } = make({ handyman_free: { id: 'P1', key: 'handyman_free', name: 'Handyman Free' } });
    await expect(svc.renamePlan('handyman_free', '  Free plan ', ACTOR)).resolves.toEqual({ key: 'handyman_free', name: 'Free plan' });
    expect(tx.v3Plan.update).toHaveBeenCalledWith({ where: { key: 'handyman_free' }, data: { name: 'Free plan' } });
    expect(audit.record).toHaveBeenCalledWith(tx, ACTOR, 'plan.rename', 'plan', 'P1', { name: 'Handyman Free' }, { name: 'Free plan' });
    expect(invalidate).toHaveBeenCalled();
  });
  it('the same name again writes nothing and adds no audit row', async () => {
    const { svc, audit, tx } = make({ handyman_free: { id: 'P1', key: 'handyman_free', name: 'Free plan' } });
    await svc.renamePlan('handyman_free', 'Free plan', ACTOR);
    expect(tx.v3Plan.update).not.toHaveBeenCalled(); expect(audit.record).not.toHaveBeenCalled();
  });
  it('an unknown key is UNKNOWN_PLAN and a blank name is PLAN_NAME_INVALID', async () => {
    const { svc } = make({});
    expect(code(await svc.renamePlan('nope', 'Free plan', ACTOR).then(() => null, (e) => e))).toBe('UNKNOWN_PLAN');
    expect(code(await svc.renamePlan('nope', ' ', ACTOR).then(() => null, (e) => e))).toBe('PLAN_NAME_INVALID');
  });
  it('only SUPER_ADMIN may rename', () => {
    expect(effectiveRolesFor('PUT /v3/admin/plans/by-key/:key/name')).toEqual(['SUPER_ADMIN']);
  });
});
