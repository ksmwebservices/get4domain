import { Module } from '@nestjs/common';
import { ManagedServicesService } from './managed-services.service';
import { ManagedServicesController, AdminManagedServicesController } from './managed-services.controller';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EmailModule, NotificationsModule],
  providers: [ManagedServicesService],
  controllers: [ManagedServicesController, AdminManagedServicesController],
  exports: [ManagedServicesService],
})
export class ManagedServicesModule {}
