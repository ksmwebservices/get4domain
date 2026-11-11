import { Injectable } from '@nestjs/common';
import { Actor } from '../../plans/admin/audit.service';
import { detectImage } from '../../uploads/uploads.util';
import { bannerChoices, checkAlt, checkUpload, storagePathFor } from '../core/media-core';
import { WebsiteSettingsService } from '../settings/website-settings.service';
import { mediaProblem } from '../website.errors';
import { WebsiteService } from '../website.service';
import { ImagePort, MediaStoragePort, sha256Hex } from './media.ports';
import { BannerRow, MediaStore, PictureRow } from './media.store';

export interface UploadedFile { buffer: Buffer; mimetype: string; size: number }
export interface PictureView { id: string; url: string; altText: string; width: number; height: number; contentType: string; bytes: number; createdAt: string }
const view = (p: PictureRow): PictureView => ({ id: p.id, url: p.url, altText: p.altText, width: p.width, height: p.height, contentType: p.contentType, bytes: p.bytes, createdAt: p.createdAt.toISOString() });

/**
 * The media library (slice 5.5b). Order of checks: the caps are set, alt text is given, the file is within the caps and its BYTES are an allowed picture type that matches its label,
 * then it is re-encoded (metadata dropped, size read), stored under vendors/<vendorId>/, and recorded. The same picture uploaded twice is one row. Staff upload for a vendor with the
 * same rules; the route is under /v3/admin/vendors/:id/, which the activity log records against that vendor with the staff member as the actor.
 */
@Injectable()
export class MediaService {
  clock: () => Date = () => new Date();
  constructor(private readonly store: MediaStore, private readonly storage: MediaStoragePort, private readonly image: ImagePort, private readonly settings: WebsiteSettingsService, private readonly web: WebsiteService) {}

  async upload(vendorId: string, actor: Actor, file: UploadedFile | undefined, alt: unknown): Promise<PictureView> {
    const s = await this.settings.get();
    if (s.mediaMaxBytes === null || s.mediaAllowedTypes === null || s.mediaMaxPixels === null) throw mediaProblem('MEDIA_NOT_CONFIGURED', 'Picture uploads are not switched on yet.');
    const a = checkAlt(alt);
    if (!a.ok) throw mediaProblem(a.code, a.message, 'alt');
    const bytes = file?.buffer ?? Buffer.alloc(0);
    const bad = checkUpload(s, { size: bytes.length, declared: String(file?.mimetype ?? ''), detected: detectImage(bytes)?.mime ?? null });
    if (bad) throw mediaProblem(bad.code, bad.message, 'file');
    let out;
    try { out = await this.image.reencode(bytes, { maxPixels: s.mediaMaxPixels }); } catch { throw mediaProblem('MEDIA_INVALID', 'That file could not be read as a picture, or it is too large in pixels.', 'file'); }
    if (out.bytes.length > s.mediaMaxBytes) throw mediaProblem('MEDIA_TOO_LARGE', 'That picture is too large.', 'file');
    const sha = sha256Hex(out.bytes);
    const have = await this.store.findPictureBySha(vendorId, sha);
    if (have) { if (!have.deletedAt) return view(have); const revived = await this.store.revivePicture(vendorId, have.id, a.alt); if (revived) return view(revived); }
    const path = storagePathFor(vendorId, sha, out.contentType);
    const url = await this.storage.put(path, out.bytes, out.contentType);
    const row = await this.store.createPicture({ vendorId, storagePath: path, url, contentType: out.contentType, bytes: out.bytes.length, width: out.width, height: out.height, altText: a.alt, sha256: sha, uploadedByType: actor.type, uploadedById: actor.id });
    return view(row);
  }

  async list(vendorId: string): Promise<PictureView[]> { return (await this.store.listPictures(vendorId)).map(view); }

  /** A picture the draft or the live site uses cannot be removed; remove it from the page first. */
  async remove(vendorId: string, id: string): Promise<{ removed: true }> {
    const p = await this.store.getPicture(vendorId, id);
    if (!p) throw mediaProblem('MEDIA_NOT_FOUND', 'That picture does not exist.');
    if (await this.web.usesUrl(vendorId, p.url)) throw mediaProblem('MEDIA_IN_USE', 'That picture is used on your site. Take it off the page first.');
    await this.store.softDeletePicture(vendorId, id, this.clock());
    await this.storage.remove(p.storagePath);
    return { removed: true };
  }
}

export interface BannerVendorView { id: string; url: string; altText: string; width: number; height: number; hasPeople: boolean }
export interface BannerAdminView extends BannerVendorView { categoryId: string; sourceUrl: string; author: string; licenceName: string; obtainedOn: string; active: boolean; contentType: string; bytes: number }
const vendorView = (b: BannerRow): BannerVendorView => ({ id: b.id, url: b.url, altText: b.altText, width: b.width, height: b.height, hasPeople: b.hasPeople });
const adminView = (b: BannerRow): BannerAdminView => ({ ...vendorView(b), categoryId: b.categoryId, sourceUrl: b.sourceUrl, author: b.author, licenceName: b.licenceName, obtainedOn: b.obtainedOn, active: b.active, contentType: b.contentType, bytes: b.bytes });

/** The Banner Library (slice 5.5b): reference banners per category chosen by staff, selectable by the vendor and by staff for a vendor. Choosing one writes the hero picture and its description into the draft. */
@Injectable()
export class BannerLibraryService {
  constructor(private readonly store: MediaStore, private readonly web: WebsiteService) {}

  /** The active banners of the vendor's own category. Healthcare and legal-finance see only banners without identifiable people unless staff ask for all. */
  async forVendor(vendorId: string, o: { includePeople?: boolean } = {}): Promise<BannerVendorView[]> {
    const who = await this.web.categoryOf(vendorId);
    if (!who) return [];
    return bannerChoices(await this.store.listBanners({ categoryId: who.categoryId, activeOnly: true }), who, o).map(vendorView);
  }

  /** The vendor picks a banner. Free vendors' picks go through the same review as any Free edit (they are saved to the draft; Submit for review sends them). */
  async select(vendorId: string, actor: Actor, bannerId: string, o: { staff?: boolean } = {}): Promise<{ banner: BannerVendorView; published: boolean }> {
    const who = await this.web.categoryOf(vendorId);
    const banner = await this.store.getBanner(bannerId);
    const allowed = who && banner ? bannerChoices([banner], who, { includePeople: o.staff === true }).length === 1 : false;
    if (!banner || !allowed) throw mediaProblem('BANNER_NOT_AVAILABLE', 'That banner is not available for your category.');
    await this.web.save(vendorId, actor, { kind: 'field', key: 'hero.image', value: banner.url });
    await this.web.save(vendorId, actor, { kind: 'field', key: 'hero.imageAlt', value: banner.altText });
    if (o.staff) { await this.web.publish(vendorId, actor, { staff: true }); return { banner: vendorView(banner), published: true }; }
    return { banner: vendorView(banner), published: false };
  }

  /** Staff screen: every banner with its source, author, licence and date obtained. */
  async adminList(f: { categoryId?: string }): Promise<BannerAdminView[]> { return (await this.store.listBanners({ categoryId: f.categoryId })).map(adminView); }

  async setActive(id: string, active: boolean): Promise<BannerAdminView> {
    const row = await this.store.setBannerActive(id, active);
    if (!row) throw mediaProblem('BANNER_NOT_AVAILABLE', 'That banner does not exist.');
    return adminView(row);
  }
}
