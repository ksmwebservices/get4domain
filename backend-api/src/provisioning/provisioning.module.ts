import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SiteDocModule } from '../site-doc/site-doc.module';
import { ProvisioningAdminController } from './admin/provisioning-admin.controller';
import { ProvisioningAdminService } from './admin/provisioning-admin.service';
import { ClaimPublicController } from './claims/claims-public.controller';
import { ClaimStore, PrismaClaimStore } from './claims/claim-store';
import { ClaimsService } from './claims/claims.service';
import { InviteStore, PrismaInviteStore } from './invites/invite-store';
import { PrismaProvisioningAudit } from './provisioning-audit';
import { PrismaProvisioningRepository, ProvisioningRepository } from './provisioning.repository';
import { JobRunnerService, PROVISIONING_STEPS, ProvisioningAudit, ProvisioningStep } from './runner/job-runner.service';
import { ProvisioningCron } from './runner/provisioning-cron';
import { ProvisioningSettingsService } from './settings/provisioning-settings.service';
import { CmsDraftSiteProvisioner } from './site/cms-draft-site-provisioner';
import { SiteProvisioner } from './site/site-provisioner';
import { AssignFreePlanStep } from './steps/assign-free-plan.step';
import { CreateClaimLinkStep } from './steps/create-claim-link.step';
import { CreateFreeSiteDraftStep } from './steps/create-free-site-draft.step';
import { CreateVendorStep } from './steps/create-vendor.step';
import { SendInviteStep } from './steps/send-invite.step';
import { BusinessVendors, PrismaBusinessVendors } from './vendors/business-vendors';

/**
 * Provisioning engine, claim links and invites (slice 5.3). Everything behind an abstract class is bound here, so a later slice swaps one provider
 * (the SiteProvisioner for the theme-kit renderer in 5.4, the email adapter mode by setting) without touching the runner or the API.
 * Needs the slice 5.1 PlansModule (global) for SubscriptionsService and AuditService.
 */
@Module({
  imports: [PrismaModule, EmailModule, SiteDocModule],   // PlansModule is @Global (SubscriptionsService, AuditService)
  controllers: [ProvisioningAdminController, ClaimPublicController],
  providers: [
    { provide: ProvisioningRepository, useClass: PrismaProvisioningRepository },
    { provide: BusinessVendors, useClass: PrismaBusinessVendors },
    { provide: SiteProvisioner, useClass: CmsDraftSiteProvisioner },
    { provide: ClaimStore, useClass: PrismaClaimStore },
    { provide: InviteStore, useClass: PrismaInviteStore },
    { provide: ProvisioningAudit, useClass: PrismaProvisioningAudit },
    ProvisioningSettingsService, ClaimsService, ProvisioningAdminService, ProvisioningCron,
    CreateVendorStep, AssignFreePlanStep, CreateFreeSiteDraftStep, CreateClaimLinkStep, SendInviteStep,
    {
      provide: PROVISIONING_STEPS,
      useFactory: (a: CreateVendorStep, b: AssignFreePlanStep, c: CreateFreeSiteDraftStep, d: CreateClaimLinkStep, e: SendInviteStep): ProvisioningStep[] => [a, b, c, d, e],
      inject: [CreateVendorStep, AssignFreePlanStep, CreateFreeSiteDraftStep, CreateClaimLinkStep, SendInviteStep],
    },
    JobRunnerService,
  ],
  exports: [ClaimsService, ProvisioningAdminService],
})
export class ProvisioningModule {}
