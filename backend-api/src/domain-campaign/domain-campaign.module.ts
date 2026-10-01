import { Module } from '@nestjs/common';
import { DomainCampaignController, AdminDomainCampaignController } from './domain-campaign.controller';
import { DomainCampaignService } from './domain-campaign.service';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [EmailModule, NotificationsModule, InvoicesModule],
  controllers: [DomainCampaignController, AdminDomainCampaignController],
  providers: [DomainCampaignService],
})
export class DomainCampaignModule {}
