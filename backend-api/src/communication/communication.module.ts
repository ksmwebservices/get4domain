import { Module } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { CommunicationController } from './communication.controller';
import { EmailModule } from '../email/email.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { SmsModule } from '../sms/sms.module';
import { WalletModule } from '../wallet/wallet.module';
import { VendorCommsModule } from '../vendor-comms/vendor-comms.module';

@Module({
  imports: [EmailModule, WhatsappModule, SmsModule, WalletModule, VendorCommsModule],
  providers: [CommunicationService],
  controllers: [CommunicationController],
  exports: [CommunicationService],
})
export class CommunicationModule {}
