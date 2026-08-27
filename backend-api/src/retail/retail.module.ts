import { Module } from '@nestjs/common';
import { RetailService } from './retail.service';
import { RetailController } from './retail.controller';

@Module({
  providers: [RetailService],
  controllers: [RetailController],
  exports: [RetailService],
})
export class RetailModule {}
