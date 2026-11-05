import { ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ActivityBus } from '../common/activity-bus';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { Actor } from '../plans/admin/audit.service';
import { BillingSettingsService } from '../plan-billing/settings/billing-settings.service';
import { consumeFromPurchases, fundingChoice, packRemainingFor, planStateAllows, PlanSnapshot, resolvePrice, trackAllows } from '../v3-services/core/services-core';
import { ServicesStore, ServicesTx } from '../v3-services/services.store';
import { deductionOutcome } from '../v3-wallet/core/tax-core';
import { WalletRuleError } from '../v3-wallet/core/wallet-core';
import { WalletSettingsService } from '../v3-wallet/settings/wallet-settings.service';
import { postEntry } from '../v3-wallet/wallet-engine';
import { frozen, notActive, walletError, walletHttpError } from '../v3-wallet/wallet.errors';
import { V3WalletService } from '../v3-wallet/wallet.service';
import { WalletStore, WalletTx } from '../v3-wallet/wallet.store';
import { checkTransition, FundingKind, isAutoApprovable, isSlaBreached, moneyEffect, RequestActor, RequestStatus, validateBrief } from './core/request-core';
import { PromotionGrantPort } from './promotion-grant.port';
import { requestConflict, requestError, requestInvalid, requestNotFound } from './requests.errors';
import { Creator, DeliverableKind, DeliverableRow, DuplicateRequestError, EventRow, RequestRow, RequestsStore, RequestsTx } from './requests.store';

const KEY = /^[A-Za-z0-9_:-]{8,80}$/;
const REF = /^[A-Za-z0-9/_.:-]{3,200}$/;
const SYSTEM: Actor = { type: 'SYSTEM', id: null, ip: null };
const TEAM_STATUSES: RequestStatus[] = ['ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_REVIEW'];

export interface CreateRequestInput { serviceKey: string; brief: unknown; attachmentRefs?: string[]; idempotencyKey: string }

/** What a vendor sees of an event: no staff identity. */
const eventView = (e: EventRow) => ({ type: e.type, from: e.fromStatus, to: e.toStatus, by: e.actorType === 'STAFF' ? 'OUR_TEAM' : e.actorType === 'VENDOR' ? 'YOU' : 'SYSTEM', note: e.note, at: e.at });
const deliverableView = (d: DeliverableRow) => ({ id: d.id, kind: d.kind, text: d.text, fileRef: d.kind === 'FILE_REF' ? d.fileRef : null, link: d.kind === 'LINK' ? d.fileRef : null, at: d.createdAt });

/**
 * Service requests: team work paid by a plan allowance, a pack or the wallet (slice 5.16c, owner rule 1). A WALLET request HOLDS the price when it is made (never a negative balance, never
 * a silent charge), CHARGES the hold when the vendor APPROVES the work, and RELEASES it on cancel or rejection. The price carries no GST and the charge no invoice (owner, 5 November 2026): GST was
 * added when the credit was added, and that refill has the tax invoice; this charge is a ledger line and a line of the usage statement. A pack
 * unit or an allowance unit is set aside when the request is made and used on approval. Every step is one unit of work shared with the wallet and the services rows: all or nothing.
 * Settings are read BEFORE a unit opens, never inside one.
 */
@Injectable()
export class ServiceRequestsService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly store: RequestsStore, private readonly services: ServicesStore, private readonly wallet: V3WalletService, private readonly walletStore: WalletStore, private readonly walletSettings: WalletSettingsService,
    @Inject(BillingSettingsService) private readonly billing: Pick<BillingSettingsService, 'get'>, private readonly entitlements: EntitlementsService, private readonly promotion: PromotionGrantPort,
    @Optional() private readonly bus?: ActivityBus,
  ) {}

  private emit(type: string, vendorId: string, actor: Actor, data: Record<string, unknown>): void { void this.bus?.emit({ type, vendorId, at: this.clock(), actor: { type: actor.type, id: actor.id }, data }); }
  private event(r: RequestsTx, req: RequestRow, type: string, a: { from?: string | null; to?: string | null; actor: Actor; note?: string | null; meta?: Record<string, unknown> }) {
    return r.insertEvent({ requestId: req.id, vendorId: req.vendorId, type, fromStatus: a.from ?? null, toStatus: a.to ?? null, actorType: a.actor.type, actorId: a.actor.id, note: a.note ?? null, meta: a.meta ?? {}, at: this.clock() });
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── views
  private view(req: RequestRow, extra: { events?: EventRow[]; deliverables?: DeliverableRow[]; maxRevisions?: number | null } = {}) {
    const snap = req.taxSnapshot as { basePaise?: number };
    const showWork = req.readyAt !== null;
    return {
      id: req.id, serviceKey: req.serviceKey, status: req.status, brief: req.brief, attachmentRefs: req.attachmentRefs, createdBy: req.createdByType === 'VENDOR' ? 'YOU' : 'OUR_TEAM', createdAt: req.createdAt,
      funding: { kind: req.fundingKind, amountPaise: req.priceSnapshotPaise, heldPaise: req.fundingKind === 'WALLET' && !req.chargeLedgerId && ['REQUESTED', 'ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_REVIEW', 'REVISION_REQUESTED'].includes(req.status) ? req.priceSnapshotPaise : 0, basePaise: snap.basePaise ?? null },
      revisionsUsed: req.revisionsUsed, revisionsLeft: extra.maxRevisions === undefined || extra.maxRevisions === null ? null : Math.max(0, extra.maxRevisions - req.revisionsUsed),
      rejectReason: req.status === 'REJECTED_BY_TEAM' ? req.rejectReason : null, approvedAt: req.approvedAt, cancelledAt: req.cancelledAt,
      ...(extra.events ? { events: extra.events.map(eventView) } : {}), ...(extra.deliverables ? { deliverables: showWork ? extra.deliverables.map(deliverableView) : [] } : {}),
    };
  }
  private adminView(req: RequestRow) {
    return { ...this.view(req), vendorId: req.vendorId, assignedStaffId: req.assignedStaffId, slaDueAt: req.slaDueAt, slaBreachedAt: req.slaBreachedAt, readyAt: req.readyAt, grantEndsAt: req.grantEndsAt, grantOverrideId: req.grantOverrideId, createdById: req.createdById, holdLedgerId: req.holdLedgerId, chargeLedgerId: req.chargeLedgerId, packPurchaseId: req.packPurchaseId };
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── create
  async create(vendorId: string, input: CreateRequestInput, creator: { type: Creator; actor: Actor; reason?: string }) {
    const key = String(input.idempotencyKey ?? '');
    if (!KEY.test(key)) throw requestInvalid('SERVICE_REQUEST_INVALID', 'The request key must be 8 to 80 letters, digits, dashes, colons or underscores.');
    const ws = await this.walletSettings.get();
    if (ws.serviceMaxRevisions === null) throw requestConflict('SERVICE_REQUESTS_NOT_CONFIGURED', 'Requests to our team are not switched on yet.');
    const svc = await this.services.serviceByKey(String(input.serviceKey ?? '').slice(0, 60));
    if (!svc || svc.status !== 'ACTIVE' || svc.doneBy === 'VENDOR') throw requestConflict('SERVICE_NOT_REQUESTABLE', 'That service cannot be requested from our team.');
    const resolved = await this.entitlements.resolve(vendorId);
    const snap: PlanSnapshot = { level: (resolved.level as PlanSnapshot['level']) ?? null, subscriptionStatus: resolved.subscriptionStatus, suspended: resolved.suspended };
    if (!trackAllows(svc.trackScope, resolved.track)) throw requestConflict('SERVICE_NOT_REQUESTABLE', 'That service is not offered for your kind of business.');
    if (!planStateAllows(svc.planStateRule, snap)) throw requestConflict('SERVICE_NOT_REQUESTABLE', 'That service can be requested only while your Pro plan is active.');
    const problems = validateBrief(svc.key, input.brief);
    const refs = input.attachmentRefs ?? [];
    if (!Array.isArray(refs) || refs.length > 10 || refs.some((x) => typeof x !== 'string' || !REF.test(x))) problems.push('Attachments must be up to 10 file references.');
    if (problems.length) throw requestInvalid('SERVICE_REQUEST_BRIEF_INVALID', problems[0], { errors: problems });
    if (creator.type === 'STAFF_ON_BEHALF' && !(typeof creator.reason === 'string' && creator.reason.trim().length >= 5)) throw requestInvalid('SERVICE_REQUEST_INVALID', 'A reason of at least 5 characters is required to raise a request for a vendor.');

    await this.wallet.syncActivation(vendorId);
    const price = resolvePrice(await this.services.servicePrices(svc.id), this.clock());
    const tax = price ? deductionOutcome(price.amountPaise) : null;   // using credit costs exactly the price: the GST was added at the refill
    const feat = resolved.features[`services.included.${svc.key}`];
    const allowanceLimit = feat && feat.state === 'LIMITED' && feat.limit !== null ? feat.limit : null;
    const limits = { minPaise: ws.walletTopupMinPaise, maxPaise: ws.walletTopupMaxPaise };
    const now = this.clock();

    let out: { req: RequestRow; replay: boolean };
    try {
      out = await this.store.unit(vendorId, async (r, stx, wtx) => {
        const prior = await r.findByKey(key);
        if (prior) { if (prior.serviceKey !== svc.key) throw new ConflictException(walletError('WALLET_IDEMPOTENCY_CONFLICT', 'That request key was already used for a different request.')); return { req: prior, replay: true }; }
        const purchases = (await stx.purchasesFor(vendorId)).map((p) => ({ id: p.id, remaining: p.remaining, purchasedAt: p.purchasedAt, expiresAt: p.expiresAt }));
        const packCount = Math.max(0, packRemainingFor(purchases, svc.key, now) - (await r.packReserved(svc.id)));
        const w = await wtx.wallet();
        const choice = fundingChoice({
          allowance: allowanceLimit === null ? null : { limit: allowanceLimit, used: await r.allowanceUsed(svc.id) }, packCount, totalMinor: tax && tax.ok ? tax.totalMinor : null, taxProblem: tax && !tax.ok ? tax.problem : null,
          wallet: w ? { status: w.status, availablePaise: w.balancePaise - w.heldPaise } : null,
        });
        if (choice.kind === 'NONE') {
          if (choice.reason === 'PRICE_NOT_SET') throw requestConflict('SERVICE_NOT_REQUESTABLE', 'That service has no approved price yet, so it cannot be requested.', { reason: 'PRICE_NOT_SET' });
          if (choice.reason === 'TAX_NOT_SET') throw new ConflictException(walletError('TAX_NOT_CONFIGURED', 'Tax is not set up yet, so this cannot be priced.', { problem: choice.taxProblem }));
          if (choice.reason === 'WALLET_NOT_ACTIVE') throw notActive();
          if (choice.reason === 'WALLET_FROZEN') throw frozen();
          throw new WalletRuleError('INSUFFICIENT_WALLET', 'The wallet does not have enough available.', { shortfallPaise: choice.shortfallPaise ?? 0, availablePaise: w ? w.balancePaise - w.heldPaise : 0, requiredPaise: tax && tax.ok ? tax.totalMinor : 0 });
        }
        const id = randomUUID();
        let holdLedgerId: string | null = null; let priceSnapshotPaise: number | null = null; let taxSnapshot: Record<string, unknown> = {};
        if (choice.kind === 'WALLET' && tax && tax.ok && price) {
          const hold = await postEntry(wtx, { kind: 'HOLD', amountPaise: tax.totalMinor, idempotencyKey: `reqhold:${key}`, refType: 'service_request', refId: id, actor: { type: creator.actor.type, id: creator.actor.id }, now });
          holdLedgerId = hold.entry.id; priceSnapshotPaise = tax.totalMinor;
          taxSnapshot = { priceId: price.id, basePaise: price.amountPaise, taxMinor: 0, note: 'GST was added when the credit was added; using credit carries no tax and no invoice' };
        }
        const req = await r.insertRequest({
          id, vendorId, serviceId: svc.id, status: 'REQUESTED', brief: input.brief as Record<string, unknown>, attachmentRefs: refs, priceSnapshotPaise, taxSnapshot, fundingKind: choice.kind, holdLedgerId, packPurchaseId: null,
          createdByType: creator.type, createdById: creator.actor.id, idempotencyKey: key,
        });
        await this.event(r, req, 'CREATED', { to: 'REQUESTED', actor: creator.actor, note: creator.type === 'STAFF_ON_BEHALF' ? `Raised for you by our team: ${creator.reason!.trim()}` : null, meta: { funding: choice.kind } });
        await r.audit(creator.actor, creator.type === 'STAFF_ON_BEHALF' ? 'service_request.create_on_behalf' : 'service_request.create', req.id, null, { serviceKey: svc.key, funding: choice.kind, amountPaise: priceSnapshotPaise, ...(creator.reason ? { reason: creator.reason.trim() } : {}) });
        return { req, replay: false };
      });
    } catch (e) {
      if (e instanceof WalletRuleError) throw walletHttpError(e, limits);
      if (e instanceof DuplicateRequestError) throw new ConflictException(walletError('WALLET_IDEMPOTENCY_CONFLICT', 'That request key was already used.'));
      throw e;
    }
    if (!out.replay) this.emit('service_request.created', vendorId, creator.actor, { requestId: out.req.id, serviceKey: svc.key, funding: out.req.fundingKind, onBehalf: creator.type === 'STAFF_ON_BEHALF' });
    return { ...this.view(out.req, { maxRevisions: ws.serviceMaxRevisions }), replay: out.replay };
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── vendor reads
  async list(vendorId: string, page: number, pageSize: number) {
    const ws = await this.walletSettings.get(); const r = await this.store.listForVendor(vendorId, (page - 1) * pageSize, pageSize);
    return { items: r.items.map((x) => this.view(x, { maxRevisions: ws.serviceMaxRevisions })), page, pageSize, total: r.total };
  }
  async get(vendorId: string, id: string) {
    const req = typeof id === 'string' && id ? await this.store.getForVendor(vendorId, id) : null; if (!req) throw requestNotFound();
    const [d, ws] = await Promise.all([this.store.detail(req.id), this.walletSettings.get()]);
    return this.view(req, { ...d, maxRevisions: ws.serviceMaxRevisions });
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── the steps
  private async mine(r: RequestsTx, id: string): Promise<RequestRow> { const req = typeof id === 'string' && id ? await r.getRequest(id) : null; if (!req) throw requestNotFound(); return req; }

  /** One step of the state machine, inside the caller's unit: checks the edge and its conditions, applies the money effect, moves the status with a compare-and-set and writes the history. */
  private async step(r: RequestsTx, wtx: WalletTx, req: RequestRow, to: RequestStatus, by: RequestActor, actor: Actor, o: { note?: string | null; reason?: string | null; maxRevisions: number | null; patch?: Parameters<RequestsTx['updateRequestCas']>[2] }): Promise<RequestRow> {
    const hasDeliverable = (await r.deliverables(req.id)).length > 0;
    const c = checkTransition({ from: req.status, to, by, hasDeliverable, serviceKey: req.serviceKey, grantEndsAt: req.grantEndsAt, revisionsUsed: req.revisionsUsed, maxRevisions: o.maxRevisions, reason: o.reason ?? null });
    if (!c.ok) {
      const m: Record<string, [Parameters<typeof requestConflict>[0], string]> = {
        NOT_ALLOWED: ['SERVICE_REQUEST_STATE', 'That step is not possible from where this request is now.'], DELIVERABLE_REQUIRED: ['DELIVERABLE_REQUIRED', 'Add the finished work before sending it for review.'],
        GRANT_DATE_REQUIRED: ['GRANT_DATE_REQUIRED', 'Set the date the add-on ends before sending this for review.'], REVISION_LIMIT: ['REVISION_LIMIT_REACHED', 'There are no more changes left for this request.'], REASON_REQUIRED: ['SERVICE_REQUEST_INVALID', 'A reason of at least 5 characters is required.'],
      };
      const [code, message] = m[c.problem]; throw c.problem === 'REASON_REQUIRED' ? requestInvalid(code, message) : requestConflict(code, message, { problem: c.problem });
    }
    const effect = moneyEffect(req.fundingKind, to);
    const now = this.clock();
    if (effect === 'RELEASE_HOLD') await postEntry(wtx, { kind: 'RELEASE', amountPaise: req.priceSnapshotPaise!, holdId: req.holdLedgerId!, idempotencyKey: `reqrelease:${req.id}`, refType: 'service_request', refId: req.id, reason: to === 'CANCELLED' ? 'the vendor cancelled the request' : 'the request was rejected', actor: { type: actor.type, id: actor.id }, now });
    const patch = { status: to, ...(to === 'READY_FOR_REVIEW' ? { readyAt: now } : {}), ...(to === 'CANCELLED' ? { cancelledAt: now } : {}), ...(to === 'REJECTED_BY_TEAM' ? { rejectReason: (o.reason ?? '').trim() } : {}), ...(to === 'REVISION_REQUESTED' ? { revisionsUsed: req.revisionsUsed + 1 } : {}), ...(o.patch ?? {}) };
    if (!(await r.updateRequestCas(req.id, [req.status], patch))) throw requestConflict('SERVICE_REQUEST_STATE', 'This request changed; please reload it.');
    await this.event(r, req, 'STATUS', { from: req.status, to, actor, note: o.note ?? o.reason ?? null });
    return { ...req, ...patch };
  }

  async cancel(vendorId: string, id: string, actor: Actor) {
    const ws = await this.walletSettings.get();
    const done = await this.store.unit(vendorId, async (r, _s, wtx) => {
      const req = await this.mine(r, id);
      if (req.status === 'CANCELLED') return req;   // a second cancel changes nothing
      const next = await this.step(r, wtx, req, 'CANCELLED', 'VENDOR', actor, { maxRevisions: ws.serviceMaxRevisions });
      await r.audit(actor, 'service_request.cancel', req.id, { status: req.status }, { status: 'CANCELLED', released: req.fundingKind === 'WALLET' });
      return next;
    });
    if (done.status === 'CANCELLED') this.emit('service_request.cancelled', vendorId, actor, { requestId: id });
    return this.view(done, { maxRevisions: ws.serviceMaxRevisions });
  }

  async requestRevision(vendorId: string, id: string, input: { note?: string }, actor: Actor) {
    const note = typeof input?.note === 'string' ? input.note.trim() : '';
    if (note.length < 5 || note.length > 1000 || /[<>]/.test(note)) throw requestInvalid('SERVICE_REQUEST_INVALID', 'Tell us what to change, in 5 to 1000 plain characters.');
    const ws = await this.walletSettings.get();
    const next = await this.store.unit(vendorId, async (r, _s, wtx) => {
      const req = await this.mine(r, id);
      const n = await this.step(r, wtx, req, 'REVISION_REQUESTED', 'VENDOR', actor, { note, maxRevisions: ws.serviceMaxRevisions });
      await r.audit(actor, 'service_request.revision', req.id, { revisionsUsed: req.revisionsUsed }, { revisionsUsed: n.revisionsUsed });
      return n;
    });
    this.emit('service_request.revision_requested', vendorId, actor, { requestId: id });
    return this.view(next, { maxRevisions: ws.serviceMaxRevisions });
  }

  /** The vendor approves the work (or the auto-approval timer does, when staff switched it on): the hold becomes a CHARGE (a ledger line, no invoice), a pack unit is used, or an allowance unit stays used. Once. */
  async approve(vendorId: string, id: string, actor: Actor, by: 'VENDOR' | 'SYSTEM' = 'VENDOR') {
    const ws = await this.walletSettings.get();
    const out = await this.store.unit(vendorId, async (r, stx, wtx) => {
      const req = await this.mine(r, id);
      if (req.status === 'APPROVED') return { req, replay: true };
      const now = this.clock();
      if (req.status !== 'READY_FOR_REVIEW') throw requestConflict('SERVICE_REQUEST_STATE', 'This work is not waiting for your approval.');
      const c = checkTransition({ from: req.status, to: 'APPROVED', by, hasDeliverable: true, serviceKey: req.serviceKey, grantEndsAt: req.grantEndsAt, revisionsUsed: req.revisionsUsed, maxRevisions: ws.serviceMaxRevisions, reason: null });
      if (!c.ok) throw requestConflict('SERVICE_REQUEST_STATE', 'That step is not possible from where this request is now.');
      let chargeLedgerId: string | null = null; let packPurchaseId: string | null = null;
      const effect = moneyEffect(req.fundingKind, 'APPROVED');
      if (effect === 'CHARGE_HOLD') {
        const charge = await postEntry(wtx, { kind: 'CHARGE', amountPaise: req.priceSnapshotPaise!, holdId: req.holdLedgerId!, idempotencyKey: `reqcharge:${req.id}`, refType: 'service_request', refId: req.id, reason: 'the vendor approved the work', actor: { type: actor.type, id: actor.id }, now });
        chargeLedgerId = charge.entry.id;   // a ledger line and a line of the usage statement: no invoice (owner, 5 November 2026)
      } else if (effect === 'CONSUME_PACK') {
        // the unit was set aside when the request was made, so it is honoured even if the pack's date has passed since (the epoch makes every pack "not expired")
        const list = (await stx.purchasesFor(vendorId)).map((p) => ({ id: p.id, remaining: p.remaining, purchasedAt: p.purchasedAt, expiresAt: p.expiresAt }));
        const used = consumeFromPurchases(list, req.serviceKey, new Date(0));
        if (!used) throw requestConflict('SERVICE_REQUEST_STATE', 'The pack for this work has no units left. Please contact support.');
        const cur = list.find((p) => p.id === used.purchaseId)!;
        if (!(await stx.updatePurchaseRemaining(used.purchaseId, cur.remaining, used.remaining))) throw requestConflict('SERVICE_REQUEST_STATE', 'The pack changed; please try again.');
        packPurchaseId = used.purchaseId;
      }
      if (!(await r.updateRequestCas(req.id, ['READY_FOR_REVIEW'], { status: 'APPROVED', approvedAt: now, ...(chargeLedgerId ? { chargeLedgerId } : {}), ...(packPurchaseId ? { packPurchaseId } : {}) }))) throw requestConflict('SERVICE_REQUEST_STATE', 'This request changed; please reload it.');
      await this.event(r, req, 'STATUS', { from: 'READY_FOR_REVIEW', to: 'APPROVED', actor: by === 'SYSTEM' ? SYSTEM : actor, note: by === 'SYSTEM' ? 'Approved automatically after the review time passed.' : null, meta: { charged: chargeLedgerId !== null, packPurchaseId } });
      await r.audit(by === 'SYSTEM' ? SYSTEM : actor, 'service_request.approve', req.id, { status: 'READY_FOR_REVIEW' }, { status: 'APPROVED', funding: req.fundingKind, amountPaise: chargeLedgerId ? req.priceSnapshotPaise : null, packPurchaseId });
      return { req: { ...req, status: 'APPROVED' as RequestStatus, approvedAt: now, chargeLedgerId, packPurchaseId }, replay: false };
    });
    if (!out.replay) this.emit('service_request.approved', vendorId, actor, { requestId: id, funding: out.req.fundingKind, by });
    await this.grantIfNeeded(vendorId, out.req);   // a replay also heals a grant that failed the first time
    const d = await this.store.detail(out.req.id);
    return { ...this.view(out.req, { ...d, maxRevisions: ws.serviceMaxRevisions }), replay: out.replay };
  }

  /** CUSTOM_DOMAIN_PROMOTION: on approval the add-on override is created through the existing audited path, once (a claim on the request row), with the end date staff set. A failure leaves the request APPROVED and the grant retryable. */
  private async grantIfNeeded(vendorId: string, req: RequestRow): Promise<void> {
    if (req.serviceKey !== 'CUSTOM_DOMAIN_PROMOTION') return;
    const claimed = await this.store.unit(vendorId, async (r) => { const cur = await r.getRequest(req.id); return cur && cur.status === 'APPROVED' && cur.grantEndsAt && (await r.claimGrant(req.id)) ? cur : null; });
    if (!claimed) return;
    try {
      const overrideId = await this.promotion.grantCustomDomain(vendorId, claimed.grantEndsAt!, `custom domain promotion service ${claimed.id}`);
      await this.store.unit(vendorId, async (r) => { await r.finishGrant(claimed.id, overrideId); await this.event(r, claimed, 'PROMOTION_GRANTED', { actor: SYSTEM, meta: { overrideId } }); });
      this.emit('service_request.promotion_granted', vendorId, SYSTEM, { requestId: claimed.id });
    } catch {
      await this.store.unit(vendorId, async (r) => { await r.finishGrant(claimed.id, null); await this.event(r, claimed, 'PROMOTION_GRANT_FAILED', { actor: SYSTEM, note: 'The add-on could not be switched on yet. Our team will retry.' }); });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── staff
  async adminList(f: { serviceKey?: string; status?: RequestStatus; fundingKind?: FundingKind; vendorId?: string; slaBreached?: boolean; page: number; pageSize: number }) {
    const r = await this.store.adminList({ ...f, now: this.clock(), skip: (f.page - 1) * f.pageSize, take: f.pageSize });
    return { items: r.items.map((x) => this.adminView(x)), page: f.page, pageSize: f.pageSize, total: r.total };
  }
  async adminGet(id: string) {
    const req = await this.store.adminGet(String(id).slice(0, 64)); if (!req) throw requestNotFound();
    const d = await this.store.detail(req.id);
    return { ...this.adminView(req), events: d.events.map((e) => ({ type: e.type, from: e.fromStatus, to: e.toStatus, actorType: e.actorType, actorId: e.actorId, note: e.note, meta: e.meta, at: e.at })), deliverables: d.deliverables };
  }
  private async asTeam<T>(id: string, fn: (r: RequestsTx, stx: ServicesTx, wtx: WalletTx, req: RequestRow, ws: Awaited<ReturnType<WalletSettingsService['get']>>) => Promise<T>): Promise<T> {
    const known = await this.store.adminGet(String(id).slice(0, 64)); if (!known) throw requestNotFound();
    const ws = await this.walletSettings.get();
    return this.store.unit(known.vendorId, async (r, stx, wtx) => fn(r, stx, wtx, await this.mine(r, known.id), ws));
  }

  async assign(id: string, input: { staffId?: string; slaDueAt?: string | null; grantEndsAt?: string | null }, actor: Actor) {
    const now = this.clock();
    const date = (v: unknown, what: string): Date | null | undefined => { if (v === undefined) return undefined; if (v === null) return null; const d = new Date(String(v)); if (Number.isNaN(d.getTime()) || d.getTime() <= now.getTime()) throw requestInvalid('SERVICE_REQUEST_INVALID', `${what} must be a date in the future.`); return d; };
    const sla = date(input.slaDueAt, 'The due time'); const grant = date(input.grantEndsAt, 'The end date');
    const staffId = input.staffId === undefined ? actor.id : String(input.staffId).slice(0, 64);
    const req = await this.asTeam(id, async (r, _s, _w, cur) => {
      if (['APPROVED', 'REJECTED_BY_TEAM', 'CANCELLED'].includes(cur.status)) throw requestConflict('SERVICE_REQUEST_STATE', 'This request has ended.');
      if (grant !== undefined && cur.serviceKey !== 'CUSTOM_DOMAIN_PROMOTION') throw requestInvalid('SERVICE_REQUEST_INVALID', 'An end date applies only to the custom domain promotion.');
      await r.patchRequest(cur.id, { assignedStaffId: staffId, ...(sla !== undefined ? { slaDueAt: sla, slaBreachedAt: null } : {}), ...(grant !== undefined ? { grantEndsAt: grant } : {}) });
      await this.event(r, cur, 'ASSIGNED', { actor, meta: { staffId, slaDueAt: sla ?? null, grantEndsAt: grant ?? null } });
      await r.audit(actor, 'service_request.assign', cur.id, { assignedStaffId: cur.assignedStaffId, slaDueAt: cur.slaDueAt }, { assignedStaffId: staffId, slaDueAt: sla ?? cur.slaDueAt, grantEndsAt: grant ?? cur.grantEndsAt });
      return { ...cur, assignedStaffId: staffId, ...(sla !== undefined ? { slaDueAt: sla } : {}), ...(grant !== undefined ? { grantEndsAt: grant } : {}) } as RequestRow;
    });
    return this.adminView(req);
  }

  async setStatus(id: string, input: { to: string; note?: string }, actor: Actor) {
    if (!TEAM_STATUSES.includes(input.to as RequestStatus)) throw requestInvalid('SERVICE_REQUEST_INVALID', 'The team can move a request to ACCEPTED, IN_PRODUCTION or READY_FOR_REVIEW.');
    const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 1000) : null;
    if (note && /[<>]/.test(note)) throw requestInvalid('SERVICE_REQUEST_INVALID', 'The note must be plain text.');
    const req = await this.asTeam(id, async (r, _s, wtx, cur, ws) => {
      const n = await this.step(r, wtx, cur, input.to as RequestStatus, 'TEAM', actor, { note, maxRevisions: ws.serviceMaxRevisions });
      await r.audit(actor, 'service_request.status', cur.id, { status: cur.status }, { status: n.status });
      return n;
    });
    this.emit('service_request.status', req.vendorId, actor, { requestId: id, status: req.status });
    return this.adminView(req);
  }

  async addDeliverable(id: string, input: { kind: string; text?: string; fileRef?: string }, actor: Actor) {
    const kind = input.kind as DeliverableKind;
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    const ref = typeof input.fileRef === 'string' ? input.fileRef.trim() : '';
    if (kind === 'TEXT' && !(text.length >= 1 && text.length <= 4000 && !/[<>]/.test(text))) throw requestInvalid('SERVICE_REQUEST_INVALID', 'Write the finished work in 1 to 4000 plain characters.');
    if (kind === 'FILE_REF' && !REF.test(ref)) throw requestInvalid('SERVICE_REQUEST_INVALID', 'The file reference is not valid.');
    if (kind === 'LINK' && !/^https:\/\/[^\s<>"']{4,500}$/.test(ref)) throw requestInvalid('SERVICE_REQUEST_INVALID', 'The link must start with https://.');
    if (!['TEXT', 'FILE_REF', 'LINK'].includes(kind)) throw requestInvalid('SERVICE_REQUEST_INVALID', 'The kind must be TEXT, FILE_REF or LINK.');
    return this.asTeam(id, async (r, _s, _w, cur) => {
      if (!['IN_PRODUCTION', 'READY_FOR_REVIEW'].includes(cur.status)) throw requestConflict('SERVICE_REQUEST_STATE', 'Finished work can be added while the request is in production or in review.');
      const d = await r.insertDeliverable({ requestId: cur.id, vendorId: cur.vendorId, kind, text: kind === 'TEXT' ? text : null, fileRef: kind === 'TEXT' ? null : ref, createdBy: actor.id, createdAt: this.clock() });
      await this.event(r, cur, 'DELIVERABLE', { actor, meta: { kind } });
      await r.audit(actor, 'service_request.deliverable', cur.id, null, { kind });
      return deliverableView(d);
    });
  }

  async reject(id: string, input: { reason: string }, actor: Actor) {
    const req = await this.asTeam(id, async (r, _s, wtx, cur, ws) => {
      const n = await this.step(r, wtx, cur, 'REJECTED_BY_TEAM', 'TEAM', actor, { reason: input.reason, maxRevisions: ws.serviceMaxRevisions });
      await r.audit(actor, 'service_request.reject', cur.id, { status: cur.status }, { status: 'REJECTED_BY_TEAM', reason: (input.reason ?? '').trim(), released: cur.fundingKind === 'WALLET' });
      return n;
    });
    this.emit('service_request.rejected', req.vendorId, actor, { requestId: id });
    return this.adminView(req);
  }

  async raiseOnBehalf(vendorId: string, input: CreateRequestInput & { reason: string }, actor: Actor) {
    return this.create(vendorId, input, { type: 'STAFF_ON_BEHALF', actor, reason: input.reason });
  }

  async retryGrant(id: string, actor: Actor) {
    const known = await this.store.adminGet(String(id).slice(0, 64)); if (!known) throw requestNotFound();
    if (known.serviceKey !== 'CUSTOM_DOMAIN_PROMOTION' || known.status !== 'APPROVED') throw requestConflict('SERVICE_REQUEST_STATE', 'Only an approved custom domain promotion has an add-on to switch on.');
    if (known.grantOverrideId && known.grantOverrideId !== 'PENDING') return { granted: true, overrideId: known.grantOverrideId };
    if (known.grantOverrideId === 'PENDING') await this.store.unit(known.vendorId, (r) => r.finishGrant(known.id, null));   // a claim that never finished
    await this.grantIfNeeded(known.vendorId, known);
    const after = await this.store.adminGet(known.id);
    void actor;
    return { granted: !!after?.grantOverrideId && after.grantOverrideId !== 'PENDING', overrideId: after?.grantOverrideId ?? null };
  }

  /** Marks, once, every open request whose due time has passed. Safe to run any time. */
  async slaSweep() {
    const now = this.clock(); let marked = 0;
    for (const c of await this.store.slaCandidates(now, 200)) {
      const did = await this.store.unit(c.vendorId, async (r) => {
        const cur = await r.getRequest(c.id);
        if (!cur || !isSlaBreached(cur, now)) return false;
        await r.patchRequest(cur.id, { slaBreachedAt: now });
        await this.event(r, cur, 'SLA_BREACH', { actor: SYSTEM, meta: { slaDueAt: cur.slaDueAt } });
        return true;
      });
      if (did) { marked++; this.emit('service_request.sla_breach', c.vendorId, SYSTEM, { requestId: c.id }); }
    }
    return { marked };
  }

  /** OFF unless staff switched it on and set the number of days. Approves work that has waited that long in review, exactly as the vendor's own approval would. */
  async autoApproveTick() {
    const ws = await this.walletSettings.get(); const now = this.clock();
    if (!ws.serviceAutoApproveEnabled || ws.serviceAutoApproveAfterDays === null) return { approved: 0, failed: 0, enabled: false };
    let approved = 0; let failed = 0;
    for (const c of await this.store.autoApproveCandidates(new Date(now.getTime() - ws.serviceAutoApproveAfterDays * 86_400_000), 100)) {
      if (!isAutoApprovable({ status: c.status, readyAt: c.readyAt }, now, { enabled: true, afterDays: ws.serviceAutoApproveAfterDays })) continue;
      try { await this.approve(c.vendorId, c.id, SYSTEM, 'SYSTEM'); approved++; } catch { failed++; }
    }
    return { approved, failed, enabled: true };
  }
}

export { requestError };
