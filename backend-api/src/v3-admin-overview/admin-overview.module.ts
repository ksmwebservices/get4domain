import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanBillingModule } from '../plan-billing/plan-billing.module';
import { AdminOverviewController } from './admin-overview.controller';
import { AdminOverviewService } from './admin-overview.service';

/** K1: the admin overview (read only; it writes nothing). */
@Module({ imports: [PrismaModule, PlanBillingModule], controllers: [AdminOverviewController], providers: [AdminOverviewService] })
export class AdminOverviewModule {}
