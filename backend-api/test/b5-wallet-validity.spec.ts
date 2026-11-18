import { nextCreditExpiry } from '../src/v3-wallet/wallet.service';
import { walletWorld, WalletWorld } from './support/wallet-world';

/** B5.7: the wallet view tells the vendor how long a credit lasts and when the next credit runs out. */
const d = (s: string) => new Date(s);
describe('nextCreditExpiry', () => {
  it('is null with no lots, only spent or expired lots, or empty open lots', () => {
    expect(nextCreditExpiry([])).toBeNull();
    expect(nextCreditExpiry([{ remainingPaise: 0, expiresAt: d('2027-01-01T00:00:00Z'), status: 'SPENT' }, { remainingPaise: 500, expiresAt: d('2026-01-01T00:00:00Z'), status: 'EXPIRED' }, { remainingPaise: 0, expiresAt: d('2027-02-01T00:00:00Z'), status: 'OPEN' }])).toBeNull();
  });
  it('takes the earliest open lot and adds the lots that expire the same day', () => {
    const r = nextCreditExpiry([
      { remainingPaise: 9_000, expiresAt: d('2027-09-01T00:00:00Z'), status: 'OPEN' },
      { remainingPaise: 2_000, expiresAt: d('2027-03-05T10:00:00Z'), status: 'OPEN' },
      { remainingPaise: 3_000, expiresAt: d('2027-03-05T18:00:00Z'), status: 'OPEN' },
      { remainingPaise: 7_000, expiresAt: d('2027-01-01T00:00:00Z'), status: 'SPENT' },
    ]);
    expect(r).toEqual({ expiresAt: '2027-03-05T10:00:00.000Z', amountPaise: 5_000 });
  });
});

describe('GET /v3/me/wallet view', () => {
  let w: WalletWorld; beforeEach(() => { w = walletWorld(); });
  it('a locked (no wallet) vendor: validityDays from the setting, no next expiry', async () => {
    const v = await w.svc.view('v1'); expect(v.validityDays).toBe(365); expect(v.creditValidityDays).toBe(365); expect(v.nextExpiry).toBeNull();
  });
  it('after a top-up: validityDays 365 and the next expiry is that credit, one year on', async () => {
    await w.open('v1'); await w.fund('v1', 50_000);
    const v = await w.svc.view('v1');
    expect(v.validityDays).toBe(365);
    expect(v.nextExpiry).toMatchObject({ amountPaise: 50_000 });
    const days = (new Date(v.nextExpiry!.expiresAt).getTime() - w.clock().getTime()) / 86_400_000; expect(Math.round(days)).toBe(365);
  });
  it('an active wallet with nothing in it has no next expiry', async () => { await w.open('v1'); expect((await w.svc.view('v1')).nextExpiry).toBeNull(); });
});
