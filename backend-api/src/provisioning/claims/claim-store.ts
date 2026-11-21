import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor } from '../../plans/admin/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface ClaimTokenRow {
  id: string;
  vendorId: string;
  tokenHash: string;
  purpose: 'CLAIM';
  status: 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED';
  expiresAt: Date;
  usedAt: Date | null;
  createdByType: 'STAFF' | 'SYSTEM';
  createdById: string | null;
  activeKey: string | null;
}
export interface IssueArgs { vendorId: string; tokenHash: string; expiresAt: Date; actor: Actor }

/** Storage for claim tokens. Only hashes pass through here. */
export abstract class ClaimStore {
  /** One transaction: revoke the vendor's ACTIVE token (clearing its invites' sandbox bodies), then create the new ACTIVE one. */
  abstract issue(args: IssueArgs): Promise<{ id: string }>;
  abstract findByHash(tokenHash: string): Promise<(ClaimTokenRow & { businessName: string }) | null>;
  /** ACTIVE and not expired -> USED, exactly once (false for the loser of a race, or for any other state). */
  abstract markUsed(id: string, now: Date): Promise<boolean>;
  abstract revokeActive(vendorId: string): Promise<number>;
  abstract markExpired(id: string): Promise<void>;
  abstract hasUsedToken(vendorId: string): Promise<boolean>;
  /** The owner's email and the public business name, for staff "reissue". */
  abstract vendorContact(vendorId: string): Promise<{ email: string; businessName: string } | null>;
}

@Injectable()
export class PrismaClaimStore extends ClaimStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async issue(a: IssueArgs): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      await this.revokeInTx(tx, a.vendorId);
      const row = await tx.v3ClaimToken.create({
        data: {
          vendorId: a.vendorId, tokenHash: a.tokenHash, purpose: 'CLAIM', status: 'ACTIVE', expiresAt: a.expiresAt,
          createdByType: a.actor.type === 'STAFF' ? 'STAFF' : 'SYSTEM', createdById: a.actor.id, activeKey: `${a.vendorId}:CLAIM`,
        },
        select: { id: true },
      });
      return row;
    });
  }

  private async revokeInTx(tx: Prisma.TransactionClient, vendorId: string): Promise<number> {
    const active = await tx.v3ClaimToken.findMany({ where: { vendorId, purpose: 'CLAIM', status: 'ACTIVE' }, select: { id: true } });
    if (active.length === 0) return 0;
    const ids = active.map((t) => t.id);
    await tx.v3ClaimToken.updateMany({ where: { id: { in: ids } }, data: { status: 'REVOKED', activeKey: null } });
    await tx.v3Invite.updateMany({ where: { claimTokenId: { in: ids } }, data: { sandboxBody: null } });
    return ids.length;
  }

  async findByHash(tokenHash: string): Promise<(ClaimTokenRow & { businessName: string }) | null> {
    const r = await this.prisma.v3ClaimToken.findUnique({ where: { tokenHash }, include: { vendor: { select: { businessName: true } } } });
    if (!r) return null;
    const { vendor, ...row } = r;
    return { ...row, purpose: 'CLAIM', status: row.status, createdByType: row.createdByType === 'STAFF' ? 'STAFF' : 'SYSTEM', businessName: vendor.businessName };
  }

  async markUsed(id: string, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.v3ClaimToken.updateMany({ where: { id, status: 'ACTIVE', expiresAt: { gt: now } }, data: { status: 'USED', usedAt: now, activeKey: null } });
      if (r.count !== 1) return false;
      await tx.v3Invite.updateMany({ where: { claimTokenId: id }, data: { sandboxBody: null } });
      return true;
    });
  }

  async revokeActive(vendorId: string): Promise<number> {
    return this.prisma.$transaction((tx) => this.revokeInTx(tx, vendorId));
  }

  async markExpired(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.v3ClaimToken.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'EXPIRED', activeKey: null } });
      await tx.v3Invite.updateMany({ where: { claimTokenId: id }, data: { sandboxBody: null } });
    });
  }

  async hasUsedToken(vendorId: string): Promise<boolean> {
    return (await this.prisma.v3ClaimToken.count({ where: { vendorId, status: 'USED' } })) > 0;
  }

  async vendorContact(vendorId: string): Promise<{ email: string; businessName: string } | null> {
    return this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { email: true, businessName: true } });
  }
}
