import { HttpException } from '@nestjs/common';
import { walletKey, walletQueue } from '../src/v3-wallet/wallet.store';
import { themeWorld, ThemeWorld } from './support/theme-switch-world';

/**
 * Slice 5.16d, found on staging on 6 November 2026: a theme switch never answered. The saga held the wallet queue (walletQueue, key wallet:<vendor>) and then opened the wallet unit of work, which waits in the SAME queue
 * for the SAME key; the queue is not reentrant, so the switch waited on itself for ever. The other theme-switch specs missed it because the in-memory wallet store has a queue of its own.
 *
 * Here the store's unit of work goes through the REAL global walletQueue, exactly as the Prisma store does, so the nested wait is real. On the old code every test below hangs; each is bounded by a short timer so it FAILS with a clear message.
 */
let w: ThemeWorld; let n = 0;
const key = () => `queue-key-${++n}-abcdefgh`;
const within = async <T>(ms: number, p: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([p, new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(`the theme switch did not finish within ${ms} ms (it is waiting on itself in the wallet queue)`)), ms); })]); } finally { if (timer) clearTimeout(timer); }
};
const sw = (theme: string, vendorId = 'v1', k = key()) => w.themes.switchTheme(vendorId, { themeId: theme, idempotencyKey: k }, w.vendorBy(vendorId));
const charges = (v = 'v1') => w.store.ledger.filter((e) => e.vendorId === v && e.refType === 'theme_switch' && e.kind === 'CHARGE');
const code = (r: unknown): string => ((r as HttpException).getResponse() as { code: string }).code;

beforeEach(async () => {
  w = themeWorld(); await w.seed(); await w.ensureFee(); await w.vendor('v1', 500_000);
  const real = w.themeStore.unit.bind(w.themeStore);
  w.themeStore.unit = ((vendorId: string, fn: Parameters<typeof real>[1]) => walletQueue.run(walletKey(vendorId), () => real(vendorId, fn))) as typeof real;   // what PrismaWalletStore.unit does
});
afterEach(() => { expect(walletQueue.size()).toBe(0); });   // nothing left waiting in the real queue

describe('a switch through the real wallet queue', () => {
  it('finishes: the saga never holds the wallet queue key while it opens the wallet unit', async () => {
    const r = await within(2000, sw('pro-b'));
    expect(r).toMatchObject({ kind: 'FREE_INCLUDED', status: 'APPLIED' });
    const paid = await within(2000, sw('pro-c')); expect(paid).toMatchObject({ kind: 'PAID', status: 'APPLIED' }); expect(charges()).toHaveLength(1);
  });

  it('a failed apply still reverses the charge through the real queue (the compensation opens a unit too)', async () => {
    await within(2000, sw('pro-b')); w.pipe.fail = 'publish';
    await expect(within(2000, sw('pro-c'))).rejects.toMatchObject({ response: { code: 'THEME_SWITCH_FAILED' } });
    expect(w.store.ledger.filter((x) => x.kind === 'REVERSAL' && x.refType === 'theme_switch')).toHaveLength(1);
  });

  it('settling a stuck PENDING switch (recoverStale) finishes too', async () => {
    expect(await within(2000, w.themes.recoverStale(30))).toEqual({ applied: 0, reversed: 0 });
  });

  it('two DIFFERENT keys at once: exactly one is the included switch and exactly one is charged', async () => {
    const rs = await within(5000, Promise.all([sw('pro-b'), sw('pro-c')]));
    expect(rs.map((r) => r.kind).sort()).toEqual(['FREE_INCLUDED', 'PAID']); expect(rs.every((r) => r.status === 'APPLIED')).toBe(true);
    expect(charges()).toHaveLength(1); expect(w.themeStore.rows.filter((r) => r.kind === 'FREE_INCLUDED')).toHaveLength(1);
    expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
  });

  it('many different keys at once for different themes: one included, the rest charged once each, each theme is applied once', async () => {
    const themes = ['pro-b', 'pro-c', 'pro-d', 'standard-a'];
    const rs = await within(10_000, Promise.all(themes.map((t) => sw(t).then((r) => r.kind, (e: HttpException) => code(e)))));
    expect(rs.filter((r) => r === 'FREE_INCLUDED')).toHaveLength(1);
    expect(charges()).toHaveLength(rs.filter((r) => r === 'PAID').length);
    expect(rs.every((r) => ['FREE_INCLUDED', 'PAID', 'THEME_ALREADY_ACTIVE'].includes(r))).toBe(true);
  });

  it('the same key at once is one switch and one charge; two vendors do not wait on each other', async () => {
    await within(2000, sw('pro-b')); await w.vendor('v2', 500_000); const k = key();
    const rs = await within(5000, Promise.all([...Array.from({ length: 10 }, () => sw('pro-c', 'v1', k)), sw('pro-b', 'v2')]));
    expect(new Set(rs.slice(0, 10).map((r) => r.id)).size).toBe(1); expect(rs.slice(0, 10).filter((r) => !r.replay)).toHaveLength(1);
    expect(charges('v1')).toHaveLength(1); expect(rs[10].kind).toBe('FREE_INCLUDED');
  });
});

describe('the decision is made inside the wallet unit', () => {
  it('if the vendor\'s rows change between the early read and the unit, the switch is refused with nothing charged and nothing recorded', async () => {
    // the early read says "the first switch is included"; before the unit runs, another process records an applied included switch
    const real = w.themeStore.unit.bind(w.themeStore); let injected = false;
    w.themeStore.unit = ((vendorId: string, fn: Parameters<typeof real>[1]) => {
      if (!injected) { injected = true; w.themeStore.rows.push({ id: 'other-process', vendorId, siteId: null, fromThemeKey: null, toThemeKey: 'pro-d', kind: 'FREE_INCLUDED', performedByType: 'VENDOR', performedById: vendorId, serviceRequestId: null, ledgerEntryId: null, packPurchaseId: null, priceSnapshotPaise: null, taxSnapshot: {}, publicationId: null, status: 'APPLIED', idempotencyKey: 'other-process-key', reason: null, failureReason: null, hiddenFields: [], createdAt: new Date(), updatedAt: new Date() }); }
      return real(vendorId, fn);
    }) as typeof real;
    await expect(within(2000, sw('pro-b'))).rejects.toMatchObject({ response: { code: 'THEME_SWITCH_RETRY' } });
    expect(charges()).toHaveLength(0); expect(w.themeStore.rows.filter((r) => r.id !== 'other-process')).toHaveLength(0);
    expect((await within(2000, sw('pro-b'))).kind).toBe('PAID');   // after the retry the decision is the true one
  });
});
