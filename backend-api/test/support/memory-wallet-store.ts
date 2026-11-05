import { randomUUID } from 'crypto';
import { KeyedQueue } from '../../src/common/keyed-queue';
import { Actor } from '../../src/plans/admin/audit.service';
import {
  AdminWalletRow, Commit, DuplicateTopupError, LedgerRow, LotRow, NewTopup, PaidProEvidence, ReceiptRow, TopupPatch, TopupRow, TopupStatus, WalletRow, WalletStatus, WalletStore, WalletTx, WalletVersionError,
} from '../../src/v3-wallet/wallet.store';

/**
 * In-memory twin of the Prisma wallet store (unit tests). It enforces what the database enforces: a unique wallet per vendor, unique idempotency keys per wallet, one settlement per hold,
 * one reversal per charge, the amount checks, an append-only ledger, and an atomic unit of work that rolls EVERYTHING back when the callback throws. Units run one at a time, like the
 * queue in front of the real store.
 */
export class MemoryWalletStore extends WalletStore {
  wallets = new Map<string, WalletRow>(); lotsById = new Map<string, LotRow>(); ledger: LedgerRow[] = []; topups = new Map<string, TopupRow>(); receipts: ReceiptRow[] = [];
  counters = new Map<string, number>(); audits: Array<{ actor: Actor; action: string; entityId: string | null; before: unknown; after: unknown }> = [];
  evidence = new Map<string, PaidProEvidence>(); names = new Map<string, string>();
  clock: () => Date = () => new Date();
  /** tests set this to make the NEXT commit throw after validating (a crash in the middle of a unit) */
  failCommitOnce = false;
  /** The simulated connection pool: a unit waits in the per-vendor queue FIRST (memory only) and only then takes a connection, exactly like the real store. Small on purpose. */
  poolSize = 3; maxConnectionsInUse = 0; maxUnitsRunning = 0;
  private inUse = 0; private waiting: Array<() => void> = []; private running = 0;
  private readonly queue = new KeyedQueue();
  private mutex: Promise<unknown> = Promise.resolve(); private n = 0;
  private id(p: string): string { return `${p}-${++this.n}`; }
  private async acquire(): Promise<void> { if (this.inUse >= this.poolSize) await new Promise<void>((r) => this.waiting.push(r)); this.inUse++; this.maxConnectionsInUse = Math.max(this.maxConnectionsInUse, this.inUse); }
  private release(): void { this.inUse--; this.waiting.shift()?.(); }

  /** other in-memory stores (packs, service requests, theme switches) that must roll back together with a wallet unit */
  sidecars: Array<{ capture(): () => void }> = [];
  private snapshot() {
    const sidecarRestores = this.sidecars.map((s) => s.capture());
    return {
      sidecarRestores,
      wallets: new Map([...this.wallets].map(([k, v]) => [k, { ...v }])), lots: new Map([...this.lotsById].map(([k, v]) => [k, { ...v }])), ledger: [...this.ledger], topups: new Map([...this.topups].map(([k, v]) => [k, { ...v }])),
      receipts: [...this.receipts], counters: new Map(this.counters), audits: this.audits.length,
    };
  }
  private restore(s: ReturnType<MemoryWalletStore['snapshot']>): void { for (const r of s.sidecarRestores) r(); this.wallets = s.wallets; this.lotsById = s.lots; this.ledger = s.ledger; this.topups = s.topups; this.receipts = s.receipts; this.counters = s.counters; this.audits.length = s.audits; }

  async unit<T>(vendorId: string, fn: (tx: WalletTx) => Promise<T>): Promise<T> {
    return this.queue.run(`wallet:${vendorId}`, async () => {
      await this.acquire();
      try {
        const run = this.mutex.catch(() => undefined).then(async () => {
          this.running++; this.maxUnitsRunning = Math.max(this.maxUnitsRunning, this.running);
          const snap = this.snapshot();
          try { return await fn(this.tx(vendorId)); } catch (e) { this.restore(snap); throw e; } finally { this.running--; }
        });
        this.mutex = run.catch(() => undefined); return await run;
      } finally { this.release(); }
    });
  }

  /** the wallet's side of a unit of work that another store (plan billing) opened: same rows, rolled back together by capture() */
  txFor(vendorId: string): WalletTx { return this.tx(vendorId); }
  /** a snapshot of everything; calling the returned function puts it all back */
  capture(): () => void { const s = this.snapshot(); return () => this.restore(s); }

  private tx(vendorId: string): WalletTx {
    const mine = (): WalletRow | undefined => this.wallets.get(vendorId);
    return {
      vendorId,
      db: this,
      wallet: async () => { const w = mine(); return w ? { ...w } : null; },
      ensureWallet: async () => {
        let w = mine(); const now = this.clock();
        if (!w) { w = { id: this.id('wal'), vendorId, status: 'INACTIVE', balancePaise: 0, heldPaise: 0, entryCount: 0, version: 0, activatedAt: null, activatedByEventId: null, frozenReason: null, billingStateCode: null, billingGstin: null, createdAt: now, updatedAt: now }; this.wallets.set(vendorId, w); }
        return { ...w };
      },
      lots: async () => [...this.lotsById.values()].filter((l) => l.vendorId === vendorId).map((l) => ({ ...l })),
      ledgerByKey: async (key) => { const w = mine(); const r = w ? this.ledger.find((e) => e.walletId === w.id && e.idempotencyKey === key) : undefined; return r ? { ...r } : null; },
      ledgerById: async (id) => { const r = this.ledger.find((e) => e.id === id && e.vendorId === vendorId); return r ? { ...r } : null; },
      consumerOfHold: async (holdId) => { const r = this.ledger.find((e) => e.holdId === holdId); return r ? { ...r } : null; },
      reversalOf: async (chargeId) => { const r = this.ledger.find((e) => e.reversesId === chargeId); return r ? { ...r } : null; },
      commit: async (c: Commit) => {
        const w = mine(); if (!w) throw new Error('no wallet');
        if (w.version !== c.expectedVersion) throw new WalletVersionError();
        if (c.balancePaise < 0 || c.heldPaise < 0 || c.heldPaise > c.balancePaise) throw new Error('check constraint: g4d_v3_wallets_amounts_chk');
        if (this.ledger.some((e) => e.walletId === w.id && e.idempotencyKey === c.entry.idempotencyKey)) throw new Error('unique: idempotencyKey');
        if (c.entry.holdId && this.ledger.some((e) => e.holdId === c.entry.holdId)) throw new Error('unique: holdId');
        if (c.entry.reversesId && this.ledger.some((e) => e.reversesId === c.entry.reversesId)) throw new Error('unique: reversesId');
        if (this.failCommitOnce) { this.failCommitOnce = false; throw new Error('simulated crash during commit'); }
        for (const u of c.lotUpdates) { const l = this.lotsById.get(u.id); if (!l) throw new Error('no such lot'); if (u.remainingPaise < 0 || u.remainingPaise > l.amountPaise) throw new Error('check constraint: g4d_wallet_lots_amounts_chk'); l.remainingPaise = u.remainingPaise; l.status = u.status; }
        if (c.newLot) { if (c.newLot.topupId && [...this.lotsById.values()].some((l) => l.topupId === c.newLot!.topupId)) throw new Error('unique: lot topupId'); this.lotsById.set(c.newLot.id, { ...c.newLot, walletId: w.id, vendorId, status: 'OPEN' }); }
        w.balancePaise = c.balancePaise; w.heldPaise = c.heldPaise; w.version += 1; w.entryCount += 1; w.updatedAt = c.at;
        const row: LedgerRow = { ...c.entry, lotUses: c.entry.lotUses.map((u) => ({ ...u })), id: this.id('led'), walletId: w.id, vendorId, entryNo: w.entryCount, at: c.at };
        this.ledger.push(row); return { ...row };
      },
      activate: async (eventId, now) => { const w = mine(); if (!w || w.status !== 'INACTIVE') return false; w.status = 'ACTIVE'; w.activatedAt = now; w.activatedByEventId = eventId; w.version += 1; return true; },
      setFrozen: async (frozen, reason) => { const w = mine()!; w.status = frozen ? 'FROZEN' : 'ACTIVE'; w.frozenReason = frozen ? reason : null; w.version += 1; return { ...w }; },
      setBillingProfile: async (p) => { const w = mine()!; w.billingStateCode = p.stateCode; w.billingGstin = p.gstin; },
      insertTopup: async (d: NewTopup) => {
        if ([...this.topups.values()].some((t) => t.vendorId === d.vendorId && t.idempotencyKey === d.idempotencyKey)) throw new DuplicateTopupError();
        const now = this.clock(); const t: TopupRow = { ...d, id: this.id('top'), status: 'CREATED', providerOrderId: null, paymentId: null, paidAmountPaise: null, paidAt: null, ledgerId: null, receiptId: null, createdAt: now, updatedAt: now };
        this.topups.set(t.id, t); return { ...t };
      },
      getTopup: async (id) => { const t = this.topups.get(id); return t && t.vendorId === vendorId ? { ...t } : null; },
      updateTopupCas: async (id, expected: TopupStatus[], patch: TopupPatch) => {
        const t = this.topups.get(id); if (!t || t.vendorId !== vendorId || !expected.includes(t.status)) return false;
        if (patch.providerOrderId && [...this.topups.values()].some((x) => x.id !== id && x.providerOrderId === patch.providerOrderId)) throw new Error('unique: providerOrderId');
        Object.assign(t, patch); t.updatedAt = this.clock(); return true;
      },
      nextNumber: async (series, fy) => { const k = `${series}:${fy}`; const v = (this.counters.get(k) ?? 0) + 1; this.counters.set(k, v); return v; },
      insertReceipt: async (d) => { if (this.receipts.some((r) => r.topupId === d.topupId || r.receiptNumber === d.receiptNumber)) throw new Error('unique: receipt'); const r = { ...d, id: this.id('rct') }; this.receipts.push(r); return { ...r }; },
      audit: async (actor, action, entityId, before, after) => { this.audits.push({ actor, action, entityId, before, after }); },
    };
  }

  // ── reads (the vendor id is part of every lookup, like the Prisma store)
  async wallet(vendorId: string) { const w = this.wallets.get(vendorId); return w ? { ...w } : null; }
  async lots(vendorId: string) { return [...this.lotsById.values()].filter((l) => l.vendorId === vendorId).map((l) => ({ ...l })); }
  async ledgerPage(vendorId: string, skip: number, take: number) { const all = this.ledger.filter((e) => e.vendorId === vendorId).sort((a, b) => b.entryNo - a.entryNo); return { items: all.slice(skip, skip + take).map((e) => ({ ...e })), total: all.length }; }
  async allLedger(vendorId: string) { return this.ledger.filter((e) => e.vendorId === vendorId).sort((a, b) => a.entryNo - b.entryNo).map((e) => ({ ...e })); }
  async topupsPage(vendorId: string, skip: number, take: number) { const all = [...this.topups.values()].filter((t) => t.vendorId === vendorId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); return { items: all.slice(skip, skip + take).map((t) => ({ ...t })), total: all.length }; }
  async getTopupForVendor(vendorId: string, id: string) { const t = this.topups.get(id); return t && t.vendorId === vendorId ? { ...t } : null; }
  async findTopupByIdempotency(vendorId: string, key: string) { const t = [...this.topups.values()].find((x) => x.vendorId === vendorId && x.idempotencyKey === key); return t ? { ...t } : null; }
  async findTopupByProviderOrder(providerOrderId: string) { const t = [...this.topups.values()].find((x) => x.providerOrderId === providerOrderId); return t ? { ...t } : null; }
  async receiptForTopup(vendorId: string, topupId: string) { const r = this.receipts.find((x) => x.vendorId === vendorId && x.topupId === topupId); return r ? { ...r } : null; }
  async adminWallets(q: { status?: WalletStatus; skip: number; take: number }): Promise<{ items: AdminWalletRow[]; total: number }> {
    const all = [...this.wallets.values()].filter((w) => !q.status || w.status === q.status);
    return { items: all.slice(q.skip, q.skip + q.take).map((w) => ({ ...w, businessName: this.names.get(w.vendorId) ?? w.vendorId })), total: all.length };
  }
  async vendorsWithExpiredLots(now: Date, limit: number) { return [...new Set([...this.lotsById.values()].filter((l) => l.remainingPaise > 0 && l.expiresAt <= now).map((l) => l.vendorId))].slice(0, limit); }
  async paidProEvidence(vendorId: string) { return this.evidence.get(vendorId) ?? null; }
  async expireStaleTopups(now: Date) { let n = 0; for (const t of this.topups.values()) if ((t.status === 'CREATED' || t.status === 'PENDING') && t.expiresAt < now) { t.status = 'EXPIRED'; n++; } return n; }

  /** test helper: what the database trigger would do to an UPDATE or DELETE of a ledger row */
  tamperLedger(id: string, patch: Partial<LedgerRow>): void { throw new Error(`g4d_wallet_ledger rows cannot be changed (${id}, ${Object.keys(patch).join(',')})`); }
  /** test helper: change the cached numbers behind the engine's back (what a bad manual edit would do) */
  tamperWallet(vendorId: string, patch: Partial<WalletRow>): void { Object.assign(this.wallets.get(vendorId)!, patch); }
  newId(): string { return randomUUID(); }
}
