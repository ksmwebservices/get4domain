import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerFields, PartnerStatus, PartnerType } from './core/partner-core';
import { PartnerRow, PartnersStore, StaffMemberRef } from './partners.store';

type Row = { id: string; type: string; name: string; email: string; phone: string | null; status: string; staffUserId: string | null; pan: string | null; createdById: string | null; createdAt: Date; updatedAt: Date };
const toRow = (r: Row): PartnerRow => ({ id: r.id, type: r.type as PartnerType, name: r.name, email: r.email, phone: r.phone, status: r.status as PartnerStatus, staffUserId: r.staffUserId, pan: r.pan, createdById: r.createdById, createdAt: r.createdAt, updatedAt: r.updatedAt });

@Injectable()
export class PrismaPartnersStore extends PartnersStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async list(i: { status?: string; type?: string; skip: number; take: number }): Promise<{ items: PartnerRow[]; total: number }> {
    const where = { ...(i.status ? { status: i.status } : {}), ...(i.type ? { type: i.type } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.referralPartner.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: i.skip, take: i.take }),
      this.prisma.referralPartner.count({ where }),
    ]);
    return { items: rows.map(toRow), total };
  }
  async get(id: string): Promise<PartnerRow | null> { const r = await this.prisma.referralPartner.findUnique({ where: { id } }); return r ? toRow(r) : null; }
  async getByStaffUser(staffUserId: string): Promise<PartnerRow | null> { const r = await this.prisma.referralPartner.findUnique({ where: { staffUserId } }); return r ? toRow(r) : null; }
  async getByEmail(email: string): Promise<PartnerRow | null> { const r = await this.prisma.referralPartner.findUnique({ where: { email } }); return r ? toRow(r) : null; }
  async create(f: PartnerFields, createdById: string | null): Promise<PartnerRow> { return toRow(await this.prisma.referralPartner.create({ data: { ...f, createdById } })); }
  async update(id: string, patch: Partial<PartnerFields>): Promise<PartnerRow | null> {
    try { return toRow(await this.prisma.referralPartner.update({ where: { id }, data: patch })); } catch (e) { if ((e as { code?: string }).code === 'P2025') return null; throw e; }
  }
  async staffMember(id: string): Promise<StaffMemberRef | null> {
    const m = await this.prisma.adminTeamMember.findUnique({ where: { id }, select: { id: true, role: true, email: true, status: true } });
    return m ? { id: m.id, role: String(m.role), email: m.email, status: m.status } : null;
  }
}
