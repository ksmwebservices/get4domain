import {
  activationDecision, applyOp, available, LedgerKind, Lot, Op, planExpiry, reconcile, shortfallHint, topupAmountProblem, WalletRuleError, WalletState,
} from '../src/v3-wallet/core/wallet-core';

/**
 * Slice 5.16a: the pure money core. Integer paise, a balance that can never go negative, held money that is never spendable twice, lots consumed oldest first.
 * Nothing here knows about a database, a clock or randomness: the caller passes ids and dates.
 */
const D = (s: string): Date => new Date(s);
const T0 = D('2026-11-05T10:00:00.000Z');
const lot = (id: string, remainingPaise: number, expiresAt: string, createdAt = '2026-01-01T00:00:00.000Z'): Lot => ({ id, remainingPaise, expiresAt: D(expiresAt), createdAt: D(createdAt), status: 'OPEN' });
const state = (lots: Lot[], heldPaise = 0): WalletState => ({ balancePaise: lots.reduce((s, l) => s + l.remainingPaise, 0), heldPaise, lots });
const empty = (): WalletState => ({ balancePaise: 0, heldPaise: 0, lots: [] });
const code = (fn: () => unknown): string | null => { try { fn(); return null; } catch (e) { return e instanceof WalletRuleError ? e.code : `OTHER:${(e as Error).message}`; } };
const topup = (s: WalletState, amount: number, id = `lot-${s.lots.length + 1}`, exp = '2027-11-05T10:00:00.000Z') => applyOp(s, { kind: 'TOPUP', amountPaise: amount, lotId: id, lotCreatedAt: T0, lotExpiresAt: D(exp) });

describe('available and the basic transitions', () => {
  it('available is balance minus held', () => { expect(available({ balancePaise: 1000, heldPaise: 300 })).toBe(700); });

  it('a top-up adds to the balance and opens one lot with the exact amount', () => {
    const r = topup(empty(), 5000, 'L1');
    expect(r.state.balancePaise).toBe(5000);
    expect(r.state.lots).toEqual([expect.objectContaining({ id: 'L1', remainingPaise: 5000, status: 'OPEN' })]);
    expect(r.entry).toMatchObject({ kind: 'TOPUP', amountPaise: 5000, balanceDeltaPaise: 5000, heldDeltaPaise: 0 });
  });

  it('a hold raises held, not the balance, and needs the money to be available', () => {
    const s = topup(empty(), 1000).state;
    const r = applyOp(s, { kind: 'HOLD', amountPaise: 400 });
    expect(r.state).toMatchObject({ balancePaise: 1000, heldPaise: 400 });
    expect(r.entry).toMatchObject({ kind: 'HOLD', amountPaise: -400, balanceDeltaPaise: 0, heldDeltaPaise: 400 });
    expect(code(() => applyOp(r.state, { kind: 'HOLD', amountPaise: 601 }))).toBe('INSUFFICIENT_WALLET');
    expect(applyOp(r.state, { kind: 'HOLD', amountPaise: 600 }).state.heldPaise).toBe(1000);
  });

  it('a release gives held money back to available and never goes below zero held', () => {
    const s = applyOp(topup(empty(), 1000).state, { kind: 'HOLD', amountPaise: 400 }).state;
    const r = applyOp(s, { kind: 'RELEASE', amountPaise: 400 });
    expect(r.state).toMatchObject({ balancePaise: 1000, heldPaise: 0 });
    expect(r.entry).toMatchObject({ kind: 'RELEASE', amountPaise: 400, heldDeltaPaise: -400 });
    expect(code(() => applyOp(s, { kind: 'RELEASE', amountPaise: 401 }))).toBe('HOLD_NOT_ENOUGH');
  });

  it('a direct charge needs available money; a charge of a held amount spends the hold itself', () => {
    const s = applyOp(topup(empty(), 1000).state, { kind: 'HOLD', amountPaise: 700 }).state;
    expect(code(() => applyOp(s, { kind: 'CHARGE', amountPaise: 301, fromHold: false }))).toBe('INSUFFICIENT_WALLET');
    const direct = applyOp(s, { kind: 'CHARGE', amountPaise: 300, fromHold: false });
    expect(direct.state).toMatchObject({ balancePaise: 700, heldPaise: 700 });
    const fromHold = applyOp(s, { kind: 'CHARGE', amountPaise: 700, fromHold: true });
    expect(fromHold.state).toMatchObject({ balancePaise: 300, heldPaise: 0 });
    expect(fromHold.entry).toMatchObject({ kind: 'CHARGE', amountPaise: -700, balanceDeltaPaise: -700, heldDeltaPaise: -700 });
    expect(code(() => applyOp(s, { kind: 'CHARGE', amountPaise: 701, fromHold: true }))).toBe('HOLD_NOT_ENOUGH');
  });

  it.each<LedgerKind>(['PACK_PURCHASE', 'PLAN_RENEWAL'])('%s is a direct charge with its own kind', (kind) => {
    const r = applyOp(topup(empty(), 1000).state, { kind, amountPaise: 250, fromHold: false } as Op);
    expect(r.entry).toMatchObject({ kind, amountPaise: -250, balanceDeltaPaise: -250 });
    expect(r.state.balancePaise).toBe(750);
  });

  it('a reversal gives a charge back into the SAME lots it came from', () => {
    const s = state([lot('A', 300, '2027-01-01T00:00:00Z'), lot('B', 700, '2027-06-01T00:00:00Z')]);
    const c = applyOp(s, { kind: 'CHARGE', amountPaise: 500, fromHold: false });
    expect(c.entry.lotUses).toEqual([{ lotId: 'A', amountPaise: 300 }, { lotId: 'B', amountPaise: 200 }]);
    const r = applyOp(c.state, { kind: 'REVERSAL', amountPaise: 500, uses: c.entry.lotUses });
    expect(r.state.balancePaise).toBe(1000);
    expect(r.state.lots.map((l) => [l.id, l.remainingPaise, l.status])).toEqual([['A', 300, 'OPEN'], ['B', 700, 'OPEN']]);
    expect(r.entry).toMatchObject({ kind: 'REVERSAL', amountPaise: 500, balanceDeltaPaise: 500 });
  });

  it('a reversal whose lot uses do not add up, or name an unknown lot, is refused', () => {
    const s = state([lot('A', 300, '2027-01-01T00:00:00Z')]);
    expect(code(() => applyOp(s, { kind: 'REVERSAL', amountPaise: 100, uses: [{ lotId: 'A', amountPaise: 99 }] }))).toBe('REVERSAL_INVALID');
    expect(code(() => applyOp(s, { kind: 'REVERSAL', amountPaise: 100, uses: [{ lotId: 'ZZ', amountPaise: 100 }] }))).toBe('REVERSAL_INVALID');
  });

  it.each([0, -5, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 2, '10' as unknown as number])('refuses the amount %p everywhere', (bad) => {
    const s = topup(empty(), 1000).state;
    for (const op of [
      { kind: 'TOPUP', amountPaise: bad, lotId: 'x', lotCreatedAt: T0, lotExpiresAt: T0 }, { kind: 'HOLD', amountPaise: bad }, { kind: 'RELEASE', amountPaise: bad },
      { kind: 'CHARGE', amountPaise: bad, fromHold: false }, { kind: 'PACK_PURCHASE', amountPaise: bad, fromHold: false }, { kind: 'PLAN_RENEWAL', amountPaise: bad, fromHold: false },
    ] as Op[]) expect(code(() => applyOp(s, op))).toBe('AMOUNT_INVALID');
  });

  it('never mutates the state it was given', () => {
    const s = state([lot('A', 300, '2027-01-01T00:00:00Z')]); const copy = JSON.stringify(s);
    applyOp(s, { kind: 'CHARGE', amountPaise: 100, fromHold: false }); applyOp(s, { kind: 'HOLD', amountPaise: 100 });
    expect(JSON.stringify(s)).toBe(copy);
  });
});

describe('oldest lot first', () => {
  it('spends the lot that expires first, whatever order the lots are listed in, then the next', () => {
    const s = state([lot('LATE', 500, '2027-09-01T00:00:00Z'), lot('EARLY', 200, '2027-01-01T00:00:00Z')]);
    const r = applyOp(s, { kind: 'CHARGE', amountPaise: 350, fromHold: false });
    expect(r.entry.lotUses).toEqual([{ lotId: 'EARLY', amountPaise: 200 }, { lotId: 'LATE', amountPaise: 150 }]);
    expect(r.state.lots.find((l) => l.id === 'EARLY')).toMatchObject({ remainingPaise: 0, status: 'SPENT' });
    expect(r.state.lots.find((l) => l.id === 'LATE')).toMatchObject({ remainingPaise: 350, status: 'OPEN' });
  });
  it('breaks a tie on expiry by the earlier creation, then by id, so the answer is always the same', () => {
    const s = state([lot('b', 100, '2027-01-01T00:00:00Z', '2026-02-01T00:00:00Z'), lot('a', 100, '2027-01-01T00:00:00Z', '2026-02-01T00:00:00Z'), lot('c', 100, '2027-01-01T00:00:00Z', '2026-01-01T00:00:00Z')]);
    expect(applyOp(s, { kind: 'CHARGE', amountPaise: 300, fromHold: false }).entry.lotUses.map((u) => u.lotId)).toEqual(['c', 'a', 'b']);
  });
  it('the lots always add up to the balance after every kind of step', () => {
    let s = topup(topup(empty(), 700, 'A', '2027-01-01T00:00:00Z').state, 300, 'B', '2027-02-01T00:00:00Z').state;
    for (const op of [{ kind: 'HOLD', amountPaise: 100 }, { kind: 'CHARGE', amountPaise: 450, fromHold: false }, { kind: 'RELEASE', amountPaise: 100 }] as Op[]) {
      s = applyOp(s, op).state; expect(s.lots.reduce((t, l) => t + l.remainingPaise, 0)).toBe(s.balancePaise);
    }
  });
});

describe('expiry (one year, written off by an EXPIRY entry)', () => {
  it('plans the write-off of every lot that is past its date, oldest first, for exactly what is left', () => {
    const s = state([lot('A', 400, '2026-11-01T00:00:00Z'), lot('B', 250, '2026-11-05T10:00:00Z'), lot('C', 900, '2026-11-06T00:00:00Z')]);
    expect(planExpiry(s, T0)).toEqual([{ lotId: 'A', amountPaise: 400 }, { lotId: 'B', amountPaise: 250 }]);
  });
  it('applying the plan writes off the money, marks emptied lots EXPIRED and is a no-op the second time', () => {
    const s = state([lot('A', 400, '2026-11-01T00:00:00Z'), lot('C', 900, '2026-11-06T00:00:00Z')]);
    const uses = planExpiry(s, T0); const r = applyOp(s, { kind: 'EXPIRY', uses });
    expect(r.state.balancePaise).toBe(900);
    expect(r.state.lots.find((l) => l.id === 'A')).toMatchObject({ remainingPaise: 0, status: 'EXPIRED' });
    expect(r.entry).toMatchObject({ kind: 'EXPIRY', amountPaise: -400, balanceDeltaPaise: -400 });
    expect(planExpiry(r.state, T0)).toEqual([]);
  });
  it('never writes off money that is held: only the available part of an expired lot is taken', () => {
    const s = state([lot('A', 1000, '2026-11-01T00:00:00Z')], 600);
    expect(planExpiry(s, T0)).toEqual([{ lotId: 'A', amountPaise: 400 }]);
    const r = applyOp(s, { kind: 'EXPIRY', uses: planExpiry(s, T0) });
    expect(r.state).toMatchObject({ balancePaise: 600, heldPaise: 600 });
    expect(r.state.lots[0]).toMatchObject({ remainingPaise: 600, status: 'OPEN' });
  });
  it('after the hold is released the rest of the expired lot is written off on the next run', () => {
    const s = state([lot('A', 1000, '2026-11-01T00:00:00Z')], 600);
    const first = applyOp(s, { kind: 'EXPIRY', uses: planExpiry(s, T0) }).state;
    const released = applyOp(first, { kind: 'RELEASE', amountPaise: 600 }).state;
    expect(planExpiry(released, T0)).toEqual([{ lotId: 'A', amountPaise: 600 }]);
  });
  it('refuses an expiry plan that exceeds what is available, or names a lot it does not have', () => {
    const s = state([lot('A', 1000, '2026-11-01T00:00:00Z')], 600);
    expect(code(() => applyOp(s, { kind: 'EXPIRY', uses: [{ lotId: 'A', amountPaise: 401 }] }))).toBe('EXPIRY_INVALID');
    expect(code(() => applyOp(s, { kind: 'EXPIRY', uses: [{ lotId: 'Q', amountPaise: 1 }] }))).toBe('EXPIRY_INVALID');
    expect(code(() => applyOp(s, { kind: 'EXPIRY', uses: [] }))).toBe('EXPIRY_INVALID');
  });
});

describe('staff adjustments', () => {
  it('a positive adjustment opens a lot; a negative one spends the oldest lots', () => {
    const s = topup(empty(), 1000, 'A', '2027-01-01T00:00:00Z').state;
    const up = applyOp(s, { kind: 'ADJUSTMENT', amountPaise: 500, lotId: 'ADJ', lotCreatedAt: T0, lotExpiresAt: D('2027-11-05T10:00:00Z') });
    expect(up.state.balancePaise).toBe(1500); expect(up.state.lots.map((l) => l.id)).toEqual(['A', 'ADJ']);
    const down = applyOp(up.state, { kind: 'ADJUSTMENT', amountPaise: -1200, lotId: 'unused', lotCreatedAt: T0, lotExpiresAt: T0 });
    expect(down.state.balancePaise).toBe(300); expect(down.entry).toMatchObject({ kind: 'ADJUSTMENT', amountPaise: -1200, balanceDeltaPaise: -1200 });
  });
  it('can never take more than is available, so a hold is never undercut and the balance never goes negative', () => {
    const s = applyOp(topup(empty(), 1000).state, { kind: 'HOLD', amountPaise: 700 }).state;
    expect(code(() => applyOp(s, { kind: 'ADJUSTMENT', amountPaise: -301, lotId: 'x', lotCreatedAt: T0, lotExpiresAt: T0 }))).toBe('ADJUST_UNDERCUTS_HOLDS');
    expect(applyOp(s, { kind: 'ADJUSTMENT', amountPaise: -300, lotId: 'x', lotCreatedAt: T0, lotExpiresAt: T0 }).state.balancePaise).toBe(700);
  });
  it('refuses a zero or fractional adjustment', () => {
    const s = topup(empty(), 1000).state;
    expect(code(() => applyOp(s, { kind: 'ADJUSTMENT', amountPaise: 0, lotId: 'x', lotCreatedAt: T0, lotExpiresAt: T0 }))).toBe('AMOUNT_INVALID');
    expect(code(() => applyOp(s, { kind: 'ADJUSTMENT', amountPaise: 1.5, lotId: 'x', lotCreatedAt: T0, lotExpiresAt: T0 }))).toBe('AMOUNT_INVALID');
  });
});

describe('the invariants hold under thousands of random steps (seeded, so a failure repeats)', () => {
  it('never negative, held never above balance, lots add up, and reconcile agrees with the cache', () => {
    let seed = 20261105; const rnd = (n: number): number => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed % n; };
    let s = empty(); let lotNo = 0; let now = T0.getTime(); const entries: Array<{ balanceDeltaPaise: number; heldDeltaPaise: number; balanceAfterPaise: number; heldAfterPaise: number }> = [];
    const charges: Array<{ amount: number; uses: { lotId: string; amountPaise: number }[]; reversed: boolean }> = [];
    let refused = 0; let applied = 0;
    for (let i = 0; i < 6000; i++) {
      now += rnd(86_400_000);
      const pick = rnd(9); const amt = 1 + rnd(5000);
      let op: Op;
      if (pick === 0 || pick === 1) op = { kind: 'TOPUP', amountPaise: amt, lotId: `L${++lotNo}`, lotCreatedAt: new Date(now), lotExpiresAt: new Date(now + 365 * 86_400_000) };
      else if (pick === 2) op = { kind: 'HOLD', amountPaise: amt };
      else if (pick === 3) op = { kind: 'RELEASE', amountPaise: 1 + rnd(Math.max(1, s.heldPaise)) };
      else if (pick === 4) op = { kind: 'CHARGE', amountPaise: amt, fromHold: false };
      else if (pick === 5) op = { kind: 'CHARGE', amountPaise: 1 + rnd(Math.max(1, s.heldPaise)), fromHold: true };
      else if (pick === 6) { const c = charges.find((x) => !x.reversed); if (!c) continue; c.reversed = true; op = { kind: 'REVERSAL', amountPaise: c.amount, uses: c.uses }; }
      else if (pick === 7) { const plan = planExpiry(s, new Date(now)); if (!plan.length) continue; op = { kind: 'EXPIRY', uses: plan }; }
      else op = { kind: 'ADJUSTMENT', amountPaise: rnd(2) ? amt : -amt, lotId: `L${++lotNo}`, lotCreatedAt: new Date(now), lotExpiresAt: new Date(now + 365 * 86_400_000) };
      try {
        const r = applyOp(s, op); applied++;
        if (r.entry.kind === 'CHARGE' && !(op as { fromHold?: boolean }).fromHold) charges.push({ amount: -r.entry.amountPaise, uses: r.entry.lotUses, reversed: false });
        s = r.state;
        entries.push({ balanceDeltaPaise: r.entry.balanceDeltaPaise, heldDeltaPaise: r.entry.heldDeltaPaise, balanceAfterPaise: s.balancePaise, heldAfterPaise: s.heldPaise });
      } catch (e) { expect(e).toBeInstanceOf(WalletRuleError); refused++; }
      expect(s.balancePaise).toBeGreaterThanOrEqual(0); expect(s.heldPaise).toBeGreaterThanOrEqual(0); expect(s.heldPaise).toBeLessThanOrEqual(s.balancePaise);
      expect(s.lots.reduce((t, l) => t + l.remainingPaise, 0)).toBe(s.balancePaise);
      expect(Number.isSafeInteger(s.balancePaise)).toBe(true);
    }
    expect(applied).toBeGreaterThan(1500); expect(refused).toBeGreaterThan(50);   // refusals really happen in the walk (this seed refuses 77), so the guards are exercised, not just the happy path
    expect(reconcile({ balancePaise: s.balancePaise, heldPaise: s.heldPaise, entries, lots: s.lots })).toEqual({ ok: true, problems: [] });
  });
});

describe('reconcile (the ledger is the truth, the cached balances must agree)', () => {
  const e = (b: number, h: number, ba: number, ha: number) => ({ balanceDeltaPaise: b, heldDeltaPaise: h, balanceAfterPaise: ba, heldAfterPaise: ha });
  const entries = [e(1000, 0, 1000, 0), e(0, 400, 1000, 400), e(-400, -400, 600, 0)];
  it('agrees when the cache equals the replay and the lots add up', () => {
    expect(reconcile({ balancePaise: 600, heldPaise: 0, entries, lots: [{ remainingPaise: 600 }] })).toEqual({ ok: true, problems: [] });
  });
  it('detects a tampered balance, a tampered held amount, a broken running total and lots that do not add up', () => {
    expect(reconcile({ balancePaise: 650, heldPaise: 0, entries, lots: [{ remainingPaise: 600 }] }).ok).toBe(false);
    expect(reconcile({ balancePaise: 600, heldPaise: 50, entries, lots: [{ remainingPaise: 600 }] }).problems.join(' ')).toMatch(/held/i);
    expect(reconcile({ balancePaise: 600, heldPaise: 0, entries: [entries[0], e(0, 400, 1000, 999), entries[2]], lots: [{ remainingPaise: 600 }] }).problems.join(' ')).toMatch(/running/i);
    expect(reconcile({ balancePaise: 600, heldPaise: 0, entries, lots: [{ remainingPaise: 599 }] }).problems.join(' ')).toMatch(/lots/i);
  });
  it('an empty ledger means a zero wallet', () => {
    expect(reconcile({ balancePaise: 0, heldPaise: 0, entries: [], lots: [] }).ok).toBe(true);
    expect(reconcile({ balancePaise: 1, heldPaise: 0, entries: [], lots: [] }).ok).toBe(false);
  });
});

describe('the activation rule (owner rule 2)', () => {
  it('a PAID Pro plan order activates the wallet', () => { expect(activationDecision({ kind: 'PLAN_ORDER_PAID', planLevel: 'PRO' })).toBe(true); });
  it('a Free plan order never does', () => { expect(activationDecision({ kind: 'PLAN_ORDER_PAID', planLevel: 'FREE' })).toBe(false); });
  it('a Pro subscription started by the vendor paying (SELF) activates it', () => { expect(activationDecision({ kind: 'SUBSCRIPTION', level: 'PRO', source: 'SELF', reason: 'plan order o1' })).toBe(true); });
  it('a Pro subscription started by staff marking an offline payment (a plan order) activates it', () => { expect(activationDecision({ kind: 'SUBSCRIPTION', level: 'PRO', source: 'STAFF', reason: 'plan order o1' })).toBe(true); });
  it.each([['REGISTRATION'], ['MIGRATION'], ['PROMO']])('a Pro subscription from %s does not', (source) => { expect(activationDecision({ kind: 'SUBSCRIPTION', level: 'PRO', source, reason: 'plan order o1' })).toBe(false); });
  it('a Pro grant by staff with no payment behind it does not', () => { expect(activationDecision({ kind: 'SUBSCRIPTION', level: 'PRO', source: 'STAFF', reason: 'goodwill' })).toBe(false); expect(activationDecision({ kind: 'SUBSCRIPTION', level: 'PRO', source: 'STAFF', reason: null })).toBe(false); });
  it('a Free subscription never does', () => { expect(activationDecision({ kind: 'SUBSCRIPTION', level: 'FREE', source: 'SELF', reason: 'plan order o1' })).toBe(false); });
});

describe('top-up limits and the shortfall hint', () => {
  it('the amount must be a whole number of paise inside the staff limits', () => {
    expect(topupAmountProblem(10_000, 5_000, 50_000)).toBeNull();
    expect(topupAmountProblem(5_000, 5_000, 50_000)).toBeNull(); expect(topupAmountProblem(50_000, 5_000, 50_000)).toBeNull();
    expect(topupAmountProblem(4_999, 5_000, 50_000)).toBe('BELOW_MINIMUM'); expect(topupAmountProblem(50_001, 5_000, 50_000)).toBe('ABOVE_MAXIMUM');
    expect(topupAmountProblem(1.5, 5_000, 50_000)).toBe('INVALID'); expect(topupAmountProblem(-1, 5_000, 50_000)).toBe('INVALID');
  });
  it('suggests exactly the shortfall when it is above the minimum, and the minimum when the shortfall is smaller', () => {
    expect(shortfallHint(12_000, 5_000, 50_000)).toEqual({ shortfallPaise: 12_000, suggestedTopupPaise: 12_000, minTopupPaise: 5_000, maxTopupPaise: 50_000, canCoverInOneTopup: true });
    expect(shortfallHint(300, 5_000, 50_000)).toMatchObject({ suggestedTopupPaise: 5_000, canCoverInOneTopup: true });
  });
  it('never suggests more than the maximum, and says when one top-up cannot cover it', () => {
    expect(shortfallHint(80_000, 5_000, 50_000)).toMatchObject({ suggestedTopupPaise: 50_000, canCoverInOneTopup: false });
  });
  it('with no limits set there is nothing to suggest', () => {
    expect(shortfallHint(1_000, null, null)).toEqual({ shortfallPaise: 1_000, suggestedTopupPaise: null, minTopupPaise: null, maxTopupPaise: null, canCoverInOneTopup: false });
  });
});
