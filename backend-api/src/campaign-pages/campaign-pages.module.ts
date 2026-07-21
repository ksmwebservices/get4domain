import { Module } from '@nestjs/common';
import { CampaignPagesService } from './campaign-pages.service';
import { CampaignPagesController } from './campaign-pages.controller';
import { GoController } from './go.controller';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [WalletModule, NotificationsModule, AiModule],
  providers: [CampaignPagesService],
  controllers: [CampaignPagesController, GoController],
  exports: [CampaignPagesService],
})
export class CampaignPagesModule {}
