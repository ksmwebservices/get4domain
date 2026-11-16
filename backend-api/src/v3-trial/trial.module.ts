import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrialSitePort } from '../plans/registration/trial-site.port';
import { DomainSettingsService } from '../site-domains/settings/domain-settings.service';
import { TrialController } from './api/trial.controller';
import { ModuleTrialSite } from './module-trial-site';
import { TrialSignupPolicy } from './trial-signup.policy';

/**
 * Self-service trial signup (Wave 3 Part G). Global, so the registration path (AuthService) and the plans module (RegistrationHook) can take the signup policy and the trial site port as OPTIONAL
 * dependencies without importing this module: a build or a test without it registers exactly as before.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [TrialController],
  providers: [DomainSettingsService, TrialSignupPolicy, ModuleTrialSite, { provide: TrialSitePort, useExisting: ModuleTrialSite }],
  exports: [TrialSignupPolicy, TrialSitePort],
})
export class V3TrialModule {}
