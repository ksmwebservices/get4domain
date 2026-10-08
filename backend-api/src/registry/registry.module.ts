import { Module } from '@nestjs/common';
import { AddonsModule } from '../addons/addons.module';
import { CommercialModule } from '../commercial/commercial.module';
import { DashboardContextController } from './dashboard-context.controller';
import { DashboardContextService } from './dashboard-context.service';
import { PlanAccessController } from './plan-access.controller';
import { PlanAccessService } from './plan-access.service';

@Module({
  imports: [AddonsModule, CommercialModule],
  controllers: [DashboardContextController, PlanAccessController],
  providers: [DashboardContextService, PlanAccessService],
  exports: [DashboardContextService, PlanAccessService],
})
export class RegistryModule {}
