import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminTeamController } from '../src/admin-team/admin-team.controller';
import { AdminTeamService } from '../src/admin-team/admin-team.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { PrismaLifecycleStore } from '../src/vendor-lifecycle/prisma-lifecycle.store';
import { VendorsService } from '../src/vendors/vendors.service';

/** E11c: the last Super admin cannot be demoted, switched off, removed, suspended or deleted. The database is a fake that applies the filters it is given. */
interface Member { id: string; name: string; email: string; role: string; status: string; password: string | null; inviteToken: string | null }
interface Account { id: string; role: string; status: string }

type Match = string | { not?: string; in?: string[] } | undefined;
const matches = (value: string, m: Match): boolean => m === undefined || (typeof m === 'string' ? value === m : (m.not === undefined || value !== m.not) && (m.in === undefined || m.in.includes(value)));
const countOf = <T extends object>(rows: T[], where: Record<string, Match>): number => rows.filter((r) => Object.entries(where).every(([k, m]) => matches(String((r as Record<string, unknown>)[k]), m))).length;

function world(members: Array<Partial<Member> & { id: string }>, accounts: Account[] = []) {
  const team: Member[] = members.map((m) => ({ name: m.id, email: `${m.id}@x.invalid`, role: 'SUPER_ADMIN', status: 'active', password: 'hash', inviteToken: null, ...m }));
  const vendors: Account[] = accounts.map((a) => ({ ...a }));
  const log = { transactions: 0, locks: 0, audits: 0 };
  const db = {
    adminTeamMember: {
      findUnique: async ({ where }: { where: { id: string } }) => { const m = team.find((x) => x.id === where.id); return m ? { ...m } : null; },
      count: async ({ where }: { where: Record<string, Match> }) => countOf(team, where),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Member> }) => { const m = team.find((x) => x.id === where.id)!; Object.assign(m, data); return { ...m }; },
    },
    vendor: {
      findUnique: async ({ where }: { where: { id: string } }) => { const v = vendors.find((x) => x.id === where.id); return v ? { ...v } : null; },
      count: async ({ where }: { where: Record<string, Match> }) => countOf(vendors, where),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Account> }) => { const v = vendors.find((x) => x.id === where.id)!; Object.assign(v, data); return { ...v }; },
      delete: async ({ where }: { where: { id: string } }) => { const i = vendors.findIndex((x) => x.id === where.id); const [v] = vendors.splice(i, 1); return v; },
    },
    $executeRaw: async () => { log.locks++; return 1; },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => { log.transactions++; return fn(db); },
  };
  const svc = new AdminTeamService(db as never, {} as never, {} as never);
  const vendorSvc = new VendorsService(db as never, {} as never, {} as never, {} as never, {} as never);
  const lifecycle = new PrismaLifecycleStore(db as never, { record: async () => { log.audits++; } } as never);
  const member = (id: string): Member => team.find((x) => x.id === id)!;
  return { svc, vendorSvc, lifecycle, team, vendors, member, log, db };
}

const refused = { status: 409, response: { code: 'LAST_SUPER_ADMIN' } };
const audit = { actor: { type: 'STAFF' as const, id: 's', ip: null }, action: 'lifecycle.suspend', entityType: 'vendor', entityId: 'v', before: null, after: null, reason: 'a reason' };

describe('E11c: the staff list', () => {
  it('refuses every way of losing the only Super admin, and leaves the member as it was', async () => {
    const w = world([{ id: 'boss' }, { id: 'ops', role: 'OPERATIONS' }]);
    for (const change of [{ role: 'ADMIN' }, { role: 'OPERATIONS' }, { role: 'REFERRAL_PARTNER' }, { status: 'removed' }, { status: 'invited' }]) {
      await expect(w.svc.update('boss', change as never)).rejects.toMatchObject(refused);
    }
    await expect(w.svc.remove('boss')).rejects.toMatchObject(refused);
    expect(w.member('boss')).toMatchObject({ role: 'SUPER_ADMIN', status: 'active' });
  });

  it('allows changes that keep the role, and any change to other people', async () => {
    const w = world([{ id: 'boss' }, { id: 'ops', role: 'OPERATIONS' }]);
    await expect(w.svc.update('boss', { role: 'SUPER_ADMIN' as never, status: 'active' })).resolves.toMatchObject({ id: 'boss' });
    await expect(w.svc.update('boss', {})).resolves.toMatchObject({ role: 'SUPER_ADMIN' });
    await expect(w.svc.update('ops', { role: 'ADMIN' as never })).resolves.toMatchObject({ role: 'ADMIN' });
    await expect(w.svc.remove('ops')).resolves.toMatchObject({ status: 'removed' });
    await expect(w.svc.update('nobody', {})).rejects.toMatchObject({ status: 404 });
    await expect(w.svc.remove('nobody')).rejects.toMatchObject({ status: 404 });
  });

  it('with two Super admins one may go, and then the other is the last', async () => {
    const w = world([{ id: 'boss' }, { id: 'second' }]);
    await expect(w.svc.update('boss', { role: 'ADMIN' as never })).resolves.toMatchObject({ role: 'ADMIN' });
    await expect(w.svc.remove('second')).rejects.toMatchObject(refused);
  });

  it('an invited or removed Super admin does not count, and may be removed', async () => {
    const w = world([{ id: 'boss' }, { id: 'invited', status: 'invited', password: null }, { id: 'old', status: 'removed' }]);
    await expect(w.svc.remove('boss')).rejects.toMatchObject(refused);
    await expect(w.svc.remove('invited')).resolves.toMatchObject({ status: 'removed' });
    await expect(w.svc.update('old', { role: 'ADMIN' as never })).resolves.toMatchObject({ role: 'ADMIN' });
  });

  it('the platform administrator account counts while it can sign in, not once suspended; an ordinary vendor never counts', async () => {
    const open = world([{ id: 'boss' }], [{ id: 'platform', role: 'ADMIN', status: 'ACTIVE' }]);
    await expect(open.svc.remove('boss')).resolves.toMatchObject({ status: 'removed' });
    const shut = world([{ id: 'boss' }], [{ id: 'platform', role: 'ADMIN', status: 'SUSPENDED' }, { id: 'shop', role: 'VENDOR', status: 'ACTIVE' }]);
    await expect(shut.svc.remove('boss')).rejects.toMatchObject(refused);
  });

  it('two Super admins removing each other at the same moment: exactly one succeeds', async () => {
    const w = world([{ id: 'a' }, { id: 'b' }]);
    const r = await Promise.allSettled([w.svc.remove('b'), w.svc.remove('a')]);
    expect(r.map((x) => x.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(w.team.filter((m) => m.role === 'SUPER_ADMIN' && m.status === 'active')).toHaveLength(1);
    expect(w.log.locks).toBe(2);
  });
});

describe('E11c: the platform administrator account', () => {
  const only = () => world([{ id: 'ops', role: 'OPERATIONS' }], [{ id: 'platform', role: 'SUPER_ADMIN', status: 'ACTIVE' }, { id: 'shop', role: 'VENDOR', status: 'ACTIVE' }]);

  it('as the only Super admin it cannot be suspended or deleted, by the vendor routes or the lifecycle action', async () => {
    const w = only();
    await expect(w.vendorSvc.suspend('platform')).rejects.toMatchObject(refused);
    await expect(w.vendorSvc.remove('platform')).rejects.toMatchObject(refused);
    await expect(w.lifecycle.setVendorStatus('platform', 'SUSPENDED', audit)).rejects.toMatchObject(refused);
    expect(w.vendors.find((v) => v.id === 'platform')).toMatchObject({ status: 'ACTIVE' });
    expect(w.log.audits).toBe(0);
  });

  it('may be suspended or deleted when a Super admin staff member remains', async () => {
    const w = world([{ id: 'boss' }], [{ id: 'platform', role: 'ADMIN', status: 'ACTIVE' }, { id: 'platform2', role: 'ADMIN', status: 'ACTIVE' }, { id: 'platform3', role: 'ADMIN', status: 'ACTIVE' }]);
    await expect(w.vendorSvc.suspend('platform')).resolves.toMatchObject({ status: 'SUSPENDED' });
    await expect(w.lifecycle.setVendorStatus('platform2', 'SUSPENDED', audit)).resolves.toBeUndefined();
    await expect(w.vendorSvc.remove('platform3')).resolves.toMatchObject({ id: 'platform3' });
  });

  it('of two administrator accounts one may go, and then the other is the last', async () => {
    const w = world([], [{ id: 'p1', role: 'ADMIN', status: 'ACTIVE' }, { id: 'p2', role: 'ADMIN', status: 'ACTIVE' }]);
    await expect(w.vendorSvc.suspend('p1')).resolves.toMatchObject({ status: 'SUSPENDED' });
    await expect(w.vendorSvc.suspend('p2')).rejects.toMatchObject(refused);
    await expect(w.vendorSvc.remove('p1')).resolves.toMatchObject({ id: 'p1' });   // already suspended: deleting it takes no sign-in away
  });

  it('an ordinary vendor is suspended and deleted exactly as before, without the lock', async () => {
    const w = only();
    await expect(w.vendorSvc.suspend('shop')).resolves.toMatchObject({ status: 'SUSPENDED' });
    await expect(w.vendorSvc.remove('shop')).resolves.toMatchObject({ id: 'shop' });
    expect(w.log.transactions).toBe(0); expect(w.log.locks).toBe(0);
    const l = only();
    await expect(l.lifecycle.setVendorStatus('shop', 'SUSPENDED', audit)).resolves.toBeUndefined();
    await expect(l.lifecycle.setVendorStatus('shop', 'ACTIVE', audit)).resolves.toBeUndefined();
    expect(l.log.locks).toBe(0); expect(l.log.audits).toBe(2);
  });
});

describe('E11c over HTTP', () => {
  let app: INestApplication; let w: ReturnType<typeof world>;
  beforeEach(async () => {
    w = world([{ id: 'boss' }]);
    const mod = await Test.createTestingModule({ controllers: [AdminTeamController], providers: [{ provide: AdminTeamService, useValue: w.svc }] }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => { const role = req.headers['x-test-role']; if (role) req.user = { sub: 'boss', email: 'b@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: role }; next(); });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  it('answers 409 with the plain code LAST_SUPER_ADMIN to a Super admin demoting or removing themselves as the last one', async () => {
    const put = await request(app.getHttpServer()).put('/admin-team/members/boss').set('x-test-role', 'SUPER_ADMIN').send({ role: 'ADMIN' });
    const del = await request(app.getHttpServer()).delete('/admin-team/members/boss').set('x-test-role', 'SUPER_ADMIN');
    for (const r of [put, del]) {
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('LAST_SUPER_ADMIN');
      expect(r.body.message).toBe('This is the only Super admin who can sign in. Make another Super admin first.');
    }
    expect(w.member('boss')).toMatchObject({ role: 'SUPER_ADMIN', status: 'active' });
  });

  it('keeps the routes closed to everyone else', async () => {
    for (const role of ['ADMIN', 'OPERATIONS']) expect((await request(app.getHttpServer()).delete('/admin-team/members/boss').set('x-test-role', role)).status).toBe(403);
  });
});
