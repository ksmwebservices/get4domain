import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

type Env = Record<string, string | undefined>;

/** Turns "https://shop.example, shop2.example/ ,," into clean origins. A bare host means https://host. Order and duplicates removed. */
export function parseExtraOrigins(csv: string | undefined): string[] {
  const out = new Set<string>();
  for (const raw of (csv ?? '').split(',')) {
    const v = raw.trim().replace(/\/+$/, '').toLowerCase();
    if (!v) continue;
    out.add(/^https?:\/\//.test(v) ? v : `https://${v}`);
  }
  return [...out];
}

/** For a vendor's custom domain, its apex and www twin are one site: allowing one allows the other (same scheme). */
function withWwwTwins(origins: string[]): string[] {
  const out = new Set(origins);
  for (const o of origins) {
    const m = o.match(/^(https?):\/\/(www\.)?(.+)$/);
    if (m) { out.add(`${m[1]}://${m[3]}`); out.add(`${m[1]}://www.${m[3]}`); }
  }
  return [...out];
}

const PLATFORM = [/^https:\/\/([a-z0-9-]+\.)*get4domain\.com$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

/**
 * CORS for the public API.
 *  - default ("open"): reflect any origin — what production does today. The API is Bearer-token authed (no cookie auth), so CORS is not
 *    the auth boundary, and the embeddable widget must work on arbitrary vendor domains. A vendor's custom domain therefore needs no change.
 *  - CORS_MODE=strict: only the platform's own origins, FRONTEND_URL, and CORS_EXTRA_ORIGINS (comma list; apex and www both).
 * Requests with no Origin header (server-side fetches, curl) are always allowed — CORS only concerns browsers.
 */
export function buildCorsOptions(env: Env = process.env): CorsOptions {
  if ((env.CORS_MODE ?? '').toLowerCase() !== 'strict') return { origin: true, credentials: true };
  const exact = new Set(withWwwTwins([...parseExtraOrigins(env.CORS_EXTRA_ORIGINS), ...parseExtraOrigins(env.FRONTEND_URL)]));
  return {
    credentials: true,
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void): void => {
      if (!origin) return cb(null, true);
      const o = origin.trim().toLowerCase().replace(/\/+$/, '');
      cb(null, exact.has(o) || PLATFORM.some((re) => re.test(o)));
    },
  };
}
