import { Module } from '@nestjs/common';
import { MetaService } from './meta.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [PlatformSettingsModule],
  providers: [MetaService],
  exports: [MetaService],
})
export class MetaModule {}
