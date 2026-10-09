import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CommercialModule } from '../commercial/commercial.module';
import { EmailModule } from '../email/email.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { SocialModule } from '../social/social.module';
import { LeadAlertsService } from './alerts.service';
import { LeadCaptureService } from './capture.service';
import { LeadCreditsService } from './credits.service';
import { LeadspaceAdminController, LeadspacePublicController, LeadspaceVendorController } from './leadspace.controllers';
import { LeadsService } from './leads.service';
import { LegacyImportService } from './legacy-import.service';
import { LeadOtpService } from './otp.service';
import { LeadspacePagesAdminController, LeadspacePagesPublicController, LeadspacePageVendorController } from './pages.controllers';
import { LeadPricingService } from './pricing.service';
import { LeadspaceProfileService } from './profile.service';
import { LeadspacePromoteVendorController, LeadspacePromotionAdminController, LeadspaceReportsAdminController } from './promotion.controllers';
import { PromotionService } from './promotion.service';
import { LeadPurseService } from './purse.service';
import { LeadRefillService } from './refill.service';
import { LeadspaceReportsService } from './reports.service';
import { LeadspaceSettingsModule } from './settings.module';
import { LeadspaceRefillAdminController, LeadspaceRefillController, LeadspaceRefillWebhookController } from './wallet.controllers';

/** LeadSpace: a free landing page per vendor, verified leads, the prepaid LEADS purse, wallet refills, and Get4Domain-run promotion. */
@Module({
  imports: [AiModule, SocialModule, LeadspaceSettingsModule, NotificationsModule, EmailModule, CommercialModule, InvoicesModule, PaymentsModule],
  controllers: [
    LeadspacePublicController, LeadspaceVendorController, LeadspaceAdminController,
    LeadspacePagesPublicController, LeadspacePageVendorController, LeadspacePagesAdminController,
    LeadspaceRefillController, LeadspaceRefillWebhookController, LeadspaceRefillAdminController,
    LeadspacePromoteVendorController, LeadspacePromotionAdminController, LeadspaceReportsAdminController,
  ],
  providers: [
    LeadPricingService, LeadPurseService, LeadOtpService, LeadAlertsService, LeadCaptureService, LeadsService, LeadCreditsService,
    LeadspaceProfileService, LeadRefillService, PromotionService, LeadspaceReportsService, LegacyImportService,
  ],
  exports: [
    LeadspaceSettingsModule, LeadPricingService, LeadPurseService, LeadOtpService, LeadCaptureService, LeadsService, LeadCreditsService,
    LeadspaceProfileService, LeadRefillService, PromotionService, LeadspaceReportsService, LegacyImportService,
  ],
})
export class LeadspaceModule {}
