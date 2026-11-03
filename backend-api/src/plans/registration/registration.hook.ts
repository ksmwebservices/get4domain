import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService, TRACKS } from '../subscriptions/subscriptions.service';

/**
 * Called from the existing registration path (AuthService.register) after the vendor exists. It does something only when the plan setting
 * `registrationProvisioning` is true (default false) and the signup named one of the three tracks; then the vendor gets the track's FREE plan.
 * It can never block or fail a registration: every error is swallowed here and logged WITHOUT the error text (which can carry connection details).
 */
@Injectable()
export class RegistrationHook {
  private readonly logger = new Logger(RegistrationHook.name);

  constructor(private readonly prisma: PrismaService, private readonly subscriptions: SubscriptionsService) {}

  async afterRegister(vendorId: string, track?: string): Promise<void> {
    try {
      if (!track || !(TRACKS as readonly string[]).includes(track)) return;
      const setting = await this.prisma.v3PlanSetting.findUnique({ where: { key: 'registrationProvisioning' } });
      if (setting?.valueJson !== true) return;
      await this.subscriptions.provisionFreeSubscription(vendorId, track, 'REGISTRATION');
    } catch (e) {
      this.logger.warn(`Free-plan provisioning failed for new vendor ${vendorId} (${e instanceof Error ? e.name : 'error'}); registration continues.`);
    }
  }
}
