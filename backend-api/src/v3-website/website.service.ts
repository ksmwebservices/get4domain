import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { KeyedQueue } from '../common/keyed-queue';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { ResolvedEntitlements } from '../plans/entitlements/entitlement-engine';
import { Actor } from '../plans/admin/audit.service';
import { categoryFor, splitAddress } from '../site-publish/content/content-adapter';
import { ContentSource } from '../site-publish/content/content-source';
import { SnapshotSink } from '../site-publish/content/snapshot-sink';
import { PublishService } from '../site-publish/publish/publish.service';
import { SiteBuildService } from '../site-publish/publish/site-build.service';
import { PublicationSummary, SiteSettingsService, summarise } from '../site-publish/publish/site-settings.service';
import { SiteRepository } from '../site-publish/publish/site.repository';
import { ThemeRenderService } from '../site-publish/renderer/theme-render.service';
import { ProhibitedScanPort } from '../v3-trust/trust.ports';
import { MediaStore } from './media/media.store';
import { LIVE_PROJECTORS, LiveProjector } from './projection/live-projector';
import { isPageKey, SeoWho, validatePageSeo } from './core/seo-core';
import { deriveEditorMap, EditorMap, navPageKeysOf, sectionIdsOf } from './core/editor-map';
import {
  DocDiff, diffDocs, emptyDoc, FIELD_DEFS, hashDoc, LIST_DEFS, LIST_PLAN_FEATURE, ListName, ManagedDoc, validateBrand, validateList, validateNavigation, validateSections, writeField, writeLocation, writeReviewUrl, writeSeo,
} from './core/managed-doc';
import { validateLocation } from './core/location-core';
import { validateReviewUrl } from './core/review-link-core';
import { checkWording } from './core/wording-core';
import { fieldProblem, limitReached, locked, nothingToPublish, reviewRequired, staleDraft, versionNotFound, wordingProblem } from './website.errors';
import { SiteCachePort } from './website.ports';
import { DraftRow, WebsiteStore } from './website.store';

/** One Website-manager request at a time per vendor, waiting BEFORE any transaction opens (never inside one). */
export const websiteQueue = new KeyedQueue();

export type Change =
  | { kind: 'field'; key: string; value: unknown }
  | { kind: 'list'; name: string; items: unknown }
  | { kind: 'sections'; value: unknown }
  | { kind: 'brand'; value: unknown }
  | { kind: 'navigation'; value: unknown }
  | { kind: 'seo'; pageKey: string; edit: unknown }
  | { kind: 'location'; value: unknown }
  | { kind: 'reviewLink'; value: unknown };

export interface DraftView { doc: ManagedDoc; rev: number; dirty: boolean; baseVersion: number | null; liveVersion: number | null }
export interface EditorView { themeId: string; map: EditorMap; fonts: string[]; pro: boolean; limits: Record<string, number | null>; fields: Record<string, { type: string; max: number; label: string; proOnly: boolean }> }
interface Ctx { ent: ResolvedEntitlements; pro: boolean; themeId: string; map: EditorMap; fonts: string[] }

/** A Pro site: the plan has calls to action on (a downgrade or a suspension brings the Free entitlements, so this turns false by itself). */
export const isPro = (e: ResolvedEntitlements): boolean => e.level === 'PRO' && e.features['site.cta']?.state === 'ACTIVE';

const STANDARD_PAGES: readonly string[] = ['home', 'about', 'services', 'gallery', 'contact'];
const pageSlugs = (d: ManagedDoc): string[] => (d.lists.pages ?? []).filter((p) => p.enabled === true).map((p) => String(p.slug));
const limitOf = (e: ResolvedEntitlements, key: string): number | null => (e.features[key]?.state === 'LIMITED' || e.features[key]?.state === 'ACTIVE' ? e.features[key].limit : null);

/**
 * The Website manager (slice 5.5a): the vendor's draft of every page's content, saved field by field, previewed, published and restored. Pro edits go live at once;
 * a Free vendor's edits are submitted for review (slice 5.5c). Everything that touches one vendor's draft or publication runs in `websiteQueue` first.
 */
@Injectable()
export class WebsiteService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly store: WebsiteStore,
    private readonly repo: SiteRepository,
    private readonly themes: ThemeRenderService,
    private readonly settings: SiteSettingsService,
    private readonly build: SiteBuildService,
    private readonly publisher: PublishService,
    @Inject(EntitlementsService) private readonly entitlements: Pick<EntitlementsService, 'resolve'>,
    private readonly content: ContentSource,
    private readonly cache: SiteCachePort,
    @Optional() @Inject(SnapshotSink) private readonly snapshots?: SnapshotSink,
    @Optional() @Inject(ProhibitedScanPort) private readonly scan?: ProhibitedScanPort,
    /** slice B1 onwards: copies of the live document that staff can query; each runs after a version goes live */
    @Optional() @Inject(LIVE_PROJECTORS) private readonly projectors?: LiveProjector[],
    /** the vendor's uploaded pictures (the share picture of a page may be one of them) */
    @Optional() private readonly media?: MediaStore,
  ) {}
  private readonly logger = new Logger(WebsiteService.name);

  // ── context ───────────────────────────────────────────────────────────────────────────────────
  private async context(vendorId: string): Promise<Ctx> {
    const status = await this.settings.status(vendorId);
    const ent = await this.entitlements.resolve(vendorId);
    if (!status.themeId) throw fieldProblem('NO_THEME', 'This site has no theme yet; choose a category first.');
    const loaded = this.themes.getTheme(status.themeId);
    return { ent, pro: isPro(ent), themeId: status.themeId, map: deriveEditorMap(loaded.theme.templates), fonts: loaded.manifest.fonts ?? [] };
  }

  private async liveDoc(vendorId: string): Promise<ManagedDoc> { return (await this.content.load(vendorId))?.managed ?? emptyDoc(); }

  /** The vendor's kit category and family (null when the business has no category yet). */
  async categoryOf(vendorId: string): Promise<{ categoryId: string; family: string } | null> {
    const doc = await this.content.load(vendorId);
    if (!doc) return null;
    const kit = this.themes.kitApi;
    const categoryId = categoryFor(doc, kit, kit.categoryMap());
    return categoryId ? { categoryId, family: kit.categoryById(categoryId).family } : null;
  }

  // ── what the SEO panel and the projections need ───────────────────────────────────────────────
  /** The pictures the site already owns and the active item ids, for checking a page's share picture and an item page's key. */
  private async seoRefs(vendorId: string): Promise<{ images: string[]; items: string[] }> {
    const src = await this.content.load(vendorId);
    return {
      images: [...(src?.cms?.portfolio ?? []).map((g) => g.src), ...((await this.media?.listPictures(vendorId)) ?? []).map((p) => p.url)],
      items: (src?.items ?? []).filter((i) => i.active).map((i) => i.id),
    };
  }

  /** The name, city and category label the defaults are made from, and every page of the site (from `doc`, or from the draft). */
  private async contextFor(vendorId: string, doc: ManagedDoc): Promise<{ who: SeoWho; pages: Array<{ pageKey: string; label: string; slug: { value: string; editable: boolean } }>; doc: ManagedDoc }> {
    const c = await this.context(vendorId);
    const src = await this.content.load(vendorId);
    const cat = await this.categoryOf(vendorId);
    const who: SeoWho = { businessName: src?.cms?.businessName || src?.vendor.businessName || '', city: splitAddress(String(src?.cms?.address ?? '')).city, categoryLabel: cat ? this.themes.kitApi.categoryById(cat.categoryId).label : '' };
    const pages: Array<{ pageKey: string; label: string; slug: { value: string; editable: boolean } }> = [];
    for (const k of STANDARD_PAGES) if (c.map.pages.some((p) => p.key === k)) pages.push({ pageKey: k, label: k.charAt(0).toUpperCase() + k.slice(1), slug: { value: k === 'home' ? '' : k, editable: false } });
    for (const p of doc.lists.pages ?? []) if (p.enabled === true) pages.push({ pageKey: `page:${String(p.slug)}`, label: String(p.title), slug: { value: String(p.slug), editable: true } });
    for (const i of src?.items ?? []) if (i.active) pages.push({ pageKey: `item:${i.id}`, label: i.name, slug: { value: '', editable: false } });
    return { who, pages, doc };
  }

  /** For the vendor's SEO panel: the pages as the draft has them. */
  async seoContext(vendorId: string): Promise<{ who: SeoWho; pages: Array<{ pageKey: string; label: string; slug: { value: string; editable: boolean } }>; doc: ManagedDoc }> {
    return this.contextFor(vendorId, (await this.store.getDraft(vendorId))?.doc ?? (await this.liveDoc(vendorId)));
  }

  /** Runs the projectors for the version that just went live. A fault is logged by name and never undoes the publish. */
  private async project(vendorId: string, version: number, doc: ManagedDoc): Promise<void> {
    if (!this.projectors?.length) return;
    try {
      const c = await this.contextFor(vendorId, doc);
      for (const p of this.projectors) {
        try { await p.project({ vendorId, version, doc, who: c.who, pageKeys: c.pages.map((x) => x.pageKey) }); }
        catch (e) { this.logger.warn(`projection ${p.constructor.name} failed: ${e instanceof Error ? e.name : 'error'}`); }
      }
    } catch (e) { this.logger.warn(`projection context failed: ${e instanceof Error ? e.name : 'error'}`); }
  }

  /** True when the draft or the live document uses this picture link (a picture in use cannot be removed). */
  async usesUrl(vendorId: string, url: string): Promise<boolean> {
    const [d, live] = await Promise.all([this.store.getDraft(vendorId), this.liveDoc(vendorId)]);
    return JSON.stringify(d?.doc ?? {}).includes(url) || JSON.stringify(live).includes(url);
  }

  async editor(vendorId: string): Promise<EditorView> {
    const c = await this.context(vendorId);
    const fields = Object.fromEntries(Object.entries(FIELD_DEFS).map(([k, d]) => [k, { type: d.type, max: d.max, label: d.label, proOnly: d.proOnly === true }]));
    return { themeId: c.themeId, map: c.map, fonts: c.fonts, pro: c.pro, limits: { faqs: limitOf(c.ent, 'site.faqs'), gallery: limitOf(c.ent, 'site.gallery'), pages: limitOf(c.ent, 'site.pages'), services: limitOf(c.ent, 'site.services') }, fields };
  }

  // ── draft ─────────────────────────────────────────────────────────────────────────────────────
  private async view(vendorId: string, row: DraftRow | null, live: ManagedDoc): Promise<DraftView> {
    const cur = await this.repo.currentPublication(vendorId);
    const doc = row?.doc ?? live;
    return { doc, rev: row?.rev ?? 0, dirty: hashDoc(doc) !== hashDoc(live), baseVersion: row?.baseVersion ?? null, liveVersion: cur?.version ?? null };
  }

  async draft(vendorId: string): Promise<DraftView> { return this.view(vendorId, await this.store.getDraft(vendorId), await this.liveDoc(vendorId)); }

  /** Every text a change writes, as (field, text) pairs for the wording check. */
  private texts(doc: ManagedDoc, change: Change): Array<[string, string]> {
    if (change.kind === 'field') return typeof change.value === 'string' ? [[change.key, change.value]] : [];
    if (change.kind === 'list') return (doc.lists[change.name as ListName] ?? []).flatMap((it, i) => Object.entries(it).filter(([, v]) => typeof v === 'string').map(([k, v]): [string, string] => [`${change.name}[${i}].${k}`, v as string]));
    return [];
  }

  private apply(doc: ManagedDoc, change: Change, c: Ctx, x: { images: string[]; items: string[] }): ManagedDoc {
    switch (change.kind) {
      case 'field': {
        if (FIELD_DEFS[change.key]?.proOnly && !c.pro) throw locked('site.cta', c.ent.features['site.cta']?.upsellText ?? null);
        const r = writeField(doc, change.key, change.value);
        if (!r.ok) throw fieldProblem(r.code, r.message, r.field);
        return r.doc;
      }
      case 'list': {
        if (!Object.prototype.hasOwnProperty.call(LIST_DEFS, change.name)) throw fieldProblem('FIELD_LOCKED', 'That list is not editable.', change.name);
        const name = change.name as ListName;
        const r = validateList(name, change.items);
        if (!r.ok) throw fieldProblem(r.code, r.message, r.field);
        const feature = LIST_PLAN_FEATURE[name]; const limit = feature ? limitOf(c.ent, feature) : null;
        if (limit !== null && r.items.length > limit) throw limitReached(name, limit);
        return { ...doc, lists: { ...doc.lists, [name]: r.items } };
      }
      case 'sections': { const r = validateSections(change.value, sectionIdsOf(c.map)); if (!r.ok) throw fieldProblem(r.code, r.message, r.field); return { ...doc, sections: r.sections }; }
      case 'brand': { const r = validateBrand(change.value, c.fonts); if (!r.ok) throw fieldProblem(r.code, r.message, r.field); return { ...doc, brand: r.brand }; }
      case 'navigation': { const r = validateNavigation(change.value, navPageKeysOf(c.map, pageSlugs(doc))); if (!r.ok) throw fieldProblem(r.code, r.message, r.field); return { ...doc, navigation: r.navigation }; }
      case 'reviewLink': {
        if (!c.pro) throw locked('site.cta', c.ent.features['site.cta']?.upsellText ?? null);   // Pro only (owner rule 2): a Free site shows no review button
        const r = writeReviewUrl(doc, change.value); if (!r.ok) throw fieldProblem(r.code, r.message, r.field); return r.doc;
      }
      case 'location': { const r = writeLocation(doc, change.value); if (!r.ok) throw fieldProblem(r.code, r.message, r.field); return r.doc; }
      case 'seo': {
        const exists = isPageKey(change.pageKey) && (STANDARD_PAGES.includes(change.pageKey) ? c.map.pages.some((p) => p.key === change.pageKey)
          : change.pageKey.startsWith('page:') ? pageSlugs(doc).includes(change.pageKey.slice(5)) : x.items.includes(change.pageKey.slice(5)));
        if (!exists) throw fieldProblem('FIELD_LOCKED', 'That page does not exist on your site.', String(change.pageKey));
        const own = [...x.images, ...(doc.lists.gallery ?? []).map((g) => String(g.src)), ...[doc.fields['hero.image'], doc.fields['about.image']].filter((u): u is string => !!u)];
        const r = writeSeo(doc, change.pageKey, change.edit, own);
        if (!r.ok) throw r.code === 'WORDING_NOT_ALLOWED' ? wordingProblem(r.field ?? change.pageKey) : fieldProblem(r.code, r.message, r.field);
        return r.doc;
      }
    }
  }

  /** Autosave: one change to the draft. The change is applied to the newest draft, so two tabs saving different fields never lose each other's work. */
  save(vendorId: string, actor: Actor, change: Change): Promise<DraftView> {
    return websiteQueue.run(`site-manager:${vendorId}`, async () => {
      const c = await this.context(vendorId);
      const live = await this.liveDoc(vendorId);
      const x = change.kind === 'seo' ? await this.seoRefs(vendorId) : { images: [], items: [] };
      for (let attempt = 0; attempt < 5; attempt++) {
        const row = await this.store.getDraft(vendorId);
        const next = this.apply(row?.doc ?? live, change, c, x);
        for (const [field, text] of this.texts(next, change)) if (!checkWording(text, { strict: false }).ok) throw wordingProblem(field);
        const base = row?.baseVersion ?? (await this.repo.currentPublication(vendorId))?.version ?? null;
        const saved = await this.store.saveDraft(vendorId, next, { expectedRev: row?.rev ?? null, baseVersion: base, by: actor.id });
        if (saved) return this.view(vendorId, saved, live);
      }
      throw staleDraft();
    });
  }

  /** Throw the draft away: the draft is the live document again. */
  discard(vendorId: string): Promise<DraftView> {
    return websiteQueue.run(`site-manager:${vendorId}`, async () => { await this.store.deleteDraft(vendorId); return this.view(vendorId, null, await this.liveDoc(vendorId)); });
  }

  // ── preview, publish ──────────────────────────────────────────────────────────────────────────
  /** Builds a preview of the whole site from the draft. Nothing goes live; the same draft returns the same preview. */
  preview(vendorId: string, actor: Actor): Promise<{ publication: PublicationSummary; reused: boolean }> {
    return websiteQueue.run(`site-manager:${vendorId}`, async () => {
      const doc = (await this.store.getDraft(vendorId))?.doc ?? (await this.liveDoc(vendorId));
      const r = await this.build.build(vendorId, { actor, overlay: doc });
      return { publication: summarise(r.publication) as PublicationSummary, reused: r.reused };
    });
  }

  /** Re-checks the whole draft against the vendor as they are now (a plan can change between the edit and the publish). */
  private validateWhole(doc: ManagedDoc, c: Ctx): void {
    for (const [k, v] of Object.entries(doc.fields)) {
      // a Pro-only value kept from a Pro period stays in the document after a downgrade (owner rule 6): it is not drawn on a Free site, and it never blocks a Free edit
      if (!writeField(emptyDoc(), k, v).ok) throw fieldProblem('FIELD_INVALID', 'A saved value is no longer valid.', k);
      if (!checkWording(v, { strict: false }).ok) throw wordingProblem(k);
    }
    for (const [name, items] of Object.entries(doc.lists)) {
      const r = validateList(name as ListName, items);
      if (!r.ok) throw fieldProblem(r.code, r.message, r.field);
      const feature = LIST_PLAN_FEATURE[name as ListName]; const limit = feature ? limitOf(c.ent, feature) : null;
      if (limit !== null && r.items.length > limit) throw limitReached(name, limit);
      for (const [field, text] of this.texts(doc, { kind: 'list', name, items })) if (!checkWording(text, { strict: false }).ok) throw wordingProblem(field);
    }
    if (doc.reviewUrl) { const r = validateReviewUrl(doc.reviewUrl); if (!r.ok) throw fieldProblem(r.code, 'A saved review link is no longer valid.', 'reviewUrl'); }
    if (doc.location) { const r = validateLocation(doc.location); if (!r.ok) throw fieldProblem(r.code, 'A saved location is no longer valid.', `location.${r.field}`); }
    for (const [key, edit] of Object.entries(doc.seo)) {
      const r = validatePageSeo(edit, edit.shareImageRef ? [edit.shareImageRef] : []);   // the picture was checked against the site's own pictures when it was written
      if (!isPageKey(key) || !r.ok) { if (r && !r.ok && r.code === 'WORDING_NOT_ALLOWED') throw wordingProblem(r.field); throw fieldProblem(r && !r.ok ? r.code : 'FIELD_LOCKED', 'A saved page SEO text is no longer valid.', `seo.${key}`); }
    }
    const s = validateSections(doc.sections, sectionIdsOf(c.map)); if (!s.ok) throw fieldProblem(s.code, s.message, s.field);
    const b = validateBrand(doc.brand, c.fonts); if (!b.ok) throw fieldProblem(b.code, b.message, b.field);
    const n = validateNavigation(doc.navigation, navPageKeysOf(c.map, pageSlugs(doc))); if (!n.ok) throw fieldProblem(n.code, n.message, n.field);
  }

  /**
   * Publish the draft (Pro): validate, build from the draft, publish through the existing pipeline, remember what was published, purge the cache. The prohibited-term
   * scan runs inside the publish and only raises an alert. Publishing a draft that equals what is already live changes nothing and says so (a double publish is harmless).
   */
  publish(vendorId: string, actor: Actor, o: { staff?: boolean } = {}): Promise<{ unchanged: boolean; publication: PublicationSummary | null }> {
    return websiteQueue.run(`site-manager:${vendorId}`, async () => {
      const c = await this.context(vendorId);
      if (!c.pro && !o.staff) throw reviewRequired();   // a Free vendor's edits are reviewed; staff acting for the vendor are the review
      const live = await this.liveDoc(vendorId);
      const row = await this.store.getDraft(vendorId);
      const draft = row?.doc ?? live;
      const current = await this.repo.currentPublication(vendorId);
      if (current && hashDoc(draft) === hashDoc(live)) return { unchanged: true, publication: summarise(current) };
      if (!current && !row) throw nothingToPublish();
      const r = await this.publishDocLocked(vendorId, actor, draft);
      if (row) await this.store.saveDraft(vendorId, draft, { expectedRev: row.rev, baseVersion: r.publication?.version ?? null, by: actor.id });
      return r;
    });
  }

  // ── pieces the review slice (5.5c) uses; the caller holds the vendor's queue slot ────────────────
  /** Runs `fn` in the vendor's Website-manager queue slot (never call another queued method inside it). */
  runLocked<T>(vendorId: string, fn: () => Promise<T>): Promise<T> { return websiteQueue.run(`site-manager:${vendorId}`, fn); }

  /** Whether the vendor's plan is Pro right now. */
  async isProVendor(vendorId: string): Promise<boolean> { return isPro(await this.entitlements.resolve(vendorId)); }

  /** The vendor's draft (or live) document and the live document, for a submission. */
  async draftAndLive(vendorId: string): Promise<{ draft: ManagedDoc; live: ManagedDoc; hasCurrent: boolean }> {
    const live = await this.liveDoc(vendorId);
    return { draft: (await this.store.getDraft(vendorId))?.doc ?? live, live, hasCurrent: (await this.repo.currentPublication(vendorId)) !== null };
  }

  /** Re-checks a whole document against the vendor as they are now; throws the field problem, the wording refusal or the plan limit. */
  async checkDoc(vendorId: string, doc: ManagedDoc): Promise<void> { this.validateWhole(doc, await this.context(vendorId)); }

  /** Validates, builds from `doc`, publishes through the existing pipeline and purges the cache. A document equal to the live one changes nothing. */
  async publishDocLocked(vendorId: string, actor: Actor, doc: ManagedDoc): Promise<{ unchanged: boolean; publication: PublicationSummary | null }> {
    const live = await this.liveDoc(vendorId);
    const current = await this.repo.currentPublication(vendorId);
    if (current && hashDoc(doc) === hashDoc(live)) return { unchanged: true, publication: summarise(current) };
    this.validateWhole(doc, await this.context(vendorId));
    const built = await this.build.build(vendorId, { actor, overlay: doc });
    const done = await this.publisher.publish(vendorId, built.publication.id, actor);
    await this.cache.purge(vendorId);
    await this.project(vendorId, done.version, doc);
    return { unchanged: false, publication: summarise(done) };
  }

  // ── revisions ─────────────────────────────────────────────────────────────────────────────────
  async revisions(vendorId: string): Promise<Array<PublicationSummary & { hasContentSnapshot: boolean }>> {
    const [pubs, snaps] = await Promise.all([this.repo.listPublications(vendorId, 100), this.store.snapshotVersions(vendorId)]);
    return pubs.map((p) => ({ ...(summarise(p) as PublicationSummary), hasContentSnapshot: snaps.includes(p.version) }));
  }

  /** The managed document a version was built from: its own snapshot, else (a rollback copy) its source's, else none (a version built before the manager existed). */
  private async docOfVersion(vendorId: string, version: number, pubs: Array<{ version: number; rolledBackFromVersion: number | null }>): Promise<ManagedDoc> {
    let v: number | null = version;
    for (let hops = 0; v !== null && hops < 50; hops++) {
      const snap = await this.store.snapshotByVersion(vendorId, v);
      if (snap) return snap.doc;
      v = pubs.find((p) => p.version === v)?.rolledBackFromVersion ?? null;
    }
    return emptyDoc();
  }

  /** Republish an earlier version as a new one. The draft becomes that version's content, so the next edit starts from what is live. Needs the plan's version history. */
  restore(vendorId: string, toVersion: number, actor: Actor): Promise<{ publication: PublicationSummary }> {
    return websiteQueue.run(`site-manager:${vendorId}`, async () => {
      const pubs = await this.repo.listPublications(vendorId, 500);
      if (!pubs.some((p) => p.version === toVersion)) throw versionNotFound();
      const doc = await this.docOfVersion(vendorId, toVersion, pubs);
      const row = await this.publisher.rollback(vendorId, toVersion, actor);
      await this.snapshots?.record(vendorId, row.id, row.version, doc);
      for (let i = 0; i < 5; i++) {
        const cur = await this.store.getDraft(vendorId);
        if (await this.store.saveDraft(vendorId, doc, { expectedRev: cur?.rev ?? null, baseVersion: row.version, by: actor.id })) break;
      }
      await this.cache.purge(vendorId);
      await this.project(vendorId, row.version, doc);
      return { publication: summarise(row) as PublicationSummary };
    });
  }

  /** What differs between two versions: the content areas that changed and the pages that were added, removed or changed. */
  async compare(vendorId: string, from: number, to: number): Promise<{ from: number; to: number; content: DocDiff; pages: { added: string[]; removed: string[]; changed: string[]; unchanged: number } }> {
    const pubs = await this.repo.listPublications(vendorId, 500);
    const a = pubs.find((p) => p.version === from); const b = pubs.find((p) => p.version === to);
    if (!a || !b) throw versionNotFound();
    const [da, db, pa, pb] = await Promise.all([this.docOfVersion(vendorId, from, pubs), this.docOfVersion(vendorId, to, pubs), this.repo.pagesOf(a.id), this.repo.pagesOf(b.id)]);
    const key = (p: { path: string; lang: string }): string => `${p.lang}:${p.path}`;
    const html = (l: typeof pa): Map<string, string> => new Map(l.filter((p) => p.html.startsWith('<!doctype html>')).map((p) => [key(p), p.sha256]));
    const ma = html(pa); const mb = html(pb);
    const added = [...mb.keys()].filter((k) => !ma.has(k)).sort(); const removed = [...ma.keys()].filter((k) => !mb.has(k)).sort();
    const changed = [...mb.keys()].filter((k) => ma.has(k) && ma.get(k) !== mb.get(k)).sort();
    return { from, to, content: diffDocs(da, db), pages: { added, removed, changed, unchanged: [...mb.keys()].filter((k) => ma.get(k) === mb.get(k)).length } };
  }
}
