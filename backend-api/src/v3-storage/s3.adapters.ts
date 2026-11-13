import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { MediaStoragePort } from '../v3-website/media/media.ports';
import { Env, STORAGE_ENV, configured, publicUrlFor } from './core/storage-core';
import { PrivateObjectStore, PrivatePutMeta } from './storage.ports';
import { storageError } from './storage.errors';
import { StorageSettings, StorageSettingsService } from './settings/storage-settings';

const notOn = () => storageError(503, 'STORAGE_NOT_CONFIGURED', 'File storage is not switched on yet.');
const failed = () => storageError(502, 'STORAGE_FAILED', 'The file could not be stored right now. Please try again.');

interface Target { endpoint: string; bucket: string; region: string; keyId: string; secret: string }
/** One S3 client per target, rebuilt when the endpoint, bucket or key changes. The keys are read from the environment on every call and are never logged or returned. */
class ClientCache {
  private key = ''; private client: S3Client | null = null;
  get(t: Target): S3Client {
    const k = `${t.endpoint}|${t.region}|${t.keyId}`;
    if (!this.client || k !== this.key) { this.client = new S3Client({ region: t.region, endpoint: t.endpoint, forcePathStyle: true, credentials: { accessKeyId: t.keyId, secretAccessKey: t.secret } }); this.key = k; }
    return this.client;
  }
}

const publicTarget = (s: StorageSettings, env: Env): (Target & { baseUrl: string }) | null =>
  s.storagePublicEndpoint && s.storagePublicBucket && s.storagePublicRegion && s.storagePublicBaseUrl && configured(env, STORAGE_ENV.publicKeyId, STORAGE_ENV.publicSecret)
    ? { endpoint: s.storagePublicEndpoint, bucket: s.storagePublicBucket, region: s.storagePublicRegion, baseUrl: s.storagePublicBaseUrl, keyId: env[STORAGE_ENV.publicKeyId]!, secret: env[STORAGE_ENV.publicSecret]! } : null;
const privateTarget = (s: StorageSettings, env: Env): Target | null =>
  s.storagePrivateEndpoint && s.storagePrivateBucket && s.storagePrivateRegion && configured(env, STORAGE_ENV.privateKeyId, STORAGE_ENV.privateSecret)
    ? { endpoint: s.storagePrivateEndpoint, bucket: s.storagePrivateBucket, region: s.storagePrivateRegion, keyId: env[STORAGE_ENV.privateKeyId]!, secret: env[STORAGE_ENV.privateSecret]! } : null;

/**
 * Public media on an S3-compatible bucket (Cloudflare R2). Objects are named by content hash, so they are cached for a year and replaced never. The URL returned is on the custom media domain from
 * settings (never r2.dev). Refuses with STORAGE_NOT_CONFIGURED until the settings and keys are present. Never called by a test (tests bind FakePublicStore).
 */
@Injectable()
export class S3PublicStorage extends MediaStoragePort {
  private readonly clients = new ClientCache();
  constructor(private readonly settings: StorageSettingsService, private readonly env: () => Env = () => process.env) { super(); }
  async put(path: string, bytes: Buffer, contentType: string): Promise<string> {
    const t = publicTarget(await this.settings.get(), this.env()); if (!t) throw notOn();
    try { await this.clients.get(t).send(new PutObjectCommand({ Bucket: t.bucket, Key: path, Body: bytes, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' })); } catch { throw failed(); }
    return publicUrlFor(t.baseUrl, path);
  }
  async remove(path: string): Promise<void> {
    const t = publicTarget(await this.settings.get(), this.env()); if (!t) return;
    try { await this.clients.get(t).send(new DeleteObjectCommand({ Bucket: t.bucket, Key: path })); } catch { throw failed(); }
  }
}

/** The private bucket (Contabo Object Storage, R2 or any S3 endpoint). Nothing in it is ever public: reads are signed links of a few minutes or server-side reads. Never called by a test. */
@Injectable()
export class S3PrivateStorage extends PrivateObjectStore {
  private readonly clients = new ClientCache();
  constructor(private readonly settings: StorageSettingsService, private readonly env: () => Env = () => process.env) { super(); }
  private async target(): Promise<Target> { const t = privateTarget(await this.settings.get(), this.env()); if (!t) throw notOn(); return t; }
  async put(key: string, bytes: Buffer, meta: PrivatePutMeta): Promise<void> {
    const t = await this.target();
    try { await this.clients.get(t).send(new PutObjectCommand({ Bucket: t.bucket, Key: key, Body: bytes, ContentType: meta.contentType, Metadata: meta.metadata })); } catch { throw failed(); }
  }
  async get(key: string): Promise<Buffer | null> {
    const t = await this.target();
    try { const r = await this.clients.get(t).send(new GetObjectCommand({ Bucket: t.bucket, Key: key })); return r.Body ? Buffer.from(await r.Body.transformToByteArray()) : null; }
    catch (e) { if ((e as { name?: string }).name === 'NoSuchKey') return null; throw failed(); }
  }
  async remove(key: string): Promise<void> {
    const t = await this.target();
    try { await this.clients.get(t).send(new DeleteObjectCommand({ Bucket: t.bucket, Key: key })); } catch { throw failed(); }
  }
  async signedGetUrl(key: string, ttlSeconds: number): Promise<string> {
    const t = await this.target();
    try { return await getSignedUrl(this.clients.get(t), new GetObjectCommand({ Bucket: t.bucket, Key: key }), { expiresIn: ttlSeconds }); } catch { throw failed(); }
  }
}
