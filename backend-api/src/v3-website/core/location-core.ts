/**
 * Location and directions (slice B2, amendment 08), pure. The business's address is stored as lines, city, state and pincode with optional coordinates. The directions link is BUILT, never fetched:
 * `https://www.google.com/maps/search/?api=1&query=<latitude>,<longitude>` when there are coordinates, else the same format with the URL-encoded address text. No key, no network call. A full map
 * link the vendor pastes is read for coordinates by a pure parser; short links (maps.app.goo.gl) are NOT expanded, because that would need the network: the vendor is asked for the full link or the address.
 */
export interface Location { addressLine1?: string; addressLine2?: string; city?: string; state?: string; pincode?: string; latitude?: number; longitude?: number; mapLinkInput?: string }
export type LocationFail = { ok: false; code: string; message: string; field: string };
const fail = (code: string, message: string, field: string): LocationFail => ({ ok: false, code, message, field });

const TEXT_MAX: Readonly<Record<string, number>> = { addressLine1: 120, addressLine2: 120, city: 60, state: 60 };
const KEYS = ['addressLine1', 'addressLine2', 'city', 'state', 'pincode', 'latitude', 'longitude', 'mapLinkInput'] as const;
const CONTROL = /[\u0000-\u001F\u007F]/;

export function validateLocation(input: unknown): { ok: true; location: Location } | LocationFail {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('FIELD_INVALID', 'Send the location as an object.', 'location');
  const i = input as Record<string, unknown>;
  for (const k of Object.keys(i)) if (!(KEYS as readonly string[]).includes(k)) return fail('FIELD_LOCKED', 'That part of the location is built by the platform and cannot be edited.', k);
  const out: Location = {};
  for (const k of ['addressLine1', 'addressLine2', 'city', 'state'] as const) {
    if (i[k] === undefined || i[k] === null) continue;
    if (typeof i[k] !== 'string') return fail('FIELD_INVALID', 'That value must be text.', k);
    const v = (i[k] as string).trim();
    if (v.length > TEXT_MAX[k]) return fail('FIELD_INVALID', `That text is longer than ${TEXT_MAX[k]} characters.`, k);
    if (/[<>]/.test(v) || CONTROL.test(v)) return fail('FIELD_INVALID', 'Use plain text without < or > characters.', k);
    if (v) out[k] = v;
  }
  if (i.pincode !== undefined && i.pincode !== null) {
    if (typeof i.pincode !== 'string') return fail('FIELD_INVALID', 'The pincode must be six digits.', 'pincode');
    const v = i.pincode.trim();
    if (v && !/^\d{6}$/.test(v)) return fail('FIELD_INVALID', 'The pincode must be six digits.', 'pincode');
    if (v) out.pincode = v;
  }
  const hasLat = i.latitude !== undefined && i.latitude !== null; const hasLng = i.longitude !== undefined && i.longitude !== null;
  for (const [k, has, lim] of [['latitude', hasLat, 90], ['longitude', hasLng, 180]] as const) {
    if (!has) continue;
    const n = i[k];
    if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > lim) return fail('FIELD_INVALID', `Enter ${k} as a decimal number between -${lim} and ${lim}.`, k);
  }
  if (hasLat !== hasLng) return fail('LOCATION_COORDS_INCOMPLETE', 'Give both latitude and longitude, or neither.', hasLat ? 'longitude' : 'latitude');
  if (hasLat && hasLng) { out.latitude = i.latitude as number; out.longitude = i.longitude as number; }
  if (i.mapLinkInput !== undefined && i.mapLinkInput !== null) {
    if (typeof i.mapLinkInput !== 'string') return fail('FIELD_INVALID', 'That value must be a link.', 'mapLinkInput');
    const v = i.mapLinkInput.trim();
    if (v.length > 500 || /\s/.test(v)) return fail('FIELD_INVALID', 'Paste the full map link.', 'mapLinkInput');
    if (v) out.mapLinkInput = v;
  }
  return { ok: true, location: out };
}

const BASE = 'https://www.google.com/maps/search/?api=1&query=';

/** The directions link, or null when there is nothing to point at. */
export function buildDirectionsUrl(l: Location): string | null {
  if (typeof l.latitude === 'number' && typeof l.longitude === 'number') return `${BASE}${l.latitude},${l.longitude}`;
  const text = [l.addressLine1, l.addressLine2, l.city, l.state, l.pincode].map((s) => (s ?? '').trim()).filter(Boolean).join(', ');
  return text ? `${BASE}${encodeURIComponent(text)}` : null;
}

/** The address as one line for the page: lines, city, then state and pincode. */
export const composeAddress = (l: Location): string => [l.addressLine1, l.addressLine2, l.city, [l.state, l.pincode].filter(Boolean).join(' ')].map((s) => (s ?? '').trim()).filter(Boolean).join(', ');

export type MapLinkResult = { ok: true; coords: { latitude: number; longitude: number } } | { ok: false; code: 'FIELD_INVALID' | 'SHORT_LINK_NOT_EXPANDED' | 'LINK_HOST_NOT_ALLOWED' | 'LINK_HAS_NO_COORDINATES'; message: string };
const NUM = '(-?\\d+(?:\\.\\d+)?)';
const PATTERNS: readonly RegExp[] = [new RegExp(`!3d${NUM}!4d${NUM}`), new RegExp(`@${NUM},${NUM}`), new RegExp(`[?&](?:q|query|ll|center)=${NUM},${NUM}(?:&|$)`)];

/** Reads coordinates from a full Google Maps link. Pure: no network. */
export function parseMapLink(link: string): MapLinkResult {
  const bad = (code: 'FIELD_INVALID' | 'SHORT_LINK_NOT_EXPANDED' | 'LINK_HOST_NOT_ALLOWED' | 'LINK_HAS_NO_COORDINATES', message: string): MapLinkResult => ({ ok: false, code, message });
  let u: URL;
  try { u = new URL(String(link).trim()); } catch { return bad('FIELD_INVALID', 'Paste the full map link.'); }
  if (u.protocol !== 'https:') return bad('FIELD_INVALID', 'The map link must start with https://.');
  const host = u.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && u.pathname.startsWith('/maps'))) return bad('SHORT_LINK_NOT_EXPANDED', 'That is a short link. Paste the full link from your browser, or type the address.');
  if (!/^(?:[a-z0-9-]+\.)*google\.(?:com|co\.in)$/.test(host) || !(host.startsWith('maps.') || u.pathname.startsWith('/maps'))) return bad('LINK_HOST_NOT_ALLOWED', 'That is not a Google Maps link.');
  let text: string;
  try { text = decodeURIComponent(`${u.pathname}${u.search}`); } catch { text = `${u.pathname}${u.search}`; }
  for (const p of PATTERNS) {
    const m = p.exec(text);
    if (!m) continue;
    const latitude = Number(m[1]); const longitude = Number(m[2]);
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { ok: true, coords: { latitude, longitude } };
  }
  return bad('LINK_HAS_NO_COORDINATES', 'That link has no map position in it. Type the address instead, or paste the link from "Share" with the position.');
}
