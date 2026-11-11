import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { b3Error } from '../b3-settings/b3-errors';
import { hashPhone, normalisePhoneE164 } from '../directory/core/otp';
import { OtpPepper } from '../directory/pepper';
import { Actor } from '../plans/admin/audit.service';
import { normaliseEmail } from '../provisioning/steps/business-input';
import { VendorLifecycleService } from '../vendor-lifecycle/vendor-lifecycle.service';
import { isVendorOfferedKind, maskUpiId } from '../v3-payments/core/method-core';
import { addressHash } from './core/messaging-core';
import { RequestFilter, ReportRow, RequestsStore } from './requests.store';

/** Staff side of slice 5.14: requests and events (read), the reports queue, the blocklist and the outbox. OPERATIONS and SUPER_ADMIN only (the role matrix); MARKETING is refused on all of it. */
@Injectable()
export class StaffRequestsService {
  clock: () => Date = () => new Date();
  constructor(private readonly store: RequestsStore, private readonly pepper: OtpPepper, @Inject(VendorLifecycleService) private readonly lifecycle: Pick<VendorLifecycleService, 'suspend'>) {}

  async requests(f: RequestFilter & { vendorId?: string }) {
    const r = await this.store.listRequests(f.vendorId ?? null, f);
    // a staff list shows what is needed to support the vendor; the customer's e-mail address stays in the vendor inbox
    return { items: r.items.map((x) => ({ id: x.id, vendorId: x.vendorId, kind: x.kind, status: x.status, siteHost: x.siteHost, source: x.sourceKind, spamScore: x.spamScore, createdAt: x.createdAt, firstResponseAt: x.firstResponseAt })), total: r.total };
  }
  async request(id: string) {
    const r = await this.store.getRequest(id);
    if (!r) throw new NotFoundException(b3Error('REQUEST_NOT_FOUND', 'That request does not exist.'));
    return { id: r.id, vendorId: r.vendorId, kind: r.kind, status: r.status, siteHost: r.siteHost, source: r.sourceKind, spamScore: r.spamScore, createdAt: r.createdAt, events: (await this.store.events(id)).map((e) => ({ type: e.type, actor: e.actorType, at: e.at, channel: e.channel, result: e.deliveryResult })) };
  }
  /** Read only. UPI ids are masked, bank details and secrets are never returned, gateway rows left by an earlier build are hidden. */
  async vendorMethods(vendorId: string) {
    return (await this.store.listMethods(vendorId)).filter((m) => isVendorOfferedKind(m.kind)).map((m) => ({ id: m.id, vendorId: m.vendorId, kind: m.kind, label: m.label, status: m.status, isDefault: m.isDefault, upiMasked: maskUpiId(m.upiId), payeeName: m.payeeName, verifiedAt: m.verifiedAt }));
  }
  async outbox(f: { vendorId?: string; requestId?: string; skip: number; take: number }) { return this.store.listOutbox(f); }

  async reports(f: { status?: ReportRow['status']; skip: number; take: number }) { return this.store.listReports(f); }
  /** Handle a report. ACTIONED with suspendVendorId suspends that vendor through the lifecycle service: public forms and checkout stop AT ONCE (the public routes read the vendor status on every call). */
  async handleReport(id: string, status: ReportRow['status'], actor: Actor, suspendVendorId?: string, reason?: string) {
    if (!['REVIEWED', 'ACTIONED', 'REJECTED'].includes(status)) throw new BadRequestException(b3Error('REQUEST_INVALID', 'The status must be REVIEWED, ACTIONED or REJECTED.'));
    if (suspendVendorId) { if (status !== 'ACTIONED') throw new BadRequestException(b3Error('REQUEST_INVALID', 'Suspending a vendor is an ACTIONED report.')); await this.lifecycle.suspend(suspendVendorId, actor, reason); }
    const r = await this.store.handleReport(id, status, actor.id, this.clock());
    if (!r) throw new NotFoundException(b3Error('REQUEST_NOT_FOUND', 'That report does not exist.'));
    await this.store.recordAudit(actor, 'report.handle', 'report', id, null, { status, suspended: !!suspendVendorId });
    return r;
  }

  // ── blocklist CRUD: stored as keyed hashes only ──
  async blocks(skip: number, take: number) { const r = await this.store.listBlocks(skip, take); return { items: r.items.map((b) => ({ id: b.id, kind: b.kind, hashPrefix: b.hash.slice(0, 10), reason: b.reason, at: b.at })), total: r.total }; }
  async addBlock(kind: 'PHONE' | 'EMAIL' | 'IP_HASH', value: string, reason: string, actor: Actor) {
    const why = typeof reason === 'string' ? reason.trim() : ''; if (why.length < 5 || why.length > 300) throw new BadRequestException(b3Error('LIFECYCLE_REASON_REQUIRED', 'A reason of 5 to 300 characters is required.'));
    const pepper = this.pepper.value(); let storedKind: 'PHONE_HASH' | 'EMAIL_HASH' | 'IP_HASH'; let hash: string;
    if (kind === 'PHONE') { const p = normalisePhoneE164(value); if (!p) throw new BadRequestException(b3Error('REQUEST_INVALID', 'That is not a valid phone number.')); storedKind = 'PHONE_HASH'; hash = hashPhone(p, pepper); }
    else if (kind === 'EMAIL') { const e = normaliseEmail(value); if (!e) throw new BadRequestException(b3Error('REQUEST_INVALID', 'That is not a valid e-mail address.')); storedKind = 'EMAIL_HASH'; hash = addressHash('EMAIL', e, pepper); }
    else { const h = this.pepper.hashIp(value); if (!h) throw new BadRequestException(b3Error('REQUEST_INVALID', 'That is not a valid address.')); storedKind = 'IP_HASH'; hash = h; }
    const row = await this.store.addBlock({ kind: storedKind, hash, reason: why, addedBy: actor.id }, this.clock());
    await this.store.recordAudit(actor, 'blocklist.add', 'blocklist', row.id, null, { kind: storedKind });
    return { id: row.id, kind: row.kind, hashPrefix: row.hash.slice(0, 10) };
  }
  async removeBlock(id: string, actor: Actor) {
    const ok = await this.store.removeBlock(id);
    if (!ok) throw new NotFoundException(b3Error('REQUEST_NOT_FOUND', 'That entry does not exist.'));
    await this.store.recordAudit(actor, 'blocklist.remove', 'blocklist', id, null, null);
    return { removed: true };
  }
}
