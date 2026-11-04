import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RenewalReminderService } from './renewal-reminder.service';
import { PaymentSettlementService } from './settlement.service';

/** The hourly tick: housekeeping (stale orders stop being payable) and the reminders. One tick at a time per process. */
@Injectable()
export class PlanBillingCron {
  private readonly logger = new Logger(PlanBillingCron.name);
  private busy = false;
  constructor(private readonly reminders: RenewalReminderService, private readonly settlement: PaymentSettlementService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.settlement.expireStale();
      const r = await this.reminders.tick();
      if (r.sent || r.skipped) this.logger.log(`renewal reminders: ${r.sent} sent, ${r.skipped} skipped`);
    } catch (e) {
      this.logger.error(`plan billing tick failed: ${e instanceof Error ? e.name : 'error'}`);   // the message can echo a connection string; the name cannot
    } finally { this.busy = false; }
  }
}
