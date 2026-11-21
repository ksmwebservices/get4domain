import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { wmBody } from '../website.errors';

/**
 * The two ports behind media (slice 5.5b). StoragePort keeps the bytes; ImagePort re-encodes them. Real storage is a later release: until an adapter is bound, the module
 * binds UnconfiguredMediaStorage, which REFUSES instead of pretending to store (no provider call exists in this run). Tests use FakeMediaStorage.
 */
export abstract class MediaStoragePort {
  /** Stores the bytes at `path` and returns the public https URL. Putting the same path again replaces it. */
  abstract put(path: string, bytes: Buffer, contentType: string): Promise<string>;
  abstract remove(path: string): Promise<void>;
}

@Injectable()
export class UnconfiguredMediaStorage extends MediaStoragePort {
  async put(): Promise<string> { throw new ServiceUnavailableException(wmBody('STORAGE_NOT_CONFIGURED', 'Picture storage is not switched on yet.')); }
  async remove(): Promise<void> { /* nothing was ever stored */ }
}

export class FakeMediaStorage extends MediaStoragePort {
  files = new Map<string, { bytes: Buffer; contentType: string }>();
  puts: string[] = [];
  async put(path: string, bytes: Buffer, contentType: string): Promise<string> { this.puts.push(path); this.files.set(path, { bytes, contentType }); return `https://media.example.test/${path}`; }
  async remove(path: string): Promise<void> { this.files.delete(path); }
}

export interface ReencodedImage { bytes: Buffer; contentType: string; width: number; height: number }
export abstract class ImagePort {
  /** Decodes and re-encodes the picture in the same format (dropping every piece of metadata, such as location), and reports its size. Throws when the bytes are not a readable picture or exceed `maxPixels`. */
  abstract reencode(bytes: Buffer, o: { maxPixels: number }): Promise<ReencodedImage>;
}

const FORMAT_TYPE: Readonly<Record<string, string>> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };

/** sharp: local image processing, no network. `rotate()` applies the camera orientation and sharp writes no metadata unless asked to. */
@Injectable()
export class SharpImagePort extends ImagePort {
  async reencode(bytes: Buffer, o: { maxPixels: number }): Promise<ReencodedImage> {
    const img = sharp(bytes, { limitInputPixels: o.maxPixels, failOn: 'error' }).rotate();
    const meta = await sharp(bytes, { limitInputPixels: o.maxPixels, failOn: 'error' }).metadata();
    const format = meta.format ?? '';
    if (!FORMAT_TYPE[format]) throw new Error('unsupported');
    const out = await (format === 'png' ? img.png() : format === 'webp' ? img.webp({ quality: 85 }) : img.jpeg({ quality: 85, mozjpeg: true })).toBuffer({ resolveWithObject: true });
    return { bytes: out.data, contentType: FORMAT_TYPE[format], width: out.info.width, height: out.info.height };
  }
}

/** Deterministic stand-in for unit tests: keeps the bytes and reports a fixed size. Bytes that start with the text CORRUPT are "not a picture". */
export class FakeImagePort extends ImagePort {
  calls = 0;
  constructor(private readonly size = { width: 1200, height: 600 }) { super(); }
  async reencode(bytes: Buffer): Promise<ReencodedImage> {
    this.calls++;
    if (bytes.subarray(0, 7).toString('latin1') === 'CORRUPT') throw new Error('unreadable');
    const type = bytes[0] === 0xff ? 'image/jpeg' : bytes[0] === 0x52 ? 'image/webp' : 'image/png';
    return { bytes, contentType: type, ...this.size };
  }
}

export const sha256Hex = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
