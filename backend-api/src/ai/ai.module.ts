import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { WalletModule } from '../wallet/wallet.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [WalletModule, PlatformSettingsModule, StorageModule],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
