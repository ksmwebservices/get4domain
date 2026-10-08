import { join, resolve } from 'path';

/** Largest accepted image (also the multer limit on the endpoint). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Where public uploads live. `UPLOADS_DIR` overrides the default (`<cwd>/uploads`, the Docker volume mount) — used by tests. */
export function uploadsDir(): string {
  return process.env.UPLOADS_DIR ? resolve(process.env.UPLOADS_DIR) : join(process.cwd(), 'uploads');
}

export interface DetectedImage { ext: '.png' | '.jpg' | '.gif' | '.webp' | '.svg'; mime: string }

/** What the BYTES say the file is — never what the client claims. Returns null for anything that is not one of the allowed formats. */
export function detectImage(buf: Buffer): DetectedImage | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: '.png', mime: 'image/png' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: '.jpg', mime: 'image/jpeg' };
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString('latin1'))) return { ext: '.gif', mime: 'image/gif' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { ext: '.webp', mime: 'image/webp' };
  // SVG is text: after an optional BOM / XML declaration / comments / doctype it must open with <svg.
  const head = buf.subarray(0, 2048).toString('utf8').replace(/^﻿/, '');
  if (/^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return { ext: '.svg', mime: 'image/svg+xml' };
  return null;
}

/** An SVG served from our origin must not be able to run script. Conservative: anything active is refused (a plain logo/icon never needs it). */
export function svgIsSafe(svg: string): boolean {
  const s = svg.toLowerCase();
  if (s.includes('<script') || s.includes('<foreignobject') || s.includes('<iframe') || s.includes('<embed') || s.includes('<object') || s.includes('<!entity')) return false;
  if (s.includes('javascript:') || s.includes('vbscript:')) return false;
  if (/\son[a-z]+\s*=/.test(s)) return false; // onload=, onclick=, …
  // external references (anything but an in-document #id or an embedded data: image) could pull in active content
  const refs = s.match(/(?:xlink:)?href\s*=\s*["'][^"']*["']/g) ?? [];
  return refs.every((r) => /["']\s*(#|data:image\/(png|jpe?g|gif|webp))/.test(r));
}

/** Declared types the endpoint accepts, and the extension each one must be backed by. */
export const DECLARED_TO_EXT: Record<string, DetectedImage['ext']> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg',
};

/** Options for serving the public uploads folder (shared by main.ts and the tests so they cannot drift apart). */
export const uploadsStaticOptions = {
  prefix: '/uploads/',
  setHeaders: (res: { setHeader(name: string, value: string): void }, filePath: string): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); // never let a browser guess a different type
    res.setHeader('Cache-Control', 'public, max-age=86400'); // names are unique (timestamp + random), so a file never changes
    // an SVG/HTML opened directly gets no scripts, no network and no same-origin powers
    if (/\.(svg|html?)$/i.test(filePath)) res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
  },
};
