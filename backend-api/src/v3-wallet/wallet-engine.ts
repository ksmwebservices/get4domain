import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { applyOp, available, LedgerKind, Lot, Op, planExpiry, WalletRuleError } from './core/wallet-core';
import { frozen, notActive, walletError } from './wallet.errors';
import { LedgerRow, LotRow, WalletRow, WalletTx } from './wallet.store';

const DAY_MS = 86_400_000;
export interface PostActor { type: 'VENDOR' | 'STAFF' | 'SYSTEM'; id: string | null }

export interface PostRequest {
  kind: Exclude<LedgerKind, 'EXPIRY'>;
  amountPaise: number;
  /** unique per wallet: the same key again returns the first result and changes nothing */
  idempotencyKey: string;
  refType?: string | null; refId?: string | null; reason?: string | null;
  actor: PostActor;
  now: Date;
  /** CHARGE or RELEASE that settles an earlier HOLD (the hold's entry id). The amount is then the hold's amount. */
  holdId?: string;
  /** REVERSAL of an earlier charge (the charge's entry id) */
  reversesId?: string;
  /** TOPUP and positive ADJUSTMENT: how many days the new lot lasts (the staff setting at the time of the top-up) */
  validityDays?: number;
  /** TOPUP: the top-up this lot belongs to */
  topupId?: string | null;
}
export interface PostResult { entry: LedgerRow; replay: boolean; wallet: WalletRow }

const SPEND: ReadonlySet<LedgerKind> = new Set(['HOLD', 'CHARGE', 'PACK_PURCHASE', 'PLAN_RENEWAL']);
const toLot = (l: LotRow): Lot => ({ id: l.id, remainingPaise: l.remainingPaise, expiresAt: l.expiresAt, createdAt: l.createdAt, status: l.status });
const conflict = (m: string): ConflictException => new ConflictException(walletError('WALLET_IDEMPOTENCY_CONFLICT', m));

/** The magnitude a ledger entry stands for, so a replay can be compared with the request that made it. */
const same = (e: LedgerRow, r: PostRequest): boolean => e.kind === r.kind && (r.kind === 'REVERSAL' || Math.abs(e.amountPaise) === Math.abs(r.amountPaise)) && (e.refType ?? null) === (r.refType ?? null) && (e.refId ?? null) === (r.refId ?? null);

/**
 * THE one writer of the ledger. Inside a unit of work: replay check, status check, the pure transition, then one commit (wallet numbers, lots and the ledger row together).
 * A rule error (WalletRuleError) is thrown BEFORE anything is written, so a refused step leaves no trace.
 */
export async function postEntry(tx: WalletTx, r: PostRequest, newId: () => string = randomUUID): Promise<PostResult> {
  const key = String(r.idempotencyKey ?? '');
  if (key.length < 6 || key.length > 120) throw conflict('The request key must be 6 to 120 characters.');
  const prior = await tx.ledgerByKey(key);
  if (prior) {
    if (!same(prior, r)) throw conflict('That request key was already used for a different wallet entry.');
    return { entry: prior, replay: true, wallet: (await tx.wallet())! };
  }
  const wallet = await tx.wallet();
  if (!wallet || wallet.status === 'INACTIVE') throw notActive();
  if (SPEND.has(r.kind) && wallet.status === 'FROZEN') throw frozen();

  const lots = await tx.lots();
  const state = { balancePaise: wallet.balancePaise, heldPaise: wallet.heldPaise, lots: lots.map(toLot) };
  let op: Op; let holdId: string | null = null; let reversesId: string | null = null; let amount = r.amountPaise;

  if (r.kind === 'RELEASE' && !r.holdId) throw new WalletRuleError('HOLD_NOT_ENOUGH', 'A release must name the hold it settles.');
  if ((r.kind === 'CHARGE' || r.kind === 'RELEASE') && r.holdId) {
    const hold = await tx.ledgerById(r.holdId);
    if (!hold || hold.walletId !== wallet.id || hold.kind !== 'HOLD') throw new WalletRuleError('HOLD_NOT_ENOUGH', 'That hold does not exist.');
    if (await tx.consumerOfHold(hold.id)) throw new WalletRuleError('HOLD_NOT_ENOUGH', 'That hold was already settled.');
    if (r.amountPaise !== hold.heldDeltaPaise) throw new WalletRuleError('HOLD_NOT_ENOUGH', 'The amount does not match the hold.');
    amount = hold.heldDeltaPaise; holdId = hold.id;
  }
  if (r.kind === 'REVERSAL') {
    const charge = r.reversesId ? await tx.ledgerById(r.reversesId) : null;
    if (!charge || charge.walletId !== wallet.id || !(['CHARGE', 'PACK_PURCHASE', 'PLAN_RENEWAL'] as LedgerKind[]).includes(charge.kind)) throw new WalletRuleError('REVERSAL_INVALID', 'That charge does not exist.');
    if (await tx.reversalOf(charge.id)) throw new WalletRuleError('REVERSAL_INVALID', 'That charge was already reversed.');
    amount = -charge.amountPaise; reversesId = charge.id;
    op = { kind: 'REVERSAL', amountPaise: amount, uses: charge.lotUses };
  } else if (r.kind === 'TOPUP' || r.kind === 'ADJUSTMENT') {
    const days = r.validityDays ?? 365;
    op = { kind: r.kind, amountPaise: amount, lotId: newId(), lotCreatedAt: r.now, lotExpiresAt: new Date(r.now.getTime() + days * DAY_MS) };
  } else if (r.kind === 'HOLD' || r.kind === 'RELEASE') op = { kind: r.kind, amountPaise: amount };
  else op = { kind: r.kind, amountPaise: amount, fromHold: holdId !== null };

  const applied = applyOp(state, op);
  const e = applied.entry;
  const row = await tx.commit({
    expectedVersion: wallet.version, balancePaise: applied.state.balancePaise, heldPaise: applied.state.heldPaise, at: r.now,
    lotUpdates: applied.state.lots.filter((l) => { const before = lots.find((x) => x.id === l.id); return before && (before.remainingPaise !== l.remainingPaise || before.status !== l.status); }).map((l) => ({ id: l.id, remainingPaise: l.remainingPaise, status: l.status })),
    newLot: applied.createdLot ? { id: applied.createdLot.id, topupId: r.topupId ?? null, source: r.kind === 'ADJUSTMENT' ? 'ADJUSTMENT' : 'TOPUP', amountPaise: applied.createdLot.remainingPaise, remainingPaise: applied.createdLot.remainingPaise, expiresAt: applied.createdLot.expiresAt, createdAt: applied.createdLot.createdAt } : null,
    entry: {
      kind: e.kind, amountPaise: e.amountPaise, balanceDeltaPaise: e.balanceDeltaPaise, heldDeltaPaise: e.heldDeltaPaise, balanceAfterPaise: applied.state.balancePaise, heldAfterPaise: applied.state.heldPaise,
      refType: r.refType ?? null, refId: r.refId ?? null, idempotencyKey: key, holdId, reversesId, reason: r.reason ?? null, actorType: r.actor.type, actorId: r.actor.id, lotUses: e.lotUses,
    },
  });
  return { entry: row, replay: false, wallet: { ...wallet, balancePaise: applied.state.balancePaise, heldPaise: applied.state.heldPaise, version: wallet.version + 1, entryCount: wallet.entryCount + 1 } };
}

/**
 * Writes off, in ONE entry, every lot that is past its date (never held money; see planExpiry). Returns null when there is nothing to write off, so running it again changes nothing.
 * The idempotency key names the wallet's entry count, so two runs racing for the same state cannot both write.
 */
export async function expireWallet(tx: WalletTx, now: Date): Promise<LedgerRow | null> {
  const wallet = await tx.wallet();
  if (!wallet || wallet.status === 'INACTIVE') return null;
  const lots = await tx.lots();
  const state = { balancePaise: wallet.balancePaise, heldPaise: wallet.heldPaise, lots: lots.map(toLot) };
  const uses = planExpiry(state, now);
  if (uses.length === 0) return null;
  const applied = applyOp(state, { kind: 'EXPIRY', uses });
  const key = `expiry:${wallet.id}:${wallet.entryCount + 1}`;
  return tx.commit({
    expectedVersion: wallet.version, balancePaise: applied.state.balancePaise, heldPaise: applied.state.heldPaise, at: now,
    lotUpdates: applied.state.lots.filter((l) => { const before = lots.find((x) => x.id === l.id)!; return before.remainingPaise !== l.remainingPaise || before.status !== l.status; }).map((l) => ({ id: l.id, remainingPaise: l.remainingPaise, status: l.status })),
    newLot: null,
    entry: {
      kind: 'EXPIRY', amountPaise: applied.entry.amountPaise, balanceDeltaPaise: applied.entry.balanceDeltaPaise, heldDeltaPaise: 0, balanceAfterPaise: applied.state.balancePaise, heldAfterPaise: applied.state.heldPaise,
      refType: 'wallet', refId: wallet.id, idempotencyKey: key, holdId: null, reversesId: null, reason: 'credit past its validity', actorType: 'SYSTEM', actorId: null, lotUses: applied.entry.lotUses,
    },
  });
}

export { available };
