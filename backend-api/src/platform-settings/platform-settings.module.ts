import { Module } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsController } from './platform-settings.controller';
import { PublicPricingController } from './public-pricing.controller';

@Module({
  providers: [PlatformSettingsService],
  controllers: [PlatformSettingsController, PublicPricingController],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
