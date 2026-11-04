import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { KeyedQueue } from '../common/keyed-queue';
import { AuditService } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEntry } from '../vendor-lifecycle/lifecycle.store';
import { TermsKind, TermsStatus } from './core/terms-core';
import { AcceptanceRow, NewAcceptances, TermsDocRow, TermsStore } from './terms.store';

const toDoc = (r: Prisma.V3TermsDocumentGetPayload<object>): TermsDocRow => ({
  id: r.id, kind: r.kind as TermsKind, version: r.version, title: r.title, status: r.status as TermsStatus, bodyMarkdown: r.bodyMarkdown, changeNote: r.changeNote,
  publishedAt: r.publishedAt, publishedBy: r.publishedBy, createdBy: r.createdBy, createdAt: r.createdAt, updatedAt: r.updatedAt,
});

/** Prisma implementation. Per-kind work waits in the KeyedQueue BEFORE the transaction opens (never inside one), so a burst of staff actions cannot starve the pool. */
@Injectable()
export class PrismaTermsStore extends TermsStore {
  private readonly queue = new KeyedQueue();
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService) { super(); }
  private async audit(tx: Prisma.TransactionClient, a: AuditEntry): Promise<void> { await this.audits.record(tx, a.actor, a.action, a.entityType, a.entityId, a.before ?? null, a.after ?? null); }

  async listDocuments(f: { kind?: TermsKind; status?: TermsStatus }): Promise<TermsDocRow[]> {
    return (await this.prisma.v3TermsDocument.findMany({ where: { ...(f.kind ? { kind: f.kind } : {}), ...(f.status ? { status: f.status } : {}) }, orderBy: [{ kind: 'asc' }, { version: 'desc' }] })).map(toDoc);
  }
  async getDocument(id: string): Promise<TermsDocRow | null> { const r = await this.prisma.v3TermsDocument.findUnique({ where: { id } }); return r ? toDoc(r) : null; }
  async latestPublished(kind: TermsKind): Promise<TermsDocRow | null> {
    const r = await this.prisma.v3TermsDocument.findFirst({ where: { kind, status: 'PUBLISHED' }, orderBy: { version: 'desc' } });
    return r ? toDoc(r) : null;
  }
  async latestPublishedMany(kinds: readonly TermsKind[]): Promise<TermsDocRow[]> {
    const rows = await this.prisma.v3TermsDocument.findMany({ where: { kind: { in: [...kinds] }, status: 'PUBLISHED' }, orderBy: { version: 'desc' } });
    const seen = new Set<string>(); const out: TermsDocRow[] = [];
    for (const r of rows) if (!seen.has(r.kind)) { seen.add(r.kind); out.push(toDoc(r)); }
    return out;
  }
  async publicVersions(kind: TermsKind): Promise<TermsDocRow[]> {
    return (await this.prisma.v3TermsDocument.findMany({ where: { kind, status: { in: ['PUBLISHED', 'RETIRED'] } }, orderBy: { version: 'desc' } })).map(toDoc);
  }

  async createDraft(d: { kind: TermsKind; title: string; bodyMarkdown: string; createdBy: string | null }, audit: AuditEntry): Promise<TermsDocRow> {
    return this.queue.run(`terms:${d.kind}`, () => this.prisma.$transaction(async (tx) => {
      const top = await tx.v3TermsDocument.aggregate({ where: { kind: d.kind }, _max: { version: true } });
      const row = await tx.v3TermsDocument.create({ data: { kind: d.kind, version: (top._max.version ?? 0) + 1, title: d.title, bodyMarkdown: d.bodyMarkdown, createdBy: d.createdBy } });
      await this.audit(tx, { ...audit, entityId: row.id, after: { kind: d.kind, version: row.version, status: 'DRAFT' } });
      return toDoc(row);
    }));
  }

  async updateDraft(id: string, d: { title?: string; bodyMarkdown?: string }, audit: AuditEntry): Promise<TermsDocRow | null> {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.v3TermsDocument.updateMany({ where: { id, status: 'DRAFT' }, data: { ...(d.title !== undefined ? { title: d.title } : {}), ...(d.bodyMarkdown !== undefined ? { bodyMarkdown: d.bodyMarkdown } : {}) } });
      if (r.count === 0) return null;
      await this.audit(tx, audit); // the audit row records which fields changed, never the legal text itself
      const row = await tx.v3TermsDocument.findUnique({ where: { id } });
      return row ? toDoc(row) : null;
    });
  }

  async publish(id: string, d: { by: string | null; now: Date; changeNote: string }, audit: AuditEntry): Promise<TermsDocRow | null> {
    const doc = await this.prisma.v3TermsDocument.findUnique({ where: { id }, select: { kind: true } });
    if (!doc) return null;
    return this.queue.run(`terms:${doc.kind}`, () => this.prisma.$transaction(async (tx) => {
      const won = await tx.v3TermsDocument.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'PUBLISHED', publishedAt: d.now, publishedBy: d.by, changeNote: d.changeNote } });
      if (won.count === 0) return null;
      const retired = await tx.v3TermsDocument.updateMany({ where: { kind: doc.kind, status: 'PUBLISHED', id: { not: id } }, data: { status: 'RETIRED' } });
      await this.audit(tx, { ...audit, after: { ...(audit.after as object), retiredPrevious: retired.count } });
      const row = await tx.v3TermsDocument.findUnique({ where: { id } });
      return row ? toDoc(row) : null;
    }));
  }

  async acceptedDocumentIds(vendorId: string, documentIds: readonly string[]): Promise<Set<string>> {
    if (documentIds.length === 0) return new Set();
    return new Set((await this.prisma.v3TermsAcceptance.findMany({ where: { vendorId, documentId: { in: [...documentIds] } }, select: { documentId: true } })).map((r) => r.documentId));
  }
  async recordAcceptances(a: NewAcceptances): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.v3TermsAcceptance.createMany({
        data: a.docs.map((p) => ({ vendorId: a.vendorId, userId: a.userId, documentId: p.documentId, kind: p.kind, version: p.version, acceptedAt: a.now, ipHash: a.ipHash, userAgentHash: a.userAgentHash })),
        skipDuplicates: true,
      });
      if (r.count > 0) await this.audit(tx, a.audit);
      return r.count;
    });
  }
  async listAcceptances(vendorId: string): Promise<AcceptanceRow[]> {
    return (await this.prisma.v3TermsAcceptance.findMany({ where: { vendorId }, orderBy: { acceptedAt: 'desc' } })).map((r) => ({
      id: r.id, vendorId: r.vendorId, customerRequestId: r.customerRequestId, userId: r.userId, documentId: r.documentId, kind: r.kind as TermsKind, version: r.version, acceptedAt: r.acceptedAt,
    }));
  }

  async seedMissingDrafts(kinds: readonly TermsKind[], body: string): Promise<TermsKind[]> {
    const have = new Set((await this.prisma.v3TermsDocument.findMany({ where: { kind: { in: [...kinds] } }, select: { kind: true } })).map((r) => r.kind as string));
    const missing = kinds.filter((k) => !have.has(k));
    if (missing.length) await this.prisma.v3TermsDocument.createMany({ data: missing.map((kind) => ({ kind, version: 1, status: 'DRAFT' as const, title: '', bodyMarkdown: body })), skipDuplicates: true });
    return [...missing];
  }
}
