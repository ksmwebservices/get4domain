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
import { BusinessDocumentsModule } from './business-documents/business-documents.module';
import { DesignModule } from './design/design.module';
import { ReelsModule } from './reels/reels.module';
import { AccountingModule } from './accounting/accounting.module';
import { StationeryModule } from './stationery/stationery.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WidgetModule } from './widget/widget.module';
import { DomainAppModule } from './domainapp/domainapp.module';
import { AddonsModule } from './addons/addons.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { WhatsappBotModule } from './whatsapp-bot/whatsapp-bot.module';
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
import { DomainsModule } from './domains/domains.module';
import { TravelModule } from './travel/travel.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ModuleGuard } from './common/guards/module.guard';

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
    DomainsModule,
    TravelModule,
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
    BusinessDocumentsModule,
    DesignModule,
    ReelsModule,
    AccountingModule,
    StationeryModule,
    AnalyticsModule,
    WidgetModule,
    DomainAppModule,
    AddonsModule,
    PlatformSettingsModule,
    WhatsappModule,
    WhatsappBotModule,
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
    {
      // Runs AFTER JwtAuthGuard (request.user is populated). No-op unless a route is
      // @RequireModule()-marked AND the caller is a restricted team member.
      provide: APP_GUARD,
      useClass: ModuleGuard,
    },
  ],
})
export class AppModule {}
