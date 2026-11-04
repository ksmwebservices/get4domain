import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { b3Error } from '../b3-settings/b3-errors';
import { B3SettingsService } from '../b3-settings/b3-settings.service';
import { normalisePhoneE164, hashPhone } from '../directory/core/otp';
import { OtpPepper } from '../directory/pepper';
import { Actor } from '../plans/admin/audit.service';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { PlansRepository } from '../plans/entitlements/plans.repository';
import { SubscriptionsService } from '../plans/subscriptions/subscriptions.service';
import { cleanReason, emptyListingCheck, extendedGraceEnd } from './core/lifecycle-core';
import { DeletionRequestRow, DeletionStatus, LifecycleStore } from './lifecycle.store';

const needReason = (reason: unknown): string => {
  const r = cleanReason(reason);
  if (!r) throw new BadRequestException(b3Error('LIFECYCLE_REASON_REQUIRED', 'A reason of 5 to 300 characters is required.'));
  return r;
};
const unknown = (): NotFoundException => new NotFoundException(b3Error('LIFECYCLE_STATE_INVALID', 'That vendor does not exist.'));
const DAY = 86_400_000;

/**
 * Staff lifecycle actions (slice 5.1d, owner rule 9). Every action needs a reason and is audited with the staff member. NOTHING stored by the vendor is deleted or modified by any
 * action except a permanent removal (and that only marks rows REMOVED and adds register rows): the chosen Pro theme, content, products, requests, orders, payment methods, offers
 * and domain records stay and come back when Pro is active again.
 */
@Injectable()
export class VendorLifecycleService {
  clock: () => Date = () => new Date();

  constructor(
    private readonly store: LifecycleStore, private readonly subscriptions: Pick<SubscriptionsService, 'assignPlan'>, private readonly entitlements: Pick<EntitlementsService, 'invalidate'>,
    private readonly plans: Pick<PlansRepository, 'loadCatalogue'>, private readonly settings: Pick<B3SettingsService, 'get'>, private readonly pepper: Pick<OtpPepper, 'value'>,
  ) {}

  private async vendorOrThrow(vendorId: string) { const v = await this.store.vendor(vendorId); if (!v) throw unknown(); return v; }
  private audit(actor: Actor, action: string, vendorId: string, before: unknown, after: unknown, reason: string) {
    return { actor, action, entityType: 'vendor', entityId: vendorId, before, after: { ...(after as object), reason } };
  }

  /** Staff view of where a vendor stands (no personal data beyond the business name). */
  async state(vendorId: string) {
    const v = await this.vendorOrThrow(vendorId);
    const sub = await this.store.currentSubscription(vendorId);
    return { vendorId, businessName: v.businessName, vendorStatus: v.status, removed: await this.store.isRemoved(vendorId), subscription: sub && { planKey: sub.planKey, level: sub.level, status: sub.status, endsAt: sub.endsAt, graceEndsAt: sub.graceEndsAt } };
  }

  async convertToFree(vendorId: string, actor: Actor, reasonIn: unknown) {
    const reason = needReason(reasonIn);
    await this.vendorOrThrow(vendorId);
    const sub = await this.store.currentSubscription(vendorId);
    if (!sub) throw new ConflictException(b3Error('LIFECYCLE_NO_SUBSCRIPTION', 'The vendor has no plan to convert.'));
    const freeKey = `${sub.track}_free`;
    if (sub.level === 'FREE') return { converted: false, planKey: sub.planKey };   // already Free: nothing to record
    const created = await this.subscriptions.assignPlan({ vendorId, planKey: freeKey, source: 'STAFF', actor, reason: `formal conversion to Free: ${reason}` });
    this.entitlements.invalidate(vendorId);
    await this.store.recordAudit(this.audit(actor, 'lifecycle.convert_to_free', vendorId, { planKey: sub.planKey }, { planKey: freeKey, subscriptionId: created.id }, reason));
    return { converted: true, planKey: freeKey };
  }

  async restorePro(vendorId: string, actor: Actor, reasonIn: unknown, o: { planKey?: string; termMonths?: number } = {}) {
    const reason = needReason(reasonIn);
    await this.vendorOrThrow(vendorId);
    const last = await this.store.latestProSubscription(vendorId);
    const planKey = o.planKey ?? last?.planKey;
    const termMonths = o.termMonths ?? last?.termMonths ?? undefined;
    if (!planKey || !/_pro$/.test(planKey)) throw new BadRequestException(b3Error('LIFECYCLE_STATE_INVALID', 'Give the Pro plan to restore; this vendor has never had one.'));
    const cur = await this.store.currentSubscription(vendorId);
    if (cur && cur.track !== planKey.split('_')[0]) throw new BadRequestException(b3Error('LIFECYCLE_STATE_INVALID', 'The plan must belong to the vendor\'s own track.'));
    const created = await this.subscriptions.assignPlan({ vendorId, planKey, termMonths, source: 'STAFF', actor, reason: `Pro restored: ${reason}` });
    this.entitlements.invalidate(vendorId);
    await this.store.recordAudit(this.audit(actor, 'lifecycle.restore_pro', vendorId, { planKey: cur?.planKey ?? null }, { planKey, subscriptionId: created.id, endsAt: created.endsAt }, reason));
    return { restored: true, planKey, endsAt: created.endsAt };
  }

  async extendGrace(vendorId: string, actor: Actor, reasonIn: unknown, days: number) {
    const reason = needReason(reasonIn);
    await this.vendorOrThrow(vendorId);
    const sub = await this.store.currentSubscription(vendorId);
    if (!sub || sub.level !== 'PRO' || !sub.endsAt) throw new ConflictException(b3Error('LIFECYCLE_STATE_INVALID', 'Only a Pro subscription with an end date has a grace period.'));
    const [s, cat] = await Promise.all([this.settings.get(), this.plans.loadCatalogue()]);
    let end: Date;
    try { end = extendedGraceEnd({ endsAt: sub.endsAt, graceEndsAt: sub.graceEndsAt, graceDays: cat.settings.graceDays, now: this.clock(), addDays: days, maxDays: s.graceExtendMaxDays }); } catch (e) { throw new BadRequestException(b3Error('LIFECYCLE_STATE_INVALID', (e as Error).message)); }
    await this.store.setGraceEnd(sub.id, end, this.audit(actor, 'lifecycle.extend_grace', vendorId, { graceEndsAt: sub.graceEndsAt }, { graceEndsAt: end, days }, reason));
    this.entitlements.invalidate(vendorId);
    return { graceEndsAt: end };
  }

  async suspend(vendorId: string, actor: Actor, reasonIn: unknown) {
    const reason = needReason(reasonIn);
    const v = await this.vendorOrThrow(vendorId);
    if (v.status === 'SUSPENDED') return { status: 'SUSPENDED', changed: false };
    await this.store.setVendorStatus(vendorId, 'SUSPENDED', this.audit(actor, 'lifecycle.suspend', vendorId, { status: v.status }, { status: 'SUSPENDED' }, reason));
    this.entitlements.invalidate(vendorId);
    return { status: 'SUSPENDED', changed: true };
  }

  async reinstate(vendorId: string, actor: Actor, reasonIn: unknown) {
    const reason = needReason(reasonIn);
    const v = await this.vendorOrThrow(vendorId);
    if (v.status !== 'SUSPENDED') throw new ConflictException(b3Error('LIFECYCLE_STATE_INVALID', 'Only a suspended vendor can be reinstated.'));
    await this.store.setVendorStatus(vendorId, 'ACTIVE', this.audit(actor, 'lifecycle.reinstate', vendorId, { status: 'SUSPENDED' }, { status: 'ACTIVE' }, reason));
    this.entitlements.invalidate(vendorId);
    return { status: 'ACTIVE', changed: true };
  }

  /** Path (b): staff delete an EMPTY listing. Refused, with the list of what exists, otherwise. */
  async deleteEmptyListing(vendorId: string, actor: Actor, reasonIn: unknown) {
    const reason = needReason(reasonIn);
    await this.vendorOrThrow(vendorId);
    if (await this.store.isRemoved(vendorId)) return { removed: true, alreadyRemoved: true };
    const check = emptyListingCheck(await this.store.listingFacts(vendorId));
    if (!check.empty) throw new ConflictException(b3Error('LIFECYCLE_NOT_EMPTY', 'This listing has business details, so staff cannot delete it. Only the owner can ask for it to be removed.', { existing: check.existing }));
    const sub = await this.store.currentSubscription(vendorId);
    if (sub && sub.level === 'PRO' && (!sub.endsAt || sub.endsAt.getTime() > this.clock().getTime())) {
      throw new ConflictException(b3Error('LIFECYCLE_STATE_INVALID', 'This vendor has a running paid plan. Convert them to the Free plan first.'));
    }
    const r = await this.store.executeRemoval({
      vendorId, kind: 'STAFF_EMPTY_LISTING', reason, phoneHash: null, requestedBy: null, executedBy: actor.id,
      audit: this.audit(actor, 'lifecycle.delete_empty_listing', vendorId, { removed: false }, { removed: true, kind: 'STAFF_EMPTY_LISTING' }, reason),
    });
    this.entitlements.invalidate(vendorId);
    return { removed: true, alreadyRemoved: r.alreadyRemoved };
  }

  // ── the vendor-requested deletion queue (staff side) ──

  async listDeletions(f: { status?: DeletionStatus; skip: number; take: number }) { return this.store.listDeletions(f); }
  async getDeletion(id: string): Promise<DeletionRequestRow> {
    const r = await this.store.getDeletion(id);
    if (!r) throw new NotFoundException(b3Error('DELETION_NOT_FOUND', 'That request does not exist.'));
    return r;
  }

  /** Path (a): execute the owner's request. Permanent: the site and the listing disappear (uniform 404 / 410), the phone hash joins the register, nothing is hard-deleted. Idempotent. */
  async executeDeletion(id: string, actor: Actor, reasonIn: unknown) {
    const reason = needReason(reasonIn);
    const req = await this.getDeletion(id);
    if (req.status === 'EXECUTED') return { executed: true, alreadyRemoved: true, vendorId: req.vendorId };
    if (req.status !== 'PENDING') throw new ConflictException(b3Error('LIFECYCLE_STATE_INVALID', 'That request is not waiting.'));
    const v = await this.store.vendor(req.vendorId);
    const phone = v?.phone ? normalisePhoneE164(v.phone) : null;
    const r = await this.store.executeRemoval({
      vendorId: req.vendorId, kind: 'VENDOR_REQUEST', reason, phoneHash: phone ? hashPhone(phone, this.pepper.value()) : null, requestedBy: req.requestedById, deletionRequestId: req.id, executedBy: actor.id,
      audit: { actor, action: 'lifecycle.execute_deletion', entityType: 'account_deletion_request', entityId: req.id, before: { status: 'PENDING' }, after: { status: 'EXECUTED', vendorId: req.vendorId, reason } },
    });
    this.entitlements.invalidate(req.vendorId);
    return { executed: true, alreadyRemoved: r.alreadyRemoved, vendorId: req.vendorId, retained: RETAINED_RECORDS };
  }
}

/**
 * Records kept after a permanent removal, because the law or the audit trail needs them. Personal-data erasure follows the existing retention settings and is a separate, documented
 * job; nothing below is deleted by this flow.
 */
export const RETAINED_RECORDS = ['plan invoices and payment records (tax law)', 'terms acceptance rows (immutable)', 'audit log rows', 'the removal record and the hashed phone in the register'] as const;

export { DAY };
