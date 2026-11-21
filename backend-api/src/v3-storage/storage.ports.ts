import { createHash } from 'crypto';
import { publicUrlFor } from './core/storage-core';
import { MediaStoragePort } from '../v3-website/media/media.ports';

/**
 * The private object store (Amendment 12 Q2): identity documents and other files that are never public. Reads happen only through `signedGetUrl` (short-lived) or `get` (server side, for
 * the reviewer path). The public store is the existing MediaStoragePort (put returns the custom media domain URL), so media code does not change.
 */
export interface PrivatePutMeta { contentType: string; metadata: Record<string, string> }
export abstract class PrivateObjectStore {
  abstract put(key: string, bytes: Buffer, meta: PrivatePutMeta): Promise<void>;
  abstract get(key: string): Promise<Buffer | null>;
  abstract remove(key: string): Promise<void>;
  abstract signedGetUrl(key: string, ttlSeconds: number): Promise<string>;
}

/** A virus scanner for files that are not pictures. A picture is decoded and re-encoded instead, which drops anything that is not pixels. */
export abstract class ContentScanPort {
  /** true = clean. Throws when the scanner cannot be reached. */
  abstract isClean(bytes: Buffer): Promise<boolean>;
}
/** Until a scanner is bound a non-picture is refused (see PrivateFilesService), never stored unscanned. */
export class NoScanner extends ContentScanPort {
  async isClean(): Promise<boolean> { throw new Error('no scanner'); }
}
export class FakeScanner extends ContentScanPort {
  scanned = 0; infected = false;
  async isClean(): Promise<boolean> { this.scanned++; return !this.infected; }
}

export type AccessAction = 'PUT' | 'GET' | 'SIGN' | 'DELETE' | 'DENIED';
export interface AccessEntry { vendorId: string | null; bucket: 'PRIVATE'; objectKey: string; action: AccessAction; actorType: string; actorId: string | null; purpose: string | null }
export interface AccessRow extends AccessEntry { id: string; createdAt: Date }
/** The access log of the private bucket: append-only (a database trigger refuses update and delete). Written BEFORE the content is returned. */
export abstract class StorageAccessStore {
  abstract record(e: AccessEntry, at: Date): Promise<void>;
  abstract list(vendorId: string, skip: number, take: number): Promise<{ items: AccessRow[]; total: number }>;
}

export class FakePrivateStore extends PrivateObjectStore {
  files = new Map<string, { bytes: Buffer; contentType: string; metadata: Record<string, string> }>();
  signed: Array<{ key: string; ttl: number }> = [];
  failNextPut = false;
  async put(key: string, bytes: Buffer, meta: PrivatePutMeta): Promise<void> { if (this.failNextPut) { this.failNextPut = false; throw new Error('provider down'); } this.files.set(key, { bytes, contentType: meta.contentType, metadata: meta.metadata }); }
  async get(key: string): Promise<Buffer | null> { return this.files.get(key)?.bytes ?? null; }
  async remove(key: string): Promise<void> { this.files.delete(key); }
  async signedGetUrl(key: string, ttl: number): Promise<string> { this.signed.push({ key, ttl }); return `https://private.example.test/${key}?ttl=${ttl}&sig=${createHash('sha256').update(key).digest('hex').slice(0, 8)}`; }
}

export class FakePublicStore extends MediaStoragePort {
  files = new Map<string, { bytes: Buffer; contentType: string }>();
  constructor(private readonly base = 'https://media.example.test') { super(); }
  async put(path: string, bytes: Buffer, contentType: string): Promise<string> { this.files.set(path, { bytes, contentType }); return publicUrlFor(this.base, path); }
  async remove(path: string): Promise<void> { this.files.delete(path); }
}
