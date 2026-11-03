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
import { PROVISIONING_CONTROLLERS, PROVISIONING_PROVIDERS } from '../../src/provisioning/provisioning.providers';
import { SiteProvisioner } from '../../src/provisioning/site/site-provisioner';
import { StarterService } from '../../src/site-doc/starter.service';
import { SITE_PUBLISH_PROVIDERS } from '../../src/site-publish/site-publish.providers';

/**
 * A slim app for the staging integration tests: the REAL provisioning providers, controllers, JWT strategy, guards, pipe, interceptor and filter, over the
 * real (staging) database. The only stub is StarterService (the existing site seeding code, which needs the whole application to construct) and, optionally,
 * the SiteProvisioner (so a test can make the site step fail once). Requires ./staging-env to have been imported first. Mail stays in EmailService's
 * capture mode (EMAIL_MODE=test) and the invite adapter is the sandbox, so nothing is sent.
 */
export async function buildProvisioningTestApp(opts: { siteProvisioner?: (real: SiteProvisioner) => SiteProvisioner } = {}): Promise<INestApplication> {
  const providers: Provider[] = [...PROVISIONING_PROVIDERS, ...SITE_PUBLISH_PROVIDERS, { provide: StarterService, useValue: { seed: async () => ({ filled: [], kept: [], itemsCreated: 0, designKey: 'none' }) } }];
  const moduleRef = await Test.createTestingModule({
    imports: [PrismaModule, PassportModule, PlansModule, EmailModule],
    controllers: PROVISIONING_CONTROLLERS,
    providers: [JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: ModuleGuard }, ...providers],
  }).compile();
  const app = moduleRef.createNestApplication();
  if (opts.siteProvisioner) {
    const real = app.get(SiteProvisioner);
    const original: SiteProvisioner = { createDraftSite: real.createDraftSite.bind(real) };   // captured first, so a wrapper that calls it does not call itself
    const wrapped = opts.siteProvisioner(original);
    real.createDraftSite = wrapped.createDraftSite.bind(wrapped);   // swap behaviour in place; the step already holds this instance
  }
  app.useGlobalPipes(buildValidationPipe());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}
