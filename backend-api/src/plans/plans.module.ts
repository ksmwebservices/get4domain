import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditService } from './admin/audit.service';
import { FeaturesAdminService } from './admin/features-admin.service';
import { PlansAdminController } from './admin/plans-admin.controller';
import { PlansAdminService } from './admin/plans-admin.service';
import { RulesAdminController } from './admin/rules-admin.controller';
import { RulesAdminService } from './admin/rules-admin.service';
import { VendorPlansAdminController } from './admin/vendor-plans-admin.controller';
import { VendorPlansAdminService } from './admin/vendor-plans-admin.service';
import { EntitlementsService } from './entitlements/entitlements.service';
import { FeatureGuard } from './entitlements/feature.guard';
import { PlansRepository, PrismaPlansRepository } from './entitlements/plans.repository';
import { MePlansController } from './me/me-plans.controller';
import { MePlansService } from './me/me-plans.service';
import { PublicPlansController } from './public/public-plans.controller';
import { PublicPlansService } from './public/public-plans.service';
import { RegistrationHook } from './registration/registration.hook';
import { SubscriptionsService } from './subscriptions/subscriptions.service';

/**
 * Plans, tracks and entitlements (slice 5.1). Global, so EntitlementsService, SubscriptionsService, @RequiresFeature and the RegistrationHook can be injected anywhere
 * without editing the importing module (the auth module is not touched).
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PlansAdminController, RulesAdminController, VendorPlansAdminController, PublicPlansController, MePlansController],
  providers: [
    PrismaPlansRepository, { provide: PlansRepository, useExisting: PrismaPlansRepository },
    EntitlementsService, FeatureGuard, AuditService, SubscriptionsService,
    PlansAdminService, FeaturesAdminService, RulesAdminService, VendorPlansAdminService, PublicPlansService, MePlansService, RegistrationHook,
  ],
  exports: [EntitlementsService, FeatureGuard, PlansRepository, SubscriptionsService, AuditService, RegistrationHook, VendorPlansAdminService],
})
export class PlansModule {}
