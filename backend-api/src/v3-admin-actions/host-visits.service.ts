import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HostDirectory } from '../site-domains/host-directory';
import { VisitCounterPort } from '../site-publish/publish/visit-counter.port';
import { adminError } from './admin-actions.errors';
import { AdminActionsStore } from './admin-actions.store';
import { foldCounts } from './core/admin-actions-core';
import { cleanDay, dayKey } from './time';

const MAX_HOSTS = 5000;   // a technical bound on the in-memory counter, not a business number
const HOST = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/;
const vendorOf = (r: { vendorId?: string } | null): string | null => r?.vendorId ?? null;

/**
 * Page visits per host (Amendment 11 Q12): a count per host and day, nothing about the visitor. The public page route counts each page served in memory; this service writes the counts to the
 * table every half minute and when the server stops. A count lost in a crash is lost (they are counts, not records). The admin report reads the table.
 */
@Injectable()
export class HostVisitService extends VisitCounterPort implements OnModuleDestroy {
  private readonly logger = new Logger(HostVisitService.name);
  private counts = new Map<string, number>();
  clock: () => Date = () => new Date();
  constructor(private readonly store: AdminActionsStore, private readonly hosts: HostDirectory) { super(); }

  record(host: string): void {
    const h = String(host ?? '').trim().toLowerCase();
    if (!HOST.test(h)) return;
    if (!this.counts.has(h) && this.counts.size >= MAX_HOSTS) return;
    this.counts.set(h, (this.counts.get(h) ?? 0) + 1);
  }
  pending(): number { let n = 0; for (const v of this.counts.values()) n += v; return n; }

  /** Writes what has been counted. The counter is swapped out first, so a visit during the write is counted in the next round; a failed write puts the counts back. */
  async flush(): Promise<number> {
    if (this.counts.size === 0) return 0;
    const taken = this.counts; this.counts = new Map();
    const day = dayKey(this.clock()); let written = 0; const byVendor = new Map<string, Array<{ host: string; day: string; count: number }>>(); const unresolved: Array<[string, number]> = [];
    for (const row of foldCounts(taken, day)) {
      let v: string | null = null;
      try { v = vendorOf(await this.hosts.resolveHost(row.host)); } catch { unresolved.push([row.host, row.count]); continue; }
      if (!v) continue;   // a host nobody owns is not counted
      byVendor.set(v, [...(byVendor.get(v) ?? []), row]);
    }
    for (const [vendorId, rows] of byVendor) {
      try { await this.store.addVisits(vendorId, rows); written += rows.reduce((n, r) => n + r.count, 0); }
      catch (e) { this.logger.warn(`visit counts not written: ${e instanceof Error ? e.name : 'error'}`); for (const r of rows) this.counts.set(r.host, (this.counts.get(r.host) ?? 0) + r.count); }
    }
    for (const [h, n] of unresolved) this.counts.set(h, (this.counts.get(h) ?? 0) + n);
    return written;
  }
  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick(): Promise<void> { try { await this.flush(); } catch (e) { this.logger.warn(`visit flush failed: ${e instanceof Error ? e.name : 'error'}`); } }
  async onModuleDestroy(): Promise<void> { await this.tick(); }

  /** The staff report for one business: per host, per day, counts only. Defaults to the last 30 days. */
  async report(vendorId: string, q: { from?: unknown; to?: unknown }) {
    const to = q.to === undefined ? dayKey(this.clock()) : cleanDay(q.to); const from = q.from === undefined ? dayKey(new Date(this.clock().getTime() - 29 * 86_400_000)) : cleanDay(q.from);
    if (!from || !to || from > to) throw adminError(400, 'ADMIN_INVALID', 'The dates must be real days (YYYY-MM-DD) with the start before the end.');
    if (!(await this.store.vendor(String(vendorId).slice(0, 64)))) throw adminError(404, 'ADMIN_VENDOR_NOT_FOUND', 'That business does not exist.');
    const rows = await this.store.visitsOf(vendorId, from, to); const byHost = new Map<string, Array<{ day: string; count: number }>>();
    for (const r of rows) byHost.set(r.host, [...(byHost.get(r.host) ?? []), { day: r.day, count: r.count }]);
    const hosts = [...byHost].map(([host, days]) => ({ host, total: days.reduce((n, d) => n + d.count, 0), days })).sort((a, b) => b.total - a.total);
    return { from, to, total: hosts.reduce((n, h) => n + h.total, 0), hosts, note: 'Counts of pages served, per host and day. No visitor data is kept.' };
  }
}
