import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Env } from './core/registrar-core';
import { DocBlob } from './registrar.store';

/** Raised when identity documents cannot be encrypted or read (no key, a wrong key, damaged data). The message never holds key material. */
export class DocCryptoError extends Error { constructor(readonly code: 'IDENTITY_STORAGE_NOT_CONFIGURED' | 'IDENTITY_DOCUMENT_UNREADABLE') { super(code); this.name = 'DocCryptoError'; } }

/** Encrypts and decrypts identity documents (owner rule: encrypted at rest). One port, so a test and a later key service can replace the environment key. */
export abstract class DocCrypto {
  abstract encrypt(plain: Buffer): DocBlob;
  abstract decrypt(blob: DocBlob): Buffer;
}

/**
 * AES-256-GCM with a fresh random IV per document. The key is IDENTITY_DOC_KEY in the server environment (64 hex characters or 44 base64 characters, 32 bytes), read on every call, never
 * logged and never returned. No key: documents are refused (nothing is stored in clear).
 */
export class AesGcmDocCrypto extends DocCrypto {
  constructor(private readonly env: () => Env = () => process.env) { super(); }
  private key(): Buffer {
    const raw = this.env().IDENTITY_DOC_KEY;
    if (!raw) throw new DocCryptoError('IDENTITY_STORAGE_NOT_CONFIGURED');
    const k = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (k.length !== 32) throw new DocCryptoError('IDENTITY_STORAGE_NOT_CONFIGURED');
    return k;
  }
  encrypt(plain: Buffer): DocBlob {
    const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', this.key(), iv);
    const cipher = Buffer.concat([c.update(plain), c.final()]);
    return { cipher, iv, tag: c.getAuthTag() };
  }
  decrypt(blob: DocBlob): Buffer {
    try { const d = createDecipheriv('aes-256-gcm', this.key(), blob.iv); d.setAuthTag(blob.tag); return Buffer.concat([d.update(blob.cipher), d.final()]); }
    catch (e) { if (e instanceof DocCryptoError) throw e; throw new DocCryptoError('IDENTITY_DOCUMENT_UNREADABLE'); }
  }
}
