import { PayRequestsModule } from './v3-payments/payments.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AccountSecurityModule } from './account-security/account-security.module';
import { VendorsModule } from './vendors/vendors.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { CmsModule } from './cms/cms.module';
import { SiteDocModule } from './site-doc/site-doc.module';
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
import { ManagedServicesModule } from './managed-services/managed-services.module';
import { DomainCampaignModule } from './domain-campaign/domain-campaign.module';
import { CommercialModule } from './commercial/commercial.module';
import { throttlerGuardProvider, throttlerImport } from './common/throttling';
import { IndustriesModule } from './industries/industries.module';
import { AiTemplatesModule } from './ai-templates/ai-templates.module';
import { WebsiteThemesModule } from './website-themes/website-themes.module';
import { VendorPaymentsModule } from './vendor-payments/vendor-payments.module';
import { BusinessDocumentsModule } from './business-documents/business-documents.module';
import { DesignModule } from './design/design.module';
import { ReelsModule } from './reels/reels.module';
import { AccountingModule } from './accounting/accounting.module';
import { StationeryModule } from './stationery/stationery.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WidgetModule } from './widget/widget.module';
import { DomainAppModule } from './domainapp/domainapp.module';
import { AddonsModule } from './addons/addons.module';
import { RegistryModule } from './registry/registry.module';
import { BosModule } from './bos/bos.module';
import { MessagingModule } from './messaging/messaging.module';
import { LeadspaceModule } from './leadspace/leadspace.module';
import { SocialModule } from './social/social.module';
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
import { HealthModule } from './health/health.module';
import { PlansModule } from './plans/plans.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { SitePublishModule } from './site-publish/site-publish.module';
import { WebsiteModule } from './v3-website/website.module';
import { SiteDomainsModule } from './site-domains/site-domains.module';
import { V3DomainAutomationModule } from './v3-domain-automation/domain-automation.module';
import { V3RegistrarModule } from './v3-registrar/registrar.module';
import { V3CustomersModule } from './v3-customers/customers.module';
import { DirectoryModule } from './directory/directory.module';
import { B3SettingsModule } from './b3-settings/b3-settings.module';
import { VendorLifecycleModule } from './vendor-lifecycle/vendor-lifecycle.module';
import { SeededSitesModule } from './seeded-sites/seeded-sites.module';
import { RequestsOrdersModule } from './requests-orders/requests-orders.module';
import { TermsModule } from './terms/terms.module';
import { SiteLifecycleModule } from './seeded-sites/prisma-site-lifecycle';
import { PlanBillingModule } from './plan-billing/plan-billing.module';
import { ActivityBusModule } from './common/activity-bus';
import { V3WalletModule } from './v3-wallet/wallet.module';
import { V3ServicesModule } from './v3-services/services.module';
import { V3ServiceRequestsModule } from './v3-service-requests/service-requests.module';
import { V3ThemeSwitchModule } from './v3-theme-switch/theme-switch.module';
import { V3ActivityModule } from './v3-activity/activity.module';
import { V3TrustModule } from './v3-trust/trust.module';
import { AiStudioModule } from './ai-studio/ai-studio.module';
import { VideoModule } from './video/video.module';
import { DemoModule } from './demo/demo.module';
import { UploadsModule } from './uploads/uploads.module';
import { DomainsModule } from './domains/domains.module';
import { VendorCommsModule } from './vendor-comms/vendor-comms.module';
import { TravelModule } from './travel/travel.module';
import { SalonModule } from './salon/salon.module';
import { GymModule } from './gym/gym.module';
import { HotelModule } from './hotel/hotel.module';
import { RealEstateModule } from './realestate/realestate.module';
import { EducationModule } from './education/education.module';
import { ProfessionalModule } from './professional/professional.module';
import { ConstructionModule } from './construction/construction.module';
import { EventsModule } from './events/events.module';
import { FinanceModule } from './finance/finance.module';
import { AutomobileModule } from './automobile/automobile.module';
import { LogisticsModule } from './logistics/logistics.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { PhotographyModule } from './photography/photography.module';
import { AgricultureModule } from './agriculture/agriculture.module';
import { CoachingModule } from './coaching/coaching.module';
import { TechnologyModule } from './technology/technology.module';
import { ClinicModule } from './clinic/clinic.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { RetailModule } from './retail/retail.module';
import { EngineModule } from './engine/engine.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ModuleGuard } from './common/guards/module.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    AccountSecurityModule,
    PlansModule,
    ProvisioningModule,
    SitePublishModule,
    WebsiteModule,
    SiteDomainsModule,
    V3DomainAutomationModule,
    V3RegistrarModule,
    V3CustomersModule,
    DirectoryModule,
    B3SettingsModule,
    VendorLifecycleModule,
    SiteLifecycleModule,
    SeededSitesModule,
    RequestsOrdersModule,
    PayRequestsModule,
    TermsModule,
    PlanBillingModule,
    ActivityBusModule,   // Batch 4: the typed in-process event bus (global)
    V3WalletModule,   // Batch 4 slices 5.16a and 5.16a-2: the V3 wallet (global; never the legacy src/wallet)
    V3ServicesModule,   // Batch 4 slice 5.16b: the service catalogue, the price book and add-on packs
    V3ServiceRequestsModule,   // Batch 4 slice 5.16c: requests to our team paid by allowance, pack or wallet
    V3ThemeSwitchModule,   // Batch 4 slice 5.16d: the Theme Switch Service
    V3ActivityModule,   // Batch 4B slice 5.20: the activity log and alerts (global: every V3 module calls ActivityService.record())
    V3TrustModule,   // Batch 4B slice 5.21: trust and safety (global: the scan, takedown and payee-check ports)
    AiStudioModule,
    VendorsModule,
    SubscriptionsModule,
    InvoicesModule,
    PaymentsModule,
    CmsModule,
    SiteDocModule,
    EmailModule,
    SupportModule,
    AiModule,
    LeadsModule,
    WalletModule,
    DomainsModule,
    VendorCommsModule,
    TravelModule,
    SalonModule,
    GymModule,
    HotelModule,
    RealEstateModule,
    EducationModule,
    ProfessionalModule,
    ConstructionModule,
    EventsModule,
    FinanceModule,
    AutomobileModule,
    LogisticsModule,
    DiagnosticsModule,
    PhotographyModule,
    AgricultureModule,
    CoachingModule,
    TechnologyModule,
    ClinicModule,
    RestaurantModule,
    RetailModule,
    EngineModule,
    VendorPaymentsModule,
    NotificationsModule,
    CampaignPagesModule,
    CampaignsModule,
    CrmModule,
    TeamModule,
    AdminTeamModule,
    AdminCrmModule,
    QuotesModule,
    ManagedServicesModule,
    DomainCampaignModule,
    CommercialModule,
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
    RegistryModule,
    BosModule,
    MessagingModule,
    SocialModule,
    LeadspaceModule,
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
    throttlerImport,
  ],
  providers: [
    // Rate limiting FIRST so unauthenticated floods are rejected (429) before any other work.
    throttlerGuardProvider,
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
