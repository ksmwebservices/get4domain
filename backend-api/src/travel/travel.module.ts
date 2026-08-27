import { Module } from '@nestjs/common';
import { TravelService } from './travel.service';
import { TravelController } from './travel.controller';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { DomainAppModule } from '../domainapp/domainapp.module';

@Module({
  imports: [DomainAppModule], // reuse DomainAppInvoicesService for contract billing
  providers: [TravelService, ContractsService],
  controllers: [TravelController, ContractsController],
  exports: [TravelService, ContractsService],
})
export class TravelModule {}
