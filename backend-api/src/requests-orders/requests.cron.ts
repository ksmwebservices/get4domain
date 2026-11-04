import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { B3SettingsService } from '../b3-settings/b3-settings.service';
import { LifecycleStore } from '../vendor-lifecycle/lifecycle.store';
import { MessagingService } from './messaging.service';
import { needsNudge } from './core/requests-core';
import { RequestsStore } from './requests.store';

/**
 * The housekeeping tick (every 5 minutes): requests nobody answered by their expiry date become EXPIRED, expired stock reservations are released, and, only when the setting requestNudgeEnabled is on
 * (default OFF), a vendor with a request waiting longer than nudgeAfterMinutes gets ONE reminder (sandbox outbox). All of it is safe to repeat.
 */
@Injectable()
export class RequestsCron {
  private readonly logger = new Logger(RequestsCron.name);
  private busy = false;
  clock: () => Date = () => new Date();
  constructor(private readonly store: RequestsStore, private readonly messaging: MessagingService, private readonly lifecycle: LifecycleStore, @Inject(B3SettingsService) private readonly b3: Pick<B3SettingsService, 'get'>) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick(): Promise<{ expired: number; released: number; nudged: number }> {
    if (this.busy) return { expired: 0, released: 0, nudged: 0 };
    this.busy = true;
    try { return await this.run(); } catch (e) { this.logger.error(`requests tick failed: ${e instanceof Error ? e.name : 'error'}`); return { expired: 0, released: 0, nudged: 0 }; } finally { this.busy = false; }
  }

  async run(): Promise<{ expired: number; released: number; nudged: number }> {
    const s = await this.b3.get(); const now = this.clock(); let expired = 0; let nudged = 0;
    for (const r of await this.store.expirable(now, 200)) { if (await this.store.transition(r.id, r.status, 'EXPIRED', {}, { type: 'EXPIRED', actorType: 'SYSTEM' })) expired++; }
    const released = await this.store.releaseExpiredReservations(now);
    if (s.requestNudgeEnabled) {
      for (const r of await this.store.nudgeCandidates(new Date(now.getTime() - s.nudgeAfterMinutes * 60_000), 200)) {
        if (!needsNudge(r, now, s.nudgeAfterMinutes)) continue;
        if ((await this.store.events(r.id)).some((e) => e.type === 'NUDGED')) continue;   // once per request
        const v = await this.lifecycle.vendor(r.vendorId); if (!v) continue;
        await this.messaging.send({ vendorId: r.vendorId, to: { phone: v.phone, email: v.email }, templateKey: 'request_nudge_vendor', vars: { businessName: v.businessName, reference: r.id }, relatedRequestId: r.id });
        await this.store.addEvent(r.id, { type: 'NUDGED', actorType: 'SYSTEM' }, now); nudged++;
      }
    }
    return { expired, released, nudged };
  }
}
