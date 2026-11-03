import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EntitlementsService } from './entitlements/entitlements.service';
import { FeatureGuard } from './entitlements/feature.guard';
import { PlansRepository, PrismaPlansRepository } from './entitlements/plans.repository';

/** Plans, tracks and entitlements (slice 5.1). Import this module to use EntitlementsService or @RequiresFeature. */
@Module({
  imports: [PrismaModule],
  providers: [PrismaPlansRepository, { provide: PlansRepository, useExisting: PrismaPlansRepository }, EntitlementsService, FeatureGuard],
  exports: [EntitlementsService, FeatureGuard, PlansRepository],
})
export class PlansModule {}
