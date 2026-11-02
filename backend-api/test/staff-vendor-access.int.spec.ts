// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AddonsController } from '../src/addons/addons.controller';
import { AiController } from '../src/ai/ai.controller';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { CmsController } from '../src/cms/cms.controller';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { InvoicesController } from '../src/invoices/invoices.controller';
import { ADMIN_RECIPIENT_ID } from '../src/notifications/notifications.service';
import { NotificationsController } from '../src/notifications/notifications.controller';
import { PrismaModule } from '../src/prisma/prisma.module';
import { StockController } from '../src/stock/stock.controller';
import { SubscriptionsController } from '../src/subscriptions/subscriptions.controller';
import { SupportController } from '../src/support/support.controller';
import { SeededTenant, cleanupTenants, newPrisma, seedBootstrapAdmin, seedStaff, seedTenant } from './support/fixtures';
import { JwtModule } from '@nestjs/jwt';

// @nestjs/schedule ships ES modules that Jest does not parse; some of these controllers reach it through their service imports.
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined, Interval: () => () => undefined, Timeout: () => () => undefined,
  CronExpression: new Proxy({}, { get: () => '* * * * *' }), ScheduleModule: {}, SchedulerRegistry: class {},
}));

/**
 * S7-B end to end: the controllers that used to decide "is this an admin?" inline now ask the staff matrix.
 * Real controllers, real JwtStrategy + JwtAuthGuard against STAGING, real staff and vendor accounts; every service is a recorder, so a refused
 * request must leave no call behind (nothing of another vendor's was read or changed).
 */
interface Call { svc: string; method: string; args: unknown[] }
const calls: Call[] = [];
const recorder = (svc: string): unknown => new Proxy({}, {
  get: (_t, prop) => {
    if (prop === 'then' || typeof prop === 'symbol') return undefined;
    return (...args: unknown[]) => { calls.push({ svc, method: String(prop), args }); return { ran: true }; };
  },
});

type M = 'get' | 'post' | 'put';
const CROSS_VENDOR: Array<[M, string]> = [
  ['get', '/invoices/vendor/target'], ['get', '/subscriptions/vendor/target'], ['get', '/support/tickets/vendor/target'],
  ['put', '/cms/vendor/target'], ['get', '/cms/vendor/target/products/manage'], ['post', '/stock/products/p1/adjust'],
];

describe('staff access to a vendor\'s data follows the staff matrix (staging database, real controllers, mocked services)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;
  let vendor: SeededTenant;
  let t: { SUPER: string; BOOT: string; OPS: string; MKT: string };

  const call = (token: string, method: M, path: string) => request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${token}`).send({});
  const subOf = (token: string) => (jwt.decode(token) as { sub: string }).sub;
  const status = async (token: string, [method, path]: [M, string]) => (await call(token, method, path)).status;

  beforeAll(async () => {
    prisma = newPrisma();
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, PassportModule, JwtModule.register({ secret: process.env.JWT_SECRET })],
      controllers: [InvoicesController, SubscriptionsController, SupportController, CmsController, StockController, AddonsController, NotificationsController, AiController],
      providers: [JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
    }).useMocker((token) => recorder(typeof token === 'function' ? token.name : String(token))).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    jwt = app.get(JwtService);
    vendor = await seedTenant(prisma, 'sva', RUN_ID);
    t = {
      SUPER: await seedStaff(prisma, 'sv-super', RUN_ID, 'SUPER_ADMIN'),
      BOOT: await seedBootstrapAdmin(prisma, 'sv-boot', RUN_ID),
      OPS: await seedStaff(prisma, 'sv-ops', RUN_ID, 'OPERATIONS'),
      MKT: await seedStaff(prisma, 'sv-mkt', RUN_ID, 'MARKETING'),
    };
  }, 120000);

  beforeEach(() => { calls.length = 0; });

  afterAll(async () => {
    try { await cleanupTenants(prisma, RUN_ID); } finally { await app?.close(); await prisma?.$disconnect(); }
  }, 120000);

  describe('another vendor\'s invoices, subscription, tickets, CMS and stock', () => {
    it.each(CROSS_VENDOR)('MARKETING is refused with 403 on %s %s and no service runs', async (method, path) => {
      const s = await status(t.MKT, [method, path]);
      if (s !== 403) throw new Error(`MARKETING ${method.toUpperCase()} ${path} answered ${s}, expected 403`);
      // Stock must look up who owns the product to decide; that lookup is the only call allowed. Nothing may read or change the data itself.
      expect(calls.filter((c) => c.method !== 'ownerOf' && c.method !== 'getProductOwner')).toEqual([]);
    });
    it.each(CROSS_VENDOR)('OPERATIONS, SUPER_ADMIN and the seeded admin can use %s %s (unchanged for SUPER_ADMIN)', async (method, path) => {
      for (const who of ['OPS', 'SUPER', 'BOOT'] as const) {
        const s = await status(t[who], [method, path]);
        if (s === 401 || s === 403) throw new Error(`${who} ${method.toUpperCase()} ${path} answered ${s}`);
      }
    });
    it('a vendor still reaches their OWN records and not another vendor\'s', async () => {
      for (const [method, p] of CROSS_VENDOR.slice(0, 5)) {
        const own = p.replace('/target', `/${vendor.vendorId}`);
        const ok = await status(vendor.token, [method, own]);
        if (ok === 401 || ok === 403) throw new Error(`the vendor ${method.toUpperCase()} ${own} (own data) answered ${ok}`);
        expect(await status(vendor.token, [method, p])).toBe(403);
      }
    });
  });

  describe('add-ons: ?vendorId= is honoured for permitted staff only', () => {
    const lastTarget = () => calls.filter((c) => c.svc === 'AddonsService' && c.method === 'getVendorAddons').pop()?.args[0];
    it('OPERATIONS and SUPER_ADMIN read the target vendor; MARKETING and a vendor get their own', async () => {
      await call(t.OPS, 'get', '/addons/vendor?vendorId=target'); expect(lastTarget()).toBe('target');
      await call(t.SUPER, 'get', '/addons/vendor?vendorId=target'); expect(lastTarget()).toBe('target');
      await call(t.MKT, 'get', '/addons/vendor?vendorId=target'); expect(lastTarget()).toBe(subOf(t.MKT));
      await call(vendor.token, 'get', '/addons/vendor?vendorId=target'); expect(lastTarget()).toBe(vendor.vendorId);
    });
  });

  describe('notifications: the shared admin inbox', () => {
    const lastRecipient = () => calls.filter((c) => c.svc === 'NotificationsService' && c.method === 'findForRecipient').pop()?.args[0];
    it('OPERATIONS and SUPER_ADMIN see it; MARKETING and a vendor see only their own', async () => {
      await call(t.OPS, 'get', '/notifications'); expect(lastRecipient()).toBe(ADMIN_RECIPIENT_ID);
      await call(t.SUPER, 'get', '/notifications'); expect(lastRecipient()).toBe(ADMIN_RECIPIENT_ID);
      await call(t.BOOT, 'get', '/notifications'); expect(lastRecipient()).toBe(ADMIN_RECIPIENT_ID);
      await call(t.MKT, 'get', '/notifications'); expect(lastRecipient()).toBe(subOf(t.MKT));
      await call(vendor.token, 'get', '/notifications'); expect(lastRecipient()).toBe(vendor.vendorId);
    });
  });

  describe('free internal AI generation is kept for every staff role', () => {
    const free = () => calls.filter((c) => c.svc === 'AiService' && c.method === 'generateContent').pop()?.args[2];
    it('staff generate for free; a vendor does not', async () => {
      for (const who of ['SUPER', 'OPS', 'MKT', 'BOOT'] as const) { await call(t[who], 'post', '/ai/generate-content'); expect(free()).toBe(true); }
      await call(vendor.token, 'post', '/ai/generate-content'); expect(free()).toBe(false);
    });
  });

  describe('the "open a vendor first" rule for stock is unchanged', () => {
    it('any staff member asking for GET /stock/low is told to open a vendor', async () => {
      for (const who of ['SUPER', 'OPS', 'MKT'] as const) expect(await status(t[who], ['get', '/stock/low'])).toBe(403);
    });
  });
});
