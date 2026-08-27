import { Module } from '@nestjs/common';
import { WhatsappBotController } from './whatsapp-bot.controller';
import { WhatsappBotService } from './whatsapp-bot.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AiModule } from '../ai/ai.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VendorCommsModule } from '../vendor-comms/vendor-comms.module';

@Module({
  imports: [WhatsappModule, AiModule, WalletModule, NotificationsModule, VendorCommsModule],
  controllers: [WhatsappBotController],
  providers: [WhatsappBotService, KnowledgeBaseService],
  exports: [KnowledgeBaseService],
})
export class WhatsappBotModule {}
