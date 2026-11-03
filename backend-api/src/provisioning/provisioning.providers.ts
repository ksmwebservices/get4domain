import { Provider, Type } from '@nestjs/common';
import { ProvisioningAdminController } from './admin/provisioning-admin.controller';
import { ProvisioningAdminService } from './admin/provisioning-admin.service';
import { ClaimPublicController } from './claims/claims-public.controller';
import { ClaimStore, PrismaClaimStore } from './claims/claim-store';
import { ClaimsService } from './claims/claims.service';
import { InviteStore, PrismaInviteStore } from './invites/invite-store';
import { PrismaProvisioningAudit } from './provisioning-audit';
import { PrismaProvisioningRepository, ProvisioningRepository } from './provisioning.repository';
import { JobRunnerService, PROVISIONING_STEPS, ProvisioningAudit, ProvisioningStep } from './runner/job-runner.service';
import { ProvisioningSettingsService } from './settings/provisioning-settings.service';
import { CmsDraftSiteProvisioner } from './site/cms-draft-site-provisioner';
import { DraftSiteBuilder } from './site/draft-site-builder';
import { ModeSiteProvisioner } from './site/mode-site-provisioner';
import { RendererDraftBuilder } from './site/renderer-draft-builder';
import { SiteProvisioner } from './site/site-provisioner';
import { AssignFreePlanStep } from './steps/assign-free-plan.step';
import { CreateClaimLinkStep } from './steps/create-claim-link.step';
import { CreateFreeSiteDraftStep } from './steps/create-free-site-draft.step';
import { CreateVendorStep } from './steps/create-vendor.step';
import { SendInviteStep } from './steps/send-invite.step';
import { BusinessVendors, PrismaBusinessVendors } from './vendors/business-vendors';

/**
 * Every provider of the provisioning engine except the cron tick, in one list. ProvisioningModule uses it; the staging integration tests assemble the same
 * list into a slim app (they cannot import the module file, whose site-doc and schedule imports need the whole application).
 */
export const PROVISIONING_PROVIDERS: Provider[] = [
  { provide: ProvisioningRepository, useClass: PrismaProvisioningRepository },
  { provide: BusinessVendors, useClass: PrismaBusinessVendors },
  CmsDraftSiteProvisioner,   // the slice 5.3 adapter, kept as the "legacy" mode and as the first half of "renderer" mode
  { provide: DraftSiteBuilder, useClass: RendererDraftBuilder },
  { provide: SiteProvisioner, useClass: ModeSiteProvisioner },
  { provide: ClaimStore, useClass: PrismaClaimStore },
  { provide: InviteStore, useClass: PrismaInviteStore },
  { provide: ProvisioningAudit, useClass: PrismaProvisioningAudit },
  ProvisioningSettingsService, ClaimsService, ProvisioningAdminService,
  CreateVendorStep, AssignFreePlanStep, CreateFreeSiteDraftStep, CreateClaimLinkStep, SendInviteStep,
  {
    provide: PROVISIONING_STEPS,
    useFactory: (a: CreateVendorStep, b: AssignFreePlanStep, c: CreateFreeSiteDraftStep, d: CreateClaimLinkStep, e: SendInviteStep): ProvisioningStep[] => [a, b, c, d, e],
    inject: [CreateVendorStep, AssignFreePlanStep, CreateFreeSiteDraftStep, CreateClaimLinkStep, SendInviteStep],
  },
  JobRunnerService,
];

export const PROVISIONING_CONTROLLERS: Type<unknown>[] = [ProvisioningAdminController, ClaimPublicController];
