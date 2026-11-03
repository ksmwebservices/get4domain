import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface NewInvite {
  vendorId: string;
  channel: 'EMAIL';
  toAddress: string;
  claimTokenId: string;
  adapterMode: 'SANDBOX' | 'LIVE';
  subject: string;
  bodyPreview: string;
  /** the full message, ONLY for a sandbox invite */
  sandboxBody: string | null;
}
export interface InviteRow extends NewInvite {
  id: string;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'BOUNCED';
  providerMessageId: string | null;
  sentAt: Date | null;
  createdAt: Date;
}
export interface InviteListFilter { skip: number; take: number; vendorId?: string }

export abstract class InviteStore {
  abstract findByToken(claimTokenId: string): Promise<InviteRow | null>;
  abstract create(data: NewInvite): Promise<InviteRow>;
  abstract markSent(id: string, providerMessageId: string | null, now: Date): Promise<void>;
  abstract markFailed(id: string): Promise<void>;
  abstract list(filter: InviteListFilter): Promise<{ items: InviteRow[]; total: number }>;
}

const toRow = (r: Prisma.V3InviteGetPayload<object>): InviteRow => ({ ...r, channel: 'EMAIL', adapterMode: r.adapterMode, status: r.status });

@Injectable()
export class PrismaInviteStore extends InviteStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async findByToken(claimTokenId: string): Promise<InviteRow | null> {
    const r = await this.prisma.v3Invite.findFirst({ where: { claimTokenId }, orderBy: { createdAt: 'desc' } });
    return r ? toRow(r) : null;
  }
  async create(d: NewInvite): Promise<InviteRow> {
    return toRow(await this.prisma.v3Invite.create({ data: { ...d, status: 'QUEUED' } }));
  }
  async markSent(id: string, providerMessageId: string | null, now: Date): Promise<void> {
    await this.prisma.v3Invite.update({ where: { id }, data: { status: 'SENT', providerMessageId, sentAt: now } });
  }
  async markFailed(id: string): Promise<void> {
    await this.prisma.v3Invite.update({ where: { id }, data: { status: 'FAILED' } });
  }
  async list(f: InviteListFilter): Promise<{ items: InviteRow[]; total: number }> {
    const where: Prisma.V3InviteWhereInput = f.vendorId ? { vendorId: f.vendorId } : {};
    const [rows, total] = await Promise.all([
      this.prisma.v3Invite.findMany({ where, orderBy: { createdAt: 'desc' }, skip: f.skip, take: f.take }),
      this.prisma.v3Invite.count({ where }),
    ]);
    return { items: rows.map(toRow), total };
  }
}
