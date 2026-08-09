import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [PlatformSettingsModule],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
