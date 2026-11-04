import { CanonicalStore, CanonicalSwitchRecord, SiteRebuild } from '../../src/site-domains/canonical.store';
import { Actor } from '../../src/plans/admin/audit.service';

/** In-memory twin of the Prisma canonical store: the stored host, the site events (before and after) and the audit rows. */
export class MemoryCanonicalStore extends CanonicalStore {
  stored = new Map<string, string>();
  events: Array<{ vendorId: string; type: 'CANONICAL_SWITCHED'; before: string | null; after: string; reason: string; actor: Actor }> = [];
  audits: string[] = [];
  addonOverrides = new Map<string, string[]>();
  async storedCanonical(v: string) { return this.stored.get(v) ?? null; }
  async recordBaseline(v: string, host: string) { this.stored.set(v, host); }
  async recordSwitch(r: CanonicalSwitchRecord) {
    this.stored.set(r.vendorId, r.to);
    this.events.push({ vendorId: r.vendorId, type: 'CANONICAL_SWITCHED', before: r.from, after: r.to, reason: r.reason, actor: r.actor });
    this.audits.push('site.canonical.switch');
  }
  async vendorsWithStoredCanonical(limit: number) { return [...this.stored.keys()].slice(0, limit); }
  async activeAddonOverrideIds(v: string) { return this.addonOverrides.get(v) ?? []; }
}

export class FakeRebuild extends SiteRebuild {
  calls: string[] = []; failNext = false;
  async rebuildAndPublish(vendorId: string) { if (this.failNext) { this.failNext = false; throw new Error('build failed'); } this.calls.push(vendorId); }
}
