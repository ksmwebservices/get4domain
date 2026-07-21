import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushService } from './push.service';
import { SmsService } from './sms.service';
import { WhatsAppService } from './whatsapp.service';

@Module({
  providers: [NotificationsService, PushService, SmsService, WhatsAppService],
  controllers: [NotificationsController],
  exports: [NotificationsService, PushService, SmsService, WhatsAppService],
})
export class NotificationsModule {}
