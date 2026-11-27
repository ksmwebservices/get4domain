import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { Actor } from '../plans/admin/audit.service';
import { Kit, KIT, loadKit } from '../site-publish/renderer/renderer-loader';
import { inspectPackage, PackageContext, PackageProblem, PACK_KEYS, ADDON_KEYS, CAPABILITY_KEYS, COMBINATION_TAGS } from './core/theme-package-core';
import { THEME_DELETE_BLOCK_MESSAGES, ThemeDeleteBlock, versionsDeleteBlock } from './core/theme-delete-core';
import { ThemeChangeNotifier } from './theme-change-notifier';
import { ThemePreviewService } from './theme-preview.service';
import { packageInvalid, themeError } from './theme-market.errors';
import { AuditSpec, ThemeFilter, ThemeMarketStore, ThemeRow, ThemeStatus, THEME_STATUSES } from './theme-market.store';

export { ThemeChangeNotifier } from './theme-change-notifier';

export interface UploadedZip { buffer?: Buffer; size?: number; originalname?: string }
export const MAX_PACKAGE_BYTES = 5 * 1024 * 1024;
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** The answer for one theme: everything except the bytes and the raw manifest. */
export function themeView(r: ThemeRow) {
  return {
    id: r.id, key: r.key, version: r.version, name: r.name, description: r.description, tier: r.tier, premium: r.tier === 'Premium', starter: r.starter, licence: r.licence,
    status: r.status, visibility: r.visibility, privateVendorId: r.privateVendorId, sourceVendorId: r.sourceVendorId,
    tracks: r.tracks, packs: r.packs, addons: r.addons, capabilities: r.capabilities, tags: r.tags, catalogueCategories: r.catalogueCategories, kitCategories: r.kitCategories,
    contentHash: r.contentHash, sizeBytes: r.sizeBytes, fileCount: r.fileCount,
    consent: { obtained: r.consentObtained, note: r.consentNote, at: iso(r.consentAt), byId: r.consentById }, reviewNote: r.reviewNote,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), submittedAt: iso(r.submittedAt), publishedAt: iso(r.publishedAt), archivedAt: iso(r.archivedAt),
  };
}
export type ThemeView = ReturnType<typeof themeView>;

/**
 * The admin side of the theme marketplace (TM1 M2). A theme package is untrusted input: it is inspected in memory (the kit's validator, the marketplace rules, the content-free rules, the lint) and
 * stored only when EVERY check passes. It then moves DRAFT, REVIEW, PUBLISHED, ARCHIVED; only an ADMIN or SUPER_ADMIN reaches these routes (the role matrix), every change writes an audit row in the same
 * transaction, and a publish, archive or delete tells the runtime loader (M3) so no restart is needed. A row is never removed: deleting a theme that never went live and never was a business's stamps its rows and empties their package files.
 */
@Injectable()
export class ThemeMarketService {
  clock: () => Date = () => new Date();
  private readonly kit: Kit;
  private readonly previews: ThemePreviewService;
  constructor(private readonly store: ThemeMarketStore, private readonly notifier: ThemeChangeNotifier, @Optional() @Inject(KIT) kit?: Kit, @Optional() previews?: ThemePreviewService) { this.kit = kit ?? loadKit(); this.previews = previews ?? new ThemePreviewService(this.kit); }

  /**
   * An admin's preview of ANY stored version, draft included (so a theme is looked at before it is published): the stored package is read in memory, drawn with the sample business of a pack and returned as a finished page.
   * The caller sends it with the preview headers (strict content security policy, no cookie).
   */
  async previewStored(id: string, pack: string | undefined, page: string | undefined): Promise<string> {
    const row = await this.store.findWithBytes((await this.mustFind(id)).id);
    if (!row) throw themeError(404, 'THEME_NOT_FOUND', 'That theme was not found.');
    const r = this.kit.validatePackage(row.bytes);
    if (!r.ok || !r.manifest) throw themeError(422, 'THEME_PREVIEW_FAILED', 'The stored package no longer passes the package rules, so it cannot be previewed.');
    return this.previews.render(this.kit.themeFromFiles(r.files, null), String(pack ?? row.packs[0] ?? '').toUpperCase().slice(0, 60), String(page ?? 'home'));
  }

  /** Keys that belong to the built-in library (and the kit's reference theme): a package may not take them. */
  private reservedKeys(): Set<string> { return new Set([...this.kit.listVendorThemeIds(), '_starter', 'kit-starter']); }

  private fileOf(file: UploadedZip | undefined): Buffer {
    if (!file || !file.buffer || file.buffer.length === 0) throw themeError(400, 'THEME_PACKAGE_MISSING', 'Send the theme package (a .zip) in the "file" field.');
    if (file.buffer.length > MAX_PACKAGE_BYTES) throw themeError(413, 'THEME_PACKAGE_TOO_LARGE', `The package is ${file.buffer.length} bytes; the limit is ${MAX_PACKAGE_BYTES} (5 MB).`);
    return file.buffer;
  }

  private async context(vendorId: string | null): Promise<PackageContext> {
    if (!vendorId) return { vendorId: null };
    if (!(await this.store.vendorExists(vendorId))) throw themeError(404, 'THEME_VENDOR_NOT_FOUND', 'That business was not found.');
    return { vendorId };
  }

  /** Dry run: every problem, nothing stored. */
  async validate(file: UploadedZip | undefined, vendorId: string | null = null) {
    const zip = this.fileOf(file); const ctx = await this.context(vendorId);
    const r = inspectPackage(this.kit, zip, ctx, sha256);
    const key = r.manifest?.id ?? null; const problems: PackageProblem[] = [...r.problems];
    if (key && this.reservedKeys().has(key)) problems.push({ file: 'theme.json', rule: 'key-reserved', message: `The key ${key} belongs to the built-in theme library.`, source: 'marketplace' });
    return { ok: problems.length === 0, problemCount: problems.length, problems: problems.slice(0, 100), manifest: r.manifest ? { key: r.manifest.id, version: r.manifest.version, name: r.manifest.name, tier: r.manifest.tier, tracks: r.manifest.tracks, marketplace: r.manifest.marketplace ?? null } : null, sizeBytes: zip.length, contentHash: r.contentHash };
  }

  async upload(actor: Actor, file: UploadedZip | undefined, opts: { vendorId?: string | null } = {}) {
    const zip = this.fileOf(file); const vendorId = opts.vendorId ?? null; const ctx = await this.context(vendorId);
    const r = inspectPackage(this.kit, zip, ctx, sha256);
    const problems = [...r.problems];
    const m = r.manifest;
    if (m && this.reservedKeys().has(m.id)) problems.push({ file: 'theme.json', rule: 'key-reserved', message: `The key ${m.id} belongs to the built-in theme library.`, source: 'marketplace' });
    if (problems.length || !m || !r.contentHash) throw packageInvalid(problems);

    // the same bytes sent again are the same upload (idempotent); a different package under a used version is refused, and a key stays with one business or the marketplace
    const existing = await this.store.findByKeyVersion(m.id, m.version);
    if (existing) {
      if (existing.deletedAt) throw themeError(409, 'THEME_VERSION_EXISTS', `Version ${m.version} of ${m.id} was deleted and its number stays taken. Upload a higher version.`);
      if (existing.contentHash === r.contentHash && existing.privateVendorId === vendorId) return { theme: themeView(existing), replayed: true };
      throw themeError(409, 'THEME_VERSION_EXISTS', `Version ${m.version} of ${m.id} already exists with different content. Upload a higher version.`);
    }
    const latest = (await this.store.list({ key: m.id }, 0, 1)).items[0];
    if (latest) {
      if (latest.privateVendorId !== vendorId && !(latest.visibility === 'PUBLIC' && vendorId === null)) throw themeError(409, 'THEME_KEY_RESERVED', `The key ${m.id} already belongs to ${latest.visibility === 'PRIVATE' ? 'one business' : 'the marketplace'}. Choose another key.`);
      if (m.version <= latest.version) throw themeError(409, 'THEME_VERSION_EXISTS', `The newest stored version of ${m.id} is ${latest.version}. Upload a higher version.`);
    }
    const mk = m.marketplace!;
    const audit: AuditSpec = { actor, action: 'theme.upload', before: null, after: { key: m.id, version: m.version, status: 'DRAFT', visibility: vendorId ? 'PRIVATE' : 'PUBLIC', privateVendorId: vendorId, contentHash: r.contentHash, sizeBytes: zip.length } };
    const created = await this.store.create({
      key: m.id, version: m.version, name: m.name, description: m.description ?? null, tier: m.tier, status: 'DRAFT', visibility: vendorId ? 'PRIVATE' : 'PUBLIC', privateVendorId: vendorId, sourceVendorId: vendorId,
      starter: mk.starter === true, licence: mk.licence ?? '', tracks: m.tracks, packs: mk.packs, addons: mk.addons ?? [], capabilities: mk.capabilities ?? [], tags: mk.tags ?? [], catalogueCategories: mk.catalogueCategories ?? [], kitCategories: m.categories,
      manifest: m, contentHash: r.contentHash, sizeBytes: zip.length, fileCount: Object.keys(r.files).length, consentObtained: null, consentNote: null, createdByType: actor.type, createdById: actor.id, bytes: zip,
    }, audit);
    if (!created) throw themeError(409, 'THEME_VERSION_EXISTS', `Version ${m.version} of ${m.id} was just uploaded by someone else.`);
    return { theme: themeView(created), replayed: false };
  }

  private async mustFind(id: string): Promise<ThemeRow> {
    const r = typeof id === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(id) ? await this.store.find(id) : null;
    if (!r) throw themeError(404, 'THEME_NOT_FOUND', 'That theme was not found.');
    return r;
  }

  async get(id: string) { return themeView(await this.mustFind(id)); }

  /**
   * Deletes a whole theme, named by any one of its versions: every version and every stored package file, together or not at all, with one audit row. Allowed only for a theme that never went live and
   * is not, and never was, a business's (409 THEME_DELETE_BLOCKED with the reason otherwise). The records are stamped, not removed; the package files are emptied and cannot be brought back.
   */
  async remove(id: string, actor: Actor) {
    const cur = await this.mustFind(id);
    const versions = (await this.store.list({ key: cur.key }, 0, 1000)).items.sort((a, b) => a.version - b.version);
    const reason: ThemeDeleteBlock | null = versionsDeleteBlock(versions) ?? ((await this.store.keyUsedByVendor(cur.key)) ? 'USED_BY_BUSINESS' : null);
    if (reason) throw themeError(409, 'THEME_DELETE_BLOCKED', THEME_DELETE_BLOCK_MESSAGES[reason], { reason });
    const numbers = versions.map((v) => v.version);
    const done = await this.store.softDeleteTheme(cur.key, versions.map((v) => v.id), { deletedAt: this.clock(), deletedById: actor.id }, {
      actor, action: 'theme.delete',
      before: { key: cur.key, name: cur.name, versions: versions.map((v) => ({ id: v.id, version: v.version, status: v.status, contentHash: v.contentHash, sizeBytes: v.sizeBytes })) },
      after: { deleted: true, key: cur.key, versions: numbers, filesRemoved: numbers.length },
    });
    if (!done) throw themeError(409, 'THEME_STATE_INVALID', 'The theme was changed by someone else; reload and try again.');
    await this.notifier.notify();
    return { deleted: true, id: cur.id, key: cur.key, versions: numbers };
  }

  async list(filter: ThemeFilter, page = 1, pageSize = 25) {
    this.checkFilter(filter);
    const take = Math.min(Math.max(pageSize, 1), 100); const skip = (Math.max(page, 1) - 1) * take;
    const r = await this.store.list(filter, skip, take);
    return { items: r.items.map(themeView), total: r.total, page: Math.max(page, 1), pageSize: take };
  }

  /** A filter value that is not a real status, pack, add-on, capability or tag is a plain refusal, not an empty list that looks like "nothing there". */
  checkFilter(f: ThemeFilter): void {
    const bad = (name: string): never => { throw themeError(400, 'THEME_FILTER_INVALID', `The filter "${name}" has a value that is not recognised.`); };
    if (f.status && !THEME_STATUSES.includes(f.status)) bad('status');
    if (f.visibility && !['PUBLIC', 'PRIVATE'].includes(f.visibility)) bad('visibility');
    if (f.pack && !PACK_KEYS.includes(f.pack)) bad('pack');
    if (f.addon && !ADDON_KEYS.includes(f.addon)) bad('addon');
    if (f.capability && !CAPABILITY_KEYS.includes(f.capability)) bad('capability');
    if (f.tag && !(f.tag in COMBINATION_TAGS)) bad('tag');
    if (f.tier && !['Standard', 'Premium'].includes(f.tier)) bad('tier');
  }

  private async move(id: string, actor: Actor, from: readonly ThemeStatus[], to: ThemeStatus, action: string, extra: Partial<Parameters<ThemeMarketStore['transition']>[2]> = {}, older?: { key: string; below: number }, after: Record<string, unknown> = {}) {
    const cur = await this.mustFind(id);
    if (!from.includes(cur.status)) throw themeError(409, 'THEME_STATE_INVALID', `A theme that is ${cur.status} cannot be moved to ${to}.`, { status: cur.status });
    const now = this.clock();
    const stamps = to === 'REVIEW' ? { submittedAt: now } : to === 'PUBLISHED' ? { publishedAt: now } : to === 'ARCHIVED' ? { archivedAt: now } : {};
    const updated = await this.store.transition(id, from, { status: to, ...stamps, ...extra }, { actor, action, before: { status: cur.status }, after: { status: to, key: cur.key, version: cur.version, ...after } }, older);
    if (!updated) throw themeError(409, 'THEME_STATE_INVALID', 'The theme was changed by someone else; reload and try again.');
    return updated;
  }

  async submit(id: string, actor: Actor) { return themeView(await this.move(id, actor, ['DRAFT'], 'REVIEW', 'theme.submit', { reviewNote: null })); }

  async returnToDraft(id: string, note: string, actor: Actor) {
    const n = String(note ?? '').trim();
    if (n.length < 3 || n.length > 300) throw themeError(400, 'THEME_STATE_INVALID', 'Say in 3 to 300 characters why the theme goes back to draft.');
    return themeView(await this.move(id, actor, ['REVIEW'], 'DRAFT', 'theme.return', { reviewNote: n, submittedAt: null }, undefined, { note: n }));
  }

  /** Publishing re-checks the stored bytes with every rule (the rules may have grown since the upload); only a package that still passes goes live. */
  async publish(id: string, actor: Actor) {
    const cur = await this.store.findWithBytes((await this.mustFind(id)).id);
    if (!cur) throw themeError(404, 'THEME_NOT_FOUND', 'That theme was not found.');
    if (cur.status !== 'REVIEW') throw themeError(409, 'THEME_STATE_INVALID', `A theme that is ${cur.status} cannot be published; only a theme in REVIEW can.`, { status: cur.status });
    const r = inspectPackage(this.kit, cur.bytes, { vendorId: cur.privateVendorId }, sha256);
    if (!r.ok) throw packageInvalid(r.problems, 'THEME_PUBLISH_BLOCKED', 409);
    const done = await this.move(id, actor, ['REVIEW'], 'PUBLISHED', 'theme.publish', { publishedById: actor.id }, { key: cur.key, below: cur.version }, { visibility: cur.visibility });
    await this.notifier.notify();
    return themeView(done);
  }

  async archive(id: string, actor: Actor) {
    const done = await this.move(id, actor, ['DRAFT', 'REVIEW', 'PUBLISHED'], 'ARCHIVED', 'theme.archive');
    await this.notifier.notify();
    return themeView(done);
  }

  /**
   * M4: a theme made for ONE business (PRIVATE, already PUBLISHED for it) is released to the marketplace for its packs and categories. Three things must hold, each with its own answer:
   *  1. the admin records that the customer agreed (a yes and a short note on how; both are audited; no legal wording is written here), else 409 THEME_CONSENT_REQUIRED;
   *  2. the package carries nothing of that business: its name, its addresses, its phone, its e-mail, or any of its own media files (by hash), else 409 THEME_PRIVATE_CONTENT listing each file;
   *  3. every other package rule still passes.
   * The database repeats rule 1 (a published theme made for a customer needs the recorded consent). The theme keeps its key and version, so the business that uses it keeps it, and everyone else may now choose it.
   * The provenance (sourceVendorId) stays on the row for the audit trail only: no vendor or public route ever returns it.
   */
  async publishToMarketplace(id: string, consent: { consentObtained?: boolean; consentNote?: string }, actor: Actor) {
    const cur = await this.store.findWithBytes((await this.mustFind(id)).id);
    if (!cur) throw themeError(404, 'THEME_NOT_FOUND', 'That theme was not found.');
    if (cur.visibility !== 'PRIVATE' || !cur.privateVendorId) throw themeError(409, 'THEME_STATE_INVALID', 'Only a theme made for one business can be published to the marketplace this way.', { status: cur.status });
    if (cur.status !== 'PUBLISHED') throw themeError(409, 'THEME_STATE_INVALID', `The theme is ${cur.status}; publish it for its business first, then release it to the marketplace.`, { status: cur.status });
    if (consent.consentObtained !== true) throw themeError(409, 'THEME_CONSENT_REQUIRED', 'Record that the customer agreed before this theme goes to the marketplace.');
    const note = String(consent.consentNote ?? '').trim();
    if (note.length < 3 || note.length > 500) throw themeError(409, 'THEME_CONSENT_REQUIRED', 'Add a short note on how the customer agreed (3 to 500 characters).');

    const vendorId = cur.sourceVendorId ?? cur.privateVendorId;
    const facts = await this.store.vendorFacts(vendorId);
    const forbidden: Array<{ label: string; value: string }> = [];
    if (facts) {
      if (facts.name) forbidden.push({ label: 'name', value: facts.name });
      if (facts.email) forbidden.push({ label: 'e-mail address', value: facts.email });
      if (facts.phone) forbidden.push({ label: 'phone', value: facts.phone });
      if (facts.subdomain) forbidden.push({ label: 'web address', value: `${facts.subdomain}.get4domain.` });
      if (facts.customDomain) forbidden.push({ label: 'web address', value: facts.customDomain });
    }
    const r = inspectPackage(this.kit, cur.bytes, { vendorId, forbiddenText: forbidden, forbiddenAssetHashes: new Set(facts?.mediaHashes ?? []) }, sha256);
    if (!r.ok) throw packageInvalid(r.problems, r.problems.some((p) => p.source === 'content' && /vendor/.test(p.rule)) ? 'THEME_PRIVATE_CONTENT' : 'THEME_PUBLISH_BLOCKED', 409);

    const now = this.clock();
    const updated = await this.store.transition(id, ['PUBLISHED'], { visibility: 'PUBLIC', privateVendorId: null, consentObtained: true, consentNote: note, consentAt: now, consentById: actor.id },
      { actor, action: 'theme.publish_to_marketplace', before: { visibility: 'PRIVATE' }, after: { visibility: 'PUBLIC', key: cur.key, version: cur.version, sourceVendorId: cur.sourceVendorId, consentObtained: true, consentNote: note } },
      { key: cur.key, below: cur.version });
    if (!updated) throw themeError(409, 'THEME_STATE_INVALID', 'The theme was changed by someone else; reload and try again.');
    await this.notifier.notify();
    return themeView(updated);
  }
}
