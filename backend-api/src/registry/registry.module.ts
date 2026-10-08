import { Module } from '@nestjs/common';
import { AddonsModule } from '../addons/addons.module';
import { DashboardContextController } from './dashboard-context.controller';
import { DashboardContextService } from './dashboard-context.service';

@Module({
  imports: [AddonsModule],
  controllers: [DashboardContextController],
  providers: [DashboardContextService],
  exports: [DashboardContextService],
})
export class RegistryModule {}
