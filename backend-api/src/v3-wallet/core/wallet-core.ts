/**
 * The V3 wallet money core (slice 5.16a and 5.16a-2). PURE: no database, no Nest, no clock, no randomness (the caller passes ids and dates).
 *
 * Money is integer paise end to end. The wallet has a BALANCE (all the money in it), HELD money (reserved for a pending request, not spendable) and AVAILABLE = balance - held.
 * The balance is made of LOTS: one per top-up (or positive staff adjustment), each with the date it expires. Spending takes from the lot that expires first (owner rule 3).
 * Every transition returns a NEW state and a ledger entry; it throws a WalletRuleError instead of ever producing a negative balance, a negative held amount, held money above the
 * balance, or lots that do not add up to the balance.
 *
 * Sign convention of `amountPaise` in a ledger entry = the effect on the vendor's AVAILABLE money:
 *   TOPUP +x | ADJUSTMENT +x or -x | HOLD -x | RELEASE +x | CHARGE, PACK_PURCHASE, PLAN_RENEWAL -x | REVERSAL +x | EXPIRY -x.
 * `balanceDeltaPaise` and `heldDeltaPaise` are the exact effect on the two stored numbers (a charge of a held amount moves both), and are what reconcile() replays.
 */
export const LEDGER_KINDS = ['TOPUP', 'HOLD', 'RELEASE', 'CHARGE', 'REVERSAL', 'EXPIRY', 'ADJUSTMENT', 'PACK_PURCHASE', 'PLAN_RENEWAL'] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];
export type LotStatus = 'OPEN' | 'SPENT' | 'EXPIRED';

export interface Lot { id: string; remainingPaise: number; expiresAt: Date; createdAt: Date; status: LotStatus }
export interface LotUse { lotId: string; amountPaise: number }
export interface WalletState { balancePaise: number; heldPaise: number; lots: Lot[] }

export type WalletRuleCode = 'AMOUNT_INVALID' | 'INSUFFICIENT_WALLET' | 'HOLD_NOT_ENOUGH' | 'ADJUST_UNDERCUTS_HOLDS' | 'REVERSAL_INVALID' | 'EXPIRY_INVALID';
export class WalletRuleError extends Error {
  constructor(readonly code: WalletRuleCode, message: string, readonly extra: Record<string, unknown> = {}) { super(message); this.name = 'WalletRuleError'; }
}

export const available = (s: { balancePaise: number; heldPaise: number }): number => s.balancePaise - s.heldPaise;

const isPositiveInt = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
const need = (n: unknown): number => { if (!isPositiveInt(n)) throw new WalletRuleError('AMOUNT_INVALID', 'The amount must be a whole number of paise, more than zero.'); return n; };
const safeAdd = (a: number, b: number): number => { const r = a + b; if (!Number.isSafeInteger(r)) throw new WalletRuleError('AMOUNT_INVALID', 'The amount is too large.'); return r; };

export type Op =
  | { kind: 'TOPUP'; amountPaise: number; lotId: string; lotCreatedAt: Date; lotExpiresAt: Date }
  | { kind: 'ADJUSTMENT'; amountPaise: number; lotId: string; lotCreatedAt: Date; lotExpiresAt: Date }
  | { kind: 'HOLD'; amountPaise: number }
  | { kind: 'RELEASE'; amountPaise: number }
  | { kind: 'CHARGE' | 'PACK_PURCHASE' | 'PLAN_RENEWAL'; amountPaise: number; fromHold: boolean }
  | { kind: 'REVERSAL'; amountPaise: number; uses: readonly LotUse[] }
  | { kind: 'EXPIRY'; uses: readonly LotUse[] };

export interface EntryEffect { kind: LedgerKind; amountPaise: number; balanceDeltaPaise: number; heldDeltaPaise: number; lotUses: LotUse[] }
export interface Applied { state: WalletState; entry: EntryEffect; createdLot: Lot | null }

const copyLots = (lots: readonly Lot[]): Lot[] => lots.map((l) => ({ ...l, expiresAt: new Date(l.expiresAt), createdAt: new Date(l.createdAt) }));

/** The order money leaves the lots: the lot that expires first, then the one created first, then by id (a total order, so the answer never depends on how rows were listed). */
export function lotOrder(a: Lot, b: Lot): number {
  return a.expiresAt.getTime() - b.expiresAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function consume(lots: Lot[], amount: number): LotUse[] {
  const uses: LotUse[] = []; let left = amount;
  for (const l of [...lots].filter((x) => x.remainingPaise > 0).sort(lotOrder)) {
    if (left === 0) break;
    const take = Math.min(l.remainingPaise, left);
    const target = lots.find((x) => x.id === l.id)!;
    target.remainingPaise -= take; if (target.remainingPaise === 0) target.status = 'SPENT';
    uses.push({ lotId: l.id, amountPaise: take }); left -= take;
  }
  if (left !== 0) throw new WalletRuleError('INSUFFICIENT_WALLET', 'The lots hold less than the balance says.');   // cannot happen while the invariant holds
  return uses;
}

/** One state transition. Returns the new state, the ledger effect and the lot it created (if any). Throws WalletRuleError; never returns an invalid state. */
export function applyOp(state: WalletState, op: Op): Applied {
  const lots = copyLots(state.lots); let balance = state.balancePaise; let held = state.heldPaise;
  const avail = balance - held;
  let createdLot: Lot | null = null; let lotUses: LotUse[] = [];
  let entry: Omit<EntryEffect, 'lotUses'>;

  switch (op.kind) {
    case 'TOPUP': {
      const x = need(op.amountPaise); balance = safeAdd(balance, x);
      createdLot = { id: op.lotId, remainingPaise: x, expiresAt: new Date(op.lotExpiresAt), createdAt: new Date(op.lotCreatedAt), status: 'OPEN' }; lots.push(createdLot);
      lotUses = [{ lotId: op.lotId, amountPaise: x }];
      entry = { kind: 'TOPUP', amountPaise: x, balanceDeltaPaise: x, heldDeltaPaise: 0 }; break;
    }
    case 'ADJUSTMENT': {
      if (typeof op.amountPaise !== 'number' || !Number.isSafeInteger(op.amountPaise) || op.amountPaise === 0) throw new WalletRuleError('AMOUNT_INVALID', 'The adjustment must be a whole number of paise, not zero.');
      if (op.amountPaise > 0) {
        balance = safeAdd(balance, op.amountPaise);
        createdLot = { id: op.lotId, remainingPaise: op.amountPaise, expiresAt: new Date(op.lotExpiresAt), createdAt: new Date(op.lotCreatedAt), status: 'OPEN' }; lots.push(createdLot);
        lotUses = [{ lotId: op.lotId, amountPaise: op.amountPaise }];
      } else {
        const x = -op.amountPaise;
        if (avail < x) throw new WalletRuleError('ADJUST_UNDERCUTS_HOLDS', 'That would take money that is held for a request.', { availablePaise: avail });
        lotUses = consume(lots, x); balance -= x;
      }
      entry = { kind: 'ADJUSTMENT', amountPaise: op.amountPaise, balanceDeltaPaise: op.amountPaise, heldDeltaPaise: 0 }; break;
    }
    case 'HOLD': {
      const x = need(op.amountPaise);
      if (avail < x) throw new WalletRuleError('INSUFFICIENT_WALLET', 'The wallet does not have enough available.', { shortfallPaise: x - avail, availablePaise: avail, requiredPaise: x });
      held += x; entry = { kind: 'HOLD', amountPaise: -x, balanceDeltaPaise: 0, heldDeltaPaise: x }; break;
    }
    case 'RELEASE': {
      const x = need(op.amountPaise);
      if (held < x) throw new WalletRuleError('HOLD_NOT_ENOUGH', 'That is more than is held.');
      held -= x; entry = { kind: 'RELEASE', amountPaise: x, balanceDeltaPaise: 0, heldDeltaPaise: -x }; break;
    }
    case 'CHARGE': case 'PACK_PURCHASE': case 'PLAN_RENEWAL': {
      const x = need(op.amountPaise);
      if (op.fromHold) {
        if (held < x || balance < x) throw new WalletRuleError('HOLD_NOT_ENOUGH', 'That is more than is held.');
        held -= x;
      } else if (avail < x) throw new WalletRuleError('INSUFFICIENT_WALLET', 'The wallet does not have enough available.', { shortfallPaise: x - avail, availablePaise: avail, requiredPaise: x });
      lotUses = consume(lots, x); balance -= x;
      entry = { kind: op.kind, amountPaise: -x, balanceDeltaPaise: -x, heldDeltaPaise: op.fromHold ? -x : 0 }; break;
    }
    case 'REVERSAL': {
      const x = need(op.amountPaise);
      const total = (op.uses ?? []).reduce((t, u) => t + (isPositiveInt(u?.amountPaise) ? u.amountPaise : NaN), 0);
      if (!Array.isArray(op.uses) || op.uses.length === 0 || total !== x) throw new WalletRuleError('REVERSAL_INVALID', 'The lots to give back do not add up to the amount.');
      for (const u of op.uses) {
        const l = lots.find((y) => y.id === u.lotId);
        if (!l) throw new WalletRuleError('REVERSAL_INVALID', 'That money did not come from this wallet.');
        l.remainingPaise = safeAdd(l.remainingPaise, u.amountPaise); l.status = 'OPEN';
      }
      balance = safeAdd(balance, x); lotUses = op.uses.map((u) => ({ ...u }));
      entry = { kind: 'REVERSAL', amountPaise: x, balanceDeltaPaise: x, heldDeltaPaise: 0 }; break;
    }
    case 'EXPIRY': {
      const uses = op.uses ?? [];
      if (uses.length === 0) throw new WalletRuleError('EXPIRY_INVALID', 'There is nothing to write off.');
      let total = 0;
      for (const u of uses) {
        const l = lots.find((y) => y.id === u.lotId);
        if (!l || !isPositiveInt(u.amountPaise) || u.amountPaise > l.remainingPaise) throw new WalletRuleError('EXPIRY_INVALID', 'That write-off does not match the lot.');
        l.remainingPaise -= u.amountPaise; if (l.remainingPaise === 0) l.status = 'EXPIRED'; total += u.amountPaise;
      }
      if (total > avail) throw new WalletRuleError('EXPIRY_INVALID', 'Held money is never written off.');
      balance -= total; lotUses = uses.map((u) => ({ ...u }));
      entry = { kind: 'EXPIRY', amountPaise: -total, balanceDeltaPaise: -total, heldDeltaPaise: 0 }; break;
    }
    default: throw new WalletRuleError('AMOUNT_INVALID', 'Unknown wallet step.');
  }
  return { state: { balancePaise: balance, heldPaise: held, lots }, entry: { ...entry, lotUses }, createdLot };
}

/**
 * Which lots are past their date at `now`, and how much of each can be written off: oldest first, for what is left of each lot, but never more than is AVAILABLE
 * (money held for a request survives; it is written off by a later run once it is free). Idempotent: applying the plan and planning again gives nothing.
 */
export function planExpiry(state: WalletState, now: Date): LotUse[] {
  let budget = state.balancePaise - state.heldPaise; const uses: LotUse[] = [];
  for (const l of [...state.lots].filter((x) => x.remainingPaise > 0 && x.expiresAt.getTime() <= now.getTime()).sort(lotOrder)) {
    if (budget <= 0) break;
    const take = Math.min(l.remainingPaise, budget);
    uses.push({ lotId: l.id, amountPaise: take }); budget -= take;
  }
  return uses;
}

// ───────────────────────────────────────────────────────────────────────────────────────── reconcile
export interface ReconcileInput {
  balancePaise: number; heldPaise: number;
  entries: ReadonlyArray<{ balanceDeltaPaise: number; heldDeltaPaise: number; balanceAfterPaise: number; heldAfterPaise: number }>;
  lots: ReadonlyArray<{ remainingPaise: number }>;
}
/** The ledger is the truth: replay it and compare with the cached numbers on the wallet row and with the lots. Any difference is reported in plain words. */
export function reconcile(i: ReconcileInput): { ok: boolean; problems: string[] } {
  const problems: string[] = []; let b = 0; let h = 0;
  i.entries.forEach((e, n) => {
    b += e.balanceDeltaPaise; h += e.heldDeltaPaise;
    if (b !== e.balanceAfterPaise || h !== e.heldAfterPaise) problems.push(`running total wrong at entry ${n + 1}: the entries add up to balance ${b} and held ${h}, the entry says ${e.balanceAfterPaise} and ${e.heldAfterPaise}`);
    if (b < 0 || h < 0 || h > b) problems.push(`entry ${n + 1} leaves an impossible state (balance ${b}, held ${h})`);
  });
  if (b !== i.balancePaise) problems.push(`balance on the wallet is ${i.balancePaise} but the ledger adds up to ${b}`);
  if (h !== i.heldPaise) problems.push(`held on the wallet is ${i.heldPaise} but the ledger adds up to ${h}`);
  const lotTotal = i.lots.reduce((t, l) => t + l.remainingPaise, 0);
  if (lotTotal !== i.balancePaise) problems.push(`the lots hold ${lotTotal} but the balance is ${i.balancePaise}`);
  return { ok: problems.length === 0, problems };
}

// ───────────────────────────────────────────────────────────────────────────────────────── activation (owner rule 2)
export type ActivationEvidence =
  | { kind: 'PLAN_ORDER_PAID'; planLevel: 'FREE' | 'PRO' }
  | { kind: 'SUBSCRIPTION'; level: 'FREE' | 'PRO'; source: string; reason: string | null };

/**
 * The wallet becomes ACTIVE only after the first PAID Pro term. Evidence is a Pro plan order that is PAID, or a Pro subscription that a payment started: source SELF (the vendor paid
 * online) or STAFF with a reason that names a plan order (staff marked an offline payment). A staff grant with no payment, a registration, a migration or a promotion never does.
 */
export function activationDecision(e: ActivationEvidence): boolean {
  if (e.kind === 'PLAN_ORDER_PAID') return e.planLevel === 'PRO';
  if (e.level !== 'PRO') return false;
  if (e.source === 'SELF') return true;
  return e.source === 'STAFF' && typeof e.reason === 'string' && e.reason.startsWith('plan order ');
}

// ───────────────────────────────────────────────────────────────────────────────────────── top-up limits and the shortfall hint
export type TopupProblem = 'INVALID' | 'NOT_CONFIGURED' | 'BELOW_MINIMUM' | 'ABOVE_MAXIMUM';
/** null = fine. No limit has a default: until staff set both, a top-up is refused (NOT_CONFIGURED). */
export function topupAmountProblem(amountPaise: unknown, minPaise: number | null, maxPaise: number | null): TopupProblem | null {
  if (!isPositiveInt(amountPaise)) return 'INVALID';
  if (minPaise === null || maxPaise === null) return 'NOT_CONFIGURED';
  if (amountPaise < minPaise) return 'BELOW_MINIMUM';
  if (amountPaise > maxPaise) return 'ABOVE_MAXIMUM';
  return null;
}

export interface ShortfallHint { shortfallPaise: number; suggestedTopupPaise: number | null; minTopupPaise: number | null; maxTopupPaise: number | null; canCoverInOneTopup: boolean }
/**
 * What to offer when an action needs more than is available. The suggested top-up is exactly the shortfall, raised to the staff minimum when the shortfall is smaller, and never above
 * the staff maximum. That keeps the offer to "what is needed, or the minimum step", never a bigger refill than necessary.
 */
export function shortfallHint(shortfallPaise: number, minPaise: number | null, maxPaise: number | null): ShortfallHint {
  if (minPaise === null || maxPaise === null) return { shortfallPaise, suggestedTopupPaise: null, minTopupPaise: null, maxTopupPaise: null, canCoverInOneTopup: false };
  return { shortfallPaise, suggestedTopupPaise: Math.min(Math.max(shortfallPaise, minPaise), maxPaise), minTopupPaise: minPaise, maxTopupPaise: maxPaise, canCoverInOneTopup: shortfallPaise <= maxPaise };
}
