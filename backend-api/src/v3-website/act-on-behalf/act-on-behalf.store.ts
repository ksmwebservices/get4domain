import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type EndedBy = 'STAFF' | 'SUPER_ADMIN' | 'AUTO';
export interface SessionRow { id: string; staffId: string; vendorId: string; reason: string; startedAt: Date; expiresAt: Date; endedAt: Date | null; endedBy: EndedBy | null; vendorNotifiedAt: Date | null }
export type NewSession = Pick<SessionRow, 'staffId' | 'vendorId' | 'reason' | 'startedAt' | 'expiresAt'>;

/** Act-on-behalf sessions (slice 5.13b). Prisma below; a memory twin lives in test/support. A staff member has at most one live session (the nullable unique `activeStaffId`). */
export abstract class ActOnBehalfStore {
  abstract vendorExists(vendorId: string): Promise<boolean>;
  /** Creates a live session, or returns null when this staff member already has one. */
  abstract createIfNoneActive(s: NewSession): Promise<SessionRow | null>;
  abstract get(id: string): Promise<SessionRow | null>;
  abstract markNotified(id: string, at: Date): Promise<void>;
  /** Compare and set: closes a live session; null when it was already closed. */
  abstract end(id: string, at: Date, by: EndedBy): Promise<SessionRow | null>;
  abstract listDue(now: Date): Promise<SessionRow[]>;
  abstract list(f: { vendorId?: string; active?: boolean }, skip: number, take: number): Promise<{ items: SessionRow[]; total: number }>;
  abstract listForVendor(vendorId: string, take: number): Promise<SessionRow[]>;
}

type Db = { id: string; staffId: string; vendorId: string; reason: string; startedAt: Date; expiresAt: Date; endedAt: Date | null; endedBy: string | null; vendorNotifiedAt: Date | null };
const map = (r: Db): SessionRow => ({ id: r.id, staffId: r.staffId, vendorId: r.vendorId, reason: r.reason, startedAt: r.startedAt, expiresAt: r.expiresAt, endedAt: r.endedAt, endedBy: r.endedBy as EndedBy | null, vendorNotifiedAt: r.vendorNotifiedAt });

@Injectable()
export class PrismaActOnBehalfStore extends ActOnBehalfStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async vendorExists(vendorId: string) { return (await this.prisma.vendor.count({ where: { id: vendorId } })) > 0; }
  async createIfNoneActive(s: NewSession) {
    try { return map(await this.prisma.v3ActOnBehalfSession.create({ data: { ...s, activeStaffId: s.staffId } })); }
    catch (e) { if ((e as { code?: string }).code === 'P2002') return null; throw e; }
  }
  async get(id: string) { const r = await this.prisma.v3ActOnBehalfSession.findUnique({ where: { id } }); return r ? map(r) : null; }
  async markNotified(id: string, at: Date) { await this.prisma.v3ActOnBehalfSession.updateMany({ where: { id }, data: { vendorNotifiedAt: at } }); }
  async end(id: string, at: Date, by: EndedBy) {
    const done = await this.prisma.v3ActOnBehalfSession.updateMany({ where: { id, endedAt: null }, data: { endedAt: at, endedBy: by, activeStaffId: null } });
    return done.count === 1 ? this.get(id) : null;
  }
  async listDue(now: Date) { return (await this.prisma.v3ActOnBehalfSession.findMany({ where: { endedAt: null, expiresAt: { lte: now } }, take: 500 })).map(map); }
  async list(f: { vendorId?: string; active?: boolean }, skip: number, take: number) {
    const where = { ...(f.vendorId ? { vendorId: f.vendorId } : {}), ...(f.active === undefined ? {} : { endedAt: f.active ? null : { not: null } }) };
    const [items, total] = await Promise.all([this.prisma.v3ActOnBehalfSession.findMany({ where, orderBy: { startedAt: 'desc' }, skip, take }), this.prisma.v3ActOnBehalfSession.count({ where })]);
    return { items: items.map(map), total };
  }
  async listForVendor(vendorId: string, take: number) { return (await this.prisma.v3ActOnBehalfSession.findMany({ where: { vendorId }, orderBy: { startedAt: 'desc' }, take })).map(map); }
}
