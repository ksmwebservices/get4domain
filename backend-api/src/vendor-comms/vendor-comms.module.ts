import { Module } from '@nestjs/common';
import { VendorCommsService } from './vendor-comms.service';
import { VendorCommsController } from './vendor-comms.controller';
import { AdminVendorCommsController } from './admin-vendor-comms.controller';

/**
 * Per-vendor communication identity. Exported so the Communication Hub and the
 * WhatsApp bot can resolve branding at send time without duplicating the
 * platform-default fallback logic.
 */
@Module({
  providers: [VendorCommsService],
  controllers: [VendorCommsController, AdminVendorCommsController],
  exports: [VendorCommsService],
})
export class VendorCommsModule {}
