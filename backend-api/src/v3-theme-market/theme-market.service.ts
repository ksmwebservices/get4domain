import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { Actor } from '../plans/admin/audit.service';
import { Kit, KIT, loadKit } from '../site-publish/renderer/renderer-loader';
import { inspectPackage, PackageContext, PackageProblem, PACK_KEYS, ADDON_KEYS, CAPABILITY_KEYS, COMBINATION_TAGS } from './core/theme-package-core';
import { ThemeChangeNotifier } from './theme-change-notifier';
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
 * transaction, and a publish or archive tells the runtime loader (M3) so no restart is needed. A row is never deleted.
 */
@Injectable()
export class ThemeMarketService {
  clock: () => Date = () => new Date();
  private readonly kit: Kit;
  constructor(private readonly store: ThemeMarketStore, private readonly notifier: ThemeChangeNotifier, @Optional() @Inject(KIT) kit?: Kit) { this.kit = kit ?? loadKit(); }

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
}
