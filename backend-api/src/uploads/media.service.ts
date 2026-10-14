import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { SITE_PLAN_LIMITS, SitePlan } from '../site-doc/site-doc.constants';
import { MAX_UPLOAD_BYTES, detectImage, svgIsSafe, uploadsDir } from './uploads.util';

export type MediaKind = 'LOGO' | 'BANNER' | 'GALLERY' | 'PRODUCT' | 'ABOUT' | 'FAVICON' | 'OG' | 'OTHER';
export const MEDIA_KINDS: readonly MediaKind[] = ['LOGO', 'BANNER', 'GALLERY', 'PRODUCT', 'ABOUT', 'FAVICON', 'OG', 'OTHER'];

/** The longest side, in pixels, each kind of picture is shrunk to for the web. The untouched original is always kept as well. */
const MAX_SIDE: Record<MediaKind, number> = { LOGO: 800, BANNER: 2000, GALLERY: 1600, PRODUCT: 1400, ABOUT: 1600, FAVICON: 256, OG: 1200, OTHER: 1600 };

/** Shrink a picture to its web size and drop camera and location data (the original must be kept separately by the caller). Throws if the bytes cannot be read. */
export async function cleanForWeb(buf: Buffer, ext: '.png' | '.jpg' | '.webp', kind: MediaKind): Promise<{ data: Buffer; width: number; height: number }> {
  const img = sharp(buf, { failOn: 'error' }).rotate().resize({ width: MAX_SIDE[kind], height: MAX_SIDE[kind], fit: 'inside', withoutEnlargement: true });
  const out = ext === '.png' ? img.png({ compressionLevel: 9 }) : ext === '.webp' ? img.webp({ quality: 85 }) : img.jpeg({ quality: 85, mozjpeg: true });
  const res = await out.toBuffer({ resolveWithObject: true });
  return { data: res.data, width: res.info.width, height: res.info.height };
}

/** Write a file into the public uploads folder under a unique name and return the name. The only function that writes there. */
export function writeUpload(buf: Buffer, ext: string, suffix = '', prefix = ''): string {
  const dir = uploadsDir();
  const name = `${prefix}${Date.now()}_${randomBytes(6).toString('hex')}${suffix}${ext}`;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), buf);
  return name;
}

export interface StoredImage { url: string; originalUrl: string; mime: string; bytes: number; width: number | null; height: number | null; favicon?: string; ogImage?: string }

const mb = (n: number): string => `${(n / 1024 / 1024).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)} MB`;

/**
 * The ONE place an image is accepted, checked, cleaned, resized, stored and counted. Every image upload in the product goes through this service
 * (a guard test fails if an endpoint stores a file any other way). Rules (Website Manager, Phase 3):
 *  - png, jpg and webp are accepted; gif is kept as it is; svg only when it carries no script or outside reference, otherwise refused in plain words
 *  - the bytes decide the type, never the file name; 5 MB per image, said with the real size
 *  - location and camera data are removed; the picture is turned upright first; PNG transparency is kept
 *  - a web-sized copy is made for the site and the original is kept untouched; a logo also gives a favicon and a share image
 *  - the vendor's plan limits the total stored; every message says what to do next
 */
@Injectable()
export class MediaService {
  private readonly log = new Logger(MediaService.name);
  constructor(private readonly prisma: PrismaService) {}

  async planMediaMb(vendorId: string): Promise<number> {
    const term = await this.prisma.billingTerm.findFirst({ where: { vendorId, isCurrent: true, status: { in: ['ACTIVE', 'ACTIVE_PAYMENT_DUE', 'LAPSED'] } }, select: { planKey: true } });
    const plan: SitePlan = term?.planKey === 'BOS' ? 'BOS' : term?.planKey === 'WORKSPACE' ? 'WORKSPACE' : 'LEADSPACE';
    return SITE_PLAN_LIMITS[plan].mediaMb;
  }

  /** Throws a plain-sentence BadRequest when the file cannot be used. */
  check(file: { buffer?: Buffer; size?: number; originalname?: string } | undefined): { buffer: Buffer; ext: '.png' | '.jpg' | '.gif' | '.webp' | '.svg'; mime: string } {
    if (!file || !file.buffer || file.buffer.length === 0) throw new BadRequestException('No picture was received. Choose a file and try again.');
    const size = file.size ?? file.buffer.length;
    if (size > MAX_UPLOAD_BYTES) throw new BadRequestException(`This file is ${mb(size)}. Upload one under 5 MB (a photo saved at a smaller size, or exported as JPG, is usually enough).`);
    const found = detectImage(file.buffer);
    if (!found) throw new BadRequestException('This file is not a picture we can use. Upload a PNG, JPG or WebP image.');
    if (found.ext === '.svg' && !svgIsSafe(file.buffer.toString('utf8'))) throw new BadRequestException('This SVG contains scripts or links to other sites, so we cannot use it. Export it as a PNG and upload that.');
    return { buffer: file.buffer, ext: found.ext, mime: found.mime };
  }

  private save(buf: Buffer, ext: string, suffix = ''): string {
    let name: string;
    try {
      name = writeUpload(buf, ext, suffix);
    } catch (e) {
      this.log.error(`Could not write upload to ${uploadsDir()}: ${e instanceof Error ? e.message : String(e)}`);
      throw new InternalServerErrorException('The picture could not be saved on our server. Please try again in a moment; if it keeps failing, contact support.');
    }
    return name;
  }

  private publicUrl(name: string, base: string): string { return `${base}/uploads/${name}`; }

  async store(vendorId: string, kind: MediaKind, file: { buffer?: Buffer; size?: number; originalname?: string }, base: string): Promise<StoredImage> {
    const checked = this.check(file);
    const [limitMb, used] = await Promise.all([this.planMediaMb(vendorId), this.prisma.mediaAsset.aggregate({ where: { vendorId }, _sum: { originalBytes: true, bytes: true } })]);
    const usedBytes = (used._sum.bytes ?? 0) + (used._sum.originalBytes ?? 0);
    if (usedBytes + checked.buffer.length * 2 > limitMb * 1024 * 1024) {
      throw new BadRequestException(`Your plan includes ${limitMb} MB of pictures and ${mb(usedBytes)} is used. Remove pictures you no longer need, or upgrade your plan for more space.`);
    }

    let web = checked.buffer; let width: number | null = null; let height: number | null = null; let webExt: string = checked.ext; let mime = checked.mime;
    if (checked.ext !== '.svg' && checked.ext !== '.gif') {
      try {
        const res = await cleanForWeb(checked.buffer, checked.ext, kind);
        web = res.data; width = res.width; height = res.height;
      } catch {
        throw new BadRequestException('This picture could not be read. It may be damaged. Open it on your phone or computer, save it again as a PNG or JPG, and upload the new file.');
      }
    } else if (checked.ext === '.gif') { webExt = '.gif'; }
    if (checked.ext === '.jpg') mime = 'image/jpeg';

    const webName = this.save(web, webExt);
    const originalName = this.save(checked.buffer, checked.ext, '_original');
    const out: StoredImage = { url: this.publicUrl(webName, base), originalUrl: this.publicUrl(originalName, base), mime, bytes: web.length, width, height };
    await this.prisma.mediaAsset.create({ data: { vendorId, kind, url: out.url, originalUrl: out.originalUrl, mime, bytes: web.length, originalBytes: checked.buffer.length, width, height } });

    // a logo also gives the small icon for browser tabs and the picture that shows when the site is shared
    if (kind === 'LOGO' && checked.ext !== '.svg' && checked.ext !== '.gif') {
      try {
        const icon = await sharp(checked.buffer).rotate().resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
        const share = await sharp(checked.buffer).rotate().resize(1200, 630, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer();
        const iconName = this.save(icon, '.png', '_favicon'); const shareName = this.save(share, '.jpg', '_og');
        out.favicon = this.publicUrl(iconName, base); out.ogImage = this.publicUrl(shareName, base);
        await this.prisma.mediaAsset.createMany({ data: [
          { vendorId, kind: 'FAVICON', url: out.favicon, mime: 'image/png', bytes: icon.length, originalBytes: 0, width: 64, height: 64 },
          { vendorId, kind: 'OG', url: out.ogImage, mime: 'image/jpeg', bytes: share.length, originalBytes: 0, width: 1200, height: 630 },
        ] });
      } catch (e) { this.log.warn(`favicon/share image not made: ${e instanceof Error ? e.message : String(e)}`); }
    }
    return out;
  }
}
