import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController, SupportCallbackController } from './support.controller';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EmailModule, NotificationsModule],
  providers: [SupportService],
  controllers: [SupportController, SupportCallbackController],
  exports: [SupportService],
})
export class SupportModule {}
