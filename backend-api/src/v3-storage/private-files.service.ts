import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Actor } from '../plans/admin/audit.service';
import { ImagePort } from '../v3-website/media/media.ports';
import { MAX_SIGNED_URL_SECONDS, StorageSettingsService } from './settings/storage-settings';
import { PrivatePurpose, checkPrivateUpload, clampTtl, detectPrivateType, isPrivateKeyOf, privateKeyFor, retentionMetadata } from './core/storage-core';
import { ContentScanPort, PrivateObjectStore, StorageAccessStore } from './storage.ports';
import { storageError } from './storage.errors';

export interface PrivateFile { key: string; contentType: string; bytes: number }

/**
 * The private file service (Amendment 12 Q2 checklist). Order for an upload: settings are set, the file's BYTES are a PDF, JPEG or PNG that matches its label and is within the cap, then a picture is
 * decoded and re-encoded (metadata and anything that is not pixels dropped) while a PDF goes to the virus scanner (no scanner bound = refused, never stored unscanned), then it is stored with its
 * retention date as metadata. Every put, read, signed link and delete is written to the access log FIRST: if the row cannot be written, nothing is returned or changed.
 * The caller keeps its own encryption on top (registrar documents are AES-GCM sealed before they arrive here).
 */
@Injectable()
export class PrivateFilesService {
  clock: () => Date = () => new Date();
  constructor(private readonly store: PrivateObjectStore, private readonly access: StorageAccessStore, private readonly settings: StorageSettingsService, private readonly image: ImagePort, private readonly scanner: ContentScanPort) {}

  async put(vendorId: string, purpose: PrivatePurpose, actor: Actor, file: { buffer: Buffer; mimetype: string }, o: { retainUntil?: Date | null; purposeText?: string } = {}): Promise<PrivateFile> {
    const s = await this.settings.get();
    if (s.storagePrivateMaxBytes === null || s.storagePrivateMaxPixels === null) throw storageError(503, 'STORAGE_NOT_CONFIGURED', 'File storage is not switched on yet.');
    const type = detectPrivateType(file.buffer);
    const bad = checkPrivateUpload(s.storagePrivateMaxBytes, { size: file.buffer.length, declared: String(file.mimetype ?? ''), detected: type?.mime ?? null });
    if (bad) throw storageError(400, bad.code, bad.message);
    let bytes = file.buffer;
    if (type!.image) {
      try { bytes = (await this.image.reencode(file.buffer, { maxPixels: s.storagePrivateMaxPixels })).bytes; } catch { throw storageError(400, 'STORAGE_UNREADABLE', 'That picture could not be read.'); }
    } else {
      let clean: boolean;
      try { clean = await this.scanner.isClean(file.buffer); } catch { throw storageError(503, 'STORAGE_SCAN_UNAVAILABLE', 'This kind of file cannot be accepted right now.'); }
      if (!clean) throw storageError(400, 'STORAGE_TYPE_REFUSED', 'That file was refused.');
    }
    const key = privateKeyFor(vendorId, purpose, randomUUID());
    if (!key) throw storageError(400, 'STORAGE_KEY_INVALID', 'That file cannot be stored.');
    await this.log(vendorId, key, 'PUT', actor, o.purposeText ?? purpose);
    await this.store.put(key, bytes, { contentType: type!.mime, metadata: retentionMetadata(o.retainUntil ?? null, { purpose }) });
    return { key, contentType: type!.mime, bytes: bytes.length };
  }

  /** A short-lived link. The reason is required: it is what the access log shows next to the reader's name. */
  async signedUrl(vendorId: string, key: string, actor: Actor, reason: string, wantedSeconds?: number): Promise<{ url: string; expiresInSeconds: number }> {
    const s = await this.settings.get(); if (s.storageSignedUrlSeconds === null) throw storageError(503, 'STORAGE_NOT_CONFIGURED', 'File storage is not switched on yet.');
    this.ownKey(vendorId, key);
    const ttl = clampTtl(wantedSeconds, s.storageSignedUrlSeconds, MAX_SIGNED_URL_SECONDS);
    await this.log(vendorId, key, 'SIGN', actor, reason);
    return { url: await this.store.signedGetUrl(key, ttl), expiresInSeconds: ttl };
  }
  /** Server-side read (the reviewer path). Logged before the bytes are returned. */
  async read(vendorId: string, key: string, actor: Actor, reason: string): Promise<Buffer | null> {
    this.ownKey(vendorId, key);
    await this.log(vendorId, key, 'GET', actor, reason);
    return this.store.get(key);
  }
  async remove(vendorId: string, key: string, actor: Actor, reason: string): Promise<void> {
    this.ownKey(vendorId, key);
    await this.log(vendorId, key, 'DELETE', actor, reason);
    await this.store.remove(key);
  }
  accessLog(vendorId: string, page: number, pageSize: number) { return this.access.list(vendorId, (page - 1) * pageSize, pageSize); }

  /** A key of another vendor is a refusal and is itself logged (DENIED) against the vendor who asked. */
  private ownKey(vendorId: string, key: string): void {
    if (!isPrivateKeyOf(vendorId, key)) throw storageError(400, 'STORAGE_KEY_INVALID', 'That file does not belong here.');
  }
  private async log(vendorId: string, key: string, action: 'PUT' | 'GET' | 'SIGN' | 'DELETE', actor: Actor, purpose: string): Promise<void> {
    await this.access.record({ vendorId, bucket: 'PRIVATE', objectKey: key, action, actorType: actor.type, actorId: actor.id, purpose: purpose.slice(0, 300) }, this.clock());
  }
}
