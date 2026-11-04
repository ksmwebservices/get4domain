import { Inject, Injectable } from '@nestjs/common';
import { dueReminders } from './core/amounts';
import { PlanBillingRepository } from './plan-billing.repository';
import { BillingSettingsService } from './settings/billing-settings.service';
import { EmailAdapter, OutboundEmail, SandboxEmailAdapter } from '../provisioning/invites/email-adapter';

/** Where renewal reminders go. SANDBOX in this slice: nothing is sent (the slice 5.3 sandbox email adapter); a live mailer needs the owner's flag and is a later step. */
export abstract class ReminderMailer { abstract send(m: OutboundEmail): Promise<void>; }

@Injectable()
export class SandboxReminderMailer extends ReminderMailer {
  readonly adapter: EmailAdapter = new SandboxEmailAdapter();
  sent = 0;
  async send(m: OutboundEmail): Promise<void> { await this.adapter.send(m); this.sent++; }
}

/**
 * Renewal reminders (slice 5.1b). Off by default (renewalRemindersEnabled). The log row is written FIRST and is unique per subscription, offset and end date, so a reminder is sent at most
 * once per day-offset even if two ticks overlap; a renewal changes the end date, so the next term gets fresh reminders. The text has no price. Grace and expiry follow the slice 5.1 engine
 * and are not repeated here.
 */
@Injectable()
export class RenewalReminderService {
  clock: () => Date = () => new Date();
  constructor(private readonly repo: PlanBillingRepository, @Inject(BillingSettingsService) private readonly settings: Pick<BillingSettingsService, 'get'>, private readonly mailer: ReminderMailer) {}

  async tick(): Promise<{ sent: number; skipped: number }> {
    const s = await this.settings.get();
    if (!s.renewalRemindersEnabled || !s.renewalReminderDays.length) return { sent: 0, skipped: 0 };
    const now = this.clock();
    const subs = await this.repo.dueSubscriptions(now, Math.max(...s.renewalReminderDays));
    if (!subs.length) return { sent: 0, skipped: 0 };
    const logged = await this.repo.loggedReminders(subs.map((x) => x.id));
    const actions = dueReminders(subs.map((x) => ({ id: x.id, endsAt: x.endsAt, status: x.status })), now, s.renewalReminderDays, logged);
    const by = new Map(subs.map((x) => [x.id, x]));
    let sent = 0; let skipped = 0;
    for (const a of actions) {
      if (!(await this.repo.insertReminder({ subscriptionId: a.subscriptionId, daysBefore: a.daysBefore, endsAt: a.endsAt, kind: a.action === 'SEND' ? 'SENT' : 'SKIPPED' }))) continue;   // someone else logged it first
      if (a.action === 'SKIP') { skipped++; continue; }
      const v = by.get(a.subscriptionId)!;
      const date = a.endsAt.toISOString().slice(0, 10);
      await this.mailer.send({ to: v.email, subject: 'Your Get4Domain plan is ending soon', text: `Hello ${v.businessName},\n\nYour Get4Domain plan ends on ${date}. You can renew it from your dashboard so your site keeps its features.\n\nThank you.` });
      sent++;
    }
    return { sent, skipped };
  }
}
