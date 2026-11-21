import { Injectable, Optional } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { ActivityService } from '../v3-activity/activity.service';
import { StorageSettingsService } from '../v3-storage/settings/storage-settings';
import { ImagePort, MediaStoragePort, sha256Hex } from '../v3-website/media/media.ports';
import { checkUpload, checkUploadAlt, isGroupToken, Scope, scopeKeyOf, UploadLimitsView, uploadKeyFor, uploadLimitsView } from './core/media-upload-core';
import { uploadError } from './media-upload.errors';
import { MediaRow, MediaUploadStore } from './media-upload.store';

export interface UploadedFile { buffer: Buffer; mimetype: string; size: number }
export interface MediaView { id: string; url: string; kind: string; contentType: string; bytes: number; width: number | null; height: number | null; altText: string | null; createdAt: string }
const view = (m: MediaRow): MediaView => ({ id: m.id, url: m.url, kind: m.kind, contentType: m.contentType, bytes: m.bytes, width: m.width, height: m.height, altText: m.altText, createdAt: m.createdAt.toISOString() });

/**
 * Uploads of pictures and documents (Wave 2 Part D). Order of checks: uploads are switched on (size, pixel and type caps are staff settings, off until set), something was sent, it is within the byte cap, its BYTES
 * are an allowed type that matches the type claimed, nothing active is inside an SVG or a PDF, a picture has its description. A picture is then decoded and re-encoded (metadata such as location is dropped, the size is read).
 * The storage key is built from ids the server holds and the content hash; the file's own name is never used. The same file twice is one row. Real storage is the R2 adapter, which refuses until its settings and keys exist.
 */
@Injectable()
export class MediaUploadService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly store: MediaUploadStore, private readonly storage: MediaStoragePort, private readonly image: ImagePort, private readonly settings: StorageSettingsService,
    @Optional() private readonly activity?: ActivityService,
  ) {}

  private async record(actor: Actor, vendorId: string | null, actionKey: string, id: string, summary: Record<string, unknown>): Promise<void> {
    if (actor.type === 'STAFF') await this.activity?.record({ vendorId, actor: { type: actor.type, id: actor.id, ip: actor.ip ?? null }, actionKey, entityType: 'media', entityId: id, summary });
  }

  /** K2: the caps a screen checks a file against before sending it (staff settings, the same ones `upload` enforces). Read only. */
  async limits(): Promise<UploadLimitsView> { return uploadLimitsView(await this.settings.get()); }

  async upload(scope: Scope, actor: Actor, file: UploadedFile | undefined, alt: unknown, group?: unknown): Promise<MediaView> {
    if (group !== undefined && group !== null && group !== '' && (scope.kind !== 'DRAFT' || !isGroupToken(group))) throw uploadError('UPLOAD_INVALID', 'The upload group is 16 to 64 letters, digits, dashes or underscores, and only a draft upload has one.', { fields: { group: 'Not a valid upload group.' } });
    const groupToken = typeof group === 'string' && group !== '' ? group : null;
    const s = await this.settings.get();
    const bytes = file?.buffer ?? Buffer.alloc(0);
    const c = checkUpload(s, { bytes, declared: String(file?.mimetype ?? '') });
    if (!c.ok) throw uploadError(c.code, c.message);
    const a = checkUploadAlt(c.detected.kind, alt);
    if (!a.ok) throw uploadError('UPLOAD_ALT_INVALID', a.message, { fields: { alt: a.message } });
    let body = bytes; let width: number | null = null; let height: number | null = null; let contentType: string = c.detected.contentType;
    if (c.detected.kind === 'IMAGE' && c.detected.contentType !== 'image/svg+xml') {
      try { const out = await this.image.reencode(bytes, { maxPixels: s.mediaUploadMaxPixels! }); body = out.bytes; width = out.width; height = out.height; contentType = out.contentType; }
      catch { throw uploadError('UPLOAD_INVALID', 'That file could not be read as a picture, or it is too large in pixels.'); }
      if (body.length > s.mediaUploadMaxBytes!) throw uploadError('UPLOAD_TOO_LARGE', 'That file is too large.');
    }
    const scopeKey = scopeKeyOf(scope); const sha = sha256Hex(body);
    const key = uploadKeyFor(scope, sha, c.detected.ext);
    const have = await this.store.findBySha(scopeKey, sha);
    if (have && have.status === 'ACTIVE') { if (groupToken && have.groupToken !== groupToken) { await this.store.setGroup(scopeKey, have.id, groupToken); return view({ ...have, groupToken }); } return view(have); }
    const url = await this.storage.put(key, body, contentType);   // a removed file is put back; the same key and the same bytes
    if (have) { const revived = await this.store.revive(scopeKey, have.id, a.alt); if (revived) { if (groupToken) await this.store.setGroup(scopeKey, revived.id, groupToken); await this.record(actor, revived.vendorId, 'media.uploaded', revived.id, { kind: revived.kind, contentType: revived.contentType, bytes: revived.bytes, revived: true }); return view(revived); } }
    const row = await this.store.create({
      vendorId: scope.kind === 'VENDOR' ? scope.vendorId : null, scopeKey, ownerKind: scope.kind === 'VENDOR' ? 'VENDOR_SITE' : 'LISTING_DRAFT', kind: c.detected.kind, contentType, bytes: body.length, sha256: sha, width, height, key, url, altText: a.alt,
      uploadedByType: actor.type, uploadedById: actor.id, groupToken,
    });
    await this.record(actor, row.vendorId, 'media.uploaded', row.id, { kind: row.kind, contentType: row.contentType, bytes: row.bytes });
    return view(row);
  }

  /** Staff upload for a listing made on behalf: the file goes into the library of the business behind it (the vendor shell exists from the moment the listing is made). */
  async uploadForListing(seededSiteId: string, actor: Actor, file: UploadedFile | undefined, alt: unknown): Promise<MediaView> {
    const vendorId = await this.store.vendorOfListing(String(seededSiteId).slice(0, 64));
    if (!vendorId) throw uploadError('UPLOAD_LISTING_NOT_FOUND', 'That listing was not found.');
    return this.upload({ kind: 'VENDOR', vendorId }, actor, file, alt);
  }

  /**
   * Attaches the staff member's draft uploads of one upload group to a listing (or a business). IDEMPOTENT, and tenant safe on both sides: only drafts THIS staff member made under THIS token move, only into a business
   * that is a live listing, and a second call moves nothing and says what is already there. Storage is not touched (the object keeps its key); a draft the business already has is dropped as a duplicate.
   */
  async attachGroup(group: unknown, actor: Actor, target: { seededSiteId?: string; vendorId?: string }): Promise<{ attached: number; skipped: number; alreadyAttached: number; items: MediaView[] }> {
    if (!isGroupToken(group)) throw uploadError('UPLOAD_INVALID', 'The upload group is not valid.', { fields: { group: 'Not a valid upload group.' } });
    if (actor.type !== 'STAFF' || !actor.id) throw uploadError('UPLOAD_NOT_FOUND', 'That file was not found.');
    const vendorId = target.vendorId ?? (target.seededSiteId ? await this.store.vendorOfListing(String(target.seededSiteId).slice(0, 64)) : null);
    if (!vendorId) throw uploadError('UPLOAD_LISTING_NOT_FOUND', 'That listing was not found.');
    const r = await this.store.attachDrafts(actor.id, group, vendorId, this.clock());
    for (const m of r.skipped) await this.storage.remove(m.key).catch(() => undefined);   // a duplicate draft object is no longer needed
    if (r.attached.length || r.skipped.length) await this.record(actor, vendorId, 'media.attached', vendorId, { attached: r.attached.length, skipped: r.skipped.length });
    return { attached: r.attached.length, skipped: r.skipped.length, alreadyAttached: r.alreadyAttached, items: r.attached.map(view) };
  }

  async list(scope: Scope, page = 1, pageSize = 25): Promise<{ items: MediaView[]; total: number; page: number; pageSize: number }> {
    const p = Math.max(1, Math.floor(Number(page)) || 1); const n = Math.min(100, Math.max(1, Math.floor(Number(pageSize)) || 25));
    const r = await this.store.list(scopeKeyOf(scope), (p - 1) * n, n);
    return { items: r.items.map(view), total: r.total, page: p, pageSize: n };
  }
  async listForListing(seededSiteId: string, page?: number, pageSize?: number) {
    const vendorId = await this.store.vendorOfListing(String(seededSiteId).slice(0, 64));
    if (!vendorId) throw uploadError('UPLOAD_LISTING_NOT_FOUND', 'That listing was not found.');
    return this.list({ kind: 'VENDOR', vendorId }, page, pageSize);
  }

  async remove(scope: Scope, id: string, actor: Actor): Promise<{ removed: true }> {
    const scopeKey = scopeKeyOf(scope); const m = await this.store.get(scopeKey, id);
    if (!m || m.status !== 'ACTIVE') throw uploadError('UPLOAD_NOT_FOUND', 'That file was not found.');
    await this.store.softRemove(scopeKey, id, this.clock());
    await this.storage.remove(m.key);
    await this.record(actor, m.vendorId, 'media.removed', m.id, { kind: m.kind });
    return { removed: true };
  }
  async removeForListing(seededSiteId: string, id: string, actor: Actor) {
    const vendorId = await this.store.vendorOfListing(String(seededSiteId).slice(0, 64));
    if (!vendorId) throw uploadError('UPLOAD_LISTING_NOT_FOUND', 'That listing was not found.');
    return this.remove({ kind: 'VENDOR', vendorId }, id, actor);
  }
}
