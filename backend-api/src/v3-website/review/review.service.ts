import { ConflictException, Inject, Injectable, NotFoundException, Optional, UnprocessableEntityException } from '@nestjs/common';
import { ActivityService } from '../../v3-activity/activity.service';
import { ActivityStore } from '../../v3-activity/activity.store';
import { Actor } from '../../plans/admin/audit.service';
import { ProhibitedScanPort } from '../../v3-trust/trust.ports';
import { diffDocs, DocDiff, hashDoc, ManagedDoc } from '../core/managed-doc';
import { reasonProblem, SubmissionStatus, textsOf } from '../core/review-core';
import { nothingToPublish, wmBody } from '../website.errors';
import { WebsiteService } from '../website.service';
import { ReviewStore, SubmissionFilter, SubmissionRow } from './review.store';

/** Tells people about a submission: staff roles when one arrives, the vendor when it is decided. The Prisma binding writes the in-app notice rows of the activity module. */
export abstract class ReviewNotifier {
  abstract notify(n: { userId: string | null; role: string | null; kind: string; refId: string }): Promise<void>;
}
@Injectable()
export class ActivityReviewNotifier extends ReviewNotifier {
  constructor(private readonly store: ActivityStore) { super(); }
  async notify(n: { userId: string | null; role: string | null; kind: string; refId: string }): Promise<void> { await this.store.insertNotification(n); }
}

const STAFF_ROLES = ['OPERATIONS', 'SUPER_ADMIN'] as const;
const pending = (): ConflictException => new ConflictException(wmBody('SUBMISSION_PENDING', 'You already have changes waiting for review. Wait for the decision before sending more.'));
const notOpen = (): ConflictException => new ConflictException(wmBody('SUBMISSION_NOT_OPEN', 'That submission has already been decided.'));
const notFound = (): NotFoundException => new NotFoundException(wmBody('SUBMISSION_NOT_FOUND', 'That submission does not exist.'));
const reasonRequired = (message: string): UnprocessableEntityException => new UnprocessableEntityException(wmBody('REASON_REQUIRED', message, { field: 'reason' }));

export interface SubmissionView { id: string; scope: string; status: SubmissionStatus; submittedAt: string; decidedAt: string | null; reason: string | null; changed: DocDiff }
export interface AdminSubmissionView extends SubmissionView { vendorId: string; reviewerId: string | null; submittedById: string | null }
const view = (s: SubmissionRow): SubmissionView => ({ id: s.id, scope: s.scope, status: s.status, submittedAt: s.submittedAt.toISOString(), decidedAt: s.decidedAt?.toISOString() ?? null, reason: s.reason, changed: s.changed });
const adminView = (s: SubmissionRow): AdminSubmissionView => ({ ...view(s), vendorId: s.vendorId, reviewerId: s.reviewerId, submittedById: s.submittedById });

/**
 * Free edits go to review (slice 5.5c, amendment 06). A Free vendor's "publish" is a submission: the whole draft is validated, scanned for prohibited terms (alert only), stored, and staff
 * are told. Nothing reaches the live site until staff approve; the live site keeps the last approved content. Approving builds from the SUBMITTED payload (not from a later draft) and
 * publishes it through the same pipeline; rejecting records the reason. A Pro vendor never makes a submission: its edits go live at once. Decisions run in the vendor's queue slot, so two
 * staff deciding at once cannot both win.
 */
@Injectable()
export class ReviewService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly store: ReviewStore, private readonly web: WebsiteService, private readonly notifier: ReviewNotifier,
    @Optional() private readonly activity?: ActivityService, @Optional() @Inject(ProhibitedScanPort) private readonly scan?: ProhibitedScanPort,
  ) {}

  /** The vendor's Publish button: Pro goes live, Free is sent for review. */
  async publishOrSubmit(vendorId: string, actor: Actor): Promise<{ mode: 'LIVE'; unchanged: boolean; publication: unknown } | { mode: 'SUBMITTED'; submission: SubmissionView }> {
    if (await this.web.isProVendor(vendorId)) { const r = await this.web.publish(vendorId, actor); return { mode: 'LIVE', unchanged: r.unchanged, publication: r.publication }; }
    return { mode: 'SUBMITTED', submission: await this.submit(vendorId, actor) };
  }

  submit(vendorId: string, actor: Actor): Promise<SubmissionView> {
    return this.web.runLocked(vendorId, async () => {
      const { draft, live } = await this.web.draftAndLive(vendorId);
      if (hashDoc(draft) === hashDoc(live)) throw nothingToPublish();
      if ((await this.store.listForVendor(vendorId, 1))[0]?.status === 'SUBMITTED') throw pending();   // the newest submission is the only one that can be waiting
      await this.web.checkDoc(vendorId, draft);
      await this.scan?.scan(vendorId, 'SUBMIT', textsOf(draft)).catch(() => undefined);   // alert only, never blocks
      const row = await this.store.create({ vendorId, payload: draft, payloadHash: hashDoc(draft), changed: diffDocs(live, draft), submittedById: actor.id }, this.clock());
      if (!row) throw pending();
      for (const role of STAFF_ROLES) await this.notifier.notify({ userId: null, role, kind: 'CONTENT_SUBMITTED', refId: row.id });
      await this.activity?.record({ vendorId, actor: { type: actor.type, id: actor.id, ip: actor.ip }, actionKey: 'content_submission.submitted', entityType: 'content_submission', entityId: row.id, summary: { changedFields: row.changed.fields.length, changedLists: row.changed.lists.length } });
      return view(row);
    });
  }

  async mine(vendorId: string): Promise<SubmissionView[]> { return (await this.store.listForVendor(vendorId, 50)).map(view); }
  async mineOne(vendorId: string, id: string): Promise<SubmissionView> { const s = await this.store.getForVendor(vendorId, id); if (!s) throw notFound(); return view(s); }

  async adminList(f: SubmissionFilter & { page: number; pageSize: number }): Promise<{ items: AdminSubmissionView[]; page: number; pageSize: number; total: number }> {
    const r = await this.store.list({ status: f.status, vendorId: f.vendorId }, (f.page - 1) * f.pageSize, f.pageSize);
    return { items: r.items.map(adminView), page: f.page, pageSize: f.pageSize, total: r.total };
  }
  async adminGet(id: string): Promise<AdminSubmissionView & { payload: ManagedDoc }> { const s = await this.store.get(id); if (!s) throw notFound(); return { ...adminView(s), payload: s.payload }; }

  /** Approve: build from the submitted payload and publish. If the publish fails the submission stays waiting and the error goes to the staff member. */
  async approve(id: string, staff: Actor): Promise<AdminSubmissionView> {
    const first = await this.store.get(id); if (!first) throw notFound();
    return this.web.runLocked(first.vendorId, async () => {
      const cur = await this.store.get(id);
      if (!cur) throw notFound();
      if (cur.status !== 'SUBMITTED') throw notOpen();
      const r = await this.web.publishDocLocked(cur.vendorId, staff, cur.payload);
      const done = await this.store.decide(id, 'APPROVED', { reviewerId: staff.id, reason: null, at: this.clock() });
      if (!done) throw notOpen();
      await this.notifier.notify({ userId: cur.vendorId, role: null, kind: 'CONTENT_APPROVED', refId: id });
      await this.activity?.record({ vendorId: cur.vendorId, actor: { type: 'STAFF', id: staff.id, ip: staff.ip }, actionKey: 'content_submission.approved', entityType: 'content_submission', entityId: id, summary: { version: r.publication?.version ?? null } });
      return adminView(done);
    });
  }

  /** Reject with a reason the vendor can read. The old content stays live. */
  async reject(id: string, staff: Actor, reason: unknown): Promise<AdminSubmissionView> {
    const problem = reasonProblem(reason);
    if (problem) throw reasonRequired(problem);
    const first = await this.store.get(id); if (!first) throw notFound();
    return this.web.runLocked(first.vendorId, async () => {
      const done = await this.store.decide(id, 'REJECTED', { reviewerId: staff.id, reason: String(reason).trim(), at: this.clock() });
      if (!done) throw notOpen();
      await this.notifier.notify({ userId: done.vendorId, role: null, kind: 'CONTENT_REJECTED', refId: id });
      await this.activity?.record({ vendorId: done.vendorId, actor: { type: 'STAFF', id: staff.id, ip: staff.ip }, actionKey: 'content_submission.rejected', entityType: 'content_submission', entityId: id, summary: { reasonLength: String(reason).trim().length } });
      return adminView(done);
    });
  }
}
