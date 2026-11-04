import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SiteDocModule } from '../site-doc/site-doc.module';
import { SitePublishModule } from '../site-publish/site-publish.module';
import { DirectoryModule } from '../directory/directory.module';
import { ProvisioningAdminService } from './admin/provisioning-admin.service';
import { ClaimsService } from './claims/claims.service';
import { ClaimStore } from './claims/claim-store';
import { ProvisioningRepository } from './provisioning.repository';
import { JobRunnerService } from './runner/job-runner.service';
import { PROVISIONING_CONTROLLERS, PROVISIONING_PROVIDERS } from './provisioning.providers';
import { ProvisioningCron } from './runner/provisioning-cron';

/**
 * Provisioning engine, claim links and invites (slice 5.3). Everything behind an abstract class is bound in provisioning.providers.ts, so a later slice swaps
 * one provider (the SiteProvisioner for the theme-kit renderer in 5.4; the email mode is a setting) without touching the runner or the API.
 * PlansModule is @Global, so SubscriptionsService and AuditService are available without importing it here.
 */
@Module({
  imports: [PrismaModule, EmailModule, SiteDocModule, SitePublishModule, DirectoryModule],   // SiteDocModule supplies StarterService to the draft-site adapter
  controllers: PROVISIONING_CONTROLLERS,
  providers: [...PROVISIONING_PROVIDERS, ProvisioningCron],
  exports: [ClaimsService, ProvisioningAdminService, ProvisioningRepository, JobRunnerService, ClaimStore],   // the last three: seeded sites (slice 5.13a) run SEEDED jobs and hand over claim links
})
export class ProvisioningModule {}
