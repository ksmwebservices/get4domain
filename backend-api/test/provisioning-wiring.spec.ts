import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// @nestjs/schedule ships ES modules that the unit project cannot load (existing limitation: themes/theme-expiry.service has the same import). Only the decorator is needed here.
jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined, CronExpression: { EVERY_30_SECONDS: '*/30 * * * * *' }, ScheduleModule: { forRoot: () => ({ module: class {} }) } }));

import { SiteDocModule } from '../src/site-doc/site-doc.module';
import { StarterService } from '../src/site-doc/starter.service';
import { PlansModule } from '../src/plans/plans.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClaimStore } from '../src/provisioning/claims/claim-store';
import { ClaimsService } from '../src/provisioning/claims/claims.service';
import { InviteStore } from '../src/provisioning/invites/invite-store';
import { ProvisioningModule } from '../src/provisioning/provisioning.module';
import { ProvisioningRepository } from '../src/provisioning/provisioning.repository';
import { JobRunnerService, PROVISIONING_STEPS, ProvisioningAudit, ProvisioningStep } from '../src/provisioning/runner/job-runner.service';
import { ProvisioningCron } from '../src/provisioning/runner/provisioning-cron';
import { SiteProvisioner } from '../src/provisioning/site/site-provisioner';
import { CmsDraftSiteProvisioner } from '../src/provisioning/site/cms-draft-site-provisioner';
import { STEP_ORDER } from '../src/provisioning/core/state-machine';
import { SandboxEmailAdapter, selectEmailAdapter } from '../src/provisioning/invites/email-adapter';

/**
 * S53.7: the real ProvisioningModule resolves every provider with Prisma replaced by an empty stub (nothing connects to any database). This catches a
 * missing binding, a constructor parameter Nest cannot resolve, or a step missing from the runner, which the other tests (which build their own parts) would not.
 */
/** SiteDocModule's own graph (payments, AI, storage) needs real service credentials to construct; this test is about the provisioning module's bindings, so that module is replaced by one that only exports StarterService. */
@Module({ providers: [{ provide: StarterService, useValue: {} }], exports: [StarterService] })
class StubSiteDocModule {}

describe('ProvisioningModule wiring', () => {
  const prevMode = process.env.EMAIL_MODE;
  beforeAll(() => { process.env.EMAIL_MODE = 'test'; });   // the existing capture mode: no mail client is created and nothing can be sent
  afterAll(() => { if (prevMode === undefined) delete process.env.EMAIL_MODE; else process.env.EMAIL_MODE = prevMode; });

  it('compiles, binds every port to its Prisma/real implementation, and gives the runner the five steps in order', async () => {
    const mod = await Test.createTestingModule({ imports: [PlansModule, ProvisioningModule] })
      .overrideModule(SiteDocModule).useModule(StubSiteDocModule)
      .overrideProvider(PrismaService).useValue({})
      .compile();
    expect(mod.get(ProvisioningRepository)).toBeDefined();
    expect(mod.get(ClaimStore)).toBeDefined();
    expect(mod.get(InviteStore)).toBeDefined();
    expect(mod.get(ProvisioningAudit)).toBeDefined();
    expect(mod.get(SiteProvisioner)).toBeInstanceOf(CmsDraftSiteProvisioner);
    expect(mod.get(ClaimsService)).toBeDefined();
    expect(mod.get(ProvisioningCron)).toBeDefined();
    const steps = mod.get<ProvisioningStep[]>(PROVISIONING_STEPS);
    expect(steps.map((s) => s.key)).toEqual([...STEP_ORDER]);
    expect(mod.get(JobRunnerService)).toBeDefined();
    await mod.close();
  });

  it('the default invite mode is the sandbox adapter', () => {
    expect(selectEmailAdapter('sandbox', { sendPlainText: async () => undefined })).toBeInstanceOf(SandboxEmailAdapter);
  });
});
