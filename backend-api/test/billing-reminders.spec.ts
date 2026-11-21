import { BillingSettingsService } from '../src/plan-billing/settings/billing-settings.service';
import { RenewalReminderService, SandboxReminderMailer } from '../src/plan-billing/renewal-reminder.service';
import { advance, billingWorld, BillingWorld, currentOf, paid } from './support/billing-world';
import { MemoryBillingRepo } from './support/memory-billing-repo';

/**
 * Renewal reminders at the SERVICE level (the pure day-offset rules are in billing-core.spec.ts). B2 staging run: the tick returned sent 0 for a subscription 5 days from
 * its end with the flag switched on. The day-offset rules are right (5 days out with 14, 7 and 1 sends the 7-day reminder and logs 14 as skipped); the cause was the
 * settings cache: BillingSettingsService keeps its answer for 15 seconds, the test switched the flag in the database right after the purchase had read it, so the tick still saw
 * "off". Not a product fault (a settings edit is live within 15 seconds), a test fault: the test now invalidates the cache after writing the flag directly.
 */
let w: BillingWorld;
beforeEach(async () => {
  w = billingWorld();
  const o = await w.buy(); await paid(w, o);   // v1 now holds a paid Pro term
  currentOf(w).endsAt = new Date(w.now.t.getTime() + 5 * 86_400_000);   // five days from its end
});

describe('tick(): the whole service path', () => {
  it('switched on, 5 days from the end: ONE reminder is sent (the 7-day offset), the 14-day offset is logged as skipped, and a second tick sends nothing', async () => {
    w.settings.over = { paymentsMode: 'test', renewalRemindersEnabled: true };
    expect(await w.reminders.tick()).toEqual({ sent: 1, skipped: 1 });
    expect(w.mailer.sent).toBe(1); expect(w.repo.reminders.map((r) => [r.daysBefore, r.kind]).sort()).toEqual([[14, 'SKIPPED'], [7, 'SENT']]);
    expect(await w.reminders.tick()).toEqual({ sent: 0, skipped: 0 }); expect(w.mailer.sent).toBe(1);
  });
  it('the 1-day reminder follows when the clock reaches it, once; a renewal (a new end date) starts fresh reminders', async () => {
    w.settings.over = { paymentsMode: 'test', renewalRemindersEnabled: true };
    await w.reminders.tick(); advance(w, 4 * 86_400 + 60);
    expect(await w.reminders.tick()).toEqual({ sent: 1, skipped: 0 }); expect(await w.reminders.tick()).toEqual({ sent: 0, skipped: 0 });
    currentOf(w).endsAt = new Date(w.now.t.getTime() + 6 * 86_400_000);   // renewed: the end moved
    expect(await w.reminders.tick()).toEqual({ sent: 1, skipped: 1 });
  });
  it('off (the default): nothing is sent and nothing is logged', async () => {
    w.settings.over = { paymentsMode: 'test', renewalRemindersEnabled: false };
    expect(await w.reminders.tick()).toEqual({ sent: 0, skipped: 0 }); expect(w.repo.reminders).toHaveLength(0);
  });
  it('two ticks at the same moment (overlapping cron runs) send one email: the unique log row decides', async () => {
    w.settings.over = { paymentsMode: 'test', renewalRemindersEnabled: true };
    const [a, b] = await Promise.all([w.reminders.tick(), w.reminders.tick()]);
    expect(a.sent + b.sent).toBe(1); expect(w.mailer.sent).toBe(1);
  });
});

describe('the settings cache is what hid the flag in the staging run', () => {
  it('a flag written straight to the database is seen after invalidate() (or the 15 second TTL), not before', async () => {
    let flag = false; let reads = 0; let clock = 1_000_000;
    const prisma = { v3PlanSetting: { findMany: async () => { reads++; return [{ key: 'renewalRemindersEnabled', valueJson: flag }, { key: 'renewalReminderDays', valueJson: [14, 7, 1] }]; } } };
    const settings = new BillingSettingsService(prisma as never); settings.clock = () => clock;
    const mailer = new SandboxReminderMailer(); const svc = new RenewalReminderService(w.repo as MemoryBillingRepo, settings, mailer); svc.clock = () => new Date(w.now.t);
    expect(await svc.tick()).toEqual({ sent: 0, skipped: 0 });          // the purchase path had already read "off"
    flag = true;                                                         // the test writes the row directly
    expect(await svc.tick()).toEqual({ sent: 0, skipped: 0 }); expect(reads).toBe(1);   // still cached: this is the staging failure
    settings.invalidate();
    expect(await svc.tick()).toEqual({ sent: 1, skipped: 1 });
    flag = false; clock += 16_000; expect((await settings.get()).renewalRemindersEnabled).toBe(false);   // and the TTL alone also picks up a change
  });
});
