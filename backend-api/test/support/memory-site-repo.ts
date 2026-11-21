import { NotFoundException } from '@nestjs/common';
import { siteError } from '../../src/site-publish/site.errors';
import {
  NewPage, NewPublication, PageRow, PublicationRow, PublishOptions, RollbackOptions, SiteEventInput, SiteRepository, SiteSettingsRow, TxHook,
} from '../../src/site-publish/publish/site.repository';

const notFound = (): NotFoundException => new NotFoundException(siteError('PUBLICATION_NOT_FOUND', 'That version of the site does not exist.'));

/** In-memory twin of PrismaSiteRepository: one lock per vendor (a promise chain, like the advisory lock), monotonic versions, one PUBLISHED per vendor. */
export class MemorySiteRepo extends SiteRepository {
  settings = new Map<string, SiteSettingsRow>();
  pubs = new Map<string, PublicationRow>();
  pages: PageRow[] = [];
  events: Array<SiteEventInput & { vendorId: string; publicationId: string | null }> = [];
  audits: number[] = [];
  private seq = 0;
  private locks = new Map<string, Promise<unknown>>();
  /** test hook: runs inside publish after the lock is taken (to make two publishes really overlap) */
  duringPublish?: () => Promise<void>;

  private async locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    this.locks.set(key, run.catch(() => undefined));
    return run;
  }
  private async hook(audit?: TxHook): Promise<void> { if (audit) { await audit({}); this.audits.push(1); } }

  async getSettings(vendorId: string) { const s = this.settings.get(vendorId); return s ? { ...s } : null; }
  async upsertSettings(vendorId: string, patch: Partial<SiteSettingsRow>) {
    const cur = this.settings.get(vendorId) ?? { vendorId, themeId: null, language: 'en', variant: null, motionIntensity: 'LOW' as const, forceNoindex: false, updatedAt: new Date() };
    const next = { ...cur, ...patch, vendorId, updatedAt: new Date() }; this.settings.set(vendorId, next); return { ...next };
  }
  private forVendor(vendorId: string): PublicationRow[] { return [...this.pubs.values()].filter((p) => p.vendorId === vendorId).sort((a, b) => b.version - a.version); }
  async newestPublication(vendorId: string) { const p = this.forVendor(vendorId)[0]; return p ? { ...p } : null; }
  async currentPublication(vendorId: string) { const p = this.forVendor(vendorId).find((x) => x.status === 'PUBLISHED'); return p ? { ...p } : null; }
  async getPublication(id: string) { const p = this.pubs.get(id); return p ? { ...p } : null; }
  async listPublications(vendorId: string, take: number) { return this.forVendor(vendorId).slice(0, take).map((p) => ({ ...p })); }
  async pagesOf(publicationId: string) { return this.pages.filter((p) => p.publicationId === publicationId).map((p) => ({ ...p })); }
  async getPage(publicationId: string, path: string, lang: string) { const p = this.pages.find((x) => x.publicationId === publicationId && x.path === path && x.lang === lang); return p ? { ...p } : null; }

  async createPublication(data: NewPublication, pages: NewPage[], event: SiteEventInput, audit?: TxHook): Promise<PublicationRow> {
    return this.locked(`build:${data.vendorId}`, async () => {
      const version = (this.forVendor(data.vendorId)[0]?.version ?? 0) + 1;
      const row: PublicationRow = { id: `pub${++this.seq}`, ...data, version, status: 'DRAFT_PREVIEW', rolledBackFromVersion: null, createdAt: new Date(), publishedAt: null, currentVendorId: null };
      this.pubs.set(row.id, row);
      for (const p of pages) this.pages.push({ ...p, publicationId: row.id, vendorId: data.vendorId });
      this.events.push({ ...event, vendorId: data.vendorId, publicationId: row.id });
      await this.hook(audit);
      return { ...row };
    });
  }

  async publish(vendorId: string, publicationId: string, o: PublishOptions): Promise<PublicationRow> {
    return this.locked(`publish:${vendorId}`, async () => {
      const target = this.pubs.get(publicationId);
      if (!target || target.vendorId !== vendorId) throw notFound();
      if (target.status === 'PUBLISHED') return { ...target };
      if (target.status !== 'DRAFT_PREVIEW') throw notFound();
      await o.validate({ ...target });
      await this.duringPublish?.();
      for (const p of this.forVendor(vendorId)) if (p.status === 'PUBLISHED') { p.status = p.rolledBackFromVersion !== null ? 'ROLLED_BACK' : 'SUPERSEDED'; p.currentVendorId = null; }
      target.status = 'PUBLISHED'; target.publishedAt = o.now; target.currentVendorId = vendorId;
      this.events.push({ ...o.event, vendorId, publicationId });
      await this.hook(o.audit);
      return { ...target };
    });
  }

  async rollback(vendorId: string, toVersion: number, o: RollbackOptions): Promise<PublicationRow> {
    return this.locked(`publish:${vendorId}`, async () => {
      const src = this.forVendor(vendorId).find((p) => p.version === toVersion);
      if (!src || src.publishedAt === null) throw notFound();
      await o.validate({ ...src });
      const version = (this.forVendor(vendorId)[0]?.version ?? 0) + 1;
      for (const p of this.forVendor(vendorId)) if (p.status === 'PUBLISHED') { p.status = p.rolledBackFromVersion !== null ? 'ROLLED_BACK' : 'SUPERSEDED'; p.currentVendorId = null; }
      const row: PublicationRow = { ...src, id: `pub${++this.seq}`, version, status: 'PUBLISHED', rolledBackFromVersion: toVersion, createdByType: o.actor.type, createdById: o.actor.id, createdAt: new Date(), publishedAt: o.now, currentVendorId: vendorId };
      this.pubs.set(row.id, row);
      for (const p of this.pages.filter((x) => x.publicationId === src.id)) this.pages.push({ ...p, publicationId: row.id });
      this.events.push({ ...o.event(version), vendorId, publicationId: row.id });
      await this.hook(o.audit);
      return { ...row };
    });
  }

  async recordEvent(vendorId: string, publicationId: string | null, event: SiteEventInput, audit?: TxHook): Promise<void> {
    this.events.push({ ...event, vendorId, publicationId }); await this.hook(audit);
  }

  async listSites(f: { skip: number; take: number }) {
    const ids = [...new Set([...this.settings.keys(), ...[...this.pubs.values()].map((p) => p.vendorId)])].sort();
    const items = await Promise.all(ids.slice(f.skip, f.skip + f.take).map(async (vendorId) => ({ vendorId, businessName: vendorId, settings: await this.getSettings(vendorId), current: await this.currentPublication(vendorId), newest: await this.newestPublication(vendorId) })));
    return { items, total: ids.length };
  }
}
