import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthService } from '../src/auth/auth.service';
import { AuditService } from '../src/plans/admin/audit.service';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { PlansRepository } from '../src/plans/entitlements/plans.repository';
import { RegistrationHook } from '../src/plans/registration/registration.hook';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { fakePrisma, T0 } from './support/fake-plans-prisma';

/** S51.8: the registration hook. Behind a setting, idempotent, and a failure never blocks registration. */
class NullRepo extends PlansRepository {
  async loadCatalogue() { return { plans: [], matrix: new Map(), featureKeys: [], settings: { graceDays: 7, downgradeBehaviour: 'FALL_TO_FREE' } }; }
  async loadVendorState() { return { flagOn: false, subscription: null, overrides: [] }; }
}
const freePlan = (track: string) => ({ id: `F_${track}`, key: `${track}_free`, track: track.toUpperCase(), level: 'FREE', status: 'ACTIVE' });

function setup() {
  const prisma = fakePrisma();
  const ent = new EntitlementsService(new NullRepo());
  const subs = new SubscriptionsService(prisma as never, new AuditService(prisma as never), ent);
  const hook = new RegistrationHook(prisma as never, subs);
  prisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });
  prisma.vendor.update.mockResolvedValue({});
  prisma.v3Plan.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => (where.key.endsWith('_free') ? freePlan(where.key.replace('_free', '')) : null));
  prisma.v3PlanSubscription.findUnique.mockResolvedValue(null);
  prisma.v3PlanSubscription.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'sub1', ...data }));
  prisma.v3PlanSetting.findUnique.mockResolvedValue({ key: 'registrationProvisioning', valueJson: true });
  return { prisma, subs, hook, ent };
}

describe('provisionFreeSubscription', () => {
  it('gives the vendor the FREE plan of the chosen track: source REGISTRATION, no term, no end, an event, an audit row, and the vendor provenance', async () => {
    const { prisma, subs } = setup();
    const sub = await subs.provisionFreeSubscription('v1', 'professional', 'REGISTRATION', T0);
    expect(sub).toMatchObject({ vendorId: 'v1', planId: 'F_professional', source: 'REGISTRATION', termMonths: null, endsAt: null, currentVendorId: 'v1', createdByType: 'SYSTEM' });
    expect(prisma.v3SubscriptionEvent.create.mock.calls[0][0].data).toMatchObject({ type: 'FREE_PROVISIONED', toPlanId: 'F_professional', actorType: 'SYSTEM' });
    expect(prisma.v3AuditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.vendor.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { source: 'REGISTRATION' } });
  });

  it('is idempotent: a vendor that already has a subscription is left alone (nothing created, nothing closed)', async () => {
    const { prisma, subs } = setup();
    prisma.v3PlanSubscription.findFirst.mockResolvedValue({ id: 'existing', vendorId: 'v1' });
    const sub = await subs.provisionFreeSubscription('v1', 'handyman', 'REGISTRATION');
    expect(sub).toMatchObject({ id: 'existing' });
    expect(prisma.v3PlanSubscription.create).not.toHaveBeenCalled();
    expect(prisma.v3PlanSubscription.update).not.toHaveBeenCalled();
    expect(prisma.v3SubscriptionEvent.create).not.toHaveBeenCalled();
  });

  it('a lost race (the database refuses a second current subscription) returns the winner instead of failing', async () => {
    const { prisma, subs } = setup();
    prisma.v3PlanSubscription.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'winner', vendorId: 'v1' });
    prisma.v3PlanSubscription.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: '6.19.3' }));
    expect(await subs.provisionFreeSubscription('v1', 'ecommerce', 'REGISTRATION')).toMatchObject({ id: 'winner' });
  });

  it('an unknown track is refused', async () => {
    const { subs } = setup();
    await expect(subs.provisionFreeSubscription('v1', 'banking', 'REGISTRATION')).rejects.toThrow(/track/i);
  });
});

describe('RegistrationHook (behind the registrationProvisioning setting)', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => { warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined); });
  afterEach(() => jest.restoreAllMocks());

  it('setting off (the default): nothing happens', async () => {
    const { prisma, hook } = setup();
    prisma.v3PlanSetting.findUnique.mockResolvedValue({ valueJson: false });
    await hook.afterRegister('v1', 'handyman');
    expect(prisma.v3PlanSubscription.create).not.toHaveBeenCalled();
    prisma.v3PlanSetting.findUnique.mockResolvedValue(null);
    await hook.afterRegister('v1', 'handyman');
    expect(prisma.v3PlanSubscription.create).not.toHaveBeenCalled();
  });

  it('setting on: the Free plan of the chosen track is provisioned', async () => {
    const { prisma, hook } = setup();
    await hook.afterRegister('v1', 'handyman');
    expect(prisma.v3PlanSubscription.create.mock.calls[0][0].data).toMatchObject({ planId: 'F_handyman', source: 'REGISTRATION' });
  });

  it('no track, or a track that is not one of the three: skipped quietly (the vendor stays as before; staff can assign a plan)', async () => {
    const { prisma, hook } = setup();
    await hook.afterRegister('v1', undefined);
    await hook.afterRegister('v1', 'banking');
    expect(prisma.v3PlanSubscription.create).not.toHaveBeenCalled();
  });

  it('a failure never escapes: the error is logged (without the vendor\'s details) and registration continues', async () => {
    const { prisma, hook } = setup();
    prisma.$transaction.mockRejectedValue(new Error('connection to db-host-secret.example refused password=hunter2'));
    await expect(hook.afterRegister('v1', 'handyman')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).not.toMatch(/hunter2|db-host-secret/);
  });
});

describe('AuthService.register calls the hook and is never blocked by it', () => {
  const dto = { name: 'A', email: 'a@x.invalid', password: 'StrongPass1', businessName: 'Biz', industry: 'plumber', track: 'handyman' };
  const make = (hook: { afterRegister: jest.Mock }) => {
    const prisma = { vendor: { findUnique: jest.fn().mockResolvedValue(null) }, vendorAddon: { upsert: jest.fn() } };
    const jwt = { sign: jest.fn().mockReturnValue('token') };
    const vendors = { create: jest.fn().mockResolvedValue({ id: 'v1', name: 'A', email: 'a@x.invalid', role: 'VENDOR', businessName: 'Biz', industry: 'plumber', subdomain: 'biz' }) };
    return { svc: new AuthService(prisma as never, jwt as never, vendors as never, hook as never), vendors };
  };

  it('passes the new vendor id and the chosen track to the hook, after the vendor exists', async () => {
    const hook = { afterRegister: jest.fn().mockResolvedValue(undefined) };
    const { svc } = make(hook);
    const out = await svc.register(dto as never);
    expect(hook.afterRegister).toHaveBeenCalledWith('v1', 'handyman');
    expect(out.accessToken).toBeDefined();
  });

  it('a hook that throws does not change the registration result', async () => {
    const hook = { afterRegister: jest.fn().mockRejectedValue(new Error('boom')) };
    const { svc } = make(hook);
    await expect(svc.register(dto as never)).resolves.toMatchObject({ user: { id: 'v1' } });
  });

  it('no hook configured (an app without the plans module): registration is unchanged', async () => {
    const prisma = { vendor: { findUnique: jest.fn().mockResolvedValue(null) } };
    const vendors = { create: jest.fn().mockResolvedValue({ id: 'v1', name: 'A', email: 'a@x.invalid', role: 'VENDOR', businessName: 'Biz', industry: 'plumber', subdomain: 'biz' }) };
    const svc = new AuthService(prisma as never, { sign: jest.fn().mockReturnValue('t') } as never, vendors as never);
    await expect(svc.register(dto as never)).resolves.toMatchObject({ accessToken: 't' });
  });
});

describe('dependency injection (the auth module is not edited)', () => {
  it('PlansModule is global: a provider in a module that does NOT import it still receives the RegistrationHook', async () => {
    const { Injectable, Module, Optional } = await import('@nestjs/common');
    const { Test } = await import('@nestjs/testing');
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const { PlansModule } = await import('../src/plans/plans.module');
    @Injectable()
    class Probe { constructor(@Optional() readonly hook?: RegistrationHook) {} }
    @Module({ providers: [Probe], exports: [Probe] })
    class OtherModule {}
    const ref = await Test.createTestingModule({ imports: [PlansModule, OtherModule] }).overrideProvider(PrismaService).useValue(fakePrisma()).compile();
    expect(ref.get(Probe).hook).toBeInstanceOf(RegistrationHook);
  });
});
