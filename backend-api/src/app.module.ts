import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { VendorsModule } from './vendors/vendors.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { CmsModule } from './cms/cms.module';
import { EmailModule } from './email/email.module';
import { SupportModule } from './support/support.module';
import { AiModule } from './ai/ai.module';
import { LeadsModule } from './leads/leads.module';
import { WalletModule } from './wallet/wallet.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CampaignPagesModule } from './campaign-pages/campaign-pages.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { CrmModule } from './crm/crm.module';
import { TeamModule } from './team/team.module';
import { AdminTeamModule } from './admin-team/admin-team.module';
import { AdminCrmModule } from './admin-crm/admin-crm.module';
import { QuotesModule } from './quotes/quotes.module';
import { IndustriesModule } from './industries/industries.module';
import { AiTemplatesModule } from './ai-templates/ai-templates.module';
import { WebsiteThemesModule } from './website-themes/website-themes.module';
import { DomainAppModule } from './domainapp/domainapp.module';
import { AddonsModule } from './addons/addons.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { SmsModule } from './sms/sms.module';
import { MetaModule } from './meta/meta.module';
import { GoogleAdsModule } from './google-ads/google-ads.module';
import { GrowthHubModule } from './growth-hub/growth-hub.module';
import { CommunicationModule } from './communication/communication.module';
import { CustomerModule } from './customer/customer.module';
import { OtpModule } from './otp/otp.module';
import { VideoModule } from './video/video.module';
import { DemoModule } from './demo/demo.module';
import { UploadsModule } from './uploads/uploads.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AuthModule,
    VendorsModule,
    SubscriptionsModule,
    InvoicesModule,
    PaymentsModule,
    CmsModule,
    EmailModule,
    SupportModule,
    AiModule,
    LeadsModule,
    WalletModule,
    NotificationsModule,
    CampaignPagesModule,
    CampaignsModule,
    CrmModule,
    TeamModule,
    AdminTeamModule,
    AdminCrmModule,
    QuotesModule,
    IndustriesModule,
    AiTemplatesModule,
    WebsiteThemesModule,
    DomainAppModule,
    AddonsModule,
    PlatformSettingsModule,
    WhatsappModule,
    SmsModule,
    MetaModule,
    GoogleAdsModule,
    GrowthHubModule,
    CommunicationModule,
    CustomerModule,
    OtpModule,
    VideoModule,
    DemoModule,
    UploadsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
