import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeModules } from '../team/team-access';
import { PromoKind } from './core/gaps-core';
import { MigrationRequestRow, PromoDraftRow, TeamRow, VendorGapsStore, Who } from './vendor-gaps.store';

const mig = (r: { id: string; vendorId: string; siteUrl: string; status: string; createdAt: Date; updatedAt: Date }): MigrationRequestRow => ({ id: r.id, vendorId: r.vendorId, siteUrl: r.siteUrl, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt });
const draft = (r: { id: string; vendorId: string; kind: string; channel: string; title: string; body: string; status: string; createdAt: Date; updatedAt: Date; archivedAt: Date | null }): PromoDraftRow => ({ ...r, kind: r.kind as PromoKind });
const team = (r: { id: string; vendorId: string; name: string; role: string; department: string | null; status: string; modules: unknown; createdAt: Date; lastLogin: Date | null }): TeamRow => ({
  id: r.id, vendorId: r.vendorId, name: r.name, role: r.role, department: r.department, status: r.status, areas: normalizeModules(r.modules), createdAt: r.createdAt, lastLogin: r.lastLogin,
});
const SHOWN = ['invited', 'active', 'deactivated'];

@Injectable()
export class PrismaVendorGapsStore extends VendorGapsStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async listMigrationRequests(vendorId: string): Promise<MigrationRequestRow[]> {
    return (await this.prisma.v3MigrationRequest.findMany({ where: { vendorId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50 })).map(mig);
  }
  async openMigrationRequest(vendorId: string, siteUrl: string, by: Who): Promise<MigrationRequestRow | null> {
    try { return mig(await this.prisma.v3MigrationRequest.create({ data: { vendorId, openVendorId: vendorId, siteUrl, createdByType: by.type, createdById: by.id } })); }
    catch (e) { if ((e as { code?: string }).code === 'P2002') return null; throw e; }
  }

  async listPromoDrafts(vendorId: string, kind: PromoKind, includeArchived: boolean, skip: number, take: number): Promise<{ items: PromoDraftRow[]; total: number }> {
    const where: Prisma.V3PromoDraftWhereInput = { vendorId, kind, ...(includeArchived ? {} : { status: 'DRAFT' }) };
    const [items, total] = await Promise.all([this.prisma.v3PromoDraft.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }), this.prisma.v3PromoDraft.count({ where })]);
    return { items: items.map(draft), total };
  }
  async createPromoDraft(vendorId: string, kind: PromoKind, row: { channel: string; title: string; body: string }, by: Who): Promise<PromoDraftRow> {
    return draft(await this.prisma.v3PromoDraft.create({ data: { vendorId, kind, channel: row.channel, title: row.title, body: row.body, createdByType: by.type, createdById: by.id } }));
  }
  async archivePromoDraft(vendorId: string, kind: PromoKind, id: string): Promise<PromoDraftRow | null> {
    const done = await this.prisma.v3PromoDraft.updateMany({ where: { id, vendorId, kind }, data: { status: 'ARCHIVED', archivedAt: new Date() } });
    if (done.count !== 1) return null;
    const r = await this.prisma.v3PromoDraft.findFirst({ where: { id, vendorId, kind } });
    return r ? draft(r) : null;
  }

  async listTeam(vendorId: string): Promise<TeamRow[]> {
    return (await this.prisma.teamMember.findMany({ where: { vendorId, status: { in: SHOWN } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 200 })).map(team);
  }
  async getTeamMember(vendorId: string, id: string): Promise<TeamRow | null> {
    const r = await this.prisma.teamMember.findFirst({ where: { id, vendorId, status: { in: SHOWN } } });
    return r ? team(r) : null;
  }
  async createTeamInvite(vendorId: string, row: { name: string; email: string | null; phone: string | null; role: string; department: string | null; areas: string[] }): Promise<TeamRow | null> {
    if (row.email && (await this.prisma.teamMember.count({ where: { vendorId, email: row.email, status: { in: SHOWN } } })) > 0) return null;
    // A record only: the member is stored as invited with a one-time token. Nothing is sent from here.
    return team(await this.prisma.teamMember.create({ data: { vendorId, name: row.name, email: row.email, phone: row.phone, role: row.role, department: row.department, modules: row.areas as Prisma.InputJsonValue, status: 'invited', inviteToken: randomBytes(24).toString('hex') } }));
  }
  async updateTeamMember(vendorId: string, id: string, patch: { role?: string; department?: string | null; areas?: string[] }): Promise<TeamRow | null> {
    const done = await this.prisma.teamMember.updateMany({
      where: { id, vendorId, status: { in: SHOWN } },
      data: { ...(patch.role !== undefined ? { role: patch.role } : {}), ...(patch.department !== undefined ? { department: patch.department } : {}), ...(patch.areas !== undefined ? { modules: patch.areas as Prisma.InputJsonValue } : {}) },
    });
    return done.count === 1 ? this.getTeamMember(vendorId, id) : null;
  }
  async setTeamStatus(vendorId: string, id: string, status: 'deactivated' | 'active'): Promise<TeamRow | null> {
    // reactivating only restores a member who had signed in before (a password exists); an invited member who never accepted stays invited
    const row = await this.prisma.teamMember.findFirst({ where: { id, vendorId, status: { in: SHOWN } }, select: { password: true, status: true } });
    if (!row) return null;
    const next = status === 'active' && !row.password ? 'invited' : status;
    await this.prisma.teamMember.updateMany({ where: { id, vendorId }, data: { status: next } });
    return this.getTeamMember(vendorId, id);
  }

}
