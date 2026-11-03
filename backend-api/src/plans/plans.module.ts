import { Module } from '@nestjs/common';
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
import { SubscriptionsService } from './subscriptions/subscriptions.service';

/** Plans, tracks and entitlements (slice 5.1). Import this module to use EntitlementsService, SubscriptionsService or @RequiresFeature. */
@Module({
  imports: [PrismaModule],
  controllers: [PlansAdminController, RulesAdminController, VendorPlansAdminController],
  providers: [
    PrismaPlansRepository, { provide: PlansRepository, useExisting: PrismaPlansRepository },
    EntitlementsService, FeatureGuard, AuditService, SubscriptionsService,
    PlansAdminService, FeaturesAdminService, RulesAdminService, VendorPlansAdminService,
  ],
  exports: [EntitlementsService, FeatureGuard, PlansRepository, SubscriptionsService, AuditService],
})
export class PlansModule {}
