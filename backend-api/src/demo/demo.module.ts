import { Module } from '@nestjs/common';
import { DemoService } from './demo.service';
import { DemoController } from './demo.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WhatsappModule, WalletModule],
  providers: [DemoService],
  controllers: [DemoController],
  exports: [DemoService],
})
export class DemoModule {}
