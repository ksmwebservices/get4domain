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
import { BannerLibraryService, MediaService } from '../../src/v3-website/media/media.service';
import { FakeImagePort, FakeMediaStorage } from '../../src/v3-website/media/media.ports';
import { BannerRow, MediaStore, NewBanner, NewPicture, PictureRow } from '../../src/v3-website/media/media.store';
import { DEFAULT_WEBSITE_SETTINGS, WebsiteSettings } from '../../src/v3-website/settings/website-settings';
import { ReviewNotifier, ReviewService } from '../../src/v3-website/review/review.service';
import { NewSubmission, ReviewStore, SubmissionFilter, SubmissionRow } from '../../src/v3-website/review/review.store';
import { NewPageSeoRow, PageSeoRow, PageSeoStore } from '../../src/v3-website/seo/page-seo.store';
import { SeoProjector, SeoService } from '../../src/v3-website/seo/seo.service';
import { LocationProjector, LocationService } from '../../src/v3-website/location/location.service';
import { NewSiteLocation, SiteLocationRow, SiteLocationStore } from '../../src/v3-website/location/site-location.store';
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

/** In-memory twin of PrismaMediaStore: the same per-vendor uniqueness on the content hash, soft delete, one banner per category and hash. */
export class MemoryMediaStore extends MediaStore {
  pictures: PictureRow[] = []; banners: BannerRow[] = []; private n = 0;
  async findPictureBySha(vendorId: string, sha256: string) { return this.pictures.find((p) => p.vendorId === vendorId && p.sha256 === sha256) ?? null; }
  async createPicture(p: NewPicture) { const row: PictureRow = { ...p, id: `pic${++this.n}`, createdAt: new Date(), deletedAt: null }; this.pictures.push(row); return { ...row }; }
  async revivePicture(vendorId: string, id: string, altText: string) { const p = this.pictures.find((x) => x.vendorId === vendorId && x.id === id); if (!p) return null; p.deletedAt = null; p.altText = altText; return { ...p }; }
  async getPicture(vendorId: string, id: string) { const p = this.pictures.find((x) => x.vendorId === vendorId && x.id === id && !x.deletedAt); return p ? { ...p } : null; }
  async listPictures(vendorId: string) { return this.pictures.filter((p) => p.vendorId === vendorId && !p.deletedAt).map((p) => ({ ...p })); }
  async softDeletePicture(vendorId: string, id: string, at: Date) { const p = this.pictures.find((x) => x.vendorId === vendorId && x.id === id && !x.deletedAt); if (!p) return false; p.deletedAt = at; return true; }
  async listBanners(f: { categoryId?: string; activeOnly?: boolean }) { return this.banners.filter((b) => (!f.categoryId || b.categoryId === f.categoryId) && (!f.activeOnly || b.active)).map((b) => ({ ...b })); }
  async getBanner(id: string) { const b = this.banners.find((x) => x.id === id); return b ? { ...b } : null; }
  async upsertBanner(b: NewBanner) {
    const have = this.banners.find((x) => x.categoryId === b.categoryId && x.sha256 === b.sha256);
    if (have) { Object.assign(have, { altText: b.altText, hasPeople: b.hasPeople, sourceUrl: b.sourceUrl, author: b.author, licenceName: b.licenceName, obtainedOn: b.obtainedOn }); return { row: { ...have }, created: false }; }
    const row: BannerRow = { ...b, id: `ban${++this.n}`, createdAt: new Date(), active: true }; this.banners.push(row); return { row: { ...row }, created: true };
  }
  async setBannerActive(id: string, active: boolean) { const b = this.banners.find((x) => x.id === id); if (!b) return null; b.active = active; return { ...b }; }
}

/** In-memory twin of PrismaReviewStore: one SUBMITTED row per vendor, and a decision only moves a row that is still SUBMITTED (compare and set). */
export class MemoryReviewStore extends ReviewStore {
  rows: SubmissionRow[] = []; private n = 0;
  async create(n: NewSubmission, now: Date) {
    if (this.rows.some((r) => r.vendorId === n.vendorId && r.status === 'SUBMITTED')) return null;
    const row: SubmissionRow = { id: `sub${++this.n}`, vendorId: n.vendorId, scope: 'SITE_CONTENT', payload: JSON.parse(JSON.stringify(n.payload)), payloadHash: n.payloadHash, changed: n.changed, status: 'SUBMITTED', submittedById: n.submittedById, reviewerId: null, reason: null, submittedAt: now, decidedAt: null };
    this.rows.push(row); return { ...row };
  }
  async get(id: string) { const r = this.rows.find((x) => x.id === id); return r ? { ...r } : null; }
  async getForVendor(vendorId: string, id: string) { const r = this.rows.find((x) => x.id === id && x.vendorId === vendorId); return r ? { ...r } : null; }
  async listForVendor(vendorId: string, take: number) { return this.rows.filter((r) => r.vendorId === vendorId).sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime() || (a.id < b.id ? 1 : -1)).slice(0, take).map((r) => ({ ...r })); }
  async list(f: SubmissionFilter, skip: number, take: number) { const all = this.rows.filter((r) => (!f.status || r.status === f.status) && (!f.vendorId || r.vendorId === f.vendorId)); return { items: all.slice(skip, skip + take).map((r) => ({ ...r })), total: all.length }; }
  async decide(id: string, to: 'APPROVED' | 'REJECTED', patch: { reviewerId: string | null; reason: string | null; at: Date }) {
    const r = this.rows.find((x) => x.id === id && x.status === 'SUBMITTED'); if (!r) return null;
    Object.assign(r, { status: to, reviewerId: patch.reviewerId, reason: patch.reason, decidedAt: patch.at }); return { ...r };
  }
}
/** In-memory twin of PrismaPageSeoStore: replace is all or nothing per vendor; `failNext` makes the next replace fail (to prove a projection fault never undoes a publish). */
export class MemoryPageSeoStore extends PageSeoStore {
  rows: PageSeoRow[] = []; failNext = false;
  async replaceForVendor(vendorId: string, version: number, rows: readonly NewPageSeoRow[]) {
    if (this.failNext) { this.failNext = false; throw new Error('projection store down'); }
    this.rows = [...this.rows.filter((r) => r.vendorId !== vendorId), ...rows.map((r) => ({ ...r, vendorId, version }))];
  }
  async listForVendor(vendorId: string) { return this.rows.filter((r) => r.vendorId === vendorId).map((r) => ({ ...r })).sort((a, b) => (a.pageKey < b.pageKey ? -1 : 1)); }
  async listAll(vendorId: string | undefined, take: number) { return this.rows.filter((r) => !vendorId || r.vendorId === vendorId).slice(0, take).map((r) => ({ ...r })); }
}
/** In-memory twin of PrismaSiteLocationStore: one row per vendor, removed when the vendor has no location. */
export class MemorySiteLocationStore extends SiteLocationStore {
  rows = new Map<string, SiteLocationRow>();
  async replace(vendorId: string, version: number, row: NewSiteLocation | null) { if (!row) this.rows.delete(vendorId); else this.rows.set(vendorId, { ...row, vendorId, version }); }
  async get(vendorId: string) { const r = this.rows.get(vendorId); return r ? { ...r } : null; }
}
export class RecordingNotifier extends ReviewNotifier { items: Array<{ userId: string | null; role: string | null; kind: string; refId: string }> = []; async notify(n: { userId: string | null; role: string | null; kind: string; refId: string }) { this.items.push(n); } }

export class RecordingCache extends SiteCachePort { purged: string[] = []; async purge(vendorId: string): Promise<void> { this.purged.push(vendorId); } }

export const VENDOR_ID = 'v-plumber';
export const HOST = 'sri-ganesh.sites.example.test';
export const OWNER_ACTOR: Actor = { type: 'VENDOR', id: 'owner-1', ip: null };

export interface WebsiteWorld {
  repo: MemorySiteRepo; store: MemoryWebsiteStore; snapshots: MemorySnapshots; cache: RecordingCache; web: WebsiteService; build: SiteBuildService; publisher: PublishService; pub: SitePublicService;
  content: ContentSource; state: { doc: SourceDocument; ent: ResolvedEntitlements }; scans: string[][]; audit: string[];
  seo: SeoService; seoStore: MemoryPageSeoStore; location: LocationService; locStore: MemorySiteLocationStore;
  reviews: ReviewService; rstore: MemoryReviewStore; notices: RecordingNotifier['items']; activity: Array<{ vendorId: string | null; actionKey: string }>; scanSources: string[];
  media: MediaService; banners: BannerLibraryService; mstore: MemoryMediaStore; storage: FakeMediaStorage; image: FakeImagePort; wsettings: { v: WebsiteSettings }; vendorId: string;
}

/** The real build, publish and managed content pipeline over memory twins, for one plumber vendor. */
export function websiteWorld(o: { level?: 'FREE' | 'PRO'; kind?: 'plumber' | 'dentist' } = {}): WebsiteWorld {
  const kind = o.kind ?? 'plumber';
  const state = { doc: makeDoc(kind, { claimed: true }), ent: entitlements(o.level ?? 'PRO', kind === 'dentist' ? 'professional' : 'handyman') };
  const audit: string[] = []; const scans: string[][] = []; const scanSources: string[] = []; const activity: Array<{ vendorId: string | null; actionKey: string }> = [];
  const repo = new MemorySiteRepo(); const store = new MemoryWebsiteStore(); const snapshots = new MemorySnapshots(store, repo);
  const legacy = { load: async () => state.doc };
  const content = new ManagedContentSource(legacy as never, snapshots);
  const ents = { resolve: async () => state.ent };
  const auditSink: SiteAudit = { hook: (_a, action) => async () => { audit.push(action); } };
  const themes = themeService();
  const build = new SiteBuildService(repo, themes, content, ents as never, auditSink, undefined, undefined, undefined, snapshots); build.clock = () => NOW;
  const scan = { scan: async (_v: string, source: string, texts: string[]) => { scanSources.push(source); scans.push(texts); } };
  const publisher = new PublishService(repo, themes, content, ents as never, auditSink, undefined, scan as never); publisher.clock = () => NOW;
  const settings = new SiteSettingsService(repo, themes, content, ents as never, build, publisher, auditSink);
  const cache = new RecordingCache();
  const seoStore = new MemoryPageSeoStore(); const mstore = new MemoryMediaStore(); const locStore = new MemorySiteLocationStore();
  const web = new WebsiteService(store, repo, themes, settings, build, publisher, ents as never, content, cache, snapshots, scan as never, [new SeoProjector(seoStore), new LocationProjector(locStore)], mstore);
  const seo = new SeoService(web, seoStore); const location = new LocationService(web, locStore);
  const hosts = { resolve: async (host: string) => (host === HOST ? { vendorId: state.doc.vendor.id } : null) };
  const pub = new SitePublicService(repo, hosts as never);
  const storage = new FakeMediaStorage(); const image = new FakeImagePort(); const wsettings = { v: { ...DEFAULT_WEBSITE_SETTINGS } as WebsiteSettings };
  const media = new MediaService(mstore, storage, image, { get: async () => wsettings.v } as never, web); media.clock = () => NOW;
  const banners = new BannerLibraryService(mstore, web);
  const rstore = new MemoryReviewStore(); const notifier = new RecordingNotifier();
  const reviews = new ReviewService(rstore, web, notifier, { record: async (i: { vendorId: string | null; actionKey: string }) => { activity.push({ vendorId: i.vendorId, actionKey: i.actionKey }); return null; } } as never, scan as never);
  return { repo, store, snapshots, cache, web, build, publisher, pub, content, state, scans, audit, media, banners, mstore, storage, image, wsettings, vendorId: state.doc.vendor.id, reviews, rstore, notices: notifier.items, activity, scanSources, seo, seoStore, location, locStore };
}

export type { LoadOptions };
