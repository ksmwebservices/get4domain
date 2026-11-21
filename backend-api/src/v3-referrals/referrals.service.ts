import { Injectable, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PlanPaidHook, PlanPaidInfo, PlanReversedInfo } from '../plan-billing/plan-paid.hook';
import { ReferralAttributionPort } from '../plans/registration/referral-attribution.port';
import { ActivityService } from '../v3-activity/activity.service';
import { PartnersStore } from '../v3-partners/partners.store';
import { checkPayoutReference, checkTds, closeMonth, defaultTds, codeFromBytes, CloseResult, isMonth, isSelfReferral, LedgerStatus, monthEnd, monthOf, normaliseCode, payoutTotal, rupeesText, slabProblems, toCsv } from './core/referral-core';
import { referralError } from './referrals.errors';
import { LedgerRow, PayoutRow, ReferralsStore, SlabRow } from './referrals.store';
import { CommissionSettingsPort } from './settings/commission-settings';

export interface StaffActor { id: string | null; ip?: string | null }
const MAX_DRAWS = 6;
const lineView = (l: LedgerRow) => ({ id: l.id, partnerId: l.partnerId, vendorId: l.vendorId, month: l.month, orderId: l.orderId, qualifiedAt: l.qualifiedAt, amountMinor: l.amountMinor, status: l.status, flagged: l.flagged, flagReason: l.flagReason, approvedAt: l.approvedAt, payoutId: l.payoutId, kind: l.kind, adjustsLineId: l.adjustsLineId });
const slabView = (s: SlabRow) => ({ id: s.id, minVendors: s.minVendors, maxVendors: s.maxVendors, amountPerVendorMinor: s.amountPerVendorMinor, effectiveFrom: s.effectiveFrom });

/**
 * Referrals and commission (Wave 3 Part I). See core/referral-core.ts for the rules. This class holds the actions: issue and disable a link, resolve a code, attribute a vendor (first touch wins, self-referral
 * refused, only SUPER_ADMIN changes one), make a ledger line on the first paid plan payment, reverse it, edit the slabs, close a month, record a payout, and the partner's own read-only views (which never carry a
 * contact detail). Staff writes are audited. It never moves money and never computes tax.
 */
@Injectable()
export class ReferralsService extends PlanPaidHook implements ReferralAttributionPort {
  clock: () => Date = () => new Date();
  /** overridable in tests */
  draw: (n: number) => Uint8Array = (n) => randomBytes(n);
  constructor(private readonly store: ReferralsStore, private readonly partners: PartnersStore, @Optional() private readonly activity?: ActivityService, @Optional() private readonly settings?: CommissionSettingsPort) { super(); }

  private async record(actionKey: string, entityType: string, entityId: string, actor: StaffActor | null, summary: Record<string, unknown>): Promise<void> {
    try { await this.activity?.record({ vendorId: null, actor: actor ? { type: 'STAFF', id: actor.id, ip: actor.ip ?? null } : { type: 'SYSTEM', id: null, ip: null }, actionKey, entityType, entityId, summary }); } catch { /* an audit-log failure never undoes the business action */ }
  }

  // ─────────────────────────────────────────────────────────────────────────── links and codes
  async issueLink(partnerId: string, actor: StaffActor) {
    const p = await this.partners.get(partnerId);
    if (!p) throw referralError(404, 'REFERRAL_LINK_NOT_FOUND', 'That partner does not exist.');
    if (p.status !== 'ACTIVE') throw referralError(409, 'REFERRAL_PARTNER_INACTIVE', 'That partner is disabled, so it cannot be given a new link.');
    for (let i = 0; i < MAX_DRAWS; i++) {
      const code = codeFromBytes(this.draw(32));
      if (!code) continue;
      const row = await this.store.createLink(partnerId, code, actor.id);
      if (row) { await this.record('referral.link.issued', 'ReferralLink', row.id, actor, { partnerId }); return row; }
    }
    throw referralError(503, 'REFERRAL_CODE_FAILED', 'A new code could not be made just now. Please try again.');
  }

  async disableLink(linkId: string, actor: StaffActor) {
    const row = await this.store.setLinkActive(linkId, false, this.clock());
    if (!row) throw referralError(404, 'REFERRAL_LINK_NOT_FOUND', 'That link does not exist.');
    await this.record('referral.link.disabled', 'ReferralLink', row.id, actor, { partnerId: row.partnerId });
    return row;
  }

  linksOf(partnerId: string) { return this.store.listLinks(partnerId); }

  /** The public check of a code: whether it is valid and the NAME of its source, nothing else (no id, no email, no phone, no count). */
  async resolveCode(input: unknown): Promise<{ valid: boolean; source?: string }> {
    const code = normaliseCode(input);
    if (!code) return { valid: false };
    const link = await this.store.getLinkByCode(code);
    if (!link || !link.active) return { valid: false };
    const p = await this.partners.get(link.partnerId);
    return p && p.status === 'ACTIVE' ? { valid: true, source: p.name } : { valid: false };
  }

  // ─────────────────────────────────────────────────────────────────────────── attribution
  /** At registration: a valid code attributes the vendor to its partner unless the partner is the vendor himself. Best effort, never raises. */
  async attributeAtRegistration(i: { vendorId: string; code: string }): Promise<void> {
    try {
      const code = normaliseCode(i.code);
      if (!code) return;
      const link = await this.store.getLinkByCode(code);
      if (!link || !link.active) return;
      const partner = await this.partners.get(link.partnerId);
      if (!partner || partner.status !== 'ACTIVE') return;
      const vendor = await this.store.vendorFacts(i.vendorId);
      if (!vendor || isSelfReferral(partner, vendor)) return;   // nothing is recorded for a business that is its own referrer
      const { created } = await this.store.createAttribution({ vendorId: i.vendorId, partnerId: partner.id, linkId: link.id, source: 'REGISTER', setById: null, reason: null });
      if (created) await this.record('referral.attributed', 'ReferralAttribution', i.vendorId, null, { partnerId: partner.id, source: 'REGISTER' });
    } catch { /* a referral can never block a signup */ }
  }

  /**
   * Staff set who referred a business that has NO referrer yet (a business created on behalf): the first touch, source ON_BEHALF, audited. A business that already has one is refused here with
   * REFERRAL_ATTRIBUTION_EXISTS: changing it is a different action (changeAttribution) on its own route, which the role matrix limits to SUPER_ADMIN. A partner can never be set on his own business.
   */
  async setAttribution(vendorId: string, partnerId: string, reason: string | undefined, actor: StaffActor) {
    const { vendor, partner } = await this.facts(vendorId, partnerId);
    const existing = await this.store.getAttribution(vendorId);
    if (existing) throw referralError(409, 'REFERRAL_ATTRIBUTION_EXISTS', 'This business already has a referrer. Only a SUPER_ADMIN can change it.');
    const why = typeof reason === 'string' ? reason.replace(/\s+/g, ' ').trim() : '';
    const { row } = await this.store.createAttribution({ vendorId, partnerId: partner.id, linkId: null, source: 'ON_BEHALF', setById: actor.id, reason: why ? why.slice(0, 300) : null });
    void vendor;
    await this.record('referral.attributed', 'ReferralAttribution', vendorId, actor, { partnerId, source: 'ON_BEHALF' });
    return row;
  }

  /** Changes an existing referrer (the route is SUPER_ADMIN only in the role matrix): a reason is required, and the audit row holds the before and the after. Setting the same partner again changes nothing. */
  async changeAttribution(vendorId: string, partnerId: string, reason: string | undefined, actor: StaffActor) {
    const { partner } = await this.facts(vendorId, partnerId);
    const existing = await this.store.getAttribution(vendorId);
    if (!existing) throw referralError(404, 'REFERRAL_ATTRIBUTION_INVALID', 'This business has no referrer to change. Set one first.');
    const why = typeof reason === 'string' ? reason.replace(/\s+/g, ' ').trim() : '';
    if (why.length < 3) throw referralError(400, 'REFERRAL_ATTRIBUTION_INVALID', 'A reason of at least 3 characters is required to change the referrer.');
    if (existing.partnerId === partner.id) return existing;
    const row = await this.store.replaceAttribution(vendorId, { partnerId: partner.id, linkId: null, source: 'ADMIN_CHANGE', setById: actor.id, reason: why.slice(0, 300) });
    await this.record('referral.attribution.changed', 'ReferralAttribution', vendorId, actor, { before: existing.partnerId, after: partner.id, reason: why.slice(0, 300) });
    return row!;
  }

  /** The business and the partner of an attribution, with the refusals both actions share. */
  private async facts(vendorId: string, partnerId: string) {
    const vendor = await this.store.vendorFacts(vendorId);
    if (!vendor) throw referralError(404, 'REFERRAL_VENDOR_NOT_FOUND', 'That business does not exist.');
    const partner = await this.partners.get(partnerId);
    if (!partner) throw referralError(404, 'REFERRAL_LINK_NOT_FOUND', 'That partner does not exist.');
    if (partner.status !== 'ACTIVE') throw referralError(409, 'REFERRAL_PARTNER_INACTIVE', 'That partner is disabled.');
    if (isSelfReferral(partner, vendor)) throw referralError(409, 'REFERRAL_SELF_REFERRAL', 'A partner cannot be set as the referrer of his own business.');
    return { vendor, partner };
  }

  /** Who referred a vendor, for the vendor detail in the admin app; null when nobody did. */
  async sourceOf(vendorId: string) {
    const a = await this.store.getAttribution(vendorId);
    if (!a) return null;
    const p = await this.partners.get(a.partnerId);
    const link = a.linkId ? await this.store.getLink(a.linkId) : null;
    return { partner: p ? { id: p.id, name: p.name, type: p.type } : { id: a.partnerId, name: null, type: null }, source: a.source, code: link?.code ?? null, setAt: a.createdAt, reason: a.reason };
  }

  // ─────────────────────────────────────────────────────────────────────────── the ledger, made by the settlement
  /** The vendor's FIRST successful paid plan payment makes ONE ledger line for its partner (a vendor counts once). Never raises: a payment never depends on it. */
  async onPlanPaid(i: PlanPaidInfo): Promise<void> {
    try {
      const a = await this.store.getAttribution(i.vendorId);
      if (!a) return;
      const { created, row } = await this.store.createLine({ partnerId: a.partnerId, vendorId: i.vendorId, month: monthOf(i.paidAt), orderId: i.orderId, qualifiedAt: i.paidAt });
      if (created) await this.record('commission.line.accrued', 'CommissionLedger', row.id, null, { partnerId: a.partnerId, month: row.month, via: i.via });
    } catch { /* never raised to the payment */ }
  }

  /**
   * A reversed payment. A line not yet paid out is marked REVERSED and flagged for the owner (it drops out of the payout). A line that was ALREADY PAID out stays PAID (the payout record is history) and a separate
   * negative ADJUSTMENT line of the same amount is made (Wave 4: owner decision, 17 Nov 2026); it is netted on the partner's next month close, or carried forward when netting it would leave nothing to pay.
   * A repeat of the same reversal changes nothing.
   */
  async onPaymentReversed(i: PlanReversedInfo): Promise<void> {
    try {
      const line = await this.store.getLineByVendor(i.vendorId);
      if (!line || line.orderId !== i.orderId || line.status === 'REVERSED') return;
      if (line.status === 'PAID') {
        if (!line.amountMinor || line.amountMinor <= 0) return;
        const at = this.clock();
        const adj = await this.store.createAdjustment({ partnerId: line.partnerId, vendorId: line.vendorId, month: monthOf(at), orderId: line.orderId, qualifiedAt: at, amountMinor: -line.amountMinor, adjustsLineId: line.id, flagReason: `The payment was reversed after the payout (${i.reason}). Taken back as an adjustment on the next month close.` });
        if (!adj.created) return;   // a repeat is quiet
        await this.store.flagLine(line.id, `The payment was reversed after the payout (${i.reason}). An adjustment of ${rupeesText(-line.amountMinor)} is netted on the next month close.`);
        await this.record('commission.adjustment.created', 'CommissionLedger', adj.row.id, null, { adjusts: line.id, amountMinor: adj.row.amountMinor, partnerId: line.partnerId });
        return;
      }
      await this.store.reverseLine(i.vendorId, `The payment was reversed (${i.reason}).`);
      await this.record('commission.line.reversed', 'CommissionLedger', line.id, null, { was: line.status });
    } catch { /* never raised to the refund */ }
  }

  // ─────────────────────────────────────────────────────────────────────────── slabs, month close, payouts
  async slabs() { return (await this.store.listSlabs()).map(slabView); }

  async addSlab(input: { minVendors: unknown; maxVendors?: unknown; amountPerVendorMinor: unknown; effectiveFrom: unknown }, actor: StaffActor) {
    const others = await this.store.listSlabs();
    const problems = slabProblems({ ...input, maxVendors: input.maxVendors ?? null }, others);
    if (problems.length) throw referralError(400, 'COMMISSION_SLAB_INVALID', 'The slab row has problems.', { problems });
    const row = await this.store.createSlab({ minVendors: input.minVendors as number, maxVendors: (input.maxVendors ?? null) as number | null, amountPerVendorMinor: input.amountPerVendorMinor as number, effectiveFrom: new Date(input.effectiveFrom as string), createdById: actor.id });
    await this.record('commission.slab.added', 'CommissionSlab', row.id, actor, { min: row.minVendors, max: row.maxVendors, amountPerVendorMinor: row.amountPerVendorMinor, effectiveFrom: row.effectiveFrom });
    return slabView(row);
  }

  async editSlab(id: string, input: { minVendors?: unknown; maxVendors?: unknown; amountPerVendorMinor?: unknown; effectiveFrom?: unknown }, actor: StaffActor) {
    const cur = await this.store.getSlab(id);
    if (!cur) throw referralError(404, 'COMMISSION_SLAB_NOT_FOUND', 'That slab row does not exist.');
    const merged = { minVendors: input.minVendors ?? cur.minVendors, maxVendors: input.maxVendors === undefined ? cur.maxVendors : input.maxVendors, amountPerVendorMinor: input.amountPerVendorMinor ?? cur.amountPerVendorMinor, effectiveFrom: input.effectiveFrom ?? cur.effectiveFrom };
    const problems = slabProblems(merged, await this.store.listSlabs(), id);
    if (problems.length) throw referralError(400, 'COMMISSION_SLAB_INVALID', 'The slab row has problems.', { problems });
    // a row a closed month may already have used cannot be edited under it: the owner adds a row with a later effective date instead
    if (await this.closedMonthUsedRow(cur.effectiveFrom)) throw referralError(409, 'COMMISSION_SLAB_INVALID', 'A month that used this row is already closed. Add a row with a later effective date instead.', { problems: ['IN_USE'] });
    const row = await this.store.updateSlab(id, { minVendors: merged.minVendors as number, maxVendors: merged.maxVendors as number | null, amountPerVendorMinor: merged.amountPerVendorMinor as number, effectiveFrom: new Date(merged.effectiveFrom as string | Date) });
    await this.record('commission.slab.edited', 'CommissionSlab', id, actor, { before: slabView(cur), after: row ? slabView(row) : null });
    return slabView(row!);
  }
  /** Is there a closed month (an APPROVED or PAID line) that ends on or after the row's effective date? The list is newest month first, so the first page answers it. */
  private async closedMonthUsedRow(from: Date): Promise<boolean> {
    for (const status of ['APPROVED', 'PAID'] as const) {
      const r = await this.store.listLines({ status, skip: 0, take: 200 });
      if (r.items.some((l) => monthEnd(l.month).getTime() >= from.getTime())) return true;
    }
    return false;
  }

  /** Closing a month is an action by an ADMIN or SUPER_ADMIN (never a cron). Idempotent: a repeat approves nothing. With no slab rows nothing accrues and the answer says so. */
  async closeMonth(month: string, actor: StaffActor): Promise<CloseResult & { approved: number }> {
    if (!isMonth(month)) throw referralError(400, 'COMMISSION_MONTH_INVALID', 'The month must look like 2026-11.');
    const [monthLines, slabs, pending] = await Promise.all([this.store.linesOfMonth(month), this.store.listSlabs(), this.store.pendingAdjustments(monthEnd(month))]);
    // adjustments waiting from this or an earlier month join the close; a partner that already has a payout for this month is not touched (its adjustments wait for the next close)
    const lines = [...monthLines, ...pending.filter((p) => !monthLines.some((m) => m.id === p.id))];
    const settled = new Set<string>();
    for (const p of new Set(pending.map((x) => x.partnerId))) if (await this.store.getPayout(p, month)) settled.add(p);
    const r = closeMonth(month, lines, slabs, settled);
    const approved = await this.store.approveLines(r.approve, this.clock());
    if (approved > 0 || lines.length === 0) await this.record('commission.month.closed', 'CommissionMonth', month, actor, { approved, noSlabs: r.noSlabs, partners: r.partners.length, adjustmentsNetted: r.approve.filter((a) => a.month).length });
    return { ...r, approved };
  }

  async ledger(q: { month?: string; partnerId?: string; status?: LedgerStatus; skip: number; take: number }) { const r = await this.store.listLines(q); return { items: r.items.map(lineView), total: r.total }; }

  async exportCsv(q: { month?: string; partnerId?: string; status?: LedgerStatus }): Promise<string> {
    const names = new Map<string, string>();
    const items: LedgerRow[] = [];
    for (let skip = 0; ; skip += 200) { const r = await this.store.listLines({ ...q, skip, take: 200 }); items.push(...r.items); if (items.length >= r.total || r.items.length === 0) break; }
    for (const l of items) if (!names.has(l.partnerId)) names.set(l.partnerId, (await this.partners.get(l.partnerId))?.name ?? '');
    return toCsv(['month', 'kind', 'partner', 'partnerId', 'vendorId', 'orderId', 'status', 'amountRupees', 'flagged', 'flagReason', 'qualifiedAt', 'payoutId'],
      items.map((l) => [l.month, l.kind, names.get(l.partnerId), l.partnerId, l.vendorId, l.orderId, l.status, rupeesText(l.amountMinor), l.flagged ? 'yes' : 'no', l.flagReason, l.qualifiedAt.toISOString(), l.payoutId]));
  }

  /**
   * Records the payout of one partner for one month, after the admin paid it by bank or UPI (the reference is required; no money moves from here, no tax is computed). The month must be closed (no ACCRUED
   * line left for that partner), there must be APPROVED lines, and one payout per partner and month: a repeat is refused and changes nothing.
   */
  async recordPayout(input: { partnerId: string; month: string; reference: unknown; tdsMinor?: unknown; tdsReason?: unknown }, actor: StaffActor) {
    if (!isMonth(input.month)) throw referralError(400, 'COMMISSION_MONTH_INVALID', 'The month must look like 2026-11.');
    const ref = checkPayoutReference(input.reference);
    if (!ref.ok) throw referralError(400, 'COMMISSION_PAYOUT_INVALID', 'The bank or UPI reference is required (3 to 120 characters).');
    if (!(await this.partners.get(input.partnerId))) throw referralError(404, 'REFERRAL_LINK_NOT_FOUND', 'That partner does not exist.');
    if (await this.store.getPayout(input.partnerId, input.month)) throw referralError(409, 'COMMISSION_PAYOUT_EXISTS', 'A payout for that partner and month is already recorded.');
    const lines = await this.store.linesOfPartnerMonth(input.partnerId, input.month);
    if (lines.some((l) => l.status === 'ACCRUED')) throw referralError(409, 'COMMISSION_MONTH_NOT_CLOSED', 'Close the month first: some lines have no amount yet.');
    const t = payoutTotal(lines, input.partnerId, input.month);
    if (t.lineIds.length === 0 || t.totalMinor <= 0) throw referralError(409, 'COMMISSION_NOTHING_TO_PAY', 'There is nothing approved to pay for that partner and month.');
    // TDS (Wave 4 W8): pre-filled from the percent the owner set (none set = 0); an ADMIN or SUPER_ADMIN may change the amount with a reason. net = gross - tds.
    const bp = (await this.settings?.tdsPercentBp()) ?? null;
    const tds = checkTds(t.totalMinor, bp, input);
    if (!tds.ok) throw referralError(400, 'COMMISSION_PAYOUT_INVALID', 'Some details need fixing.', { fields: tds.fields });
    const row = await this.store.createPayout({ partnerId: input.partnerId, month: input.month, totalMinor: t.totalMinor, tdsMinor: tds.tdsMinor, netMinor: tds.netMinor, tdsPercentBp: bp, tdsEdited: tds.edited, tdsReason: tds.reason, reference: ref.value, paidById: actor.id, paidAt: this.clock() }, t.lineIds);
    if (!row) throw referralError(409, 'COMMISSION_PAYOUT_EXISTS', 'A payout for that partner and month is already recorded.');
    await this.record('commission.payout.recorded', 'CommissionPayout', row.id, actor, { partnerId: input.partnerId, month: input.month, grossMinor: row.grossMinor, tdsMinor: row.tdsMinor, netMinor: row.netMinor, tdsPercentBp: row.tdsPercentBp, tdsEdited: row.tdsEdited, tdsReason: row.tdsReason, lines: t.lineIds.length });
    return row;
  }

  /**
   * What recording a payout would do, for the screen to pre-fill: the gross, the percent in force, the pre-filled TDS, the net, and whether the partner has a PAN on record (the PAN itself is never in this answer).
   * Changes nothing. Refused like recordPayout when there is nothing to pay.
   */
  async previewPayout(input: { partnerId: string; month: string }) {
    if (!isMonth(input.month)) throw referralError(400, 'COMMISSION_MONTH_INVALID', 'The month must look like 2026-11.');
    const partner = await this.partners.get(input.partnerId);
    if (!partner) throw referralError(404, 'REFERRAL_LINK_NOT_FOUND', 'That partner does not exist.');
    const existing = await this.store.getPayout(input.partnerId, input.month);
    if (existing) return { alreadyRecorded: true as const, payout: existing };
    const lines = await this.store.linesOfPartnerMonth(input.partnerId, input.month);
    if (lines.some((l) => l.status === 'ACCRUED')) throw referralError(409, 'COMMISSION_MONTH_NOT_CLOSED', 'Close the month first: some lines have no amount yet.');
    const t = payoutTotal(lines, input.partnerId, input.month);
    if (t.lineIds.length === 0 || t.totalMinor <= 0) throw referralError(409, 'COMMISSION_NOTHING_TO_PAY', 'There is nothing approved to pay for that partner and month.');
    const bp = (await this.settings?.tdsPercentBp()) ?? null;
    const tds = defaultTds(t.totalMinor, bp);
    return { alreadyRecorded: false as const, grossMinor: t.totalMinor, tdsPercentBp: bp, tdsMinor: tds, netMinor: t.totalMinor - tds, lines: t.lineIds.length, panOnRecord: !!partner.pan };
  }

  /** The payouts as CSV for the owner's accountant: gross, TDS and net in rupees, the percent, whether the TDS was changed and why, and the PAN. Staff only (ADMIN and SUPER_ADMIN). A typed formula is defused. */
  async payoutsCsv(q: { partnerId?: string; month?: string }): Promise<string> {
    const items: PayoutRow[] = [];
    for (let skip = 0; ; skip += 200) { const r = await this.store.listPayouts({ ...q, skip, take: 200 }); items.push(...r.items); if (items.length >= r.total || r.items.length === 0) break; }
    const partners = new Map<string, { name: string; pan: string | null }>();
    for (const p of items) if (!partners.has(p.partnerId)) { const x = await this.partners.get(p.partnerId); partners.set(p.partnerId, { name: x?.name ?? '', pan: x?.pan ?? null }); }
    return toCsv(['month', 'partner', 'partnerId', 'pan', 'reference', 'grossRupees', 'tdsPercent', 'tdsRupees', 'netRupees', 'tdsChanged', 'tdsReason', 'paidAt'],
      items.map((p) => [p.month, partners.get(p.partnerId)?.name, p.partnerId, partners.get(p.partnerId)?.pan, p.reference, rupeesText(p.grossMinor), p.tdsPercentBp === null ? '' : (p.tdsPercentBp / 100).toFixed(2), rupeesText(p.tdsMinor), rupeesText(p.netMinor), p.tdsEdited ? 'yes' : 'no', p.tdsReason, p.paidAt.toISOString()]));
  }

  async payouts(q: { partnerId?: string; month?: string; skip: number; take: number }) { return this.store.listPayouts(q); }

  // ─────────────────────────────────────────────────────────────────────────── the partner's own views (no contact details, ever)
  /** The partner's active links with their codes. */
  async myLinks(partnerId: string) { return (await this.store.listLinks(partnerId)).filter((l) => l.active).map((l) => ({ code: l.code, issuedAt: l.createdAt })); }

  /** The businesses this partner referred: the business name, the state and the day only. No email, no phone, no id of the business. */
  async myVendors(partnerId: string, skip: number, take: number) {
    const r = await this.store.attributionsOfPartner(partnerId, skip, take);
    return { items: r.items.map((a) => ({ businessName: a.vendor?.businessName ?? null, state: a.vendor?.state ?? null, referredAt: a.createdAt })), total: r.total };
  }

  /** The partner's own ledger lines: month, status, amount. The business is named by its business name only. */
  async myCommission(partnerId: string, skip: number, take: number) {
    const r = await this.store.listLines({ partnerId, skip, take });
    const names = await Promise.all(r.items.map(async (l) => (await this.store.vendorFacts(l.vendorId))?.businessName ?? null));
    return { items: r.items.map((l, i) => ({ month: l.month, kind: l.kind, businessName: names[i], status: l.status, amountMinor: l.amountMinor, flagged: l.flagged })), total: r.total };
  }

  async myPayouts(partnerId: string, skip: number, take: number) {
    const r = await this.store.listPayouts({ partnerId, skip, take });
    return { items: r.items.map((p) => ({ month: p.month, grossMinor: p.grossMinor, tdsMinor: p.tdsMinor, netMinor: p.netMinor, totalMinor: p.totalMinor, status: p.status, reference: p.reference, paidAt: p.paidAt })), total: r.total };
  }
}
