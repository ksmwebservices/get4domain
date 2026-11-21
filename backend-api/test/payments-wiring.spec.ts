import 'reflect-metadata';
import { readFileSync } from 'fs';

// @nestjs/schedule ships ES modules the unit project cannot load; only the decorator is needed here.
jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined, CronExpression: { EVERY_5_MINUTES: '*/5 * * * *', EVERY_30_SECONDS: '*/30 * * * * *' }, ScheduleModule: { forRoot: () => ({ module: class {} }) } }));
process.env.EMAIL_MODE = 'test'; process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-compile-only-secret';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_compile_only'; process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'compile-only-secret';
process.env.PLATFORM_SETTINGS_KEY = process.env.PLATFORM_SETTINGS_KEY || 'unit-test-platform-settings-key-0123456789';

import { Test, TestingModule } from '@nestjs/testing';
import { B3SettingsModule } from '../src/b3-settings/b3-settings.module';
import { B3SettingsService } from '../src/b3-settings/b3-settings.service';
import { DEFAULT_B3_SETTINGS } from '../src/b3-settings/b3-settings';
import { EmailModule } from '../src/email/email.module';
import { PlansModule } from '../src/plans/plans.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RequestsOrdersModule } from '../src/requests-orders/requests-orders.module';
import { RequestsStore } from '../src/requests-orders/requests.store';
import { VendorRequestsService } from '../src/requests-orders/vendor-requests.service';
import { VendorLifecycleModule } from '../src/vendor-lifecycle/vendor-lifecycle.module';
import { V3ActivityModule } from '../src/v3-activity/activity.module';
import { ActivityStore } from '../src/v3-activity/activity.store';
import { ActivityService } from '../src/v3-activity/activity.service';
import { PayRequestsModule } from '../src/v3-payments/payments.module';
import { PayLinkBridgeModule } from '../src/v3-payments/pay-link.module';
import { PublicRequestsService } from '../src/requests-orders/public-requests.service';
import { PaymentsService } from '../src/v3-payments/payments.service';
import { DocumentsService } from '../src/v3-payments/documents.service';
import { MePayRequestsController, PublicPayController } from '../src/v3-payments/api/payments.controllers';
import { MeDocumentsController, PublicDocController } from '../src/v3-payments/api/documents.controllers';
import { MePaymentsController } from '../src/requests-orders/api/me-requests.controller';
import { MemoryActivityStore } from './support/memory-activity-store';
import { MemoryRequestsStore } from './support/memory-requests-store';

/**
 * Stage 9 PRODUCTION wiring. The staging harness proved the logic; this proves the REAL modules, as app.module.ts lists them, resolve together, and that the OPTIONAL
 * ActivityService really reaches the three Stage 9 services (an optional parameter with no provider would silently drop every audit entry). Database faked, nothing connects.
 */
jest.setTimeout(60_000);
const fakePrisma = new Proxy({}, { get: (_t, k) => (k === 'then' ? undefined : k === 'onModuleInit' || k === 'onModuleDestroy' ? async () => undefined : () => undefined) });
const OWNER = { type: 'VENDOR' as const, id: 'user-1', ip: null };
let mod: TestingModule; let activityStore: MemoryActivityStore;

/** Every route path of a controller class: its own prefix plus each method path. */
const routes = (c: new (...a: never[]) => object): string[] => {
  const proto = c.prototype as Record<string, object>; const base = String(Reflect.getMetadata('path', c));
  return Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor' && Reflect.getMetadata('path', proto[n]) !== undefined).map((n) => `${base}/${String(Reflect.getMetadata('path', proto[n]))}`);
};

beforeAll(async () => {
  activityStore = new MemoryActivityStore();
  mod = await Test.createTestingModule({ imports: [PrismaModule, PlansModule, EmailModule, B3SettingsModule, VendorLifecycleModule, V3ActivityModule, RequestsOrdersModule, PayRequestsModule, PayLinkBridgeModule] })
    .overrideProvider(PrismaService).useValue(fakePrisma).overrideProvider(RequestsStore).useValue(new MemoryRequestsStore())
    .overrideProvider(ActivityStore).useValue(activityStore).overrideProvider(B3SettingsService).useValue({ get: async () => DEFAULT_B3_SETTINGS, invalidate: () => undefined }).compile();
});
afterAll(async () => { await mod?.close(); });

describe('app.module.ts registers the Stage 9 modules', () => {
  it('lists the requests, pay-request and activity modules', () => {
    const src = readFileSync(`${__dirname}/../src/app.module.ts`, 'utf8'); const imports = src.slice(src.indexOf('imports: ['));
    for (const m of ['RequestsOrdersModule', 'PayRequestsModule', 'PayLinkBridgeModule', 'V3ActivityModule']) expect(imports).toContain(m);
  });
  it('the modules declare the payment-method, pay-request and document controllers', () => {
    const declared = (Reflect.getMetadata('controllers', PayRequestsModule) ?? []) as unknown[];
    for (const c of [MePayRequestsController, PublicPayController, MeDocumentsController, PublicDocController]) expect(declared).toContain(c);
    expect((Reflect.getMetadata('controllers', RequestsOrdersModule) ?? []) as unknown[]).toContain(MePaymentsController);
  });
  it('the routes exist with the paths the API promises', () => {
    expect(routes(MePaymentsController)).toEqual(expect.arrayContaining(['v3/me/payment-methods', 'v3/me/payment-methods/:id', 'v3/me/payment-methods/:id/default']));
    expect(routes(MePayRequestsController)).toEqual(expect.arrayContaining(['v3/me/payment-requests/:id/mark-paid', 'v3/me/payment-requests/:id/cancel', 'v3/me/payment-requests/record-offline']));
    expect(routes(PublicPayController)).toEqual(expect.arrayContaining(['v3/public/pay/:code', 'v3/public/pay/:code/i-have-paid']));
    expect(routes(MeDocumentsController)).toEqual(expect.arrayContaining(['v3/me/tax-profile', 'v3/me/documents', 'v3/me/documents/:id/resend', 'v3/me/documents/:id/download']));
    expect(routes(PublicDocController)).toEqual(['v3/public/doc/:code']);
  });
});

describe('checkout makes the pay request itself (Amendment 09 W3), wired in the real app', () => {
  it('the optional pay-link port of the order route is the real pay requests service (not undefined: an unbound optional port would silently keep the old step)', () => {
    expect((mod.get(PublicRequestsService, { strict: false }) as unknown as { payLinks?: unknown }).payLinks).toBe(mod.get(PaymentsService, { strict: false }));
  });
});

describe('the optional ActivityService reaches the Stage 9 services in the real app', () => {
  it('is injected into the payment method, pay request and document services (not undefined)', () => {
    const a = mod.get(ActivityService);
    for (const s of [VendorRequestsService, PaymentsService, DocumentsService]) expect((mod.get(s, { strict: false }) as unknown as { activity?: unknown }).activity).toBe(a);
  });
  it('a confirmed UPI change through the real service writes payment_method.upi_changed with field names only', async () => {
    const svc = mod.get(VendorRequestsService, { strict: false });
    const m = await svc.createMethod('va', { kind: 'UPI', label: 'Shop UPI', upiId: 'priya.shop@oksbi', payeeName: 'Priya Stores' } as never, OWNER);
    await svc.updateMethod('va', m.id, { upiId: 'new.shop@okaxis', confirmUpiChange: true } as never, OWNER);
    const rows = activityStore.activity.filter((r) => r.actionKey === 'payment_method.upi_changed');
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ vendorId: 'va', entityType: 'payment_method', entityId: m.id }); expect(JSON.stringify(rows[0].summary)).not.toContain('new.shop');
  });
});
