import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { b3Error } from '../b3-settings/b3-errors';
import { OtpPepper } from '../directory/pepper';
import { Actor } from '../plans/admin/audit.service';
import { AuditEntry } from '../vendor-lifecycle/lifecycle.store';
import {
  CLAIM_REQUIRED_KINDS, MAX_BODY_CHARS, Outstanding, PLACEHOLDER_BODY, PublishedRef, TERMS_KINDS, TermsKind, TermsStatus, VENDOR_REQUIRED_KINDS, acceptanceMatches, canEdit, canPublish, isPlaceholder, isTermsKind, outstanding,
} from './core/terms-core';
import { AcceptanceGuard, TermsSessionFlag } from './terms-ports';
import { TermsDocRow, TermsStore } from './terms.store';

const notFound = (): NotFoundException => new NotFoundException(b3Error('TERMS_NOT_FOUND', 'That document does not exist.'));
const stateInvalid = (m: string): ConflictException => new ConflictException(b3Error('TERMS_STATE_INVALID', m));
const invalid = (m: string): BadRequestException => new BadRequestException(b3Error('TERMS_STATE_INVALID', m));

/** What the public sees of a document: the text and its version, never who wrote it or any internal id of a person. */
const publicView = (d: TermsDocRow) => ({ kind: d.kind, version: d.version, title: d.title, status: d.status, bodyMarkdown: d.bodyMarkdown, publishedAt: d.publishedAt, changeNote: d.changeNote });
const staffView = (d: TermsDocRow, withBody: boolean) => ({
  id: d.id, kind: d.kind, version: d.version, title: d.title, status: d.status, changeNote: d.changeNote, publishedAt: d.publishedAt, publishedBy: d.publishedBy, createdBy: d.createdBy, createdAt: d.createdAt, updatedAt: d.updatedAt,
  placeholder: isPlaceholder(d.bodyMarkdown), ...(withBody ? { bodyMarkdown: d.bodyMarkdown } : {}),
});

export interface RequestContext { ip: string | null; userAgent: string | null }

/**
 * Terms documents and acceptances (slice 5.15). Staff write drafts and publish them (SUPER_ADMIN, audited, with a change note); the public reads the latest PUBLISHED version of each kind;
 * a vendor accepts the current versions. The placeholder body can never be published. Acceptances are appended and never changed or deleted (no method exists for it; the database refuses it too).
 */
@Injectable()
export class TermsService implements AcceptanceGuard, TermsSessionFlag {
  clock: () => Date = () => new Date();
  constructor(private readonly store: TermsStore, private readonly pepper: OtpPepper) {}

  // ── public ────────────────────────────────────────────────────────────────────────────────────────────────────────

  async latest(kind: string) {
    if (!isTermsKind(kind)) throw notFound();
    const d = await this.store.latestPublished(kind);
    if (!d) throw notFound();
    return publicView(d);
  }
  async versions(kind: string) {
    if (!isTermsKind(kind)) throw notFound();
    const rows = await this.store.publicVersions(kind);
    if (rows.length === 0) throw notFound();
    return { kind, versions: rows.map((d) => ({ version: d.version, status: d.status, title: d.title, publishedAt: d.publishedAt, changeNote: d.changeNote })) };
  }

  // ── staff (the role matrix lets SUPER_ADMIN only reach these) ─────────────────────────────────────────────────────────

  async list(f: { kind?: string; status?: string }) {
    if (f.kind !== undefined && !isTermsKind(f.kind)) throw invalid('That is not a document kind.');
    if (f.status !== undefined && !['DRAFT', 'PUBLISHED', 'RETIRED'].includes(f.status)) throw invalid('That is not a status.');
    const rows = await this.store.listDocuments({ kind: f.kind as TermsKind | undefined, status: f.status as TermsStatus | undefined });
    return { items: rows.map((d) => staffView(d, false)), kinds: TERMS_KINDS };
  }
  async get(id: string) {
    const d = await this.store.getDocument(String(id).slice(0, 64));
    if (!d) throw notFound();
    return staffView(d, true);
  }
  private checkText(body: unknown, title: unknown): { bodyMarkdown?: string; title?: string } {
    const out: { bodyMarkdown?: string; title?: string } = {};
    if (body !== undefined) {
      if (typeof body !== 'string' || body.trim() === '') throw invalid('The text is required.');
      if (body.length > MAX_BODY_CHARS) throw invalid(`The text is over ${MAX_BODY_CHARS} characters.`);
      out.bodyMarkdown = body;
    }
    if (title !== undefined) {
      if (typeof title !== 'string' || title.length > 200) throw invalid('The title is at most 200 characters.');
      out.title = title.trim();
    }
    return out;
  }
  private entry(actor: Actor, action: string, id: string | null, after: unknown): AuditEntry { return { actor, action, entityType: 'terms_document', entityId: id, before: null, after }; }

  async createDraft(kind: string, dto: { bodyMarkdown?: string; title?: string }, actor: Actor) {
    if (!isTermsKind(kind)) throw invalid('That is not a document kind.');
    const t = this.checkText(dto.bodyMarkdown ?? PLACEHOLDER_BODY, dto.title ?? '');
    const d = await this.store.createDraft({ kind, title: t.title ?? '', bodyMarkdown: t.bodyMarkdown ?? PLACEHOLDER_BODY, createdBy: actor.id }, this.entry(actor, 'terms.draft.create', null, { kind }));
    return staffView(d, true);
  }
  async updateDraft(id: string, dto: { bodyMarkdown?: string; title?: string }, actor: Actor) {
    const t = this.checkText(dto.bodyMarkdown, dto.title);
    if (t.bodyMarkdown === undefined && t.title === undefined) throw invalid('Nothing to change.');
    const cur = await this.store.getDocument(String(id).slice(0, 64));
    if (!cur) throw notFound();
    if (!canEdit(cur)) throw stateInvalid('Only a draft can be changed. Start a new version instead.');
    const d = await this.store.updateDraft(cur.id, t, this.entry(actor, 'terms.draft.update', cur.id, { kind: cur.kind, version: cur.version, fields: Object.keys(t) }));
    if (!d) throw stateInvalid('Only a draft can be changed. Start a new version instead.');
    return staffView(d, true);
  }
  async publish(id: string, changeNote: string | undefined, actor: Actor) {
    const cur = await this.store.getDocument(String(id).slice(0, 64));
    if (!cur) throw notFound();
    const check = canPublish(cur, changeNote);
    if (!check.ok) {
      if (check.reason === 'PLACEHOLDER') throw new UnprocessableEntityException(b3Error('TERMS_PLACEHOLDER', 'This document still has the placeholder text. Counsel must supply the real text first.'));
      if (check.reason === 'NOT_DRAFT') throw stateInvalid('Only a draft can be published.');
      throw invalid('A change note of at least 5 characters is required to publish.');
    }
    const d = await this.store.publish(cur.id, { by: actor.id, now: this.clock(), changeNote: String(changeNote).trim() }, this.entry(actor, 'terms.publish', cur.id, { kind: cur.kind, version: cur.version, changeNote: String(changeNote).trim() }));
    if (!d) throw stateInvalid('Only a draft can be published.');
    return staffView(d, true);
  }

  // ── the vendor ────────────────────────────────────────────────────────────────────────────────────────────────────────

  private async outstandingFor(vendorId: string, kinds: readonly TermsKind[]): Promise<Outstanding[]> {
    const published = await this.store.latestPublishedMany(kinds);
    const latest = new Map<TermsKind, PublishedRef>(published.map((p) => [p.kind, { documentId: p.id, kind: p.kind, version: p.version }]));
    const accepted = await this.store.acceptedDocumentIds(vendorId, published.map((p) => p.id));
    return outstanding(kinds, latest, accepted);
  }

  /** The vendor's terms screen: each required document, its current version and whether it is accepted. The text is read from the public route. */
  async status(vendorId: string) {
    const published = await this.store.latestPublishedMany(VENDOR_REQUIRED_KINDS);
    const accepted = await this.store.acceptedDocumentIds(vendorId, published.map((p) => p.id));
    const waiting = await this.outstandingFor(vendorId, VENDOR_REQUIRED_KINDS);
    return {
      acceptanceRequired: waiting.length > 0,
      documents: VENDOR_REQUIRED_KINDS.map((kind) => {
        const p = published.find((x) => x.kind === kind);
        return p ? { kind, version: p.version, title: p.title, published: true, accepted: accepted.has(p.id) } : { kind, version: null, title: null, published: false, accepted: false };
      }),
      outstanding: waiting.map((w) => ({ kind: w.kind, version: w.version })),
    };
  }

  private hash(label: string, v: string | null): string | null { return v ? createHmac('sha256', this.pepper.value()).update(`${label}:${v}`).digest('hex') : null; }

  /** The owner accepts the CURRENT versions. The request names each kind with its version, so an out-of-date screen cannot accept something the owner did not see. Idempotent. */
  async accept(vendorId: string, userId: string | null, claimed: ReadonlyArray<{ kind: string; version: number }>, ctx: RequestContext, actor: Actor) {
    const waiting = await this.outstandingFor(vendorId, VENDOR_REQUIRED_KINDS);
    if (waiting.length === 0) return { accepted: 0, acceptanceRequired: false };
    const m = acceptanceMatches(claimed, waiting);
    if (!m.ok) throw stateInvalid(m.reason);
    return this.record(vendorId, userId, waiting, ctx, actor);
  }
  private async record(vendorId: string, userId: string | null, docs: readonly Outstanding[], ctx: RequestContext, actor: Actor) {
    const refs: PublishedRef[] = docs.map((d) => ({ documentId: d.documentId, kind: d.kind, version: d.version }));
    const n = await this.store.recordAcceptances({
      vendorId, userId, docs: refs, ipHash: this.hash('ip', ctx.ip), userAgentHash: this.hash('ua', ctx.userAgent), now: this.clock(),
      audit: { actor, action: 'terms.accept', entityType: 'vendor', entityId: vendorId, before: null, after: { documents: refs.map((r) => ({ kind: r.kind, version: r.version })) } },
    });
    return { accepted: n, acceptanceRequired: (await this.outstandingFor(vendorId, VENDOR_REQUIRED_KINDS)).length > 0 };
  }

  /** The guard (AcceptanceGuard): throws 403 TERMS_ACCEPTANCE_REQUIRED naming what is waiting. A kind with nothing published asks for nothing. */
  async require(vendorId: string, kinds: readonly string[]): Promise<void> {
    const wanted = kinds.filter(isTermsKind);
    const waiting = await this.outstandingFor(vendorId, wanted);
    if (waiting.length > 0) {
      throw new ForbiddenException(b3Error('TERMS_ACCEPTANCE_REQUIRED', 'Please accept the current terms to continue.', { outstanding: waiting.map((w) => ({ kind: w.kind, version: w.version })) }));
    }
  }
  /** Same check, named for what the rest of the code reads: requireAcceptance(vendorId, kinds). */
  requireAcceptance(vendorId: string, kinds: readonly string[]): Promise<void> { return this.require(vendorId, kinds); }

  async acceptanceRequired(vendorId: string): Promise<boolean> { return (await this.outstandingFor(vendorId, VENDOR_REQUIRED_KINDS)).length > 0; }

  /**
   * Claim completion for a Free vendor (guard c): the vendor terms must be accepted before the account-setup grant is used up. The claimant has no session yet, so the claim step carries
   * the acceptance itself: `accepted === true` records it for the current version, anything else while a version is published is refused (and the grant is not spent).
   */
  async acceptAtClaim(vendorId: string, accepted: boolean, ctx: RequestContext): Promise<void> {
    const waiting = await this.outstandingFor(vendorId, CLAIM_REQUIRED_KINDS);
    if (waiting.length === 0) return;
    if (accepted !== true) throw new ForbiddenException(b3Error('TERMS_ACCEPTANCE_REQUIRED', 'Please accept the vendor terms to finish claiming your page.', { outstanding: waiting.map((w) => ({ kind: w.kind, version: w.version })) }));
    await this.record(vendorId, null, waiting, ctx, { type: 'VENDOR', id: null, ip: ctx.ip });
  }
}
