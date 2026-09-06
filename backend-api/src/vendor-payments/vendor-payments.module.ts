import { Module } from '@nestjs/common';
import { VendorPaymentsService } from './vendor-payments.service';
import { VendorPaymentsController } from './vendor-payments.controller';

@Module({
  providers: [VendorPaymentsService],
  controllers: [VendorPaymentsController],
  exports: [VendorPaymentsService],
})
export class VendorPaymentsModule {}
