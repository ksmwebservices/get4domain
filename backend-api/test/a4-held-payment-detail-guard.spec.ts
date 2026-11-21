import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { PrismaService } from '../src/prisma/prisma.service';
import { HeldPaymentsAdminController } from '../src/plan-billing/api/billing-admin.controller';
import { HeldPaymentsService } from '../src/plan-billing/held-payments.service';
import { PartnerScopeGuard } from '../src/v3-partners/partner-scope.guard';
import { deliver, flow } from './support/wave3-world';

/**
 * Dispatch A4 Q1. The held-payment DETAIL route over HTTP with the REAL guard stack (the global JwtAuthGuard on the real JwtStrategy, PartnerScopeGuard, the controller's AdminGuard and the role matrix),
 * the real validation pipe, filter and interceptor. The service is a spy: a refused caller must never reach it, for any id (real, unknown, malformed). Every role other than ADMIN and SUPER_ADMIN is 403 before
 * any lookup; an anonymous caller (and a bad token) is 401. Only the database is faked (the strategy reads staff and vendor rows from a map).
 */
const SECRET = 'a4-test-secret-not-a-real-one';
const STAFF: Record<string, { id: string; role: string }> = {
  sup: { id: 'u-sup', role: 'SUPER_ADMIN' }, admin: { id: 'u-adm', role: 'ADMIN' }, ops: { id: 'u-ops', role: 'OPERATIONS' }, mkt: { id: 'u-mkt', role: 'MARKETING' },
  fe: { id: 'u-fe', role: 'FIELD_EXECUTIVE' }, tc: { id: 'u-tc', role: 'TELECALLER' }, sp: { id: 'u-sp', role: 'SUPPORT' }, partner: { id: 'u-par', role: 'REFERRAL_PARTNER' },
};
const IDS: Array<[string, string]> = [['a real id', 'order-real-1'], ['an unknown id', 'order-does-not-exist'], ['a malformed id', '%00..%2F..%2Fx;DROP'], ['a very long id', 'x'.repeat(500)], ['an id with spaces', 'not%20an%20id']];

describe('GET /v3/admin/billing/held-payments/:id through the real guard stack', () => {
  let app: INestApplication; let lookups: string[]; let listed = 0; const tokens: Record<string, string> = {};
  const get = (url: string, token?: string) => { const r = request(app.getHttpServer()).get(url); return token ? r.set('Authorization', `Bearer ${token}`) : r; };

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    const jwt = new JwtService({ secret: SECRET });
    const prisma = {
      adminTeamMember: { findUnique: async ({ where }: { where: { id: string } }) => { const s = Object.values(STAFF).find((x) => x.id === where.id); return s ? { id: s.id, email: `${s.id}@x.invalid`, role: s.role, status: 'active', passwordChangedAt: null } : null; } },
      vendor: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === 'v-owner' ? { id: 'v-owner', email: 'o@x.invalid', role: 'VENDOR', status: 'ACTIVE', passwordChangedAt: null, isSandbox: false, expiresAt: null } : null) },
      teamMember: { findUnique: async () => null },
    };
    lookups = [];
    const spy = { detail: async (id: string) => { lookups.push(id); return { id }; }, list: async () => { listed += 1; return { items: [], total: 0 }; }, resolve: async () => ({}) };
    const mod = await Test.createTestingModule({
      controllers: [HeldPaymentsAdminController],
      providers: [JwtStrategy, { provide: PrismaService, useValue: prisma }, { provide: HeldPaymentsService, useValue: spy }, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: PartnerScopeGuard }],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    for (const [k, s] of Object.entries(STAFF)) tokens[k] = jwt.sign(s.role === 'REFERRAL_PARTNER' ? { sub: s.id, email: `${s.id}@x.invalid`, role: 'PARTNER', kind: 'referral_partner' } : { sub: s.id, email: `${s.id}@x.invalid`, role: 'ADMIN', kind: 'admin_member' });
    tokens.vendor = jwt.sign({ sub: 'v-owner', email: 'o@x.invalid', role: 'VENDOR' });
    // a token that CLAIMS the admin role for a vendor: the role comes from the database row, never from the token
    tokens.forged = jwt.sign({ sub: 'v-owner', email: 'o@x.invalid', role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' });
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { lookups.length = 0; listed = 0; });

  it.each(['ops', 'mkt', 'fe', 'tc', 'sp', 'partner', 'vendor', 'forged'])('%s is 403 for every kind of id and no lookup is ever made', async (who) => {
    for (const [kind, id] of IDS) {
      const r = await get(`/v3/admin/billing/held-payments/${id}`, tokens[who]);
      expect([who, kind, r.status]).toEqual([who, kind, 403]);
    }
    expect(lookups).toEqual([]);
    expect((await get('/v3/admin/billing/held-payments', tokens[who])).status).toBe(403); expect(listed).toBe(0);   // the list route agrees with the detail route
  });

  it('an anonymous caller and a bad or tampered token are 401 for every kind of id, with no lookup', async () => {
    for (const [kind, id] of IDS) {
      for (const tok of [undefined, 'not-a-token', `${tokens.sup}x`]) { const r = await get(`/v3/admin/billing/held-payments/${id}`, tok); expect([kind, tok === undefined ? 'none' : 'bad', r.status]).toEqual([kind, tok === undefined ? 'none' : 'bad', 401]); }
    }
    expect(lookups).toEqual([]);
  });

  it('ADMIN and SUPER_ADMIN reach the lookup, for a real id and for an unknown one (the service decides what an unknown id answers)', async () => {
    for (const who of ['admin', 'sup']) for (const [, id] of IDS.slice(0, 2)) expect([who, (await get(`/v3/admin/billing/held-payments/${id}`, tokens[who])).status]).toEqual([who, 200]);
    expect(lookups).toEqual(['order-real-1', 'order-does-not-exist', 'order-real-1', 'order-does-not-exist']);
  });
});

describe('held payments: the business name', () => {
  it('is on every list row and on the detail; null when the vendor has no business name or cannot be read', async () => {
    const f = flow('razorpay'); const o = await f.buy();
    const d = deliver(f, 'razorpay', o, { amountMinor: 354001, paymentId: 'pay_held_bn', eventId: 'evt_held_bn_1' });
    expect(await f.settlement.handleGatewayWebhook('razorpay', d.raw, d.headers)).toMatchObject({ result: 'REVIEW' });
    const svc = new HeldPaymentsService(f.w.repo, f.settlement);
    expect((await svc.list({ skip: 0, take: 20 })).items[0]).toMatchObject({ id: o.id, businessName: 'Business v1' });
    expect(await svc.detail(o.id)).toMatchObject({ businessName: 'Business v1' });
    f.w.repo.vendors.get('v1')!.businessName = '   ';
    expect((await svc.list({ skip: 0, take: 20 })).items[0].businessName).toBeNull(); expect((await svc.detail(o.id)).businessName).toBeNull();
    f.w.repo.vendors.delete('v1');
    expect((await svc.list({ skip: 0, take: 20 })).items[0].businessName).toBeNull(); expect((await svc.detail(o.id)).businessName).toBeNull();
  });
});
