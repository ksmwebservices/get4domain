import { BadRequestException, Injectable } from '@nestjs/common';
import { LeadPurseEntry, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;
export type PurseReason = 'REFILL' | 'LEAD_CHARGE' | 'CREDIT_INVALID' | 'REFUND' | 'ADJUSTMENT' | 'EXPIRY';

export interface PurseMove {
  vendorId: string;
  amountPaise: number;
  reason: PurseReason;
  idempotencyKey: string;
  refType?: string;
  refId?: string;
  note?: string;
  razorpayId?: string;
  expiresAt?: Date | null;
  createdBy?: string;
}
export interface PurseResult { ok: boolean; entry: LeadPurseEntry | null; replayed: boolean; balancePaise: number }

/**
 * The LEADS purse: closed-loop money that can only be spent on Get4Domain services. A pair of tables (balance + append-only ledger) kept beside
 * the existing AI wallet, which is untouched. Every ledger row carries the running balance and a unique idempotency key.
 * A debit is a conditional UPDATE (`balance >= amount`), so two events racing for the last rupees cannot both succeed.
 */
@Injectable()
export class LeadPurseService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensure(db: Tx | PrismaService, vendorId: string): Promise<void> {
    await db.leadPurse.upsert({ where: { vendorId_kind: { vendorId, kind: 'LEADS' } }, create: { vendorId, kind: 'LEADS' }, update: {} });
  }

  async balance(vendorId: string, db: Tx | PrismaService = this.prisma): Promise<number> {
    return (await db.leadPurse.findUnique({ where: { vendorId_kind: { vendorId, kind: 'LEADS' } } }))?.balancePaise ?? 0;
  }

  /** Add money. Replays of the same idempotency key return the first entry and change nothing. */
  async credit(tx: Tx, m: PurseMove): Promise<PurseResult> {
    if (!Number.isInteger(m.amountPaise) || m.amountPaise <= 0) throw new BadRequestException('The amount must be a positive whole number of paise.');
    const seen = await tx.leadPurseEntry.findUnique({ where: { idempotencyKey: m.idempotencyKey } });
    if (seen) return { ok: true, entry: seen, replayed: true, balancePaise: seen.balanceAfter };
    await this.ensure(tx, m.vendorId);
    const purse = await tx.leadPurse.update({ where: { vendorId_kind: { vendorId: m.vendorId, kind: 'LEADS' } }, data: { balancePaise: { increment: m.amountPaise }, totalCredited: { increment: m.amountPaise } } });
    const entry = await tx.leadPurseEntry.create({
      data: { purseId: purse.id, vendorId: m.vendorId, type: 'CREDIT', amountPaise: m.amountPaise, balanceAfter: purse.balancePaise, reason: m.reason, refType: m.refType ?? null, refId: m.refId ?? null, note: m.note ?? null, idempotencyKey: m.idempotencyKey, razorpayId: m.razorpayId ?? null, expiresAt: m.expiresAt ?? null, createdBy: m.createdBy ?? null },
    });
    return { ok: true, entry, replayed: false, balancePaise: purse.balancePaise };
  }

  /** Take money only if there is enough. `ok:false` means the balance was too low and nothing changed. */
  async debit(tx: Tx, m: PurseMove): Promise<PurseResult> {
    if (!Number.isInteger(m.amountPaise) || m.amountPaise <= 0) throw new BadRequestException('The amount must be a positive whole number of paise.');
    const seen = await tx.leadPurseEntry.findUnique({ where: { idempotencyKey: m.idempotencyKey } });
    if (seen) return { ok: true, entry: seen, replayed: true, balancePaise: seen.balanceAfter };
    await this.ensure(tx, m.vendorId);
    const done = await tx.leadPurse.updateMany({ where: { vendorId: m.vendorId, kind: 'LEADS', balancePaise: { gte: m.amountPaise } }, data: { balancePaise: { decrement: m.amountPaise }, totalDebited: { increment: m.amountPaise } } });
    if (done.count === 0) return { ok: false, entry: null, replayed: false, balancePaise: await this.balance(m.vendorId, tx) };
    const purse = await tx.leadPurse.findUniqueOrThrow({ where: { vendorId_kind: { vendorId: m.vendorId, kind: 'LEADS' } } });
    const entry = await tx.leadPurseEntry.create({
      data: { purseId: purse.id, vendorId: m.vendorId, type: 'DEBIT', amountPaise: m.amountPaise, balanceAfter: purse.balancePaise, reason: m.reason, refType: m.refType ?? null, refId: m.refId ?? null, note: m.note ?? null, idempotencyKey: m.idempotencyKey, createdBy: m.createdBy ?? null },
    });
    return { ok: true, entry, replayed: false, balancePaise: purse.balancePaise };
  }

  ledger(vendorId: string, take = 100, skip = 0): Promise<LeadPurseEntry[]> {
    return this.prisma.leadPurseEntry.findMany({ where: { vendorId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: Math.min(take, 300), skip });
  }
}
