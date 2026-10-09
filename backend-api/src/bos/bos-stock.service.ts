import { BadRequestException, Injectable } from '@nestjs/common';
import { StockMovementReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Db, Tx } from './core.services';

export interface MoveLine { productId: string; qty: number; variantKey?: string | null; locationId?: string | null }
export type NegativePolicy = 'BLOCK' | 'WARN' | 'ALLOW';
export interface MoveRef { type: string; id: string }
export interface MoveResult {
  /** Purchase cost per unit in paise for each product (null when the item is not stock-tracked or has no cost price). */
  unitCostPaise: Map<string, number | null>;
  /** Product ids that really moved stock (tracked items). */
  moved: Set<string>;
  warnings: string[];
}

export const costPaiseOf = (purchasePriceAmount: number | null | undefined): number | null => (purchasePriceAmount == null ? null : Math.round(purchasePriceAmount * 100));

const key = (l: MoveLine): string => `${l.productId}|${l.variantKey ?? ''}|${l.locationId ?? ''}`;

/**
 * Stock movements for business documents (sales, returns, purchases, transfers). The ledger (StockMovement) is the source of truth: every
 * change writes its movement in the SAME transaction as the quantity change, with a correct balanceAfter. Under the BLOCK policy a sale is a
 * conditional UPDATE (`stockQty >= qty`), so two simultaneous sales of the last unit cannot both succeed.
 * Variants (size/colour) and locations are carried on the movement; their on-hand is the sum of their movements.
 */
@Injectable()
export class BosStockService {
  constructor(private readonly prisma: PrismaService) {}

  private merge(lines: MoveLine[]): MoveLine[] {
    const m = new Map<string, MoveLine>();
    for (const l of lines) {
      if (!l.productId) continue;
      if (!(l.qty > 0)) throw new BadRequestException('Quantity must be more than zero.');
      const k = key(l);
      const prev = m.get(k);
      m.set(k, prev ? { ...prev, qty: prev.qty + l.qty } : { ...l });
    }
    // fixed order, so two documents can never lock the same products in opposite orders
    return [...m.values()].sort((a, b) => key(a).localeCompare(key(b)));
  }

  /** The vendor's default location (created on first use). Movements with no location belong to it. */
  async defaultLocationId(db: Db, vendorId: string): Promise<string> {
    const found = await db.bosStockLocation.findFirst({ where: { vendorId, isDefault: true }, select: { id: true } });
    if (found) return found.id;
    await db.bosStockLocation.createMany({ data: [{ vendorId, name: 'Main', isDefault: true }], skipDuplicates: true });
    return (await db.bosStockLocation.findFirstOrThrow({ where: { vendorId, isDefault: true }, select: { id: true } })).id;
  }

  /** Sum of movements for a product, optionally for one variant or one location (the default location also counts movements with no location). */
  async onHand(db: Db, vendorId: string, productId: string, where: { variantKey?: string | null; locationId?: string | null } = {}): Promise<number> {
    let locationFilter: object = {};
    if (where.locationId) {
      const def = await this.defaultLocationId(db, vendorId);
      locationFilter = where.locationId === def ? { OR: [{ locationId: def }, { locationId: null }] } : { locationId: where.locationId };
    }
    const r = await db.stockMovement.aggregate({ where: { vendorId, productId, ...(where.variantKey !== undefined ? { variantKey: where.variantKey } : {}), ...locationFilter }, _sum: { delta: true } });
    return r._sum.delta ?? 0;
  }

  /** Take stock out for a sale. All lines or none (the caller's transaction rolls back if one is refused). */
  async sale(tx: Tx, vendorId: string, lines: MoveLine[], ref: MoveRef, idemPrefix: string, policy: NegativePolicy, createdBy?: string, reason: StockMovementReason = 'SHOP_SALE'): Promise<MoveResult> {
    const out: MoveResult = { unitCostPaise: new Map(), moved: new Set(), warnings: [] };
    for (const l of this.merge(lines)) {
      const prod = await tx.vendorProduct.findFirst({ where: { id: l.productId, vendorId }, select: { id: true, name: true, trackStock: true, stockQty: true, reorderLevel: true, purchasePriceAmount: true } });
      if (!prod) throw new BadRequestException('One of the items on this bill no longer exists.');
      out.unitCostPaise.set(prod.id, prod.trackStock ? costPaiseOf(prod.purchasePriceAmount) : null);
      if (!prod.trackStock) continue;
      if (!Number.isInteger(l.qty)) throw new BadRequestException(`"${prod.name}" is counted in whole units; enter a whole quantity.`);
      const idem = `${idemPrefix}:${key(l)}`;
      if (await tx.stockMovement.findUnique({ where: { idempotencyKey: idem }, select: { id: true } })) { out.moved.add(prod.id); continue; }

      if (policy === 'BLOCK') {
        const done = await tx.vendorProduct.updateMany({ where: { id: prod.id, vendorId, trackStock: true, stockQty: { gte: l.qty } }, data: { stockQty: { decrement: l.qty } } });
        if (done.count === 0) {
          const left = Math.max(0, prod.stockQty ?? 0);
          throw new BadRequestException(left > 0 ? `"${prod.name}": only ${left} left. Reduce the quantity, or change your stock setting to warn instead of block.` : `"${prod.name}" is out of stock. Add stock first, or change your stock setting to warn instead of block.`);
        }
        if (l.variantKey) {
          const hasVariants = (await tx.stockMovement.count({ where: { vendorId, productId: prod.id, variantKey: { not: null } } })) > 0;
          const vLeft = await this.onHand(tx, vendorId, prod.id, { variantKey: l.variantKey });
          if (hasVariants && vLeft < l.qty) throw new BadRequestException(`"${prod.name}" (${l.variantKey}): only ${Math.max(0, vLeft)} left.`);
        }
        if (l.locationId) {
          const lLeft = await this.onHand(tx, vendorId, prod.id, { locationId: l.locationId });
          if (lLeft < l.qty) throw new BadRequestException(`"${prod.name}": only ${Math.max(0, lLeft)} at that location.`);
        }
      } else {
        await tx.vendorProduct.updateMany({ where: { id: prod.id, vendorId, trackStock: true }, data: { stockQty: { decrement: l.qty } } });
      }
      const after = (await tx.vendorProduct.findUniqueOrThrow({ where: { id: prod.id }, select: { stockQty: true } })).stockQty ?? 0;
      if (policy === 'WARN' && after < 0) out.warnings.push(`"${prod.name}" is now below zero (${after}). Check your stock count.`);
      await tx.stockMovement.create({ data: { vendorId, productId: prod.id, delta: -l.qty, reason, refType: ref.type, refId: ref.id, balanceAfter: after, createdBy: createdBy ?? null, idempotencyKey: idem, variantKey: l.variantKey ?? null, locationId: l.locationId ?? null } });
      out.moved.add(prod.id);
    }
    return out;
  }

  /** Put stock in: a sale return/cancellation, or goods received on a purchase bill. Idempotent per line. */
  async add(tx: Tx, vendorId: string, lines: MoveLine[], ref: MoveRef, idemPrefix: string, reason: StockMovementReason, createdBy?: string): Promise<MoveResult> {
    const out: MoveResult = { unitCostPaise: new Map(), moved: new Set(), warnings: [] };
    for (const l of this.merge(lines)) {
      const prod = await tx.vendorProduct.findFirst({ where: { id: l.productId, vendorId }, select: { id: true, name: true, trackStock: true, purchasePriceAmount: true } });
      if (!prod) continue;
      out.unitCostPaise.set(prod.id, prod.trackStock ? costPaiseOf(prod.purchasePriceAmount) : null);
      if (!prod.trackStock) continue;
      if (!Number.isInteger(l.qty)) throw new BadRequestException(`"${prod.name}" is counted in whole units; enter a whole quantity.`);
      const idem = `${idemPrefix}:${key(l)}`;
      if (await tx.stockMovement.findUnique({ where: { idempotencyKey: idem }, select: { id: true } })) { out.moved.add(prod.id); continue; }
      await tx.vendorProduct.updateMany({ where: { id: prod.id, vendorId }, data: { stockQty: { increment: l.qty } } });
      const after = (await tx.vendorProduct.findUniqueOrThrow({ where: { id: prod.id }, select: { stockQty: true } })).stockQty ?? 0;
      await tx.stockMovement.create({ data: { vendorId, productId: prod.id, delta: l.qty, reason, refType: ref.type, refId: ref.id, balanceAfter: after, createdBy: createdBy ?? null, idempotencyKey: idem, variantKey: l.variantKey ?? null, locationId: l.locationId ?? null } });
      out.moved.add(prod.id);
    }
    return out;
  }

  /** Move units between two locations: two movements, the product total does not change. */
  async transfer(tx: Tx, vendorId: string, input: { productId: string; qty: number; fromLocationId: string; toLocationId: string; variantKey?: string | null }, ref: MoveRef, idemPrefix: string, createdBy?: string): Promise<void> {
    if (input.fromLocationId === input.toLocationId) throw new BadRequestException('Choose two different locations.');
    if (!(input.qty > 0) || !Number.isInteger(input.qty)) throw new BadRequestException('Enter a whole quantity to move.');
    const prod = await tx.vendorProduct.findFirst({ where: { id: input.productId, vendorId }, select: { id: true, name: true, trackStock: true, stockQty: true } });
    if (!prod || !prod.trackStock) throw new BadRequestException('Only items that track stock can be moved between locations.');
    const here = await this.onHand(tx, vendorId, prod.id, { locationId: input.fromLocationId });
    if (here < input.qty) throw new BadRequestException(`"${prod.name}": only ${Math.max(0, here)} at that location.`);
    const total = prod.stockQty ?? 0;
    const base = { vendorId, productId: prod.id, reason: 'TRANSFER' as const, refType: ref.type, refId: ref.id, balanceAfter: total, createdBy: createdBy ?? null, variantKey: input.variantKey ?? null };
    await tx.stockMovement.create({ data: { ...base, delta: -input.qty, locationId: input.fromLocationId, idempotencyKey: `${idemPrefix}:out` } });
    await tx.stockMovement.create({ data: { ...base, delta: input.qty, locationId: input.toLocationId, idempotencyKey: `${idemPrefix}:in` } });
  }
}
