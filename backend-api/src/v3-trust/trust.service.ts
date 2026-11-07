import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHmac } from 'crypto';
import { OtpPepper } from '../directory/pepper';
import { ActivityService } from '../v3-activity/activity.service';
import {
  BlockKind, canMoveReport, comparePayeeName, matchProhibited, normaliseBlockValue, normaliseTerm, PayeeVerdict, ProofKind, ProofStatus, ReportStatus, ReportSubject, STAFF_PROOF_STATUSES,
} from './core/trust-core';
import {
  blockExists, takedownAlreadyActive, takedownForbidden, takedownNotActive, takedownReasonRequired, takedownTargetUnknown, termExists, trustInvalid, trustNotFound, trustStale,
} from './trust.errors';
import { PayeeNameCheckPort, ProhibitedScanPort, TakedownPort } from './trust.ports';
import { BlockRow, ProofRow, ReportRow, TakedownRow, TermRow, TrustStore } from './trust.store';
import { KeyedQueue } from '../common/keyed-queue';
import { rolesFor } from '../auth/guards/admin-role-matrix';

export interface StaffBy { id: string | null; ip: string | null; role?: string | null }
const clip = (s: unknown, n: number): string => String(s ?? '').trim().slice(0, n);
const paged = <T>(r: { items: T[]; total: number }, page: number, pageSize: number) => ({ items: r.items, page, pageSize, total: r.total });

/** Business proofs: optional at Pro activation, checked by staff. Missing proof is an attention item, never a refusal. */
@Injectable()
export class ProofsService {
  constructor(private readonly store: TrustStore) {}

  /** The vendor offers a document or a registration number. A new submission for the same kind replaces the old one and starts again at SUBMITTED. */
  async submit(vendorId: string, i: { kind: ProofKind; number: string; documentRef?: string | null }): Promise<ProofRow> {
    const number = clip(i.number, 64);
    if (number.length < 3) throw trustInvalid('The number is too short.');
    return this.store.upsertProof(vendorId, { kind: i.kind, number, documentRef: i.documentRef ? clip(i.documentRef, 300) : null });
  }
  mine(vendorId: string): Promise<ProofRow[]> { return this.store.proofsOfVendor(vendorId); }

  async list(f: { status?: ProofStatus; vendorId?: string }, page: number, pageSize: number) { return paged(await this.store.listProofs(f, (page - 1) * pageSize, pageSize), page, pageSize); }

  /** Staff mark a proof CHECKED or MISMATCH. `expectedStatus` is what they saw; a change made meanwhile is refused. A mismatch is a note for the team: nothing is blocked. */
  async review(id: string, by: StaffBy, i: { expectedStatus: ProofStatus; status: ProofStatus; note?: string | null }, now: Date = new Date()): Promise<ProofRow> {
    if (!STAFF_PROOF_STATUSES.includes(i.status)) throw trustInvalid('A proof can be marked CHECKED or MISMATCH.');
    if (!by.id) throw trustInvalid('A staff member is needed.');
    const cur = await this.store.getProof(id); if (!cur) throw trustNotFound('proof');
    if (cur.status !== i.expectedStatus) throw trustStale();
    const done = await this.store.reviewProof(id, cur.status, { status: i.status, checkedBy: by.id, note: i.note ? clip(i.note, 1000) : null, checkedAt: now });
    if (!done) throw trustStale();
    return done;
  }
}

/** The trust block list: values we refuse to deal with, kept as keyed hashes of their normalised form. */
@Injectable()
export class BlocklistService {
  constructor(private readonly store: TrustStore, private readonly pepper: OtpPepper) {}

  hash(kind: BlockKind, canonical: string): string { return createHmac('sha256', this.pepper.value()).update(`trust-block:${kind}:${canonical}`).digest('hex'); }

  async add(by: StaffBy, i: { kind: BlockKind; value: string; reason: string }): Promise<Omit<BlockRow, 'valueHash'>> {
    const canonical = normaliseBlockValue(i.kind, i.value);
    if (!canonical) throw trustInvalid(`That is not a usable ${i.kind.toLowerCase()} value.`);
    const reason = clip(i.reason, 500); if (reason.length < 3) throw trustInvalid('A reason is needed.');
    const row = await this.store.createBlock({ kind: i.kind, valueHash: this.hash(i.kind, canonical), reason, staffId: by.id });
    if (!row) throw blockExists();
    const { valueHash: _h, ...rest } = row; return rest;
  }
  async list(f: { kind?: BlockKind }, page: number, pageSize: number) {
    const r = await this.store.listBlocks(f, (page - 1) * pageSize, pageSize);
    return paged({ items: r.items.map(({ valueHash: _h, ...rest }) => rest), total: r.total }, page, pageSize);
  }
  async remove(id: string): Promise<void> { if (!(await this.store.deleteBlock(id))) throw trustNotFound('block list entry'); }
  async isBlocked(kind: BlockKind, value: string): Promise<boolean> { const c = normaliseBlockValue(kind, value); return !!c && !!(await this.store.findBlock(kind, this.hash(kind, c))); }
}

const maskContact = (v: string | null): string | null => (v === null ? null : /@/.test(v) ? v.replace(/^(.).*(@.*)$/, '$1***$2') : v.replace(/\D/g, '').length >= 6 ? '*'.repeat(Math.max(0, v.replace(/\D/g, '').length - 2)) + v.replace(/\D/g, '').slice(-2) : '[masked]');

/** Reports from the public. No personal data is required; the answer is always the same so a report is never an oracle for what exists. */
@Injectable()
export class ReportsService {
  constructor(private readonly store: TrustStore, @Optional() private readonly pepper?: OtpPepper) {}

  /** Always resolves with nothing: a bad report is dropped quietly. */
  async submit(i: { subjectType: ReportSubject; subject: string; reason: string; contact?: string | null }, ip: string | null): Promise<void> {
    const subject = clip(i.subject, 253).toLowerCase(); const reason = clip(i.reason, 2000);
    if (!subject || reason.length < 5) return;
    await this.store.createReport({ subjectType: i.subjectType, subject, reporterContact: i.contact ? clip(i.contact, 200) : null, reason, ipHash: this.pepper?.hashIp(ip) ?? null });
  }
  async list(f: { status?: ReportStatus }, page: number, pageSize: number) {
    const r = await this.store.listReports(f, (page - 1) * pageSize, pageSize);
    return paged({ items: r.items.map(({ ipHash: _ip, reporterContact, ...rest }) => ({ ...rest, reporterContact: maskContact(reporterContact) })), total: r.total }, page, pageSize);
  }
  async update(id: string, by: StaffBy, i: { expectedStatus: ReportStatus; status?: ReportStatus; note?: string | null }): Promise<Omit<ReportRow, 'ipHash'>> {
    const cur = await this.store.getReport(id); if (!cur) throw trustNotFound('report');
    if (cur.status !== i.expectedStatus) throw trustStale();
    if (i.status && i.status !== cur.status && !canMoveReport(cur.status, i.status)) throw trustInvalid(`A report that is ${cur.status} cannot go to ${i.status}.`);
    const done = await this.store.updateReport(id, cur.status, { ...(i.status ? { status: i.status } : {}), ...(i.note !== undefined ? { note: i.note === null ? null : clip(i.note, 2000) } : {}), handledByStaffId: by.id });
    if (!done) throw trustStale();
    const { ipHash: _ip, ...rest } = done; return { ...rest, reporterContact: maskContact(done.reporterContact) };
  }
}

/** The prohibited-phrase table (SUPER_ADMIN) and the scan that uses it. */
@Injectable()
export class TermsService {
  constructor(private readonly store: TrustStore) {}
  list(): Promise<TermRow[]> { return this.store.listTerms(); }
  async create(by: StaffBy, i: { term: string; category: string; enabled?: boolean }): Promise<TermRow> {
    const term = normaliseTerm(i.term); if (term.length < 2) throw trustInvalid('The phrase is too short.');
    const category = clip(i.category, 60); if (category.length < 2) throw trustInvalid('A category is needed.');
    const row = await this.store.createTerm({ term, category, enabled: i.enabled ?? true, editedBy: by.id });
    if (!row) throw termExists(); return row;
  }
  async update(id: string, by: StaffBy, i: { term?: string; category?: string; enabled?: boolean }): Promise<TermRow> {
    const term = i.term !== undefined ? normaliseTerm(i.term) : undefined; if (term !== undefined && term.length < 2) throw trustInvalid('The phrase is too short.');
    const category = i.category !== undefined ? clip(i.category, 60) : undefined; if (category !== undefined && category.length < 2) throw trustInvalid('A category is needed.');
    const r = await this.store.updateTerm(id, { ...(term !== undefined ? { term } : {}), ...(category !== undefined ? { category } : {}), ...(i.enabled !== undefined ? { enabled: i.enabled } : {}), editedBy: by.id });
    if (r === 'DUPLICATE') throw termExists(); if (!r) throw trustNotFound('phrase'); return r;
  }
  async remove(id: string): Promise<void> { if (!(await this.store.deleteTerm(id))) throw trustNotFound('phrase'); }
}

/**
 * The scan runs on publish and on request. A match raises a PROHIBITED_TEXT alert through the activity log (the alert rule decides whether it is on) and NEVER blocks or hides anything.
 * It never throws, and it never stores the text: only the matched phrases, their categories and where it happened.
 */
@Injectable()
export class TrustScanService extends ProhibitedScanPort {
  private readonly logger = new Logger(TrustScanService.name);
  constructor(private readonly store: TrustStore, private readonly activity: ActivityService) { super(); }

  async scan(vendorId: string, source: 'PUBLISH' | 'REQUEST', texts: readonly string[]): Promise<void> {
    try {
      const matches = matchProhibited(texts, await this.store.listTerms());
      if (!matches.length) return;
      await this.activity.record({ vendorId, actor: { type: 'SYSTEM', id: null }, actionKey: 'prohibited_text.matched', entityType: 'prohibited_text', summary: { source, matches: matches.slice(0, 20), count: matches.length } });
    } catch (e) { this.logger.warn(`prohibited scan failed (${source}): ${e instanceof Error ? e.name : 'error'}`); }
  }
}

/** The fake payee-name check for the payment slice. A MISMATCH is recorded as an activity row (the PAYEE_NAME_MISMATCH rule turns it into an alert) and never blocks. */
@Injectable()
export class FakePayeeNameCheck extends PayeeNameCheckPort {
  private readonly logger = new Logger(FakePayeeNameCheck.name);
  constructor(private readonly store: TrustStore, private readonly activity: ActivityService) { super(); }
  async check(vendorId: string, payeeName: string | null | undefined): Promise<PayeeVerdict> {
    try {
      const verdict = comparePayeeName(payeeName, await this.store.namesOfVendor(vendorId));
      if (verdict === 'MISMATCH') await this.activity.record({ vendorId, actor: { type: 'SYSTEM', id: null }, actionKey: 'payee_name.mismatch', entityType: 'payment_method', summary: { payeeName: String(payeeName ?? '').slice(0, 80) } });
      return verdict;
    } catch (e) { this.logger.warn(`payee check failed: ${e instanceof Error ? e.name : 'error'}`); return 'UNKNOWN'; }
  }
}

export const takedownQueue = new KeyedQueue();

/**
 * Legal takedown (owner rule 6, the only way besides the vendor's own request that a site is hidden). Only SUPER_ADMIN creates or reverses one; a written reason is required both ways. The store
 * applies the takedown and the change to the listing in ONE unit. While it is ACTIVE the site serves a plain notice, the listing is out of the directory, and the vendor can read the reason.
 * REVERSAL is a decision (OPEN QUESTION for the owner): it ends the notice and puts the listing back as it was; it needs its own written reason and stays on record.
 */
@Injectable()
export class TakedownService extends TakedownPort {
  clock: () => Date = () => new Date();
  constructor(private readonly store: TrustStore, @Optional() private readonly activity?: ActivityService) { super(); }

  /** Defence in depth: the route guard already refused anyone else. The roles come from the central role matrix (the one place that says who may do what), not from a literal here. */
  private static assertMayDecide(by: StaffBy, routeKey: string): string { if (!by.id || !by.role || !(rolesFor(routeKey) as readonly string[]).includes(by.role)) throw takedownForbidden(); return by.id; }

  async create(by: StaffBy, i: { vendorId?: string | null; listingId?: string | null; reason: string; documentRef?: string | null }): Promise<TakedownRow> {
    const staffId = TakedownService.assertMayDecide(by, 'POST /v3/admin/takedowns');
    const reason = clip(i.reason, 2000); if (!reason) throw takedownReasonRequired();
    const vendorId = i.vendorId ? clip(i.vendorId, 64) : null; const listingId = i.listingId ? clip(i.listingId, 64) : null;
    if (!vendorId && !listingId) throw trustInvalid('Name the business or the listing.');
    const r = await takedownQueue.run(`takedown:${vendorId ?? listingId}`, () => this.store.createTakedown({ vendorId, listingId, reason, documentRef: i.documentRef ? clip(i.documentRef, 300) : null, decidedBy: staffId, now: this.clock() }));
    if (!r.ok) throw r.why === 'ALREADY_ACTIVE' ? takedownAlreadyActive() : takedownTargetUnknown();
    await this.note('takedown.created', r.row, by);
    return r.row;
  }

  async reverse(id: string, by: StaffBy, i: { reason: string }): Promise<TakedownRow> {
    const staffId = TakedownService.assertMayDecide(by, 'POST /v3/admin/takedowns/:id/reverse');
    const reason = clip(i.reason, 2000); if (!reason) throw takedownReasonRequired();
    const cur = await this.store.getTakedown(id); if (!cur) throw trustNotFound('takedown');
    if (cur.status !== 'ACTIVE') throw takedownNotActive();
    const done = await takedownQueue.run(`takedown:${cur.vendorId ?? cur.listingId}`, () => this.store.reverseTakedown(id, { reversedBy: staffId, reverseReason: reason, now: this.clock() }));
    if (!done) throw takedownNotActive();
    await this.note('takedown.reversed', done, by);
    return done;
  }

  /** The semantic row for the vendor's own history (the route row carries no vendor). The reason itself is not copied into the log: only that one was written. */
  private async note(actionKey: string, t: TakedownRow, by: StaffBy): Promise<void> {
    await this.activity?.record({ vendorId: t.vendorId, actor: { type: 'STAFF', id: by.id, ip: by.ip }, actionKey, entityType: 'takedown', entityId: t.id, summary: { target: t.vendorId ? 'vendor' : 'listing', listingId: t.listingId, hasDocument: !!t.documentRef } });
  }

  async list(f: { status?: 'ACTIVE' | 'REVERSED'; vendorId?: string }, page: number, pageSize: number) { return paged(await this.store.listTakedowns(f, (page - 1) * pageSize, pageSize), page, pageSize); }

  /** What the vendor sees about their own takedown: that it is in force, and why. */
  async mine(vendorId: string): Promise<{ active: boolean; reason: string | null; at: Date | null }> {
    const t = await this.store.activeTakedownOfVendor(vendorId);
    return { active: !!t, reason: t?.reason ?? null, at: t?.at ?? null };
  }

  async activeForVendor(vendorId: string): Promise<boolean> { return !!(await this.store.activeTakedownOfVendor(vendorId)); }
}
