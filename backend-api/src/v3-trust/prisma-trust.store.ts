import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BlockKind, ProofKind, ProofStatus, ReportStatus, ReportSubject } from './core/trust-core';
import { BlockRow, CreateTakedownResult, Paged, ProofRow, ReportRow, TakedownRow, TermRow, TrustStore } from './trust.store';

const isUnique = (e: unknown): boolean => (e as { code?: string })?.code === 'P2002';

@Injectable()
export class PrismaTrustStore extends TrustStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  // proofs
  async upsertProof(vendorId: string, d: { kind: ProofKind; number: string; documentRef: string | null }): Promise<ProofRow> {
    return (await this.prisma.v3BusinessProof.upsert({
      where: { vendorId_kind: { vendorId, kind: d.kind } },
      create: { vendorId, kind: d.kind, number: d.number, documentRef: d.documentRef },
      update: { number: d.number, documentRef: d.documentRef, status: 'SUBMITTED', checkedBy: null, checkedAt: null, note: null },
    })) as ProofRow;
  }
  async proofsOfVendor(vendorId: string): Promise<ProofRow[]> { return (await this.prisma.v3BusinessProof.findMany({ where: { vendorId }, orderBy: { kind: 'asc' } })) as ProofRow[]; }
  async listProofs(f: { status?: ProofStatus; vendorId?: string }, skip: number, take: number): Promise<Paged<ProofRow>> {
    const where: Prisma.V3BusinessProofWhereInput = { ...(f.status ? { status: f.status } : {}), ...(f.vendorId ? { vendorId: f.vendorId } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3BusinessProof.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }), this.prisma.v3BusinessProof.count({ where })]);
    return { items: items as ProofRow[], total };
  }
  async getProof(id: string): Promise<ProofRow | null> { return (await this.prisma.v3BusinessProof.findUnique({ where: { id } })) as ProofRow | null; }
  async reviewProof(id: string, expected: ProofStatus, patch: { status: ProofStatus; checkedBy: string; note: string | null; checkedAt: Date }): Promise<ProofRow | null> {
    const n = await this.prisma.v3BusinessProof.updateMany({ where: { id, status: expected }, data: { status: patch.status, checkedBy: patch.checkedBy, checkedAt: patch.checkedAt, note: patch.note } });
    return n.count === 1 ? this.getProof(id) : null;
  }

  // block list
  async createBlock(d: { kind: BlockKind; valueHash: string; reason: string; staffId: string | null }): Promise<BlockRow | null> {
    try { return (await this.prisma.v3TrustBlock.create({ data: { kind: d.kind, valueHash: d.valueHash, reason: d.reason, createdByStaffId: d.staffId } })) as BlockRow; } catch (e) { if (isUnique(e)) return null; throw e; }
  }
  async listBlocks(f: { kind?: BlockKind }, skip: number, take: number): Promise<Paged<BlockRow>> {
    const where: Prisma.V3TrustBlockWhereInput = f.kind ? { kind: f.kind } : {};
    const [items, total] = await Promise.all([this.prisma.v3TrustBlock.findMany({ where, orderBy: [{ at: 'desc' }, { id: 'desc' }], skip, take }), this.prisma.v3TrustBlock.count({ where })]);
    return { items: items as BlockRow[], total };
  }
  async deleteBlock(id: string): Promise<BlockRow | null> { try { return (await this.prisma.v3TrustBlock.delete({ where: { id } })) as BlockRow; } catch { return null; } }
  async findBlock(kind: BlockKind, valueHash: string): Promise<BlockRow | null> { return (await this.prisma.v3TrustBlock.findUnique({ where: { kind_valueHash: { kind, valueHash } } })) as BlockRow | null; }

  // reports
  async createReport(d: { subjectType: ReportSubject; subject: string; reporterContact: string | null; reason: string; ipHash: string | null }): Promise<ReportRow> { return (await this.prisma.v3BusinessReport.create({ data: d })) as ReportRow; }
  async listReports(f: { status?: ReportStatus }, skip: number, take: number): Promise<Paged<ReportRow>> {
    const where: Prisma.V3BusinessReportWhereInput = f.status ? { status: f.status } : {};
    const [items, total] = await Promise.all([this.prisma.v3BusinessReport.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }), this.prisma.v3BusinessReport.count({ where })]);
    return { items: items as ReportRow[], total };
  }
  async getReport(id: string): Promise<ReportRow | null> { return (await this.prisma.v3BusinessReport.findUnique({ where: { id } })) as ReportRow | null; }
  async updateReport(id: string, expected: ReportStatus, patch: { status?: ReportStatus; note?: string | null; handledByStaffId: string | null }): Promise<ReportRow | null> {
    const n = await this.prisma.v3BusinessReport.updateMany({ where: { id, status: expected }, data: { ...patch } });
    return n.count === 1 ? this.getReport(id) : null;
  }

  // prohibited terms
  async listTerms(): Promise<TermRow[]> { return (await this.prisma.v3ProhibitedTerm.findMany({ orderBy: [{ category: 'asc' }, { term: 'asc' }] })) as TermRow[]; }
  async createTerm(d: { term: string; category: string; enabled: boolean; editedBy: string | null }): Promise<TermRow | null> {
    try { return (await this.prisma.v3ProhibitedTerm.create({ data: d })) as TermRow; } catch (e) { if (isUnique(e)) return null; throw e; }
  }
  async updateTerm(id: string, patch: { term?: string; category?: string; enabled?: boolean; editedBy: string | null }): Promise<TermRow | null | 'DUPLICATE'> {
    try { return (await this.prisma.v3ProhibitedTerm.update({ where: { id }, data: patch })) as TermRow; } catch (e) { if (isUnique(e)) return 'DUPLICATE'; if ((e as { code?: string })?.code === 'P2025') return null; throw e; }
  }
  async deleteTerm(id: string): Promise<TermRow | null> { try { return (await this.prisma.v3ProhibitedTerm.delete({ where: { id } })) as TermRow; } catch { return null; } }

  // takedowns: the row and the listing change together or not at all
  async createTakedown(d: { vendorId: string | null; listingId: string | null; reason: string; documentRef: string | null; decidedBy: string; now: Date }): Promise<CreateTakedownResult> {
    return this.prisma.$transaction(async (tx) => {
      const listing = d.listingId ? await tx.v3DirectoryBusiness.findUnique({ where: { id: d.listingId } }) : d.vendorId ? await tx.v3DirectoryBusiness.findUnique({ where: { vendorId: d.vendorId } }) : null;
      const vendorId = d.vendorId ?? listing?.vendorId ?? null;
      if (d.listingId && !listing) return { ok: false as const, why: 'TARGET_UNKNOWN' as const };
      if (vendorId && !(await tx.vendor.findUnique({ where: { id: vendorId }, select: { id: true } }))) return { ok: false as const, why: 'TARGET_UNKNOWN' as const };
      const open = await tx.v3Takedown.findFirst({ where: { status: 'ACTIVE', OR: [...(vendorId ? [{ vendorId }] : []), ...(listing ? [{ listingId: listing.id }] : [])] }, select: { id: true } });
      if (open) return { ok: false as const, why: 'ALREADY_ACTIVE' as const };
      const row = await tx.v3Takedown.create({ data: { vendorId, listingId: listing?.id ?? null, reason: d.reason, documentRef: d.documentRef, decidedBy: d.decidedBy, at: d.now, priorListingStatus: listing?.status ?? null, priorIndexable: listing?.indexable ?? null } });
      if (listing && listing.status !== 'REMOVED') await tx.v3DirectoryBusiness.update({ where: { id: listing.id }, data: { status: 'REMOVED', indexable: false, removedAt: d.now } });
      return { ok: true as const, row: row as TakedownRow };
    }, { timeout: 30_000, maxWait: 10_000 });
  }
  async reverseTakedown(id: string, d: { reversedBy: string; reverseReason: string; now: Date }): Promise<TakedownRow | null> {
    return this.prisma.$transaction(async (tx) => {
      const cur = await tx.v3Takedown.findUnique({ where: { id } });
      if (!cur || cur.status !== 'ACTIVE') return null;
      const n = await tx.v3Takedown.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'REVERSED', reversedBy: d.reversedBy, reversedAt: d.now, reverseReason: d.reverseReason } });
      if (n.count !== 1) return null;
      if (cur.listingId && cur.priorListingStatus && cur.priorListingStatus !== 'REMOVED') {
        await tx.v3DirectoryBusiness.updateMany({ where: { id: cur.listingId, status: 'REMOVED' }, data: { status: cur.priorListingStatus as Prisma.V3DirectoryBusinessUpdateManyMutationInput['status'], indexable: cur.priorIndexable ?? false, removedAt: null } });
      }
      return (await tx.v3Takedown.findUnique({ where: { id } })) as TakedownRow;
    }, { timeout: 30_000, maxWait: 10_000 });
  }
  async getTakedown(id: string): Promise<TakedownRow | null> { return (await this.prisma.v3Takedown.findUnique({ where: { id } })) as TakedownRow | null; }
  async listTakedowns(f: { status?: 'ACTIVE' | 'REVERSED'; vendorId?: string }, skip: number, take: number): Promise<Paged<TakedownRow>> {
    const where: Prisma.V3TakedownWhereInput = { ...(f.status ? { status: f.status } : {}), ...(f.vendorId ? { vendorId: f.vendorId } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3Takedown.findMany({ where, orderBy: [{ at: 'desc' }, { id: 'desc' }], skip, take }), this.prisma.v3Takedown.count({ where })]);
    return { items: items as TakedownRow[], total };
  }
  async activeTakedownOfVendor(vendorId: string): Promise<TakedownRow | null> { return (await this.prisma.v3Takedown.findFirst({ where: { vendorId, status: 'ACTIVE' }, orderBy: { at: 'desc' } })) as TakedownRow | null; }
  async namesOfVendor(vendorId: string): Promise<string[]> {
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { businessName: true, name: true } });
    return v ? [v.businessName, v.name].filter((x): x is string => !!x) : [];
  }
}
