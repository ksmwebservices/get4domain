import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const KEY_LENGTH = 32;

/**
 * Derives a stable 32-byte key from PLATFORM_SETTINGS_KEY. Accepts either a
 * 64-char hex string (used directly) or any passphrase (hashed to 32 bytes).
 */
function getKey(): Buffer {
  const raw = process.env.PLATFORM_SETTINGS_KEY;
  if (!raw) {
    throw new Error('PLATFORM_SETTINGS_KEY is not configured');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw).digest().subarray(0, KEY_LENGTH);
}

/** Encrypts plaintext, returning "iv:tag:ciphertext" (all base64). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/** Reverses encryptSecret(). Throws if the payload is malformed or tampered. */
export function decryptSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/** Masks a secret for display, showing only the last 4 characters. */
export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `••••••••${value.slice(-4)}`;
}
