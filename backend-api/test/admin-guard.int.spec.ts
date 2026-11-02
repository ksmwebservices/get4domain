// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { Controller, Delete, Get, INestApplication, Post, UseGuards } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaModule } from '../src/prisma/prisma.module';
import { SeededTenant, cleanupTenants, newPrisma, seedBootstrapAdmin, seedStaff, seedTenant } from './support/fixtures';

/**
 * S7 end to end, with REAL staff accounts (rows in g4d_admin_team_members) and the REAL JwtStrategy + JwtAuthGuard + AdminGuard.
 * The routes below are stubs, but each is declared with the same controller prefix, method and path as a real AdminGuard route, so Express
 * reports the same `req.route.path` the matrix is keyed on. Handlers only return a marker: no data is touched.
 *
 * Three tiers (owner decisions; tightened to match the admin UI):
 *   SUPER_ADMIN only     DELETE /vendors/:id · GET /leads · GET /analytics/platform-accounting
 *   OPERATIONS + SUPER   POST /vendors/:id/suspend · POST /wallet/deduct · POST /invoices/:id/mark-paid · GET /support/tickets
 *   all staff            GET /admin/quotes
 */
@Controller('vendors')
class StubVendors {
  @Delete(':id') @UseGuards(AdminGuard) remove() { return { ran: 'DELETE /vendors/:id' }; }
  @Post(':id/suspend') @UseGuards(AdminGuard) suspend() { return { ran: 'POST /vendors/:id/suspend' }; }
}
@Controller('wallet')
class StubWallet {
  @Post('deduct') @UseGuards(AdminGuard) deduct() { return { ran: 'POST /wallet/deduct' }; }
}
@Controller('invoices')
class StubInvoices {
  @Post(':id/mark-paid') @UseGuards(AdminGuard) markPaid() { return { ran: 'POST /invoices/:id/mark-paid' }; }
}
@Controller('leads')
class StubLeads {
  @Get() @UseGuards(AdminGuard) list() { return { ran: 'GET /leads' }; }
}
@Controller('support')
class StubSupport {
  @Get('tickets') @UseGuards(AdminGuard) tickets() { return { ran: 'GET /support/tickets' }; }
}
@Controller('analytics')
class StubAnalytics {
  @Get('platform-accounting') @UseGuards(AdminGuard) accounting() { return { ran: 'GET /analytics/platform-accounting' }; }
}
@Controller('admin/quotes')
class StubQuotes {
  @Get() @UseGuards(AdminGuard) list() { return { ran: 'GET /admin/quotes' }; }
}
@Controller('not-in-the-matrix')
class StubUnlisted {
  @Get('x') @UseGuards(AdminGuard) x() { return { ran: 'GET /not-in-the-matrix/x' }; }
}

type M = 'get' | 'post' | 'delete';
const SUPER_ONLY: Array<[M, string]> = [['delete', '/vendors/abc'], ['get', '/leads'], ['get', '/analytics/platform-accounting']];
const OPS_AND_SUPER: Array<[M, string]> = [['post', '/vendors/abc/suspend'], ['post', '/wallet/deduct'], ['post', '/invoices/abc/mark-paid'], ['get', '/support/tickets']];
const ALL_STAFF: Array<[M, string]> = [['get', '/admin/quotes']];

describe('AdminGuard with real staff accounts (staging database)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let vendor: SeededTenant;
  let t: { SUPER_ADMIN: string; OPERATIONS: string; MARKETING: string; bootstrap: string; invited: string };

  const call = (token: string | undefined, method: M, path: string) => {
    const r = request(app.getHttpServer())[method](path);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };
  const expectStatus = async (who: string, token: string, [method, path]: [M, string], ok: boolean) => {
    const res = await call(token, method, path);
    const good = ok ? res.status < 300 : res.status === 403;
    if (!good) throw new Error(`${who} ${method.toUpperCase()} ${path} answered ${res.status}, expected ${ok ? '2xx' : '403'} (handler ran: ${JSON.stringify(res.body).includes('ran')})`);
    if (!ok) expect(JSON.stringify(res.body)).not.toContain('ran');
  };

  beforeAll(async () => {
    prisma = newPrisma();
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, PassportModule],
      controllers: [StubVendors, StubWallet, StubInvoices, StubLeads, StubSupport, StubAnalytics, StubQuotes, StubUnlisted],
      providers: [JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    vendor = await seedTenant(prisma, 'sv', RUN_ID);
    t = {
      SUPER_ADMIN: await seedStaff(prisma, 'super', RUN_ID, 'SUPER_ADMIN'),
      OPERATIONS: await seedStaff(prisma, 'ops', RUN_ID, 'OPERATIONS'),
      MARKETING: await seedStaff(prisma, 'mkt', RUN_ID, 'MARKETING'),
      bootstrap: await seedBootstrapAdmin(prisma, 'boot', RUN_ID),
      invited: await seedStaff(prisma, 'invited', RUN_ID, 'MARKETING', 'invited'),   // not accepted yet: must not work at all
    };
  }, 120000);

  afterAll(async () => {
    try { await cleanupTenants(prisma, RUN_ID); } finally { await app?.close(); await prisma?.$disconnect(); }
  }, 120000);

  describe('MARKETING staff', () => {
    it.each([...SUPER_ONLY, ...OPS_AND_SUPER])('is refused with 403 on %s %s', async (method, path) => {
      await expectStatus('MARKETING', t.MARKETING, [method, path], false);
    });
    it.each(ALL_STAFF)('still works on a route its job needs (%s %s)', async (method, path) => {
      await expectStatus('MARKETING', t.MARKETING, [method, path], true);
    });
  });

  describe('OPERATIONS staff', () => {
    it.each(SUPER_ONLY)('is refused with 403 on the SUPER_ADMIN-only route %s %s', async (method, path) => {
      await expectStatus('OPERATIONS', t.OPERATIONS, [method, path], false);
    });
    it.each([...OPS_AND_SUPER, ...ALL_STAFF])('can use %s %s', async (method, path) => {
      await expectStatus('OPERATIONS', t.OPERATIONS, [method, path], true);
    });
    it('may suspend a vendor but not delete one', async () => {
      await expectStatus('OPERATIONS', t.OPERATIONS, ['post', '/vendors/abc/suspend'], true);
      await expectStatus('OPERATIONS', t.OPERATIONS, ['delete', '/vendors/abc'], false);
    });
  });

  describe('SUPER_ADMIN and the seeded platform admin', () => {
    it.each([['SUPER_ADMIN'], ['bootstrap']] as const)('%s can use every route, including the SUPER_ADMIN-only ones', async (who) => {
      for (const route of [...SUPER_ONLY, ...OPS_AND_SUPER, ...ALL_STAFF]) await expectStatus(who, t[who], route, true);
    });
  });

  describe('deny by default', () => {
    it('a route with AdminGuard but no matrix entry is SUPER_ADMIN only', async () => {
      expect((await call(t.SUPER_ADMIN, 'get', '/not-in-the-matrix/x')).status).toBe(200);
      expect((await call(t.bootstrap, 'get', '/not-in-the-matrix/x')).status).toBe(200);
      expect((await call(t.OPERATIONS, 'get', '/not-in-the-matrix/x')).status).toBe(403);
      expect((await call(t.MARKETING, 'get', '/not-in-the-matrix/x')).status).toBe(403);
    });
  });

  describe('everyone else is still refused', () => {
    it('a vendor owner and a vendor team member get 403', async () => {
      expect((await call(vendor.token, 'get', '/admin/quotes')).status).toBe(403);
      expect((await call(vendor.memberToken, 'get', '/admin/quotes')).status).toBe(403);
    });
    it('a staff member who has not accepted the invite gets 401', async () => {
      expect((await call(t.invited, 'get', '/admin/quotes')).status).toBe(401);
    });
    it('no token is 401', async () => {
      expect((await call(undefined, 'get', '/admin/quotes')).status).toBe(401);
    });
  });
});
