import { confusableKey } from '../../site-domains/core/hostname';
import { phoneKey as lastTenDigits } from '../../provisioning/steps/business-input';

/**
 * Pure rules of the D1 duplicate check. No clock, randomness, network or database here: the store (port) finds candidate rows, and these functions decide what they mean.
 *
 *   strong     phone (last 10 digits), e-mail, GSTIN, an existing website or mapped custom domain      -> BLOCKED
 *   medium     business name (trigram) + location (pincode or area) + category                           -> POSSIBLE ("Is this your business?"), or admin review
 *   supporting owner name, address                                                                       -> never decides alone; lifts a near-miss name to medium
 */
export type Signal = 'PHONE' | 'EMAIL' | 'GSTIN' | 'WEBSITE' | 'CUSTOM_DOMAIN' | 'NAME_LOCATION_CATEGORY' | 'OWNER' | 'ADDRESS';
export type Strength = 'STRONG' | 'MEDIUM' | 'SUPPORTING';
export type Outcome = 'CLEAR' | 'POSSIBLE' | 'BLOCKED';
/** The creation paths. Used for the audit trail and the policy of each path. */
export type DuplicatePath = 'REGISTER' | 'ADMIN_VENDOR' | 'PROVISIONING' | 'SEEDED' | 'DEAL' | 'STARTER_SITE' | 'REFERRAL';

export const STRONG_SIGNALS: readonly Signal[] = ['PHONE', 'EMAIL', 'GSTIN', 'WEBSITE', 'CUSTOM_DOMAIN'];
export const strengthOf = (s: Signal): Strength => (STRONG_SIGNALS.includes(s) ? 'STRONG' : s === 'NAME_LOCATION_CATEGORY' ? 'MEDIUM' : 'SUPPORTING');

/** A name of 55% trigram similarity or more, in the same place and the same category, is a possible duplicate. With an owner or address match as well, 40% is enough. */
export const NAME_SIMILARITY_MEDIUM = 0.55;
export const NAME_SIMILARITY_WITH_SUPPORT = 0.4;

export interface Match {
  signal: Signal;
  strength: Strength;
  /** the vendor the signal matched, when there is one */
  vendorId: string | null;
  /** the directory listing the signal matched, when there is one */
  businessId: string | null;
  /** an UNCLAIMED listing nobody owns yet (no vendor): the new business attaches to it instead of making a second listing */
  attachable: boolean;
  score?: number;
}

export interface DuplicateInput {
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
  businessName: string;
  city?: string | null;
  area?: string | null;
  pincode?: string | null;
  /** the category key: a catalogue key, a kit category or the vendor's industry */
  category?: string | null;
  ownerName?: string | null;
  address?: string | null;
  subdomain?: string | null;
  customDomain?: string | null;
  /** the vendor this check is for, when it already exists (never matches itself) */
  excludeVendorId?: string | null;
}

/** What a candidate row from the store says about each medium and supporting signal. The store computes the similarity (pg_trgm, or the same rule here when the extension is missing). */
export interface NameCandidate {
  vendorId: string | null;
  businessId: string | null;
  attachable: boolean;
  similarity: number;
  locationMatch: boolean;
  categoryMatch: boolean;
  ownerMatch: boolean;
  addressMatch: boolean;
}

// ── normalisers ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The last 10 digits of a phone, whatever way it was typed; null when there are fewer than 10 digits. The same rule as the migration's backfill. */
export function phoneKeyOf(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? lastTenDigits(digits) : null;
}

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
/** Upper case, no spaces or dashes; null unless it has the shape of a GSTIN. */
export function normaliseGstin(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const g = raw.toUpperCase().replace(/[\s-]+/g, '');
  return GSTIN.test(g) ? g : null;
}

const LEGAL_WORDS = new Set(['pvt', 'private', 'ltd', 'limited', 'llp', 'inc', 'co', 'company', 'and', 'the', 'enterprises', 'enterprise', 'traders', 'services', 'service']);
/** The name a person would recognise as the same business: lower case, punctuation gone, legal words (Pvt Ltd, &, Co) gone. Kept whole when removing them would leave nothing. */
export function normaliseBusinessName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const words = raw.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9஀-௿\s]+/g, ' ').split(/\s+/).filter(Boolean);
  const core = words.filter((w) => !LEGAL_WORDS.has(w));
  return (core.length ? core : words).join(' ');
}

export const normaliseArea = (raw: unknown): string => (typeof raw === 'string' ? raw.toLowerCase().replace(/[^a-z0-9஀-௿]+/g, ' ').trim() : '');
export const normalisePincode = (raw: unknown): string | null => (typeof raw === 'string' && /^\d{6}$/.test(raw.trim()) ? raw.trim() : null);

/** pg_trgm's rule, so the application and the database agree: each word is padded with two spaces in front and one behind, cut into 3-letter pieces; similarity = shared / all distinct. */
export function trigramSimilarity(a: string, b: string): number {
  const grams = (s: string): Set<string> => {
    const out = new Set<string>();
    for (const w of s.toLowerCase().replace(/[^a-z0-9஀-௿]+/g, ' ').split(/\s+/).filter(Boolean)) {
      const p = `  ${w} `;
      for (let i = 0; i + 3 <= p.length; i++) out.add(p.slice(i, i + 3));
    }
    return out;
  };
  const x = grams(a); const y = grams(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0; for (const g of x) if (y.has(g)) shared++;
  return shared / (x.size + y.size - shared);
}

/** Hosts a business may already be using: its own custom domain, as typed (URL, www, port, path all removed). */
export function hostOf(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const h = raw.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/\.$/, '');
  return h.includes('.') && /^[a-z0-9.-]+$/.test(h) ? h : null;
}

// ── deciding ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** True when a candidate row is a medium match: same place, same category, a close name (a nearer miss counts when the owner or the address also match). */
export function isMediumMatch(c: NameCandidate): boolean {
  if (!c.locationMatch || !c.categoryMatch) return false;
  if (c.similarity >= NAME_SIMILARITY_MEDIUM) return true;
  return c.similarity >= NAME_SIMILARITY_WITH_SUPPORT && (c.ownerMatch || c.addressMatch);
}

export function matchesFromCandidates(cs: ReadonlyArray<NameCandidate>): Match[] {
  const out: Match[] = [];
  for (const c of cs) {
    if (isMediumMatch(c)) out.push({ signal: 'NAME_LOCATION_CATEGORY', strength: 'MEDIUM', vendorId: c.vendorId, businessId: c.businessId, attachable: c.attachable, score: c.similarity });
    if (c.ownerMatch && c.similarity >= NAME_SIMILARITY_WITH_SUPPORT) out.push({ signal: 'OWNER', strength: 'SUPPORTING', vendorId: c.vendorId, businessId: c.businessId, attachable: c.attachable });
    if (c.addressMatch && c.similarity >= NAME_SIMILARITY_WITH_SUPPORT) out.push({ signal: 'ADDRESS', strength: 'SUPPORTING', vendorId: c.vendorId, businessId: c.businessId, attachable: c.attachable });
  }
  return out;
}

export interface Classified {
  outcome: Outcome;
  /** the matches that decided the outcome (STRONG for BLOCKED, MEDIUM for POSSIBLE) */
  deciding: Match[];
}

/**
 * Strong beats medium beats nothing. `listingsAreAttachable`: a strong or medium match on a listing that nobody owns yet does not stop a STAFF path (it attaches to that listing instead of making a
 * second one); it still stops a self-service path (the visitor is told to claim it).
 */
export function classify(matches: ReadonlyArray<Match>, o: { listingsAreAttachable: boolean }): Classified {
  const counts = (m: Match): boolean => !(o.listingsAreAttachable && m.attachable);
  const strong = matches.filter((m) => m.strength === 'STRONG' && counts(m));
  if (strong.length) return { outcome: 'BLOCKED', deciding: strong };
  const medium = matches.filter((m) => m.strength === 'MEDIUM' && counts(m));
  if (medium.length) return { outcome: 'POSSIBLE', deciding: medium };
  return { outcome: 'CLEAR', deciding: [] };
}

// ── similar subdomain (a warning, never a block) ─────────────────────────────────────────────────────────────────

/** Edit distance, capped: the number of single-letter changes between a and b, or max + 1 when it is more than max. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...cur) > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** The existing subdomain a new one looks like: the same after folding look-alikes ("sr1ganesh" / "sriganesh"), or one letter apart once both are 6 letters or more. Null when none. */
export function similarSubdomain(slug: string, existing: ReadonlyArray<string>): string | null {
  const key = confusableKey(slug);
  for (const e of existing) {
    if (e === slug) continue;                      // an identical name is "taken", which is the availability check's business, not a warning
    const k = confusableKey(e);
    if (k === key) return e;
    if (key.length >= 6 && k.length >= 6 && editDistance(k, key, 1) <= 1) return e;
  }
  return null;
}
