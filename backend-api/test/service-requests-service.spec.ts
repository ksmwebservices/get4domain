import { HttpException } from '@nestjs/common';
import { advanceDays, SUPER, V1 } from './support/wallet-world';
import { OPS } from './support/services-world';
import { POSTER_TOTAL, requestsWorld, RequestsWorld, TEAM, vendorActor } from './support/service-requests-world';

/**
 * Slice 5.16c on the in-memory twins (request, services and wallet rows share one unit of work): a wallet request HOLDS the price (no tax: GST was added at the refill), CHARGES it only when the vendor approves, RELEASES it on cancel
 * or rejection; allowance first, then pack, then wallet; one charge however often anyone approves; NO invoice for a charge (the refill has the tax invoice); the same rules for staff acting on behalf.
 */
let w: RequestsWorld;
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string; body: Record<string, unknown> }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) { const b = e.getResponse() as Record<string, unknown>; return { status: e.getStatus(), code: b.code as string | undefined, body: b }; } throw e; }
  throw new Error('expected a refusal');
};
const V = (id = 'v1') => vendorActor(id);
const create = (vendorId = 'v1', over: Record<string, unknown> = {}) => w.svcReq.create(vendorId, { serviceKey: 'POSTER_DESIGN', brief: w.brief(), idempotencyKey: w.key(), ...over } as never, { type: 'VENDOR', actor: V(vendorId) });
const wallet = async (v = 'v1') => (await w.store.wallet(v))!;
const ledger = (kind: string, v = 'v1') => w.store.ledger.filter((e) => e.vendorId === v && e.kind === kind);

beforeEach(async () => { w = requestsWorld(); await w.seed(); await w.price('POSTER_DESIGN', 50_000); });

describe('making a request', () => {
  it('is refused until staff set the revision limit (nothing is invented)', async () => {
    await w.vendor('v1', 200_000); w.wsettings.over = { ...w.wsettings.over, serviceMaxRevisions: undefined as never }; delete (w.wsettings.over as Record<string, unknown>).serviceMaxRevisions;
    expect((await codeOf(create())).code).toBe('SERVICE_REQUESTS_NOT_CONFIGURED');
    w.wsettings.over = { ...w.wsettings.over, serviceMaxRevisions: 0 };
    expect((await create()).status).toBe('REQUESTED');   // zero is an answer: no changes allowed
  });

  it('a wallet request HOLDS the exact price (no tax): the balance is untouched, the available money drops, and nothing is charged', async () => {
    await w.vendor('v1', 200_000);
    const r = await create();
    expect(r).toMatchObject({ status: 'REQUESTED', createdBy: 'YOU', replay: false, funding: { kind: 'WALLET', amountPaise: POSTER_TOTAL, heldPaise: POSTER_TOTAL, basePaise: 50_000 } });
    expect(JSON.stringify(r)).not.toMatch(/taxPaise|taxLines/);
    expect(await wallet()).toMatchObject({ balancePaise: 200_000, heldPaise: POSTER_TOTAL });
    const hold = ledger('HOLD')[0]; expect(hold).toMatchObject({ amountPaise: -POSTER_TOTAL, refType: 'service_request', refId: r.id }); expect(ledger('CHARGE')).toHaveLength(0);
    expect(w.requests.requests[0]).toMatchObject({ holdLedgerId: hold.id, priceSnapshotPaise: POSTER_TOTAL, fundingKind: 'WALLET' });
    expect(w.requests.eventRows.map((e) => e.type)).toEqual(['CREATED']); expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
  });

  it('a short wallet is INSUFFICIENT_WALLET with the exact shortfall and the top-up that covers it, and nothing at all is written', async () => {
    await w.vendor('v1', 20_000);
    const e = await codeOf(create()); expect([e.status, e.code]).toEqual([409, 'INSUFFICIENT_WALLET']);
    expect(e.body).toMatchObject({ shortfallPaise: 30_000, availablePaise: 20_000, requiredPaise: POSTER_TOTAL, suggestedTopupPaise: 30_000 });
    expect(w.requests.requests).toHaveLength(0); expect(ledger('HOLD')).toHaveLength(0); expect((await wallet()).heldPaise).toBe(0);
  });

  it('the plan allowance is used first, with no hold; when it is used up the wallet pays', async () => {
    await w.vendor('v1', 200_000); w.plan.features['services.included.POSTER_DESIGN'] = { state: 'LIMITED', limit: 1 };
    const a = await create(); expect(a.funding).toMatchObject({ kind: 'INCLUDED_ALLOWANCE', amountPaise: null, heldPaise: 0 }); expect(ledger('HOLD')).toHaveLength(0);
    const b = await create(); expect(b.funding.kind).toBe('WALLET'); expect((await wallet()).heldPaise).toBe(POSTER_TOTAL);
    await w.svcReq.cancel('v1', a.id, V());   // a cancelled allowance request gives the unit back
    expect((await create()).funding.kind).toBe('INCLUDED_ALLOWANCE');
  });

  it('a pack unit is set aside at once, so the same unit cannot be promised twice; the next request uses the wallet', async () => {
    await w.vendor('v1', 400_000); await w.pack('POSTER1', [{ serviceKey: 'POSTER_DESIGN', count: 1 }], 20_000); await w.catalogue.purchasePack('v1', 'POSTER1', 'buy-pack-key-0001', V());
    const [x, y] = await Promise.all([create(), create()]);
    expect([x.funding.kind, y.funding.kind].sort()).toEqual(['PACK', 'WALLET']);
  });

  it('refuses what cannot be requested: unknown, retired or vendor-only services, a Free or lapsed plan, a service with no price', async () => {
    await w.vendor('v1', 200_000);
    expect((await codeOf(create('v1', { serviceKey: 'NOPE' }))).code).toBe('SERVICE_NOT_REQUESTABLE');
    await w.catalogue.updateService('SEO_TASK', { doneBy: 'VENDOR' }, OPS); expect((await codeOf(create('v1', { serviceKey: 'SEO_TASK' }))).code).toBe('SERVICE_NOT_REQUESTABLE');
    expect((await codeOf(create('v1', { serviceKey: 'REEL_SLIDESHOW', brief: w.brief() }))).body).toMatchObject({ code: 'SERVICE_NOT_REQUESTABLE', reason: 'PRICE_NOT_SET' });
    w.plan.level = 'FREE'; w.plan.subscriptionStatus = 'EXPIRED'; expect((await codeOf(create())).code).toBe('SERVICE_NOT_REQUESTABLE'); w.plan.level = 'PRO'; w.plan.subscriptionStatus = 'ACTIVE';
    expect(w.requests.requests).toHaveLength(0); expect(ledger('HOLD')).toHaveLength(0);
  });

  it('a vendor with no open wallet, and a frozen wallet, are refused with their own codes', async () => {
    expect((await codeOf(create('v2'))).code).toBe('WALLET_NOT_ACTIVE');
    await w.vendor('v1', 200_000); await w.svc.setFrozen('v1', { frozen: true, reason: 'chargeback review' }, SUPER);
    expect((await codeOf(create())).code).toBe('WALLET_FROZEN');
  });

  it('the brief is checked per service, in plain words', async () => {
    await w.vendor('v1', 200_000);
    for (const brief of [{}, { details: 'short' }, { ...w.brief(), vendorId: 'v2' }, { ...w.brief(), domain: 'a.example.com' }]) { const e = await codeOf(create('v1', { brief })); expect([e.status, e.code]).toEqual([400, 'SERVICE_REQUEST_BRIEF_INVALID']); expect(Array.isArray(e.body.errors)).toBe(true); }
    expect((await codeOf(create('v1', { attachmentRefs: ['not valid!'] }))).code).toBe('SERVICE_REQUEST_BRIEF_INVALID');
    expect(w.requests.requests).toHaveLength(0);
  });

  it('the same key returns the same request and one hold, even sent twenty times at once; a key for another service is refused', async () => {
    await w.vendor('v1', 400_000); const k = w.key();
    const rs = await Promise.all(Array.from({ length: 20 }, () => create('v1', { idempotencyKey: k })));
    expect(new Set(rs.map((r) => r.id)).size).toBe(1); expect(rs.filter((r) => !r.replay)).toHaveLength(1); expect(ledger('HOLD')).toHaveLength(1);
    await w.price('SEO_TASK', 10_000);
    expect((await codeOf(create('v1', { idempotencyKey: k, serviceKey: 'SEO_TASK' }))).code).toBe('WALLET_IDEMPOTENCY_CONFLICT');
  });

  it('two requests that each need the last of the balance: exactly one gets it, the other gets INSUFFICIENT_WALLET, and held never passes the balance', async () => {
    await w.vendor('v1', POSTER_TOTAL);
    const rs = await Promise.all([create(), create()].map((p) => p.then(() => 'ok', (e: HttpException) => (e.getResponse() as { code: string }).code)));
    expect(rs.sort()).toEqual(['INSUFFICIENT_WALLET', 'ok']); expect(await wallet()).toMatchObject({ balancePaise: POSTER_TOTAL, heldPaise: POSTER_TOTAL }); expect(w.requests.requests).toHaveLength(1);
  });

  it('forty parallel requests by a wallet that can fund three: exactly three succeed and the books balance', async () => {
    await w.vendor('v1', POSTER_TOTAL * 3 + 5_000);
    const rs = await Promise.all(Array.from({ length: 40 }, () => create().then(() => 'ok', (e: HttpException) => (e.getResponse() as { code: string }).code)));
    expect(rs.filter((r) => r === 'ok')).toHaveLength(3); expect(rs.filter((r) => r === 'INSUFFICIENT_WALLET')).toHaveLength(37);
    expect((await wallet()).heldPaise).toBe(POSTER_TOTAL * 3); expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
  });

  it('a crash while making a request leaves no hold and no request', async () => {
    await w.vendor('v1', 200_000); const before = JSON.stringify([await wallet(), w.store.ledger]);
    w.store.failCommitOnce = true; await expect(create()).rejects.toThrow(/simulated crash/);
    expect(JSON.stringify([await wallet(), w.store.ledger])).toBe(before); expect(w.requests.requests).toHaveLength(0);
  });
});

describe('staff acting on behalf of a vendor (never a silent charge)', () => {
  const onBehalf = (vendorId = 'v1', over: Record<string, unknown> = {}) => w.svcReq.raiseOnBehalf(vendorId, { serviceKey: 'POSTER_DESIGN', brief: w.brief(), idempotencyKey: w.key(), reason: 'The vendor asked us on a call.', ...over } as never, TEAM);
  it('needs a reason, follows the same funding rules, and the vendor sees it in their list, its history and their ledger', async () => {
    await w.vendor('v1', 200_000);
    expect((await codeOf(onBehalf('v1', { reason: 'no' }))).code).toBe('SERVICE_REQUEST_INVALID');
    const r = await onBehalf();
    expect(r).toMatchObject({ createdBy: 'OUR_TEAM', funding: { kind: 'WALLET', heldPaise: POSTER_TOTAL } });
    const mine = await w.svcReq.get('v1', r.id); expect(mine.events![0]).toMatchObject({ type: 'CREATED', by: 'OUR_TEAM', note: expect.stringContaining('The vendor asked us on a call.') });
    expect((await w.svcReq.list('v1', 1, 50)).items.map((i) => i.id)).toEqual([r.id]); expect((await w.svc.ledger('v1', 1, 50)).items[0]).toMatchObject({ kind: 'HOLD', refType: 'service_request', refId: r.id });
    expect(w.requests.audits.find((a) => a.action === 'service_request.create_on_behalf')).toMatchObject({ actor: { id: 'team-1' }, after: { reason: 'The vendor asked us on a call.' } });
  });
  it('a short wallet is refused exactly as for the vendor, and the vendor can cancel what the team raised', async () => {
    await w.vendor('v1', 10_000); expect((await codeOf(onBehalf())).code).toBe('INSUFFICIENT_WALLET');
    await w.svc.adjust('v1', { amountPaise: 100_000, reason: 'goodwill credit', idempotencyKey: 'adjust-for-cancel' }, SUPER);
    const r = await onBehalf(); await w.svcReq.cancel('v1', r.id, V()); expect((await wallet()).heldPaise).toBe(0);
  });
});

describe('the life of a request and the money', () => {
  it('REQUESTED to APPROVED: the hold becomes ONE charge of exactly that amount, NO invoice is issued, and the books balance', async () => {
    await w.vendor('v1', 200_000); const id = await w.ready('v1');
    expect(await wallet()).toMatchObject({ balancePaise: 200_000, heldPaise: POSTER_TOTAL });   // still only held while the work is being done
    const done = await w.svcReq.approve('v1', id, V());
    expect(done).toMatchObject({ status: 'APPROVED', replay: false }); expect(done).not.toHaveProperty('invoice');
    expect(await wallet()).toMatchObject({ balancePaise: 200_000 - POSTER_TOTAL, heldPaise: 0 });
    expect(ledger('CHARGE')).toHaveLength(1); expect(ledger('CHARGE')[0]).toMatchObject({ amountPaise: -POSTER_TOTAL, holdId: w.requests.requests[0].holdLedgerId, refId: id });
    expect(w.requests.invoiceRows).toHaveLength(0); expect(w.store.receipts).toHaveLength(0);   // a deduction is a ledger line and a usage statement line, never an invoice
    expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
  });
  it('an approval twice, and twelve at once, charge once and issue no invoice', async () => {
    await w.vendor('v1', 200_000); const id = await w.ready('v1');
    const rs = await Promise.all(Array.from({ length: 12 }, () => w.svcReq.approve('v1', id, V())));
    expect(rs.filter((r) => !r.replay)).toHaveLength(1); expect(ledger('CHARGE')).toHaveLength(1); expect(w.requests.invoiceRows).toHaveLength(0);
    expect((await w.svcReq.approve('v1', id, V())).replay).toBe(true); expect((await wallet()).balancePaise).toBe(200_000 - POSTER_TOTAL);
  });
  it('cancelling before production releases the hold and charges nothing; cancelling again changes nothing; cancelling once production started is refused', async () => {
    await w.vendor('v1', 200_000); const r = await create();
    const c = await w.svcReq.cancel('v1', r.id, V()); expect(c.status).toBe('CANCELLED');
    expect(await wallet()).toMatchObject({ balancePaise: 200_000, heldPaise: 0 }); expect(ledger('RELEASE')).toHaveLength(1); expect(ledger('CHARGE')).toHaveLength(0);
    await w.svcReq.cancel('v1', r.id, V()); expect(ledger('RELEASE')).toHaveLength(1);
    const r2 = await create(); await w.svcReq.setStatus(r2.id, { to: 'ACCEPTED' }, TEAM); await w.svcReq.cancel('v1', r2.id, V());   // accepted is still before production
    const r3 = await create(); await w.svcReq.setStatus(r3.id, { to: 'ACCEPTED' }, TEAM); await w.svcReq.setStatus(r3.id, { to: 'IN_PRODUCTION' }, TEAM);
    expect((await codeOf(w.svcReq.cancel('v1', r3.id, V()))).code).toBe('SERVICE_REQUEST_STATE'); expect((await wallet()).heldPaise).toBe(POSTER_TOTAL);
  });
  it('a rejection needs a reason, releases the hold, charges nothing and shows the vendor why; it works at any open stage', async () => {
    await w.vendor('v1', 200_000);
    const a = await create(); expect((await codeOf(w.svcReq.reject(a.id, { reason: 'no' }, TEAM))).code).toBe('SERVICE_REQUEST_INVALID');
    const rej = await w.svcReq.reject(a.id, { reason: 'This is outside what we do.' }, TEAM); expect(rej.status).toBe('REJECTED_BY_TEAM');
    expect((await w.svcReq.get('v1', a.id)).rejectReason).toBe('This is outside what we do.'); expect((await wallet()).heldPaise).toBe(0);
    const b = await w.ready('v1'); await w.svcReq.reject(b, { reason: 'We cannot deliver this.' }, TEAM);
    expect(await wallet()).toMatchObject({ balancePaise: 200_000, heldPaise: 0 }); expect(ledger('CHARGE')).toHaveLength(0); expect(ledger('RELEASE')).toHaveLength(2);
    expect((await codeOf(w.svcReq.reject(a.id, { reason: 'Again, for a reason.' }, TEAM))).code).toBe('SERVICE_REQUEST_STATE');
  });
  it('changes can be asked for up to the limit staff set; the vendor is told how many are left; one more is refused', async () => {
    await w.vendor('v1', 200_000); const id = await w.ready('v1');
    for (let i = 0; i < 2; i++) {
      const r = await w.svcReq.requestRevision('v1', id, { note: 'Please make the heading bigger.' }, V()); expect(r).toMatchObject({ status: 'REVISION_REQUESTED', revisionsUsed: i + 1, revisionsLeft: 1 - i });
      await w.svcReq.setStatus(id, { to: 'IN_PRODUCTION' }, TEAM); await w.svcReq.setStatus(id, { to: 'READY_FOR_REVIEW' }, TEAM);
    }
    expect((await codeOf(w.svcReq.requestRevision('v1', id, { note: 'One more change please.' }, V()))).code).toBe('REVISION_LIMIT_REACHED');
    expect((await codeOf(w.svcReq.requestRevision('v1', id, { note: 'no' }, V()))).code).toBe('SERVICE_REQUEST_INVALID');
    expect((await w.svcReq.approve('v1', id, V())).status).toBe('APPROVED');
  });
  it('the steps cannot be skipped: ready needs finished work; accepted cannot jump to ready; the team cannot approve; the vendor cannot approve unfinished work', async () => {
    await w.vendor('v1', 200_000); const r = await create();
    expect((await codeOf(w.svcReq.setStatus(r.id, { to: 'READY_FOR_REVIEW' }, TEAM))).code).toBe('SERVICE_REQUEST_STATE');
    await w.svcReq.setStatus(r.id, { to: 'ACCEPTED' }, TEAM); await w.svcReq.setStatus(r.id, { to: 'IN_PRODUCTION' }, TEAM);
    expect((await codeOf(w.svcReq.setStatus(r.id, { to: 'READY_FOR_REVIEW' }, TEAM))).code).toBe('DELIVERABLE_REQUIRED');
    expect((await codeOf(w.svcReq.approve('v1', r.id, V()))).code).toBe('SERVICE_REQUEST_STATE');
    expect((await codeOf(w.svcReq.setStatus(r.id, { to: 'APPROVED' as never }, TEAM))).code).toBe('SERVICE_REQUEST_INVALID');
    expect((await codeOf(w.svcReq.addDeliverable(r.id, { kind: 'LINK', fileRef: 'http://not-https.example.com' }, TEAM))).code).toBe('SERVICE_REQUEST_INVALID');
    expect((await codeOf(w.svcReq.addDeliverable(r.id, { kind: 'TEXT', text: '' }, TEAM))).code).toBe('SERVICE_REQUEST_INVALID');
  });
  it('an allowance request costs nothing on approval; a pack request uses one unit of the pack that was bought (even if its date passed meanwhile)', async () => {
    await w.vendor('v1', 400_000); w.plan.features['services.included.POSTER_DESIGN'] = { state: 'LIMITED', limit: 1 };
    const a = await w.ready('v1'); await w.svcReq.approve('v1', a, V()); expect(ledger('CHARGE')).toHaveLength(0); expect(w.requests.invoiceRows).toHaveLength(0); expect((await wallet()).balancePaise).toBe(400_000);
    await w.pack('POSTER2', [{ serviceKey: 'POSTER_DESIGN', count: 2 }], 20_000, { validityDays: 5 }); await w.catalogue.purchasePack('v1', 'POSTER2', 'buy-pack-key-0002', V());
    const p = await w.ready('v1'); expect(w.requests.requests.find((r) => r.id === p)!.fundingKind).toBe('PACK');
    advanceDays(w, 10);   // the pack has expired by now, but the unit was promised when the request was made
    await w.svcReq.approve('v1', p, V()); expect((await w.services.purchasesFor('v1'))[0].remaining).toEqual({ POSTER_DESIGN: 1 }); expect(w.requests.requests.find((r) => r.id === p)!.packPurchaseId).toBeTruthy();
    expect(ledger('CHARGE')).toHaveLength(0);
  });
  it('a crash while approving leaves the work in review, no charge and no invoice', async () => {
    await w.vendor('v1', 200_000); const id = await w.ready('v1'); const before = JSON.stringify([await wallet(), w.store.ledger]);
    w.store.failCommitOnce = true; await expect(w.svcReq.approve('v1', id, V())).rejects.toThrow(/simulated crash/);
    expect(JSON.stringify([await wallet(), w.store.ledger])).toBe(before); expect(w.requests.requests[0].status).toBe('READY_FOR_REVIEW'); expect(w.requests.invoiceRows).toHaveLength(0);
  });
});

describe('a deduction creates no invoice, only ledger lines and a usage statement (owner 5 November 2026)', () => {
  it('twelve approvals by two vendors at once make twelve charges, no invoice and no document; each vendor\'s usage statement lists their own six', async () => {
    await w.vendor('v1', 2_000_000); await w.vendor('v2', 2_000_000);
    const ids: Array<[string, string]> = [];
    for (let i = 0; i < 6; i++) { ids.push(['v1', await w.ready('v1')]); ids.push(['v2', await w.ready('v2')]); }
    const before = w.store.receipts.length;
    await Promise.all(ids.map(([v, id]) => w.svcReq.approve(v, id, V(v))));
    expect(w.store.ledger.filter((e) => e.kind === 'CHARGE')).toHaveLength(12); expect(w.requests.invoiceRows).toHaveLength(0); expect(w.store.receipts).toHaveLength(before);
    for (const v of ['v1', 'v2']) { const s = await w.svc.usageStatement(v, {}); expect(s.lines).toHaveLength(6); expect(s.lines.every((l) => l.refType === 'service_request')).toBe(true); expect(s.totals.usedPaise).toBe(6 * POSTER_TOTAL); }
    expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true }); expect(await w.svc.reconcileVendor('v2')).toMatchObject({ ok: true });
  });
  it('there is no vendor invoice list for requests any more', () => {
    expect((w.svcReq as unknown as Record<string, unknown>).invoices).toBeUndefined();
  });
});

describe('tenants and what the vendor sees', () => {
  it('another vendor can never see, cancel, approve or ask changes of a request: the same answer as for one that does not exist', async () => {
    await w.vendor('v1', 200_000); await w.vendor('v2', 200_000); const id = await w.ready('v1');
    const missing = await codeOf(w.svcReq.get('v2', 'nope'));
    for (const fn of [() => w.svcReq.get('v2', id), () => w.svcReq.cancel('v2', id, V('v2')), () => w.svcReq.approve('v2', id, V('v2')), () => w.svcReq.requestRevision('v2', id, { note: 'Please change this.' }, V('v2'))]) {
      const e = await codeOf(fn()); expect([e.status, e.code, e.body.message]).toEqual([missing.status, missing.code, missing.body.message]);
    }
    expect((await w.svcReq.list('v2', 1, 50)).total).toBe(0); expect(w.requests.requests[0].status).toBe('READY_FOR_REVIEW'); expect((await wallet('v2')).heldPaise).toBe(0);
  });
  it('the vendor sees the work only once it has come to review, and never a staff identity', async () => {
    await w.vendor('v1', 200_000); const r = await create(); await w.svcReq.setStatus(r.id, { to: 'ACCEPTED' }, TEAM); await w.svcReq.setStatus(r.id, { to: 'IN_PRODUCTION' }, TEAM);
    await w.svcReq.assign(r.id, { staffId: 'secret-staff-42' }, TEAM); await w.svcReq.addDeliverable(r.id, { kind: 'TEXT', text: 'A draft that is not ready yet.' }, TEAM);
    expect((await w.svcReq.get('v1', r.id)).deliverables).toEqual([]);
    await w.svcReq.setStatus(r.id, { to: 'READY_FOR_REVIEW' }, TEAM);
    const d = await w.svcReq.get('v1', r.id); expect(d.deliverables).toHaveLength(1);
    expect(JSON.stringify(d)).not.toMatch(/secret-staff-42|team-1|assignedStaffId|holdLedgerId|vendorId|idempotency|slaDueAt/); expect(d.events!.every((e) => ['YOU', 'OUR_TEAM', 'SYSTEM'].includes(e.by))).toBe(true);
  });
  it('the staff view shows everything: who, the SLA, the ledger links', async () => {
    await w.vendor('v1', 200_000); const id = await w.ready('v1'); await w.svcReq.assign(id, { staffId: 'staff-9' }, TEAM);
    expect(await w.svcReq.adminGet(id)).toMatchObject({ vendorId: 'v1', assignedStaffId: 'staff-9', holdLedgerId: expect.any(String), events: expect.arrayContaining([expect.objectContaining({ actorId: 'team-1' })]) });
  });
});

describe('the team queue, due times and the auto-approval timer', () => {
  it('filters by service, status, funding kind and vendor', async () => {
    await w.vendor('v1', 400_000); await w.vendor('v2', 400_000); await w.price('SEO_TASK', 10_000);
    await create('v1'); await create('v2'); await create('v1', { serviceKey: 'SEO_TASK' });
    const ids = async (f: Record<string, unknown>) => (await w.svcReq.adminList({ page: 1, pageSize: 50, ...f })).items.length;
    expect(await ids({})).toBe(3); expect(await ids({ serviceKey: 'SEO_TASK' })).toBe(1); expect(await ids({ vendorId: 'v1' })).toBe(2); expect(await ids({ status: 'ACCEPTED' })).toBe(0); expect(await ids({ fundingKind: 'WALLET' })).toBe(3); expect(await ids({ fundingKind: 'PACK' })).toBe(0);
  });
  it('an SLA breach is marked once, only for open work with a due time that has gone, and can be filtered', async () => {
    await w.vendor('v1', 200_000); const r = await create(); await w.svcReq.assign(r.id, { slaDueAt: new Date(w.now.t.getTime() + 3_600_000).toISOString() }, TEAM);
    expect(await w.svcReq.slaSweep()).toEqual({ marked: 0 });
    advanceDays(w, 1); expect(await w.svcReq.slaSweep()).toEqual({ marked: 1 }); expect(await w.svcReq.slaSweep()).toEqual({ marked: 0 });
    expect(w.requests.eventRows.filter((e) => e.type === 'SLA_BREACH')).toHaveLength(1); expect((await w.svcReq.adminList({ page: 1, pageSize: 10, slaBreached: true })).total).toBe(1);
    expect((await codeOf(w.svcReq.assign(r.id, { slaDueAt: '2020-01-01T00:00:00Z' }, TEAM))).code).toBe('SERVICE_REQUEST_INVALID');
  });
  it('auto-approval does nothing by default; when switched on with days it approves work that waited that long, charging once', async () => {
    await w.vendor('v1', 200_000); const id = await w.ready('v1');
    expect(await w.svcReq.autoApproveTick()).toEqual({ approved: 0, failed: 0, enabled: false });
    w.wsettings.over = { ...w.wsettings.over, serviceAutoApproveEnabled: true };
    expect(await w.svcReq.autoApproveTick()).toMatchObject({ enabled: false });   // on, but no number of days: still nothing
    w.wsettings.over = { ...w.wsettings.over, serviceAutoApproveEnabled: true, serviceAutoApproveAfterDays: 3 };
    advanceDays(w, 2); expect(await w.svcReq.autoApproveTick()).toMatchObject({ approved: 0 });
    advanceDays(w, 2); expect(await w.svcReq.autoApproveTick()).toEqual({ approved: 1, failed: 0, enabled: true }); expect(await w.svcReq.autoApproveTick()).toMatchObject({ approved: 0 });
    expect(ledger('CHARGE')).toHaveLength(1); expect(w.requests.requests.find((r) => r.id === id)!.status).toBe('APPROVED');
    expect(w.requests.eventRows.find((e) => e.type === 'STATUS' && e.toStatus === 'APPROVED')).toMatchObject({ actorType: 'SYSTEM', note: expect.stringMatching(/automatically/i) });
  });
});

describe('the custom domain promotion (switched on through the existing audited path)', () => {
  beforeEach(async () => { await w.price('CUSTOM_DOMAIN_PROMOTION', 100_000); await w.vendor('v1', 500_000); });
  const promo = (over: Record<string, unknown> = {}) => create('v1', { serviceKey: 'CUSTOM_DOMAIN_PROMOTION', brief: w.brief({ domain: 'shop.example.com' }), ...over });
  it('needs the end date staff set before it can go to review; the code chooses no length of time', async () => {
    const r = await promo(); await w.svcReq.setStatus(r.id, { to: 'ACCEPTED' }, TEAM); await w.svcReq.setStatus(r.id, { to: 'IN_PRODUCTION' }, TEAM); await w.svcReq.addDeliverable(r.id, { kind: 'TEXT', text: 'Your domain is connected.' }, TEAM);
    expect((await codeOf(w.svcReq.setStatus(r.id, { to: 'READY_FOR_REVIEW' }, TEAM))).code).toBe('GRANT_DATE_REQUIRED');
    expect((await codeOf(w.svcReq.assign(r.id, { grantEndsAt: '2020-01-01T00:00:00Z' }, TEAM))).code).toBe('SERVICE_REQUEST_INVALID');
    await w.svcReq.assign(r.id, { grantEndsAt: new Date(w.now.t.getTime() + 86_400_000 * 40).toISOString() }, TEAM); expect((await w.svcReq.setStatus(r.id, { to: 'READY_FOR_REVIEW' }, TEAM)).status).toBe('READY_FOR_REVIEW');
    const other = await create(); await w.svcReq.setStatus(other.id, { to: 'ACCEPTED' }, TEAM); expect((await codeOf(w.svcReq.assign(other.id, { grantEndsAt: new Date(w.now.t.getTime() + 86_400_000).toISOString() }, TEAM))).code).toBe('SERVICE_REQUEST_INVALID');
  });
  it('on approval the add-on is switched on ONCE with the staff end date, however often it is approved or retried', async () => {
    const id = await w.ready('v1', 'CUSTOM_DOMAIN_PROMOTION', w.key(), w.brief({ domain: 'shop.example.com' }));
    const ends = w.requests.requests.find((r) => r.id === id)!.grantEndsAt!;
    await Promise.all(Array.from({ length: 5 }, () => w.svcReq.approve('v1', id, V()))); await w.svcReq.approve('v1', id, V());
    expect(w.promo.calls).toHaveLength(1); expect(w.promo.calls[0]).toMatchObject({ vendorId: 'v1', endsAt: ends }); expect(w.requests.requests.find((r) => r.id === id)!.grantOverrideId).toBe('override-1');
    expect(w.requests.eventRows.filter((e) => e.type === 'PROMOTION_GRANTED')).toHaveLength(1); expect(ledger('CHARGE')).toHaveLength(1);
  });
  it('if the add-on cannot be switched on, the request is still approved and charged, the failure is recorded, and the grant can be retried (and healed by an approve replay)', async () => {
    w.promo.fail = true; const id = await w.ready('v1', 'CUSTOM_DOMAIN_PROMOTION', w.key(), w.brief({ domain: 'shop.example.com' }));
    expect((await w.svcReq.approve('v1', id, V())).status).toBe('APPROVED'); expect(ledger('CHARGE')).toHaveLength(1);
    expect(w.requests.eventRows.some((e) => e.type === 'PROMOTION_GRANT_FAILED')).toBe(true); expect(w.requests.requests.find((r) => r.id === id)!.grantOverrideId).toBeNull();
    w.promo.fail = false; expect(await w.svcReq.retryGrant(id, TEAM)).toEqual({ granted: true, overrideId: 'override-1' }); expect(await w.svcReq.retryGrant(id, TEAM)).toEqual({ granted: true, overrideId: 'override-1' });
    expect(w.promo.calls).toHaveLength(1);
    w.promo.fail = true; const id2 = await w.ready('v1', 'CUSTOM_DOMAIN_PROMOTION', w.key(), w.brief({ domain: 'shop.example.com' })); await w.svcReq.approve('v1', id2, V());
    w.promo.fail = false; await w.svcReq.approve('v1', id2, V()); expect(w.promo.calls).toHaveLength(2);   // the second approve is a replay that heals the grant
  });
  it('a retry is only for an approved promotion', async () => {
    const r = await promo(); expect((await codeOf(w.svcReq.retryGrant(r.id, TEAM))).code).toBe('SERVICE_REQUEST_STATE');
    const p = await create(); expect((await codeOf(w.svcReq.retryGrant(p.id, TEAM))).code).toBe('SERVICE_REQUEST_STATE');
  });
});
void V1;
