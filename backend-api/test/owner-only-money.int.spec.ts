// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { VendorBillingController } from '../src/commercial/commercial.controllers';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LeadspaceRefillController } from '../src/leadspace/wallet.controllers';
import { PaymentsController } from '../src/payments/payments.controller';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PacksVendorController } from '../src/site-doc/packs.controller';
import { WalletController } from '../src/wallet/wallet.controller';
import { WebsiteThemesController } from '../src/website-themes/website-themes.controller';
import { SeededTenant, cleanupTenants, newPrisma, seedMember, seedTenant } from './support/fixtures';

// @nestjs/schedule ships ES modules that Jest does not parse; the real billing controller reaches it through renewal.service.
// Only its cron decorators are needed at import time, and no job should run in a test anyway.
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined, Interval: () => () => undefined, Timeout: () => () => undefined,
  CronExpression: new Proxy({}, { get: () => '* * * * *' }), ScheduleModule: {}, SchedulerRegistry: class {},
}));

/**
 * S8-B end to end: anything that starts a payment, buys something or tops up the wallet is OWNER-ONLY, even for a team member who was
 * granted the matching area. Reads stay area-gated.
 *
 * The six REAL controllers are mounted (so the real decorators, guards and `assertVendorPrincipal` run) under the real JwtStrategy +
 * JwtAuthGuard + ModuleGuard against STAGING, with every service replaced by a recorder. A refused request must never reach a service,
 * so `serviceCalls` stays empty: no Razorpay order, no wallet credit, no theme purchase can start.
 */
const serviceCalls: string[] = [];
const recorder = (name: string): unknown => new Proxy({}, {
  get: (_t, prop) => {
    if (prop === 'then' || typeof prop === 'symbol') return undefined;       // not a thenable
    return (...args: unknown[]) => { serviceCalls.push(`${name}.${String(prop)}`); void args; return { ran: true }; };
  },
});

type M = 'get' | 'post' | 'delete';
const OWNER_ONLY: Array<[M, string]> = [
  ['post', '/billing/invoices/abc/razorpay/order'], ['post', '/billing/invoices/abc/razorpay/verify'], ['post', '/billing/invoices/abc/proof'],
  ['post', '/billing/invoices/abc/promo'], ['delete', '/billing/invoices/abc/promo'], ['post', '/billing/plan-change-requests'],
  ['post', '/payments/create-order'], ['post', '/payments/verify'],
  ['post', '/website-themes/abc/unlock/order'], ['post', '/website-themes/abc/unlock/confirm'],
  ['post', '/wallet/topup'], ['post', '/wallet/topup/verify'],
  ['post', '/leadspace/wallet/refill'], ['post', '/leadspace/wallet/refill/verify'],
  ['post', '/site-doc/me/themes/abc/order'], ['post', '/site-doc/me/themes/abc/confirm'],
];

describe('money and purchase routes are owner-only (staging database, real controllers, mocked services)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let A: SeededTenant;
  let fullMember: string;     // team member holding BOTH areas the routes sit under (wallet + website): still must be refused
  let noAreaMember: string;   // team member with neither area

  const call = (token: string | undefined, method: M, path: string) => {
    const r = request(app.getHttpServer())[method](path);
    return (token ? r.set('Authorization', `Bearer ${token}`) : r).send({});
  };

  beforeAll(async () => {
    prisma = newPrisma();
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, PassportModule],
      controllers: [VendorBillingController, PaymentsController, WebsiteThemesController, WalletController, LeadspaceRefillController, PacksVendorController],
      providers: [JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: ModuleGuard }],
    }).useMocker((token) => recorder(typeof token === 'function' ? token.name : String(token))).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    A = await seedTenant(prisma, 'om', RUN_ID);
    fullMember = await seedMember(prisma, A.vendorId, 'om-full', RUN_ID, ['wallet', 'website', 'accounts']);
    noAreaMember = await seedMember(prisma, A.vendorId, 'om-none', RUN_ID, ['telecrm']);
  }, 120000);

  beforeEach(() => { serviceCalls.length = 0; });

  afterAll(async () => {
    try { await cleanupTenants(prisma, RUN_ID); } finally { await app?.close(); await prisma?.$disconnect(); }
  }, 120000);

  describe('a team member is refused with 403 before any service runs', () => {
    it.each(OWNER_ONLY)('%s %s: member holding the wallet + website areas', async (method, path) => {
      const res = await call(fullMember, method, path);
      if (res.status !== 403) throw new Error(`${method.toUpperCase()} ${path} as a member WITH the areas answered ${res.status}, expected 403`);
      expect(serviceCalls).toEqual([]);
    });
    it.each(OWNER_ONLY)('%s %s: member with no matching area', async (method, path) => {
      const res = await call(noAreaMember, method, path);
      if (res.status !== 403) throw new Error(`${method.toUpperCase()} ${path} as a member WITHOUT the areas answered ${res.status}, expected 403`);
      expect(serviceCalls).toEqual([]);
    });
    it('no token is 401', async () => {
      for (const [method, path] of OWNER_ONLY) expect((await call(undefined, method, path)).status).toBe(401);
    });
  });

  describe('the owner is not blocked by the guard (control)', () => {
    it.each(OWNER_ONLY)('%s %s gets past the guards', async (method, path) => {
      const res = await call(A.token, method, path);
      if (res.status === 401 || res.status === 403) throw new Error(`${method.toUpperCase()} ${path} as the owner answered ${res.status}: the guard blocked the owner`);
    });
  });

  describe('reads stay area-gated, not owner-only', () => {
    it('GET /wallet/balance: member with wallet passes, member without is refused', async () => {
      expect((await call(fullMember, 'get', '/wallet/balance')).status).not.toBe(403);
      expect((await call(noAreaMember, 'get', '/wallet/balance')).status).toBe(403);
    });
    it('GET /billing/me: member with wallet passes, member without is refused (assertVendorPrincipal)', async () => {
      expect((await call(fullMember, 'get', '/billing/me')).status).not.toBe(403);
      expect((await call(noAreaMember, 'get', '/billing/me')).status).toBe(403);
    });
    it('GET /website-themes/mine: member with website passes, member without is refused (the new server-side gate)', async () => {
      expect((await call(fullMember, 'get', '/website-themes/mine')).status).not.toBe(403);
      expect((await call(noAreaMember, 'get', '/website-themes/mine')).status).toBe(403);
      expect((await call(A.token, 'get', '/website-themes/mine')).status).not.toBe(403);
    });
  });
});
