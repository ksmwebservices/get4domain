import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DocDiff, ManagedDoc, normaliseDoc } from '../core/managed-doc';
import { SubmissionStatus } from '../core/review-core';

export interface SubmissionRow {
  id: string; vendorId: string; scope: string; payload: ManagedDoc; payloadHash: string; changed: DocDiff; status: SubmissionStatus;
  submittedById: string | null; reviewerId: string | null; reason: string | null; submittedAt: Date; decidedAt: Date | null;
}
export type NewSubmission = Pick<SubmissionRow, 'vendorId' | 'payload' | 'payloadHash' | 'changed' | 'submittedById'>;
export interface SubmissionFilter { status?: SubmissionStatus; vendorId?: string }

/** Review submissions. Prisma below; a memory twin lives in test/support. Every vendor read names the vendor; the staff reads are by id or by filter. */
export abstract class ReviewStore {
  /** Creates a SUBMITTED row, or returns null when the vendor already has one waiting. */
  abstract create(n: NewSubmission, now: Date): Promise<SubmissionRow | null>;
  abstract get(id: string): Promise<SubmissionRow | null>;
  abstract getForVendor(vendorId: string, id: string): Promise<SubmissionRow | null>;
  abstract listForVendor(vendorId: string, take: number): Promise<SubmissionRow[]>;
  abstract list(f: SubmissionFilter, skip: number, take: number): Promise<{ items: SubmissionRow[]; total: number }>;
  /** Compare and set: moves a SUBMITTED row to APPROVED or REJECTED; null when it was not SUBMITTED any more. */
  abstract decide(id: string, to: 'APPROVED' | 'REJECTED', patch: { reviewerId: string | null; reason: string | null; at: Date }): Promise<SubmissionRow | null>;
}

type DbRow = { id: string; vendorId: string; scope: string; payloadJson: Prisma.JsonValue; payloadHash: string; changedJson: Prisma.JsonValue; status: SubmissionStatus; submittedById: string | null; reviewerId: string | null; reason: string | null; submittedAt: Date; decidedAt: Date | null };
const map = (r: DbRow): SubmissionRow => ({ id: r.id, vendorId: r.vendorId, scope: r.scope, payload: normaliseDoc(r.payloadJson), payloadHash: r.payloadHash, changed: r.changedJson as unknown as DocDiff, status: r.status, submittedById: r.submittedById, reviewerId: r.reviewerId, reason: r.reason, submittedAt: r.submittedAt, decidedAt: r.decidedAt });

@Injectable()
export class PrismaReviewStore extends ReviewStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async create(n: NewSubmission, now: Date): Promise<SubmissionRow | null> {
    try {
      return map(await this.prisma.v3ContentSubmission.create({ data: { vendorId: n.vendorId, payloadJson: n.payload as unknown as Prisma.InputJsonValue, payloadHash: n.payloadHash, changedJson: n.changed as unknown as Prisma.InputJsonValue, submittedById: n.submittedById, status: 'SUBMITTED', openVendorId: n.vendorId, submittedAt: now } }));
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return null;   // the vendor already has a submission waiting
      throw e;
    }
  }
  async get(id: string) { const r = await this.prisma.v3ContentSubmission.findUnique({ where: { id } }); return r ? map(r) : null; }
  async getForVendor(vendorId: string, id: string) { const r = await this.prisma.v3ContentSubmission.findFirst({ where: { vendorId, id } }); return r ? map(r) : null; }
  async listForVendor(vendorId: string, take: number) { return (await this.prisma.v3ContentSubmission.findMany({ where: { vendorId }, orderBy: { submittedAt: 'desc' }, take })).map(map); }
  async list(f: SubmissionFilter, skip: number, take: number) {
    const where = { ...(f.status ? { status: f.status } : {}), ...(f.vendorId ? { vendorId: f.vendorId } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3ContentSubmission.findMany({ where, orderBy: { submittedAt: 'desc' }, skip, take }), this.prisma.v3ContentSubmission.count({ where })]);
    return { items: items.map(map), total };
  }
  async decide(id: string, to: 'APPROVED' | 'REJECTED', patch: { reviewerId: string | null; reason: string | null; at: Date }) {
    const done = await this.prisma.v3ContentSubmission.updateMany({ where: { id, status: 'SUBMITTED' }, data: { status: to, reviewerId: patch.reviewerId, reason: patch.reason, decidedAt: patch.at, openVendorId: null } });
    return done.count === 1 ? this.get(id) : null;
  }
}
