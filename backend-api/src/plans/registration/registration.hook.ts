import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService, TRACKS } from '../subscriptions/subscriptions.service';
import { TrialSitePort } from './trial-site.port';

/** What the signup form knew about the business, for the trial site (Wave 3 Part G). */
export interface RegistrationInfo { industry: string; businessName: string; phone?: string | null }

/**
 * Called from the existing registration path (AuthService.register) after the vendor exists. It does something only when the plan setting
 * `registrationProvisioning` is true (default false) and the signup named one of the three tracks; then the vendor gets the track's FREE plan.
 * It can never block or fail a registration: every error is swallowed here and logged WITHOUT the error text (which can carry connection details).
 */
@Injectable()
export class RegistrationHook {
  private readonly logger = new Logger(RegistrationHook.name);

  constructor(private readonly prisma: PrismaService, private readonly subscriptions: SubscriptionsService, @Optional() private readonly trialSite?: TrialSitePort) {}

  async afterRegister(vendorId: string, track?: string, info?: RegistrationInfo): Promise<void> {
    try {
      if (!track || !(TRACKS as readonly string[]).includes(track)) return;
      const setting = await this.prisma.v3PlanSetting.findUnique({ where: { key: 'registrationProvisioning' } });
      if (setting?.valueJson !== true) return;
      await this.subscriptions.provisionFreeSubscription(vendorId, track, 'REGISTRATION');
      // Wave 3 Part G: the Free trial site, live on the chosen subdomain, in the same switch. Its own failure leaves the plan and the signup untouched.
      if (info && this.trialSite) {
        try { await this.trialSite.createLiveTrialSite({ vendorId, track, category: info.industry, businessName: info.businessName, phone: info.phone ?? null }); }
        catch (e) { this.logger.warn(`Trial site for new vendor ${vendorId} failed (${e instanceof Error ? e.name : 'error'}); registration continues.`); }
      }
    } catch (e) {
      this.logger.warn(`Free-plan provisioning failed for new vendor ${vendorId} (${e instanceof Error ? e.name : 'error'}); registration continues.`);
    }
  }
}
