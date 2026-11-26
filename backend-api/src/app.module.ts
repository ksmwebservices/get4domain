import { PayRequestsModule } from './v3-payments/payments.module';
import { PayLinkBridgeModule } from './v3-payments/pay-link.module';
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
import { ClaimSetupModule } from './claim-setup/claim-setup.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { SitePublishModule } from './site-publish/site-publish.module';
import { WebsiteModule } from './v3-website/website.module';
import { TelecallerModule } from './v3-telecaller/telecaller.module';
import { ContentPackModule } from './v3-content-pack/content-pack.module';
import { AdminDraftModule } from './v3-admin-draft/admin-draft.module';
import { SiteDomainsModule } from './site-domains/site-domains.module';
import { V3DomainAutomationModule } from './v3-domain-automation/domain-automation.module';
import { V3RegistrarModule } from './v3-registrar/registrar.module';
import { V3CustomersModule } from './v3-customers/customers.module';
import { V3AccountsModule } from './v3-accounts/accounts.module';
import { V3JobsModule } from './v3-jobs/jobs.module';
import { V3StorageModule } from './v3-storage/storage.module';
import { V3MailModule } from './v3-mail/mail.module';
import { V3SupportModule } from './v3-support/support.module';
import { V3AdminActionsModule } from './v3-admin-actions/admin-actions.module';
import { V3IntegrationsModule } from './v3-integrations/integrations.module';
import { V3AppointmentsModule } from './v3-appointments/appointments.module';
import { V3StoreModule } from './v3-store/store.module';
import { V3PacksModule } from './v3-packs/packs.module';
import { V3PackRecordsModule } from './v3-pack-records/pack-records.module';
import { V3VendorGapsModule } from './v3-vendor-gaps/vendor-gaps.module';
import { V3AdminGapsModule } from './v3-admin-gaps/admin-gaps.module';
import { V3ThemeMarketModule } from './v3-theme-market/theme-market.module';
import { V3MediaUploadModule } from './v3-media-upload/media-upload.module';
import { V3ProfileFieldsModule } from './v3-profile-fields/profile.module';
import { V3ListingImportModule } from './v3-listing-import/listing-import.module';
import { DirectoryModule } from './directory/directory.module';
import { SeoDirectoryModule } from './seo-directory/seo-directory.module';
import { SeoVendorFactsModule } from './seo-directory/seo-vendor-facts.module';
import { B3SettingsModule } from './b3-settings/b3-settings.module';
import { VendorLifecycleModule } from './vendor-lifecycle/vendor-lifecycle.module';
import { SeededSitesModule } from './seeded-sites/seeded-sites.module';
import { DuplicateCheckModule } from './v3-duplicates/duplicate-check.module';
import { RequestsOrdersModule } from './requests-orders/requests-orders.module';
import { TermsModule } from './terms/terms.module';
import { SiteLifecycleModule } from './seeded-sites/prisma-site-lifecycle';
import { SiteRebuildSchedulerModule } from './site-domains/site-rebuild-scheduler';
import { PlanBillingModule } from './plan-billing/plan-billing.module';
import { PaymentsOpenModule } from './plan-billing/payments-open.module';
import { ActivityBusModule } from './common/activity-bus';
import { V3WalletModule } from './v3-wallet/wallet.module';
import { V3ServicesModule } from './v3-services/services.module';
import { V3ServiceRequestsModule } from './v3-service-requests/service-requests.module';
import { V3ThemeSwitchModule } from './v3-theme-switch/theme-switch.module';
import { V3ActivityModule } from './v3-activity/activity.module';
import { V3FirmModule } from './v3-firm/firm.module';
import { V3PartnersModule } from './v3-partners/partners.module';
import { V3TrialModule } from './v3-trial/trial.module';
import { AdminVendorSiteModule } from './v3-admin-vendor-site/admin-vendor-site.module';
import { AdminOverviewModule } from './v3-admin-overview/admin-overview.module';
import { V3ThemeCatalogModule } from './v3-theme-catalog/theme-catalog.module';
import { V3ReferralsModule } from './v3-referrals/referrals.module';
import { PartnerScopeGuard } from './v3-partners/partner-scope.guard';
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
import { RetiredModuleGuard } from './v3-retire/retired-module.guard';

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
    TelecallerModule,
    ContentPackModule,
    AdminDraftModule,
    SiteDomainsModule,
    V3DomainAutomationModule,
    V3RegistrarModule,
    V3CustomersModule,
    V3AccountsModule,
    V3JobsModule,
    V3AppointmentsModule,
    V3StorageModule,
    V3MailModule,
    V3SupportModule,
    V3AdminActionsModule,
    V3IntegrationsModule,
    V3StoreModule,
    V3PacksModule,
    V3PackRecordsModule,
    V3VendorGapsModule,
    V3AdminGapsModule,
    V3MediaUploadModule,
    V3ThemeMarketModule,   // TM1: the theme marketplace (upload, validate, publish)
    V3ProfileFieldsModule,
    V3ListingImportModule,
    ClaimSetupModule,   // Part B (B7): account setup after the claim code and the owner's approval that puts the site live
    DirectoryModule,
    SeoDirectoryModule,
    SeoVendorFactsModule,
    B3SettingsModule,
    VendorLifecycleModule,
    SiteLifecycleModule,
    SiteRebuildSchedulerModule,
    SeededSitesModule,
    DuplicateCheckModule,   // D1: the one duplicate check every creation path calls (global)
    RequestsOrdersModule,
    PayRequestsModule,
    PayLinkBridgeModule,
    TermsModule,
    PlanBillingModule,
    PaymentsOpenModule,
    ActivityBusModule,   // Batch 4: the typed in-process event bus (global)
    V3WalletModule,   // Batch 4 slices 5.16a and 5.16a-2: the V3 wallet (global; never the legacy src/wallet)
    V3ServicesModule,   // Batch 4 slice 5.16b: the service catalogue, the price book and add-on packs
    V3ServiceRequestsModule,   // Batch 4 slice 5.16c: requests to our team paid by allowance, pack or wallet
    V3ThemeSwitchModule,   // Batch 4 slice 5.16d: the Theme Switch Service
    V3PartnersModule,   // Wave 3 Parts A and I: referral partners and their portal
    V3ReferralsModule,   // Wave 3 Part I: referral links, attribution, commission slabs, ledger and payouts (global: billing and registration take its hook and port as optional)
    V3ThemeCatalogModule,   // Wave 3 Part H: the theme catalogue per pack and the owner's theme choice view (read only)
    AdminOverviewModule,   // K1: GET /v3/admin/overview
    AdminVendorSiteModule,   // B2.2: staff create a business with its site; category picker tree
    V3TrialModule,   // Wave 3 Part G: self-service trial signup (global: the registration path and the plans module take its policy and port as optional)
    V3FirmModule,   // Wave 2 Part H3: the firm profile (global: invoices, quotes, billing settings and the legal text read it)
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
    {
      // Slice 5.25. Runs after the JWT and module guards. A V3 vendor gets a plain 404 on the routes of the retired
      // Version 2 industry modules; a legacy vendor, staff and public callers are untouched. Reads and writes no table.
      provide: APP_GUARD,
      useClass: RetiredModuleGuard,
    },
    {
      // Wave 3 Part A. Runs after the JWT guard: a referral-partner login may reach /v3/partner/* and the two token routes only, whatever a route's own guards say.
      provide: APP_GUARD,
      useClass: PartnerScopeGuard,
    },
  ],
})
export class AppModule {}
