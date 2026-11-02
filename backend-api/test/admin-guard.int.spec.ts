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
 * The routes below are stubs, but they are declared with the same controller prefix, method and path as real AdminGuard routes
 * (DELETE /vendors/:id, POST /wallet/deduct, GET /leads, ...), so Express reports the same `req.route.path` the matrix is keyed on.
 * Before the fix a MARKETING member could call every one of them. Handlers only return a marker: no data is touched.
 */
@Controller('vendors')
class StubVendors {
  @Delete(':id') @UseGuards(AdminGuard) remove() { return { ran: 'DELETE /vendors/:id' }; }
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
@Controller('not-in-the-matrix')
class StubUnlisted {
  @Get('x') @UseGuards(AdminGuard) x() { return { ran: 'GET /not-in-the-matrix/x' }; }
}

describe('AdminGuard with real staff accounts (staging database)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let vendor: SeededTenant;
  let t: { SUPER_ADMIN: string; OPERATIONS: string; MARKETING: string; bootstrap: string; invited: string };

  const call = (token: string | undefined, method: 'get' | 'post' | 'delete', path: string) => {
    const r = request(app.getHttpServer())[method](path);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };

  beforeAll(async () => {
    prisma = newPrisma();
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, PassportModule],
      controllers: [StubVendors, StubWallet, StubInvoices, StubLeads, StubUnlisted],
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

  const DENIED_TO_MARKETING: Array<['get' | 'post' | 'delete', string]> = [
    ['delete', '/vendors/abc'], ['post', '/wallet/deduct'], ['post', '/invoices/abc/mark-paid'],
  ];

  describe('MARKETING staff', () => {
    it.each(DENIED_TO_MARKETING)('is refused with 403 on %s %s', async (method, path) => {
      const res = await call(t.MARKETING, method, path);
      if (res.status !== 403) throw new Error(`MARKETING ${method.toUpperCase()} ${path} answered ${res.status}, expected 403 (handler ran: ${JSON.stringify(res.body).includes('ran')})`);
      expect(JSON.stringify(res.body)).not.toContain('ran');
    });
    it('still works on a route its job needs (GET /leads)', async () => {
      const res = await call(t.MARKETING, 'get', '/leads');
      expect(res.status).toBe(200);
    });
  });

  describe('OPERATIONS and SUPER_ADMIN staff', () => {
    it.each([['OPERATIONS'], ['SUPER_ADMIN']] as const)('%s can use every route', async (role) => {
      for (const [method, path] of [...DENIED_TO_MARKETING, ['get', '/leads']] as Array<['get' | 'post' | 'delete', string]>) {
        const res = await call(t[role], method, path);
        if (res.status >= 300) throw new Error(`${role} ${method.toUpperCase()} ${path} answered ${res.status}`);
      }
    });
    it('the seeded platform admin (a Vendor row with role ADMIN) can use every route', async () => {
      for (const [method, path] of [...DENIED_TO_MARKETING, ['get', '/leads']] as Array<['get' | 'post' | 'delete', string]>) {
        expect((await call(t.bootstrap, method, path)).status).toBeLessThan(300);
      }
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
      expect((await call(vendor.token, 'get', '/leads')).status).toBe(403);
      expect((await call(vendor.memberToken, 'get', '/leads')).status).toBe(403);
    });
    it('a staff member who has not accepted the invite gets 401', async () => {
      expect((await call(t.invited, 'get', '/leads')).status).toBe(401);
    });
    it('no token is 401', async () => {
      expect((await call(undefined, 'get', '/leads')).status).toBe(401);
    });
  });
});
