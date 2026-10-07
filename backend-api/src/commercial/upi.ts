import * as QRCode from 'qrcode';

/**
 * UPI deep link + QR, UTR validation and proof-file validation. Pure helpers (QR generation aside).
 * The amount in a UPI link is ALWAYS the server-computed balance due — never a client value.
 */

const VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function isValidVpa(vpa: string | null | undefined): vpa is string {
  return typeof vpa === 'string' && VPA_RE.test(vpa.trim());
}

export interface UpiLinkParams {
  vpa: string;
  payeeName: string;
  amountPaise: number;
  /** Transaction note — the invoice number, so the payment is reconcilable from the bank statement. */
  note: string;
}

export function buildUpiLink(p: UpiLinkParams): string {
  if (!isValidVpa(p.vpa)) throw new RangeError('Invalid UPI ID');
  if (!Number.isInteger(p.amountPaise) || p.amountPaise <= 0) throw new RangeError('Invalid UPI amount');
  const q = new URLSearchParams({
    pa: p.vpa.trim(),
    pn: p.payeeName.slice(0, 60),
    am: (p.amountPaise / 100).toFixed(2),
    cu: 'INR',
    tn: p.note.slice(0, 80),
  });
  // URLSearchParams encodes spaces as '+', but UPI apps expect %20.
  return `upi://pay?${q.toString().replace(/\+/g, '%20')}`;
}

/** PNG data URL of the UPI link, generated server-side. */
export async function upiQrDataUrl(link: string): Promise<string> {
  return QRCode.toDataURL(link, { errorCorrectionLevel: 'M', margin: 2, width: 360 });
}

/** UTR / bank reference: 12–22 letters or digits (UPI RRN is 12 digits; NEFT/IMPS references are alphanumeric). */
export function normalizeUtr(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const u = raw.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z0-9]{12,22}$/.test(u) ? u : null;
}

export const MAX_PROOF_BYTES = 3 * 1024 * 1024;

export interface SniffedImage { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: '.jpg' | '.png' | '.webp' }

/** Identify an image by its magic bytes — the client-declared mimetype/extension is never trusted. */
export function sniffImage(buf: Buffer): SniffedImage | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: '.png' };
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: '.webp' };
  return null;
}
