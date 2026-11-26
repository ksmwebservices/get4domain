import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SiteRebuild } from './canonical.store';

/** How long a burst of edits is allowed to settle before one rebuild runs, and the longest a vendor who keeps editing can push it back. */
export const REBUILD_DEBOUNCE_MS = 20_000;
export const REBUILD_MAX_WAIT_MS = 120_000;

/**
 * Rebuilds a vendor's published site when something that decides whether it can be indexed has changed (the owner claimed the business, the address, service area, home content
 * or category changed), so the page turns from noindex to indexable without anyone pressing Build.
 *
 *  - A CLAIM rebuilds at once (`immediate`), in the background: the claim answer never waits for it and never fails because of it.
 *  - Any other change is DEBOUNCED per vendor: every new request pushes the run back by the debounce window, so a burst of edits is one rebuild; a vendor who keeps editing is rebuilt
 *    at the latest after the maximum wait.
 *  - One rebuild per vendor runs at a time; a request that arrives meanwhile runs once more afterwards.
 *  - It uses the same safe port as the canonical switch: only a vendor that already has a PUBLISHED site is rebuilt, and a build that changes nothing is reused, not republished.
 * The debounce is held in this process (one API container today); a second instance would simply rebuild twice, which the build service treats as a no-op.
 */
@Injectable()
export class SiteRebuildScheduler implements OnModuleDestroy {
  private readonly log = new Logger('SiteRebuildScheduler');
  debounceMs = REBUILD_DEBOUNCE_MS;
  maxWaitMs = REBUILD_MAX_WAIT_MS;
  now: () => number = () => Date.now();
  private readonly pending = new Map<string, { timer: ReturnType<typeof setTimeout>; first: number; reason: string }>();
  private readonly running = new Set<string>();
  private readonly again = new Map<string, string>();
  private readonly settled = new Map<string, Array<() => void>>();

  constructor(private readonly modules: ModuleRef) {}

  /** Ask for a rebuild of one vendor. Never throws and never waits. */
  request(vendorId: string, reason: string, o: { immediate?: boolean } = {}): void {
    if (!vendorId) return;
    const cur = this.pending.get(vendorId);
    if (o.immediate) {
      if (cur) clearTimeout(cur.timer);
      this.pending.delete(vendorId);
      void this.run(vendorId, reason);
      return;
    }
    const t = this.now();
    const first = cur?.first ?? t;
    if (cur) clearTimeout(cur.timer);
    const wait = Math.max(0, Math.min(this.debounceMs, this.maxWaitMs - (t - first)));
    const timer = setTimeout(() => { this.pending.delete(vendorId); void this.run(vendorId, reason); }, wait);
    if (typeof timer.unref === 'function') timer.unref();
    this.pending.set(vendorId, { timer, first, reason });
  }

  /** True while a rebuild for this vendor is waiting or running (tests and the admin screen). */
  isBusy(vendorId: string): boolean { return this.pending.has(vendorId) || this.running.has(vendorId) || this.again.has(vendorId); }

  /** Resolves when nothing is waiting or running for this vendor. Used by tests. */
  whenIdle(vendorId: string): Promise<void> {
    if (!this.running.has(vendorId) && !this.again.has(vendorId)) return Promise.resolve();
    return new Promise((resolve) => { this.settled.set(vendorId, [...(this.settled.get(vendorId) ?? []), resolve]); });
  }

  private async run(vendorId: string, reason: string): Promise<void> {
    if (this.running.has(vendorId)) { this.again.set(vendorId, reason); return; }
    this.running.add(vendorId);
    try {
      await this.modules.get(SiteRebuild, { strict: false }).rebuildAndPublish(vendorId, { type: 'SYSTEM', id: null, ip: null });
    } catch (e) {
      this.log.warn(`rebuild after ${reason} failed for a vendor: ${e instanceof Error ? e.message.slice(0, 200) : 'error'}`);
    } finally {
      this.running.delete(vendorId);
      const next = this.again.get(vendorId);
      if (next !== undefined) { this.again.delete(vendorId); void this.run(vendorId, next); }
      else for (const done of this.settled.get(vendorId) ?? []) done();
      if (next === undefined) this.settled.delete(vendorId);
    }
  }

  onModuleDestroy(): void { for (const p of this.pending.values()) clearTimeout(p.timer); this.pending.clear(); }
}

/** Global so the claim, site-doc and other modules can ask for a rebuild without importing each other (they inject it as optional). */
@Global()
@Module({ providers: [SiteRebuildScheduler], exports: [SiteRebuildScheduler] })
export class SiteRebuildSchedulerModule {}
