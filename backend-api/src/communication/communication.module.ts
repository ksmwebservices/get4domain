import { Module } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { CommunicationController } from './communication.controller';
import { EmailModule } from '../email/email.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [EmailModule, WhatsappModule, SmsModule],
  providers: [CommunicationService],
  controllers: [CommunicationController],
  exports: [CommunicationService],
})
export class CommunicationModule {}
