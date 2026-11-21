import { Global, Injectable, Logger, Module } from '@nestjs/common';

/**
 * A small typed in-process event bus (Batch 4). Plan payments, subscriptions, the wallet, services and theme switches say what happened; whoever cares listens.
 *   - The wallet listens to 'plan.order.paid' and 'subscription.assigned' to open itself.
 *   - Slice 5.20 (the activity log) will listen to everything; until it exists a bus with no consumer is fine.
 * A handler that throws never breaks the sender or the other handlers (the sender has already committed its work by the time it emits).
 */
export interface ActivityEvent {
  type: string;
  vendorId: string;
  at: Date;
  actor?: { type: 'VENDOR' | 'STAFF' | 'SYSTEM'; id: string | null };
  data?: Record<string, unknown>;
}
export type ActivityHandler = (e: ActivityEvent) => void | Promise<void>;

@Injectable()
export class ActivityBus {
  private readonly logger = new Logger(ActivityBus.name);
  private readonly handlers = new Map<string, ActivityHandler[]>();

  /** `type` is an exact event type, or '*' for everything */
  on(type: string, handler: ActivityHandler): void { this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]); }

  async emit(e: ActivityEvent): Promise<void> {
    for (const h of [...(this.handlers.get(e.type) ?? []), ...(this.handlers.get('*') ?? [])]) {
      try { await h(e); } catch (err) { this.logger.warn(`handler for ${e.type} failed: ${err instanceof Error ? err.name : 'error'}`); }
    }
  }
}

@Global()
@Module({ providers: [ActivityBus], exports: [ActivityBus] })
export class ActivityBusModule {}
