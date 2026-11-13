import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { ActivityBus, ActivityEvent } from '../common/activity-bus';
import { ActivityService } from './activity.service';

const ID_FIELDS = ['requestId', 'switchId', 'topupId', 'orderId', 'purchaseId', 'themeId', 'eventId', 'messageId', 'ticketId'] as const;

/** The entity an event is about: the first id the event carries, named by the part of the type before the first dot. */
export function entityOf(e: ActivityEvent): { entityType: string; entityId: string | null } {
  const data = e.data ?? {};
  const id = ID_FIELDS.map((k) => data[k]).find((v): v is string => typeof v === 'string' && v.length > 0) ?? null;
  return { entityType: e.type.split('.')[0] || 'event', entityId: id };
}

/**
 * Listens to EVERYTHING on the in-process bus (plans, wallet, services, service requests, theme switches) and writes each event to the activity log. The senders have already committed their work when
 * they emit, and `record()` never throws, so a log fault cannot undo or block what a vendor did. Modules that do not emit on the bus call `ActivityService.record()` themselves.
 */
@Injectable()
export class ActivityBusListener implements OnModuleInit {
  constructor(private readonly activity: ActivityService, @Optional() private readonly bus?: ActivityBus) {}
  onModuleInit(): void {
    this.bus?.on('*', async (e) => { await this.activity.record({ vendorId: e.vendorId, actor: e.actor ?? { type: 'SYSTEM', id: null }, actionKey: e.type, ...entityOf(e), summary: e.data ?? {} }); });
  }
}
