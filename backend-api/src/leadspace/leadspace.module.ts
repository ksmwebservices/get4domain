import { Module } from '@nestjs/common';
import { CommercialModule } from '../commercial/commercial.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LeadAlertsService } from './alerts.service';
import { LeadCaptureService } from './capture.service';
import { LeadCreditsService } from './credits.service';
import { LeadspaceAdminController, LeadspacePublicController, LeadspaceVendorController } from './leadspace.controllers';
import { LeadsService } from './leads.service';
import { LeadOtpService } from './otp.service';
import { LeadPricingService } from './pricing.service';
import { LeadPurseService } from './purse.service';
import { LeadspaceSettingsService } from './settings.service';

/** LeadSpace: free landing page, verified leads, the LEADS purse. Phase 3 core; pages, wallet refill, admin tools and promotion are added in later phases. */
@Module({
  imports: [NotificationsModule, EmailModule, CommercialModule],
  controllers: [LeadspacePublicController, LeadspaceVendorController, LeadspaceAdminController],
  providers: [LeadspaceSettingsService, LeadPricingService, LeadPurseService, LeadOtpService, LeadAlertsService, LeadCaptureService, LeadsService, LeadCreditsService],
  exports: [LeadspaceSettingsService, LeadPricingService, LeadPurseService, LeadOtpService, LeadCaptureService, LeadsService, LeadCreditsService],
})
export class LeadspaceModule {}
