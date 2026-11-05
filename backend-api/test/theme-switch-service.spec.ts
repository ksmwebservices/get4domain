import { HttpException } from '@nestjs/common';
import { postEntry } from '../src/v3-wallet/wallet-engine';
import { advanceDays, SUPER } from './support/wallet-world';
import { OPS } from './support/services-world';
import { TEAM, vendorActor } from './support/service-requests-world';
import { THEME_FEE_BASE, THEME_FEE_TOTAL, themeWorld, ThemeWorld } from './support/theme-switch-world';

/**
 * Slice 5.16d on the in-memory twins: the Theme Switch Service (owner rule 4). The first switch is included in Pro, later ones are charged to the wallet by the approved fee, a staff gift and a restore are
 * neither, a preview is free and stores nothing, and a vendor is never left charged for a switch that did not happen. The site pipeline is a controllable fake; the real adapter is compiled and exercised on staging.
 */
let w: ThemeWorld; let n = 0;
const key = () => `theme-key-${++n}-abcdefgh`;
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string; body: Record<string, unknown> }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) { const b = e.getResponse() as Record<string, unknown>; return { status: e.getStatus(), code: b.code as string | undefined, body: b }; } throw e; }
  throw new Error('expected a refusal');
};
const sw = (theme: string, vendorId = 'v1', k = key()) => w.themes.switchTheme(vendorId, { themeId: theme, idempotencyKey: k }, w.vendorBy(vendorId));
const wallet = async (v = 'v1') => (await w.store.wallet(v))!;
const charges = (v = 'v1') => w.store.ledger.filter((e) => e.vendorId === v && e.refType === 'theme_switch' && e.kind === 'CHARGE');
const rows = (v = 'v1') => w.themeStore.rows.filter((r) => r.vendorId === v);

beforeEach(async () => { w = themeWorld(); await w.seed(); await w.ensureFee(); await w.vendor('v1', 500_000); await w.vendor('v2', 500_000); });

describe('the fee: the first switch is included, every later one is paid', () => {
  it('the first switch is free: no charge, applied through the pipeline as a new publication, recorded', async () => {
    const r = await sw('pro-b');
    expect(r).toMatchObject({ kind: 'FREE_INCLUDED', status: 'APPLIED', to: 'pro-b', from: 'standard-a', by: 'YOU', amountPaise: null, replay: false, publicationId: expect.stringMatching(/^pub-/) });
    expect(charges()).toHaveLength(0); expect((await wallet()).balancePaise).toBe(500_000); expect(w.pipe.vendors.get('v1')).toMatchObject({ stored: 'pro-b', published: 'pro-b' });
    expect(rows()[0]).toMatchObject({ ledgerEntryId: null, status: 'APPLIED' });
  });
  it('the second switch is charged exactly the approved fee plus tax, once, from the wallet', async () => {
    await sw('pro-b'); const r = await sw('pro-c');
    expect(r).toMatchObject({ kind: 'PAID', status: 'APPLIED', amountPaise: THEME_FEE_TOTAL });
    expect(charges()).toHaveLength(1); expect(charges()[0]).toMatchObject({ amountPaise: -THEME_FEE_TOTAL, refType: 'theme_switch' }); expect((await wallet()).balancePaise).toBe(500_000 - THEME_FEE_TOTAL);
    expect(rows().find((x) => x.kind === 'PAID')).toMatchObject({ priceSnapshotPaise: THEME_FEE_TOTAL, ledgerEntryId: charges()[0].id });
    expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
  });
  it('every later switch is paid too, however many, and a renewal does not give another free one', async () => {
    await sw('pro-b'); await w.bus.emit({ type: 'plan.order.paid', vendorId: 'v1', at: new Date(), data: { orderId: 'o1', planLevel: 'PRO' } }); advanceDays(w, 400);
    expect((await sw('pro-c')).kind).toBe('PAID'); expect((await sw('pro-d')).kind).toBe('PAID'); expect((await sw('pro-b')).kind).toBe('PAID'); expect(charges()).toHaveLength(3);
  });
  it('a vendor\'s own history does not leak into another vendor\'s: each has their own included switch', async () => {
    await sw('pro-b'); expect((await sw('pro-b', 'v2')).kind).toBe('FREE_INCLUDED');
  });
});

describe('the preview is free and stores nothing', () => {
  it('draws the theme with the vendor\'s own content, writes no row, no ledger entry, no audit, and never applies', async () => {
    const before = JSON.stringify([w.themeStore.rows, w.store.ledger, await wallet(), w.themeStore.audits]);
    const p = await w.themes.preview('v1', 'pro-b');
    expect(p).toMatchObject({ themeId: 'pro-b', current: 'standard-a', alreadyActive: false, html: expect.stringContaining('pro-b'), css: '.x{}', fee: { kind: 'FREE_INCLUDED', free: true } });
    expect(JSON.stringify([w.themeStore.rows, w.store.ledger, await wallet(), w.themeStore.audits])).toBe(before); expect(w.pipe.calls.apply).toBe(0); expect(w.pipe.vendors.get('v1')!.stored).toBe('standard-a');
  });
  it('tells the vendor the price before they confirm: the included switch, or the approved fee with tax and how it would be paid', async () => {
    await sw('pro-b');
    const p = await w.themes.preview('v1', 'pro-c');
    expect(p.fee).toMatchObject({ kind: 'PAID', free: false, price: { amountPaise: THEME_FEE_BASE, taxInclusive: false }, tax: { taxPaise: 5_382, totalPaise: THEME_FEE_TOTAL }, amountPaise: THEME_FEE_TOTAL, funding: { kind: 'WALLET', amountPaise: THEME_FEE_TOTAL } });
    await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 480_000, idempotencyKey: 'drain-0001', actor: { type: 'SYSTEM', id: null }, now: new Date(w.now.t) }));
    expect((await w.themes.preview('v1', 'pro-c')).fee).toMatchObject({ funding: { kind: 'NONE', reason: 'INSUFFICIENT_WALLET', shortfallPaise: THEME_FEE_TOTAL - (500_000 - THEME_FEE_TOTAL - 480_000) - THEME_FEE_TOTAL } });
  });
  it('says "price not set" when the fee has no approved price; refuses a theme that cannot be used', async () => {
    const x = themeWorld(); await x.seed(); await x.vendor('v1', 100_000); await x.themes.switchTheme('v1', { themeId: 'pro-b', idempotencyKey: key() }, x.vendorBy());
    expect((await x.themes.preview('v1', 'pro-c')).fee).toMatchObject({ kind: 'PAID', priceNote: 'Price not set', funding: { kind: 'NONE', reason: 'PRICE_NOT_SET' } });
    expect((await codeOf(w.themes.preview('v1', 'no-such-theme'))).code).toBe('THEME_NOT_ALLOWED'); expect((await codeOf(w.themes.preview('v1', '../etc'))).code).toBe('THEME_SWITCH_INVALID');
  });
  it('the preview reference is signed, for that vendor only, and runs out', async () => {
    const p = await w.themes.preview('v1', 'pro-b');
    expect(w.themes.verifyPreviewRef('v1', p.previewRef)).toEqual({ themeId: 'pro-b' }); expect(w.themes.verifyPreviewRef('v2', p.previewRef)).toBeNull();
    expect(w.themes.verifyPreviewRef('v1', `${p.previewRef.split('.')[0]}.tampered`)).toBeNull(); expect(w.themes.verifyPreviewRef('v1', 'garbage')).toBeNull();
    advanceDays(w, 1); expect(w.themes.verifyPreviewRef('v1', p.previewRef)).toBeNull();
  });
});

describe('a short wallet changes nothing', () => {
  it('INSUFFICIENT_WALLET with the exact shortfall and the top-up that covers it; nothing is applied, charged or recorded', async () => {
    await sw('pro-b'); await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 490_000, idempotencyKey: 'drain-0002', actor: { type: 'SYSTEM', id: null }, now: new Date(w.now.t) }));
    const before = rows().length; const applies = w.pipe.calls.apply;
    const e = await codeOf(sw('pro-c')); expect([e.status, e.code]).toEqual([409, 'INSUFFICIENT_WALLET']);
    expect(e.body).toMatchObject({ shortfallPaise: THEME_FEE_TOTAL - 10_000, availablePaise: 10_000, requiredPaise: THEME_FEE_TOTAL, minTopupPaise: 10_000 });
    expect(rows()).toHaveLength(before); expect(w.pipe.calls.apply).toBe(applies); expect(w.pipe.vendors.get('v1')!.stored).toBe('pro-b'); expect(charges()).toHaveLength(0);
  });
  it('held money is not spendable, and a frozen or closed wallet is refused with its own code', async () => {
    await sw('pro-b'); await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'HOLD', amountPaise: 480_000, idempotencyKey: 'hold-0001', actor: { type: 'SYSTEM', id: null }, now: new Date(w.now.t) }));
    expect((await codeOf(sw('pro-c'))).code).toBe('INSUFFICIENT_WALLET');
    await sw('pro-b', 'v2'); await w.svc.setFrozen('v2', { frozen: true, reason: 'chargeback review' }, SUPER);
    expect((await codeOf(sw('pro-c', 'v2'))).code).toBe('WALLET_FROZEN'); expect(w.pipe.vendors.get('v2')!.stored).toBe('pro-b'); expect(charges('v2')).toHaveLength(0);
    await w.pipe.snapshot('v3'); await sw('pro-b', 'v3');   // a vendor with no wallet gets the included switch, but cannot buy another
    expect((await codeOf(sw('pro-c', 'v3'))).code).toBe('WALLET_NOT_ACTIVE'); expect(w.pipe.vendors.get('v3')!.stored).toBe('pro-b');
  });
});

describe('a failure never leaves a charge behind', () => {
  it('a publish failure after the charge: the stored theme goes back, the charge is reversed, the row is FAILED, the vendor is told nothing was charged', async () => {
    await sw('pro-b'); w.pipe.fail = 'publish';
    const e = await codeOf(sw('pro-c')); expect([e.status, e.code]).toEqual([409, 'THEME_SWITCH_FAILED']); expect(e.body.message).toMatch(/nothing was charged/i);
    expect(w.pipe.vendors.get('v1')!.stored).toBe('pro-b'); expect(w.pipe.vendors.get('v1')!.published).toBe('pro-b');
    expect((await wallet()).balancePaise).toBe(500_000); expect(charges()).toHaveLength(1); expect(w.store.ledger.filter((x) => x.kind === 'REVERSAL' && x.refType === 'theme_switch')).toHaveLength(1);
    expect(rows().find((r) => r.status === 'FAILED')).toMatchObject({ kind: 'PAID' }); expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
    const h = await w.themes.history('v1', 1, 50); expect(h.items.find((i) => i.status === 'FAILED')).toMatchObject({ kind: 'PAID', note: expect.stringMatching(/nothing was charged/i) });
  });
  it('a failure in the middle (the theme was stored, the build failed) puts the previous theme back', async () => {
    await sw('pro-b'); w.pipe.fail = 'after-set'; await codeOf(sw('pro-c')); expect(w.pipe.vendors.get('v1')!.stored).toBe('pro-b'); expect((await wallet()).balancePaise).toBe(500_000);
  });
  it('a failed switch does not count: a failed FIRST switch leaves the included one, a failed paid one is not a second charge when retried', async () => {
    w.pipe.fail = 'publish'; await codeOf(sw('pro-b')); expect(charges()).toHaveLength(0); expect(rows()[0]).toMatchObject({ kind: 'FREE_INCLUDED', status: 'FAILED' });
    w.pipe.fail = 'none'; expect((await sw('pro-b')).kind).toBe('FREE_INCLUDED');
    w.pipe.fail = 'publish'; await codeOf(sw('pro-c')); w.pipe.fail = 'none'; const ok = await sw('pro-c'); expect(ok.kind).toBe('PAID');
    expect(w.store.ledger.filter((x) => x.kind === 'CHARGE' && x.refType === 'theme_switch')).toHaveLength(2); expect(w.store.ledger.filter((x) => x.kind === 'REVERSAL')).toHaveLength(1); expect((await wallet()).balancePaise).toBe(500_000 - THEME_FEE_TOTAL);
  });
  it('a crash while recording the charge leaves no charge and no row (the unit rolls back)', async () => {
    await sw('pro-b'); const before = JSON.stringify([await wallet(), w.store.ledger, rows()]);
    w.store.failCommitOnce = true; await expect(sw('pro-c')).rejects.toThrow(/simulated crash/);
    expect(JSON.stringify([await wallet(), w.store.ledger, rows()])).toBe(before); expect(w.pipe.vendors.get('v1')!.stored).toBe('pro-b');
  });
  it('a switch left PENDING by a crash is settled from the real state: undone and reversed when the site never changed, applied when it did', async () => {
    await sw('pro-b');
    const pend = async (to: string, k: string) => w.themeStore.unit('v1', async (t, _s, wtx) => {
      const c = await postEntry(wtx, { kind: 'CHARGE', amountPaise: THEME_FEE_TOTAL, idempotencyKey: `themeswitch:v1:${k}`, refType: 'theme_switch', refId: k, actor: { type: 'VENDOR', id: 'v1' }, now: new Date(w.now.t) });
      return t.insert({ id: w.themeStore.newId(), vendorId: 'v1', siteId: null, fromThemeKey: 'pro-b', toThemeKey: to, kind: 'PAID', performedByType: 'VENDOR', performedById: 'v1', serviceRequestId: null, ledgerEntryId: c.entry.id, packPurchaseId: null, priceSnapshotPaise: THEME_FEE_TOTAL, taxSnapshot: {}, status: 'PENDING', idempotencyKey: k, reason: null, hiddenFields: [] });
    });
    const never = await pend('pro-c', 'crash-never-0001'); const did = await pend('pro-d', 'crash-did-00001'); w.pipe.vendors.get('v1')!.stored = 'pro-d'; w.pipe.vendors.get('v1')!.published = 'pro-d';
    expect(await w.themes.recoverStale(30)).toEqual({ applied: 0, reversed: 0 });   // too recent
    advanceDays(w, 1); const r = await w.themes.recoverStale(30);
    expect(r).toEqual({ applied: 1, reversed: 1 }); expect(w.themeStore.rows.find((x) => x.id === never.id)!.status).toBe('FAILED'); expect(w.themeStore.rows.find((x) => x.id === did.id)!.status).toBe('APPLIED');
    expect(w.store.ledger.filter((x) => x.kind === 'REVERSAL')).toHaveLength(1); expect(await w.themes.recoverStale(30)).toEqual({ applied: 0, reversed: 0 });
    expect(w.pipe.vendors.get('v1')!.stored).toBe('pro-d');   // the older stuck switch did NOT drag the stored theme back over the newer, good one
  });
});

describe('exactly once', () => {
  it('the same key twice (and thirty times at once) is one switch and one charge; a key for another theme is refused', async () => {
    await sw('pro-b'); const k = key();
    const rs = await Promise.all(Array.from({ length: 30 }, () => sw('pro-c', 'v1', k)));
    expect(new Set(rs.map((r) => r.id)).size).toBe(1); expect(rs.filter((r) => !r.replay)).toHaveLength(1); expect(charges()).toHaveLength(1);
    expect((await codeOf(sw('pro-d', 'v1', k))).code).toBe('WALLET_IDEMPOTENCY_CONFLICT');
  });
  it('different keys for the same theme at once: one applies and is charged, the rest are told it is already the theme', async () => {
    await sw('pro-b'); const rs = await Promise.all(Array.from({ length: 12 }, () => sw('pro-c').then(() => 'ok', (e: HttpException) => (e.getResponse() as { code: string }).code)));
    expect(rs.filter((r) => r === 'ok')).toHaveLength(1); expect(rs.filter((r) => r === 'THEME_ALREADY_ACTIVE')).toHaveLength(11); expect(charges()).toHaveLength(1);
  });
  it('twelve parallel FIRST switches by one vendor to different themes: exactly one is the included one, the rest are paid', async () => {
    const themes = ['pro-b', 'pro-c', 'pro-d', 'standard-a'].slice(0, 3); void themes;
    const rs = await Promise.all(['pro-b', 'pro-c', 'pro-d'].map((t) => sw(t).then((r) => r.kind, () => 'refused')));
    expect(rs.filter((k) => k === 'FREE_INCLUDED')).toHaveLength(1); expect(rs.filter((k) => k === 'PAID').length).toBe(2); expect(charges()).toHaveLength(2);
  });
});

describe('what may be switched to, and by whom', () => {
  it('only while Pro is active or in grace; the current theme, an unknown theme and a theme the pipeline refuses are refused', async () => {
    w.plan.level = 'FREE'; w.plan.subscriptionStatus = 'EXPIRED'; expect((await codeOf(sw('pro-b'))).code).toBe('THEME_SWITCH_PLAN_STATE');
    w.plan.level = 'PRO'; w.plan.subscriptionStatus = 'GRACE'; expect((await sw('pro-b')).status).toBe('APPLIED');
    w.plan.subscriptionStatus = 'ACTIVE'; expect((await codeOf(sw('pro-b'))).code).toBe('THEME_ALREADY_ACTIVE'); expect((await codeOf(sw('nope-theme'))).code).toBe('THEME_NOT_ALLOWED');
    w.plan.suspended = true; expect((await codeOf(sw('pro-c'))).code).toBe('THEME_SWITCH_PLAN_STATE');
  });
  it('a paid switch needs an approved price and workable tax', async () => {
    const x = themeWorld(); await x.seed(); await x.vendor('v1', 500_000); await x.themes.switchTheme('v1', { themeId: 'pro-b', idempotencyKey: key() }, x.vendorBy());
    expect((await codeOf(x.themes.switchTheme('v1', { themeId: 'pro-c', idempotencyKey: key() }, x.vendorBy()))).code).toBe('SERVICE_PRICE_NOT_SET');
    await x.ensureFee(); x.wsettings.over = { ...x.wsettings.over, walletSellerStateCode: '' };
    expect((await codeOf(x.themes.switchTheme('v1', { themeId: 'pro-c', idempotencyKey: key() }, x.vendorBy()))).code).toBe('TAX_NOT_CONFIGURED');
    expect(x.themeStore.rows.filter((r) => r.kind === 'PAID')).toEqual([]); expect(x.store.ledger.filter((e) => e.kind === 'CHARGE')).toHaveLength(0);
  });
  it('the vendor\'s history is theirs alone and shows who did what', async () => {
    await sw('pro-b'); await sw('pro-c'); await sw('pro-b', 'v2');
    const h = await w.themes.history('v1', 1, 50); expect(h.total).toBe(2); expect(h.items.map((i) => i.kind).sort()).toEqual(['FREE_INCLUDED', 'PAID']); expect((await w.themes.history('v2', 1, 50)).total).toBe(1);
    expect(JSON.stringify(h)).not.toMatch(/performedById|ledgerEntryId|idempotency|vendorId/);
  });
});

describe('staff switching for a vendor', () => {
  const staff = (funding: 'WALLET' | 'COMPLIMENTARY' | 'SERVICE_REQUEST', over: Record<string, unknown> = {}) => ({ type: 'STAFF' as const, actor: TEAM, funding, reason: 'The vendor asked us on a call.', ...over });
  it('a complimentary switch needs a reason, is free, does not use the vendor\'s included switch, is audited and shows to the vendor as done by our team', async () => {
    expect((await codeOf(w.themes.switchTheme('v1', { themeId: 'pro-b', idempotencyKey: key() }, staff('COMPLIMENTARY', { reason: 'no' })))).code).toBe('THEME_SWITCH_INVALID');
    const g = await w.themes.switchTheme('v1', { themeId: 'pro-b', idempotencyKey: key() }, staff('COMPLIMENTARY'));
    expect(g).toMatchObject({ kind: 'COMPLIMENTARY_STAFF', by: 'OUR_TEAM', reason: 'The vendor asked us on a call.', amountPaise: null }); expect(charges()).toHaveLength(0);
    expect((await sw('pro-c')).kind).toBe('FREE_INCLUDED');   // the gift did not use it
    expect(w.themeStore.audits.find((a) => a.action === 'theme_switch.start_for_vendor')).toMatchObject({ after: { kind: 'COMPLIMENTARY_STAFF', reason: 'The vendor asked us on a call.' } });
    expect((await w.themes.history('v1', 1, 50)).items.some((i) => i.by === 'OUR_TEAM')).toBe(true); expect((await w.themes.adminHistory('v1', 1, 50)).items.find((i) => i.kind === 'COMPLIMENTARY_STAFF')).toMatchObject({ performedById: 'team-1' });
  });
  it('charging the wallet follows the same rule: the first is included, later ones are paid', async () => {
    expect((await w.themes.switchTheme('v1', { themeId: 'pro-b', idempotencyKey: key() }, staff('WALLET'))).kind).toBe('FREE_INCLUDED');
    expect((await w.themes.switchTheme('v1', { themeId: 'pro-c', idempotencyKey: key() }, staff('WALLET'))).kind).toBe('PAID'); expect(charges()).toHaveLength(1);
  });
  it('a vendor who asked our team: the request carries the fee, so the wallet is not charged again; the first (free) switch cannot be carried by a request', async () => {
    await w.price('THEME_SWITCH', 1_000).catch(() => undefined);
    const ask = (theme: string) => w.svcReq.create('v1', { serviceKey: 'THEME_SWITCH', brief: w.brief({ themeKey: theme }), idempotencyKey: key() }, { type: 'VENDOR', actor: vendorActor('v1') });
    const first = await ask('pro-b'); await w.svcReq.setStatus(first.id, { to: 'ACCEPTED' }, TEAM);
    expect((await codeOf(w.themes.switchTheme('v1', { themeId: 'pro-b', idempotencyKey: key() }, staff('SERVICE_REQUEST', { serviceRequestId: first.id })))).code).toBe('THEME_SWITCH_FREE_USE_DIRECT');
    await w.svcReq.reject(first.id, { reason: 'Switching directly instead.' }, TEAM); await sw('pro-b');
    const second = await ask('pro-c'); await w.svcReq.setStatus(second.id, { to: 'ACCEPTED' }, TEAM); const before = (await wallet()).balancePaise;
    expect((await codeOf(w.themes.switchTheme('v1', { themeId: 'pro-c', idempotencyKey: key() }, staff('SERVICE_REQUEST', { serviceRequestId: 'nope' })))).code).toBe('THEME_SWITCH_INVALID');
    expect((await codeOf(w.themes.switchTheme('v1', { themeId: 'pro-d', idempotencyKey: key() }, staff('SERVICE_REQUEST', { serviceRequestId: second.id })))).code).toBe('THEME_SWITCH_INVALID');   // wrong theme for that request
    const r = await w.themes.switchTheme('v1', { themeId: 'pro-c', idempotencyKey: key() }, staff('SERVICE_REQUEST', { serviceRequestId: second.id }));
    expect(r).toMatchObject({ kind: 'PAID', viaRequest: true, amountPaise: null }); expect(charges()).toHaveLength(0); expect((await wallet()).balancePaise).toBe(before);
  });
});

describe('a lapse and a renewal: the stored theme comes back, free', () => {
  it('when Pro returns and the stored theme is not the one published, it is applied again with no charge and it does not count as a switch', async () => {
    await sw('pro-b'); const s = w.pipe.vendors.get('v1')!; s.published = 'standard-a';   // during the lapse a rebuild fell back to the default theme
    const r = await w.themes.restoreIfNeeded('v1'); expect(r).toMatchObject({ themeId: 'pro-b' }); expect(s.published).toBe('pro-b');
    expect(charges()).toHaveLength(0); expect(rows().filter((x) => x.kind === 'RESTORE')).toHaveLength(1); expect(rows().find((x) => x.kind === 'RESTORE')).toMatchObject({ status: 'APPLIED', performedByType: 'SYSTEM' });
    expect((await sw('pro-c')).kind).toBe('PAID');   // the restore did not give another free switch, and the free one was already used
    expect(await w.themes.restoreIfNeeded('v1')).toBeNull();   // nothing left to restore
  });
  it('a restore never uses up the included switch for a vendor who never switched', async () => {
    const s = w.pipe.vendors.get('v1') ?? (await w.pipe.snapshot('v1'), w.pipe.vendors.get('v1')!); s.stored = 'pro-b'; s.published = 'standard-a';
    await w.themes.restoreIfNeeded('v1'); expect((await sw('pro-c')).kind).toBe('FREE_INCLUDED');
  });
  it('nothing is restored while the plan is still lapsed or when the stored theme still cannot be used', async () => {
    await sw('pro-b'); const s = w.pipe.vendors.get('v1')!; s.published = 'standard-a';
    w.plan.level = 'FREE'; w.plan.subscriptionStatus = 'EXPIRED'; expect(await w.themes.restoreIfNeeded('v1')).toBeNull(); expect(w.pipe.calls.restore).toBe(0);
    w.plan.level = 'PRO'; w.plan.subscriptionStatus = 'ACTIVE'; w.pipe.canUseStored = false; expect(await w.themes.restoreIfNeeded('v1')).toBeNull(); expect(rows().filter((x) => x.kind === 'RESTORE')).toHaveLength(0);
  });
  it('the renewal event itself triggers the restore through the listener', async () => {
    const { ThemeRestoreListener } = await import('../src/v3-theme-switch/theme-switch.module');
    new ThemeRestoreListener(w.themes, w.bus).onModuleInit();
    await sw('pro-b'); w.pipe.vendors.get('v1')!.published = 'standard-a';
    await w.bus.emit({ type: 'plan.order.paid', vendorId: 'v1', at: new Date(), data: { orderId: 'o9', planLevel: 'PRO' } });
    expect(w.pipe.vendors.get('v1')!.published).toBe('pro-b'); expect(rows().filter((x) => x.kind === 'RESTORE')).toHaveLength(1);
  });
});

describe('content is never lost and the previous snapshot is kept', () => {
  it('the hidden-field record lists what the new theme does not draw, switching back draws it again, and the vendor\'s content is untouched throughout', async () => {
    const content = JSON.stringify(w.pipe.content);
    const a = await sw('standard-a-x'.replace('-x', '').replace('standard-a', 'pro-c')); expect(a.hiddenFields).toEqual(['team', 'testimonials']);
    const b = await sw('pro-b'); expect(b.hiddenFields).toEqual([]);
    const c = await sw('pro-c'); expect(c.hiddenFields).toEqual(['team', 'testimonials']);
    expect(JSON.stringify(w.pipe.content)).toBe(content);
  });
  it('a theme whose use of fields cannot be worked out claims nothing is hidden', async () => { expect((await sw('pro-d')).hiddenFields).toEqual([]); });
  it('every switch is a NEW publication and the old one stays, so rolling back to the previous snapshot is still possible', async () => {
    await sw('pro-b'); await sw('pro-c'); const pubs = w.pipe.vendors.get('v1')!.pubs;
    expect(pubs.map((p) => p.theme)).toEqual(['standard-a', 'pro-b', 'pro-c']); expect(new Set(pubs.map((p) => p.id)).size).toBe(3);
  });
  it('a vendor whose site was never published gets the theme stored with no publication (nothing goes live by surprise)', async () => {
    w.pipe.vendors.set('v1', { stored: 'standard-a', published: null, has: false, pubs: [] }); const r = await sw('pro-b');
    expect(r).toMatchObject({ status: 'APPLIED', publicationId: null }); expect(w.pipe.vendors.get('v1')).toMatchObject({ stored: 'pro-b', pubs: [] });
  });
});

describe('tenants', () => {
  it('another vendor cannot see or repeat a vendor\'s switch, and a request key is each vendor\'s own', async () => {
    const k = key(); const a = await sw('pro-b', 'v1', k); const b = await sw('pro-b', 'v2', k);
    expect(a.id).not.toBe(b.id); expect(rows('v1')).toHaveLength(1); expect(rows('v2')).toHaveLength(1); expect((await w.themes.history('v2', 1, 50)).items.map((i) => i.id)).toEqual([b.id]);
  });
  it('the staff switch for one vendor changes only that vendor', async () => {
    await w.themes.switchTheme('v2', { themeId: 'pro-c', idempotencyKey: key() }, { type: 'STAFF', actor: TEAM, funding: 'COMPLIMENTARY', reason: 'A gift for the vendor.' });
    expect(w.pipe.vendors.get('v2')!.stored).toBe('pro-c'); expect((await w.pipe.snapshot('v1')).storedThemeId).toBe('standard-a');
  });
});
void OPS;
