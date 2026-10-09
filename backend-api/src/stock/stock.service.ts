import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovement, StockMovementReason } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdjustMode, AdjustReason, normaliseStatus, reasonAllowsMode, validateAdjustQuantity } from './stock-rules';

type Tx = Prisma.TransactionClient;

export interface OrderLine { productId: string; qty: number }
export interface OrderRef { type: string; id: string }

/** One tracked product whose stock moved — used to raise low-stock notifications after the transaction commits. */
export interface StockChange { productId: string; name: string; before: number; after: number; reorderLevel: number | null }

export interface AdjustInput {
  mode: AdjustMode;
  quantity: number;
  reason: AdjustReason;
  note?: string;
  /** Client-supplied key: sending the same key twice applies the change once. */
  idempotencyKey?: string;
}

/** A stock movement written by a manual change (adjust / opening). Listeners run INSIDE the same transaction (the BOS posts its journal from here). */
export type MoveListener = (tx: Tx, event: { vendorId: string; productId: string; movement: StockMovement }) => Promise<void>;

export const SELLABLE_ERROR = 'One or more items are no longer available.';

/**
 * Every stock change on a VendorProduct goes through here, and every change writes its StockMovement in the SAME
 * transaction as the quantity update, with a correct balanceAfter. Decrements are conditional UPDATEs
 * (`… WHERE stockQty >= qty`) so two simultaneous orders can never take stock below zero.
 */
@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  private readonly listeners: MoveListener[] = [];

  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  /** Register something that must happen in the same transaction as every manual stock change (the BOS journal). */
  registerMoveListener(fn: MoveListener): void { this.listeners.push(fn); }

  private async emit(tx: Tx, vendorId: string, productId: string, movement: StockMovement): Promise<void> {
    for (const fn of this.listeners) await fn(tx, { vendorId, productId, movement });
  }

  // ── Order paths (called inside the caller's transaction) ─────────────────────────────────────────

  /**
   * Reserve stock for an order: all-or-nothing across lines (the caller's transaction rolls back if any line fails).
   * Untracked products pass through without a movement. Lines for the same product are merged first, and products are
   * locked in id order so two orders cannot deadlock each other.
   */
  async reserve(tx: Tx, vendorId: string, lines: OrderLine[], ref: OrderRef, idemPrefix: string, reason: StockMovementReason = 'ONLINE_ORDER', createdBy?: string): Promise<StockChange[]> {
    const merged = this.merge(lines);
    const changes: StockChange[] = [];
    for (const [productId, qty] of merged) {
      const prod = await tx.vendorProduct.findFirst({
        where: { id: productId, vendorId },
        select: { id: true, name: true, active: true, status: true, trackStock: true, stockQty: true, reorderLevel: true },
      });
      if (!prod) throw new BadRequestException(SELLABLE_ERROR);
      const status = normaliseStatus(prod.status, prod.active);
      if (status === 'HIDDEN') throw new BadRequestException(SELLABLE_ERROR);
      if (status === 'OUT_OF_STOCK') throw new BadRequestException(`"${prod.name}" is out of stock.`);
      if (!prod.trackStock) continue;

      const done = await tx.vendorProduct.updateMany({
        where: { id: productId, vendorId, trackStock: true, stockQty: { gte: qty } },
        data: { stockQty: { decrement: qty } },
      });
      if (done.count === 0) {
        const left = Math.max(0, prod.stockQty ?? 0);
        throw new BadRequestException(left > 0 ? `"${prod.name}": only ${left} left.` : `"${prod.name}" is out of stock.`);
      }
      const after = (await tx.vendorProduct.findUniqueOrThrow({ where: { id: productId }, select: { stockQty: true } })).stockQty ?? 0;
      await tx.stockMovement.create({
        data: { vendorId, productId, delta: -qty, reason, refType: ref.type, refId: ref.id, balanceAfter: after, createdBy: createdBy ?? null, idempotencyKey: `${idemPrefix}:${productId}` },
      });
      changes.push({ productId, name: prod.name, before: after + qty, after, reorderLevel: prod.reorderLevel });
    }
    return changes;
  }

  /** Put stock back (order cancelled / failed). Idempotent per (prefix, product): a second call changes nothing. */
  async restore(tx: Tx, vendorId: string, lines: OrderLine[], ref: OrderRef, idemPrefix: string, reason: StockMovementReason = 'CANCEL', createdBy?: string): Promise<void> {
    for (const [productId, qty] of this.merge(lines)) {
      const key = `${idemPrefix}:${productId}`;
      if (await tx.stockMovement.findUnique({ where: { idempotencyKey: key }, select: { id: true } })) continue;
      const done = await tx.vendorProduct.updateMany({ where: { id: productId, vendorId }, data: { stockQty: { increment: qty } } });
      if (done.count === 0) continue; // product was deleted since — nothing to restore
      const after = (await tx.vendorProduct.findUniqueOrThrow({ where: { id: productId }, select: { stockQty: true } })).stockQty ?? 0;
      await tx.stockMovement.create({
        data: { vendorId, productId, delta: qty, reason, refType: ref.type, refId: ref.id, balanceAfter: after, createdBy: createdBy ?? null, idempotencyKey: key },
      });
    }
  }

  // ── Manual changes ───────────────────────────────────────────────────────────────────────────────

  /** Opening stock when tracking is switched on (or a tracked product is created) — runs in the caller's transaction. */
  async setOpening(tx: Tx, vendorId: string, productId: string, quantity: number, createdBy?: string): Promise<void> {
    const err = validateAdjustQuantity('set', quantity);
    if (err) throw new BadRequestException(err);
    const cur = await tx.vendorProduct.findFirst({ where: { id: productId, vendorId }, select: { stockQty: true } });
    if (!cur) throw new NotFoundException('Product not found');
    const before = cur.stockQty ?? 0;
    await tx.vendorProduct.update({ where: { id: productId }, data: { stockQty: quantity, trackStock: true } });
    const opening = await tx.stockMovement.create({
      data: { vendorId, productId, delta: quantity - before, reason: 'OPENING', refType: 'PRODUCT', refId: productId, note: 'Opening stock', balanceAfter: quantity, createdBy: createdBy ?? null, idempotencyKey: `open:${productId}:${randomUUID()}` },
    });
    await this.emit(tx, vendorId, productId, opening);
  }

  /** Add, remove or set a counted quantity. Never below 0. */
  async adjust(vendorId: string, productId: string, input: AdjustInput, createdBy?: string): Promise<{ stockQty: number; movement: StockMovement; replayed: boolean }> {
    const qErr = validateAdjustQuantity(input.mode, input.quantity);
    if (qErr) throw new BadRequestException(qErr);
    if (!reasonAllowsMode(input.reason, input.mode)) throw new BadRequestException(`"${input.reason}" cannot be used to ${input.mode} stock`);
    const key = input.idempotencyKey ? `adj:${productId}:${input.idempotencyKey}` : `adj:${productId}:${randomUUID()}`;

    const run = () => this.prisma.$transaction(async (tx) => {
      const replay = await tx.stockMovement.findUnique({ where: { idempotencyKey: key } });
      if (replay) return { stockQty: replay.balanceAfter, movement: replay, replayed: true, change: null as StockChange | null };

      const prod = await tx.vendorProduct.findFirst({ where: { id: productId, vendorId }, select: { id: true, name: true, trackStock: true, stockQty: true, reorderLevel: true } });
      if (!prod) throw new NotFoundException('Product not found');
      if (!prod.trackStock) throw new BadRequestException('Turn on "track stock" for this product first.');

      let before = prod.stockQty ?? 0;
      let after: number;
      if (input.mode === 'add') {
        await tx.vendorProduct.updateMany({ where: { id: productId, vendorId }, data: { stockQty: { increment: input.quantity } } });
        after = (await tx.vendorProduct.findUniqueOrThrow({ where: { id: productId }, select: { stockQty: true } })).stockQty ?? 0;
        before = after - input.quantity;
      } else if (input.mode === 'remove') {
        const done = await tx.vendorProduct.updateMany({ where: { id: productId, vendorId, trackStock: true, stockQty: { gte: input.quantity } }, data: { stockQty: { decrement: input.quantity } } });
        if (done.count === 0) throw new BadRequestException(`Cannot remove ${input.quantity}: only ${Math.max(0, prod.stockQty ?? 0)} in stock (stock cannot go below 0).`);
        after = (await tx.vendorProduct.findUniqueOrThrow({ where: { id: productId }, select: { stockQty: true } })).stockQty ?? 0;
        before = after + input.quantity;
      } else {
        // set: compare-and-set against the quantity we read, retrying if another change slipped in between
        let applied = false;
        after = input.quantity;
        for (let attempt = 0; attempt < 5 && !applied; attempt += 1) {
          const current = (await tx.vendorProduct.findUniqueOrThrow({ where: { id: productId }, select: { stockQty: true } })).stockQty ?? 0;
          const done = await tx.vendorProduct.updateMany({ where: { id: productId, vendorId, stockQty: current }, data: { stockQty: input.quantity } });
          if (done.count === 1) { before = current; applied = true; }
        }
        if (!applied) throw new ConflictException('Stock changed while you were counting — please try again.');
      }
      const movement = await tx.stockMovement.create({
        data: {
          vendorId, productId, delta: after - before, reason: input.reason, refType: 'ADJUSTMENT', refId: productId,
          note: input.note?.trim().slice(0, 300) || null, balanceAfter: after, createdBy: createdBy ?? null, idempotencyKey: key,
        },
      });
      await this.emit(tx, vendorId, productId, movement);
      return { stockQty: after, movement, replayed: false, change: { productId, name: prod.name, before, after, reorderLevel: prod.reorderLevel } as StockChange | null };
    });

    let out;
    try { out = await run(); } catch (e) {
      // two identical keys racing: the loser's whole transaction rolled back — report the winner's result
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.stockMovement.findUnique({ where: { idempotencyKey: key } });
        if (existing) return { stockQty: existing.balanceAfter, movement: existing, replayed: true };
      }
      throw e;
    }
    if (out.change) await this.notifyLow(vendorId, [out.change]);
    return { stockQty: out.stockQty, movement: out.movement, replayed: out.replayed };
  }

  // ── Reads ────────────────────────────────────────────────────────────────────────────────────────

  async history(vendorId: string, productId: string, take = 50): Promise<StockMovement[]> {
    return this.prisma.stockMovement.findMany({ where: { vendorId, productId }, orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(take, 1), 200) });
  }

  /** Tracked products at or below their low-stock level (level must be set). */
  async lowStock(vendorId: string) {
    const rows = await this.prisma.vendorProduct.findMany({
      where: { vendorId, trackStock: true, reorderLevel: { not: null } },
      select: { id: true, name: true, image: true, stockQty: true, reorderLevel: true, status: true, active: true },
      orderBy: { name: 'asc' },
    });
    return rows.filter((r) => (r.stockQty ?? 0) <= (r.reorderLevel ?? 0));
  }

  // ── Notifications (after commit, best effort) ────────────────────────────────────────────────────

  /** Raise "low stock" / "out of stock" notifications for tracked products that just crossed their level. */
  async notifyLow(vendorId: string, changes: StockChange[]): Promise<void> {
    for (const c of changes) {
      try {
        const crossedOut = c.after <= 0 && c.before > 0;
        const crossedLow = c.reorderLevel != null && c.reorderLevel > 0 && c.after <= c.reorderLevel && c.before > c.reorderLevel;
        if (!crossedOut && !crossedLow) continue;
        await this.notifications.notifyVendor(
          vendorId, 'LOW_STOCK', crossedOut ? `Out of stock: ${c.name}` : `Low stock: ${c.name}`,
          crossedOut ? `${c.name} has run out. Add stock in My Products ▸ Stock.` : `Only ${c.after} of ${c.name} left (alert level ${c.reorderLevel}).`,
          { priority: crossedOut ? 'WARNING' : 'INFO', data: { productId: c.productId, stockQty: c.after } },
        );
      } catch (e) {
        this.logger.warn(`Low-stock notification failed for ${c.productId}: ${e instanceof Error ? e.message : 'error'}`);
      }
    }
  }

  /** Owner of a product (for admin-initiated changes and ownership checks). */
  async ownerOf(productId: string): Promise<string> {
    const p = await this.prisma.vendorProduct.findUnique({ where: { id: productId }, select: { vendorId: true } });
    if (!p) throw new NotFoundException('Product not found');
    return p.vendorId;
  }

  private merge(lines: OrderLine[]): [string, number][] {
    const m = new Map<string, number>();
    for (const l of lines) {
      if (!l.productId || !Number.isInteger(l.qty) || l.qty < 1) throw new BadRequestException('Invalid quantity');
      m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
    }
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }
}
