import { normaliseEmail, normalisePhone } from '../../provisioning/steps/business-input';

/**
 * Pure rules of slice 5.13a (seeded sites: promotion pages made from public facts for businesses that have not signed up). No clock, randomness, network or database here.
 * Owner rule 8: SEEDED, INVITED, CLAIMED_FREE, PRO, REMOVED. Every directory listing has a Free site behind it. A removal is honoured promptly and is permanent.
 */
export type SeededLifecycle = 'SEEDED' | 'INVITED' | 'CLAIMED_FREE' | 'PRO' | 'REMOVED';
export type SourceKind = 'PUBLIC_LISTING' | 'FIELD_VISIT' | 'PHONE_CALL' | 'REFERRAL';
export type OutreachStatus = 'NOT_CONTACTED' | 'CALLED' | 'INTERESTED' | 'CLAIM_LINK_SENT' | 'CLAIMED' | 'DECLINED' | 'DO_NOT_CONTACT';
export const SOURCE_KINDS: readonly SourceKind[] = ['PUBLIC_LISTING', 'FIELD_VISIT', 'PHONE_CALL', 'REFERRAL'];
export const OUTREACH_STATUSES: readonly OutreachStatus[] = ['NOT_CONTACTED', 'CALLED', 'INTERESTED', 'CLAIM_LINK_SENT', 'CLAIMED', 'DECLINED', 'DO_NOT_CONTACT'];

// ── CSV ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export const CSV_MAX_BYTES = 1_000_000;

/** RFC 4180 style: quoted fields may hold commas, quotes ("") and line breaks; CRLF or LF; a leading byte order mark is ignored. Returns rows of cells. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

export const CSV_COLUMNS = ['businessName', 'category', 'city', 'area', 'phone', 'email', 'address', 'description', 'sourceKind', 'sourceNote', 'publicFactsOnly'] as const;
export const REQUIRED_COLUMNS = ['businessName', 'category', 'city', 'area', 'phone', 'sourceKind', 'publicFactsOnly'] as const;
export interface RawRow { line: number; cells: Record<string, string> }

/** Header names are matched ignoring case and spaces. An unknown column is ignored; a missing required column refuses the whole file. */
export function csvToRows(text: string, maxRows: number): { rows: RawRow[]; error: string | null } {
  if (typeof text !== 'string' || text.length === 0) return { rows: [], error: 'The file is empty.' };
  if (Buffer.byteLength(text) > CSV_MAX_BYTES) return { rows: [], error: 'The file is too large.' };
  const all = parseCsv(text);
  if (all.length === 0) return { rows: [], error: 'The file is empty.' };
  const norm = (h: string): string => h.replace(/\s+/g, '').toLowerCase();
  const header = all[0].map(norm);
  const index = new Map(CSV_COLUMNS.map((c) => [c, header.indexOf(c.toLowerCase())] as const));
  const missing = REQUIRED_COLUMNS.filter((c) => (index.get(c) ?? -1) < 0);
  if (missing.length) return { rows: [], error: `Missing columns: ${missing.join(', ')}.` };
  const body = all.slice(1);
  if (body.length > maxRows) return { rows: [], error: `The file has ${body.length} rows; the most allowed in one batch is ${maxRows}.` };
  return { rows: body.map((cells, i) => ({ line: i + 2, cells: Object.fromEntries(CSV_COLUMNS.map((c) => [c, (cells[index.get(c)!] ?? '').trim()])) })), error: null };
}

// ── validation ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface SeedInput {
  businessName: string; category: string; city: string; area: string; phone: string; phoneKey: string; email: string | null;
  address: string; description: string; sourceKind: SourceKind; sourceNote: string; publicFactsConfirmed: true;
}
const text = (v: unknown, min: number, max: number): string | null => { if (typeof v !== 'string') return null; const t = v.trim().replace(/\s+/g, ' '); return t.length >= min && t.length <= max ? t : null; };
const yes = (v: unknown): boolean => v === true || (typeof v === 'string' && ['yes', 'true', 'y', '1'].includes(v.trim().toLowerCase()));

/**
 * Required public fields: business name, category, city, area, public phone. Public email is optional. The source and the staff checkbox ("only public facts, no invented reviews,
 * no copied photos or text") are required on EVERY create. Every problem is listed, so a staff member can fix a row in one go.
 */
export function validateSeedRow(raw: Record<string, unknown>, o: { categoryExists: (id: string) => boolean }): { ok: true; input: SeedInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const businessName = text(raw.businessName, 2, 120); if (!businessName) errors.push('businessName: 2 to 120 characters');
  const category = text(raw.category, 2, 60); if (!category) errors.push('category: required'); else if (!o.categoryExists(category)) errors.push(`category: "${category}" is not a known category`);
  const city = text(raw.city, 2, 80); if (!city) errors.push('city: 2 to 80 characters');
  const area = text(raw.area, 2, 80); if (!area) errors.push('area: 2 to 80 characters');
  const phone = typeof raw.phone === 'string' ? normalisePhone(raw.phone) : null; if (!phone) errors.push('phone: a valid public phone number is required');
  let email: string | null = null;
  if (typeof raw.email === 'string' && raw.email.trim() !== '') { email = normaliseEmail(raw.email); if (!email) errors.push('email: not a valid address (it is optional; leave it empty)'); }
  const sk = typeof raw.sourceKind === 'string' ? (raw.sourceKind.trim().toUpperCase() as SourceKind) : null;
  if (!sk || !SOURCE_KINDS.includes(sk)) errors.push(`sourceKind: one of ${SOURCE_KINDS.join(', ')}`);
  if (!yes(raw.publicFactsOnly)) errors.push('publicFactsOnly: the staff checkbox "only public facts, no invented reviews, no copied photos or text" must be ticked');
  const address = typeof raw.address === 'string' ? raw.address.trim().slice(0, 300) : '';
  const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 600) : '';
  const sourceNote = typeof raw.sourceNote === 'string' ? raw.sourceNote.trim().slice(0, 300) : '';
  if (errors.length) return { ok: false, errors };
  return { ok: true, input: { businessName: businessName!, category: category!, city: city!, area: area!, phone: phone!, phoneKey: phone!.replace(/\D/g, '').slice(-10), email, address, description, sourceKind: sk!, sourceNote, publicFactsConfirmed: true } };
}

// ── duplicates ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The same business typed differently: lower case, letters and digits only, name plus city. */
export function nameKey(name: string, city: string): string { return `${name}|${city}`.toLowerCase().replace(/[^a-z0-9|]+/g, ''); }

export interface DupKeys { phoneHash: string; emailHash: string | null; nameKey: string }
export type DupKind = 'PHONE' | 'EMAIL' | 'NAME_CITY';
export interface Duplicate { kind: DupKind; with: 'EXISTING' | 'BATCH_ROW'; line?: number }

/** Finds, for each candidate, what it duplicates among existing sites and EARLIER rows of the same batch (the first row of a group is the one kept). */
export function findDuplicates(candidates: ReadonlyArray<DupKeys & { line: number }>, existing: ReadonlyArray<DupKeys>): Map<number, Duplicate[]> {
  const out = new Map<number, Duplicate[]>();
  const seenPhone = new Map<string, number>(); const seenEmail = new Map<string, number>(); const seenName = new Map<string, number>();
  for (const c of candidates) {
    const found: Duplicate[] = [];
    if (existing.some((e) => e.phoneHash === c.phoneHash)) found.push({ kind: 'PHONE', with: 'EXISTING' });
    else if (seenPhone.has(c.phoneHash)) found.push({ kind: 'PHONE', with: 'BATCH_ROW', line: seenPhone.get(c.phoneHash) });
    if (c.emailHash) {
      if (existing.some((e) => e.emailHash === c.emailHash)) found.push({ kind: 'EMAIL', with: 'EXISTING' });
      else if (seenEmail.has(c.emailHash)) found.push({ kind: 'EMAIL', with: 'BATCH_ROW', line: seenEmail.get(c.emailHash) });
    }
    if (existing.some((e) => e.nameKey === c.nameKey)) found.push({ kind: 'NAME_CITY', with: 'EXISTING' });
    else if (seenName.has(c.nameKey)) found.push({ kind: 'NAME_CITY', with: 'BATCH_ROW', line: seenName.get(c.nameKey) });
    if (found.length) out.set(c.line, found);
    else { seenPhone.set(c.phoneHash, c.line); if (c.emailHash) seenEmail.set(c.emailHash, c.line); seenName.set(c.nameKey, c.line); }
  }
  return out;
}

// ── quality, claim links, removal ──────────────────────────────────────────────────────────────────────────────

export interface QualityInput {
  businessName: string | null; categoryKnown: boolean; city: string | null; area: string | null; phoneE164: string | null;
  sourceKind: string | null; publicFactsConfirmed: boolean; onRegister: boolean; lifecycle: SeededLifecycle;
}
/** seededSiteQuality: passes only when the mandatory public fields are complete, a source is recorded, the business is not on the register and the site is not REMOVED. Lists what is missing. */
export function seededSiteQuality(i: QualityInput): { pass: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!(i.businessName ?? '').trim()) missing.push('BUSINESS_NAME');
  if (!i.categoryKnown) missing.push('CATEGORY');
  if (!(i.city ?? '').trim()) missing.push('CITY');
  if (!(i.area ?? '').trim()) missing.push('AREA');
  if (!(i.phoneE164 ?? '').trim()) missing.push('PHONE');
  if (!i.sourceKind || !SOURCE_KINDS.includes(i.sourceKind as SourceKind) || !i.publicFactsConfirmed) missing.push('SOURCE');
  if (i.onRegister) missing.push('ON_REGISTER');
  if (i.lifecycle === 'REMOVED') missing.push('REMOVED');
  return { pass: missing.length === 0, missing };
}

/** A claim link may be issued only with the owner's consent recorded, a phone that is not on the register, and a site that is not removed or already claimed. */
export function canIssueClaimLink(i: { ownerAgreedToContact: boolean; phoneOnRegister: boolean; lifecycle: SeededLifecycle; outreachStatus: OutreachStatus }): { ok: boolean; reason: 'CONSENT_REQUIRED' | 'ON_REGISTER' | 'REMOVED' | 'ALREADY_CLAIMED' | 'DO_NOT_CONTACT' | null } {
  if (i.lifecycle === 'REMOVED') return { ok: false, reason: 'REMOVED' };
  if (i.lifecycle === 'CLAIMED_FREE' || i.lifecycle === 'PRO') return { ok: false, reason: 'ALREADY_CLAIMED' };
  if (i.phoneOnRegister) return { ok: false, reason: 'ON_REGISTER' };
  if (i.outreachStatus === 'DO_NOT_CONTACT') return { ok: false, reason: 'DO_NOT_CONTACT' };
  if (!i.ownerAgreedToContact) return { ok: false, reason: 'CONSENT_REQUIRED' };
  return { ok: true, reason: null };
}

/** DO_NOT_CONTACT is final; REMOVED is final until a SUPER_ADMIN overrides it. Everything else may move freely (staff know the conversation). */
export function canMoveOutreach(from: OutreachStatus, to: OutreachStatus): boolean { return from !== 'DO_NOT_CONTACT' || to === 'DO_NOT_CONTACT'; }

/**
 * The four states of Amendment 13 V8, as the team and the claim screens speak of them. Derived from the lifecycle and from the one fact the lifecycle does not hold (is a version of the site published now?).
 *   UNCLAIMED_LISTING  public business details only, labelled unclaimed (SEEDED or INVITED)
 *   DRAFT_SITE         the site was made on the business's behalf and nothing of it is published yet
 *   CLAIMED            the owner has claimed it and set up the account; the site is not yet approved and published
 *   LIVE               a version of the site is published on the subdomain (a claimed business that approved it, or a paid plan)
 * REMOVED is reported as its own word: a removal is permanent and is never shown as one of the four.
 * A business not yet claimed stays UNCLAIMED_LISTING while its page is published (the existing seeded pages are public by design, Amendment 10); DRAFT_SITE is a site nobody can see yet.
 */
export type ListingState = 'UNCLAIMED_LISTING' | 'DRAFT_SITE' | 'CLAIMED' | 'LIVE' | 'REMOVED';
export function listingStateOf(i: { lifecycle: SeededLifecycle; sitePublished: boolean }): ListingState {
  if (i.lifecycle === 'REMOVED') return 'REMOVED';
  if (i.lifecycle === 'PRO') return 'LIVE';
  if (i.lifecycle === 'CLAIMED_FREE') return i.sitePublished ? 'LIVE' : 'CLAIMED';
  return i.sitePublished ? 'UNCLAIMED_LISTING' : 'DRAFT_SITE';
}

/** The lifecycle as it stands now, from the stored value and the facts: a removal wins; a claimed profile is CLAIMED_FREE or PRO by the running paid plan (the plan logic stays in the plans slice). */
export function deriveLifecycle(i: { stored: SeededLifecycle; businessStatus: string | null; proActive: boolean }): SeededLifecycle {
  if (i.stored === 'REMOVED' || i.businessStatus === 'REMOVED') return 'REMOVED';
  if (i.businessStatus === 'CLAIMED') return i.proActive ? 'PRO' : 'CLAIMED_FREE';
  return i.stored === 'INVITED' ? 'INVITED' : 'SEEDED';
}
