import { TERMS_KINDS, TermsKind } from '../../src/terms/core/terms-core';
import { AcceptanceRow, NewAcceptances, TermsDocRow, TermsStore } from '../../src/terms/terms.store';
import { AuditEntry } from '../../src/vendor-lifecycle/lifecycle.store';

/** In-memory twin of the Prisma terms store. JavaScript runs one statement at a time, so each method is atomic like the one database transaction behind it. Acceptances are only ever appended. */
export class MemoryTermsStore extends TermsStore {
  docs = new Map<string, TermsDocRow>();
  acceptances: Array<AcceptanceRow & { ipHash: string | null; userAgentHash: string | null }> = [];
  audits: Array<{ action: string; entityId: string | null; after: unknown }> = [];
  clock: () => Date = () => new Date();
  private n = 0;
  private id = (p: string): string => `${p}-${++this.n}`;
  private log(a: AuditEntry): void { this.audits.push({ action: a.action, entityId: a.entityId, after: a.after ?? null }); }

  async listDocuments(f: { kind?: TermsKind; status?: string }) {
    return [...this.docs.values()].filter((d) => (!f.kind || d.kind === f.kind) && (!f.status || d.status === f.status)).sort((a, b) => a.kind.localeCompare(b.kind) || b.version - a.version).map((d) => ({ ...d }));
  }
  async getDocument(id: string) { const d = this.docs.get(id); return d ? { ...d } : null; }
  async latestPublished(kind: TermsKind) { return (await this.latestPublishedMany([kind]))[0] ?? null; }
  async latestPublishedMany(kinds: readonly TermsKind[]) {
    return kinds.map((k) => [...this.docs.values()].filter((d) => d.kind === k && d.status === 'PUBLISHED').sort((a, b) => b.version - a.version)[0]).filter((d): d is TermsDocRow => !!d).map((d) => ({ ...d }));
  }
  async publicVersions(kind: TermsKind) { return [...this.docs.values()].filter((d) => d.kind === kind && d.status !== 'DRAFT').sort((a, b) => b.version - a.version).map((d) => ({ ...d })); }

  async createDraft(d: { kind: TermsKind; title: string; bodyMarkdown: string; createdBy: string | null }, audit: AuditEntry) {
    const top = Math.max(0, ...[...this.docs.values()].filter((x) => x.kind === d.kind).map((x) => x.version));
    const now = this.clock();
    const row: TermsDocRow = { id: this.id('doc'), kind: d.kind, version: top + 1, title: d.title, status: 'DRAFT', bodyMarkdown: d.bodyMarkdown, changeNote: null, publishedAt: null, publishedBy: null, createdBy: d.createdBy, createdAt: now, updatedAt: now };
    this.docs.set(row.id, row); this.log({ ...audit, entityId: row.id, after: { kind: d.kind, version: row.version, status: 'DRAFT' } });
    return { ...row };
  }
  async updateDraft(id: string, d: { title?: string; bodyMarkdown?: string }, audit: AuditEntry) {
    const cur = this.docs.get(id);
    if (!cur || cur.status !== 'DRAFT') return null;
    const next = { ...cur, ...(d.title !== undefined ? { title: d.title } : {}), ...(d.bodyMarkdown !== undefined ? { bodyMarkdown: d.bodyMarkdown } : {}), updatedAt: this.clock() };
    this.docs.set(id, next); this.log(audit);
    return { ...next };
  }
  async publish(id: string, d: { by: string | null; now: Date; changeNote: string }, audit: AuditEntry) {
    const cur = this.docs.get(id);
    if (!cur || cur.status !== 'DRAFT') return null;
    let retired = 0;
    for (const x of this.docs.values()) if (x.kind === cur.kind && x.status === 'PUBLISHED' && x.id !== id) { this.docs.set(x.id, { ...x, status: 'RETIRED' }); retired++; }
    const next: TermsDocRow = { ...cur, status: 'PUBLISHED', publishedAt: d.now, publishedBy: d.by, changeNote: d.changeNote, updatedAt: d.now };
    this.docs.set(id, next); this.log({ ...audit, after: { ...(audit.after as object), retiredPrevious: retired } });
    return { ...next };
  }

  async acceptedDocumentIds(vendorId: string, documentIds: readonly string[]) {
    return new Set(this.acceptances.filter((a) => a.vendorId === vendorId && documentIds.includes(a.documentId)).map((a) => a.documentId));
  }
  async recordAcceptances(a: NewAcceptances) {
    let n = 0;
    for (const p of a.docs) {
      if (this.acceptances.some((x) => x.vendorId === a.vendorId && x.documentId === p.documentId)) continue;
      this.acceptances.push({ id: this.id('acc'), vendorId: a.vendorId, customerRequestId: null, userId: a.userId, documentId: p.documentId, kind: p.kind, version: p.version, acceptedAt: a.now, ipHash: a.ipHash, userAgentHash: a.userAgentHash });
      n++;
    }
    if (n > 0) this.log(a.audit);
    return n;
  }
  async listAcceptances(vendorId: string) { return this.acceptances.filter((a) => a.vendorId === vendorId).map((a) => ({ ...a })); }

  async seedMissingDrafts(kinds: readonly TermsKind[], body: string) {
    const have = new Set([...this.docs.values()].map((d) => d.kind));
    const created: TermsKind[] = [];
    for (const kind of kinds) {
      if (have.has(kind)) continue;
      const now = this.clock();
      const row: TermsDocRow = { id: this.id('doc'), kind, version: 1, title: '', status: 'DRAFT', bodyMarkdown: body, changeNote: null, publishedAt: null, publishedBy: null, createdBy: null, createdAt: now, updatedAt: now };
      this.docs.set(row.id, row); created.push(kind);
    }
    return created;
  }
}

export const ALL_KINDS: readonly TermsKind[] = TERMS_KINDS;
