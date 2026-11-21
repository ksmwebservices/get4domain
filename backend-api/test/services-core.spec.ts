import {
  approvalProblem, consumeFromPurchases, fundingChoice, packRemainingFor, planStateAllows, resolvePrice, trackAllows, validatePackItems, validateServiceInput, PriceLite,
} from '../src/v3-services/core/services-core';

/**
 * Slice 5.16b: the pure rules of the price book, the funding order and the packs. Nothing here knows a price: every price in a test is made up for the test.
 */
const D = (s: string): Date => new Date(s);
const NOW = D('2026-11-05T10:00:00.000Z');
const price = (id: string, amountPaise: number, status: PriceLite['status'], effectiveFrom: string | null): PriceLite => ({ id, amountPaise, currency: 'INR', taxCategory: 'ALL', taxInclusive: false, status, effectiveFrom: effectiveFrom ? D(effectiveFrom) : null });

describe('price resolution: the APPROVED row that has started, the latest one', () => {
  it('a PROPOSED price is never in force, however it is dated', () => { expect(resolvePrice([price('p', 100, 'PROPOSED', '2026-01-01T00:00:00Z')], NOW)).toBeNull(); });
  it('a RETIRED price is not in force', () => { expect(resolvePrice([price('p', 100, 'RETIRED', '2026-01-01T00:00:00Z')], NOW)).toBeNull(); });
  it('an approved price that starts in the future is not in force yet; at the very instant it starts it is', () => {
    expect(resolvePrice([price('p', 100, 'APPROVED', '2026-11-05T10:00:00.001Z')], NOW)).toBeNull();
    expect(resolvePrice([price('p', 100, 'APPROVED', '2026-11-05T10:00:00.000Z')], NOW)!.id).toBe('p');
  });
  it('with several approved rows the latest one that has started wins', () => {
    const rows = [price('old', 100, 'APPROVED', '2026-01-01T00:00:00Z'), price('new', 150, 'APPROVED', '2026-10-01T00:00:00Z'), price('future', 200, 'APPROVED', '2027-01-01T00:00:00Z'), price('prop', 999, 'PROPOSED', '2026-11-01T00:00:00Z')];
    expect(resolvePrice(rows, NOW)!.id).toBe('new');
    expect(resolvePrice(rows, D('2027-02-01T00:00:00Z'))!.id).toBe('future');
    expect(resolvePrice(rows, D('2025-12-31T00:00:00Z'))).toBeNull();
  });
  it('an undated approved row (cannot exist in the database) is ignored rather than guessed at', () => { expect(resolvePrice([price('p', 100, 'APPROVED', null)], NOW)).toBeNull(); });
  it('no rows means no price', () => { expect(resolvePrice([], NOW)).toBeNull(); });
});

describe('who may approve what, and from when', () => {
  const rows = [price('cur', 100, 'APPROVED', '2026-10-01T00:00:00Z'), price('prop', 150, 'PROPOSED', null)];
  it('only a PROPOSED price can be approved', () => { expect(approvalProblem(rows, 'cur', D('2026-12-01T00:00:00Z'), NOW)).toBe('PRICE_NOT_PROPOSED'); expect(approvalProblem(rows, 'nope', D('2026-12-01T00:00:00Z'), NOW)).toBe('PRICE_NOT_PROPOSED'); });
  it('an effective date is required and must be a real date', () => { expect(approvalProblem(rows, 'prop', null, NOW)).toBe('EFFECTIVE_DATE_REQUIRED'); expect(approvalProblem(rows, 'prop', new Date('x'), NOW)).toBe('EFFECTIVE_DATE_REQUIRED'); });
  it('it cannot start in the past (a minute of clock difference is forgiven)', () => {
    expect(approvalProblem(rows, 'prop', D('2026-11-05T09:58:00Z'), NOW)).toBe('EFFECTIVE_DATE_IN_PAST');
    expect(approvalProblem(rows, 'prop', D('2026-11-05T09:59:30Z'), NOW)).toBeNull();
  });
  it('it must start after the price now in force, or it would never be seen (reachable only when that price started within the clock-slack minute)', () => {
    const fresh = [price('cur', 100, 'APPROVED', '2026-11-05T09:59:50Z'), price('prop', 150, 'PROPOSED', null)];
    expect(approvalProblem(fresh, 'prop', D('2026-11-05T09:59:30Z'), NOW)).toBe('EFFECTIVE_DATE_NOT_LATER');
    expect(approvalProblem(fresh, 'prop', D('2026-11-05T09:59:50Z'), NOW)).toBe('EFFECTIVE_DATE_TAKEN');
    expect(approvalProblem(fresh, 'prop', D('2026-11-05T09:59:51Z'), NOW)).toBeNull();
    expect(approvalProblem(rows, 'prop', D('2026-11-05T10:00:00Z'), NOW)).toBeNull();
  });
  it('two rows of a service cannot start at the same instant', () => {
    const two = [price('a', 100, 'APPROVED', '2026-12-01T00:00:00Z'), price('prop', 150, 'PROPOSED', null)];
    expect(approvalProblem(two, 'prop', D('2026-12-01T00:00:00Z'), NOW)).toBe('EFFECTIVE_DATE_TAKEN');
  });
});

describe('the funding order: allowance, then pack, then wallet', () => {
  const wallet = (availablePaise: number, status: 'ACTIVE' | 'FROZEN' | 'INACTIVE' = 'ACTIVE') => ({ status, availablePaise });
  const input = (over: Partial<Parameters<typeof fundingChoice>[0]> = {}) => ({ allowance: null, packCount: 0, totalMinor: 59_000 as number | null, taxProblem: null, wallet: wallet(100_000), ...over });
  it('an unused plan allowance is used first, even when a pack and a full wallet exist', () => {
    expect(fundingChoice(input({ allowance: { limit: 2, used: 1 }, packCount: 3 }))).toEqual({ kind: 'INCLUDED_ALLOWANCE', remaining: 1 });
  });
  it('a used-up allowance falls through to the pack', () => { expect(fundingChoice(input({ allowance: { limit: 2, used: 2 }, packCount: 3 }))).toEqual({ kind: 'PACK', remaining: 3 }); });
  it('no allowance and no pack falls through to the wallet, for the full amount', () => { expect(fundingChoice(input())).toEqual({ kind: 'WALLET', amountPaise: 59_000 }); });
  it('an allowance or a pack needs no price and no wallet', () => {
    expect(fundingChoice(input({ allowance: { limit: 1, used: 0 }, totalMinor: null, wallet: null }))).toEqual({ kind: 'INCLUDED_ALLOWANCE', remaining: 1 });
    expect(fundingChoice(input({ packCount: 1, totalMinor: null, wallet: wallet(0, 'INACTIVE') }))).toEqual({ kind: 'PACK', remaining: 1 });
  });
  it('the wallet comes before price and tax: a vendor whose wallet is not open (or is frozen) is told that, whatever else is missing', () => {
    expect(fundingChoice(input({ totalMinor: null, wallet: null }))).toEqual({ kind: 'NONE', reason: 'WALLET_NOT_ACTIVE' });
    expect(fundingChoice(input({ totalMinor: null, taxProblem: 'RATES_MISSING', wallet: wallet(0, 'INACTIVE') }))).toEqual({ kind: 'NONE', reason: 'WALLET_NOT_ACTIVE' });
    expect(fundingChoice(input({ totalMinor: null, wallet: wallet(10, 'FROZEN') }))).toEqual({ kind: 'NONE', reason: 'WALLET_FROZEN' });
  });
  it('a service with no approved price is not purchasable: price not set', () => { expect(fundingChoice(input({ totalMinor: null }))).toEqual({ kind: 'NONE', reason: 'PRICE_NOT_SET' }); });
  it('a price that cannot be taxed is refused, never guessed', () => { expect(fundingChoice(input({ totalMinor: null, taxProblem: 'RATES_MISSING' }))).toEqual({ kind: 'NONE', reason: 'TAX_NOT_SET', taxProblem: 'RATES_MISSING' }); });
  it('the wallet is used only when ACTIVE and the AVAILABLE money covers the whole amount', () => {
    expect(fundingChoice(input({ wallet: wallet(59_000) }))).toEqual({ kind: 'WALLET', amountPaise: 59_000 });
    expect(fundingChoice(input({ wallet: wallet(58_999) }))).toEqual({ kind: 'NONE', reason: 'INSUFFICIENT_WALLET', shortfallPaise: 1 });
    expect(fundingChoice(input({ wallet: wallet(100_000, 'INACTIVE') }))).toEqual({ kind: 'NONE', reason: 'WALLET_NOT_ACTIVE' });
    expect(fundingChoice(input({ wallet: null }))).toEqual({ kind: 'NONE', reason: 'WALLET_NOT_ACTIVE' });
    expect(fundingChoice(input({ wallet: wallet(100_000, 'FROZEN') }))).toEqual({ kind: 'NONE', reason: 'WALLET_FROZEN' });
  });
  it('an allowance with no limit set (staff have not decided) is not an allowance', () => { expect(fundingChoice(input({ allowance: { limit: null, used: 0 } }))).toEqual({ kind: 'WALLET', amountPaise: 59_000 }); });
});

describe('packs', () => {
  it('a pack lists whole services with whole counts, no repeats, no unknown service', () => {
    const known = new Set(['POSTER_DESIGN', 'SEO_TASK']);
    expect(validatePackItems([{ serviceKey: 'POSTER_DESIGN', count: 3 }, { serviceKey: 'SEO_TASK', count: 1 }], known)).toBeNull();
    for (const bad of [[], 'x', [{ serviceKey: 'POSTER_DESIGN', count: 0 }], [{ serviceKey: 'POSTER_DESIGN', count: 1.5 }], [{ serviceKey: 'NOPE', count: 1 }], [{ serviceKey: 'POSTER_DESIGN', count: 1 }, { serviceKey: 'POSTER_DESIGN', count: 2 }], [{ serviceKey: 'POSTER_DESIGN', count: 100_000 }], [null]]) {
      expect([JSON.stringify(bad), validatePackItems(bad, known)]).toEqual([JSON.stringify(bad), expect.any(String)]);
    }
  });
  const buy = (id: string, remaining: Record<string, number>, purchasedAt: string, expiresAt: string | null) => ({ id, remaining, purchasedAt: D(purchasedAt), expiresAt: expiresAt ? D(expiresAt) : null });
  it('counts what is left for a service across packs that have not expired', () => {
    const list = [buy('a', { POSTER_DESIGN: 2 }, '2026-01-01T00:00:00Z', null), buy('b', { POSTER_DESIGN: 3, SEO_TASK: 1 }, '2026-02-01T00:00:00Z', '2027-01-01T00:00:00Z'), buy('c', { POSTER_DESIGN: 9 }, '2026-03-01T00:00:00Z', '2026-11-01T00:00:00Z')];
    expect(packRemainingFor(list, 'POSTER_DESIGN', NOW)).toBe(5); expect(packRemainingFor(list, 'SEO_TASK', NOW)).toBe(1); expect(packRemainingFor(list, 'REEL_PRODUCTION', NOW)).toBe(0);
  });
  it('uses the pack that expires first, then the one bought first; one that never expires comes last', () => {
    const list = [buy('never', { POSTER_DESIGN: 5 }, '2026-01-01T00:00:00Z', null), buy('soon', { POSTER_DESIGN: 1 }, '2026-02-01T00:00:00Z', '2026-12-01T00:00:00Z'), buy('later', { POSTER_DESIGN: 1 }, '2026-03-01T00:00:00Z', '2027-06-01T00:00:00Z')];
    const first = consumeFromPurchases(list, 'POSTER_DESIGN', NOW)!; expect(first).toMatchObject({ purchaseId: 'soon', remaining: { POSTER_DESIGN: 0 } });
    const rest = list.map((p) => (p.id === 'soon' ? { ...p, remaining: first.remaining } : p));
    expect(consumeFromPurchases(rest, 'POSTER_DESIGN', NOW)!.purchaseId).toBe('later');
  });
  it('an expired pack, an empty one and a missing service give nothing, and the input is not changed', () => {
    const list = [buy('x', { POSTER_DESIGN: 0 }, '2026-01-01T00:00:00Z', null), buy('y', { POSTER_DESIGN: 4 }, '2026-01-01T00:00:00Z', '2026-11-05T10:00:00Z')];
    const copy = JSON.stringify(list);
    expect(consumeFromPurchases(list, 'POSTER_DESIGN', NOW)).toBeNull(); expect(consumeFromPurchases(list, 'SEO_TASK', NOW)).toBeNull(); expect(JSON.stringify(list)).toBe(copy);
  });
});

describe('plan state and track rules', () => {
  const snap = (over: Partial<Parameters<typeof planStateAllows>[1]> = {}) => ({ level: 'PRO' as const, subscriptionStatus: 'ACTIVE' as const, suspended: false, ...over });
  it('the default rule: Pro ACTIVE or in grace; never Free, expired, cancelled or suspended', () => {
    expect(planStateAllows('PRO_ACTIVE_OR_GRACE', snap())).toBe(true);
    expect(planStateAllows('PRO_ACTIVE_OR_GRACE', snap({ subscriptionStatus: 'GRACE' }))).toBe(true);
    for (const bad of [snap({ level: 'FREE' }), snap({ subscriptionStatus: 'EXPIRED' }), snap({ subscriptionStatus: 'CANCELLED' }), snap({ suspended: true }), snap({ level: null, subscriptionStatus: null })]) expect(planStateAllows('PRO_ACTIVE_OR_GRACE', bad)).toBe(false);
  });
  it('ANY allows every plan state, including a lapsed plan (the balance is never stuck)', () => { for (const s of [snap(), snap({ level: 'FREE', subscriptionStatus: 'EXPIRED' }), snap({ level: null, subscriptionStatus: null })]) expect(planStateAllows('ANY', s)).toBe(true); });
  it('an empty track scope means every track; otherwise the vendor\'s track must be listed', () => {
    expect(trackAllows([], 'handyman')).toBe(true); expect(trackAllows(['professional'], 'handyman')).toBe(false); expect(trackAllows(['handyman', 'professional'], 'handyman')).toBe(true); expect(trackAllows(['handyman'], null)).toBe(false);
  });
});

describe('what staff may write into the catalogue', () => {
  const ok = { key: 'POSTER_DESIGN', name: 'Poster design', shortDescription: 'A poster made by our team.', includesText: 'One poster in the sizes you ask for.', approvalText: 'You review it and approve it, or ask for changes.', kind: 'DESIGN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', planStateRule: 'PRO_ACTIVE_OR_GRACE', trackScope: [] as string[], publicVisible: true, sortOrder: 5 };
  it('accepts a complete definition', () => { expect(validateServiceInput(ok)).toEqual([]); });
  it('names every problem in plain words', () => {
    const errs = validateServiceInput({ ...ok, key: 'bad key', name: '', includesText: 'x', doneBy: 'ROBOT', deliveryKind: 'MAGIC', planStateRule: 'SOMETIMES', trackScope: 'all', sortOrder: 1.5 } as never);
    expect(errs.length).toBeGreaterThanOrEqual(6); expect(errs.join(' ')).toMatch(/key/i);
  });
  it('refuses markup in the texts', () => { expect(validateServiceInput({ ...ok, name: '<b>Poster</b>' }).length).toBe(1); });
  it('an update may change a few fields and leaves the key alone', () => { expect(validateServiceInput({ name: 'New name' }, { partial: true })).toEqual([]); expect(validateServiceInput({ key: 'OTHER_KEY' }, { partial: true }).join(' ')).toMatch(/key cannot be changed/i); });
});
