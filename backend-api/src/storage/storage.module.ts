import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [PlatformSettingsModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
