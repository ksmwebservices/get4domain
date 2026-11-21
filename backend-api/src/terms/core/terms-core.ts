/** Pure rules of slice 5.15. No clock, database or randomness here: callers pass them in. */

export const TERMS_KINDS = ['VENDOR_TERMS', 'ACCEPTABLE_USE', 'DATA_PROCESSING', 'REFUND_POLICY_TEMPLATE', 'GRIEVANCE', 'PRIVACY', 'COOKIE', 'CUSTOMER_TERMS',
  // Block 4b (Amendment 12 Q6): the rest of the legal pack. VENDOR_TERMS is the vendor agreement; REFUND_WALLET is the refund and wallet policy; REFUND_POLICY_TEMPLATE stays the per-business template.
  'TERMS_OF_SERVICE', 'REFUND_WALLET', 'DOMAIN_TERMS', 'ENQUIRY_CONSENT', 'IDENTITY_NOTICE', 'MESSAGING', 'TESTIMONIAL', 'DIRECTORY'] as const;
export type TermsKind = (typeof TERMS_KINDS)[number];
export type TermsStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

/** The three documents a vendor must have accepted before the site call-to-action set, a payment method or the claim can go ahead. */
export const VENDOR_REQUIRED_KINDS: readonly TermsKind[] = ['VENDOR_TERMS', 'ACCEPTABLE_USE', 'DATA_PROCESSING'];
/** What a Free vendor accepts when they claim their page. */
export const CLAIM_REQUIRED_KINDS: readonly TermsKind[] = ['VENDOR_TERMS'];

/** The only body a seeded document has. Nothing invents legal text: counsel supplies it. */
export const PLACEHOLDER_BODY = 'To be supplied by counsel';
const PLACEHOLDER_KEY = PLACEHOLDER_BODY.toLowerCase();

export const isTermsKind = (k: unknown): k is TermsKind => typeof k === 'string' && (TERMS_KINDS as readonly string[]).includes(k);

/** A body is a placeholder when it is empty, or after dropping markdown marks, punctuation and case it is the placeholder sentence (alone or inside a heading or a list item). */
/** Square-bracket placeholders left in a draft, such as [Company name]. A markdown link [text](url) and a bare number such as [1] are not placeholders. */
export const hasBracketPlaceholders = (body: string): boolean => /\[(?![0-9]+\])[^\]\n[]{1,120}\](?!\()/.test(String(body ?? ''));

export function isPlaceholder(body: string): boolean {
  if (hasBracketPlaceholders(body)) return true;   // counsel's drafts carry [placeholders] until they are filled in: such a body can never be published
  const flat = String(body ?? '').toLowerCase().replace(/[#*_>`~\-•]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return flat === '' || flat.includes(PLACEHOLDER_KEY);
}

export const MAX_BODY_CHARS = 200_000;
export const MIN_CHANGE_NOTE = 5;

export type PublishCheck = { ok: true } | { ok: false; reason: 'NOT_DRAFT' | 'PLACEHOLDER' | 'NO_CHANGE_NOTE' };
export function canPublish(doc: { status: TermsStatus; bodyMarkdown: string }, changeNote: string | undefined | null): PublishCheck {
  if (doc.status !== 'DRAFT') return { ok: false, reason: 'NOT_DRAFT' };
  if (isPlaceholder(doc.bodyMarkdown)) return { ok: false, reason: 'PLACEHOLDER' };
  if (typeof changeNote !== 'string' || changeNote.trim().length < MIN_CHANGE_NOTE) return { ok: false, reason: 'NO_CHANGE_NOTE' };
  return { ok: true };
}
export const canEdit = (doc: { status: TermsStatus }): boolean => doc.status === 'DRAFT';

export interface PublishedRef { documentId: string; kind: TermsKind; version: number }
export interface Outstanding { kind: TermsKind; version: number; documentId: string }

/**
 * What a vendor still has to accept. A kind with NO published version asks for nothing (there is nothing to accept; the platform does not lock itself behind a document counsel has not
 * supplied). A kind whose latest published version is not in `acceptedDocumentIds` is outstanding, even if an older version was accepted: a new version asks again.
 */
export function outstanding(required: readonly TermsKind[], latestPublished: ReadonlyMap<TermsKind, PublishedRef>, acceptedDocumentIds: ReadonlySet<string>): Outstanding[] {
  const out: Outstanding[] = [];
  for (const kind of required) {
    const p = latestPublished.get(kind);
    if (p && !acceptedDocumentIds.has(p.documentId)) out.push({ kind, version: p.version, documentId: p.documentId });
  }
  return out;
}

/** What the vendor says they accept must be exactly the latest published versions: a stale version, an unknown kind or a missing kind is refused. */
export function acceptanceMatches(claimed: ReadonlyArray<{ kind: string; version: number }>, wanted: readonly Outstanding[]): { ok: true } | { ok: false; reason: string } {
  if (claimed.length === 0) return { ok: false, reason: 'Nothing was accepted.' };
  const have = new Map(claimed.map((c) => [c.kind, c.version] as const));
  if (have.size !== claimed.length) return { ok: false, reason: 'Each document can be accepted once.' };
  for (const w of wanted) if (have.get(w.kind) !== w.version) return { ok: false, reason: `Accept the current version of ${w.kind} (version ${w.version}).` };
  for (const c of claimed) if (!wanted.some((w) => w.kind === c.kind)) return { ok: false, reason: `${c.kind} is not waiting for acceptance.` };
  return { ok: true };
}
