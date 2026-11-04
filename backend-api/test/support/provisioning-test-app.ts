import { INestApplication, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { JwtStrategy } from '../../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { ModuleGuard } from '../../src/common/guards/module.guard';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../../src/common/pipes/edit-validation.pipe';
import { EmailModule } from '../../src/email/email.module';
import { PlansModule } from '../../src/plans/plans.module';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { ProvisioningSettingsService } from '../../src/provisioning/settings/provisioning-settings.service';
import { PROVISIONING_CONTROLLERS, PROVISIONING_PROVIDERS } from '../../src/provisioning/provisioning.providers';
import { SiteProvisioner } from '../../src/provisioning/site/site-provisioner';
import { StarterService } from '../../src/site-doc/starter.service';
import { DIRECTORY_CONTROLLERS, DIRECTORY_PROVIDERS } from '../../src/directory/directory.providers';
import { AI_STUDIO_CONTROLLERS, AI_STUDIO_PROVIDERS } from '../../src/ai-studio/ai-studio.providers';
import { PLAN_BILLING_CONTROLLERS, PLAN_BILLING_PROVIDERS } from '../../src/plan-billing/plan-billing.providers';
import { PaymentsGate } from '../../src/plan-billing/razorpay/payments-gate';
import { BillingSettingsService } from '../../src/plan-billing/settings/billing-settings.service';
import { FakeGate } from './fake-gate';
import { FakeRazorpay } from './fake-razorpay';
import { SITE_DOMAIN_CONTROLLERS, SITE_DOMAIN_PROVIDERS } from '../../src/site-domains/site-domains.providers';
import { SITE_PUBLISH_CONTROLLERS, SITE_PUBLISH_PROVIDERS } from '../../src/site-publish/site-publish.providers';
import { B3SettingsService } from '../../src/b3-settings/b3-settings.service';
import { VENDOR_LIFECYCLE_CONTROLLERS, VENDOR_LIFECYCLE_PROVIDERS } from '../../src/vendor-lifecycle/vendor-lifecycle.providers';

/** Batch 3 pieces, switched on with the b3 option; each slice appends its lists here. */
const B3_PROVIDERS: Provider[] = [B3SettingsService, ...VENDOR_LIFECYCLE_PROVIDERS];
const B3_CONTROLLERS = [...VENDOR_LIFECYCLE_CONTROLLERS];

/**
 * A slim app for the staging integration tests: the REAL provisioning providers, controllers, JWT strategy, guards, pipe, interceptor and filter, over the
 * real (staging) database. The only stub is StarterService (the existing site seeding code, which needs the whole application to construct) and, optionally,
 * the SiteProvisioner (so a test can make the site step fail once). Requires ./staging-env to have been imported first. Mail stays in EmailService's
 * capture mode (EMAIL_MODE=test) and the invite adapter is the sandbox, so nothing is sent.
 */
export async function buildProvisioningTestApp(opts: { siteProvisioner?: (real: SiteProvisioner) => SiteProvisioner; includeSiteApi?: boolean; includeDirectoryApi?: boolean; includeAiApi?: boolean; /** the Batch 3 API (settings, lifecycle) */ b3?: boolean; /** the plan billing API, with this FAKE provider (the staging suites never use a real one) */ billing?: { fake: FakeRazorpay }; /** default: true unless the site API or the directory API is included */ pinLegacySiteMode?: boolean } = {}): Promise<INestApplication> {
  const providers: Provider[] = [...PROVISIONING_PROVIDERS, ...SITE_PUBLISH_PROVIDERS, ...SITE_DOMAIN_PROVIDERS, ...DIRECTORY_PROVIDERS, ...(opts.includeAiApi ? AI_STUDIO_PROVIDERS : []), ...(opts.b3 ? B3_PROVIDERS : []), ...(opts.billing ? [...PLAN_BILLING_PROVIDERS, { provide: PaymentsGate, useFactory: (s: BillingSettingsService) => new FakeGate(s as never, opts.billing!.fake), inject: [BillingSettingsService] }] : []), { provide: StarterService, useValue: { seed: async () => ({ filled: [], kept: [], itemsCreated: 0, designKey: 'none' }) } }];
  const moduleRef = await Test.createTestingModule({
    imports: [PrismaModule, PassportModule, PlansModule, EmailModule],
    controllers: [...PROVISIONING_CONTROLLERS, ...(opts.b3 ? B3_CONTROLLERS : []), ...(opts.includeSiteApi ? [...SITE_PUBLISH_CONTROLLERS, ...SITE_DOMAIN_CONTROLLERS] : []), ...(opts.includeDirectoryApi ? DIRECTORY_CONTROLLERS : []), ...(opts.billing ? PLAN_BILLING_CONTROLLERS : []), ...(opts.includeAiApi ? AI_STUDIO_CONTROLLERS : [])],
    providers: [JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: ModuleGuard }, ...providers],
  }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });   // the payment webhook is verified over the raw bytes
  if (opts.siteProvisioner) {
    const real = app.get(SiteProvisioner);
    const original: SiteProvisioner = { createDraftSite: real.createDraftSite.bind(real) };   // captured first, so a wrapper that calls it does not call itself
    const wrapped = opts.siteProvisioner(original);
    real.createDraftSite = wrapped.createDraftSite.bind(wrapped);   // swap behaviour in place; the step already holds this instance
  }
  // The provisioning tests must not depend on the shared staging setting siteDraftBuilderMode (a leftover "renderer" would add a full site build to every job).
  // The pin is in this app instance only; nothing is written to the database. The site suites (includeSiteApi) read the real setting.
  if (opts.pinLegacySiteMode ?? !(opts.includeSiteApi || opts.includeDirectoryApi || opts.billing || opts.includeAiApi || opts.b3)) {
    const settings = app.get(ProvisioningSettingsService);
    const real = settings.get.bind(settings);
    settings.get = async () => ({ ...(await real()), siteDraftBuilderMode: 'legacy' as const, provisioningDirectoryProfileEnabled: false });   // the slice 5.3 suites must not depend on a leftover staging setting
  }
  app.useGlobalPipes(buildValidationPipe());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}
