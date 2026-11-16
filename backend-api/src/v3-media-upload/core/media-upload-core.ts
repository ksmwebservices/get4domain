import { detectImage, svgIsSafe } from '../../uploads/uploads.util';
import { UPLOAD_TYPES } from '../../v3-storage/settings/storage-settings';
import { checkAlt } from '../../v3-website/core/media-core';

/**
 * Pure rules of the Wave 2 Part D upload. The file is judged by its BYTES, never by its name or the type the client claimed; the name is never used at all. The storage key is built from ids the server holds and
 * the content hash, so no part of it comes from the user. An SVG that carries anything active is refused (never "cleaned" in place, which is how a filter gets bypassed). A PDF that can run something is refused.
 */
export type UploadType = (typeof UPLOAD_TYPES)[number];
export interface Detected { kind: 'IMAGE' | 'DOCUMENT'; contentType: UploadType; ext: 'jpg' | 'png' | 'webp' | 'svg' | 'pdf' }
const EXT: Readonly<Record<UploadType, Detected['ext']>> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' };
const LABEL: Readonly<Record<string, string>> = { 'image/jpg': 'image/jpeg' };

/** What the bytes say the file is, among the five types the upload knows. Null for anything else (a gif, an exe, a zip, an empty file). */
export function detectUpload(bytes: Buffer): Detected | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-') return { kind: 'DOCUMENT', contentType: 'application/pdf', ext: 'pdf' };
  const img = detectImage(bytes);
  if (!img) return null;
  const t = img.mime as UploadType;
  return (UPLOAD_TYPES as readonly string[]).includes(t) ? { kind: 'IMAGE', contentType: t, ext: EXT[t] } : null;   // a gif is detected by the shared helper but is not an upload type here
}

/** Active content inside a PDF: scripts, auto-run actions, launching programs, embedded files. A plain brochure needs none of them. */
const PDF_ACTIVE = /\/(JavaScript|JS|Launch|OpenAction|AA|EmbeddedFile|EmbeddedFiles|RichMedia|XFA|SubmitForm|ImportData|GoToR|GoToE)\b/;
export function pdfProblem(bytes: Buffer): string | null {
  if (!bytes.subarray(Math.max(0, bytes.length - 1024)).toString('latin1').includes('%%EOF')) return 'That PDF looks cut short or damaged.';
  if (PDF_ACTIVE.test(bytes.toString('latin1'))) return 'That PDF carries active content, so it is not accepted. Save a plain copy and try again.';
  return null;
}

export interface UploadCaps { mediaUploadMaxBytes: number | null; mediaUploadMaxPixels: number | null; mediaUploadAllowedTypes: string[] | null }
export type Refusal = { ok: false; code: 'UPLOAD_NOT_CONFIGURED' | 'UPLOAD_EMPTY' | 'UPLOAD_TOO_LARGE' | 'UPLOAD_TYPE_NOT_ALLOWED' | 'UPLOAD_TYPE_MISMATCH' | 'UPLOAD_UNSAFE'; message: string };
const refuse = (code: Refusal['code'], message: string): Refusal => ({ ok: false, code, message });

/** The first thing wrong with an upload, or the detected type. Order: switched on, something sent, within the byte cap, an allowed type by its bytes, the claimed type agrees, nothing active inside. */
export function checkUpload(caps: UploadCaps, file: { bytes: Buffer; declared: string }): { ok: true; detected: Detected } | Refusal {
  if (caps.mediaUploadMaxBytes === null || caps.mediaUploadMaxPixels === null || caps.mediaUploadAllowedTypes === null) return refuse('UPLOAD_NOT_CONFIGURED', 'Uploads are not switched on yet.');
  if (file.bytes.length === 0) return refuse('UPLOAD_EMPTY', 'No file was received.');
  if (file.bytes.length > caps.mediaUploadMaxBytes) return refuse('UPLOAD_TOO_LARGE', 'That file is too large.');
  const d = detectUpload(file.bytes);
  if (!d || !caps.mediaUploadAllowedTypes.includes(d.contentType)) return refuse('UPLOAD_TYPE_NOT_ALLOWED', 'That kind of file is not accepted.');
  if ((LABEL[file.declared] ?? file.declared) !== d.contentType) return refuse('UPLOAD_TYPE_MISMATCH', 'The file is not the kind of file its name says.');
  if (d.contentType === 'image/svg+xml' && !svgIsSafe(file.bytes.toString('utf8'))) return refuse('UPLOAD_UNSAFE', 'That SVG carries something that can run, so it is not accepted. Export a plain picture and try again.');
  if (d.contentType === 'application/pdf') { const p = pdfProblem(file.bytes); if (p) return refuse(p.includes('active') ? 'UPLOAD_UNSAFE' : 'UPLOAD_TYPE_MISMATCH', p); }
  return { ok: true, detected: d };
}

/** The most one request body may carry, whatever the staff setting says (the multipart reader stops here). Both upload controllers use it. */
export const UPLOAD_TRANSPORT_LIMIT = 16 * 1024 * 1024;
export const UPLOAD_ALT_MAX = 160;

export interface UploadLimitsView {
  /** false until staff set all three caps: every upload then answers 503 UPLOAD_NOT_CONFIGURED */
  configured: boolean;
  /** the most bytes a file may have: the staff cap, never above the transport limit; null while not configured */
  maxBytes: number | null;
  /** the staff cap on its own (it also applies to a picture after it is re-encoded) */
  settingMaxBytes: number | null;
  maxPixels: number | null;
  allowedTypes: string[];
  images: string[];
  documents: string[];
  transportLimitBytes: number;
  /** a picture needs a description (1 to altMaxLength plain characters); a document may have one */
  altRequiredForImages: true;
  altMaxLength: number;
}

/** What the screen needs to check a file BEFORE it is sent: the same caps the upload route enforces, from the same settings. The route still checks again, by the file's bytes. */
export function uploadLimitsView(caps: UploadCaps): UploadLimitsView {
  const configured = caps.mediaUploadMaxBytes !== null && caps.mediaUploadMaxPixels !== null && caps.mediaUploadAllowedTypes !== null && caps.mediaUploadAllowedTypes.length > 0;
  const types = configured ? [...(caps.mediaUploadAllowedTypes as string[])] : [];
  return {
    configured, maxBytes: configured ? Math.min(caps.mediaUploadMaxBytes as number, UPLOAD_TRANSPORT_LIMIT) : null, settingMaxBytes: configured ? (caps.mediaUploadMaxBytes as number) : null,
    maxPixels: configured ? (caps.mediaUploadMaxPixels as number) : null, allowedTypes: types, images: types.filter((t) => t.startsWith('image/')), documents: types.filter((t) => !t.startsWith('image/')),
    transportLimitBytes: UPLOAD_TRANSPORT_LIMIT, altRequiredForImages: true, altMaxLength: UPLOAD_ALT_MAX,
  };
}

/** The upload group token a staff draft upload is made under: opaque, 16 to 64 letters, digits, dash or underscore, chosen by the screen once per create form. */
export const GROUP_TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
export const isGroupToken = (v: unknown): v is string => typeof v === 'string' && GROUP_TOKEN.test(v);

export type Scope = { kind: 'VENDOR'; vendorId: string } | { kind: 'DRAFT'; staffId: string };
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const scopeKeyOf = (s: Scope): string => (s.kind === 'VENDOR' ? `vendor:${s.vendorId}` : `draft:${s.staffId}`);

/** vendors/<vendorId>/uploads/<sha256>.<ext> or drafts/<staffId>/<sha256>.<ext>: the folder from a server-held id, the file named by its content, the extension from the detected type. */
export function uploadKeyFor(s: Scope, sha256: string, ext: Detected['ext']): string {
  const id = s.kind === 'VENDOR' ? s.vendorId : s.staffId;
  if (!SAFE_ID.test(id) || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('unsafe upload key input');
  return s.kind === 'VENDOR' ? `vendors/${id}/uploads/${sha256}.${ext}` : `drafts/${id}/${sha256}.${ext}`;
}

/** Alt text: required for a picture, optional for a document; the same plain-text rule as the website library. */
export function checkUploadAlt(kind: Detected['kind'], alt: unknown): { ok: true; alt: string | null } | { ok: false; code: string; message: string } {
  if (kind === 'DOCUMENT' && (alt === undefined || alt === null || String(alt).trim() === '')) return { ok: true, alt: null };
  const a = checkAlt(alt);
  return a.ok ? { ok: true, alt: a.alt } : { ok: false, code: a.code, message: a.message };
}
