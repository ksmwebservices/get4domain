/** Pure rules of storage (Amendment 12 Q2). No clock, no network, no environment reads except through the functions that take `env`. */

export type Env = Readonly<Record<string, string | undefined>>;

/** Names of the environment variables that hold the keys. Values are never read into a log or a response. */
export const STORAGE_ENV = {
  publicKeyId: 'STORAGE_PUBLIC_ACCESS_KEY_ID', publicSecret: 'STORAGE_PUBLIC_SECRET_ACCESS_KEY',
  privateKeyId: 'STORAGE_PRIVATE_ACCESS_KEY_ID', privateSecret: 'STORAGE_PRIVATE_SECRET_ACCESS_KEY',
} as const;

export const isHttpsEndpoint = (v: string): boolean => {
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password && u.search === '' && u.hash === ''; } catch { return false; }
};
/** The custom media domain: https, no credentials, and never the shared r2.dev address (Amendment 12 Q2). */
export const isSafeMediaBaseUrl = (v: string): boolean => {
  if (!isHttpsEndpoint(v)) return false;
  const host = new URL(v).hostname.toLowerCase();
  return !(host === 'r2.dev' || host.endsWith('.r2.dev'));
};
export const isSafeName = (v: string): boolean => /^[A-Za-z0-9][A-Za-z0-9.-]{0,62}$/.test(v);

/** The public URL of an object: the media base, then the path with every segment encoded. */
export const publicUrlFor = (base: string, path: string): string => `${base.replace(/\/+$/, '')}/${path.split('/').map(encodeURIComponent).join('/')}`;

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export type PrivatePurpose = 'identity' | 'payment-proof' | 'document';
const PURPOSES: readonly PrivatePurpose[] = ['identity', 'payment-proof', 'document'];
/** private/<vendorId>/<purpose>/<id>: the vendor is part of the key and every segment is checked, so a key can never climb out of its folder. */
export function privateKeyFor(vendorId: string, purpose: PrivatePurpose, id: string): string | null {
  if (!PURPOSES.includes(purpose) || !SEGMENT.test(vendorId) || !SEGMENT.test(id) || id.includes('..')) return null;
  return `private/${vendorId}/${purpose}/${id}`;
}
export const isPrivateKeyOf = (vendorId: string, key: string): boolean => key.startsWith(`private/${vendorId}/`) && !key.includes('..') && key.split('/').length === 4;

/** What a private file is, from its first bytes (never from its label): PDF, JPEG or PNG. */
export function detectPrivateType(b: Buffer): { mime: string; image: boolean } | null {
  if (b.length >= 5 && b.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', image: false };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', image: true };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', image: true };
  return null;
}
export type UploadProblem = { code: 'STORAGE_TOO_LARGE' | 'STORAGE_TYPE_REFUSED'; message: string };
export function checkPrivateUpload(max: number, f: { size: number; declared: string; detected: string | null }): UploadProblem | null {
  if (f.size === 0 || f.detected === null) return { code: 'STORAGE_TYPE_REFUSED', message: 'That file is not a PDF, a JPEG or a PNG.' };
  if (f.size > max) return { code: 'STORAGE_TOO_LARGE', message: 'That file is too large.' };
  if (f.declared.toLowerCase() !== f.detected) return { code: 'STORAGE_TYPE_REFUSED', message: 'The file does not match its type.' };
  return null;
}
/** A signed link lives as long as the setting says and never longer than the cap. */
export const clampTtl = (wanted: number | undefined, setting: number, cap: number): number => Math.min(Math.max(1, wanted ?? setting), setting, cap);

/**
 * Lifecycle metadata: the deletion date is written on the object itself (x-amz-meta-retain-until) because bucket lifecycle rules work by prefix and age, not by our retention rule. The bucket rule
 * and this tag are set up together (docs/v3/V3_STORAGE.md); the retention number itself comes from settings (counsel), never from code.
 */
export const retentionMetadata = (retainUntil: Date | null, extra: Record<string, string> = {}): Record<string, string> => ({ ...extra, ...(retainUntil ? { 'retain-until': retainUntil.toISOString().slice(0, 10) } : {}) });

export const configured = (env: Env, ...names: string[]): boolean => names.every((n) => typeof env[n] === 'string' && env[n]!.length > 0);
