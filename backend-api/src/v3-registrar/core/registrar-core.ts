/**
 * Pure rules of domain sales (slice 5.6d): names, price from cost plus margin, renewal window, identity rules, order state machine, the live flags and the startup guard, expiry alerts.
 * No clock, randomness, network, file system or database; the environment is passed in.
 */

// ───────────────────────────────────────────────────────────────────────────── names
/** Second level labels that sit under a country extension (co.in, com.au, org.uk): a technical list, not a business value. */
const SECOND_LEVELS: ReadonlySet<string> = new Set(['co', 'com', 'net', 'org', 'gen', 'firm', 'ind', 'ac', 'edu', 'gov', 'me', 'ltd', 'plc']);
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD_LABEL = /^[a-z]{2,63}$/;
export type ParsedDomain = { ok: true; domain: string; sld: string; tld: string } | { ok: false };

/** A name a vendor can register: one label plus an extension (one or two labels). Lowercase ASCII (punycode for other scripts). */
export function parseDomain(input: string): ParsedDomain {
  const d = String(input ?? '').trim().toLowerCase();
  if (d.length < 4 || d.length > 253) return { ok: false };
  const parts = d.split('.');
  if (parts.length < 2 || parts.length > 3) return { ok: false };
  const [sld, ...tldParts] = parts;
  if (!LABEL.test(sld)) return { ok: false };
  if (tldParts.length === 2 && !SECOND_LEVELS.has(tldParts[0])) return { ok: false };
  if (!tldParts.every((l) => TLD_LABEL.test(l))) return { ok: false };
  return { ok: true, domain: d, sld, tld: tldParts.join('.') };
}

// ───────────────────────────────────────────────────────────────────────────── price
export type MarginKind = 'PERCENT_BP' | 'FIXED_PAISE';
export interface Margin { kind: MarginKind; value: number }
export interface MarginRow extends Margin { id: string; tld: string; status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'RETIRED'; effectiveFrom: Date | null }
const whole = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

/** Cost plus margin, in whole paise. A percentage margin is in basis points and rounds half up. GST is NOT here: it is added at billing as its own line from the tax table. */
export function priceFromCost(costPaise: number, margin: Margin): { costPaise: number; marginPaise: number; pricePaise: number } {
  if (!whole(costPaise) || !whole(margin.value)) throw new Error('cost and margin must be whole paise');
  const marginPaise = margin.kind === 'FIXED_PAISE' ? margin.value : Math.floor((costPaise * margin.value + 5000) / 10_000);
  return { costPaise, marginPaise, pricePaise: costPaise + marginPaise };
}

/** The row in force for an extension: APPROVED, started, the latest start. A proposal or a future row never applies. */
export function resolveMargin<T extends MarginRow>(rows: readonly T[], tld: string, now: Date): T | null {
  const ok = rows.filter((r) => r.tld === tld && r.status === 'APPROVED' && r.effectiveFrom !== null && r.effectiveFrom.getTime() <= now.getTime());
  ok.sort((a, b) => b.effectiveFrom!.getTime() - a.effectiveFrom!.getTime());
  return ok[0] ?? null;
}
export function marginFor(rows: readonly MarginRow[], tld: string, now: Date): Margin | null { const r = resolveMargin(rows, tld, now); return r ? { kind: r.kind, value: r.value } : null; }

// ───────────────────────────────────────────────────────────────────────────── renewal
/** Renewal is before expiry only: at or after the expiry time it is refused (no cheaper path for an expired domain). */
export function renewalAllowed(expiresAt: Date | null, now: Date): boolean { return !!expiresAt && expiresAt.getTime() > now.getTime(); }

// ───────────────────────────────────────────────────────────────────────────── identity
export const DOC_KINDS = ['PAN', 'GST_CERTIFICATE', 'UDYAM', 'BUSINESS_REGISTRATION', 'AADHAAR_MASKED'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
/** True when the text holds a full twelve digit number (spaces and dashes allowed between groups): such a value is never stored. */
export function aadhaarProblem(text: string): boolean { return /(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/.test(String(text ?? '')); }

// ───────────────────────────────────────────────────────────────────────────── name servers
const NS = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
/** Registries need at least two and accept at most five name servers. */
export function validNameServers(ns: readonly string[] | null | undefined): boolean { return Array.isArray(ns) && ns.length >= 2 && ns.length <= 5 && ns.every((n) => typeof n === 'string' && NS.test(n)); }

// ───────────────────────────────────────────────────────────────────────────── order state machine
export type OrderStatus = 'CREATED' | 'HELD' | 'SUBMITTED' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';
export type OrderEvent = 'HOLD_PLACED' | 'SUBMITTED' | 'REGISTRAR_OK' | 'REGISTRAR_REFUSED' | 'REGISTRAR_UNSURE' | 'NOT_SUBMITTED' | 'REGISTRAR_IN_PROGRESS';
const MOVES: Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>> = {
  CREATED: { HOLD_PLACED: 'HELD', NOT_SUBMITTED: 'FAILED' },
  HELD: { SUBMITTED: 'SUBMITTED', NOT_SUBMITTED: 'FAILED' },
  /** a transfer in progress stays SUBMITTED while the registrar works on it (slice 5.6e); an unsure initiation that turns out to be under way becomes SUBMITTED again */
  SUBMITTED: { REGISTRAR_OK: 'COMPLETED', REGISTRAR_REFUSED: 'FAILED', REGISTRAR_UNSURE: 'UNKNOWN', REGISTRAR_IN_PROGRESS: 'SUBMITTED' },
  UNKNOWN: { REGISTRAR_OK: 'COMPLETED', REGISTRAR_REFUSED: 'FAILED', REGISTRAR_IN_PROGRESS: 'SUBMITTED' },
  COMPLETED: {}, FAILED: {},
};
export function nextOrder(from: OrderStatus, ev: OrderEvent): OrderStatus | null { return MOVES[from][ev] ?? null; }

// ───────────────────────────────────────────────────────────────────────────── transfer-in (slice 5.6e)
/** An authorisation (EPP) code is 6 to 64 printable characters with no spaces. It is used once, sent to the registrar and never stored. */
export function transferAuthProblem(code: unknown): 'AUTH_CODE_INVALID' | null { return typeof code === 'string' && /^[\x21-\x7e]{6,64}$/.test(code) ? null : 'AUTH_CODE_INVALID'; }
/** The price book key of a transfer margin: kept apart from the registration margin of the same extension. */
export const transferMarginKey = (tld: string): string => `transfer.${tld}`;

// ───────────────────────────────────────────────────────────────────────────── live flags and the startup guard
export type Env = Record<string, string | undefined>;
const on = (v: string | undefined): boolean => v === 'true' || v === '1';
/** Both flags default OFF and are separate: search reads availability and price, purchase spends money. */
export function liveFlags(env: Env): { search: boolean; purchase: boolean } { return { search: on(env.REGISTRAR_LIVE_SEARCH), purchase: on(env.REGISTRAR_LIVE_PURCHASE) }; }
/** The names (never the values) of the keys that are missing while a live flag is on. Empty = fine. The startup guard refuses to start live mode when this is not empty. */
export function liveGuardProblems(env: Env): string[] {
  const f = liveFlags(env);
  if (!f.search && !f.purchase) return [];
  return ['RESELLERCLUB_AUTH_USERID', 'RESELLERCLUB_API_KEY'].filter((k) => !env[k]);
}

// ───────────────────────────────────────────────────────────────────────────── expiry alerts
const DAY = 86_400_000;
/** The nearest threshold (in days) that the domain has reached and the vendor has not yet been told about. Null when off, far away, or already expired. */
export function expiryAlertDue(expiresAt: Date, now: Date, thresholds: readonly number[] | null, sent: readonly number[]): number | null {
  if (!thresholds || thresholds.length === 0 || expiresAt.getTime() <= now.getTime()) return null;
  const left = (expiresAt.getTime() - now.getTime()) / DAY;
  const reached = [...thresholds].filter((t) => left <= t && !sent.includes(t)).sort((a, b) => a - b);
  return reached.length ? reached[0] : null;
}
