import { decryptSecret, encryptSecret } from '../platform-settings/crypto.util';

/**
 * Provider secrets (slice 5.11), sealed with the repo's existing AES-256-GCM helper and PLATFORM_SETTINGS_KEY. The helper returns "iv:tag:ciphertext" (base64); the table keeps the three parts in
 * three columns. Only the last four characters are ever shown. A secret that cannot be opened (wrong key, tampered, missing) is null, never an exception that could echo anything.
 */
export interface SealedSecret { cipher: string; iv: string; tag: string; last4: string }
export interface StoredSecret { cipher: string | null; iv: string | null; tag: string | null }

export function sealSecret(plain: string): SealedSecret {
  const [iv, tag, cipher] = encryptSecret(plain).split(':');
  return { cipher, iv, tag, last4: plain.slice(-4) };
}

export function openSecret(s: StoredSecret): string | null {
  if (!s.cipher || !s.iv || !s.tag) return null;
  try { return decryptSecret(`${s.iv}:${s.tag}:${s.cipher}`); } catch { return null; }
}
