import { Actor } from '../../src/plans/admin/audit.service';
import { ResolvedEntitlements } from '../../src/plans/entitlements/entitlement-engine';
import { ContentSource, LoadOptions } from '../../src/site-publish/content/content-source';
import { ManagedContentSource, ManagedLayerPort } from '../../src/site-publish/content/managed-content-source';
import { SnapshotSink } from '../../src/site-publish/content/snapshot-sink';
import { SourceDocument } from '../../src/site-publish/content/content-types';
import { PublishService } from '../../src/site-publish/publish/publish.service';
import { SiteAudit } from '../../src/site-publish/publish/site-audit';
import { SiteBuildService } from '../../src/site-publish/publish/site-build.service';
import { SitePublicService } from '../../src/site-publish/publish/site-public.service';
import { SiteSettingsService } from '../../src/site-publish/publish/site-settings.service';
import { hashDoc, ManagedDoc, normaliseDoc } from '../../src/v3-website/core/managed-doc';
import { SiteCachePort } from '../../src/v3-website/website.ports';
import { WebsiteService } from '../../src/v3-website/website.service';
import { DraftRow, SnapshotRow, WebsiteStore } from '../../src/v3-website/website.store';
import { MemorySiteRepo } from './memory-site-repo';
import { doc as makeDoc, entitlements, NOW } from './site-fixtures';
import { themeService } from './site-world';

/** In-memory twin of PrismaWebsiteStore: the same compare-and-set on the draft revision, one snapshot per version. */
export class MemoryWebsiteStore extends WebsiteStore {
  drafts = new Map<string, DraftRow>();
  snaps: SnapshotRow[] = [];
  /** test hook: runs between a read and the compare-and-set write (to make two saves really collide) */
  beforeSave?: () => Promise<void>;
  async getDraft(vendorId: string): Promise<DraftRow | null> { const d = this.drafts.get(vendorId); return d ? { ...d, doc: normaliseDoc(JSON.parse(JSON.stringify(d.doc))) } : null; }
  async saveDraft(vendorId: string, doc: ManagedDoc, o: { expectedRev: number | null; baseVersion: number | null; by: string | null }): Promise<DraftRow | null> {
    if (this.beforeSave) { const h = this.beforeSave; this.beforeSave = undefined; await h(); }
    const cur = this.drafts.get(vendorId);
    if ((cur?.rev ?? null) !== o.expectedRev) return null;
    const row: DraftRow = { vendorId, doc: normaliseDoc(JSON.parse(JSON.stringify(doc))), rev: (cur?.rev ?? 0) + 1, baseVersion: o.baseVersion, updatedAt: new Date() };
    this.drafts.set(vendorId, row);
    return { ...row };
  }
  async deleteDraft(vendorId: string): Promise<void> { this.drafts.delete(vendorId); }
  async snapshotByVersion(vendorId: string, version: number): Promise<SnapshotRow | null> { const s = this.snaps.find((x) => x.vendorId === vendorId && x.version === version); return s ? { ...s } : null; }
  async snapshotVersions(vendorId: string): Promise<number[]> { return this.snaps.filter((s) => s.vendorId === vendorId).map((s) => s.version).sort((a, b) => b - a); }
}

/** Memory twin of PrismaSnapshotSink and PrismaManagedLayer (one object plays both ports, over the shared snapshot list). */
export class MemorySnapshots extends SnapshotSink implements ManagedLayerPort {
  constructor(private readonly store: MemoryWebsiteStore, private readonly repo: MemorySiteRepo) { super(); }
  async record(vendorId: string, publicationId: string, version: number, doc: ManagedDoc | null): Promise<void> {
    if (!doc || this.store.snaps.some((s) => s.publicationId === publicationId)) return;
    this.store.snaps.push({ vendorId, publicationId, version, doc: normaliseDoc(JSON.parse(JSON.stringify(doc))), docHash: hashDoc(doc), createdAt: new Date() });
  }
  async liveDoc(vendorId: string): Promise<ManagedDoc | null> {
    let pub = await this.repo.currentPublication(vendorId);
    for (let i = 0; pub && i < 50; i++) {
      const snap = this.store.snaps.find((s) => s.vendorId === vendorId && (s.publicationId === pub!.id || s.version === pub!.version));
      if (snap) return normaliseDoc(snap.doc);
      if (pub.rolledBackFromVersion === null) return null;
      const target: number = pub.rolledBackFromVersion;
      pub = (await this.repo.listPublications(vendorId, 500)).find((p) => p.version === target) ?? null;
    }
    return null;
  }
}

export class RecordingCache extends SiteCachePort { purged: string[] = []; async purge(vendorId: string): Promise<void> { this.purged.push(vendorId); } }

export const VENDOR_ID = 'v-plumber';
export const HOST = 'sri-ganesh.sites.example.test';
export const OWNER_ACTOR: Actor = { type: 'VENDOR', id: 'owner-1', ip: null };

export interface WebsiteWorld {
  repo: MemorySiteRepo; store: MemoryWebsiteStore; snapshots: MemorySnapshots; cache: RecordingCache; web: WebsiteService; build: SiteBuildService; publisher: PublishService; pub: SitePublicService;
  content: ContentSource; state: { doc: SourceDocument; ent: ResolvedEntitlements }; scans: string[][]; audit: string[];
}

/** The real build, publish and managed content pipeline over memory twins, for one plumber vendor. */
export function websiteWorld(o: { level?: 'FREE' | 'PRO' } = {}): WebsiteWorld {
  const state = { doc: makeDoc('plumber', { claimed: true }), ent: entitlements(o.level ?? 'PRO', 'handyman') };
  const audit: string[] = []; const scans: string[][] = [];
  const repo = new MemorySiteRepo(); const store = new MemoryWebsiteStore(); const snapshots = new MemorySnapshots(store, repo);
  const legacy = { load: async () => state.doc };
  const content = new ManagedContentSource(legacy as never, snapshots);
  const ents = { resolve: async () => state.ent };
  const auditSink: SiteAudit = { hook: (_a, action) => async () => { audit.push(action); } };
  const themes = themeService();
  const build = new SiteBuildService(repo, themes, content, ents as never, auditSink, undefined, undefined, undefined, snapshots); build.clock = () => NOW;
  const scan = { scan: async (_v: string, _s: string, texts: string[]) => { scans.push(texts); } };
  const publisher = new PublishService(repo, themes, content, ents as never, auditSink, undefined, scan as never); publisher.clock = () => NOW;
  const settings = new SiteSettingsService(repo, themes, content, ents as never, build, publisher, auditSink);
  const cache = new RecordingCache();
  const web = new WebsiteService(store, repo, themes, settings, build, publisher, ents as never, content, cache, snapshots, scan as never);
  const hosts = { resolve: async (host: string) => (host === HOST ? { vendorId: state.doc.vendor.id } : null) };
  const pub = new SitePublicService(repo, hosts as never);
  return { repo, store, snapshots, cache, web, build, publisher, pub, content, state, scans, audit };
}

export type { LoadOptions };
