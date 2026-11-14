import { V3PacksModule } from '../v3-packs/packs.module';
import { Module } from '@nestjs/common';
import { DomainsService } from './domains.service';
import { DomainsController } from './domains.controller';
import { AdminDomainsController } from './admin-domains.controller';
import { ResellerClubService } from './resellerclub.service';
import { WalletModule } from '../wallet/wallet.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [WalletModule, PlatformSettingsModule, V3PacksModule],
  providers: [DomainsService, ResellerClubService],
  controllers: [DomainsController, AdminDomainsController],
  exports: [DomainsService],
})
export class DomainsModule {}
